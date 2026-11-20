// Optional reader for Gradescope, where some courses keep work that never appears in
// Brightspace. Off unless the student switches it on. Read-only: it asks the background
// script to GET two kinds of page with the student's own Gradescope session (the one a
// course's Gradescope link in Brightspace creates) and reads the tables on them.
//
// Page structure, as used by the public gradescope-api project:
//   /account        div#account-show > .courseList > .courseList--term, then <a href="/courses/ID">
//                   with h3.courseBox--shortname and div.courseBox--name
//   /courses/ID     tr[role=row]: th = name (a[href] once submitted, or
//                   button.js-submitAssignment[data-assignment-id]), td = "8.0 / 10.0" or a status,
//                   td = time.submissionTimeChart--releaseDate / --dueDate [datetime]
BSX.gradescope = (() => {
  const ORIGIN = 'https://www.gradescope.com';
  const TTL = 5 * 60 * 1000;
  const cache = new Map();
  const runtime = (globalThis.browser || globalThis.chrome)?.runtime;

  function page(path) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const promise = (async () => {
      if (!runtime || !runtime.sendMessage) throw new Error('Gradescope reading is not available here.');
      const res = await runtime.sendMessage({ type: 'bsx-gradescope', path });
      if (res && res.error === 'permission') throw Object.assign(new Error('Gradescope access is not allowed yet.'), { code: 'permission' });
      if (!res || res.error) throw new Error((res && res.error) || 'No answer from the extension.');
      return res; // { status, url, html }
    })();
    cache.set(path, { at: Date.now(), promise });
    promise.catch(() => cache.delete(path));
    return promise;
  }

  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

  // "2026-11-16 23:59:00 -0500" -> ISO. Anything else is handed to Date.parse.
  function toIso(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)\s*(Z|[+-]\d{2}):?(\d{2})?$/);
    const t = Date.parse(m ? `${m[1]}T${m[2]}${m[3] === 'Z' ? 'Z' : `${m[3]}:${m[4] || '00'}`}` : s);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }

  const signedOut = (res) => {
    try {
      if (/^\/login/.test(new URL(res.url).pathname)) return true;
    } catch {}
    return res.status === 401;
  };

  function parseCourses(html) {
    const doc = parse(html);
    const out = [];
    for (const a of doc.querySelectorAll('#account-show a[href^="/courses/"]')) {
      const id = (a.getAttribute('href').match(/^\/courses\/(\d+)/) || [])[1];
      const short = text(a.querySelector('.courseBox--shortname'));
      if (id && short) out.push({ id, short_name: short, name: text(a.querySelector('.courseBox--name')) });
    }
    return out;
  }

  function parseAssignments(html, courseId) {
    const doc = parse(html);
    const out = [];
    for (const row of doc.querySelectorAll('tr[role="row"]')) {
      const head = row.querySelector('th');
      const cells = row.querySelectorAll('td');
      if (!head || !cells.length) continue; // the header row has no td; the tail row has no th
      const link = head.querySelector('a[href]');
      const button = head.querySelector('button.js-submitAssignment');
      const name = text(head);
      if (!name) continue;
      const href = link ? link.getAttribute('href') : '';
      const id = (href.match(/\/assignments\/(\d+)/) || [])[1] || (button && button.getAttribute('data-assignment-id')) || name;
      const status = text(cells[0]);
      const points = status.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
      const due = cells[1] ? cells[1].querySelectorAll('.submissionTimeChart--dueDate') : [];
      out.push({
        id: String(id),
        name,
        status: points ? 'Graded' : status,
        score: points ? Number(points[1]) : null,
        max: points ? Number(points[2]) : null,
        due_at: toIso(due[0] && due[0].getAttribute('datetime')),
        late_due_at: toIso(due[1] && due[1].getAttribute('datetime')),
        url: href && href.startsWith('/') ? ORIGIN + href : `${ORIGIN}/courses/${courseId}`,
      });
    }
    return out;
  }

  // Subject and number, e.g. "MATH201" from "wl.202710.MATH.20100.102" or "MATH 20100".
  const subjectKey = (s) => {
    const m = String(s || '').toUpperCase().match(/\b([A-Z]{2,5})[\s.]?(\d{3})(\d{2})?\b/);
    return m ? m[1] + m[2] : null;
  };

  // The Gradescope course that belongs to a Brightspace course: same short name as the
  // course code, or failing that the same subject and number (newest term listed first).
  function match(course, gsCourses) {
    const code = String(course.course_code || '').toLowerCase();
    const exact = gsCourses.find((g) => g.short_name.toLowerCase() === code);
    if (exact) return exact;
    const key = subjectKey(course.course_code) || subjectKey(course.name);
    return (key && gsCourses.find((g) => subjectKey(g.short_name) === key || subjectKey(g.name) === key)) || null;
  }

  // Work for one Brightspace course. state: ok | signed_out | no_match | no_permission
  async function forCourse(course) {
    try {
      return await readCourse(course);
    } catch (e) {
      if (e && e.code === 'permission') return { state: 'no_permission', items: [] };
      throw e;
    }
  }

  async function readCourse(course) {
    const account = await page('/account');
    if (signedOut(account)) return { state: 'signed_out', items: [] };
    const gs = match(course, parseCourses(account.html));
    if (!gs) return { state: 'no_match', items: [] };
    const res = await page(`/courses/${gs.id}`);
    if (signedOut(res)) return { state: 'signed_out', items: [] };
    const items = parseAssignments(res.html, gs.id).map((a, n) => {
      const submitted = a.score != null || (!/^no submission$/i.test(a.status) && a.status !== '');
      return {
        kind: 'external',
        source: 'Gradescope',
        source_id: `gs-${gs.id}-${a.id}`,
        course_id: course.id,
        name: a.name,
        due_at: a.due_at,
        late_due_at: a.late_due_at,
        points_possible: a.max,
        grade: a.score != null ? { score: a.score, points_possible: a.max, displayed: '', comment: '', graded_at: null } : null,
        submitted,
        status: a.status || 'No Submission',
        order: [0, n], // the order of Gradescope's own table
        html_url: a.url,
      };
    });
    return { state: 'ok', items, course_url: `${ORIGIN}/courses/${gs.id}` };
  }

  // Items across several courses; courses without a match contribute nothing.
  async function forCourses(courses) {
    const results = await Promise.all(courses.map((c) => forCourse(c).catch(() => ({ state: 'error', items: [] }))));
    return results.flatMap((r) => r.items);
  }

  return { forCourse, forCourses, parseCourses, parseAssignments, toIso, match, clear: () => cache.clear() };
})();

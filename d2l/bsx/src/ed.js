// Optional reader for Ed Discussion (edstem.org), where some courses keep lessons and
// homework with due dates. Off unless the student switches it on and gives an Ed API token
// (Ed → Settings → API Tokens). Read-only: the background script GETs /api/user (courses)
// and /api/courses/{id}/lessons with that token.
//
// /api/user returns { courses: [{ course: { id, code, name, year, session, status, features: { lessons } } }] }
// (as documented by the public edapi project). Lesson fields are read defensively: title,
// due_at, available_at, is_hidden, state, and a completion status where Ed provides one.
BSX.ed = (() => {
  const runtime = (globalThis.browser || globalThis.chrome)?.runtime;
  const TTL = 5 * 60 * 1000;
  const cache = new Map();

  function get(path) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const promise = (async () => {
      if (!runtime || !runtime.sendMessage) throw new Error('Ed reading is not available here.');
      const res = await runtime.sendMessage({ type: 'bsx-ed', path });
      if (res && ['permission', 'no_token', 'bad_token'].includes(res.error)) throw Object.assign(new Error(res.error), { code: res.error });
      if (!res || res.error) throw new Error((res && res.error) || 'No answer from the extension.');
      return res.json;
    })();
    cache.set(path, { at: Date.now(), promise });
    promise.catch(() => cache.delete(path));
    return promise;
  }

  // Subject and number, e.g. "CS251" from "CS 251", "CS 25100" or "wl.202710.CS.25100.LE1".
  const subjectKey = (s) => {
    const m = String(s || '').toUpperCase().match(/\b([A-Z]{2,5})[\s.]?(\d{3})(\d{2})?\b/);
    return m ? m[1] + m[2] : null;
  };

  // The student's current Ed courses that have lessons.
  async function courses() {
    const user = await get('/api/user');
    return (user.courses || [])
      .map((c) => c.course || c)
      .filter((c) => c && c.id != null && c.status !== 'archived')
      .map((c) => ({ id: c.id, code: c.code || '', name: c.name || '', term: [c.session, c.year].filter(Boolean).join(' '), lessons: c.features ? c.features.lessons !== false : true }));
  }

  // Which Brightspace course an Ed course belongs to: the student's own choice in `map`
  // (0 hides it), otherwise the same subject and number.
  function brightspaceFor(edCourse, bsCourses, map = {}) {
    if (Object.prototype.hasOwnProperty.call(map, edCourse.id)) {
      const chosen = Number(map[edCourse.id]);
      return chosen ? bsCourses.find((c) => c.id === chosen) || null : null;
    }
    const key = subjectKey(edCourse.code) || subjectKey(edCourse.name);
    return (key && bsCourses.find((c) => subjectKey(c.course_code) === key || subjectKey(c.name) === key)) || null;
  }

  // Ed's lesson status is unattempted, attempted or completed (confirmed on a real account);
  // a submission time also means it was handed in.
  const doneStatus = (l) => {
    const s = String(l.status || '').toLowerCase();
    if (s === 'completed' || l.submitted_at) return 'Completed';
    if (s === 'attempted' || l.attempted_at) return 'Attempted';
    return '';
  };

  // Ed gives each student an effective due date (it includes extensions); prefer it.
  const dueOf = (l) => l.effective_due_at || l.due_at || l.effective_locked_at || l.locked_at || null;

  function lessonItems(edCourse, json, bsCourse, region) {
    const list = Array.isArray(json) ? json : json.lessons || [];
    const moduleNames = new Map((json.modules || []).map((m) => [m.id, m.name]));
    return list
      // Undated lessons (readings, slides) are kept too: they show in the [Ed] module, while
      // To Do, the calendar and the planner only take dated work.
      .filter((l) => l && l.id != null && !l.is_hidden && !l.is_unlisted && l.state !== 'draft')
      .map((l) => {
        const status = doneStatus(l);
        return {
          kind: 'external',
          source: 'Ed',
          source_id: `ed-${edCourse.id}-${l.id}`,
          course_id: bsCourse.id,
          name: l.title || 'Ed lesson',
          group: moduleNames.get(l.module_id) || null,
          // Lessons keep Ed's order within their module (modules themselves are arranged by
          // kind and name in the [Ed] module; see sourceModules).
          order: [0, l.index ?? l.number ?? 0],
          due_at: dueOf(l),
          points_possible: null,
          grade: null,
          submitted: status === 'Completed',
          status: status || 'Not completed',
          html_url: `https://edstem.org/${region}/courses/${edCourse.id}/lessons/${l.id}`,
        };
      });
  }

  // Work from Ed for the given Brightspace courses. state: ok | no_token | bad_token | no_permission
  async function forCourses(bsCourses, { map = {}, region = 'us' } = {}) {
    try {
      const eds = (await courses()).filter((c) => c.lessons);
      const pairs = eds.map((e) => [e, brightspaceFor(e, bsCourses, map)]).filter(([, b]) => b);
      const lists = await Promise.all(pairs.map(([e, b]) => get(`/api/courses/${e.id}/lessons`).then((j) => lessonItems(e, j, b, region)).catch(() => [])));
      return { state: 'ok', items: lists.flat(), courses: eds };
    } catch (e) {
      if (e && e.code) return { state: e.code === 'permission' ? 'no_permission' : e.code, items: [], courses: [] };
      throw e;
    }
  }

  // Ed announcements (threads of type "announcement") for the given Brightspace courses.
  // GET /api/courses/{id}/threads?limit=&offset=0&sort=new returns { threads: [...] } with
  // id, type, title, document (plain text), created_at, is_seen, is_pinned (per the edapi project).
  async function announcements(bsCourses, { map = {}, region = 'us' } = {}) {
    try {
      const eds = await courses();
      const pairs = eds.map((e) => [e, brightspaceFor(e, bsCourses, map)]).filter(([, b]) => b);
      const lists = await Promise.all(pairs.map(([e, b]) => get(`/api/courses/${e.id}/threads?limit=50&offset=0&sort=new`).then((j) => (j.threads || [])
        .filter((t) => t && t.type === 'announcement' && !t.deleted_at)
        .map((t) => ({
          source: 'Ed',
          id: `ed-${t.id}`,
          course_id: b.id,
          title: t.title || 'Ed announcement',
          message: String(t.document || '').trim(),
          posted_at: t.created_at || null,
          pinned: Boolean(t.is_pinned),
          unread: t.is_seen === false,
          html_url: `https://edstem.org/${region}/courses/${e.id}/discussion/${t.id}`,
        }))).catch(() => [])));
      return lists.flat().sort((a, b) => Date.parse(b.posted_at || 0) - Date.parse(a.posted_at || 0));
    } catch {
      return [];
    }
  }

  // Field names and types of Ed's answers, with no values, for checking the reader against
  // a real account (like the Brightspace access probe).
  function shape(v, depth = 0) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return { _array: v.length, _of: v.length ? shape(v[0], depth + 1) : null };
    if (typeof v === 'object') {
      if (depth > 5) return 'object';
      const out = {};
      for (const k of Object.keys(v).slice(0, 80)) out[k] = shape(v[k], depth + 1);
      return out;
    }
    return typeof v;
  }
  async function report() {
    const out = { generatedAt: new Date().toISOString(), user: null, lessons: null, notes: [] };
    try {
      const user = await get('/api/user');
      out.user = shape(user);
      const first = (user.courses || []).map((c) => c.course || c).find((c) => c && c.id != null && c.status !== 'archived');
      if (first) {
        const lessons = await get(`/api/courses/${first.id}/lessons`);
        out.lessons = shape(lessons);
        const list = Array.isArray(lessons) ? lessons : lessons.lessons || [];
        // Which status words appear, so completion can be read correctly (words only, no titles).
        out.lessonStatusValues = [...new Set(list.map((l) => String(l.status ?? '')).filter(Boolean))].slice(0, 20);
        out.lessonStateValues = [...new Set(list.map((l) => String(l.state ?? '')).filter(Boolean))].slice(0, 20);
        // Where scores live: one lesson the student has done, its details (slides, and any
        // challenge in them), and that challenge's submissions. Shapes only, never values.
        const done = list.find((l) => /completed|attempted/i.test(String(l.status || ''))) || list.find((l) => l.submitted_at);
        if (done) {
          const detail = await get(`/api/lessons/${done.id}?view=1`).catch((e) => ({ error: e.code || e.message }));
          out.lessonDetail = shape(detail);
          const slides = detail?.lesson?.slides || detail?.slides || [];
          out.slideTypeValues = [...new Set(slides.map((s) => String(s.type ?? '')).filter(Boolean))];
          const challenge = slides.find((s) => s.challenge_id != null);
          if (challenge) out.challengeSubmissions = shape(await get(`/api/challenges/${challenge.challenge_id}/submissions`).catch((e) => ({ error: e.code || e.message })));
          else out.notes.push('No slide with a challenge_id in the first done lesson.');
        } else out.notes.push('No completed or attempted lesson found to inspect.');
        const threads = await get(`/api/courses/${first.id}/threads?limit=50&offset=0&sort=new`).catch((e) => ({ error: e.code || e.message }));
        out.threads = shape(threads);
        out.threadTypeValues = [...new Set((threads.threads || []).map((t) => String(t.type ?? '')).filter(Boolean))];
      } else out.notes.push('No current course found.');
    } catch (e) {
      out.notes.push(`Error: ${e.code || e.message}`);
    }
    return out;
  }

  return { courses, forCourses, announcements, brightspaceFor, lessonItems, subjectKey, report, clear: () => cache.clear() };
})();

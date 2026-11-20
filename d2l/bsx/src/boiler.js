// BoilerClasses (grade distributions from Purdue's grade data) and BoilerExams (past exams to
// practise on), for Purdue courses. Both are read through background.js. The grade maths is
// plain functions so tests can run it without a browser.
BSX.boiler = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const cache = new Map();

  async function ask(msg) {
    if (!api || !api.runtime || !api.runtime.sendMessage) throw new Error('Not available here.');
    const res = await api.runtime.sendMessage({ type: 'bsx-boiler', ...msg });
    if (!res || res.error) throw Object.assign(new Error(res ? res.error : 'No answer from the extension.'), { code: res && res.error });
    return res.data;
  }
  const once = (key, fn) => {
    if (!cache.has(key)) {
      const p = fn();
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
  };

  // A subject and number in text: "CS 25100", "CS.25100", "EAPS 106 DIST", "MA-16100". Old
  // three-digit numbers are the first three digits of today's five (EAPS 106 is EAPS 10600).
  const CODE = /(?:^|[^A-Za-z])([A-Z]{2,5})[\s._-]*(\d{3}|\d{5})(?!\d)/;
  function parseCode(text) {
    const m = String(text || '').match(CODE);
    return m ? `${m[1]}${m[2].length === 3 ? `${m[2]}00` : m[2]}` : null;
  }
  // "CS25100" for a Brightspace course: the code the student linked it to (⋮ on its card),
  // else one found in its Brightspace code (wl.202710.CS.25100.LE1) or name ("Fall 2026 CS
  // 25100-LE1 LEC - …", "EAPS 106 DIST"). Null for courses without one (a name in hangul).
  function code(course) {
    const linked = globalThis.BSX && BSX.ui && BSX.ui.settings && BSX.ui.settings.courses[course.id]?.code;
    if (linked) return linked;
    return parseCode(course.code) || parseCode(course.name);
  }
  // "Fall 2026" for a course: from its name, else from today's date.
  function term(course, now = new Date()) {
    const m = String(course.name || '').match(/\b(Fall|Spring|Summer)\s+(\d{4})\b/i);
    if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}`;
    const month = now.getMonth();
    return `${month >= 7 ? 'Fall' : month <= 4 ? 'Spring' : 'Summer'} ${now.getFullYear()}`;
  }

  // BoilerClasses' data for a course (grade distributions by instructor and semester), or null
  // when it has no page for it.
  const classes = (course) => {
    const c = code(course);
    return c ? once(`classes:${c}`, () => ask({ op: 'classes', code: c })) : Promise.resolve(null);
  };
  // The BoilerExams page for a course, or null when BoilerExams has no exams for it.
  const HOME = 'https://www.boilerexams.com';
  const examsFor = async (course) => {
    const c = code(course);
    if (!c) return null;
    const list = await once('exams', () => ask({ op: 'exams' })).catch(() => []);
    return list.includes(c) ? { code: c, url: `${HOME}/courses/${c}` } : null;
  };
  // A BoilerExams course's past exams, topics and this term's exam dates, or null. An exam held
  // in several rooms at once (split by section) is one event with all its rooms.
  const examsCourse = async (course) => {
    const e = await examsFor(course);
    if (!e) return null;
    const d = await once(`examsCourse:${e.code}`, () => ask({ op: 'examsCourse', code: e.code }));
    return { ...e, ...d, events: mergeEvents(d.events) };
  };
  function mergeEvents(events) {
    const by = new Map();
    for (const x of events || []) {
      const k = `${x.title}|${x.start}|${x.end}`;
      if (!by.has(k)) by.set(k, { ...x, rooms: [] });
      for (const r of String(x.location || '').split(',').map((s) => s.trim()).filter(Boolean)) if (!by.get(k).rooms.includes(r)) by.get(k).rooms.push(r);
    }
    return [...by.values()].map(({ rooms, ...x }) => ({ ...x, location: rooms.join(', ') }));
  }
  const SEASON = { FALL: 'Fall', SPRING: 'Spring', SUMMER: 'Summer' };
  // "Fall 2021 Exam 1" (number 0 is the final).
  const examLabel = (x) => `${SEASON[x.season] || x.season} ${x.year} ${x.number ? `Exam ${x.number}` : 'Final'}`;
  const examUrl = (c, x) => `${HOME}/courses/${c}/exams/${x.season}-${x.year}-${x.number}`;
  const topicUrl = (c, name) => `${HOME}/courses/${c}/topics/${encodeURIComponent(name)}`;
  // Brightspace items that are exams: "Midterm 2", "Final Exam", "Exam 1", "Test 3". Not "Unit
  // tests" or "Final Project".
  const isExam = (title) => /\b(exams?|midterms?)\b|\bfinal\b(?!\s+(project|paper|report|presentation|essay|portfolio))|\btest\s*#?\d/i.test(String(title || ''));

  // BoilerClasses' prerequisites ("CS18200FoundationsOfComputerScience False", "and", "(", …)
  // as text: "CS 18200 and (CS 24000 or STAT 24200)".
  function prereqText(tokens) {
    return (tokens || []).map((t) => {
      const m = String(t).match(/^([A-Z]{2,5})(\d{5})/);
      return m ? `${m[1]} ${m[2]}` : String(t).trim();
    }).join(' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
  }

  // ---- grade maths ------------------------------------------------------------
  // BoilerClasses lists 13 grade shares (percent of the class) then the semester GPA.
  const LETTERS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
  // A common Purdue scale; a course's own syllabus may differ.
  const CUTS = [97, 93, 90, 87, 83, 80, 77, 73, 70, 67, 63, 60, 0];
  const letterOf = (percent) => LETTERS[CUTS.findIndex((c) => percent >= c)];

  // Grade shares averaged over some instructors' semesters (all of them when none are named or
  // none has data), with that average GPA and how many semesters went in.
  function distribution(data, instructors = []) {
    const by = data && data.gpa ? data.gpa : {};
    const pick = instructors.filter((p) => by[p] && Object.keys(by[p]).length);
    const who = pick.length ? pick : Object.keys(by);
    const sems = who.flatMap((p) => Object.values(by[p] || {})).filter((v) => Array.isArray(v) && v.length >= 14);
    if (!sems.length) return null;
    const shares = LETTERS.map((_, n) => sems.reduce((s, v) => s + (Number(v[n]) || 0), 0) / sems.length);
    const gpa = sems.reduce((s, v) => s + (Number(v[13]) || 0), 0) / sems.length;
    return { shares, gpa, semesters: sems.length, instructors: who, forInstructor: Boolean(pick.length) };
  }
  // Where a percentage would fall in a distribution: the share of students with a lower letter
  // plus half of those with the same letter, as a percentile (0–100).
  function percentile(shares, percent) {
    const total = shares.reduce((s, x) => s + x, 0);
    if (!total || percent == null || !Number.isFinite(percent)) return null;
    const n = LETTERS.indexOf(letterOf(percent));
    const below = shares.slice(n + 1).reduce((s, x) => s + x, 0);
    return { letter: LETTERS[n], percentile: Math.round(((below + shares[n] / 2) / total) * 100) };
  }
  // A / B / C / D / F totals, for a compact bar.
  const bands = (shares) => ['A', 'B', 'C', 'D', 'F'].map((b, n) => ({ band: b, share: n < 4 ? shares[n * 3] + shares[n * 3 + 1] + shares[n * 3 + 2] : shares[12] }));

  return { code, parseCode, term, classes, examsFor, examsCourse, examLabel, examUrl, topicUrl, isExam, prereqText, HOME, LETTERS, letterOf, distribution, percentile, bands };
})();

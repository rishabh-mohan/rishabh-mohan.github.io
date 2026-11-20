// purdue.io: Purdue's class schedule (sections, meeting days and times, rooms, instructors),
// read through background.js. Brightspace does not say which section a student is in, so the
// student picks theirs once per course (or a lecture is picked from the course's instructor).
// The schedule maths is plain functions so tests can run it without a browser.
BSX.pio = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const cache = new Map();

  // Purdue term codes: Fall 2026 is 202710, Spring 2027 202720, Summer 2027 202730.
  function term(course, now = new Date()) {
    const m = String(course.code || '').match(/(?:^|\.)(\d{4})(10|20|30)\./);
    if (m) return `${m[1]}${m[2]}`;
    const n = String(course.name || '').match(/\b(Fall|Spring|Summer)\s+(\d{4})\b/i);
    const season = n ? n[1].toLowerCase() : now.getMonth() >= 7 ? 'fall' : now.getMonth() <= 4 ? 'spring' : 'summer';
    const year = n ? Number(n[2]) : now.getFullYear();
    return season === 'fall' ? `${year + 1}10` : `${year}${season === 'spring' ? '20' : '30'}`;
  }

  // Every section of the course this term, or null when purdue.io has none.
  function sections(course) {
    const code = BSX.boiler && BSX.boiler.code(course);
    if (!code) return Promise.resolve(null);
    const key = `${term(course)}|${code}`;
    if (!cache.has(key)) {
      const p = (async () => {
        if (!api || !api.runtime || !api.runtime.sendMessage) throw new Error('Not available here.');
        const res = await api.runtime.sendMessage({ type: 'bsx-pio', code, term: term(course) });
        if (!res || res.error) throw Object.assign(new Error(res ? res.error : 'No answer from the extension.'), { code: res && res.error });
        return res.data;
      })();
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
  }

  // The lecture to assume when exactly one lecture section is taught by one of the course's
  // instructors in Brightspace (their names, from the class list).
  function autoPick(data, instructorNames) {
    if (!data) return [];
    const last = (n) => String(n).trim().split(/\s+/).pop().toLowerCase();
    const known = new Set(instructorNames.map(last));
    const lectures = data.sections.filter((s) => /lecture/i.test(s.type));
    const hits = lectures.filter((s) => s.meetings.some((m) => m.instructors.some((i) => known.has(last(i.name)))));
    return hits.length === 1 ? [hits[0].crn] : lectures.length === 1 ? [lectures[0].crn] : [];
  }

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = { Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'R', Friday: 'F', Saturday: 'S', Sunday: 'U' };
  const dayLetters = (days) => days.map((d) => SHORT[d] || d).join('');
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // A meeting's start and end on a given day, as Dates.
  function at(date, m) {
    const [hh, mm] = m.start.split(':').map(Number);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm);
    return { start, end: new Date(start.getTime() + m.minutes * 60e3) };
  }
  // Days without classes, from the Registrar's academic calendars (2026-27 and 2027-28, as
  // published; "dates are subject to change"). purdue.io knows when a section starts and ends
  // but not its breaks. Add the next year's here when the Registrar publishes it.
  const BREAKS = [
    ['2026-09-07', '2026-09-07', 'Labor Day'],
    ['2026-10-12', '2026-10-13', 'Fall break'],
    ['2026-11-25', '2026-11-28', 'Thanksgiving break'],
    ['2026-12-24', '2026-12-25', 'Christmas holiday'],
    ['2026-12-28', '2026-12-31', 'Winter recess'],
    ['2027-01-01', '2027-01-01', 'New Year’s Day'],
    ['2027-01-18', '2027-01-18', 'Martin Luther King Jr. Day'],
    ['2027-03-15', '2027-03-20', 'Spring break'],
    ['2027-05-31', '2027-05-31', 'Memorial Day'],
    ['2027-07-05', '2027-07-05', 'Fourth of July'],
    ['2027-09-06', '2027-09-06', 'Labor Day'],
    ['2027-10-11', '2027-10-12', 'Fall break'],
    ['2027-11-24', '2027-11-27', 'Thanksgiving break'],
    ['2027-12-23', '2027-12-24', 'Christmas holiday'],
    ['2027-12-30', '2027-12-31', 'Winter recess'],
    ['2028-01-17', '2028-01-17', 'Martin Luther King Jr. Day'],
    ['2028-03-13', '2028-03-18', 'Spring break'],
    ['2028-05-29', '2028-05-29', 'Memorial Day'],
    ['2028-07-04', '2028-07-04', 'Fourth of July'],
  ];
  // The break a day falls in ("Thanksgiving break"), or null.
  const breakOn = (date) => {
    const k = ymd(date);
    const b = BREAKS.find(([from, to]) => k >= from && k <= to);
    return b ? b[2] : null;
  };

  // The picked sections' meetings on one day, earliest first. None on a break.
  function meetingsOn(data, crns, date) {
    if (!data || breakOn(date)) return [];
    const day = DAYS[date.getDay()];
    const k = ymd(date);
    const out = [];
    for (const s of data.sections) {
      if (!crns.includes(s.crn)) continue;
      for (const m of s.meetings) {
        if (!m.start || !m.days.includes(day) || (m.from && k < m.from) || (m.to && k > m.to)) continue;
        out.push({ section: s, meeting: m, ...at(date, m) });
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }
  // "WALC 1055", and a map search for the building.
  const where = (m) => (m.building ? `${m.building.code} ${m.room || ''}`.trim() : m.room || '');
  const mapUrl = (m) => (m.building ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.building.name}, Purdue University, West Lafayette, IN`)}` : null);

  return { term, sections, autoPick, meetingsOn, breakOn, dayLetters, at, where, mapUrl, DAYS };
})();

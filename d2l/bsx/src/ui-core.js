// Layer 3, part 1: the frame around every page (global navigation, trays, header),
// routing, preferences and shared helpers. Pages register themselves on BSX.ui.views.
//
// The wrapper is shown over the Brightspace home pages and over Brightspace's own list
// pages (grades, assignments, announcements, quizzes, discussions, content); every other
// Brightspace page is left alone. Routes live in the URL hash:
//   #/                      dashboard          #/courses        all courses
//   #/grades                all grades         #/calendar[/YYYY-MM]
//   #/courses/{id}[/{section}[/{item}]]        a course page or one item in it
//   #brightspace            wrapper off, original page visible
BSX.ui = (() => {
  // Never inside a frame. (BSX_DEV_FRAME is set only by the dev server's phone-width preview;
  // extension scripts run in their own world and never see it.)
  if (window.top !== window && !globalThis.BSX_DEV_FRAME) return null;

  // Which Brightspace page is this, and which wrapper page stands in for it?
  function detectEntry(p, search) {
    const ou = Number(new URLSearchParams(search).get('ou')) || null;
    let m = p.match(/^\/d2l\/home(?:\/(\d+))?\/?$/);
    if (m) return { kind: 'home', id: m[1] ? Number(m[1]) : null };
    if (/^\/d2l\/lms\/grades\/my_grades\/main\.d2l$/i.test(p)) return { kind: 'grades', id: ou };
    if (/^\/d2l\/lms\/dropbox\/(user\/folders_list|dropbox)\.d2l$/i.test(p)) return { kind: 'assignments', id: ou };
    if (/^\/d2l\/lms\/news\/main\.d2l$/i.test(p)) return { kind: 'announcements', id: ou };
    if (/^\/d2l\/lms\/quizzing\/user\/quizzes_list\.d2l$/i.test(p)) return { kind: 'quizzes', id: ou };
    if (/^\/d2l\/lms\/classlist\/classlist\.d2l$/i.test(p)) return { kind: 'people', id: ou };
    m = p.match(/^\/d2l\/le\/content\/(\d+)\/Home\/?$/i) || p.match(/^\/d2l\/le\/lessons\/(\d+)\/?$/i); // classic and newer Content
    if (m) return { kind: 'modules', id: Number(m[1]) };
    m = p.match(/^\/d2l\/le\/(\d+)\/discussions\/List\/?$/i);
    if (m) return { kind: 'discussions', id: Number(m[1]) };
    return null;
  }
  const entry = detectEntry(location.pathname, location.search);
  const LAST = 'bsx.last'; // the wrapper page most recently shown, for the way back

  // Every other Brightspace page opens inside the wrapper, in a frame under Canvas's
  // navigation (see the "open" view). The page arriving here is stopped before it loads,
  // so it is fetched once, by the frame. Sign-in pages, quiz attempts in progress, and a
  // page the student asked to see without the wrapper are left as they are.
  const RAW = /^\/d2l\/(login|logout|lp\/auth\/|api\/|lms\/quizzing\/user\/attempt\/)/i;
  const here = location.pathname + location.search;
  // Switched off with the Brightspace button: this tab stays on plain Brightspace, page after
  // page, until the student picks "Canvas view" again.
  let offMode = false;
  try {
    offMode = sessionStorage.getItem('bsx.off') === '1';
  } catch {}
  if (offMode && entry && location.hash !== '#brightspace') history.replaceState(null, '', `${here}#brightspace`);
  if (!entry && location.pathname.startsWith('/d2l/') && !RAW.test(location.pathname) && !offMode && location.hash !== '#brightspace') {
    // Go to the wrapper's own address with this page in its frame. (A browser will not load a
    // frame at the same address as the page around it, so the wrapper cannot stay here.)
    location.replace(`/d2l/home#/open?u=${encodeURIComponent(here)}`);
    return null;
  }

  // On Brightspace pages the wrapper leaves alone, offer a small way back to it.
  if (!entry) {
    if (!location.pathname.startsWith('/d2l/')) return null;
    let back = '/d2l/home#/';
    try {
      if (sessionStorage.getItem('bsx.nopill')) return null;
      const saved = sessionStorage.getItem(LAST);
      if (saved && saved.startsWith('/d2l/')) back = saved;
    } catch {}
    const pillHost = document.createElement('div');
    const shadow = pillHost.attachShadow({ mode: 'open' });
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483647;left:12px;bottom:12px;display:flex;border-radius:18px;overflow:hidden;background:#2d3b45;box-shadow:0 2px 8px rgba(0,0,0,.3);font:13px/1.2 Lato,"Helvetica Neue",Helvetica,Arial,sans-serif';
    const link = document.createElement('a');
    link.href = back;
    link.textContent = '← Canvas view';
    link.addEventListener('click', () => {
      try {
        sessionStorage.removeItem('bsx.off');
      } catch {}
    });
    link.style.cssText = 'color:#fff;text-decoration:none;padding:8px 6px 8px 14px';
    const hide = document.createElement('button');
    hide.type = 'button';
    hide.textContent = '×';
    hide.title = 'Hide until the next visit';
    hide.setAttribute('aria-label', 'Hide the Canvas view button');
    hide.style.cssText = 'color:#fff;background:none;border:0;padding:8px 12px 8px 6px;cursor:pointer;font:inherit';
    hide.addEventListener('click', () => {
      try {
        sessionStorage.setItem('bsx.nopill', '1');
      } catch {}
      pillHost.remove();
    });
    box.append(link, hide);
    shadow.append(box);
    const place = () => document.documentElement.append(pillHost);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
    else place();
    return null;
  }

  const { data, client } = BSX;
  const OFF = '#brightspace';
  const DAY = 864e5;
  const COLORS = ['#0b874b', '#bd3c14', '#0374b5', '#8f3e97', '#d97900', '#4554a4', '#06a3b7', '#e71f63', '#65499d', '#177b63'];
  const SECTIONS = ['home', 'announcements', 'assignments', 'discussions', 'grades', 'people', 'files', 'syllabus', 'quizzes', 'modules', 'stream'];

  // ---- elements ------------------------------------------------------------
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      n.append(kid.nodeType ? kid : String(kid));
    }
    return n;
  }

  const SVG = 'http://www.w3.org/2000/svg';
  function ic(name, size = 20) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', 'ic');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', BSX.icons[name] || BSX.icons.item);
    svg.append(path);
    return svg;
  }

  // Links built from API data: this site only.
  function safeHref(url) {
    try {
      const u = new URL(url, location.origin);
      return u.origin === location.origin ? u.href : null;
    } catch {
      return null;
    }
  }

  // Links inside instructor-written text: any http(s) address, nothing else.
  function webHref(url) {
    try {
      const u = new URL(url, location.origin);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
    } catch {
      return null;
    }
  }

  // Instructor- and student-written HTML is untrusted. Rebuild it from an allowlist of
  // plain formatting tags; no attributes survive except a checked link address.
  const KEEP = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'SPAN', 'DIV', 'PRE', 'CODE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'HR', 'SUB', 'SUP']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'HEAD', 'TITLE', 'META', 'LINK', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'VIDEO', 'AUDIO']);
  function cleanHtml(html) {
    const out = document.createDocumentFragment();
    const walk = (src, dst) => {
      for (const n of src.childNodes) {
        if (n.nodeType === 3) dst.append(n.nodeValue);
        if (n.nodeType !== 1) continue;
        const tag = n.tagName.toUpperCase();
        if (DROP.has(tag)) continue;
        if (tag === 'IMG') {
          // Images keep only a checked http(s) address (Brightspace's own files resolve
          // against this site) and their alt text.
          const src = webHref(n.getAttribute('src') || '');
          const alt = n.getAttribute('alt') || '';
          if (src) dst.append(Object.assign(document.createElement('img'), { src, alt, loading: 'lazy', referrerPolicy: new URL(src).origin === location.origin ? 'same-origin' : 'no-referrer' }));
          else dst.append(alt ? `[image: ${alt}]` : '[image]');
        } else if (KEEP.has(tag)) {
          const el = document.createElement(tag.toLowerCase());
          if (tag === 'A') {
            const href = webHref(n.getAttribute('href') || '');
            if (href) {
              el.href = href;
              el.target = '_blank';
              el.rel = 'noopener noreferrer';
            }
          }
          walk(n, el);
          dst.append(el);
        } else {
          walk(n, dst);
        }
      }
    };
    walk(new DOMParser().parseFromString(html, 'text/html').body, out);
    return out;
  }
  // Rich text as a block: sanitised HTML when there is some, else the plain text.
  const prose = (htmlText, plain) => (htmlText || plain ? h('div', { class: 'prose' }, htmlText ? cleanHtml(htmlText) : plain) : null);
  const plainOf = (htmlText, plain) => (plain || (htmlText ? cleanHtml(htmlText).textContent : '')).replace(/\s+/g, ' ').trim();
  const clip = (text, n) => (text.length > n ? `${text.slice(0, n).trimEnd()}…` : text);

  // ---- formatting ----------------------------------------------------------
  const num = (n) => (n == null ? '–' : String(Math.round(n * 100) / 100));
  const pct = (a, b) => (a == null || !b ? '' : `${num((a / b) * 100)}%`);
  const F = (o) => new Intl.DateTimeFormat(undefined, o);
  const fmt = { full: F({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), time: F({ hour: 'numeric', minute: '2-digit' }), day: F({ weekday: 'long', month: 'long', day: 'numeric' }), short: F({ month: 'short', day: 'numeric' }), month: F({ month: 'long', year: 'numeric' }) };
  const when = (iso) => (iso ? fmt.full.format(new Date(iso)).replace(',', ' at').replace(' at at', ' at') : '');
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const bytes = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${Math.round(n / 104857.6) / 10} MB`);

  // ---- preferences ---------------------------------------------------------
  // Kept in extension storage (not visible to the Brightspace page).
  const THEMES = ['auto', 'light', 'dark'];
  const store = (globalThis.browser || globalThis.chrome)?.storage?.local;
  // todos: the student's own planner items. done / dismissed: keys of items ticked off or hidden.
  // ed: the Ed Discussion reader (on, token, region, map of Ed course -> Brightspace course).
  // links: outside items the student folded into another item, or kept 'separate'.
  const settings = { theme: 'auto', courses: {}, dash: 'cards', navOpen: true, calHidden: [], asgBy: 'date', todos: [], done: {}, dismissed: {}, ed: { on: false, token: '', region: 'us', map: {} }, links: {} };
  async function loadSettings() {
    try {
      const saved = (await store.get('bsx'))?.bsx;
      if (!saved) return;
      if (THEMES.includes(saved.theme)) settings.theme = saved.theme;
      if (saved.courses && typeof saved.courses === 'object') settings.courses = { ...saved.courses };
      if (['cards', 'list', 'activity'].includes(saved.dash)) settings.dash = saved.dash;
      if (typeof saved.navOpen === 'boolean') settings.navOpen = saved.navOpen;
      if (Array.isArray(saved.calHidden)) settings.calHidden = saved.calHidden.map(Number);
      if (['date', 'type'].includes(saved.asgBy)) settings.asgBy = saved.asgBy;
      if (Array.isArray(saved.todos)) settings.todos = saved.todos.filter((t) => t && typeof t.title === 'string' && t.id != null);
      if (saved.done && typeof saved.done === 'object') settings.done = { ...saved.done };
      if (saved.dismissed && typeof saved.dismissed === 'object') settings.dismissed = { ...saved.dismissed };
      if (typeof saved.showAll === 'boolean') settings.showAll = state.showAll = saved.showAll;
      if (['group', 'due', 'title'].includes(saved.gradeSort)) settings.gradeSort = saved.gradeSort;
      if (typeof saved.gradescope === 'boolean') settings.gradescope = saved.gradescope;
      if (typeof saved.seenAt === 'number') settings.seenAt = saved.seenAt;
      if (typeof saved.overlay === 'boolean') settings.overlay = saved.overlay;
      if (typeof saved.wideCards === 'boolean') settings.wideCards = saved.wideCards;
      if (typeof saved.countExcluded === 'boolean') settings.countExcluded = saved.countExcluded;
      if (saved.confetti && typeof saved.confetti === 'object') settings.confetti = { ...saved.confetti };
      if (saved.pins && typeof saved.pins === 'object') settings.pins = Object.fromEntries(Object.entries(saved.pins).filter(([, v]) => Array.isArray(v)));
      if (typeof saved.tasks === 'boolean') settings.tasks = saved.tasks;
      if (saved.ed && typeof saved.ed === 'object') settings.ed = { on: Boolean(saved.ed.on), token: typeof saved.ed.token === 'string' ? saved.ed.token : '', region: ['us', 'au', 'eu', 'ca'].includes(saved.ed.region) ? saved.ed.region : 'us', map: saved.ed.map && typeof saved.ed.map === 'object' ? { ...saved.ed.map } : {} };
      if (saved.links && typeof saved.links === 'object') settings.links = { ...saved.links };
      if (typeof saved.threeDay === 'boolean') settings.threeDay = saved.threeDay;
      if ([0, 5, 10].includes(saved.taskLimit)) settings.taskLimit = saved.taskLimit;
      if (typeof saved.clock24 === 'boolean') settings.clock24 = saved.clock24;
    } catch {}
    applyClock();
  }
  // Times follow the browser's own 12/24-hour habit unless the student asks for 24-hour.
  // The formats are changed in place so every page that holds `fmt` sees the new clock.
  function applyClock() {
    const hour12 = settings.clock24 ? false : undefined;
    fmt.full = F({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12 });
    fmt.time = F({ hour: 'numeric', minute: '2-digit', hour12 });
  }
  function saveSettings() {
    try {
      store.set({ bsx: settings });
    } catch {}
  }
  const colorOf = (id) => {
    const chosen = settings.courses[id]?.color;
    return COLORS.includes(chosen) ? chosen : COLORS[Number(id) % COLORS.length];
  };
  // Brightspace course names carry the term and merge markers ("Fall 2026 CS 18000 - Merge");
  // show the part that identifies the course unless the student chose a nickname.
  const shortName = (name) => name.replace(/^(Fall|Spring|Summer|Winter)\s+\d{4}\s+/i, '').replace(/\s+-\s+Merge$/i, '').trim() || name;
  const nameOf = (c) => settings.courses[c.id]?.nickname || shortName(c.name);

  // ---- the student's own planner items, and ticking things off --------------
  const keyOf = (i) => (i.personal ? `todo-${i.source_id}` : `${i.kind || 'overdue'}-${i.course_id}-${i.source_id ?? i.id}`);
  const isDone = (i) => Boolean(settings.done[keyOf(i)]);
  const isDismissed = (i) => Boolean(settings.dismissed[keyOf(i)]);
  // `quiet`: save only; the caller updates its own part of the page instead of a full redraw.
  function setFlag(bag, i, on, { quiet = false } = {}) {
    if (on) settings[bag][keyOf(i)] = 1;
    else delete settings[bag][keyOf(i)];
    saveSettings();
    if (!quiet) render();
  }
  // Personal items shaped like assignments so every list can show them.
  const personalItems = (from, to, courseIds) =>
    settings.todos
      .filter((t) => t.due_at && Date.parse(t.due_at) >= from && Date.parse(t.due_at) <= to && (!courseIds || t.course_id == null || courseIds.has(t.course_id)))
      .map((t) => ({ personal: true, kind: 'todo', source_id: t.id, name: t.title, due_at: t.due_at, course_id: t.course_id ?? null, details: t.details || '', link: t.link || '', grade: null, points_possible: null }));

  // The title of a piece of work as a link: the wrapper page for Brightspace work, the
  // outside tool (new tab) for external work, the editor for one of the student's own items.
  function itemLink(i, courses) {
    if (i.personal) return h('button', { class: 't linklike', type: 'button', title: 'Edit', onclick: () => todoDialog(i, courses || []) }, i.name);
    if (i.kind === 'external') return h('a', { class: 't', href: webHref(i.html_url) || '#/', target: '_blank', rel: 'noopener noreferrer', title: `Opens ${i.source}` }, i.name, ' ', ic('external', 13));
    return h('a', { class: 't', href: i.kind ? itemHref(i.course_id, i) : courseHref(i.course_id, 'assignments') }, i.name || i.title);
  }

  // Work from outside Brightspace for the given courses: Gradescope (courses with a
  // Gradescope link in Content) and Ed Discussion, each only when switched on.
  //
  // The same assignment often appears in two or three places. An outside item is folded
  // into another when the student said so (settings.links: its key -> the other item's id,
  // or 'separate' to keep it apart), or else when the names match and the due dates are
  // within a day and a half. Brightspace's copy wins, then Gradescope's, then Ed's. Folded
  // items are not listed again; alsoOn() returns them for the item they were folded into.
  const folded = new Map(); // course id -> Map(target key -> [outside items])
  let edState = { state: 'off', courses: [] };
  const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // A name reduced to the kind of work and its number: "HW 4", "Homework 4" and "Homework
  // Assignment #4" all give "homework 4". Common short forms are spelt out first.
  const KINDS = [
    [/\b(hw|hwk|homework|problem set|pset|ps)\b/, 'homework'],
    [/\b(proj|project)\b/, 'project'],
    [/\b(lab|labs|laboratory)\b/, 'lab'],
    [/\b(quiz|quizzes)\b/, 'quiz'],
    [/\b(exam|midterm|final)\b/, 'exam'],
    [/\b(asg|assn|assignment|assgn)\b/, 'assignment'],
    [/\b(essay|paper)\b/, 'essay'],
    [/\b(reading|readings)\b/, 'reading'],
  ];
  function workKey(name) {
    // "hw04" -> "hw 04", so the kind and the number are separate words.
    const n = normName(name).replace(/([a-z])(\d)/g, '$1 $2').replace(/\b(no|number|num)\b/g, ' ');
    const num = (n.match(/\b0*(\d{1,3})\b/) || [])[1];
    if (num == null) return null;
    const kinds = KINDS.filter(([re]) => re.test(n)).map(([, k]) => k);
    // "Homework Assignment 4" names two kinds; the more specific one counts.
    const kind = kinds.find((k) => k !== 'assignment') || kinds[0];
    return kind ? `${kind} ${Number(num)}` : null;
  }
  function sameWork(a, b) {
    const x = normName(a.name);
    const y = normName(b.name);
    if (!x || !y) return false;
    const ka = workKey(a.name);
    const named = x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))) || (ka != null && ka === workKey(b.name));
    if (!named) return false;
    if (!a.due_at || !b.due_at) return true;
    return Math.abs(Date.parse(a.due_at) - Date.parse(b.due_at)) <= 36 * 3600e3;
  }
  const targetKey = (item) => (item.kind === 'external' ? keyOf(item) : item.id);

  async function externalWork(courses) {
    const parts = [];
    if (settings.gradescope && BSX.gradescope) {
      const has = await Promise.all(courses.map((c) => data.externalTools(c.id).then((tools) => tools.some((t) => /gradescope/i.test(t.title))).catch(() => false)));
      parts.push(BSX.gradescope.forCourses(courses.filter((c, n) => has[n])));
    }
    if (settings.ed?.on && settings.ed.token && BSX.ed) {
      parts.push(BSX.ed.forCourses(courses, { map: settings.ed.map || {}, region: settings.ed.region || 'us' }).then((r) => {
        edState = r;
        return r.items;
      }));
    }
    if (!parts.length) return [];
    const outside = (await Promise.all(parts.map((p) => p.catch(() => [])))).flat();
    const rank = { Gradescope: 0, Ed: 1 };
    outside.sort((a, b) => (rank[a.source] ?? 2) - (rank[b.source] ?? 2));
    const ids = [...new Set(outside.map((x) => x.course_id))];
    const work = new Map(await Promise.all(ids.map((id) => data.assignments(id).then((l) => [id, l]).catch(() => [id, []]))));
    for (const c of courses) folded.set(c.id, new Map());
    const kept = [];
    for (const x of outside) {
      const link = settings.links[keyOf(x)];
      const mine = work.get(x.course_id) || [];
      const others = kept.filter((k) => k.course_id === x.course_id && k.source !== x.source);
      let target = null;
      if (link && link !== 'separate') target = mine.find((a) => a.id === link) || others.find((k) => keyOf(k) === link) || null;
      else if (!link) target = mine.find((a) => sameWork(a, x)) || others.find((k) => sameWork(k, x)) || null;
      if (!target) {
        kept.push(x);
        continue;
      }
      const bag = folded.get(x.course_id) || new Map();
      folded.set(x.course_id, bag);
      const k = targetKey(target);
      bag.set(k, [...(bag.get(k) || []), { ...x, auto: !link, into: target.name }]);
    }
    return kept;
  }

  // Announcements from outside sites (Ed, when it is switched on) for the given courses.
  function outsideAnnouncements(courses) {
    if (!settings.ed?.on || !settings.ed.token || !BSX.ed) return Promise.resolve([]);
    return BSX.ed.announcements(courses, { map: settings.ed.map || {}, region: settings.ed.region || 'us' }).catch(() => []);
  }

  // Outside copies folded into this item (Brightspace work or a kept outside item).
  async function alsoOn(course, item) {
    await externalWork([course]).catch(() => []);
    return folded.get(course.id)?.get(targetKey(item)) || [];
  }
  // Small "Also on Ed / Gradescope" links for an item with folded copies.
  function alsoChips(course, item) {
    const box = h('span', { class: 'also' });
    alsoOn(course, item).then((list) => box.replaceChildren(...list.map((x) => h('a', { class: 'alsochip', href: webHref(x.html_url) || '#/', target: '_blank', rel: 'noopener noreferrer', title: `${x.name} on ${x.source}${x.status ? ` · ${x.status}` : ''}` }, x.source, ' ', ic('external', 11))))).catch(() => {});
    return box;
  }
  function setLink(item, target) {
    if (target == null) delete settings.links[keyOf(item)];
    else settings.links[keyOf(item)] = target;
    saveSettings();
    render();
  }

  function todoDialog(existing, courses) {
    if (!frame) return;
    const t = existing ? settings.todos.find((x) => x.id === existing.source_id) : null;
    const local = (iso) => {
      const d = iso ? new Date(iso) : new Date(Date.now() + DAY);
      if (!iso) d.setHours(23, 59, 0, 0);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    const title = h('input', { class: 'txt', type: 'text', maxlength: '120', value: t?.title || '', required: true });
    const due = h('input', { class: 'txt', type: 'datetime-local', value: local(t?.due_at) });
    const course = h('select', { class: 'txt' }, h('option', { value: '' }, 'None'), courses.map((c) => h('option', { value: String(c.id), selected: t?.course_id === c.id }, nameOf(c))));
    const link = h('input', { class: 'txt', type: 'url', placeholder: 'https://', value: t?.link || '' });
    const details = h('textarea', { class: 'txt', rows: '3', maxlength: '600' }, t?.details || '');
    const close = () => overlay.remove();
    const save = () => {
      if (!title.value.trim() || !due.value) {
        title.focus();
        return;
      }
      const item = { id: t?.id ?? Date.now(), title: title.value.trim(), due_at: new Date(due.value).toISOString(), course_id: course.value ? Number(course.value) : null, link: webHref(link.value.trim()) && link.value.trim() ? link.value.trim() : '', details: details.value.trim() };
      settings.todos = [...settings.todos.filter((x) => x.id !== item.id), item];
      saveSettings();
      close();
      render();
      flash(t ? 'To Do updated.' : `Added “${item.title}” to your To Do.`);
    };
    const remove = () => {
      settings.todos = settings.todos.filter((x) => x.id !== t.id);
      delete settings.done[`todo-${t.id}`];
      saveSettings();
      close();
      render();
      flash('To Do deleted.');
    };
    const overlay = h('div', { class: 'modal', onclick: (ev) => ev.target === overlay && close() },
      h('div', { class: 'dialog', role: 'dialog', 'aria-label': t ? 'Edit To Do' : 'Add To Do' },
        h('div', { class: 'trayhead' }, h('h2', null, t ? 'Edit To Do' : 'Add To Do'), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: close }, ic('close'))),
        h('p', { class: 'muted small', style: 'margin-top:0' }, 'For work that lives outside Brightspace, or anything else you want on your list. Saved in this browser only.'),
        h('label', null, 'Title', title),
        h('label', null, 'Date', due),
        h('label', null, 'Course', course),
        h('label', null, 'Link (optional)', link),
        h('label', null, 'Details', details),
        h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:6px' }, t ? button('Delete', remove) : null, button('Cancel', close), button('Save', save, 'primary'))));
    overlay.addEventListener('keydown', (ev) => ev.key === 'Escape' && close());
    frame.app.append(overlay);
    title.focus();
  }

  // This term's courses; without any, pinned ones; without those, everything.
  function focusCourses(courses) {
    const term = courses.filter((c) => c.current_term);
    if (term.length) return term;
    const pinned = courses.filter((c) => c.pinned);
    return pinned.length ? pinned : courses;
  }

  // ---- links ---------------------------------------------------------------
  const PLURAL = { assignment: 'assignments', quiz: 'quizzes', discussion: 'discussions' };
  const courseHref = (id, section, item) => `#/courses/${id}${section ? `/${section}` : ''}${item != null ? `/${item}` : ''}`;
  // Work read from an outside tool links straight to that tool.
  const itemHref = (courseId, a) => (a.kind === 'external' ? a.html_url : courseHref(courseId, PLURAL[a.kind], a.source_id));
  // A Brightspace address for an assignment or quiz, mapped to the wrapper's page for it.
  function wrapHref(url) {
    try {
      const u = new URL(url, location.origin);
      const ou = u.searchParams.get('ou');
      if (/folder_submit_files\.d2l$/i.test(u.pathname) && ou && u.searchParams.get('db')) return courseHref(ou, 'assignments', u.searchParams.get('db'));
      if (/(quizzing|quiz_summary)\.d2l$/i.test(u.pathname) && ou && u.searchParams.get('qi')) return courseHref(ou, 'quizzes', u.searchParams.get('qi'));
    } catch {}
    return safeHref(url);
  }
  // Original Brightspace pages. Ones the wrapper takes over carry the off-switch hash.
  const bs = {
    home: (id) => `/d2l/home/${id}${OFF}`,
    news: (id) => `/d2l/lms/news/main.d2l?ou=${id}${OFF}`,
    grades: (id) => `/d2l/lms/grades/my_grades/main.d2l?ou=${id}${OFF}`,
    assignments: (id) => `/d2l/lms/dropbox/user/folders_list.d2l?ou=${id}${OFF}`,
    content: (id) => `/d2l/le/content/${id}/Home${OFF}`,
    quizzes: (id) => `/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${id}${OFF}`,
    discussions: (id) => `/d2l/le/${id}/discussions/List${OFF}`,
    classlist: (id) => `/d2l/lms/classlist/classlist.d2l?ou=${id}${OFF}`,
    calendar: (id) => `/d2l/le/calendar/${id}`,
    email: (orgId) => `/d2l/lms/email/frame.d2l${orgId ? `?ou=${orgId}` : ''}`,
  };

  // ---- small building blocks -----------------------------------------------
  const empty = (text) => h('div', { class: 'empty' }, text);
  const tag = (text, cls) => h('span', { class: `tag${cls ? ` ${cls}` : ''}` }, text);
  const button = (label, onclick, cls) => h('button', { class: `btn${cls ? ` ${cls}` : ''}`, type: 'button', onclick }, label);
  const linkButton = (label, href, cls) => h('a', { class: `btn${cls ? ` ${cls}` : ''}`, href }, label);

  // A block that fills in when its data arrives and fails on its own.
  function lazy(promise, build, placeholder = 'Loading…') {
    // An empty placeholder marks an optional block: it takes no room until it has content.
    const optional = placeholder === '';
    // While waiting: grey bars in the shape of content, as Canvas shows, with the words for screen readers.
    const box = optional
      ? h('div', { class: 'muted small pad', hidden: true })
      : h('div', { class: 'skel', 'aria-busy': 'true' }, h('span', { class: 'sr' }, placeholder), h('i'), h('i'), h('i', { class: 'short' }));
    promise
      .then((value) => {
        const built = [build(value)].flat(Infinity).filter(Boolean);
        if (optional && !built.length) return;
        box.hidden = false;
        box.className = 'arrived';
        box.removeAttribute('aria-busy');
        box.replaceChildren(...(built.length ? built : [h('div', { class: 'muted small pad' }, 'Nothing for now.')]));
        // A page redrawn in place (ticking an item, changing a setting) keeps its scroll position
        // even though this block arrived after the redraw.
        if (frame && keepScroll != null) frame.main.scrollTop = keepScroll;
      })
      .catch((e) => {
        if (optional) return;
        box.className = 'muted small pad';
        box.removeAttribute('aria-busy');
        box.textContent = `Unavailable. ${e.message || e}`;
      });
    return box;
  }
  const sideSection = (title, body) => h('section', { class: 'sidesec' }, h('h2', null, title), body);

  // A text box that filters rows as the user types. `rows` is a list of [element, text].
  function filterBox(placeholder, rows, onCount) {
    const input = h('input', { class: 'txt search', type: 'search', placeholder, 'aria-label': placeholder });
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      for (const [el, text] of rows) {
        const hit = !q || text.toLowerCase().includes(q);
        el.hidden = !hit;
        if (hit) shown++;
      }
      if (onCount) onCount(shown);
    });
    return input;
  }

  // ---- mount ---------------------------------------------------------------
  const host = document.createElement('div');
  host.id = 'bsx-root';
  const root = host.attachShadow({ mode: 'open' });
  // Constructed sheets are not subject to the page's content security policy; fall back to a style element.
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(BSX.styles);
    root.adoptedStyleSheets = [sheet];
  } catch {
    root.append(h('style', null, BSX.styles));
  }
  const mount = h('div');
  root.append(mount);
  document.documentElement.append(host);

  const views = {};
  const state = { showAll: false, tray: null };
  let frame = null;
  let renderId = 0;
  let lastHash = null;
  let keepScroll = null; // scroll position to hold while late blocks arrive after an in-place redraw
  let keepTimer = 0;
  // The tab title follows the wrapper page. Brightspace sets its own title while the page
  // loads, so remember that one (for when the wrapper is switched off) and put ours back.
  let originalTitle = document.title;
  let ourTitle = null;
  const setTitle = (t) => {
    ourTitle = t;
    document.title = t;
  };
  document.addEventListener('DOMContentLoaded', () => {
    if (document.title === ourTitle) return;
    originalTitle = document.title;
    if (frame && ourTitle) document.title = ourTitle;
  });

  function route() {
    const hash = location.hash;
    if (hash === OFF) return { view: 'off' };
    if (hash === '#/') return { view: 'dashboard', nav: 'dashboard' };
    if (hash === '#/courses') return { view: 'courses', nav: 'courses' };
    if (hash === '#/grades') return { view: 'allgrades', nav: 'dashboard' };
    if (hash === '#/inbox') return { view: 'inbox', nav: 'inbox' };
    if (hash === '#/groups') return { view: 'groups', nav: 'groups' };
    if (hash === '#/connections') return { view: 'connections', nav: null };
    if (hash.startsWith('#/open?u=')) {
      let u = '';
      try {
        u = decodeURIComponent(hash.slice('#/open?u='.length));
      } catch {}
      if (/^\/d2l\//.test(u) && !/^\/d2l\/api\//i.test(u)) return { view: 'open', nav: null, u };
      return { view: 'dashboard', nav: 'dashboard' };
    }
    let m = hash.match(/^#\/calendar(?:\/(\d{4})-(\d{2}))?$/);
    if (m) return { view: 'calendar', nav: 'calendar', year: m[1] ? Number(m[1]) : null, month: m[2] ? Number(m[2]) - 1 : null };
    m = hash.match(/^#\/courses\/(\d+)(?:\/([a-z]+)(?:\/(\d+))?)?$/);
    if (m && (!m[2] || SECTIONS.includes(m[2]))) return { view: 'course', nav: 'courses', courseId: Number(m[1]), section: m[2] || 'home', itemId: m[3] ? Number(m[3]) : null };
    return { view: 'entry' };
  }

  const reload = () => {
    client.clear();
    if (BSX.gradescope) BSX.gradescope.clear();
    render();
  };
  // Show a Brightspace page as it is, without the wrapper: a page loaded once without it.
  // Plain Brightspace from here on in this tab (see offMode), starting at page u.
  function openRaw(u) {
    try {
      sessionStorage.setItem('bsx.off', '1');
    } catch {}
    location.assign(`${u}#brightspace`);
  }
  // The Brightspace page that matches the wrapper page being shown, for the Brightspace switch.
  function brightspacePage(r) {
    const strip = (u) => u.replace(OFF, '');
    if (r.view === 'course') {
      const ou = r.courseId;
      const id = r.itemId;
      switch (r.section) {
        case 'announcements': return strip(bs.news(ou));
        case 'assignments': return id != null ? `/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${id}&ou=${ou}` : strip(bs.assignments(ou));
        case 'quizzes': return id != null ? `/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${id}&ou=${ou}` : strip(bs.quizzes(ou));
        case 'discussions': return id != null ? `/d2l/le/${ou}/discussions/topics/${id}/View` : strip(bs.discussions(ou));
        case 'grades': return strip(bs.grades(ou));
        case 'people': return strip(bs.classlist(ou));
        case 'modules': return id != null && id > 0 ? `/d2l/le/content/${ou}/viewContent/${id}/View` : id == null ? strip(bs.content(ou)) : strip(bs.home(ou));
        default: return strip(bs.home(ou));
      }
    }
    return '/d2l/home';
  }

  const turnOff = async () => {
    const r = route();
    if (r.view === 'open') return openRaw(r.u);
    let target = brightspacePage(r);
    // Brightspace's home, calendar and email hang off the school's own org unit. (The bare
    // /d2l/home asks which campus to use.)
    if (r.view !== 'course') {
      const org = await data.orgId().catch(() => null);
      if (org) target = r.view === 'calendar' ? bs.calendar(org) : r.view === 'inbox' ? bs.email(org) : `/d2l/home/${org}`;
    }
    // Go to the matching Brightspace page and stay on plain Brightspace in this tab.
    openRaw(target);
  };

  // Brightspace links clicked inside the wrapper open in the wrapper's frame view instead of
  // leaving it. Downloads, API files and links meant for a new tab are left alone.
  function interceptLinks(ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
    const a = ev.composedPath().find((el) => el && el.tagName === 'A');
    if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
    let u;
    try {
      u = new URL(a.href, location.href);
    } catch {
      return;
    }
    if (u.origin !== location.origin || !u.pathname.startsWith('/d2l/') || /^\/d2l\/api\//i.test(u.pathname)) return;
    if (u.pathname === location.pathname && u.search === location.search && u.hash.startsWith('#/')) return; // a wrapper route
    if (RAW.test(u.pathname)) return;
    ev.preventDefault();
    location.hash = `#/open?u=${encodeURIComponent(u.pathname + u.search)}`;
  }

  // The "open" view: a Brightspace page in a frame, under Canvas's navigation. Brightspace's
  // own top bar is hidden inside the frame (the wrapper's rail replaces it). When the frame
  // moves to a page the wrapper stands in for, the wrapper page is shown instead.
  views.open = async (r) => {
    // Which course this page belongs to: its ou= parameter, or any number in its address that
    // is one of the student's courses (tool addresses put the course id in different places).
    const params = new URLSearchParams(r.u.split('?')[1] || '');
    const numbers = [Number(params.get('ou')), ...(r.u.split('?')[0].match(/\d+/g) || []).map(Number)].filter(Boolean);
    const courses = numbers.length ? await data.courses().catch(() => []) : [];
    const course = numbers.map((n) => courses.find((c) => c.id === n)).find(Boolean) || null;
    const title = h('span', { class: 'here' }, 'Brightspace');
    const f = h('iframe', { class: 'viewer full', src: r.u, title: 'Brightspace page' });
    f.addEventListener('load', () => {
      let doc;
      let path;
      try {
        doc = f.contentDocument;
        path = f.contentWindow.location.pathname + f.contentWindow.location.search;
      } catch {
        return; // another site (a tool or the sign-in page): leave it be
      }
      if (/^\/d2l\/login/i.test(path)) return location.assign(path); // signed out: sign in at the top
      const target = detectEntry(f.contentWindow.location.pathname, f.contentWindow.location.search);
      if (target && path !== r.u) return location.assign(path); // a page the wrapper replaces
      if (path !== r.u) history.replaceState(null, '', `${location.pathname}${location.search}#/open?u=${encodeURIComponent(path)}`);
      const t = (doc.title || '').replace(/\s*-\s*[^-]*$/, '').trim();
      title.textContent = t || 'Brightspace';
      if (t) setTitle(t);
      // Hide Brightspace's own header and navigation bar inside the frame.
      for (const el of doc.querySelectorAll('d2l-navigation, header > nav, .d2l-navigation-s, .d2l-navigation-s-header')) el.style.setProperty('display', 'none', 'important');
    });
    const crumbs = course ? [{ label: nameOf(course), href: courseHref(course.id) }, { label: title }] : [{ label: title }];
    return {
      crumbs,
      framed: true,
      // The course menu stays beside a course's Brightspace page, so leaving it never depends
      // on the browser's Back button (some Brightspace pages redirect, which traps Back).
      leftNav: course && BSX.ui.courseNav ? BSX.ui.courseNav(course, null) : null,
      actions: h('button', { class: 'btn', type: 'button', title: 'Show this page without the Canvas view', onclick: () => openRaw(lastOpen()) }, 'Without Canvas view'),
      body: f,
    };
  };
  const lastOpen = () => {
    const r = route();
    return r.view === 'open' ? r.u : here;
  };

  // ---- global navigation and trays ------------------------------------------
  function setTheme(theme) {
    settings.theme = theme;
    saveSettings();
    if (frame) frame.app.setAttribute('data-theme', theme);
    if (state.tray === 'account') openTray('account');
  }

  function trayContent(name) {
    const close = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: () => openTray(null) }, ic('close'));
    if (name === 'courses') {
      return [
        h('div', { class: 'trayhead' }, h('h2', null, 'Courses'), close),
        lazy(data.courses(), (courses) => [
          focusCourses(courses).map((c) => h('a', { class: 'trayitem', href: courseHref(c.id) }, h('span', { class: 'dot', style: `background:${colorOf(c.id)}` }), h('span', null, h('span', { class: 'tname' }, nameOf(c)), h('span', { class: 'muted small tcode' }, c.course_code)))),
          h('a', { class: 'trayitem all', href: '#/courses' }, 'All Courses'),
          h('a', { class: 'trayitem all', href: '#/groups' }, 'Your Groups'),
        ]),
      ];
    }
    if (name === 'help') {
      const tip = (title, text) => h('div', { class: 'tip' }, h('div', { class: 'tname' }, title), h('div', { class: 'muted small' }, text));
      return [
        h('div', { class: 'trayhead' }, h('h2', null, 'Help'), close),
        tip('What this is', 'A Canvas-style view of your Brightspace courses. The only change it makes on Brightspace is handing in an assignment file when you press Submit Assignment.'),
        tip('Doing the work', 'Start Assignment hands in a file from here. Quizzes, discussion posts and text submissions open the real Brightspace page.'),
        h('button', { class: 'trayitem', type: 'button', onclick: () => { openTray(null); shortcutsDialog(); } }, ic('keyboard', 18), ' Keyboard shortcuts (press ?)'),
        tip('Work outside Brightspace', 'Use “+ To Do” for Gradescope, publisher sites or anything else. Those items appear in To Do, the list view and the calendar.'),
        tip('Grades', 'A total marked as an estimate is computed here from graded items. It applies each group\'s dropped-score rules but is not official.'),
        tip('Names and colours', 'The ⋮ button on a course card sets a nickname and colour.'),
        tip('Something looks wrong', 'Use Refresh (top right) to reload data, or the Brightspace button to see the original page.'),
        h('button', { class: 'trayitem', type: 'button', onclick: turnOff }, 'Show the original Brightspace page'),
      ];
    }
    const scope = (all, label) => h('button', { type: 'button', class: state.showAll === all ? 'on' : null, onclick: () => { settings.showAll = state.showAll = all; saveSettings(); render(); openTray('account'); } }, label);
    return [
      h('div', { class: 'trayhead' }, h('h2', null, 'Account'), close),
      lazy(data.me(), (me) => h('div', { class: 'who' }, h('div', { class: 'avatar' }, (me.name || '?').slice(0, 1).toUpperCase()), h('div', null, h('div', { class: 'tname' }, me.name), h('div', { class: 'muted small' }, me.login)))),
      h('div', { class: 'traylabel' }, 'Theme'),
      h('div', { class: 'seg' }, THEMES.map((t) => h('button', { type: 'button', class: settings.theme === t ? 'on' : null, onclick: () => setTheme(t) }, t[0].toUpperCase() + t.slice(1)))),
      h('div', { class: 'traylabel' }, 'Courses shown'),
      h('div', { class: 'seg' }, scope(false, 'Current'), scope(true, 'All')),
      h('div', { class: 'traylabel' }, 'Gradescope'),
      h('div', { class: 'seg' }, [false, true].map((on) => h('button', { type: 'button', class: Boolean(settings.gradescope) === on ? 'on' : null, onclick: () => { settings.gradescope = on; saveSettings(); reload(); openTray('account'); } }, on ? 'Read it' : 'Off'))),
      h('p', { class: 'muted small', style: 'margin:8px 4px 0' }, 'When on, courses with a Gradescope link also show your Gradescope assignments, due dates and scores. It reads two Gradescope pages with your own Gradescope sign-in and changes nothing there.'),
      h('div', { class: 'traylabel' }, 'Ed Discussion'),
      h('div', { class: 'seg' }, [false, true].map((on) => h('button', { type: 'button', class: Boolean(settings.ed.on) === on ? 'on' : null, onclick: () => { settings.ed.on = on; saveSettings(); if (on && !settings.ed.token) { openTray(null); location.hash = '#/connections'; return; } reload(); openTray('account'); } }, on ? 'Read it' : 'Off'))),
      h('a', { class: 'trayitem', href: '#/connections' }, 'Connected sites: Ed token, course matching, overlaps'),
      h('div', { class: 'traylabel' }, 'Pages'),
      h('a', { class: 'trayitem', href: '#/grades' }, 'Grades for all courses'),
      h('a', { class: 'trayitem', href: '#/courses' }, 'All Courses'),
      h('a', { class: 'trayitem', href: '#/groups' }, 'Groups'),
      h('button', { class: 'trayitem', type: 'button', onclick: turnOff }, 'Show the original Brightspace page'),
      h('p', { class: 'muted small', style: 'padding:14px 4px 0' }, 'Reads your Brightspace data, and hands in assignment files when you press Submit Assignment. Quizzes and posting happen in Brightspace.'),
    ];
  }

  function openTray(name) {
    state.tray = name;
    if (!frame) return;
    frame.tray.hidden = !name;
    frame.tray.replaceChildren(...(name ? trayContent(name) : []));
    frame.rail.querySelectorAll('[data-tray]').forEach((b) => b.classList.toggle('open', b.dataset.tray === name));
  }

  function buildFrame() {
    const item = (key, href, icon, label) => h('a', { href, 'data-nav': key }, ic(icon, 26), h('span', null, label));
    const trayBtn = (key, icon, label) => h('button', { type: 'button', 'data-nav': key, 'data-tray': key, onclick: () => openTray(state.tray === key ? null : key) }, ic(icon, 26), h('span', null, label));
    const rail = h(
      'nav',
      { class: 'rail', 'aria-label': 'Global navigation' },
      trayBtn('account', 'account', 'Account'),
      item('dashboard', '#/', 'dashboard', 'Dashboard'),
      trayBtn('courses', 'courses', 'Courses'),
      item('groups', '#/groups', 'groups', 'Groups'),
      item('calendar', '#/calendar', 'calendar', 'Calendar'),
      item('inbox', '#/inbox', 'inbox', 'Inbox'),
      trayBtn('help', 'help', 'Help'),
      h('span', { class: 'gap' }),
      h('button', { type: 'button', onclick: turnOff, title: 'Show the original Brightspace page' }, ic('swap', 26), h('span', null, 'Brightspace'))
    );
    const tray = h('div', { class: 'tray', hidden: true });
    const main = h('div', { class: 'main' });
    const app = h('div', { class: 'app', 'data-theme': settings.theme }, rail, tray, main);
    app.addEventListener('keydown', (ev) => ev.key === 'Escape' && state.tray && openTray(null));
    main.addEventListener('click', () => state.tray && openTray(null));
    main.addEventListener('click', animateDetails);
    for (const type of ['wheel', 'touchmove', 'keydown']) main.addEventListener(type, () => (keepScroll = null), { passive: true });
    frame = { app, rail, tray, main };
    mount.replaceChildren(app);
    // First paint: the shape of a page in grey while Brightspace answers.
    main.replaceChildren(h('div', { class: 'head' }, h('i', { class: 'skelbar title' })), h('div', { class: 'layout' }, h('div', { class: 'content skel big', 'aria-busy': 'true' }, h('span', { class: 'sr' }, 'Loading…'), h('i'), h('i'), h('i'), h('i', { class: 'short' }), h('i'), h('i', { class: 'short' }))));
  }

  function pageNodes(page, inPlace) {
    const refresh = h('button', { class: 'iconbtn', type: 'button', title: `Updated ${fmt.time.format(new Date())}. Refresh`, 'aria-label': 'Refresh', onclick: reload }, ic('refresh'));
    let head;
    // The course menu shows or hides in place (no redraw, so a framed Brightspace page is not
    // reloaded). Framed pages keep their own setting, open by default.
    const framed = Boolean(page.framed);
    const navOpen = () => (framed ? state.frameNav !== false : settings.navOpen);
    const nav = page.leftNav ? page.leftNav : null;
    // Open and close by sliding the menu's width (see .cnav.closed); a closed menu is inert.
    const setNav = (open) => {
      nav.classList.toggle('closed', !open);
      nav.inert = !open;
      nav.setAttribute('aria-hidden', String(!open));
    };
    if (nav) setNav(navOpen());
    if (page.crumbs) {
      const toggle = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Show or hide course navigation', 'aria-expanded': String(Boolean(nav) && navOpen()), onclick: () => {
        if (framed) state.frameNav = !navOpen();
        else {
          settings.navOpen = !settings.navOpen;
          saveSettings();
        }
        if (nav) setNav(navOpen());
        toggle.setAttribute('aria-expanded', String(Boolean(nav) && navOpen()));
      } }, ic('menu', 24));
      const trail = page.crumbs.map((c, i) => [i ? h('span', { class: 'sep' }, ic('right', 14)) : null, c.href && i < page.crumbs.length - 1 ? h('a', { href: c.href }, c.label) : h('span', { class: 'here' }, c.label)]);
      head = h('div', { class: 'crumbs' }, toggle, h('div', { class: 'trail' }, trail), page.actions, refresh);
    } else {
      head = h('div', { class: 'head' }, h('h1', null, page.title), page.actions, refresh);
    }
    return [
      head,
      h('div', { class: inPlace ? 'layout still' : 'layout' }, nav, h('div', { class: 'content' }, page.body), page.side ? h('aside', { class: 'right' }, page.side) : null),
    ];
  }

  function errorBox(e) {
    const signedOut = e && (e.status === 401 || e.status === 403);
    return h('div', { class: 'error' },
      h('p', { style: 'margin-top:0' }, signedOut ? 'Brightspace did not accept the request. Your session has probably expired: sign in to Brightspace again, then try again.' : `Could not load this page. ${e && e.message ? e.message : e}`),
      h('div', { class: 'row' }, button('Try again', reload), button('Show the original Brightspace page', turnOff)));
  }

  // ---- render loop ---------------------------------------------------------
  // While the wrapper covers the page, the Brightspace page underneath must not scroll:
  // otherwise the wheel scrolls it once the wrapper reaches its end, and the two get out of step.
  function lockPage(on) {
    for (const el of [document.documentElement, document.body]) {
      if (!el) continue;
      if (on) el.style.setProperty('overflow', 'hidden', 'important');
      else el.style.removeProperty('overflow');
    }
    if (on) window.scrollTo(0, 0);
  }

  async function render() {
    const id = ++renderId;
    const r = route();
    lockPage(r.view !== 'off');

    if (r.view === 'off') {
      frame = null;
      ourTitle = null;
      if (originalTitle) document.title = originalTitle;
      mount.replaceChildren(h('button', { class: 'pill', type: 'button', onclick: () => {
        try {
          sessionStorage.removeItem('bsx.off');
        } catch {}
        history.replaceState(null, '', location.pathname + location.search);
        render();
      } }, 'Canvas view'));
      return;
    }
    if (!frame) buildFrame();
    frame.app.setAttribute('data-overlay', settings.overlay === false ? 'off' : 'on');
    frame.app.setAttribute('data-wide', settings.wideCards ? 'on' : 'off');
    const sameRoute = location.hash === lastHash;
    const scroll = sameRoute ? frame.main.scrollTop : 0;
    if (!sameRoute && state.tray) openTray(null);
    frame.rail.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === r.nav));

    try {
      // Arriving on a Brightspace URL: pick the wrapper page that stands in for it.
      if (r.view === 'entry') {
        if (!entry) {
          history.replaceState(null, '', '#/');
          return render();
        }
        const courses = entry.id ? await data.courses() : [];
        const known = courses.some((c) => c.id === entry.id);
        let target;
        if (entry.kind === 'home') target = known ? courseHref(entry.id) : '#/';
        else target = known ? courseHref(entry.id, entry.kind) : OFF;
        history.replaceState(null, '', target);
        return render();
      }
      const page = await views[r.view](r);
      if (id !== renderId) return;
      frame.main.replaceChildren(...pageNodes(page, sameRoute));
      frame.main.scrollTop = scroll;
      keepScroll = sameRoute ? scroll : null;
      clearTimeout(keepTimer);
      keepTimer = setTimeout(() => (keepScroll = null), 4000);
      lastHash = location.hash;
      setTitle(page.crumbs ? page.crumbs.slice().reverse().map((c) => (typeof c.label === 'string' ? c.label : c.label.textContent)).join(': ') : page.title);
      try {
        sessionStorage.setItem(LAST, location.pathname + location.search + location.hash);
      } catch {}
    } catch (e) {
      if (id === renderId && frame) frame.main.replaceChildren(errorBox(e));
    }
  }

  // ---- typeface ------------------------------------------------------------
  // Canvas is set in Lato. The bundled files (SIL Open Font Licence, see fonts/) are read as
  // bytes and added with the FontFace API, which the page's font policy does not block.
  async function loadFonts() {
    if (!globalThis.FontFace || !document.fonts) return;
    const runtime = (globalThis.browser || globalThis.chrome)?.runtime;
    const url = (f) => (runtime && runtime.getURL ? runtime.getURL(`fonts/${f}`) : `/ext/fonts/${f}`);
    const faces = [['300', 'normal'], ['400', 'normal'], ['400', 'italic'], ['700', 'normal'], ['700', 'italic']];
    await Promise.all(faces.map(async ([weight, style]) => {
      try {
        const bytes = await (await fetch(url(`lato-${weight}-${style}.woff2`))).arrayBuffer();
        const face = new FontFace('BSX Lato', bytes, { weight, style });
        await face.load();
        document.fonts.add(face);
      } catch {}
    }));
  }

  // ---- flash messages (Canvas's alerts at the top of the page) -------------
  function flash(text, kind = 'ok') {
    if (!frame) return;
    let host = frame.app.querySelector('.flashes');
    if (!host) frame.app.append((host = h('div', { class: 'flashes', role: 'status', 'aria-live': 'polite' })));
    const close = () => {
      note.classList.add('out');
      setTimeout(() => note.remove(), 220);
    };
    const note = h('div', { class: `flash ${kind}` }, ic(kind === 'bad' ? 'close' : 'check', 18), h('span', null, text), h('button', { class: 'iconbtn xs', type: 'button', 'aria-label': 'Dismiss', onclick: close }, ic('close', 14)));
    host.append(note);
    setTimeout(close, 7000);
  }

  // ---- small popup menu (Canvas's ⋮ menus) ---------------------------------
  // items: [{ label, on, onclick }] or null for a divider.
  function menu(label, items, icon = 'dots') {
    const pop = h('div', { class: 'menu', role: 'menu', hidden: true });
    const btn = h('button', { class: 'iconbtn', type: 'button', 'aria-label': label, title: label, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, ic(icon, 22));
    const shut = () => {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', away, true);
    };
    const away = (ev) => !ev.composedPath().includes(wrap) && shut();
    pop.append(...items.map((it) => (it ? h('button', { type: 'button', role: it.on != null ? 'menuitemradio' : 'menuitem', 'aria-checked': it.on != null ? String(Boolean(it.on)) : null, class: it.on ? 'on' : null, onclick: () => { shut(); it.onclick(); } }, h('span', { class: 'mcheck' }, it.on ? ic('check', 16) : null), it.label) : h('div', { class: 'mdiv' }))));
    btn.addEventListener('click', () => {
      const open = pop.hidden;
      // Open towards the side with room: on a phone the button can sit near the left menu.
      if (open) {
        const r = btn.getBoundingClientRect();
        const railRight = frame?.rail.getBoundingClientRect().right || 0;
        pop.classList.toggle('toleft', r.right - 230 < railRight + 8);
      }
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        document.addEventListener('click', away, true);
        pop.querySelector('button')?.focus();
      } else shut();
    });
    pop.addEventListener('keydown', (ev) => {
      const all = [...pop.querySelectorAll('button')];
      const at = all.indexOf(root.activeElement);
      if (ev.key === 'Escape') { ev.stopPropagation(); shut(); btn.focus(); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); all[(at + 1) % all.length].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); all[(at - 1 + all.length) % all.length].focus(); }
    });
    const wrap = h('div', { class: 'menuwrap' }, btn, pop);
    return wrap;
  }

  // Collapsible groups (modules, assignment groups) open and close with a height animation.
  function animateDetails(ev) {
    const summary = ev.target.closest && ev.target.closest('details.group > summary');
    if (!summary || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = summary.parentElement;
    ev.preventDefault();
    const start = box.offsetHeight;
    const closing = box.open;
    if (!closing) box.open = true;
    const end = closing ? summary.offsetHeight : box.scrollHeight;
    box.style.overflow = 'hidden';
    const anim = box.animate([{ height: `${start}px` }, { height: `${end}px` }], { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)' });
    anim.onfinish = () => {
      if (closing) box.open = false;
      box.style.overflow = '';
    };
  }

  // ---- keyboard shortcuts --------------------------------------------------
  const SHORTCUTS = [
    ['?', 'Show this list'],
    ['g then d', 'Dashboard'],
    ['g then c', 'All courses'],
    ['g then l', 'Calendar'],
    ['g then i', 'Inbox'],
    ['g then g', 'Grades for all courses'],
    ['g then p', 'Groups'],
    ['s', 'Search all courses'],
    ['/', 'Search this page'],
    ['j / k', 'Next / previous item'],
    ['[ / ]', 'Previous / next module item'],
    ['r', 'Refresh'],
    ['Esc', 'Close a tray or dialog'],
  ];
  function shortcutsDialog() {
    if (!frame || root.querySelector('.modal')) return;
    const close = () => overlay.remove();
    const overlay = h('div', { class: 'modal', onclick: (ev) => ev.target === overlay && close(), onkeydown: (ev) => ev.key === 'Escape' && (ev.stopPropagation(), close()) },
      h('div', { class: 'dialog', role: 'dialog', 'aria-label': 'Keyboard shortcuts' },
        h('div', { class: 'trayhead' }, h('h2', null, 'Keyboard Shortcuts'), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: close }, ic('close'))),
        h('table', { class: 'grid tight keys' }, h('tbody', null, SHORTCUTS.map(([k, what]) => h('tr', null, h('td', null, k.split(' ').map((part) => (part === 'then' || part === '/' ? ` ${part} ` : h('kbd', null, part)))), h('td', null, what)))))));
    frame.app.append(overlay);
    overlay.querySelector('.iconbtn').focus();
  }

  const GO = { d: '#/', c: '#/courses', l: '#/calendar', i: '#/inbox', g: '#/grades', p: '#/groups' };
  let pendingG = 0;
  function onKey(ev) {
    if (!frame || ev.ctrlKey || ev.metaKey || ev.altKey || route().view === 'off') return;
    const target = ev.composedPath()[0];
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
    const k = ev.key;
    if (pendingG && Date.now() - pendingG < 1200 && GO[k]) {
      pendingG = 0;
      location.hash = GO[k];
      ev.preventDefault();
      return;
    }
    pendingG = 0;
    if (k === 'g') pendingG = Date.now();
    else if (k === '?') shortcutsDialog();
    else if (k === 's' && BSX.ui.searchDialog) BSX.ui.searchDialog();
    else if (k === 'r') reload();
    else if (k === '/') {
      const box = frame.main.querySelector('input.search');
      if (!box) return;
      box.focus();
    } else if (k === 'j' || k === 'k') {
      const items = [...frame.main.querySelectorAll('.content a.t, .content a.arow, .content .nrow, .content .todo .t[href]')].filter((el) => el.offsetParent);
      if (!items.length) return;
      const at = items.indexOf(root.activeElement);
      const next = items[k === 'j' ? Math.min(items.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1)];
      next.focus();
      next.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } else if (k === '[' || k === ']') {
      const steps = frame.main.querySelectorAll('.pager a');
      const want = [...steps].find((a) => (k === '[' ? /Previous/ : /Next/).test(a.textContent));
      if (want) want.click();
    } else return;
    ev.preventDefault();
  }

  // ---- toolbar badge ---------------------------------------------------------
  // New grades and announcements since the dashboard was last opened, on the toolbar icon.
  async function updateBadge() {
    const runtime = (globalThis.browser || globalThis.chrome)?.runtime;
    if (!runtime || !runtime.sendMessage) return;
    if (route().view === 'dashboard' || settings.seenAt == null) {
      settings.seenAt = Date.now();
      saveSettings();
      runtime.sendMessage({ type: 'bsx-badge', count: 0 })?.catch?.(() => {});
      return;
    }
    try {
      const courses = focusCourses(await data.courses());
      const [grades, news] = await Promise.all([data.recentFeedback(courses, 14), data.recentAnnouncements(courses, 14)]);
      const count = grades.filter((g) => Date.parse(g.grade.graded_at) > settings.seenAt).length + news.filter((a) => Date.parse(a.posted_at) > settings.seenAt).length;
      runtime.sendMessage({ type: 'bsx-badge', count })?.catch?.(() => {});
    } catch {}
  }

  function start() {
    window.addEventListener('hashchange', render);
    window.addEventListener('keydown', onKey);
    root.addEventListener('click', interceptLinks);
    loadFonts();
    window.addEventListener('hashchange', updateBadge);
    loadSettings().then(() => setTimeout(updateBadge, 3000));
    // Pages draw first from the answers saved on the last visit; when Brightspace's real
    // answers differ, redraw in place, unless the student is typing or has a dialog open.
    client.onChange(() => {
      const busy = root.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(root.activeElement.tagName);
      // A framed Brightspace page is not redrawn: that would reload it and lose its state.
      if (!busy && !root.querySelector('.modal, .wi.changed') && !['off', 'open'].includes(route().view)) render();
    });
    loadSettings().then(render);
  }

  return {
    h, ic, safeHref, cleanHtml, prose, plainOf, clip, num, pct, fmt, applyClock, when, dayKey, bytes, DAY, COLORS,
    settings, saveSettings, colorOf, nameOf, focusCourses, state,
    keyOf, isDone, isDismissed, setFlag, personalItems, todoDialog, itemLink, externalWork, alsoOn, alsoChips, setLink, sameWork, workKey, outsideAnnouncements, edStatus: () => edState, folded,
    courseHref, itemHref, wrapHref, bs, PLURAL,
    empty, tag, button, linkButton, lazy, sideSection, filterBox, flash, menu,
    // The wrapper's own top element, for dialogs and effects placed over everything.
    appEl: () => (frame ? frame.app : null),
    views, render, reload, start,
  };
})();

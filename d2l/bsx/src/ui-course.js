// Layer 3, part 3: everything inside a course.
(() => {
  const ui = BSX.ui;
  if (!ui) return;
  const { data } = BSX;
  const { h, ic, settings, nameOf, when, num, pct, courseHref, itemHref, bs, prose } = ui;

  const LABEL = { home: 'Home', announcements: 'Announcements', assignments: 'Assignments', discussions: 'Discussions', grades: 'Grades', people: 'People', files: 'Files', syllabus: 'Syllabus', quizzes: 'Quizzes', modules: 'Modules' };
  const KIND = {
    assignment: { icon: 'assignment', label: 'Assignment', group: 'Assignments' },
    quiz: { icon: 'quiz', label: 'Quiz', group: 'Quizzes' },
    discussion: { icon: 'discussion', label: 'Discussion', group: 'Discussions' },
  };
  const TYPE_ICON = { File: 'file', Link: 'link', 'External tool': 'external', Assignment: 'assignment', Quiz: 'quiz', Discussion: 'discussion', 'Course home': 'home', Syllabus: 'syllabus', 'Module overview': 'module' };
  const VIEWABLE = new Set(['File', 'Link', 'External tool', 'Course home', 'Module overview']); // module items with a page inside the wrapper

  // The course's content plus a first "Course Home" module: the instructor's Brightspace
  // homepage (shown in a frame, so its widgets and welcome text stay as they made them)
  // and the syllabus when there is one.
  // A "Pinned" module comes first of all when the student has pinned entries (see pinMenu).
  async function courseModules(course, { withPinned = true } = {}) {
    const list = await data.modules(course.id);
    const items = [{ id: 0, title: 'Course homepage', type: 'Course home', unread: false, locked: false, url: bs.home(course.id), html_url: bs.home(course.id) }];
    // Always listed: the syllabus page shows the school's syllabus tool or the course overview.
    items.push({ id: -1, title: 'Syllabus', type: 'Syllabus', unread: false, locked: false, url: '', html_url: courseHref(course.id, 'syllabus') });
    const all = [{ id: 'home', name: 'Course Home', depth: 0, locked: false, items }, ...list];
    if (!withPinned) return all;
    // Pinned entries, in the order they were pinned, found wherever they sit now. An entry
    // that no longer exists simply drops out. Pinned outside work (Ed, Gradescope; its pin is
    // its text id) is looked up on those sites, waiting a few seconds at most.
    const byId = new Map(all.flatMap((m) => m.items.map((i) => [i.id, i])));
    if (pinsOf(course.id).some((id) => typeof id === 'string')) {
      const outside = await Promise.race([
        ui.externalWork([course]).then((kept) => [...kept, ...[...(ui.folded.get(course.id)?.values() || [])].flat()]).catch(() => []),
        new Promise((r) => setTimeout(() => r([]), 4000)),
      ]);
      for (const x of outside) byId.set(x.source_id, { id: x.source_id, title: x.name, type: x.source, external: x });
    }
    const found = pinsOf(course.id).map((id) => byId.get(id)).filter(Boolean);
    return found.length ? [{ id: 'pinned', name: 'Pinned', depth: 0, locked: false, items: found }, ...all] : all;
  }

  // ---- pins --------------------------------------------------------------------
  const pinsOf = (courseId) => (settings.pins && Array.isArray(settings.pins[courseId]) ? settings.pins[courseId] : []);
  function setPinned(courseId, itemId, on) {
    settings.pins = settings.pins || {};
    const now = pinsOf(courseId).filter((id) => id !== itemId);
    settings.pins[courseId] = on ? [...now, itemId] : now;
    if (!settings.pins[courseId].length) delete settings.pins[courseId];
    ui.saveSettings();
    ui.flash(on ? 'Pinned to the top of this course.' : 'Unpinned.');
    ui.render();
  }
  // The ⋮ menu on the left of a module entry.
  const pinMenu = (courseId, i) => {
    const pinned = pinsOf(courseId).includes(i.id);
    return ui.menu(`More for ${i.title}`, [{ label: pinned ? 'Unpin' : 'Pin', onclick: () => setPinned(courseId, i.id, !pinned) }]);
  };
  const whatIf = { on: false, courseId: null, overrides: new Map() };

  // ---- course navigation -----------------------------------------------------
  function courseNav(course, current) {
    const tools = h('div');
    data.externalTools(course.id)
      .then((list) => {
        if (list.length) tools.replaceChildren(h('div', { class: 'sep' }, 'External tools'), ...list.slice(0, 8).map((t) => h('a', { href: courseHref(course.id, 'modules', t.id) }, t.title, ' ', ic('external', 13))));
      })
      .catch(() => {});
    // Brightspace's Course Tools and the rest of its navigation bar (Class Progress and so
    // on). These are Brightspace pages; a click opens them inside the wrapper.
    const more = h('div');
    data.courseTools(course.id)
      .then((list) => {
        if (!list.length) return;
        // Grouped the way Brightspace's navigation bar groups them; loose links under "Course tools".
        // Same-named groups are one group (case aside), shown with Brightspace's spelling.
        const groups = new Map();
        for (const t of list) {
          const label = t.group || 'Course Tools';
          const key = label.toLowerCase();
          if (!groups.has(key)) groups.set(key, { label, items: [] });
          const g = groups.get(key);
          if (t.group) g.label = t.group;
          g.items.push(t);
        }
        more.replaceChildren(...[...groups.values()].flatMap((g) => [h('div', { class: 'sep' }, g.label), ...g.items.map((t) => h('a', { href: t.url, title: `${t.title} (Brightspace)` }, t.title))]));
      })
      .catch(() => {});
    return h('nav', { class: 'cnav', 'aria-label': 'Course navigation' },
      Object.keys(LABEL).map((key) => h('a', { href: courseHref(course.id, key === 'home' ? null : key), class: current === key ? 'on' : null }, LABEL[key])),
      more,
      h('div', { class: 'sep' }, 'Brightspace'),
      h('a', { href: bs.home(course.id) }, 'Original course home'),
      tools);
  }

  ui.courseNav = courseNav; // also beside Brightspace pages shown in the frame view

  const metaBar = (pairs) => h('dl', { class: 'meta' }, pairs.filter((p) => p && p[1] != null && p[1] !== '').map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v))));
  const outButton = (label, href) => h('a', { class: 'btn primary', href }, label, ' ', ic('external', 14));
  const notFound = (what, id, section) => ({ body: [ui.empty(`That ${what} is no longer available.`), h('a', { href: courseHref(id, section) }, `Back to ${LABEL[section]}`)] });

  // ---- modules ---------------------------------------------------------------
  // `work` is the course's assignment list. A module item that is an assignment, quiz or
  // discussion with the same name opens the wrapper's page for it, with its due date.
  function moduleList(courseId, list, work) {
    const byName = new Map();
    for (const a of work) {
      const k = `${a.kind}:${a.name.trim().toLowerCase()}`;
      byName.set(k, byName.has(k) ? null : a); // an ambiguous name matches nothing
    }
    const match = (i) => byName.get(`${i.type.toLowerCase()}:${i.title.trim().toLowerCase()}`) || null;
    // Sub-modules are placed inside their parent, so collapsing a module hides everything under it.
    const roots = [];
    const stack = [];
    list.forEach((m, at) => {
      const hasChildren = list[at + 1] && list[at + 1].depth > m.depth;
      const el = moduleBox(courseId, m, match, hasChildren);
      while (stack.length && stack[stack.length - 1].depth >= m.depth) stack.pop();
      if (stack.length) stack[stack.length - 1].el.append(el);
      else roots.push(el);
      stack.push({ depth: m.depth, el });
    });
    return roots;
  }

  function moduleBox(courseId, m, match, hasChildren) {
    return h('details', { class: 'group', open: true },
        h('summary', null, ic('down', 16), h('span', { class: 'gname' }, m.name), m.locked ? ui.tag('locked') : null),
        !m.items.length && hasChildren ? null : m.items.length
          ? m.items.map((i) => {
              if (i.external) return outsideRow(courseId, i.external);
              const a = match(i);
              const sub = a ? [a.due_at ? `Due ${when(a.due_at)}` : null, a.grade ? `${num(a.grade.score)}/${num(a.grade.points_possible)} pts` : a.points_possible != null ? `${num(a.points_possible)} pts` : null].filter(Boolean).join('  |  ') || i.type : i.type;
              return h('div', { class: 'irow' },
                pinMenu(courseId, i),
                h('span', { class: a ? 'iic ok' : 'iic' }, ic(TYPE_ICON[i.type] || 'item', 22)),
                h('div', { class: 'imid' }, h('a', { class: i.unread ? 't' : 't read', href: a ? itemHref(courseId, a) : VIEWABLE.has(i.type) ? courseHref(courseId, 'modules', i.id) : i.html_url }, i.title), h('div', { class: 'muted small' }, sub)),
                i.locked ? h('span', { class: 'muted' }, ic('lock', 16)) : a && a.grade ? h('span', { class: 'ok', title: 'Graded' }, ic('check', 18)) : i.unread ? h('span', { class: 'newdot', title: 'Not viewed yet' }) : null);
            })
          : h('div', { class: 'irow muted small' }, 'No items in this module.'));
  }

  // An outside site's own modules, arranged for the [Ed] module: "Other" (lessons with no
  // module) first, then exams, projects, homework, lessons, and anything else (such as
  // "Week 1") last. Modules that differ only by a number ("Homework 1",
  // "Homework 2") gathered under one parent named for them ("Homework"), in number order.
  // groups: [[module name, items]]. Returns [{ name, list } | { name, children: [[name, items]] }].
  const KIND_ORDER = [
    ['exams', /\b(exams?|midterms?|finals?|tests?)\b/i],
    ['projects', /\b(projects?|proj)\b/i],
    ['homework', /\b(homeworks?|hw\d*|hwk|problem sets?|psets?|assignments?)\b/i],
    ['lessons', /\b(lessons?|lectures?|readings?)\b/i],
  ];
  const kindRank = (name) => {
    if (/^other$/i.test(String(name).trim())) return 0;
    const at = KIND_ORDER.findIndex(([, re]) => re.test(name));
    return at < 0 ? KIND_ORDER.length + 1 : at + 1; // names of no known kind go last
  };
  // "Homework 3: Graphs" -> "Homework"; a name without a number is its own namesake.
  const namesake = (name) => {
    const m = String(name).match(/^(.*?)\s*(?:#|no\.?\s*)?\d+\b/i);
    return m && m[1].trim() ? m[1].trim().replace(/[\s:–-]+$/, '') : null;
  };
  const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  // A group's name in the plural: "Homework" -> "Homeworks", "Quiz" -> "Quizzes",
  // "Activity" -> "Activities"; a name already ending in s is left alone.
  const plural = (word) => {
    const w = String(word);
    if (/s$/i.test(w)) return w;
    if (/(x|z|ch|sh)$/i.test(w)) return `${w}${/z$/i.test(w) && !/zz$/i.test(w) ? 'z' : ''}es`;
    if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
    return `${w}s`;
  };
  function arrangeModules(groups) {
    const families = new Map();
    for (const [name, list] of groups) {
      const base = namesake(name);
      const key = base ? base.toLowerCase() : `\u0000${name}`;
      if (!families.has(key)) families.set(key, { base: base || name, members: [] });
      families.get(key).members.push([name, list]);
    }
    const entries = [...families.values()].map((f) =>
      f.members.length > 1
        ? { name: plural(f.base), children: f.members.sort(([a], [b]) => byName(a, b)) }
        : { name: f.members[0][0], list: f.members[0][1] });
    return entries.sort((a, b) => kindRank(a.name) - kindRank(b.name) || byName(a.name, b.name));
  }

  // One piece of outside work as a module entry, with the same ⋮ (Pin) as course entries.
  // Its pin is its text id (such as "ed-777-12"), so it never clashes with a Brightspace id.
  function outsideRow(courseId, x) {
    const done = Boolean(x.submitted || (x.grade && x.grade.score != null));
    const late = !done && x.due_at && Date.parse(x.due_at) < Date.now();
    const sub = [x.source, x.due_at ? `Due ${when(x.due_at)}` : 'No due date', x.grade ? `${num(x.grade.score)}/${num(x.grade.points_possible)} pts` : null, x.into ? `Shown with “${x.into}”` : null].filter(Boolean).join('  |  ');
    return h('div', { class: 'irow' },
      pinMenu(courseId, { id: x.source_id, title: x.name }),
      h('span', { class: done ? 'iic ok' : 'iic' }, ic('assignment', 22)),
      h('div', { class: 'imid' }, ui.itemLink(x), h('div', { class: 'muted small' }, sub)),
      h('span', { class: `small nowrap ${done ? 'ok' : late ? 'bad' : 'muted'}` }, x.status || ''));
  }

  // Work imported from outside sites, as one module per site ("[Ed]", "[Gradescope]") after
  // the course's own modules. Items folded into a Brightspace assignment are listed too,
  // marked with the assignment they are shown as. Loads on its own, so a slow site never
  // holds up the page.
  function sourceModules(course) {
    return ui.lazy(ui.externalWork([course]).catch(() => []), (kept) => {
      const folded = [...(ui.folded.get(course.id)?.values() || [])].flat();
      const bySource = new Map();
      for (const x of [...kept, ...folded]) {
        if (!bySource.has(x.source)) bySource.set(x.source, []);
        bySource.get(x.source).push(x);
      }
      const row = (x) => outsideRow(course.id, x);
      // The site's own order (Ed: its modules, then lessons by index; Gradescope: its table),
      // falling back to due date for anything without one.
      const byOrder = (a, b) => {
        const x = a.order || [Infinity, Infinity];
        const y = b.order || [Infinity, Infinity];
        return x[0] - y[0] || x[1] - y[1] || Date.parse(a.due_at || 8.64e15) - Date.parse(b.due_at || 8.64e15);
      };
      const box = (name, kids, count) => h('details', { class: 'group', open: true },
        h('summary', null, ic('down', 16), h('span', { class: 'gname' }, name), h('span', { class: 'count' }, count)), kids);
      return [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([source, items]) => {
        items.sort(byOrder);
        // Sites with their own modules (Ed) get them as sub-modules, arranged by kind.
        if (!items.some((x) => x.group)) return box(`[${source}]`, items.map(row), items.length);
        const groups = new Map();
        for (const x of items) {
          const name = x.group || 'Other';
          if (!groups.has(name)) groups.set(name, []);
          groups.get(name).push(x);
        }
        return box(`[${source}]`, arrangeModules([...groups.entries()]).map((e) =>
          e.children
            ? box(e.name, e.children.map(([n, list]) => box(n, list.map(row), list.length)), e.children.reduce((s, [, list]) => s + list.length, 0))
            : box(e.name, e.list.map(row), e.list.length)), items.length);
      });
    }, '');
  }

  // One module item shown inside the wrapper: a file in a viewer, an external tool in a
  // frame, or a link. Each keeps a button to the original, in case the frame stays blank.
  async function moduleItem(course, r) {
    const list = await courseModules(course, { withPinned: false }); // Previous/Next follow the course's own order
    const flat = list.flatMap((m) => m.items.map((i) => ({ ...i, module: m.name })));
    const at = flat.findIndex((i) => i.id === r.itemId);
    if (at < 0) return notFound('item', course.id, 'modules');
    const i = flat[at];
    const step = (j, label, icon, after) => (flat[j] ? h('a', { class: 'btn', href: VIEWABLE.has(flat[j].type) ? courseHref(course.id, 'modules', flat[j].id) : flat[j].html_url, title: flat[j].title }, after ? null : ic(icon, 14), label, after ? ic(icon, 14) : null) : h('span'));
    const frame = (src, title) => h('iframe', { class: 'viewer', src, title, loading: 'lazy', referrerpolicy: 'same-origin' });

    let view;
    let open;
    if (i.type === 'Module overview') {
      // The module's own text and images, as the instructor wrote them (sanitised).
      view = h('div', { class: 'detail', style: 'margin-top:12px' }, prose(i.description_html, i.description));
      open = [];
    } else if (i.type === 'Course home') {
      view = frame(i.url, `${nameOf(course)} homepage`);
      open = [h('a', { class: 'btn', href: `${i.html_url}#brightspace` }, 'Open in Brightspace ', ic('external', 14))];
    } else if (i.type === 'File') {
      view = frame(i.file_url, i.title);
      open = [h('a', { class: 'btn', href: i.file_url.replace('?stream=true', ''), title: 'Save a copy' }, 'Download'), h('a', { class: 'btn', href: i.html_url }, 'Open in Brightspace ', ic('external', 14))];
    } else if (i.type === 'External tool') {
      const launch = ui.safeHref(i.url) || i.html_url;
      view = [h('div', { class: 'banner' }, 'This tool is shown inside the page. If it stays blank, the tool does not allow that: use the button to open it in a new tab.'), frame(launch, i.title)];
      open = [h('a', { class: 'btn primary', href: launch, target: '_blank', rel: 'noopener' }, 'Open in a new tab ', ic('external', 14))];
    } else {
      const inside = ui.safeHref(i.url);
      const outside = !inside && /^https?:\/\//i.test(i.url) ? i.url : null;
      view = h('div', { class: 'linkcard' }, ic('link', 28), h('div', null, h('div', { class: 't' }, i.title), h('div', { class: 'muted small', style: 'overflow-wrap:anywhere' }, outside || 'A page in Brightspace')),
        outside ? h('a', { class: 'btn primary', href: outside, target: '_blank', rel: 'noopener noreferrer' }, 'Open link ', ic('external', 14)) : h('a', { class: 'btn primary', href: inside || i.html_url }, 'Open in Brightspace'));
      open = [h('a', { class: 'btn', href: i.html_url }, 'Open in Brightspace ', ic('external', 14))];
    }
    return {
      crumb: i.title,
      body: h('article', { class: 'detail' },
        h('div', { class: 'dhead' }, h('div', null, h('h1', null, i.title), h('div', { class: 'muted small' }, `${i.type} · ${i.module}`)), h('div', { class: 'row' }, open)),
        view,
        h('div', { class: 'pager' }, step(at - 1, 'Previous', 'left', false), step(at + 1, 'Next', 'right', true))),
    };
  }

  async function modules(course, r) {
    if (r && r.itemId != null) return moduleItem(course, r);
    const [list, work] = await Promise.all([courseModules(course), data.assignments(course.id).catch(() => [])]);
    return { body: [list.length ? moduleList(course.id, list, work) : ui.empty('No content in this course yet.'), sourceModules(course), h('p', { class: 'small' }, h('a', { href: bs.content(course.id) }, 'Open Content in Brightspace'))] };
  }

  // ---- home ------------------------------------------------------------------
  async function home(course) {
    const [news, list, work] = await Promise.all([data.announcements(course.id), courseModules(course), data.assignments(course.id).catch(() => [])]);
    const recent = news.filter((a) => a.posted_at && Date.now() - Date.parse(a.posted_at) < 14 * ui.DAY).slice(0, 2);
    return {
      body: [
        recent.length
          ? h('div', { class: 'notice' }, h('div', { class: 'nhead' }, ic('announcement', 18), ' Recent Announcements'),
              recent.map((a) => h('a', { class: 'nrow', href: courseHref(course.id, 'announcements', a.id) }, h('span', { class: 't' }, a.title), h('span', { class: 'muted small' }, ui.clip(ui.plainOf(a.message_html, a.message), 110)), h('span', { class: 'muted small nowrap' }, when(a.posted_at)))))
          : null,
        list.length ? moduleList(course.id, list, work) : ui.empty('No content in this course yet.'),
      ],
      side: [
        h('div', { class: 'sidebtns' },
          h('a', { class: 'btn wide', href: courseHref(course.id, 'stream') }, ic('announcement', 16), 'View Course Stream'),
          h('a', { class: 'btn wide', href: '#/calendar' }, ic('calendar', 16), 'View Course Calendar'),
          // Shown only once the notification settings link is found on the Brightspace page.
          ui.lazy(data.notificationsLink(course.id).catch(() => null), (href) => (href ? h('a', { class: 'btn wide', href }, ic('inbox', 16), 'View Course Notifications') : null), '')),
        ui.todoSide([course], { labels: false, gradesHref: courseHref(course.id, 'grades'), only: course.id }),
      ],
    };
  }

  // ---- announcements -----------------------------------------------------------
  async function announcements(course, r) {
    const list = await data.announcements(course.id);
    if (r.itemId != null) {
      const a = list.find((x) => x.id === r.itemId);
      if (!a) return notFound('announcement', course.id, 'announcements');
      return { crumb: a.title, body: h('article', { class: 'detail' }, h('h1', null, a.title), h('div', { class: 'muted small' }, a.posted_at ? `Posted ${when(a.posted_at)}` : ''), prose(a.message_html, a.message),
        a.attachments.length ? [h('h2', { class: 'sect' }, 'Attachments'), h('ul', { class: 'filelist' }, a.attachments.map(fileItem))] : null) };
    }
    // Ed announcements for this course, when the Ed reader is on; they open on Ed.
    const fromEd = ui.lazy(ui.outsideAnnouncements([course]), (eds) => eds.length
      ? [h('h2', { class: 'sect' }, 'From Ed Discussion'), h('div', { class: 'rows' }, eds.map((a) => h('a', { class: 'arow', href: a.html_url, target: '_blank', rel: 'noopener noreferrer' },
          h('span', { class: 'avatar sm' }, ic('announcement', 18)),
          h('div', { class: 'imid' }, h('div', { class: 't' }, a.title, ' ', ic('external', 12), a.pinned ? ui.tag('pinned') : null, a.unread ? h('span', { class: 'newdot inline', title: 'Unread on Ed' }) : null), h('div', { class: 'muted small' }, ui.clip(a.message, 200))),
          h('div', { class: 'muted small nowrap' }, a.posted_at ? `Posted on ${when(a.posted_at)}` : ''))))]
      : null, '');
    if (!list.length) return { body: [ui.empty('No announcements in this course.'), fromEd] };
    const rows = list.map((a) => {
      const text = ui.plainOf(a.message_html, a.message);
      const el = h('a', { class: 'arow', href: courseHref(course.id, 'announcements', a.id) },
        h('span', { class: 'avatar sm' }, ic('announcement', 18)),
        h('div', { class: 'imid' }, h('div', { class: 't' }, a.title, a.pinned ? ui.tag('pinned') : null), h('div', { class: 'muted small' }, ui.clip(text, 200))),
        h('div', { class: 'muted small nowrap' }, a.posted_at ? `Posted on ${when(a.posted_at)}` : ''));
      return [el, `${a.title} ${text}`];
    });
    return { body: [h('div', { class: 'toolbar' }, ui.filterBox('Search announcements', rows)), h('div', { class: 'rows' }, rows.map((x) => x[0])), fromEd, h('p', { class: 'small' }, h('a', { href: bs.news(course.id) }, 'Open Announcements in Brightspace'))] };
  }

  // ---- assignments, quizzes, discussions (lists) -------------------------------
  // Where a piece of work stands, as Canvas labels it: 'late' (handed in after the due
  // date), 'missing' (past due, not graded, not handed in / attempted / posted), 'submitted',
  // or 'open' (not due yet). Null when it cannot be told.
  async function workState(courseId, a) {
    const due = a.due_at ? Date.parse(a.due_at) : null;
    const past = due != null && due < Date.now();
    if (a.kind === 'assignment') {
      const s = await data.submission(courseId, a.source_id);
      if (s.submitted) return due != null && s.submitted_at && Date.parse(s.submitted_at) > due ? 'late' : 'submitted';
      return a.grade ? null : past ? 'missing' : 'open';
    }
    if (a.grade) return null;
    if (a.kind === 'quiz') {
      const q = await data.quizAttempts(courseId, a.source_id);
      if (!q.known) return null;
      return q.attempts_used > 0 ? 'submitted' : past ? 'missing' : 'open';
    }
    if (a.kind === 'discussion') {
      if (due == null) return null;
      const posted = (await data.discussion(courseId, a.source_id))?.posts.some((p) => p.mine);
      return posted ? 'submitted' : past ? 'missing' : 'open';
    }
    return null;
  }
  // A small "missing" or "late" tag that fills in once the state is known.
  function stateTag(courseId, a) {
    const box = h('span');
    workState(courseId, a).then((st) => {
      if (st === 'missing' || st === 'late') box.replaceChildren(ui.tag(st, 'badt'));
    }).catch(() => {});
    return box;
  }

  function workRow(course, a) {
    const courseId = course.id;
    const now = Date.now();
    const status = h('span', { class: 'small nowrap' });
    const show = (done, text) => {
      status.textContent = text;
      status.className = `small nowrap ${done ? 'ok' : a.due_at && Date.parse(a.due_at) < now ? 'bad' : 'muted'}`;
    };
    if (a.grade) show(true, 'Graded');
    workState(courseId, a).then((st) => {
      if (!st) return;
      if (st === 'late') {
        status.textContent = a.grade ? 'Graded · Late' : 'Late';
        status.className = 'small nowrap bad';
      } else if (!a.grade) show(st === 'submitted', { submitted: a.kind === 'quiz' ? 'Attempted' : a.kind === 'discussion' ? 'Posted' : 'Submitted', missing: 'Missing', open: a.kind === 'quiz' ? 'Not attempted' : a.kind === 'discussion' ? 'Not posted' : 'Not submitted' }[st]);
    }).catch(() => {});
    const possible = a.grade ? a.grade.points_possible : a.points_possible;
    const score = a.grade ? `${num(a.grade.score)}/${num(possible)} pts` : possible != null ? `-/${num(possible)} pts` : null;
    const sub = [a.forum, a.due_at ? h('span', null, h('b', null, 'Due'), ` ${when(a.due_at)}`) : 'No due date', score].filter(Boolean);
    const el = h('div', { class: 'irow' },
      h('span', { class: 'iic ok' }, ic(KIND[a.kind].icon, 22)),
      h('div', { class: 'imid' }, h('a', { class: 't', href: itemHref(courseId, a) }, a.name), h('div', { class: 'muted small' }, sub.map((s, i) => [i ? '  |  ' : null, s]), ui.alsoChips(course, a))),
      status);
    return [el, a.name];
  }

  function groupBox(title, rows) {
    if (!rows.length) return null;
    return h('details', { class: 'group', open: true }, h('summary', null, ic('down', 16), h('span', { class: 'gname' }, title), h('span', { class: 'count' }, rows.length)), rows.map((x) => x[0]));
  }

  async function workList(course, kind) {
    const section = kind ? ui.PLURAL[kind] : 'assignments';
    const [everything, groups] = await Promise.all([data.assignments(course.id), kind ? null : data.assignmentGroups(course.id).catch(() => new Map())]);
    const all = everything.filter((a) => !kind || a.kind === kind);
    const now = Date.now();
    const byDue = (a, b) => Date.parse(a.due_at) - Date.parse(b.due_at);
    const rows = [];
    const make = (a) => {
      const row = workRow(course, a);
      rows.push(row);
      return row;
    };

    let boxes;
    if (!kind && settings.asgBy === 'type') {
      const buckets = new Map();
      for (const a of all) {
        const name = (a.grade_item_id != null && groups.get(String(a.grade_item_id))) || KIND[a.kind].group;
        if (!buckets.has(name)) buckets.set(name, []);
        buckets.get(name).push(a);
      }
      boxes = [...buckets.entries()].map(([name, items]) => groupBox(name, items.sort((a, b) => (a.due_at && b.due_at ? byDue(a, b) : a.due_at ? -1 : 1)).map(make)));
    } else {
      const label = kind ? KIND[kind].group : 'Assignments';
      boxes = [
        groupBox(`Upcoming ${label}`, all.filter((a) => a.due_at && Date.parse(a.due_at) >= now).sort(byDue).map(make)),
        groupBox(`Undated ${label}`, all.filter((a) => !a.due_at).map(make)),
        groupBox(`Past ${label}`, all.filter((a) => a.due_at && Date.parse(a.due_at) < now).sort(byDue).reverse().map(make)),
      ];
    }

    // Work that is graded outside Brightspace (Gradescope, publisher sites) shows as links.
    const external = kind
      ? null
      : ui.lazy(data.externalTools(course.id), (tools) =>
          tools.length
            ? h('details', { class: 'group', open: true }, h('summary', null, ic('down', 16), h('span', { class: 'gname' }, 'External Tools'), h('span', { class: 'count' }, tools.length)),
                tools.map((t) => h('div', { class: 'irow' }, h('span', { class: 'iic' }, ic('external', 22)), h('div', { class: 'imid' }, h('a', { class: 't', href: courseHref(course.id, 'modules', t.id) }, t.title), h('div', { class: 'muted small' }, 'Work and grades for this tool live outside Brightspace.')))))
            : null, '');

    const pick = (key, text) => h('button', { type: 'button', class: settings.asgBy === key ? 'on' : null, onclick: () => { settings.asgBy = key; ui.saveSettings(); ui.render(); } }, text);
    const original = { assignments: bs.assignments, quizzes: bs.quizzes, discussions: bs.discussions }[section](course.id);
    return {
      body: [
        h('div', { class: 'toolbar' }, ui.filterBox(`Search ${LABEL[section].toLowerCase()}`, rows, () => {
          // A group with nothing left after filtering is hidden rather than shown empty.
          for (const box of boxes) if (box) box.hidden = ![...box.querySelectorAll('.irow')].some((el) => !el.hidden);
        }), kind ? null : h('div', { class: 'seg' }, pick('date', 'Show by Date'), pick('type', 'Show by Type'))),
        all.length ? boxes : ui.empty(`No ${LABEL[section].toLowerCase()} in this course.`),
        kind ? null : gradescopeGroup(course),
        external,
        h('p', { class: 'small' }, h('a', { href: original }, `Open ${LABEL[section]} in Brightspace`)),
      ],
    };
  }

  // ---- Gradescope (optional) ----------------------------------------------------
  // Resolves to null when the reader is off or the course has no Gradescope link.
  async function gradescopeFor(course) {
    if (!settings.gradescope || !BSX.gradescope) return null;
    const tool = (await data.externalTools(course.id)).find((t) => /gradescope/i.test(t.title));
    if (!tool) return null;
    try {
      return { ...(await BSX.gradescope.forCourse(course)), launch: tool.html_url };
    } catch (e) {
      return { state: 'error', items: [], launch: tool.html_url, why: e.message || String(e) };
    }
  }

  const gradescopeNote = (g) =>
    g.state === 'signed_out' ? ['You are not signed in to Gradescope in this browser. ', h('a', { href: g.launch }, 'Open Gradescope from this course'), ' once, then press Refresh.']
    : g.state === 'no_permission' ? ['Your browser has not allowed this extension on gradescope.com yet. ', h('button', { class: 'btn', type: 'button', onclick: () => (globalThis.browser || globalThis.chrome)?.runtime?.sendMessage({ type: 'bsx-grant' }) }, 'Allow Gradescope access'), ' then press Refresh.']
    : g.state === 'no_match' ? 'No Gradescope course matching this one was found on your Gradescope account.'
    : g.state === 'error' ? `Gradescope could not be read. ${g.why || ''}`
    : null;

  const edNote = (state) =>
    state === 'no_permission' ? ['Your browser has not allowed this extension on edstem.org yet. ', h('button', { class: 'btn', type: 'button', onclick: () => (globalThis.browser || globalThis.chrome)?.runtime?.sendMessage({ type: 'bsx-grant', site: 'ed' }) }, 'Allow Ed access'), ' then press Refresh.']
    : state === 'bad_token' ? ['Ed did not accept your API token. ', h('a', { href: '#/connections' }, 'Replace it'), '.']
    : null;

  // Outside work for a course, one group per site, without the items folded into others.
  function gradescopeGroup(course) {
    const sources = Promise.all([gradescopeFor(course), ui.externalWork([course]).catch(() => [])]);
    return ui.lazy(sources, ([g, kept]) => {
      const now = Date.now();
      const groups = [];
      const ed = settings.ed?.on && settings.ed.token ? ui.edStatus() : null;
      if (ed && (ed.state !== 'ok' || kept.some((i) => i.source === 'Ed'))) {
        const note = edNote(ed.state);
        // Dated lessons only here; undated readings and slides are in the [Ed] module.
        const rows = kept.filter((i) => i.source === 'Ed' && i.due_at).map((i) => h('div', { class: 'irow' },
          h('span', { class: 'iic ok' }, ic('assignment', 22)),
          h('div', { class: 'imid' }, ui.itemLink(i), h('div', { class: 'muted small' }, i.due_at ? [h('b', null, 'Due'), ` ${when(i.due_at)}`] : 'No due date')),
          h('span', { class: `small nowrap ${i.submitted ? 'ok' : i.due_at && Date.parse(i.due_at) < now ? 'bad' : 'muted'}` }, i.status)));
        groups.push(h('details', { class: 'group', open: true },
          h('summary', null, ic('down', 16), h('span', { class: 'gname' }, 'Ed Discussion'), h('span', { class: 'count' }, rows.length)),
          note ? h('div', { class: 'irow muted small' }, h('span', null, note)) : null,
          rows));
      }
      if (!g) return groups;
      const shown = new Set(kept.filter((i) => i.source === 'Gradescope').map((i) => i.source_id));
      g = { ...g, items: g.items.filter((i) => shown.has(i.source_id)) };
      const note = gradescopeNote(g);
      const rows = g.items.map((i) => {
        const late = i.due_at && Date.parse(i.due_at) < now && !i.submitted;
        const score = i.grade ? `${num(i.grade.score)}/${num(i.grade.points_possible)} pts` : null;
        return h('div', { class: 'irow' },
          h('span', { class: 'iic ok' }, ic('assignment', 22)),
          h('div', { class: 'imid' }, ui.itemLink(i), h('div', { class: 'muted small' }, [i.due_at ? h('span', null, h('b', null, 'Due'), ` ${when(i.due_at)}`) : 'No due date', score].filter(Boolean).map((s, n) => [n ? '  |  ' : null, s]))),
          h('span', { class: `small nowrap ${i.submitted ? 'ok' : late ? 'bad' : 'muted'}` }, i.status));
      });
      return [h('details', { class: 'group', open: true },
        h('summary', null, ic('down', 16), h('span', { class: 'gname' }, 'Gradescope'), h('span', { class: 'count' }, g.items.length)),
        note ? h('div', { class: 'irow muted small' }, h('span', null, note)) : null,
        rows,
        !note && !rows.length ? h('div', { class: 'irow muted small' }, 'No other assignments in Gradescope.') : null), ...groups];
    }, '');
  }

  function gradescopeTable(course) {
    return ui.lazy(gradescopeFor(course), (g) => {
      if (!g) return null;
      const note = gradescopeNote(g);
      return [
        h('h2', { class: 'sect' }, 'Gradescope'),
        note ? h('p', { class: 'muted' }, note) : null,
        g.items.length
          ? h('table', { class: 'grid' },
              h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Due'), h('th', { class: 'num' }, 'Score'), h('th', { class: 'num' }, 'Out of'), h('th', { class: 'num' }, '%'))),
              h('tbody', null, g.items.map((i) => h('tr', null,
                h('td', null, ui.itemLink(i), i.grade ? null : ui.tag(i.status)),
                h('td', { class: 'muted small nowrap' }, i.due_at ? when(i.due_at) : ''),
                h('td', { class: 'num' }, i.grade ? num(i.grade.score) : '–'),
                h('td', { class: 'num' }, i.points_possible != null ? num(i.points_possible) : ''),
                h('td', { class: 'num' }, i.grade ? pct(i.grade.score, i.grade.points_possible) : '')))))
          : null,
        g.state === 'ok' ? h('p', { class: 'muted small' }, 'Read from Gradescope. These scores are not part of the Brightspace total above unless your instructor also posts them there.') : null,
      ];
    }, '');
  }

  // ---- assignment, quiz, discussion (detail) ------------------------------------
  function gradePanel(grade, possible) {
    return ui.sideSection('Grade', grade
      ? [h('div', { class: 'bigscore' }, num(grade.score), h('span', { class: 'muted' }, ` / ${num(grade.points_possible ?? possible)}`)), grade.displayed ? h('div', { class: 'muted small' }, grade.displayed) : null, grade.comment ? h('div', { class: 'quote small' }, grade.comment) : null]
      : h('div', { class: 'muted small pad' }, possible != null ? `Not graded yet. ${num(possible)} points possible.` : 'Not graded yet.'));
  }

  const SUBMIT_KIND = { 0: 'a file upload', 1: 'a text entry', 2: 'on paper', 3: 'in person', 4: 'a file upload or text entry' };
  const fileItem = (f) => h('li', null, ic('file', 16), ' ', f.url ? h('a', { href: f.url, download: f.name, title: `Download ${f.name}` }, f.name) : f.name, f.size != null ? h('span', { class: 'muted small' }, ` ${ui.bytes(f.size)}`) : null);
  const linkItem = (l) => (ui.safeHref(l.url) || /^https?:\/\//i.test(l.url) ? h('li', null, ic('link', 16), ' ', h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.name)) : null);

  // A rubric as Canvas shows it: one row per criterion, its ratings side by side, and
  // (once assessed) the chosen rating highlighted with the points and any comment.
  function rubricTable(rubric, result) {
    const outcome = new Map((result?.criteria || []).map((c) => [c.id, c]));
    let total = 0;
    let max = 0;
    const rows = rubric.criteria.map((c) => {
      const o = outcome.get(c.id);
      const top = Math.max(0, ...c.levels.map((l) => l.points || 0));
      max += top;
      const chosen = o && o.level_id != null ? c.levels.find((l) => l.id === o.level_id) : null;
      const got = o ? o.score ?? chosen?.points ?? null : null;
      if (got != null) total += got;
      return h('tr', null,
        h('th', { scope: 'row' }, c.name, c.group && rubric.criteria.some((x) => x.group !== c.group) ? h('div', { class: 'muted small' }, c.group) : null),
        h('td', { class: 'ratings' }, c.levels.map((l) => h('div', { class: l === chosen ? 'rating on' : 'rating' },
          rubric.points && l.points != null ? h('div', { class: 'rpts' }, `${num(l.points)} pts`) : null,
          h('div', null, h('b', null, l.name)),
          l.description ? h('div', { class: 'muted small' }, l.description) : null)),
          o && o.feedback ? h('div', { class: 'cfb', style: 'flex-basis:100%;padding:0 10px 8px' }, o.feedback) : null),
        rubric.points ? h('td', { class: 'num' }, got != null ? `${num(got)} / ${num(top)} pts` : `${num(top)} pts`) : null);
    });
    const overall = result && result.level_id != null ? rubric.overall.find((l) => l.id === result.level_id) : null;
    return [
      h('table', { class: 'rubric' },
        h('thead', null, h('tr', null, h('th', { colspan: rubric.points ? '3' : '2' }, rubric.name))),
        h('thead', null, h('tr', null, h('th', null, 'Criteria'), h('th', null, 'Ratings'), rubric.points ? h('th', { class: 'num' }, 'Pts') : null)),
        h('tbody', null, rows),
        rubric.points ? h('tfoot', null, h('tr', null, h('th', { colspan: '2' }, overall ? `Overall: ${overall.name}` : ''), h('th', { class: 'num' }, result ? `Total: ${num(result.score ?? total)} / ${num(max)}` : `Total points: ${num(max)}`))) : null),
      result && result.feedback ? h('p', { class: 'cfb' }, result.feedback) : null,
    ];
  }

  // Canvas's "Start Assignment": choose a file, add a comment, submit. Brightspace takes one
  // file per submission; it is sent only when the student presses Submit.
  function submitBox(course, a, onDone) {
    // Brightspace takes one file per submission. Where it keeps every submission (rule 2),
    // several files are sent one after another, each as its own submission.
    const several = a.submissions_rule === 2;
    const file = h('input', { type: 'file', class: 'txt', multiple: several ? true : null, 'aria-label': several ? 'Files to submit' : 'File to submit', accept: a.allowed_extensions ? a.allowed_extensions.map((x) => (x.startsWith('.') ? x : `.${x}`)).join(',') : null });
    const comment = h('textarea', { class: 'txt', rows: '3', 'aria-label': 'Comment' });
    const msg = h('div', { class: 'msg', role: 'status' });
    const go = h('button', { type: 'button', class: 'btn primary' }, 'Submit Assignment');
    const box = h('section', { class: 'submitbox', hidden: true },
      h('h2', null, a.submitted ? 'New Attempt' : 'File Upload'),
      h('label', null, several ? 'Files' : 'File', file),
      several ? h('div', { class: 'muted small' }, 'You can choose several files; each is handed in as its own submission.') : null,
      a.allowed_extensions ? h('div', { class: 'muted small' }, `Allowed: ${a.allowed_extensions.join(', ')}`) : null,
      h('label', null, 'Comment (optional)', comment),
      a.submissions_rule === 3 && a.submitted ? h('div', { class: 'muted small' }, 'This replaces your earlier submission.') : null,
      a.submissions_rule === 4 ? h('div', { class: 'muted small' }, 'Only one submission is allowed for this assignment.') : null,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => (box.hidden = true) }, 'Cancel'), go),
      msg);
    go.addEventListener('click', async () => {
      const chosen = [...(file.files || [])];
      if (!chosen.length) {
        msg.className = 'msg bad';
        msg.textContent = 'Choose a file first.';
        return;
      }
      go.disabled = true;
      let sent = 0;
      try {
        let s = null;
        for (const f of chosen) {
          msg.className = 'msg';
          msg.textContent = chosen.length > 1 ? `Submitting ${f.name} (${sent + 1} of ${chosen.length})…` : `Submitting ${f.name}…`;
          s = await data.submit(course.id, a.source_id, f, sent ? '' : comment.value.trim());
          sent++;
        }
        msg.className = 'msg ok';
        msg.textContent = s.submitted ? `Submitted ${chosen.map((f) => f.name).join(', ')}.` : 'Sent. Brightspace has not listed it yet; check again in a moment.';
        ui.flash(s.submitted ? `Submission successful: ${a.name}` : `Sent ${a.name}. Brightspace has not listed it yet.`, 'ok');
        setTimeout(onDone, 600);
      } catch (e) {
        go.disabled = false;
        msg.className = 'msg bad';
        msg.replaceChildren(
          sent ? `${sent} of ${chosen.length} files were handed in before this one failed. ` : '',
          e && e.status === 403 ? 'Brightspace refused the submission (not permitted). ' : e && e.status === 401 ? 'Your Brightspace session has ended; sign in again. ' : `Brightspace did not accept the submission${e && e.status ? ` (${e.status})` : ''}. ${e && e.detail ? e.detail + ' ' : ''}`,
          h('a', { href: a.html_url }, 'Submit in Brightspace instead'), '.');
      }
    });
    return box;
  }

  async function assignmentDetail(course, r) {
    const a = await data.assignment(course.id, r.itemId);
    if (!a) return notFound('assignment', course.id, 'assignments');
    const late = a.due_at && Date.parse(a.due_at) < Date.now();
    const statusLine = a.submitted
      ? h('div', { class: 'substat ok' }, ic('check', 18), ' Submitted', a.submitted_at ? h('div', { class: 'muted small' }, when(a.submitted_at)) : null)
      : a.status === 'draft'
        ? h('div', { class: 'substat' }, 'Draft saved, not submitted')
        : h('div', { class: late ? 'substat bad' : 'substat' }, late ? 'Missing' : 'Not submitted');
    const files = a.submissions.flatMap((s) => s.files);
    const fb = a.feedback;
    const can = data.canSubmit(a);
    const box = can.ok ? submitBox(course, a, () => ui.reload()) : null;
    const head = can.ok
      ? h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => { box.hidden = false; box.querySelector('input[type=file]').focus(); } }, a.submitted ? 'New Attempt' : 'Start Assignment'),
          h('a', { class: 'btn', href: a.html_url, title: 'Open the assignment in Brightspace' }, ic('external', 14)))
      : outButton(a.submitted ? 'View in Brightspace' : 'Open in Brightspace', a.html_url);
    // Rubric results without the rubric itself (not every folder lists it) still show their scores.
    const shown = new Set(a.rubrics.map((x) => x.id));
    const orphanResults = (fb?.rubrics || []).filter((x) => !shown.has(x.rubric_id));
    return {
      crumb: a.name,
      body: h('article', { class: 'detail' },
        h('div', { class: 'dhead' }, h('h1', null, a.name), head),
        metaBar([['Due', a.due_at ? when(a.due_at) : 'No due date'], ['Points', a.points_possible != null ? num(a.points_possible) : null], ['Submitting', SUBMIT_KIND[a.submission_type] || null], ['Available until', a.lock_at ? when(a.lock_at) : null]]),
        !can.ok && a.submission_type !== 2 && a.submission_type !== 3 ? h('div', { class: 'banner' }, can.why) : null,
        box,
        prose(a.description_html, a.description) || h('p', { class: 'muted' }, 'No additional details were added for this assignment.'),
        a.attachments.length || a.links.length ? [h('h2', { class: 'sect' }, 'Attached files'), h('ul', { class: 'filelist' }, a.attachments.map(fileItem), a.links.map(linkItem))] : null,
        a.rubrics.map((rb) => rubricTable(rb, (fb?.rubrics || []).find((x) => x.rubric_id === rb.id))),
        orphanResults.length ? [h('h2', { class: 'sect' }, 'Rubric results'), orphanResults.map((x) => h('p', null, x.score != null ? `Score: ${num(x.score)}` : '', x.feedback ? h('div', { class: 'cfb' }, x.feedback) : null))] : null),
      side: [
        ui.sideSection('Submission', [statusLine, files.length ? h('ul', { class: 'filelist' }, files.map(fileItem)) : null]),
        ui.lazy(ui.alsoOn(course, a), (list) => (list.length ? ui.sideSection('Also on', [list.map((x) => h('div', { class: 'todo' }, h('span', { class: 'todoic' }, ic('external', 18)), h('div', { class: 'tmid' }, h('a', { class: 't', href: x.html_url, target: '_blank', rel: 'noopener noreferrer' }, `${x.source}: ${x.name}`), h('div', { class: 'm' }, [x.status, x.auto ? 'matched automatically' : 'linked by you'].filter(Boolean).join(' · '))))), h('a', { class: 'sidelink small', href: '#/connections' }, 'Change matches')]) : null), ''),
        gradePanel(a.grade || (fb && fb.score != null ? { score: fb.score, points_possible: a.points_possible, displayed: '', comment: '' } : null), a.points_possible),
        fb && (fb.comment_html || fb.comment || fb.files.length || fb.links.length)
          ? ui.sideSection('Feedback', [prose(fb.comment_html, fb.comment), fb.files.length || fb.links.length ? h('ul', { class: 'filelist' }, fb.files.map(fileItem), fb.links.map(linkItem)) : null])
          : null,
      ],
    };
  }

  async function quizDetail(course, r) {
    const q = await data.quiz(course.id, r.itemId);
    if (!q) return notFound('quiz', course.id, 'quizzes');
    const allowed = q.attempts.allowed ?? q.allowed_attempts;
    const remaining = q.attempts.remaining ?? (allowed != null && q.attempts.known ? Math.max(0, allowed - q.attempts.attempts_used) : null);
    const attempts = q.attempts.known
      ? [h('div', null, h('b', null, `${q.attempts.attempts_used}`), allowed != null ? ` of ${allowed}` : '', ' completed'),
         q.attempts.in_progress ? h('div', { class: 'muted small' }, `${q.attempts.in_progress} in progress`) : null,
         h('div', { class: 'muted small' }, remaining != null ? `${remaining} remaining` : 'Unlimited attempts')]
      : null;
    const closed = q.lock_at && Date.parse(q.lock_at) < Date.now();
    const notOpen = q.unlock_at && Date.parse(q.unlock_at) > Date.now();
    return {
      crumb: q.name,
      body: h('article', { class: 'detail' },
        h('div', { class: 'dhead' }, h('h1', null, q.name), outButton(closed ? 'View in Brightspace' : 'Take the Quiz in Brightspace', q.html_url)),
        metaBar([
          ['Due', q.real_due_at ? when(q.real_due_at) : 'No due date'],
          ['Points', q.grade ? num(q.grade.points_possible) : null],
          ['Available', q.unlock_at || q.lock_at ? `${q.unlock_at ? when(q.unlock_at) : 'now'} – ${q.lock_at ? when(q.lock_at) : 'no end'}` : null],
          ['Time Limit', q.time_limit != null ? `${q.time_limit} Minutes` : 'None'],
          ['Allowed Attempts', q.allowed_attempts != null ? String(q.allowed_attempts) : 'Unlimited'],
        ]),
        notOpen ? h('div', { class: 'banner' }, ic('lock', 16), ` This quiz is locked until ${when(q.unlock_at)}.`) : closed ? h('div', { class: 'banner' }, ic('lock', 16), ` This quiz closed ${when(q.lock_at)}.`) : null,
        q.description_html || q.description ? [h('h2', { class: 'sect' }, 'Description'), prose(q.description_html, q.description)] : null,
        q.instructions_html || q.instructions ? [h('h2', { class: 'sect' }, 'Instructions'), prose(q.instructions_html, q.instructions)] : null),
      side: [
        ui.sideSection('Attempts', h('div', { class: 'pad' }, attempts || h('span', { class: 'muted small' }, 'Brightspace does not report attempts for this quiz.'))),
        gradePanel(q.grade, null),
      ],
    };
  }

  // Canvas's reply box: a message (and a subject for a new thread), posted to Brightspace
  // only when the student presses Post Reply.
  function replyBox(course, d, parent) {
    const subject = h('input', { class: 'txt', type: 'text', 'aria-label': 'Subject', placeholder: 'Subject', value: parent ? `Re: ${parent.subject || d.name}` : '' });
    const message = h('textarea', { class: 'txt', rows: '5', 'aria-label': parent ? `Reply to ${parent.author}` : 'Reply', placeholder: 'Write a reply…' });
    const msg = h('div', { class: 'msg', role: 'status' });
    const go = h('button', { class: 'btn primary', type: 'button' }, 'Post Reply');
    const box = h('div', { class: 'replybox' },
      parent ? null : h('label', null, 'Subject', subject),
      h('label', null, parent ? `Reply to ${parent.author}` : 'Message', message),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => box.remove() }, 'Cancel'), go),
      msg);
    go.addEventListener('click', async () => {
      const text = message.value.trim();
      if (!text) {
        msg.className = 'msg bad';
        msg.textContent = 'Write something first.';
        return;
      }
      go.disabled = true;
      msg.className = 'msg';
      msg.textContent = 'Posting…';
      try {
        await data.post(course.id, d.forum_id, d.source_id, { parentId: parent ? parent.id : null, subject: parent ? subject.value : subject.value.trim() || d.name, message: text });
        ui.flash(parent ? `Replied to ${parent.author}.` : 'Your post is up.');
        ui.reload();
      } catch (e) {
        go.disabled = false;
        msg.className = 'msg bad';
        msg.textContent = e && e.status === 403 ? 'Brightspace did not allow posting here (the topic may be locked).' : `Brightspace did not accept the post${e && e.status ? ` (${e.status})` : ''}. ${e && e.detail ? e.detail : ''}`;
      }
    });
    setTimeout(() => message.focus(), 0);
    return box;
  }

  function thread(posts, onReply) {
    const ids = new Set(posts.map((p) => p.id));
    const kids = new Map();
    const roots = [];
    for (const p of posts) {
      if (p.parent_id != null && ids.has(p.parent_id)) {
        if (!kids.has(p.parent_id)) kids.set(p.parent_id, []);
        kids.get(p.parent_id).push(p);
      } else roots.push(p);
    }
    const draw = (p, depth) => [
      h('div', { class: p.unread ? 'post unread' : 'post', style: `margin-left:${Math.min(depth, 5) * 28}px` },
        h('div', { class: 'phead' }, h('span', { class: 'avatar sm' }, (p.author || '?').slice(0, 1).toUpperCase()), h('div', null, h('div', { class: 't' }, p.author, p.mine ? ui.tag('you') : null, p.unread ? h('span', { class: 'newdot inline', title: 'Unread' }) : null), h('div', { class: 'muted small' }, when(p.posted_at)))),
        depth === 0 && p.subject ? h('div', { class: 'psub' }, p.subject) : null,
        prose(p.message_html, p.message),
        onReply ? h('button', { class: 'linkbtn', type: 'button', onclick: (ev) => { const post = ev.currentTarget.closest('.post'); if (!post.querySelector('.replybox')) post.append(onReply(p)); } }, ic('discussion', 14), ' Reply') : null),
      (kids.get(p.id) || []).map((k) => draw(k, depth + 1)),
    ];
    return roots.map((p) => draw(p, 0));
  }

  async function discussionDetail(course, r) {
    const d = await data.discussion(course.id, r.itemId);
    if (!d) return notFound('discussion', course.id, 'discussions');
    const canPost = !d.locked;
    const slot = h('div');
    // Collapsed like Canvas's "Reply" field until clicked.
    const opener = canPost ? h('button', { class: 'replyopen', type: 'button', onclick: () => { opener.hidden = true; const b = replyBox(course, d, null); b.querySelector('.btn:not(.primary)').addEventListener('click', () => (opener.hidden = false)); slot.append(b); } }, ic('discussion', 16), ' Reply') : null;
    return {
      crumb: d.name,
      body: h('article', { class: 'detail' },
        h('div', { class: 'dhead' }, h('h1', null, d.name), d.locked ? ui.tag('locked') : null),
        metaBar([['Forum', d.forum], ['Due', d.due_at ? when(d.due_at) : null], ['Points', d.points_possible != null ? num(d.points_possible) : null]]),
        prose(d.description_html, d.description),
        opener, slot,
        h('h2', { class: 'sect' }, d.posts.length ? `${d.posts.length} ${d.posts.length === 1 ? 'post' : 'posts'}` : 'Posts', d.posts.some((p) => p.unread) ? h('span', { class: 'muted small' }, ` · ${d.posts.filter((p) => p.unread).length} unread`) : null),
        d.posts.length ? thread(d.posts, canPost ? (p) => replyBox(course, d, p) : null) : ui.empty(d.must_post_first ? 'Post first to see your classmates’ replies.' : 'No posts yet. Be the first to reply.')),
    };
  }

  // ---- grades ------------------------------------------------------------------
  async function grades(course) {
    const id = course.id;
    if (whatIf.courseId !== id) Object.assign(whatIf, { on: false, courseId: id, overrides: new Map(), allItems: undefined });
    const [g, work, courses] = await Promise.all([data.grades(id), data.assignments(id).catch(() => []), data.courses()]);
    // Switch between courses without leaving Grades, as Canvas's course menu does.
    const listed = ui.state.showAll ? courses : ui.focusCourses(courses);
    const choices = listed.includes(course) || !courses.includes(course) ? listed : [...listed, course];
    const picker = h('select', { class: 'txt pick', 'aria-label': 'Course' }, choices.map((c) => h('option', { value: String(c.id), selected: c.id === id }, nameOf(c))));
    picker.addEventListener('change', () => (location.hash = courseHref(Number(picker.value), 'grades')));
    const byItem = new Map(work.filter((a) => a.grade_item_id != null).map((a) => [String(a.grade_item_id), a]));
    // Scores Brightspace has not posted but an outside copy has (Gradescope, folded into the
    // Brightspace assignment): used in their place, scaled to the item's points, and tagged.
    // Waits at most a few seconds for the outside sites.
    const outside = new Map();
    if (settings.gradescope || (settings.ed?.on && settings.ed.token)) {
      await Promise.race([ui.externalWork([course]).catch(() => []), new Promise((r) => setTimeout(r, 4000))]);
      const bag = ui.folded.get(id);
      for (const group of g.groups) {
        for (const i of group.items) {
          if (i.value && i.value.score != null) continue;
          const a = byItem.get(String(i.id));
          const copy = a && (bag?.get(a.id) || []).find((c) => c.grade && c.grade.score != null);
          if (!copy) continue;
          const pp = i.value?.points_possible ?? i.points_possible;
          const score = pp > 0 && copy.grade.points_possible > 0 ? (copy.grade.score / copy.grade.points_possible) * pp : copy.grade.score;
          outside.set(i.id, { score, source: copy.source });
        }
      }
    }
    const base = new Map([...outside].map(([k, o]) => [k, o.score]));
    const points = g.system === 'Points';
    const weighted = g.system === 'Weighted';
    const canEstimate = points || weighted;
    // Items Brightspace marks "not counted" join the totals when the student says so.
    const anyExcluded = g.groups.some((x) => x.items.some((i) => i.excluded));
    g.count_excluded = Boolean(settings.countExcluded);
    if (g.count_excluded || base.size) g.estimate = data.estimate(g, base);
    const inputs = () => new Map([...base, ...(whatIf.on ? whatIf.overrides : [])]);
    // In a course that counts an empty grade as 0, the total does too, unless the student
    // ticks "based only on graded assignments".
    // What-If always counts a blank grade as 0, so drop rules treat it like any other score.
    const allItems = (whatIf.on || (whatIf.allItems ?? g.null_is_zero)) && canEstimate;
    const totalBox = h('div', { class: 'totalbox' });
    // The same total above the table, shown instead of the sidebar's on narrow screens.
    const totalTop = h('div', { class: 'totalbox top' });
    const blank = g.null_is_zero ? '0' : '–';
    const scoreText = (v, i) => (v && v.score != null ? num(v.score) : i && outside.has(i.id) ? num(outside.get(i.id).score) : blank);
    function drawTotal() {
      const hyp = (whatIf.on && whatIf.overrides.size) || allItems ? data.estimate(g, inputs(), { allItems }) : null;
      const pair = (t) => (points ? h('div', { class: 'muted small' }, `${num(t.score)} / ${num(t.points_possible)} points`) : null);
      let kids;
      if (hyp) {
        const actual = g.final ? g.final.displayed || pct(g.final.score, g.final.points_possible) : g.estimate ? pct(g.estimate.score, g.estimate.points_possible) : 'not released';
        kids = [h('div', { class: 'tlabel' }, whatIf.on ? 'What-If Total' : g.null_is_zero ? 'Total (this course counts ungraded work as 0)' : 'Total, counting ungraded work as 0'), h('div', { class: 'bigscore hyp' }, pct(hyp.score, hyp.points_possible)), pair(hyp), h('div', { class: 'muted small' }, `Actual: ${actual}`)];
      } else if (g.final) {
        kids = [h('div', { class: 'tlabel' }, 'Total'), h('div', { class: 'bigscore' }, g.final.displayed || pct(g.final.score, g.final.points_possible) || '–'), g.final.points_possible ? h('div', { class: 'muted small' }, `${num(g.final.score)} / ${num(g.final.points_possible)}`) : null, h('div', { class: 'muted small' }, 'Released by the instructor')];
      } else if (g.estimate) {
        kids = [h('div', { class: 'tlabel' }, 'Total'), h('div', { class: 'bigscore' }, pct(g.estimate.score, g.estimate.points_possible)), pair(g.estimate), h('div', { class: 'muted small' }, 'Estimate from graded items, with dropped scores applied. Not official.')];
      } else {
        kids = [h('div', { class: 'tlabel' }, 'Total'), h('div', { class: 'muted' }, 'Not released by the instructor.')];
      }
      // Brightspace can apply calculations it does not show students (formulas, caps, attendance
      // rules), so an estimate here can be slightly off.
      if (!g.final && (hyp || g.estimate)) kids.push(h('div', { class: 'muted small tnote' }, 'Brightspace may apply calculations it doesn’t show students, so this can be slightly off. Your instructor’s gradebook and syllabus come first.'));
      totalBox.replaceChildren(...kids.filter(Boolean));
      totalTop.replaceChildren(...kids.filter(Boolean).map((n) => n.cloneNode(true)));
      markDropped();
      drawGroups();
    }
    // Scores a category's drop rule leaves out are struck through and tagged, as Canvas does.
    // Worked out again on every What-If change, since a new score can change what is dropped.
    const rowById = new Map();
    function markDropped() {
      const { dropped, marked } = data.dropInfo(g, inputs(), { allItems });
      for (const [itemId, tr] of rowById) {
        const on = dropped.has(itemId);
        tr.classList.toggle('dropped', on);
        const tag = tr.querySelector('.droptag');
        tag.hidden = !on;
        tag.title = marked.has(itemId) ? 'Dropped by Brightspace' : 'Dropped by this group’s rule (worked out here)';
      }
    }

    // Category rows follow What-If: kept points and the category's grade as the total uses it.
    const groupCells = [];
    function drawGroups() {
      const results = whatIf.on && canEstimate ? data.groupResults(g, inputs(), { allItems }) : null;
      for (const { group, cells, actual } of groupCells) {
        const r = results && results.get(group);
        const texts = r && r.computed ? [num(r.points), num(r.points_possible), pct(r.score, r.possible)] : actual;
        cells.forEach((c, n) => {
          c.textContent = texts[n];
          c.classList.toggle('hyp', Boolean(r && r.computed));
        });
      }
    }

    const rows = [];
    const flat = [];
    for (const group of g.groups) {
      if (group.name) {
        const v = group.value;
        const rule = data.dropRule(group);
        const ruleSpan = rule ? h('span', { class: 'muted small', style: 'font-weight:400' }, ` · ${rule}`) : null;
        const cells = [h('td', { class: 'num' }, v ? num(v.score) : ''), h('td', { class: 'num' }, v ? num(v.points_possible) : ''), h('td', { class: 'num' }, v ? pct(v.score, v.points_possible) : '')];
        groupCells.push({ group, cells, actual: cells.map((c) => c.textContent) });
        rows.push(h('tr', { class: 'grouprow' }, h('td', { colspan: '2' }, group.name, ruleSpan), ...cells));
      }
      for (const i of group.items) {
        const v = i.value;
        const a = byItem.get(String(i.id));
        const possible = v ? v.points_possible : i.points_possible;
        const pctCell = h('td', { class: 'num' }, v && v.score != null ? pct(v.score, v.points_possible) : outside.has(i.id) && possible > 0 ? pct(outside.get(i.id).score, possible) : (g.null_is_zero || (whatIf.on && data.estimable(g, i))) && possible > 0 ? '0%' : '');
        let scoreCell;
        if (whatIf.on && data.estimable(g, i)) {
          const input = h('input', { class: 'wi', type: 'number', min: '0', step: 'any', value: v && v.score != null ? String(v.score) : outside.has(i.id) ? String(+outside.get(i.id).score.toFixed(2)) : '0', 'aria-label': `What-If score for ${i.name}` });
          input.addEventListener('input', () => {
            const typed = input.value === '' ? null : Number(input.value);
            const valid = typed != null && Number.isFinite(typed);
            const changed = valid && typed !== (v ? v.score : null);
            if (changed) whatIf.overrides.set(i.id, typed);
            else whatIf.overrides.delete(i.id);
            input.classList.toggle('changed', changed);
            pctCell.textContent = valid ? pct(typed, possible) : '';
            drawTotal();
          });
          scoreCell = h('td', { class: 'num' }, input);
        } else if (whatIf.on) {
          // Locked in What-If: say why, so it is not a mystery.
          const why = data.whyNot(g, i) || 'Cannot be changed here';
          scoreCell = h('td', { class: 'num' }, h('span', { class: 'wilock', title: why, 'aria-label': `${why}. Score: ${scoreText(v, i)}` }, ic('lock', 13), ' ', scoreText(v, i)));
        } else {
          const ungraded = !v || v.score == null;
          scoreCell = h('td', { class: 'num' }, h('span', { title: ungraded ? (g.null_is_zero ? 'Not graded yet; this course counts it as 0' : 'Not graded yet') : v.displayed || null }, scoreText(v, i)));
        }
        flat.push({ i, a, el: null });
        rows.push(flat[flat.length - 1].el = h('tr', null,
          h('td', null, a ? h('a', { class: 't', href: itemHref(id, a) }, i.name) : h('span', { class: 't dark' }, i.name), i.bonus ? ui.tag('bonus') : null, i.excluded ? ui.tag('not counted') : null, a ? stateTag(id, a) : null, outside.has(i.id) ? h('span', { title: `Brightspace has not posted this score yet; this one is from ${outside.get(i.id).source}` }, ui.tag(`from ${outside.get(i.id).source}`)) : null, h('span', { class: 'droptag', hidden: true, title: 'Left out by this group’s drop rule' }, ui.tag('dropped')), v && v.comment ? h('div', { class: 'note' }, v.comment) : null),
          h('td', { class: 'muted small nowrap' }, a && a.due_at ? when(a.due_at) : ''),
          scoreCell,
          h('td', { class: 'num' }, num(possible)),
          pctCell));
        rowById.set(i.id, flat[flat.length - 1].el);
      }
    }
    drawTotal();
    // Arrange by group (with subtotals), or as one flat list by due date or title.
    const dueOf = (x) => (x.a && x.a.due_at ? Date.parse(x.a.due_at) : Infinity);
    const ordered = settings.gradeSort === 'due' ? flat.sort((x, y) => dueOf(x) - dueOf(y)).map((x) => x.el)
      : settings.gradeSort === 'title' ? flat.sort((x, y) => x.i.name.localeCompare(y.i.name, undefined, { numeric: true })).map((x) => x.el)
      : rows;
    const arrange = h('select', { class: 'txt pick', 'aria-label': 'Arrange by' }, [['group', 'Arrange by Assignment Group'], ['due', 'Arrange by Due Date'], ['title', 'Arrange by Title']].map(([k, label]) => h('option', { value: k, selected: (settings.gradeSort || 'group') === k }, label)));
    arrange.addEventListener('change', () => {
      settings.gradeSort = arrange.value;
      ui.saveSettings();
      ui.render();
    });
    const table = rows.length
      ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Due'), h('th', { class: 'num' }, 'Score'), h('th', { class: 'num' }, 'Out of'), h('th', { class: 'num' }, '%'))), h('tbody', null, ordered))
      : ui.empty('No grade items in this course.');

    const weights = weighted && g.groups.some((x) => x.name && x.weight != null)
      ? ui.sideSection('Assignments are weighted by group', h('table', { class: 'grid tight' }, h('thead', null, h('tr', null, h('th', null, 'Group'), h('th', { class: 'num' }, 'Weight'))), h('tbody', null, g.groups.filter((x) => x.name).map((x) => h('tr', null, h('td', null, x.name), h('td', { class: 'num' }, x.weight != null ? `${num(x.weight)}%` : ''))))))
      : null;
    return {
      body: [
        h('div', { class: 'dhead' }, h('h1', null, 'Grades'), h('div', { class: 'row' }, arrange, picker)),
        totalTop,
        whatIf.on ? h('div', { class: 'banner' }, weighted ? 'What-If scores: type a score to see the effect. In a weighted gradebook only graded items can be changed.' : 'What-If scores: type a score to see the effect, including for work that is not graded yet.') : null,
        table,
        gradescopeTable(course),
        h('p', { class: 'small' }, h('a', { href: bs.grades(id) }, 'Open Grades in Brightspace')),
      ],
      side: [
        totalBox,
        canEstimate ? ui.button(whatIf.on ? 'Revert to Actual Scores' : 'Show What-If Scores', () => { whatIf.on = !whatIf.on; whatIf.overrides = new Map(); ui.render(); }, 'wide') : null,
        canEstimate
          ? h('label', { class: 'calrow', style: anyExcluded ? null : 'margin-bottom:22px' }, h('input', { type: 'checkbox', checked: !allItems, disabled: whatIf.on, title: whatIf.on ? 'What-If counts blank grades as 0' : null, onchange: (ev) => { whatIf.allItems = !ev.target.checked; ui.render(); } }), 'Calculate based only on graded assignments')
          : null,
        canEstimate && anyExcluded
          ? h('label', { class: 'calrow', style: 'margin-bottom:22px', title: 'Brightspace leaves these out of its own total; some courses count them anyway' }, h('input', { type: 'checkbox', checked: g.count_excluded, onchange: (ev) => { settings.countExcluded = ev.target.checked; ui.saveSettings(); ui.render(); } }), 'Count items marked “not counted”')
          : null,
        weights,
        ui.lazy(data.externalTools(id), (tools) => tools.length ? ui.sideSection('Graded elsewhere', [h('p', { class: 'muted small' }, 'Some work in this course is graded in an external tool and may not appear here.'), tools.map((t) => h('a', { class: 'sidelink', href: courseHref(id, 'modules', t.id) }, t.title, ' ', ic('external', 13)))]) : null, ''),
      ],
    };
  }

  // ---- people, files, syllabus ---------------------------------------------------
  async function people(course) {
    const list = await data.people(course.id);
    if (!list.length) return { body: [ui.empty('The class list is not available for this course.'), h('a', { href: bs.classlist(course.id) }, 'Open Classlist in Brightspace')] };
    const rows = list.map((p) => [h('tr', null, h('td', null, h('span', { class: 'avatar sm' }, (p.name || '?').slice(0, 1).toUpperCase()), ' ', h('span', { class: 't dark' }, p.name)), h('td', null, p.role)), `${p.name} ${p.role}`]);
    const count = h('span', { class: 'muted small' }, `${list.length} people`);
    return {
      body: [
        h('div', { class: 'toolbar' }, ui.filterBox('Search people', rows, (n) => (count.textContent = `${n} of ${list.length} people`)), count),
        h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Role'))), h('tbody', null, rows.map((x) => x[0]))),
      ],
    };
  }

  async function files(course) {
    const list = await data.files(course.id);
    if (!list.length) return { body: ui.empty('No files in this course.') };
    const rows = list.map((f) => [h('tr', null, h('td', null, ic('file', 18), ' ', h('a', { href: courseHref(course.id, 'modules', f.id) }, f.title)), h('td', { class: 'muted' }, f.module), h('td', { class: 'muted small nowrap' }, f.updated_at ? ui.fmt.short.format(new Date(f.updated_at)) : '')), `${f.title} ${f.module}`]);
    return {
      body: [
        h('div', { class: 'toolbar' }, ui.filterBox('Search files', rows)),
        h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Module'), h('th', null, 'Date Modified'))), h('tbody', null, rows.map((x) => x[0]))),
      ],
    };
  }

  async function syllabus(course) {
    const [s, work, fileList, tool] = await Promise.all([data.syllabus(course.id).catch(() => null), data.assignments(course.id).catch(() => []), data.files(course.id).catch(() => []), data.syllabusLink(course.id).catch(() => null)]);
    const docs = fileList.filter((f) => /syllabus|schedule/i.test(f.title));
    const dated = work.filter((a) => a.due_at).sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
    const launch = tool ? ui.safeHref(tool.url) : null;
    const overview = s && (s.html || s.text) ? prose(s.html, s.text) : null;
    return {
      body: [
        h('div', { class: 'dhead' }, h('h1', null, 'Course Syllabus'), launch ? h('a', { class: 'btn', href: launch, target: '_blank', rel: 'noopener' }, 'Open in a new tab ', ic('external', 14)) : null),
        // The school's syllabus tool (Simple Syllabus at Purdue), shown in place.
        launch ? h('iframe', { class: 'viewer', src: launch, title: tool.title || 'Syllabus', referrerpolicy: 'same-origin' }) : null,
        overview ? [launch ? h('h2', { class: 'sect' }, 'Course overview') : null, overview] : launch ? null : h('p', { class: 'muted' }, 'This course has no syllabus tool or overview text in Brightspace.'),
        docs.length ? [h('h2', { class: 'sect' }, 'Syllabus files'), h('ul', { class: 'filelist' }, docs.map((f) => h('li', null, ic('file', 16), ' ', h('a', { href: courseHref(course.id, 'modules', f.id) }, f.title))))] : null,
        h('h2', { class: 'sect' }, 'Course Summary'),
        dated.length
          ? h('table', { class: 'grid' }, h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Details'), h('th', { class: 'num' }, 'Due'))),
              h('tbody', null, dated.map((a) => h('tr', null, h('td', { class: 'nowrap' }, ui.fmt.short.format(new Date(a.due_at))), h('td', null, h('span', { class: 'iic ok inline' }, ic(KIND[a.kind].icon, 18)), ' ', h('a', { href: itemHref(course.id, a) }, a.name)), h('td', { class: 'num muted small' }, `due by ${ui.fmt.time.format(new Date(a.due_at))}`)))))
          : ui.empty('No dated work in this course.'),
      ],
      side: ui.todoSide([course], { labels: false, gradesHref: courseHref(course.id, 'grades'), only: course.id }),
    };
  }

  // ---- dispatcher ------------------------------------------------------------------
  const SECTION = {
    home,
    announcements,
    assignments: (c, r) => (r.itemId != null ? assignmentDetail(c, r) : workList(c, null)),
    quizzes: (c, r) => (r.itemId != null ? quizDetail(c, r) : workList(c, 'quiz')),
    discussions: (c, r) => (r.itemId != null ? discussionDetail(c, r) : workList(c, 'discussion')),
    grades,
    people,
    files,
    syllabus,
    modules,
    // Canvas's "View Course Stream": this course's recent announcements and grades.
    stream: async (c) => ({ body: ui.activityView([c]) }),
  };
  const CRUMB = { ...LABEL, stream: 'Recent Activity' };

  ui.views.course = async (r) => {
    const courses = await data.courses();
    const course = courses.find((c) => c.id === r.courseId);
    if (!course) return { title: 'Course not found', body: [ui.empty('That course is not in your course list.'), h('a', { href: '#/' }, 'Back to the Dashboard')] };
    const out = await SECTION[r.section](course, r);
    const crumbs = [{ label: nameOf(course), href: courseHref(course.id) }];
    if (r.section !== 'home') crumbs.push({ label: CRUMB[r.section], href: courseHref(course.id, r.section) });
    if (out.crumb) crumbs.push({ label: out.crumb });
    return { crumbs, leftNav: courseNav(course, r.section), body: out.body, side: out.side, actions: out.actions };
  };
})();

// Layer 3, part 2: dashboard (card, list and activity views), all courses, all grades.
(() => {
  const ui = BSX.ui;
  if (!ui) return;
  const { data } = BSX;
  const { h, ic, settings, state, colorOf, nameOf, when, num, pct, courseHref, itemHref, COLORS } = ui;
  const KIND_ICON = { assignment: 'assignment', quiz: 'quiz', discussion: 'discussion', todo: 'note', external: 'external' };
  let editing = null; // id of the course card whose nickname and colour are being edited
  let listSeen = false; // the list view scrolls to today once per visit
  window.addEventListener('hashchange', () => (listSeen = false));

  // ---- sidebar shared by the dashboard and course home ----------------------
  const titleOf = (i, courses) => ui.itemLink(i, courses);
  const tint = (id) => (id == null ? 'var(--muted)' : colorOf(id));

  function todoRow(i, courseLabel, late, courses) {
    const points = i.points_possible != null ? `${num(i.points_possible)} points · ` : '';
    return h('div', { class: 'todo' },
      h('span', { class: 'todoic', style: `color:${tint(i.course_id)}` }, ic(KIND_ICON[i.kind] || 'assignment')),
      h('div', { class: 'tmid' },
        titleOf(i, courses),
        courseLabel ? h('div', { class: 'ctx', style: `--c:${tint(i.course_id)}` }, courseLabel) : null,
        h('div', { class: late ? 'm bad' : 'm' }, late ? `Overdue · was due ${when(i.due_at)}` : `${points}${when(i.due_at)}`)),
      h('button', { class: 'iconbtn xs', type: 'button', title: 'Dismiss', 'aria-label': `Dismiss ${i.name || i.title}`, onclick: () => ui.setFlag('dismissed', i, true) }, ic('close', 14)));
  }

  // To Do (overdue first), Recent Feedback, and a grades button.
  // With `only`, the lists are limited to that one course (used on course pages).
  ui.todoSide = (courseList, { labels = true, gradesHref = '#/grades', only = null } = {}) => {
    const ids = new Set(courseList.map((c) => c.id));
    const names = new Map(courseList.map((c) => [c.id, nameOf(c)]));
    const label = (id) => (labels ? (id == null ? 'My To Do' : names.get(id) || '') : '');
    const now = Date.now();
    const open = (i) => !ui.isDone(i) && !ui.isDismissed(i) && (only == null || i.course_id === only);
    const mine = ui.personalItems(now - 60 * ui.DAY, now + 14 * ui.DAY, null).filter(open);
    // Outside work counts as to-do while it has no submission; two weeks back for overdue.
    const outside = ui.externalWork(courseList).then((items) => items.filter((i) => i.due_at && !i.submitted && !i.grade && Date.parse(i.due_at) >= now - 14 * ui.DAY && Date.parse(i.due_at) <= now + 14 * ui.DAY)).catch(() => []);
    const todo = Promise.all([data.todo(courseList), data.overdue().catch(() => []), outside]).then(([upcoming, late, ext]) => [
      [...upcoming, ...ext.filter((i) => Date.parse(i.due_at) >= now)],
      [...late, ...ext.filter((i) => Date.parse(i.due_at) < now)],
    ]);
    const add = h('button', { class: 'iconbtn xs', type: 'button', title: 'Add To Do', 'aria-label': 'Add To Do', onclick: () => ui.todoDialog(null, courseList) }, ic('plus', 16));
    return [
      ui.sideSection(['To Do', add], ui.lazy(todo, ([upcoming, late]) => {
        const lateRows = [...late.filter((i) => ids.has(i.course_id)), ...mine.filter((i) => Date.parse(i.due_at) < now)].filter(open).slice(0, 6).map((i) => todoRow(i, label(i.course_id), true, courseList));
        const coming = [...upcoming, ...mine.filter((i) => Date.parse(i.due_at) >= now)].filter(open).sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
        const rows = coming.slice(0, 8).map((i) => todoRow(i, label(i.course_id), false, courseList));
        const more = coming.length > 8 ? h('div', { class: 'muted small pad' }, `${coming.length - 8} more`) : null;
        return [lateRows, rows, more];
      }, 'Loading…')),
      ui.sideSection('Recent Feedback', ui.lazy(data.recentFeedback(courseList), (rows) =>
        rows.slice(0, 5).map((f) => h('div', { class: 'todo' },
          h('span', { class: 'todoic ok' }, ic('check')),
          h('div', { class: 'tmid' },
            h('a', { class: 't', href: courseHref(f.course_id, 'grades') }, f.title),
            labels ? h('div', { class: 'ctx', style: `--c:${colorOf(f.course_id)}` }, names.get(f.course_id) || '') : null,
            h('div', { class: 'm' }, `${num(f.grade.score)} out of ${num(f.grade.points_possible)}`),
            f.grade.comment ? h('div', { class: 'm quote' }, `“${ui.clip(f.grade.comment, 90)}”`) : null))))),
      ui.linkButton('View Grades', gradesHref, 'wide'),
    ];
  };

  // ---- cards ---------------------------------------------------------------
  function cardEditor(c) {
    const saved = settings.courses[c.id] || {};
    let color = COLORS.includes(saved.color) ? saved.color : null;
    const nick = h('input', { class: 'txt', type: 'text', maxlength: '60', value: saved.nickname || '', placeholder: c.name });
    const swatches = COLORS.map((col) => h('button', { class: 'sw', type: 'button', style: `background:${col}`, 'aria-label': `Colour ${col}`, onclick: () => { color = col; mark(); } }));
    const mark = () => swatches.forEach((b, i) => b.classList.toggle('on', COLORS[i] === (color || colorOf(c.id))));
    mark();
    const done = (next) => {
      if (next && Object.keys(next).length) settings.courses[c.id] = next;
      else delete settings.courses[c.id];
      ui.saveSettings();
      editing = null;
      ui.render();
    };
    const save = () => {
      const next = {};
      if (nick.value.trim()) next.nickname = nick.value.trim();
      if (color) next.color = color;
      done(next);
    };
    nick.addEventListener('keydown', (ev) => ev.key === 'Enter' && save());
    return h('div', { class: 'edit' },
      h('label', null, 'Nickname', nick),
      h('label', null, 'Colour', h('div', { class: 'swatches' }, swatches)),
      h('div', { class: 'row' }, ui.button('Apply', save, 'primary'), ui.button('Reset', () => done(null)), ui.button('Cancel', () => { editing = null; ui.render(); })));
  }

  function card(c) {
    const img = h('img', { src: c.image_url, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => img.remove());
    const name = nameOf(c);
    const badge = (pick) => {
      const b = h('span', { class: 'badge', hidden: true });
      data.updates(c.id).then((u) => {
        const n = pick(u);
        if (n > 0) {
          b.textContent = n > 99 ? '99+' : String(n);
          b.hidden = false;
        }
      }).catch(() => {});
      return b;
    };
    const action = (section, icon, label, pick) => h('a', { class: 'cardic', href: courseHref(c.id, section), title: label, 'aria-label': `${label} - ${name}` }, ic(icon, 22), pick ? badge(pick) : null);
    const body = editing === c.id
      ? cardEditor(c)
      : [
          h('a', { class: 'text', href: courseHref(c.id), title: name === c.name ? name : `${name} (${c.name})` }, h('span', { class: 'name', style: `--c:${colorOf(c.id)}` }, name), h('span', { class: 'code' }, c.course_code)),
          h('div', { class: 'cardics' },
            action('announcements', 'announcement', 'Announcements'),
            action('assignments', 'assignment', 'Assignments', (u) => u.feedback),
            action('discussions', 'discussion', 'Discussions', (u) => u.discussions),
            action('files', 'file', 'Files')),
        ];
    return h('div', { class: 'card' },
      h('a', { class: 'hero', href: courseHref(c.id), style: `background:${colorOf(c.id)}`, 'aria-label': name }, img),
      h('button', { class: 'more', type: 'button', title: 'Nickname and colour', 'aria-label': `Nickname and colour for ${name}`, onclick: () => { editing = editing === c.id ? null : c.id; ui.render(); } }, ic('dots', 20)),
      body);
  }

  // ---- list view (planner) ---------------------------------------------------
  function listView(courses) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const names = new Map(courses.map((c) => [c.id, nameOf(c)]));
    const from = start.getTime() - 7 * ui.DAY;
    const to = start.getTime() + 28 * ui.DAY;
    const outside = ui.externalWork(courses).then((list) => list.filter((i) => i.due_at && Date.parse(i.due_at) >= from && Date.parse(i.due_at) <= to)).catch(() => []);
    return ui.lazy(Promise.all([data.planner(courses, from, to), outside]), ([fetched, ext]) => {
      const items = [...fetched, ...ext, ...ui.personalItems(from, to, null)].sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
      if (!items.length) return ui.empty('Nothing due in the last week or the next four.');
      const days = new Map();
      for (const i of items) {
        const d = new Date(i.due_at);
        const k = ui.dayKey(d);
        if (!days.has(k)) days.set(k, { date: d, items: [] });
        days.get(k).items.push(i);
      }
      const todayKey = ui.dayKey(new Date());
      const tomorrowKey = ui.dayKey(new Date(Date.now() + ui.DAY));
      const sections = [...days.entries()].map(([k, day]) =>
        h('section', { class: k === todayKey ? 'pday today' : 'pday', 'data-at': String(day.date.getTime()) },
          h('h2', null, k === todayKey ? 'Today' : k === tomorrowKey ? 'Tomorrow' : ui.fmt.day.format(day.date), k === todayKey || k === tomorrowKey ? h('span', { class: 'muted' }, ` ${ui.fmt.day.format(day.date)}`) : null),
          day.items.map((i) => {
            const settled = Boolean(i.grade) || Boolean(i.submitted); // Brightspace or the outside tool already says so
            const done = settled || ui.isDone(i);
            // Ticking updates this row only; the rest of the page stays as it is.
            const check = h('button', { class: done ? 'pcheck done' : 'pcheck', type: 'button', disabled: settled, title: i.grade ? 'Graded' : i.submitted ? 'Submitted' : done ? 'Marked done. Click to undo' : 'Mark as done', 'aria-label': `${done ? 'Done' : 'Not done'}: ${i.name}`, onclick: () => {
              const now = !ui.isDone(i);
              ui.setFlag('done', i, now, { quiet: true });
              check.classList.toggle('done', now);
              check.replaceChildren(...(now ? [ic('check', 14)] : []));
              check.title = now ? 'Marked done. Click to undo' : 'Mark as done';
              check.setAttribute('aria-label', `${now ? 'Done' : 'Not done'}: ${i.name}`);
              rowEl.classList.toggle('isdone', now);
            } }, done ? ic('check', 14) : null);
            const rowEl = h('div', { class: done ? 'prow isdone' : 'prow', style: `--c:${tint(i.course_id)}` },
              check,
              h('span', { class: 'pic' }, ic(KIND_ICON[i.kind] || 'assignment', 22)),
              h('div', { class: 'pmid' }, h('div', { class: 'ctx' }, i.course_id == null ? 'My To Do' : names.get(i.course_id) || ''), titleOf(i, courses)),
              i.source ? ui.tag(i.source) : null,
              i.grade ? ui.tag('Graded', 'okt') : i.submitted ? ui.tag('Submitted', 'okt') : null,
              h('div', { class: 'pend' }, i.grade ? h('div', null, `${num(i.grade.score)} / ${num(i.grade.points_possible)}`) : i.points_possible != null ? h('div', null, `${num(i.points_possible)} pts`) : null, h('div', { class: 'muted' }, `${i.personal ? '' : 'Due '}${ui.fmt.time.format(new Date(i.due_at))}`)));
            return rowEl;
          })));
      // Open on today (or the next day with work), the way a planner does.
      if (!listSeen) {
        listSeen = true;
        const target = sections.find((s) => Number(s.dataset.at) >= start.getTime());
        if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 0);
      }
      return sections;
    });
  }

  // ---- recent activity -------------------------------------------------------
  function activityView(courses) {
    const names = new Map(courses.map((c) => [c.id, nameOf(c)]));
    const since = Date.now() - 21 * ui.DAY;
    return ui.lazy(Promise.all([data.recentAnnouncements(courses, 21), data.recentFeedback(courses, 21), ui.outsideAnnouncements(courses)]), ([news, feedback, eds]) => {
      const rows = [
        ...news.map((a) => ({ at: a.posted_at, icon: 'announcement', title: a.title, href: courseHref(a.course_id, 'announcements', a.id), course: a.course_id, kind: 'Announcement', text: ui.clip(ui.plainOf(a.message_html, a.message), 160) })),
        ...eds.filter((a) => a.posted_at && Date.parse(a.posted_at) >= since).map((a) => ({ at: a.posted_at, icon: 'announcement', title: a.title, href: a.html_url, external: true, course: a.course_id, kind: 'Ed announcement', text: ui.clip(a.message, 160) })),
        ...feedback.map((f) => ({ at: f.grade.graded_at, icon: 'check', title: f.title, href: courseHref(f.course_id, 'grades'), course: f.course_id, kind: 'Grade', text: `${num(f.grade.score)} out of ${num(f.grade.points_possible)}${f.grade.comment ? ` · ${ui.clip(f.grade.comment, 100)}` : ''}` })),
      ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (!rows.length) return ui.empty('No recent announcements or grades.');
      return h('div', { class: 'stream' }, rows.map((r) => h('div', { class: 'srow' },
        h('span', { class: 'todoic', style: `color:${colorOf(r.course)}` }, ic(r.icon, 22)),
        h('div', { class: 'pmid' }, h('div', { class: 'ctx', style: `--c:${colorOf(r.course)}` }, `${r.kind} · ${names.get(r.course) || ''}`), r.external ? h('a', { class: 't', href: r.href, target: '_blank', rel: 'noopener noreferrer' }, r.title, ' ', ic('external', 12)) : h('a', { class: 't', href: r.href }, r.title), r.text ? h('div', { class: 'muted small' }, r.text) : null),
        h('div', { class: 'muted small nowrap' }, when(r.at)))));
    });
  }

  ui.activityView = activityView; // also a course's own Recent Activity

  // ---- Tasks panel ---------------------------------------------------------
  // A week of work in the sidebar, after the open-source Tasks for Canvas extension
  // (MIT, github.com/jtcheng26/canvas-task-extension), rebuilt here on Brightspace data: a
  // progress bar per course, then Unfinished and Completed lists. Work counts as done
  // once it is graded above zero, handed in, attempted, posted in or ticked off.
  // `week` is the step from now (a week, or three days); `all`: list shown in full past the length limit.
  const taskView = { week: 0, tab: 'unfinished', all: false };
  function weekRange(offset) {
    const now = new Date();
    if (settings.threeDay) {
      // Three days starting today.
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 3);
      return [from, new Date(from.getFullYear(), from.getMonth(), from.getDate() + 3)];
    }
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return [start, end];
  }

  // Concentric progress rings drawn in SVG. rings: [{ value 0..1, color, label }].
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  // `prev`: each ring's last value, so a repaint moves the ring from there rather than from empty.
  function ringChart(rings, big, small, prev = []) {
    const size = 150;
    const gap = 2;
    const hole = 38; // radius kept clear for the percentage in the middle
    const width = Math.max(4, Math.min(11, (size / 2 - hole) / Math.max(rings.length, 1) - gap));
    const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'tkrings', role: 'img', 'aria-label': `${big} done this week` });
    rings.forEach((r, i) => {
      const radius = size / 2 - width / 2 - i * (width + gap) - 1;
      if (radius < hole) return; // too many courses for another ring; the legend still lists it
      const length = 2 * Math.PI * radius;
      const track = svg('circle', { cx: size / 2, cy: size / 2, r: radius, fill: 'none', 'stroke-width': width, class: 'tktrack' });
      const fill = svg('circle', { cx: size / 2, cy: size / 2, r: radius, fill: 'none', stroke: r.color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-dasharray': `${length}`, 'stroke-dashoffset': `${length * (1 - Math.min(1, prev[i] || 0))}`, transform: `rotate(-90 ${size / 2} ${size / 2})`, class: 'tkarc' });
      const title = svg('title', {});
      title.textContent = r.label;
      fill.append(title);
      root.append(track, fill);
      // Start empty, then fill, so the rings sweep round when they appear.
      requestAnimationFrame(() => requestAnimationFrame(() => fill.setAttribute('stroke-dashoffset', `${length * (1 - Math.min(1, r.value))}`)));
    });
    return h('div', { class: 'tkchart' }, root, h('div', { class: 'tkcenter' }, h('span', { class: 'tkbig' }, big), h('span', { class: 'muted small' }, small)));
  }

  // Confetti for a finished week, drawn by canvas-confetti (vendor/, ISC licence by Kiril
  // Vatev) on a canvas inside the wrapper: a cannon on each side firing a couple of pieces
  // every frame for 5 seconds, in the given (course) colours. No worker (the page's policy
  // may refuse one), and nothing at all when reduced motion is asked for.
  function confetti(colors = COLORS.slice(0, 4)) {
    const app = ui.appEl();
    if (!app || typeof globalThis.confetti?.create !== 'function') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
    app.append(canvas);
    const fire = globalThis.confetti.create(canvas, { resize: true, useWorker: false });
    const end = Date.now() + 5 * 1000;
    const frame = () => {
      fire({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors });
      fire({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end && canvas.isConnected) requestAnimationFrame(frame);
      else setTimeout(() => canvas.remove(), 4000); // let the last pieces land
    };
    frame();
  }

  ui.confetti = confetti; // also fired by the dev server's "fx:confetti" step, for checking

  function tasksPanel(courses) {
    const [start, end] = weekRange(taskView.week);
    const unit = settings.threeDay ? 'days' : 'week';
    const label = settings.threeDay
      ? taskView.week === 0 ? 'Next 3 days' : `${ui.fmt.short.format(start)} – ${ui.fmt.short.format(new Date(end - 1))}`
      : taskView.week === 0 ? 'This week' : taskView.week === -1 ? 'Last week' : taskView.week === 1 ? 'Next week' : `${ui.fmt.short.format(start)} – ${ui.fmt.short.format(new Date(end - 1))}`;
    const shift = (d) => () => { taskView.week += d; taskView.all = false; ui.render(); };
    const head = h('div', { class: 'tkhead' },
      h('button', { class: 'iconbtn xs', type: 'button', 'aria-label': `Previous ${unit === 'week' ? 'week' : '3 days'}`, onclick: shift(-1) }, ic('left', 16)),
      h('span', { class: 'tkweek' }, label),
      h('button', { class: 'iconbtn xs', type: 'button', 'aria-label': `Next ${unit === 'week' ? 'week' : '3 days'}`, onclick: shift(1) }, ic('right', 16)));
    const add = h('button', { class: 'iconbtn xs', type: 'button', title: 'Add task', 'aria-label': 'Add task', onclick: () => ui.todoDialog(null, courses) }, ic('plus', 16));

    // `base`: done according to Brightspace or the outside site; `done` adds the student's ticks.
    const mine = ui.personalItems(start.getTime(), end.getTime(), null).map((t) => ({ ...t, base: false, done: ui.isDone(t) }));
    const outside = ui.externalWork(courses).then((items) => items.filter((i) => i.due_at && Date.parse(i.due_at) >= start && Date.parse(i.due_at) < end).map((i) => ({ ...i, base: Boolean(i.submitted || i.grade), done: Boolean(i.submitted || i.grade) || ui.isDone(i) }))).catch(() => []);
    const all = Promise.all([data.tasks(courses, start.getTime(), end.getTime() - 1), outside]).then(([work, ext]) =>
      [...work.map((a) => ({ ...a, base: a.done, done: a.done || ui.isDone(a) })), ...ext, ...mine].filter((i) => !ui.isDismissed(i)).sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at)));

    // Ticking a task or switching tabs repaints this panel only, from the week's data
    // already loaded, so the rest of the page is left alone. The rings move from their last
    // value instead of refilling from empty.
    let items = [];
    let lastRings = [];
    const panel = h('div');
    const repaint = () => panel.replaceChildren(...[paint(items)].flat(Infinity).filter(Boolean));
    const body = ui.lazy(all, (list) => {
      items = list;
      repaint();
      return panel;
    });
    function paint(items) {
      // One bar per course with work this week, in the course's colour.
      const byCourse = new Map();
      for (const i of items) {
        const k = i.course_id ?? 0;
        if (!byCourse.has(k)) byCourse.set(k, { done: 0, total: 0 });
        const c = byCourse.get(k);
        c.total++;
        if (i.done) c.done++;
      }
      const names = new Map(courses.map((c) => [c.id, nameOf(c)]));
      const done = items.filter((i) => i.done).length;
      // Every task of the week done: confetti, once per week (remembered in preferences).
      const weekKey = ui.dayKey(start);
      if (items.length && done === items.length && !(settings.confetti || {})[weekKey]) {
        settings.confetti = { [weekKey]: 1 }; // only the latest week is kept
        ui.saveSettings();
        // In the colours of the courses that had work this week.
        const tint = [...byCourse.keys()].map((id) => (id ? colorOf(id) : null)).filter(Boolean);
        setTimeout(() => confetti(tint.length ? tint : undefined), 300);
      }
      // Concentric rings, one per course (outermost first), each filled by the share done.
      const entries = [...byCourse.entries()];
      const ringValues = entries.map(([, c]) => (c.total ? c.done / c.total : 0));
      const rings = ringChart(entries.map(([id, c], n) => ({ value: ringValues[n], color: id ? colorOf(id) : 'var(--muted)', label: `${id ? names.get(id) || '' : 'My tasks'}: ${c.done} of ${c.total} done` })),
        items.length ? `${Math.round((done / items.length) * 100)}%` : '–', items.length ? `${done}/${items.length}` : 'none due', lastRings);
      lastRings = ringValues;
      const legend = h('div', { class: 'tklegend' }, entries.map(([id, c]) => h('div', { class: 'tkkey' },
        h('span', { class: 'dot', style: `background:${id ? colorOf(id) : 'var(--muted)'}` }),
        h('span', { class: 'tkname' }, id ? names.get(id) || '' : 'My tasks'),
        h('span', { class: 'muted small' }, `${c.done}/${c.total}`))));

      const list = items.filter((i) => (taskView.tab === 'completed' ? i.done : !i.done));
      const tab = (key, text, n) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(taskView.tab === key), class: taskView.tab === key ? 'on' : null, onclick: () => { taskView.tab = key; repaint(); } }, `${text} (${n})`);
      const row = (i) => {
        const late = !i.done && Date.parse(i.due_at) < Date.now();
        const tick = h('button', { class: i.done ? 'pcheck done' : 'pcheck', type: 'button', 'aria-pressed': String(i.done), 'aria-label': i.done ? `Mark ${i.name || i.title} not done` : `Mark ${i.name || i.title} done`, onclick: () => {
          const now = !i.done;
          ui.setFlag('done', i, now, { quiet: true });
          i.done = i.base || now;
          repaint();
        } }, i.done ? ic('check', 14) : null);
        return h('div', { class: 'tkrow', style: `--c:${i.course_id == null ? 'var(--muted)' : colorOf(i.course_id)}` },
          tick,
          h('div', { class: 'tmid' }, ui.itemLink(i, courses), h('div', { class: 'ctx', style: `--c:${i.course_id == null ? 'var(--muted)' : colorOf(i.course_id)}` }, i.course_id == null ? 'My task' : names.get(i.course_id) || ''),
            h('div', { class: late ? 'm bad' : 'm' }, [late ? 'Missing · ' : '', ui.when(i.due_at), gradeText(i) || (i.points_possible != null ? ` · ${num(i.points_possible)} pts` : '')].join(''))));
      };
      // A graded item shows its score on the Completed tab: " · 18 / 20 pts".
      const gradeText = (i) => (i.done && i.grade && i.grade.score != null ? ` · ${num(i.grade.score)}${i.grade.points_possible > 0 ? ` / ${num(i.grade.points_possible)}` : ''} pts` : '');
      // The list-length setting; "Show N more" opens the rest.
      const limit = settings.taskLimit || 0;
      const shown = limit && !taskView.all ? list.slice(0, limit) : list;
      const more = list.length > shown.length ? h('button', { class: 'btn small', type: 'button', onclick: () => { taskView.all = true; repaint(); } }, `Show ${list.length - shown.length} more`) : null;
      return [
        h('div', { class: 'tkprog' }, rings, legend),
        h('div', { class: 'seg tktabs', role: 'tablist' }, tab('unfinished', 'Unfinished', items.length - done), tab('completed', 'Completed', done)),
        list.length ? [shown.map(row), more] : h('div', { class: 'muted small pad' }, taskView.tab === 'completed' ? `Nothing finished yet ${settings.threeDay ? 'in these days' : 'this week'}.` : `All done for ${settings.threeDay ? 'these days' : 'this week'}.`),
      ];
    }
    // The panel's own options, beside the plus: view, list length and clock.
    const options = ui.menu('Task options', [
      { label: 'Three-Day View', on: Boolean(settings.threeDay), onclick: () => { settings.threeDay = !settings.threeDay; taskView.week = 0; taskView.all = false; ui.saveSettings(); ui.render(); } },
      null,
      ...[[0, 'Show All Tasks'], [10, 'Show 10 Tasks'], [5, 'Show 5 Tasks']].map(([n, text]) => ({ label: text, on: (settings.taskLimit || 0) === n, onclick: () => { settings.taskLimit = n; taskView.all = false; ui.saveSettings(); ui.render(); } })),
    ]);
    return ui.sideSection(['Tasks', h('span', { class: 'tkact' }, add, options)], [head, body]);
  }

  // ---- pages ---------------------------------------------------------------
  ui.views.dashboard = async () => {
    const courses = await data.courses();
    const focus = ui.focusCourses(courses);
    const visible = state.showAll ? courses : focus;
    const mode = settings.dash;
    // Canvas's "Dashboard Options" menu: the three views, and the colour overlay on cards.
    const pick = (key, label) => ({ label, on: mode === key, onclick: () => { settings.dash = key; listSeen = false; ui.saveSettings(); ui.render(); } });
    const overlay = settings.overlay !== false;
    const actions = [
      h('button', { class: 'btn', type: 'button', title: 'Search all courses (s)', onclick: () => ui.searchDialog() }, ic('search', 16), 'Search'),
      h('button', { class: 'btn', type: 'button', onclick: () => ui.todoDialog(null, visible) }, ic('plus', 16), 'To Do'),
      ui.menu('Dashboard Options', [
        { label: 'Tasks Panel', on: Boolean(settings.tasks), onclick: () => { settings.tasks = !settings.tasks; ui.saveSettings(); ui.render(); } },
        { label: '24-Hour Clock', on: Boolean(settings.clock24), onclick: () => { settings.clock24 = !settings.clock24; ui.applyClock(); ui.saveSettings(); ui.render(); } },
        null,
        pick('cards', 'Card View'), pick('list', 'List View'), pick('activity', 'Recent Activity'),
        mode === 'cards' ? null : undefined,
        mode === 'cards' ? { label: 'Color Overlay', on: overlay, onclick: () => { settings.overlay = !overlay; ui.saveSettings(); ui.render(); } } : undefined,
        // Brightspace course images are wide banners; wide cards show them uncropped.
        mode === 'cards' ? { label: 'Wide Cards', on: Boolean(settings.wideCards), onclick: () => { settings.wideCards = !settings.wideCards; ui.saveSettings(); ui.render(); } } : undefined,
      ].filter((x) => x !== undefined)),
    ];
    const toggle = focus.length < courses.length
      ? h('div', { class: 'small', style: 'margin-top:20px' }, h('a', { href: '#/', onclick: (ev) => { ev.preventDefault(); settings.showAll = state.showAll = !state.showAll; ui.saveSettings(); ui.render(); } }, state.showAll ? 'Show current courses only' : `Show all ${courses.length} courses`))
      : null;

    let body;
    if (mode === 'list') body = listView(visible);
    else if (mode === 'activity') body = activityView(visible);
    else body = visible.length ? h('div', { class: 'cards' }, visible.map(card)) : ui.empty('No current courses found.');
    // With the Tasks panel on, it takes the To Do list's place at the top of the sidebar.
    const side = mode === 'list' ? null : settings.tasks ? [tasksPanel(visible), ...ui.todoSide(visible).slice(1)] : ui.todoSide(visible);
    return { title: 'Dashboard', actions, body: [body, toggle], side };
  };

  ui.views.courses = async () => {
    const courses = await data.courses();
    const table = (list) => h('table', { class: 'grid' },
      h('thead', null, h('tr', null, h('th', null, 'Course'), h('th', null, 'Nickname'), h('th', null, 'Code'))),
      h('tbody', null, list.map((c) => h('tr', null,
        h('td', null, h('span', { class: 'dot', style: `background:${colorOf(c.id)}` }), ' ', h('a', { href: courseHref(c.id) }, c.name)),
        h('td', null, settings.courses[c.id]?.nickname || ''),
        h('td', { class: 'muted' }, c.course_code)))));
    const term = courses.filter((c) => c.current_term);
    const other = courses.filter((c) => !c.current_term);
    return {
      title: 'All Courses',
      body: [
        term.length ? [h('h2', { class: 'sect' }, 'This term'), table(term)] : null,
        other.length ? [h('h2', { class: 'sect' }, term.length ? 'Other courses' : 'Courses'), table(other)] : null,
        courses.length ? null : ui.empty('No courses found.'),
      ],
    };
  };

  // ---- search across every course ------------------------------------------------
  // One list of everything searchable in the student's current courses: module entries,
  // assignments, quizzes, discussion topics, announcements, and outside work. Built from data
  // the wrapper already caches, so a second search is instant.
  const LINKED = new Set(['File', 'Link', 'External tool', 'Module overview']); // open in the module viewer
  // Short labels for module entry kinds; Brightspace's internal ones ("ContentService") read as "Content".
  const KIND_LABEL = { 'Module overview': 'Module', 'External tool': 'Tool', File: 'File', Link: 'Link', Assignment: 'Assignment', Quiz: 'Quiz', Discussion: 'Discussion', 'Course home': 'Course', Syllabus: 'Syllabus' };
  const kindLabel = (type) => KIND_LABEL[type] || 'Content';
  async function searchIndex() {
    const courses = ui.focusCourses(await data.courses());
    const per = await Promise.all(courses.map(async (c) => {
      const [mods, work, news] = await Promise.all([data.modules(c.id).catch(() => []), data.assignments(c.id).catch(() => []), data.announcements(c.id).catch(() => [])]);
      const course = nameOf(c);
      // A module entry that is the same assignment, quiz or discussion as one in the work
      // list is listed once, as the work item (it has the due date).
      const workKeys = new Set(work.map((a) => `${a.kind}:${a.name.trim().toLowerCase()}`));
      const dup = (i) => workKeys.has(`${String(i.type).toLowerCase()}:${String(i.title).trim().toLowerCase()}`);
      return [
        ...mods.flatMap((m) => m.items.filter((i) => !dup(i)).map((i) => ({ title: i.title, kind: kindLabel(i.type), where: `${course} · ${m.name}`, course: c.id, href: LINKED.has(i.type) ? courseHref(c.id, 'modules', i.id) : i.html_url, text: `${i.title} ${m.name}` }))),
        ...work.map((a) => ({ title: a.name, kind: { assignment: 'Assignment', quiz: 'Quiz', discussion: 'Discussion' }[a.kind], where: `${course}${a.due_at ? ` · due ${when(a.due_at)}` : ''}`, course: c.id, href: itemHref(c.id, a), text: `${a.name} ${a.forum || ''}` })),
        ...news.map((n) => ({ title: n.title, kind: 'Announcement', where: `${course}${n.posted_at ? ` · ${when(n.posted_at)}` : ''}`, course: c.id, href: courseHref(c.id, 'announcements', n.id), text: `${n.title} ${ui.plainOf(n.message_html, n.message)}` })),
      ];
    }));
    const outside = await ui.externalWork(courses).catch(() => []);
    const names = new Map(courses.map((c) => [c.id, nameOf(c)]));
    return [...per.flat(), ...outside.map((x) => ({ title: x.name, kind: x.source, where: `${names.get(x.course_id) || ''}${x.due_at ? ` · due ${when(x.due_at)}` : ''}`, course: x.course_id, href: x.html_url, external: true, text: `${x.name} ${x.group || ''}` }))];
  }

  // The search dialog: type to filter (every word must match), arrows and Enter to open.
  ui.searchDialog = () => {
    const app = ui.appEl();
    if (!app || app.querySelector('.modal')) return;
    const input = h('input', { class: 'txt', type: 'search', placeholder: 'Search modules, assignments, announcements…', 'aria-label': 'Search all courses' });
    const list = h('div', { class: 'gsearch', role: 'listbox', 'aria-label': 'Results' }, h('div', { class: 'muted small pad' }, 'Loading your courses…'));
    const close = () => overlay.remove();
    const overlay = h('div', { class: 'modal', onclick: (ev) => ev.target === overlay && close() },
      h('div', { class: 'dialog wide', role: 'dialog', 'aria-label': 'Search all courses' },
        h('div', { class: 'trayhead' }, h('h2', null, 'Search all courses'), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: close }, ic('close'))),
        input, list));
    let index = null;
    let shown = [];
    let at = 0;
    const open = (r) => {
      close();
      if (r.external) window.open(r.href, '_blank', 'noopener,noreferrer');
      else location.href = r.href;
    };
    const draw = () => {
      if (!index) return;
      const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) {
        list.replaceChildren(h('div', { class: 'muted small pad' }, `Type to search ${index.length} items across your courses.`));
        shown = [];
        return;
      }
      shown = index.filter((r) => words.every((w) => `${r.text} ${r.where} ${r.kind}`.toLowerCase().includes(w)))
        .sort((a, b) => Number(!a.title.toLowerCase().includes(words[0])) - Number(!b.title.toLowerCase().includes(words[0])))
        .slice(0, 60);
      at = Math.min(at, Math.max(0, shown.length - 1));
      list.replaceChildren(...(shown.length
        ? shown.map((r, n) => h('a', { class: n === at ? 'gres on' : 'gres', href: r.href, role: 'option', 'aria-selected': String(n === at), target: r.external ? '_blank' : null, rel: r.external ? 'noopener noreferrer' : null, style: `--c:${colorOf(r.course)}`, onclick: (ev) => { ev.preventDefault(); open(r); } },
            h('span', { class: 'gkind' }, r.kind),
            h('span', { class: 'imid' }, h('span', { class: 't' }, r.title, r.external ? [' ', ic('external', 12)] : null), h('span', { class: 'ctx' }, r.where))))
        : [h('div', { class: 'muted small pad' }, 'Nothing matches.')]));
      list.querySelector('.gres.on')?.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', () => { at = 0; draw(); });
    overlay.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); close(); }
      else if (ev.key === 'ArrowDown' && shown.length) { ev.preventDefault(); at = (at + 1) % shown.length; draw(); }
      else if (ev.key === 'ArrowUp' && shown.length) { ev.preventDefault(); at = (at - 1 + shown.length) % shown.length; draw(); }
      else if (ev.key === 'Enter' && shown[at]) { ev.preventDefault(); open(shown[at]); }
    });
    app.append(overlay);
    input.focus();
    searchIndex().then((items) => { index = items; draw(); }).catch((e) => list.replaceChildren(h('div', { class: 'muted small pad' }, `Search is unavailable. ${e.message || e}`)));
  };

  // ---- Connected sites: Gradescope and Ed Discussion -------------------------
  // Switches, the Ed token, which Brightspace course each Ed course belongs to, and every
  // place the same assignment shows up twice (folded into one, or kept apart).
  ui.views.connections = async () => {
    const courses = await data.courses();
    const visible = state.showAll ? courses : ui.focusCourses(courses);
    const ed = settings.ed;
    const save = () => { ui.saveSettings(); if (BSX.ed) BSX.ed.clear(); if (BSX.gradescope) BSX.gradescope.clear(); ui.render(); };
    const onoff = (on, set) => h('div', { class: 'seg' }, [false, true].map((v) => h('button', { type: 'button', class: Boolean(on) === v ? 'on' : null, onclick: () => { set(v); save(); } }, v ? 'On' : 'Off')));
    const grant = (site) => h('button', { class: 'btn', type: 'button', onclick: () => (globalThis.browser || globalThis.chrome)?.runtime?.sendMessage({ type: 'bsx-grant', site }) }, `Allow ${site === 'ed' ? 'edstem.org' : 'gradescope.com'} access`);

    // Ed: token and region.
    const token = h('input', { class: 'txt', type: 'password', autocomplete: 'off', placeholder: ed.token ? 'Saved (paste a new one to replace it)' : 'Paste your Ed API token', 'aria-label': 'Ed API token' });
    const region = h('select', { class: 'txt pick', 'aria-label': 'Ed region' }, [['us', 'United States (edstem.org/us)'], ['au', 'Australia (edstem.org/au)'], ['eu', 'Europe (edstem.org/eu)'], ['ca', 'Canada (edstem.org/ca)']].map(([v, t]) => h('option', { value: v, selected: ed.region === v }, t)));
    // Ed's token page, for the chosen region (it is not in Ed's settings menu).
    const tokenUrl = () => `https://edstem.org/${region.value}/settings/api-tokens`;
    const tokenLink = h('a', { class: 'small', href: tokenUrl(), target: '_blank', rel: 'noopener noreferrer', style: 'font-weight:400' }, 'Get a token on Ed ', ic('external', 12));
    region.addEventListener('change', () => (tokenLink.href = tokenUrl()));
    const saveToken = () => { if (token.value.trim()) ed.token = token.value.trim(); ed.region = region.value; ed.on = true; save(); ui.flash('Ed settings saved.'); };
    const forget = () => { ed.token = ''; ed.on = false; save(); ui.flash('Ed token removed.'); };

    // Ed courses and their Brightspace match, once Ed answers.
    const edPart = ed.on && ed.token && BSX.ed
      ? ui.lazy(BSX.ed.forCourses(visible, { map: ed.map, region: ed.region }), (r) => {
          if (r.state === 'no_permission') return h('p', null, 'Your browser has not allowed this extension on edstem.org yet. ', grant('ed'), ' then press Refresh.');
          if (r.state === 'bad_token') return h('p', { class: 'bad' }, 'Ed did not accept this token. Make a new one in Ed (Settings → API Tokens) and paste it above.');
          if (r.state === 'no_token') return h('p', { class: 'muted' }, 'Paste an Ed API token above.');
          if (!r.courses.length) return h('p', { class: 'muted' }, 'No current Ed courses with lessons were found on your Ed account.');
          return h('table', { class: 'grid' },
            h('thead', null, h('tr', null, h('th', null, 'Ed course'), h('th', null, 'Shown under'), h('th', { class: 'num' }, 'Items'))),
            h('tbody', null, r.courses.map((e) => {
              const auto = BSX.ed.brightspaceFor(e, visible, {});
              const has = Object.prototype.hasOwnProperty.call(ed.map, e.id);
              const pick = h('select', { class: 'txt pick', 'aria-label': `Brightspace course for ${e.code || e.name}` },
                h('option', { value: 'auto', selected: !has }, auto ? `Automatic: ${nameOf(auto)}` : 'Automatic: no match'),
                visible.map((c) => h('option', { value: String(c.id), selected: has && Number(ed.map[e.id]) === c.id }, nameOf(c))),
                h('option', { value: '0', selected: has && Number(ed.map[e.id]) === 0 }, 'Don’t show'));
              pick.addEventListener('change', () => { if (pick.value === 'auto') delete ed.map[e.id]; else ed.map[e.id] = Number(pick.value); save(); });
              const count = r.items.filter((i) => i.source_id.startsWith(`ed-${e.id}-`)).length;
              return h('tr', null, h('td', null, h('div', { class: 't' }, e.code || e.name), h('div', { class: 'muted small' }, [e.name !== e.code ? e.name : '', e.term].filter(Boolean).join(' · '))), h('td', null, pick), h('td', { class: 'num' }, String(count)));
            })));
        })
      : null;

    // Overlaps, course by course: folded copies with "Keep separate", and every outside item
    // with a "Same as" choice.
    const overlaps = (settings.gradescope || (ed.on && ed.token))
      ? ui.lazy(Promise.all(visible.map(async (c) => {
          const kept = await ui.externalWork([c]).catch(() => []);
          const work = await data.assignments(c.id).catch(() => []);
          return { c, kept, work, bag: ui.folded.get(c.id) || new Map() };
        })), (rows) => {
          const blocks = rows.filter((r) => r.kept.length || r.bag.size).map(({ c, kept, work, bag }) => {
            const foldedRows = [...bag.entries()].flatMap(([, list]) => list.map((x) => h('div', { class: 'irow' },
              h('span', { class: 'iic ok' }, ic('check', 18)),
              h('div', { class: 'imid' }, h('div', { class: 't' }, `${x.source}: ${x.name}`), h('div', { class: 'muted small' }, `Shown as one with “${x.into}”${x.auto ? ' (matched automatically)' : ''}`)),
              h('button', { class: 'btn', type: 'button', onclick: () => ui.setLink(x, 'separate') }, 'Keep separate'))));
            const keptRows = kept.map((x) => {
              const choose = h('select', { class: 'txt pick', 'aria-label': `Same as, for ${x.name}` },
                h('option', { value: '' }, settings.links[ui.keyOf(x)] === 'separate' ? 'Kept separate' : 'Not linked'),
                work.map((a) => h('option', { value: a.id }, `Brightspace: ${a.name}`)),
                kept.filter((k) => k !== x && k.source !== x.source).map((k) => h('option', { value: ui.keyOf(k) }, `${k.source}: ${k.name}`)));
              choose.addEventListener('change', () => ui.setLink(x, choose.value || null));
              return h('div', { class: 'irow' },
                h('span', { class: 'iic' }, ic('external', 18)),
                h('div', { class: 'imid' }, h('div', { class: 't' }, `${x.source}: ${x.name}`), h('div', { class: 'muted small' }, x.due_at ? `Due ${when(x.due_at)}` : 'No due date')),
                h('label', { class: 'small' }, 'Same as ', choose));
            });
            return h('details', { class: 'group', open: true }, h('summary', null, ic('down', 16), h('span', { class: 'gname' }, nameOf(c)), h('span', { class: 'count' }, foldedRows.length + keptRows.length)), foldedRows, keptRows);
          });
          return blocks.length ? blocks : h('p', { class: 'muted' }, 'No outside work found for your current courses.');
        })
      : h('p', { class: 'muted' }, 'Turn on Gradescope or Ed above to see outside work here.');

    return {
      title: 'Connected Sites',
      body: [
        h('h2', { class: 'sect' }, 'Gradescope'),
        h('div', { class: 'row', style: 'align-items:center' }, onoff(settings.gradescope, (v) => (settings.gradescope = v)), h('span', { class: 'muted small' }, 'Reads your Gradescope assignments with your own Gradescope sign-in.')),
        h('h2', { class: 'sect' }, 'Ed Discussion'),
        h('div', { class: 'row', style: 'align-items:center' }, onoff(ed.on, (v) => (ed.on = v)), h('span', { class: 'muted small' }, 'Reads your Ed lessons and their due dates.')),
        h('div', { class: 'edform' },
          h('label', null, h('span', { class: 'row', style: 'justify-content:space-between;align-items:baseline' }, 'API token', tokenLink), token),
          h('label', null, 'Region', region),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: saveToken }, 'Save'), ed.token ? h('button', { class: 'btn', type: 'button', onclick: forget }, 'Remove token') : null,
            ed.token ? h('button', { class: 'btn', type: 'button', title: 'Copies field names and types of Ed’s answers, with no values', onclick: async (ev) => {
              const btn = ev.currentTarget;
              btn.disabled = true;
              const text = JSON.stringify(await BSX.ed.report(), null, 2);
              btn.disabled = false;
              const box = h('textarea', { class: 'txt', rows: '8', readonly: true, 'aria-label': 'Ed check report' }, text);
              btn.closest('.edform').append(box);
              try {
                await navigator.clipboard.writeText(text);
                ui.flash('Ed check copied. Paste it into the chat.');
              } catch {
                box.select();
                ui.flash('Select the report below and copy it.');
              }
            } }, 'Check Ed') : null),
          h('p', { class: 'muted small' }, 'Make a token on Ed’s API Tokens page (linked above; it is not listed in Ed’s settings menu). Ed only lets you create one once two-factor authentication is turned on for your Ed account. The token is kept in this browser only and sent only to edstem.org.')),
        edPart,
        h('h2', { class: 'sect' }, 'Same assignment in more than one place'),
        h('p', { class: 'muted small' }, 'Matching names due within a day and a half are shown as one, keeping Brightspace’s copy first, then Gradescope’s, then Ed’s. Change any match here.'),
        overlaps,
      ],
    };
  };

  // Canvas's Groups page: each group you belong to, its course and category, and members
  // where Brightspace lets a student see them.
  ui.views.groups = async () => {
    const courses = await data.courses();
    const list = await data.groups(courses);
    const byCourse = new Map(courses.map((c) => [c.id, c]));
    const card = (g) => {
      const c = g.course_id != null ? byCourse.get(g.course_id) : null;
      const members = g.member_ids && c
        ? ui.lazy(data.people(c.id), (people) => {
            const names = new Map(people.map((p) => [String(p.id), p.name]));
            const shown = g.member_ids.map((id) => names.get(id)).filter(Boolean);
            return shown.length ? h('div', { class: 'members' }, shown.map((n) => h('span', { class: 'member' }, h('span', { class: 'avatar xs' }, n.slice(0, 1).toUpperCase()), n))) : null;
          }, '')
        : null;
      return h('div', { class: 'gcard', style: c ? `--c:${colorOf(c.id)}` : null },
        h('div', { class: 'gtop' },
          h('span', { class: 'avatar' }, ic('groups', 22)),
          h('div', { class: 'imid' },
            h('div', { class: 't' }, g.name),
            h('div', { class: 'muted small' }, [c ? h('a', { href: courseHref(c.id) }, nameOf(c)) : 'Course not shown to students', g.category ? ` · ${g.category}` : null, g.member_ids ? ` · ${g.member_ids.length} member${g.member_ids.length === 1 ? '' : 's'}` : null])),
          h('a', { class: 'btn', href: `/d2l/lms/group/user_group_list.d2l?ou=${g.course_id ?? g.id}`, title: 'Open groups in Brightspace' }, 'Brightspace ', ic('external', 14))),
        g.description ? h('p', { class: 'muted small' }, ui.clip(g.description, 220)) : null,
        members);
    };
    return {
      title: 'Groups',
      body: list.length
        ? [h('p', { class: 'muted small' }, `You belong to ${list.length} group${list.length === 1 ? '' : 's'}.`), h('div', { class: 'gcards' }, list.map(card))]
        : ui.empty('You are not in any groups.'),
    };
  };

  // Brightspace mail cannot be read from here, so the Inbox is a doorway to it, with the
  // messages instructors did send through Brightspace (announcements) listed underneath.
  ui.views.inbox = async () => {
    const courses = await data.courses();
    const visible = state.showAll ? courses : ui.focusCourses(courses);
    const names = new Map(courses.map((c) => [c.id, nameOf(c)]));
    const org = await data.orgId().catch(() => null);
    const mail = ui.bs.email(org);
    return {
      title: 'Inbox',
      actions: h('a', { class: 'btn', href: mail, target: '_blank', rel: 'noopener' }, 'Open in a new tab ', ic('external', 14)),
      body: [
        // Brightspace has no interface for reading mail, so its own Email tool is shown in a frame.
        h('iframe', { class: 'viewer', src: mail, title: 'Brightspace Email', loading: 'lazy' }),
        h('p', { class: 'muted small' }, 'This is Brightspace’s own Email tool. If it stays blank, use “Open in a new tab”.'),
        h('h2', { class: 'sect' }, 'Announcements from your instructors'),
        ui.lazy(data.recentAnnouncements(visible, 30), (news) => news.length
          ? h('div', { class: 'rows' }, news.map((a) => h('a', { class: 'arow', href: courseHref(a.course_id, 'announcements', a.id) },
              h('span', { class: 'avatar sm', style: `color:${colorOf(a.course_id)}` }, ic('announcement', 18)),
              h('div', { class: 'imid' }, h('div', { class: 'ctx', style: `--c:${colorOf(a.course_id)}` }, names.get(a.course_id) || ''), h('div', { class: 't' }, a.title), h('div', { class: 'muted small' }, ui.clip(ui.plainOf(a.message_html, a.message), 180))),
              h('div', { class: 'muted small nowrap' }, when(a.posted_at)))))
          : ui.empty('No announcements in the last 30 days.')),
      ],
    };
  };

  ui.views.allgrades = async () => {
    const courses = await data.courses();
    const visible = state.showAll ? courses : ui.focusCourses(courses);
    const totals = await data.courseTotals(visible);
    const byId = new Map(totals.map((t) => [t.course_id, t]));
    const cell = (t) => {
      if (t?.final) return [h('strong', null, t.final.displayed || pct(t.final.score, t.final.points_possible))];
      if (t?.estimate) return [h('strong', null, pct(t.estimate.score, t.estimate.points_possible)), ui.tag('estimate')];
      return [h('span', { class: 'muted' }, 'Not released')];
    };
    return {
      title: 'Courses I’m Taking',
      body: [
        h('table', { class: 'grid' },
          h('thead', null, h('tr', null, h('th', null, 'Course'), h('th', { class: 'num' }, 'Grade'))),
          h('tbody', null, visible.map((c) => h('tr', null, h('td', null, h('span', { class: 'dot', style: `background:${colorOf(c.id)}` }), ' ', h('a', { href: courseHref(c.id, 'grades') }, nameOf(c))), h('td', { class: 'num' }, cell(byId.get(c.id))))))),
        h('p', { class: 'muted small' }, 'Estimates are computed from graded items, ignore dropped-score rules and are not official.'),
      ],
    };
  };
})();

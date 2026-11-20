// Layer 3, part 4: calendar (month and agenda), then start the interface.
(() => {
  const ui = BSX.ui;
  if (!ui) return;
  const { data } = BSX;
  const { h, ic, settings, state, colorOf, nameOf } = ui;
  let mode = 'month';

  ui.views.calendar = async (r) => {
    const today = new Date();
    const year = r.year ?? today.getFullYear();
    const month = r.month ?? today.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - first.getDay());
    const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42);

    const courses = await data.courses();
    const listed = state.showAll ? courses : ui.focusCourses(courses);
    const hidden = new Set(settings.calHidden);
    const shown = listed.filter((c) => !hidden.has(c.id));
    const fetched = await data.calendar(shown.map((c) => c.id), gridStart.getTime(), gridEnd.getTime());
    const names = new Map(courses.map((c) => [c.id, nameOf(c)]));
    // The student's own To Do items sit on the calendar too.
    const mine = settings.calHidden.includes(0) ? [] : ui.personalItems(gridStart.getTime(), gridEnd.getTime(), null).map((t) => ({ personal: t, title: t.name, course_id: t.course_id, start_at: t.due_at, all_day: false }));
    const outside = (await ui.externalWork(shown).catch(() => []))
      .filter((i) => i.due_at && Date.parse(i.due_at) >= gridStart.getTime() && Date.parse(i.due_at) <= gridEnd.getTime())
      .map((i) => ({ external: i, title: i.name, course_id: i.course_id, start_at: i.due_at, all_day: false }));
    const events = [...fetched, ...mine, ...outside].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));

    const byDay = new Map();
    for (const e of events) {
      const k = ui.dayKey(new Date(e.start_at));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(e);
    }
    // Month cells show the title only (the time is in the tooltip); the agenda shows both.
    const eventEl = (e, full) => {
      const where = e.course_id == null ? 'My To Do' : names.get(e.course_id) || e.context_name || '';
      const time = e.all_day ? '' : ui.fmt.time.format(new Date(e.start_at));
      const label = full ? [time ? h('span', { class: 'etime' }, `${time} `) : null, e.title, h('span', { class: 'muted' }, ` · ${where}`)] : e.title;
      const attrs = { class: 'event', style: `--c:${e.course_id == null ? 'var(--muted)' : colorOf(e.course_id)}`, title: `${e.title} · ${time ? `${time} · ` : ''}${where}` };
      if (e.personal) return h('button', { ...attrs, type: 'button', onclick: () => ui.todoDialog(e.personal, listed) }, label);
      if (e.external) return h('a', { ...attrs, href: e.external.html_url, target: '_blank', rel: 'noopener noreferrer', title: `${attrs.title} · ${e.external.source}` }, label);
      if (!e.associated) return h('button', { ...attrs, type: 'button', onclick: () => eventDialog(e, where) }, label);
      const href = e.html_url && ui.wrapHref(e.html_url);
      return href ? h('a', { ...attrs, href }, label) : h('div', attrs, label);
    };

    // Canvas's event popover: when, where, which calendar, and the details.
    function eventDialog(e, where) {
      const app = ui.appEl();
      if (!app) return;
      const start = new Date(e.start_at);
      const end = e.end_at ? new Date(e.end_at) : null;
      const time = e.all_day ? ui.fmt.day.format(start) : `${ui.fmt.day.format(start)}, ${ui.fmt.time.format(start)}${end && end > start ? ` – ${ui.fmt.time.format(end)}` : ''}`;
      const close = () => overlay.remove();
      const overlay = h('div', { class: 'modal', onclick: (ev) => ev.target === overlay && close(), onkeydown: (ev) => ev.key === 'Escape' && (ev.stopPropagation(), close()) },
        h('div', { class: 'dialog', role: 'dialog', 'aria-label': e.title, style: `border-top:6px solid ${e.course_id == null ? 'var(--muted)' : colorOf(e.course_id)}` },
          h('div', { class: 'trayhead' }, h('h2', null, e.title), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: close }, ic('close'))),
          h('dl', { class: 'evmeta' },
            h('dt', null, ic('calendar', 16)), h('dd', null, time),
            e.location ? [h('dt', null, ic('home', 16)), h('dd', null, e.location)] : null,
            h('dt', null, h('span', { class: 'dot', style: `background:${e.course_id == null ? 'var(--muted)' : colorOf(e.course_id)}` })), h('dd', null, where)),
          e.description ? ui.prose(e.description, e.description) : null,
          e.html_url ? h('div', { class: 'row' }, h('a', { class: 'btn', href: e.html_url, onclick: close }, 'More details')) : null));
      app.append(overlay);
      overlay.querySelector('.iconbtn').focus();
    }

    const link = (d) => `#/calendar/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const pick = (key, text) => h('button', { type: 'button', class: mode === key ? 'on' : null, onclick: () => { mode = key; ui.render(); } }, text);
    const actions = h('div', { class: 'calnav' },
      h('button', { class: 'btn', type: 'button', onclick: () => ui.todoDialog(null, listed) }, ic('plus', 16), 'To Do'),
      h('a', { class: 'btn', href: '#/calendar' }, 'Today'),
      h('a', { class: 'btn icon', href: link(new Date(year, month - 1, 1)), 'aria-label': 'Previous month' }, ic('left', 16)),
      h('a', { class: 'btn icon', href: link(new Date(year, month + 1, 1)), 'aria-label': 'Next month' }, ic('right', 16)),
      h('div', { class: 'seg' }, pick('month', 'Month'), pick('agenda', 'Agenda')));

    let body;
    if (mode === 'agenda') {
      const days = [...byDay.entries()].filter(([, list]) => list.some((e) => new Date(e.start_at).getMonth() === month));
      body = days.length
        ? days.map(([k, list]) => h('section', { class: k === ui.dayKey(today) ? 'pday today' : 'pday' }, h('h2', null, ui.fmt.day.format(new Date(list[0].start_at))), list.map((e) => h('div', { class: 'agrow' }, eventEl(e, true)))))
        : ui.empty('Nothing on the calendar this month.');
    } else {
      const cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((n) => h('div', { class: 'dow' }, n));
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        const cls = ['day', d.getMonth() !== month ? 'other' : '', ui.dayKey(d) === ui.dayKey(today) ? 'today' : ''].filter(Boolean).join(' ');
        cells.push(h('div', { class: cls }, h('div', { class: 'dnum' }, d.getDate()), (byDay.get(ui.dayKey(d)) || []).map((e) => eventEl(e, false))));
      }
      body = h('div', { class: 'cal' }, cells);
    }

    const toggle = (c) => {
      const box = h('input', { type: 'checkbox', checked: !hidden.has(c.id) });
      box.addEventListener('change', () => {
        settings.calHidden = box.checked ? settings.calHidden.filter((x) => x !== c.id) : [...settings.calHidden, c.id];
        ui.saveSettings();
        ui.render();
      });
      return h('label', { class: 'calrow' }, box, h('span', { class: 'dot', style: `background:${c.id ? colorOf(c.id) : 'var(--muted)'}` }), h('span', null, nameOf(c)));
    };
    return {
      title: ui.fmt.month.format(first),
      actions,
      body: [body, h('p', { class: 'muted small' }, 'From the Brightspace calendar.')],
      side: ui.sideSection('Calendars', [toggle({ id: 0, name: 'My To Do' }), listed.map(toggle)]),
    };
  };

  ui.start();
})();

// Layer 3: Purdue dining menus. One tab per dining court down the left (with whether it is
// open now), that court's meals for the day with each station's mains, and Settings at the
// bottom of the tabs for the food filter.
//   #/menus[/{Court}][/{YYYY-MM-DD}]     #/menus/settings
(() => {
  const ui = BSX.ui;
  if (!ui) return;
  const M = BSX.menus;
  const { h, ic, settings } = ui;

  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateOf = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const shift = (k, days) => {
    const d = dateOf(k);
    d.setDate(d.getDate() + days);
    return keyOf(d);
  };
  const at = (k, hms) => {
    const d = dateOf(k);
    const [hh, mm] = hms.split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
    return d;
  };
  const hours = (k, meal) => (meal.Hours ? `${ui.fmt.time.format(at(k, meal.Hours.StartTime))} – ${ui.fmt.time.format(at(k, meal.Hours.EndTime))}` : '');
  const href = (court, date) => `#/menus/${encodeURIComponent(court)}${date ? `/${date}` : ''}`;
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  // Open now, opening later today, or closed, from a day's meals.
  function status(k, day, now = new Date()) {
    const meals = (day.Meals || []).filter((m) => m.Status === 'Open' && m.Hours);
    const open = meals.find((m) => now >= at(k, m.Hours.StartTime) && now < at(k, m.Hours.EndTime));
    if (open) return { open: true, meal: open, text: `Open until ${ui.fmt.time.format(at(k, open.Hours.EndTime))}` };
    const next = meals.filter((m) => at(k, m.Hours.StartTime) > now).sort((a, b) => at(k, a.Hours.StartTime) - at(k, b.Hours.StartTime))[0];
    if (next) return { open: false, meal: next, text: `${next.Name} at ${ui.fmt.time.format(at(k, next.Hours.StartTime))}` };
    return { open: false, meal: null, text: 'Closed for the day' };
  }

  function menuNav(courts, current, date, today) {
    const link = (c) => {
      const note = h('span', { class: 'mstat' });
      if (date === today) {
        M.day(c, today)
          .then((d) => {
            const s = status(today, d);
            note.textContent = s.text;
            note.classList.toggle('openn', s.open);
          })
          .catch(() => {});
      }
      return h('a', { href: href(c, date === today ? null : date), class: current === c ? 'on' : null }, c, note);
    };
    return h('nav', { class: 'cnav mnav', 'aria-label': 'Dining courts' },
      courts.map(link),
      h('div', { class: 'sep' }),
      h('a', { href: '#/menus/settings', class: current === 'settings' ? 'on' : null }, ic('settings', 16), ' Settings'),
      favsToday(courts, today));
  }

  // Under Settings: each favourite served today, and where. Empty when none is.
  function favsToday(courts, today) {
    const box = h('div', { class: 'mfavs', role: 'status', hidden: true });
    if (!settings.menus.fav.length) return box;
    const want = new Set(settings.menus.fav);
    Promise.all(courts.map((c) => M.day(c, today).then((d) => ({ c, d })).catch(() => null)))
      .then((days) => {
        const seen = new Set();
        const rows = [];
        for (const { c, d } of days.filter(Boolean)) {
          for (const x of M.dishes(d)) {
            const k = `${M.favKey(x.item.Name)}|${c}|${x.meal}`;
            if (!want.has(M.favKey(x.item.Name)) || seen.has(k)) continue;
            seen.add(k);
            rows.push(h('a', { href: href(c), class: 'mfavrow' }, h('span', { class: 'mfav' }, '★ '), x.item.Name, h('span', { class: 'mstat' }, `${c} · ${x.meal}${x.parent ? ` · ${x.parent}` : ''}`)));
          }
        }
        if (!rows.length) return;
        box.replaceChildren(h('div', { class: 'sep' }, 'Favorites today'), ...rows);
        box.hidden = false;
      });
    return box;
  }

  // ---- search ---------------------------------------------------------------
  // Dishes for the search dialog (ui-dashboard.js): today's everywhere, or, on the Menus page, a
  // week back through two weeks ahead (Purdue publishes menus about two weeks out). A deep search
  // (Shift+S, from any page) reaches six weeks back and carries each dish's ingredient list, so a
  // dish can be found by what is in it. One result per dish, court, spot and day. Dishes the food
  // filter blocks are left out.
  const BACK = 7;
  const DEEP_BACK = 42;
  const AHEAD = 14;
  const POOL = 8; // requests to Purdue at a time
  // One copy of each dish's ingredient list, however many days it is served.
  const recipes = new Map();
  const recipe = (name, text) => {
    if (!text) return '';
    if (!recipes.has(name)) recipes.set(name, text);
    return recipes.get(name);
  };
  // Each court-day boiled down to what search needs, for ten minutes, so three weeks of menus
  // (about 300 KB a court-day) are never held at once.
  const slim = new Map();
  function slimDay(c, date, blocked, filterKey, keep) {
    const key = `${c}|${date}|${filterKey}`;
    const hit = slim.get(key);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.promise;
    const promise = (keep ? M.day(c, date) : M.dayOnce(c, date)).then((d) => M.dishes(d)
      .filter((x) => x.item.Components || !blocked(x.item)) // bars are kept: their parts are checked one by one
      .map((x) => ({ name: x.item.Name, meal: x.meal, place: x.parent ? `${x.station}, ${x.parent}` : x.station, parent: x.parent || '', station: x.station, ingredients: recipe(x.item.Name, x.item.Ingredients) })));
    promise.catch(() => slim.delete(key));
    slim.set(key, { at: Date.now(), promise });
    return promise;
  }
  async function pool(jobs, size) {
    const out = new Array(jobs.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (next < jobs.length) {
        const n = next++;
        out[n] = await jobs[n]().catch(() => null);
      }
    }));
    return out;
  }
  const shortDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  ui.menuSearch = async ({ deep = false } = {}) => {
    const today = keyOf(new Date());
    const m = location.hash.match(/^#\/menus(?:\/[^/]+)?(?:\/(\d{4}-\d{2}-\d{2}))?$/);
    const back = deep ? DEEP_BACK : BACK;
    const dates = m || deep ? Array.from({ length: back + AHEAD + 1 }, (_, n) => shift(today, n - back)) : [today];
    if (m && m[1] && !dates.includes(m[1])) dates.push(m[1]); // the day being looked at, wherever it is
    const courts = await M.courts();
    const blocked = M.blocker(settings.menus.block);
    const filterKey = JSON.stringify(settings.menus.block);
    // Today and the day shown use the page's own cached menus; the rest are read and dropped.
    const jobs = courts.flatMap((c) => dates.map((date) => () => slimDay(c, date, blocked, filterKey, date === today || date === (m && m[1])).then((list) => ({ c, date, list }))));
    const days = (await pool(jobs, POOL)).filter(Boolean);

    // One entry per dish, court, spot and day, with that day's meals (Lunch, Dinner).
    const entries = new Map();
    for (const { c, date, list } of days) {
      for (const x of list) {
        const k = `${x.name}|${c}|${x.place}|${date}`;
        if (!entries.has(k)) entries.set(k, { x, c, date, meals: [] });
        const e = entries.get(k);
        if (!e.meals.includes(x.meal)) e.meals.push(x.meal);
      }
    }
    const label = (date) => (date === today ? 'Today' : shortDay.format(dateOf(date)));
    const out = [...entries.values()].map(({ x, c, date, meals }) => ({
      title: x.name,
      kind: 'Menu',
      where: `${c} · ${label(date)} (${meals.join(', ')}) · ${x.place}`,
      href: href(c, date === today ? null : date),
      text: `${x.name} ${x.parent} ${x.station} ${c}`,
      detail: deep && x.ingredients ? [['Ingredients', x.ingredients]] : null,
      // Today and later first, soonest first; then past days, latest first.
      order: date >= today ? date : `~${99999999 - Number(date.replace(/-/g, ''))}`,
    }));
    // (Plain comparison: locale-aware sorting puts "~" before digits.)
    return out.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  };

  const grantButton = () => h('button', { class: 'btn', type: 'button', onclick: () => (globalThis.browser || globalThis.chrome)?.runtime?.sendMessage({ type: 'bsx-grant', site: 'menus' }) }, 'Allow api.hfs.purdue.edu access');
  const failed = (e) => (e && e.code === 'permission'
    ? h('div', { class: 'error' }, h('p', { style: 'margin-top:0' }, 'Your browser has not allowed this extension on api.hfs.purdue.edu (Purdue Dining) yet.'), h('div', { class: 'row' }, grantButton(), ui.button('Try again', ui.reload)))
    : h('div', { class: 'error' }, h('p', { style: 'margin-top:0' }, `Could not load the menu. ${e && e.message ? e.message : e}`), h('div', { class: 'row' }, ui.button('Try again', ui.reload))));

  const vegTag = (i) => (M.vegan(i) ? h('span', { class: 'veg', title: 'Vegan' }, 'VG') : M.vegetarian(i) ? h('span', { class: 'veg', title: 'Vegetarian' }, 'V') : null);

  // A dropdown. It starts open when it holds two items or fewer, or when it is all its station
  // has and holds fewer than seven (Hillenbrand's Cookie Cache).
  const dropdown = (summary, rows, { alone = false, count = rows.length } = {}) => h('li', null,
    h('details', { class: 'mgroup', open: count <= 2 || (alone && count < 7) }, h('summary', null, summary), h('ul', { class: 'mparts' }, rows)));

  // ⚠ on a dish Purdue lists no ingredients for, while the food filter is on: the filter could
  // only go by its name. (`warned` counts them for the note under the meal.)
  const warn = (i, warned) => {
    if (!settings.menus.block.length || !M.unlisted(i)) return null;
    warned.n++;
    return h('span', { class: 'mwarn', title: 'Purdue lists no ingredients for this, so the food filter only checked its name.' }, '⚠');
  };

  // ---- favourites -----------------------------------------------------------
  // Right-click a dish (long-press on a phone) for a small menu with Favorite. Favourites are
  // starred, and the ones served today are listed under Settings in the court tabs.
  const isFav = (name) => settings.menus.fav.includes(M.favKey(name));
  function toggleFav(name) {
    const k = M.favKey(name);
    settings.menus.fav = isFav(name) ? settings.menus.fav.filter((f) => f !== k) : [...settings.menus.fav, k];
    ui.saveSettings();
    ui.render();
  }
  function favMenu(ev, name) {
    const app = ui.appEl();
    if (!app) return;
    ev.preventDefault();
    app.querySelector('.menu.mctx')?.remove();
    const shut = () => {
      pop.remove();
      document.removeEventListener('click', away, true);
    };
    const away = (e) => !e.composedPath().includes(pop) && shut();
    const pop = h('div', { class: 'menu mctx', role: 'menu', style: `left:${Math.min(ev.clientX, innerWidth - 230)}px;top:${Math.min(ev.clientY, innerHeight - 60)}px`, onkeydown: (e) => e.key === 'Escape' && (e.stopPropagation(), shut()) },
      h('button', { type: 'button', role: 'menuitem', onclick: () => { shut(); toggleFav(name); } }, h('span', { class: 'mcheck' }, '★'), isFav(name) ? `Remove ${name} from favorites` : `Favorite ${name}`));
    app.append(pop);
    document.addEventListener('click', away, true);
    pop.querySelector('button').focus();
  }
  const star = (name) => (isFav(name) ? h('span', { class: 'mfav', title: 'Favorite' }, '★') : null);

  // One line of a station: a dish, a dropdown of similar dishes, or a dish with parts (its
  // submenu in Purdue's app), where parts the food filter catches are struck through.
  function entry(x, blocked, alone, warned) {
    const dish = (i) => h('li', { oncontextmenu: (ev) => favMenu(ev, i.Name) }, i.Name, star(i.Name), vegTag(i), warn(i, warned));
    if (x.type === 'item') return dish(x.item);
    if (x.type === 'bundle') {
      const part = (p) => {
        const hit = blocked(p);
        return hit ? h('li', { class: 'mblocked', title: `Filtered: ${hit}` }, p.Name) : dish(p);
      };
      // A big bar's parts in their own dropdowns (Proteins, Vegetables, Dressings …).
      const groups = M.partGroups(x.item);
      const rows = groups
        ? groups.map((g) => (g.items.length === 1 ? part(g.items[0]) : dropdown(`${g.label} (${g.items.length})`, g.items.map(part))))
        : x.item.Components.map(part);
      const box = dropdown([x.item.Name, star(x.item.Name), vegTag(x.item)], rows, { alone, count: x.item.Components.length });
      box.querySelector('summary').addEventListener('contextmenu', (ev) => favMenu(ev, x.item.Name));
      return box;
    }
    const summary = x.short ? [h('b', null, x.label), `: ${x.short.join(', ')}`] : `${x.label} (${x.items.length})`;
    return dropdown(summary, x.items.map(dish), { alone });
  }

  // One meal: its hours, then each station's dishes, with what the food filter took out underneath.
  function mealSection(k, meal, now, blocked) {
    const all = !settings.menus.mainsOnly;
    const filtered = [];
    const seen = new Set(); // a dish served at two stations (Windsor's Halal) is shown once
    const stations = (meal.Stations || [])
      .filter((s) => all || !M.SKIP_STATIONS.test(s.Name))
      .map((s) => {
        const items = [];
        for (const i of s.Items || []) {
          if ((!all && !M.isMain(i)) || seen.has(i.Name)) continue;
          seen.add(i.Name);
          // A dish with parts is never hidden whole ("Bread and Condiments" is not all bread);
          // its parts are checked one by one instead.
          const hit = i.Components ? null : blocked(i);
          if (hit) filtered.push(`${i.Name} (${hit})`);
          else items.push(i);
        }
        return { s, items };
      })
      .filter((x) => x.items.length);
    const closed = meal.Status !== 'Open';
    const live = !closed && meal.Hours && now >= at(k, meal.Hours.StartTime) && now < at(k, meal.Hours.EndTime);
    const warned = { n: 0 };
    const station = ({ s, items }) => {
      const lines = M.compact(items);
      return h('div', { class: 'mst' }, h('h3', null, s.Name), h('ul', null, lines.map((x) => entry(x, blocked, lines.length === 1, warned))));
    };
    const grid = closed || !stations.length ? null : h('div', { class: 'mgrid' }, stations.map(station));
    return h('section', { class: 'meal' },
      h('h2', { class: 'sect' }, meal.Name, closed ? h('span', { class: 'tag badt' }, 'Closed') : h('span', { class: 'tag' }, hours(k, meal)), live ? h('span', { class: 'tag okt' }, 'Open now') : null),
      closed ? null : grid || h('p', { class: 'muted' }, 'Nothing listed for this meal.'),
      filtered.length ? h('p', { class: 'muted small' }, `Filtered out: ${filtered.join(', ')}`) : null,
      warned.n ? h('p', { class: 'muted small' }, h('span', { class: 'mwarn' }, '⚠'), ` Purdue lists no ingredients for ${warned.n === 1 ? 'one dish' : `${warned.n} dishes`} here, so your food filter could only check ${warned.n === 1 ? 'its name' : 'their names'}.`) : null);
  }

  // ---- every dish in rotation ---------------------------------------------------
  // A small list of every dish served at the dining courts over the past semester (about four
  // months), with where and when it was last served, kept in extension storage. It fills in
  // from Purdue the first time Settings is opened (about 600 court-days, names only) and after
  // that only reads the days it has not seen yet. Days and dishes older than the window drop out.
  const ROTATION_DAYS = 120;
  const ROTATION_KEY = 'bsxRotation';
  const store = (globalThis.browser || globalThis.chrome)?.storage?.local;
  const rotation = { data: null, running: null, done: 0, total: 0, failed: 0, listeners: new Set() };
  async function rotationLoad() {
    if (rotation.data) return rotation.data;
    let saved = null;
    try {
      saved = (await store.get(ROTATION_KEY))[ROTATION_KEY];
    } catch {}
    rotation.data = saved && saved.items && saved.scanned ? saved : { scanned: {}, items: {} };
    return rotation.data;
  }
  const rotationSave = () => {
    try {
      store.set({ [ROTATION_KEY]: rotation.data });
    } catch {}
  };
  // Reads the court-days not seen yet (up to yesterday; today's menu can still change).
  function rotationUpdate() {
    if (rotation.running) return rotation.running;
    rotation.running = (async () => {
      const db = await rotationLoad();
      const today = keyOf(new Date());
      const cutoff = shift(today, -ROTATION_DAYS);
      for (const k of Object.keys(db.scanned)) if (k.split('|')[1] < cutoff) delete db.scanned[k];
      for (const [name, it] of Object.entries(db.items)) if (it.last < cutoff) delete db.items[name];
      const courts = await M.courts();
      const todo = [];
      for (let n = ROTATION_DAYS; n >= 1; n--) {
        const date = shift(today, -n);
        for (const c of courts) if (!db.scanned[`${c}|${date}`]) todo.push({ c, date });
      }
      rotation.done = 0;
      rotation.failed = 0;
      rotation.total = todo.length;
      const tell = () => rotation.listeners.forEach((fn) => fn());
      await pool(todo.map(({ c, date }) => async () => {
        const names = await M.namesOnce(c, date).catch(() => null);
        if (!names) {
          rotation.failed++; // tried again next time
          return;
        }
        for (const name of names) {
          const it = db.items[name] || (db.items[name] = { courts: [], last: '', times: 0 });
          if (!it.courts.includes(c)) it.courts.push(c);
          if (date > it.last) it.last = date;
          it.times++;
        }
        db.scanned[`${c}|${date}`] = 1;
        rotation.done++;
        if (rotation.done % 10 === 0) tell();
        if (rotation.done % 50 === 0) rotationSave();
      }), POOL);
      rotationSave();
      tell();
    })().finally(() => {
      rotation.running = null;
    });
    return rotation.running;
  }

  // The list in Settings → Favorites: type to narrow it, ☆ to favourite (in place, so the list
  // keeps its scroll position).
  function rotationBrowser() {
    const box = h('input', { class: 'txt', type: 'search', placeholder: 'Find a dish…', 'aria-label': 'Find a dish in rotation' });
    const note = h('p', { class: 'muted small' }, 'Loading…');
    const list = h('div', { class: 'mrot', role: 'list' });
    const SHOW = 400;
    const draw = () => {
      const db = rotation.data;
      if (!db) return;
      const all = Object.entries(db.items).sort(([a], [b]) => a.localeCompare(b));
      const words = box.value.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = words.length ? all.filter(([name, it]) => words.every((w) => `${name} ${it.courts.join(' ')}`.toLowerCase().includes(w))) : all;
      const progress = rotation.running && rotation.total ? ` Reading past menus: ${rotation.done} of ${rotation.total} court-days…` : '';
      const missed = !rotation.running && rotation.failed ? ` ${rotation.failed} court-days could not be read from Purdue Dining; they are tried again next time.` : '';
      note.textContent = `${all.length} dishes served in the last ${ROTATION_DAYS} days${words.length ? `, ${hits.length} matching` : ''}.${progress}${missed}`;
      list.replaceChildren(...hits.slice(0, SHOW).map(([name, it]) => {
        const fav = h('button', { class: 'iconbtn xs mstar', type: 'button', 'aria-pressed': String(isFav(name)), title: isFav(name) ? 'Remove from favorites' : 'Favorite', 'aria-label': `Favorite ${name}` }, isFav(name) ? '★' : '☆');
        fav.addEventListener('click', () => {
          const k = M.favKey(name);
          settings.menus.fav = isFav(name) ? settings.menus.fav.filter((f) => f !== k) : [...settings.menus.fav, k];
          ui.saveSettings();
          fav.textContent = isFav(name) ? '★' : '☆';
          fav.setAttribute('aria-pressed', String(isFav(name)));
          fav.title = isFav(name) ? 'Remove from favorites' : 'Favorite';
        });
        return h('div', { class: 'mrotrow', role: 'listitem' }, fav, h('span', { class: 'imid' }, h('span', null, name), h('span', { class: 'muted small' }, `${it.courts.join(', ')} · last ${shortDay.format(dateOf(it.last))} · ${it.times} time${it.times === 1 ? '' : 's'}`)));
      }), ...(hits.length > SHOW ? [h('p', { class: 'muted small pad' }, `${hits.length - SHOW} more: type to narrow the list.`)] : []));
      list.hidden = !hits.length;
    };
    box.addEventListener('input', draw);
    const listener = () => (box.isConnected ? draw() : rotation.listeners.delete(listener));
    rotation.listeners.add(listener);
    rotationLoad().then(() => {
      draw();
      rotationUpdate().catch(() => (note.textContent += ' Could not reach Purdue Dining to fill in the rest.'));
    });
    return [h('h3', { class: 'msub' }, 'Every dish in rotation'), box, note, list];
  }

  function settingsBody() {
    const m = settings.menus;
    const save = () => {
      ui.saveSettings();
      ui.render();
    };
    const add = (term) => {
      const t = term.trim().toLowerCase();
      if (!t || m.block.includes(t)) return;
      m.block = [...m.block, t];
      save();
    };
    const box = h('input', { class: 'txt', type: 'text', placeholder: 'A food, e.g. beef, pork, mushrooms, dairy', 'aria-label': 'Food to filter out', onkeydown: (ev) => ev.key === 'Enter' && add(box.value) });
    const QUICK = ['beef', 'pork', 'chicken', 'meat', 'fish', 'shellfish', 'dairy', 'egg', 'nuts', 'peanut', 'gluten', 'soy', 'mushroom', 'spicy'];
    const row = (t) => {
      const e = M.expand(t);
      const also = e.foods.filter((f) => f !== t);
      return h('li', { class: 'mblock' },
        h('div', { class: 'mbhead' }, h('b', null, t), h('button', { class: 'iconbtn xs', type: 'button', 'aria-label': `Stop filtering ${t}`, title: 'Remove', onclick: () => { m.block = m.block.filter((x) => x !== t); save(); } }, ic('close', 14))),
        h('div', { class: 'muted small' },
          also.length ? `Also blocks: ${also.join(', ')}.` : 'Blocks dishes with this word in their name.',
          e.allergens.length ? ` And anything Purdue marks as containing ${e.allergens.join(', ')}.` : '',
          e.meat ? ' Vegetarian and vegan versions (Veggie Burger) are kept.' : ''));
    };
    return [
      h('h2', { class: 'sect' }, 'Food filter'),
      h('p', { class: 'muted small' }, 'Dishes matching these, by name, by ingredient list or by Purdue’s allergen marks, are hidden from the menus and listed under each meal as “Filtered out”. ⚠ marks a dish Purdue lists no ingredients for, so only its name could be checked. A word covers the foods it stands for: beef also blocks steak and burgers; pork also blocks bacon, ham and sausage.'),
      h('div', { class: 'row madd' }, box, ui.button('Add', () => add(box.value))),
      h('div', { class: 'row mquick' }, QUICK.filter((q) => !m.block.includes(q)).map((q) => h('button', { class: 'btn small', type: 'button', onclick: () => add(q) }, '+ ', q))),
      m.block.length ? h('ul', { class: 'mblocks' }, m.block.map(row)) : h('p', { class: 'muted' }, 'Nothing is filtered.'),
      h('h2', { class: 'sect' }, 'Favorites'),
      h('p', { class: 'muted small' }, 'Right-click a dish (long-press on a phone) to favorite it, or pick from every dish served this semester below. Favorites served today are listed under Settings in the tabs on the left, with where to find them.'),
      m.fav.length
        ? h('ul', { class: 'mblocks' }, m.fav.map((f) => h('li', { class: 'mblock' }, h('div', { class: 'mbhead' }, h('span', null, h('span', { class: 'mfav' }, '★ '), f), h('button', { class: 'iconbtn xs', type: 'button', 'aria-label': `Remove ${f} from favorites`, title: 'Remove', onclick: () => { m.fav = m.fav.filter((x) => x !== f); save(); } }, ic('close', 14))))))
        : h('p', { class: 'muted' }, 'No favorites yet.'),
      rotationBrowser(),
      h('h2', { class: 'sect' }, 'Show'),
      h('div', { class: 'seg' }, [[false, 'Everything'], [true, 'Mains only']].map(([v, label]) => h('button', { type: 'button', class: Boolean(m.mainsOnly) === v ? 'on' : null, onclick: () => { m.mainsOnly = v; save(); } }, label))),
      h('p', { class: 'muted small' }, 'Everything lists every dish, with similar ones (sauces, breads, desserts, several pizzas) folded into dropdowns. Mains only also leaves out sides, sauces, breads, desserts and the By Request station. Purdue doesn’t mark which dishes are mains, so this is a guess from the dish names.'),
    ];
  }

  ui.views.menus = async (r) => {
    const today = keyOf(new Date());
    const date = r.date || today;
    let courts;
    try {
      courts = await M.courts();
    } catch (e) {
      return { title: 'Menus', body: failed(e) };
    }
    if (r.court === 'settings') {
      return { crumbs: [{ label: 'Menus', href: '#/menus' }, { label: 'Settings' }], leftNav: menuNav(courts, 'settings', today, today), body: settingsBody() };
    }
    const court = courts.includes(r.court) ? r.court : courts.includes(settings.menus.court) ? settings.menus.court : courts[0];
    if (r.court && court === r.court && settings.menus.court !== court) {
      settings.menus.court = court;
      ui.saveSettings();
    }
    const now = new Date();
    const blocked = M.blocker(settings.menus.block);
    let body;
    try {
      const day = await M.day(court, date);
      const meals = (day.Meals || []).slice().sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
      body = !day.IsPublished && !meals.length
        ? ui.empty(`${court} hasn’t published a menu for ${dayLabel.format(dateOf(date))}.`)
        : [
            date === today ? h('p', { class: 'mnow' }, status(today, day, now).text) : null,
            meals.map((m) => mealSection(date, m, date === today ? now : new Date(0), blocked)),
            day.Notes ? h('p', { class: 'muted small' }, day.Notes) : null,
          ];
    } catch (e) {
      body = failed(e);
    }
    const actions = h('div', { class: 'row mdate' },
      h('a', { class: 'iconbtn', href: href(court, shift(date, -1)), 'aria-label': 'Previous day' }, ic('left')),
      h('span', { class: 'mday' }, date === today ? 'Today' : dayLabel.format(dateOf(date))),
      h('a', { class: 'iconbtn', href: href(court, shift(date, 1)), 'aria-label': 'Next day' }, ic('right')),
      date === today ? null : h('a', { class: 'btn', href: href(court) }, 'Today'));
    return { crumbs: [{ label: 'Menus', href: '#/menus' }, { label: court }], leftNav: menuNav(courts, court, date, today), actions, body };
  };
})();

// Small-screen site: Krillion-style opening, top projects, resume and blog, built from projects.js.

// Blog posts, newest first: { title, date: 'YYYY-MM-DD', body: ['paragraph', ...] }.
// shortcut: posts live here as data; move to Markdown files if there get to be many.
const posts = [];

(() => {
  const root = document.getElementById('mobile');
  const el = (tag, props = {}, ...kids) => { const node = Object.assign(document.createElement(tag), props); node.append(...kids); return node; };
  const links = list => el('p', { className: 'links' }, ...list.map(([text, href]) => el('a', { href, textContent: text })));

  // Top projects: the first four in projects.js.
  root.querySelector('.project-list').append(...projects.slice(0, 4).map(project => {
    const card = el('article', { className: 'project' }, el('h3', { textContent: project.name }), el('p', { className: 'tag', textContent: project.tagline }));
    if (project.image) {
      const [file, alt, width, height] = project.image;
      card.append(el('img', { src: 'assets/' + file, alt, width, height, loading: 'lazy' }));
    } else if (project.art) {
      card.append(el('pre', { textContent: project.art, role: 'img', ariaLabel: project.artAlt || project.name }));
    }
    card.append(el('p', { textContent: project.detail[0] }), links(project.links));
    return card;
  }));

  // Resume, from the Resume window's sections: 0 Skills, 1 Experience, 2 Academics, 3 Projects, 4 Tutoring.
  const resume = projects.find(project => project.name === 'Resume').detail;
  const block = (title, text) => [el('h3', { textContent: title }), el('p', { textContent: text })];
  root.querySelector('.resume').append(
    el('div', { className: 'work-zone' }, el('h3', { textContent: 'Experience' }),
      ...[resume[1], resume[4]].map(text => el('p', { className: 'job', textContent: text }))),
    ...block('Skills', resume[0]), ...block('Academics', resume[2]), ...block('Projects', resume[3])
  );

  root.querySelector('.posts').append(...(posts.length ? posts.map(post => el('details', { className: 'post' },
    el('summary', { textContent: post.title }), el('time', { dateTime: post.date, textContent: post.date }),
    ...post.body.map(text => el('p', { textContent: text })))) : [el('p', { className: 'empty', textContent: 'No posts yet. The first one is still sinking.' })]));

  const dive = root.querySelector('.dive');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  dive.querySelector('.bubbles').append(...Array.from({ length: 9 }, () => {
    const size = 4 + Math.random() * 9;
    const bubble = el('span');
    bubble.style.cssText = `--x:${Math.random() * 100}%;--s:${size}px;--t:${7 + Math.random() * 7}s;--delay:${-Math.random() * 14}s`;
    return bubble;
  }));

  // Kelp fronds and fish, drawn here so their sizes and timing can vary.
  const svg = (markup, attrs) => { const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); node.innerHTML = markup; for (const k in attrs) node.setAttribute(k, attrs[k]); return node; };
  const frond = (left, height, color) => {
    let d = 'M10 100Q6 50 10 0';
    for (let y = 92; y > 6; y -= 9) d += `M10 ${y}l-8 -7M10 ${y - 4}l8 -7`;
    return svg(`<path d="${d}"/>`, { viewBox: '0 0 20 100', preserveAspectRatio: 'none', style: `left:${left}%;height:${height}%;width:${height * 0.12}svh;--c:${color};--t:${4 + Math.random() * 3}s;--delay:${-Math.random() * 6}s` });
  };
  const sea = dive.querySelector('.sea');
  const deep = el('div', { className: 'kelps-deep' });
  sea.append(deep);
  for (const [box, count, colors] of [[sea.querySelector('.kelps'), 10, ['#0e3a63', '#0b2e52', '#08223f']], [deep, 8, ['#0b1d38', '#091830']]]) {
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 82 + Math.random() * 18 : Math.random() * 20;
      box.append(frond(side - 3, 30 + Math.random() * 45, colors[i % colors.length]));
    }
  }
  sea.querySelector('.fish').append(...Array.from({ length: 9 }, (_, i) => svg(
    '<g><path fill="currentColor" d="M0 2h1V1h1v1h1V1h1V0h4v1h1v1h1v1H9v1H8v1H4V4H3V3H2v1H1V3H0z"/></g>',
    { viewBox: '0 0 10 5', 'shape-rendering': 'crispEdges', class: i % 2 ? 'back' : '',
      style: `color:${i < 6 ? '#0a2a4a' : '#0b1c34'};--y:${i < 6 ? 9 + Math.random() * 20 : 72 + Math.random() * 22}%;--s:${12 + Math.random() * 12}px;--t:${14 + Math.random() * 16}s;--delay:${-Math.random() * 30}s` })));

  // Sections drift up as they scroll into view.
  if (!reduced && 'IntersectionObserver' in window) {
    const watcher = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('seen'); watcher.unobserve(entry.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    root.querySelectorAll('h2, .project, .work-zone, .resume > :not(.work-zone), .post, .empty, .zone, .floor').forEach(node => {
      node.classList.add('reveal'); watcher.observe(node);
    });
  }

  // Opening: plays once per session on small screens, never under reduced motion. Tap to skip.
  const depth = dive.querySelector('.depth'), score = dive.querySelector('.score'), typed = dive.querySelector('.typed');
  const timer = dive.querySelector('.timer'), diveBtn = dive.querySelector('.dive-btn');
  const small = matchMedia('(max-width: 899px), (max-height: 639px), (max-aspect-ratio: 5/4)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('dove') === '1'; sessionStorage.setItem('dove', '1'); } catch {}
  if (!small || seen || reduced) return;

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const kick = (node, name) => { node.classList.remove(name); void node.offsetWidth; node.classList.add(name); };
  const name = typed.textContent;
  const finish = () => {
    timers.forEach(clearTimeout);
    dive.classList.remove('playing', 'zap', 'sinking');
    typed.textContent = name; diveBtn.classList.remove('press'); depth.textContent = '1,000m'; score.textContent = '100';
    removeEventListener('pointerdown', finish); removeEventListener('keydown', finish);
  };
  addEventListener('pointerdown', finish); addEventListener('keydown', finish);

  dive.classList.add('playing');
  typed.textContent = ''; depth.textContent = '0m'; score.textContent = '0';
  // The 25 s clock starts with the card; it only matters for show.
  for (let sec = 1; sec <= 8; sec++) at(450 + sec * 1000, () => { timer.textContent = 25 - sec; });
  let t = 1300;
  [...name].forEach((_, i) => at(t += 95 + Math.random() * 70, () => { typed.textContent = name.slice(0, i + 1); }));
  at(t += 550, () => diveBtn.classList.add('press'));
  at(t += 160, () => { diveBtn.classList.remove('press'); dive.classList.add('zap'); });
  // The sea scrolls up 2.4s while the answer sinks and the depth counter cranks.
  at(t += 450, () => dive.classList.add('sinking'));
  for (let step = 1; step <= 8; step++) at(t + step * 290, () => { depth.textContent = (step * 125).toLocaleString('en-US') + 'm'; kick(depth, 'jolt'); });
  at(t += 2600, () => { dive.classList.remove('playing', 'zap', 'sinking'); dive.classList.add('landing'); });
  at(t + 900, () => { score.textContent = '100'; kick(score, 'slam'); finish(); });
})();

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

  // Opening: plays once per session on small screens, never under reduced motion. Tap to skip.
  const dive = root.querySelector('.dive');
  const depth = dive.querySelector('.depth'), score = dive.querySelector('.score'), typed = dive.querySelector('.typed');
  const small = matchMedia('(max-width: 899px), (max-height: 639px), (max-aspect-ratio: 5/4)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('dove') === '1'; sessionStorage.setItem('dove', '1'); } catch {}
  if (!small || seen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const kick = (node, name) => { node.classList.remove(name); void node.offsetWidth; node.classList.add(name); };
  const name = typed.textContent;
  const finish = () => {
    timers.forEach(clearTimeout);
    dive.classList.remove('playing', 'zap');
    typed.textContent = name; depth.textContent = '1,000m'; score.textContent = '100';
    removeEventListener('pointerdown', finish); removeEventListener('keydown', finish);
  };
  addEventListener('pointerdown', finish); addEventListener('keydown', finish);

  dive.classList.add('playing');
  typed.textContent = ''; depth.textContent = '0m'; score.textContent = '0';
  let t = 900;
  [...name].forEach((_, i) => at(t += 95 + Math.random() * 70, () => { typed.textContent = name.slice(0, i + 1); }));
  at(t += 650, () => dive.classList.add('zap'));
  at(t += 900, () => { dive.classList.replace('playing', 'landing'); dive.classList.remove('zap'); });
  for (let step = 1; step <= 8; step++) at(t + 700 + step * 140, () => { depth.textContent = (step * 125).toLocaleString('en-US') + 'm'; kick(depth, 'jolt'); });
  at(t + 1950, () => { score.textContent = '100'; kick(score, 'slam'); finish(); });
})();

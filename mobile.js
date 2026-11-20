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

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sections drift up as they scroll into view.
  if (!reduced && 'IntersectionObserver' in window) {
    const watcher = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('seen'); watcher.unobserve(entry.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    root.querySelectorAll('h2, .project, .work-zone, .resume > :not(.work-zone), .post, .empty, .zone, .floor').forEach(node => {
      node.classList.add('reveal'); watcher.observe(node);
    });
  }

})();

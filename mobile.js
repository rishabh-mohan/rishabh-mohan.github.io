// Small-screen site: Krillion-style opening, top projects, resume and blog, built from projects.js.

// Blog posts, newest first: { title, date: 'YYYY-MM-DD', body: ['paragraph', ...] }.
// shortcut: posts live here as data; move to Markdown files if there get to be many.
const posts = [];

(() => {
  const root = document.getElementById('mobile');
  const el = (tag, props = {}, ...kids) => { const node = Object.assign(document.createElement(tag), props); node.append(...kids); return node; };
  const links = list => el('p', { className: 'links' }, ...list.map(([text, href]) => el('a', { className: 'btn', href, textContent: `${text} ↗` })));

  // Top projects: the first four in projects.js.
  root.querySelector('.project-list').append(...projects.slice(0, 4).map((project, i) => {
    const card = el('article', { className: 'project' },
      el('p', { className: 'kicker', textContent: `PROJECT ${String(i + 1).padStart(2, '0')}` }),
      el('h3', { textContent: project.name }),
      el('p', { className: 'tag', textContent: project.tagline }));
    if (project.image) {
      const [file, alt, width, height] = project.image;
      card.append(el('figure', { className: 'media' }, el('img', { src: 'assets/' + file, alt, width, height, loading: 'lazy' })));
    } else if (project.art) {
      card.append(el('figure', { className: 'media' }, el('pre', { textContent: project.art, role: 'img', ariaLabel: project.artAlt || project.name })));
    }
    card.append(el('p', { className: 'body', textContent: project.detail[0] }), links(project.links));
    return card;
  }));

  // Resume, from the Resume window's sections: 0 Skills, 1 Experience, 2 Academics, 3 Projects, 4 Tutoring.
  const resume = projects.find(project => project.name === 'Resume').detail;
  const block = (title, ...kids) => el('div', { className: 'block' }, el('h3', { textContent: title }), ...kids);
  // "Role at Org (Dates): what I did" -> a timeline entry.
  const job = text => {
    const [, role, org, dates, body] = /^(.+?) at (.+?) \((.+?)\): (.+)$/.exec(text) || [, text, '', '', ''];
    return el('li', { className: 'job' },
      el('p', { className: 'when', textContent: dates }),
      el('p', { className: 'role', textContent: role }),
      el('p', { className: 'org', textContent: org }),
      el('p', { className: 'body', textContent: body }));
  };
  // "Languages: a, b. Frameworks: c, d." -> labelled tag groups.
  const skills = resume[0].replace(/\.$/, '').split('. ').map(group => {
    const [label, items] = group.split(': ');
    return el('div', { className: 'skill-group' }, el('p', { className: 'label', textContent: label }),
      el('ul', { className: 'tags' }, ...items.split(', ').map(item => el('li', { textContent: item }))));
  });
  // Two schools, split after the graduation year.
  const schools = resume[2].replace(/\.$/, '').split(/(?<=\d{4})\. /).map(line => {
    const [title, ...rest] = line.split(', ');
    return el('li', {}, el('p', { className: 'role', textContent: title }), el('p', { className: 'org', textContent: rest.join(' · ') }));
  });
  // "Name (what it is), ..." -> a list with the description dimmed.
  const builds = resume[3].replace(/\.$/, '').split(/, (?:and )?/).map(item => {
    const [, name, what] = /^(.+?) \((.+)\)$/.exec(item) || [, item, ''];
    return el('li', {}, el('span', { className: 'role', textContent: name }), what ? el('span', { className: 'org', textContent: ` ${what}` }) : '');
  });
  root.querySelector('.resume').append(
    block('Experience', el('ol', { className: 'timeline' }, job(resume[1]), job(resume[4]))),
    block('Skills', ...skills),
    block('Education', el('ul', { className: 'plain' }, ...schools)),
    block('Also built', el('ul', { className: 'plain' }, ...builds)),
  );

  // Blog: posts open in place. With none yet, show a Krillion-style miss card.
  root.querySelector('.posts').append(...(posts.length ? posts.map(post => el('details', { className: 'post' },
    el('summary', {}, el('time', { dateTime: post.date, textContent: post.date }), el('span', { textContent: post.title })),
    ...post.body.map(text => el('p', { className: 'body', textContent: text })))) : [
    el('div', { className: 'empty' },
      el('p', { className: 'miss', textContent: 'NOTHING LANDED' }),
      el('p', { className: 'dash', textContent: '—' }),
      el('p', { className: 'body', textContent: 'No posts yet. The first one is still sinking.' })),
  ]));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sections drift up as they scroll into view.
  if (!reduced && 'IntersectionObserver' in window) {
    const watcher = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('seen'); watcher.unobserve(entry.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    root.querySelectorAll('.sec-head, .project, .resume .block, .post, .empty, .zone, .floor').forEach(node => {
      node.classList.add('reveal'); watcher.observe(node);
    });
  }

})();

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
    const more = mobileProjectDetails[project.name];
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
    card.append(el('p', { className: 'body', textContent: project.detail[0] }));
    if (more) {
      card.append(
        el('ul', { className: 'project-highlights body' }, ...more.highlights.map(text => el('li', { textContent: text }))),
        el('ul', { className: 'tags project-stack', ariaLabel: 'Technologies' }, ...more.stack.map(text => el('li', { textContent: text })))
      );
    }
    card.append(links(project.links));
    return card;
  }));

  // Resume, from the Resume window's sections: 0 Skills, 1 Experience, 2 Academics, 3 Projects, 4 Tutoring.
  const resume = projects.find(project => project.name === 'Resume').detail;
  const block = (title, ...kids) => el('div', { className: 'block' }, el('h3', { textContent: title }), ...kids);
  const job = entry => el('li', { className: 'job' },
    el('p', { className: 'when', textContent: entry.dates }),
    el('h4', { className: 'role', textContent: entry.role }),
    el('p', { className: 'org', textContent: entry.org }),
    el('ul', { className: 'experience-points body' }, ...entry.bullets.map(text => el('li', { textContent: text }))));
  const skills = mobileBackground.skills.map(group => el('div', { className: 'skill-group' },
    el('h4', { className: 'role', textContent: group.name }),
    el('p', { className: 'body', textContent: group.description }),
    el('ul', { className: 'tags' }, ...group.tools.map(text => el('li', { textContent: text })))));
  const schools = mobileBackground.education.map(entry => el('li', {},
    el('h4', { className: 'role', textContent: entry.school }),
    el('p', { className: 'org', textContent: entry.qualification }),
    el('p', { className: 'body', textContent: entry.note })));
  // "Name (what it is), ..." -> a list with the description dimmed.
  const builds = resume[3].replace(/\.$/, '').split(/, (?:and )?/)
    .filter(item => !/^(?:d31|rr-scraper) \(/.test(item)).map(item => {
    const [, name, what] = /^(.+?) \((.+)\)$/.exec(item) || [, item, ''];
    return el('li', {}, el('span', { className: 'role', textContent: name }), what ? el('span', { className: 'org', textContent: ` ${what}` }) : '');
  });
  builds.push(...mobileAdditionalProjects.map(project => el('li', {},
    el('p', { className: 'role', textContent: project.name }),
    el('p', { className: 'body', textContent: project.description }),
    ...(project.links.length ? [links(project.links)] : [])
  )));
  root.querySelector('.resume').append(
    block('A little background', el('p', { className: 'body', textContent: mobileBackground.intro })),
    block('Experience', el('ol', { className: 'timeline' }, ...mobileBackground.experience.map(job))),
    block('What I work with', ...skills),
    block('Education', el('ul', { className: 'plain' }, ...schools)),
    block('Also built', el('ul', { className: 'plain' }, ...builds)),
  );

  // Blog: posts open in place; the empty state points visitors to existing work.
  root.querySelector('.posts').append(...(posts.length ? posts.map(post => el('details', { className: 'post' },
    el('summary', {}, el('time', { dateTime: post.date, textContent: post.date }), el('span', { textContent: post.title })),
    ...post.body.map(text => el('p', { className: 'body', textContent: text })))) : [
    el('div', { className: 'empty' },
      el('h3', { className: 'empty-title', textContent: 'No posts published yet' }),
      el('p', { className: 'body', textContent: 'For now, the project repositories have setup guides and more detail about how the tools work.' }),
      links([['Explore GitHub', 'https://github.com/rishabh-mohan']])),
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

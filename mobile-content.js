// Mobile copy checked against public repository READMEs and local project READMEs, November 2026.
// Public sources: github.com/rishabh-mohan/{brightspace-canvas-wrapper,d31,pack-studio,rr-scraper,hydrogen-bridge,purdue-registration-planner}.
// Additional local sources: canvas-personal, purdue/purdue-course-request-planner.
// Shared introductions live in projects.js; these are mobile-only supporting details.
// Order highlights by everyday usefulness, not implementation effort or release history.
const mobileProjectDetails = {
  'Brightspace Canvas Wrapper': {
    stack: ['JavaScript', 'Browser extension', 'Brightspace'],
    highlights: [
      'See what is due next, open course materials and check grades from one dashboard.',
      'Bring Gradescope and Ed Discussion assignments into the same task lists and calendar, without duplicate reminders.',
      'Try what-if scores to see how upcoming assignments could affect a course grade.'
    ]
  },
  'd31 + Pack Studio': {
    stack: ['Dart', 'Flutter', 'JSON content packs', 'Android'],
    highlights: [
      'Balance study, work and rest while managing time, money and stamina. Branching encounters respond to choices and game state.',
      'Choose a character and traits, work toward exams, and explore different outcomes across runs.',
      'Make your own campaigns with Pack Studio: edit characters, places, items and story choices through Android forms.'
    ]
  },
  'rr-scraper': {
    stack: ['Node.js', 'Playwright', 'Cheerio', 'PDFKit', 'JSZip'],
    highlights: [
      'Find a story by title or paste its link, then save it as TXT, PDF or EPUB for offline reading.',
      'Download the whole story as one book or split it into smaller chapter groups.',
      'Rerun an interrupted download to retry missing exports while keeping completed files.'
    ]
  },
  'Gemini Bridge': {
    stack: ['Python', 'Playwright', 'OpenCode', 'OpenAI-compatible API'],
    highlights: [
      'Ask a coding agent to read, explain and edit project files directly from OpenCode.',
      'Choose among the models the organization’s Gemini Enterprise account offers, discovered at startup.',
      'Include screenshots or PDFs when a task needs more context than text alone.'
    ]
  }
};

const mobileAdditionalProjects = [
  {
    name: 'Purdue Course Request Planner',
    description: 'A Chrome extension prototype that helps Purdue students compare course requests before submitting them. It previews a weekly timetable beside UniTime and flags overlapping meetings; final assigned schedules may differ.',
    links: [['GitHub', 'https://github.com/rishabh-mohan/purdue-registration-planner']]
  }
];

// Background facts from the resume and applicant profile; no inferred proficiency ratings.
const mobileBackground = {
  intro: 'I’m Rishabh, a computer science student at Purdue. I build tools for everyday tasks, from keeping up with coursework to reading offline. My experience also includes testing payment software and helping students learn math.',
  experience: [
    {
      role: 'Technical Systems Analyst Intern', org: 'Ayris Global', dates: 'May 2024 – July 2026 (part-time; full-time summers)',
      bullets: [
        'Led a two-person team that drafted the provisional patent application for Assure PAT, making sure it accurately defined the test-card request and assignment workflows.',
        'Ran functional and visual QA on Assure PAT, documenting reproducible edge cases and tracking defects through structured reports.',
        'Helped present the platform to Discover’s certification, production and acceptance teams.'
      ]
    },
    {
      role: 'Lead Math Tutor', org: 'Eye Level Learning Center', dates: 'Nov 2024 – Aug 2026',
      bullets: [
        'Tutored 200+ students, from pre-K fundamentals through trigonometry, adapting explanations to different ages and levels.',
        'Redesigned a grading workflow that most tutors adopted, making it easier for the team to review student work.'
      ]
    }
  ],
  skills: [
    { name: 'Web tools & automation', description: 'Browser interfaces, everyday workflows and offline exports.', tools: ['JavaScript', 'HTML/CSS', 'Node.js', 'Playwright', 'Cheerio'] },
    { name: 'Apps & interactive systems', description: 'Games, content editors and simulation engines.', tools: ['Java', 'Dart', 'Flutter', 'JSON'] },
    { name: 'Testing & collaboration', description: 'Reproducing issues, checking behavior and communicating changes.', tools: ['Functional QA', 'Visual QA', 'Git', 'GitHub Actions', 'Python'] }
  ],
  education: [
    { school: 'Purdue University', qualification: 'B.S. in Computer Science', note: 'Expected May 2029 · accelerated degree plan' },
    { school: 'Adlai E. Stevenson High School', qualification: 'Highest Honors', note: '4.25 weighted GPA' }
  ]
};

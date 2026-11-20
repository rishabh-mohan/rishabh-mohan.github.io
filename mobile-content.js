// Mobile copy checked against public repository READMEs and local project READMEs, November 2026.
// Public sources: github.com/rishabh-mohan/{brightspace-canvas-wrapper,d31,pack-studio,rr-scraper,hydrogen-bridge,gemini-api}.
// Additional local sources: canvas-personal, gemini-api, purdue/purdue-course-request-planner.
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
      'Choose among the models available through an existing Gemini Enterprise account, without a separate API key.',
      'Include screenshots or PDFs when a task needs more context than text alone.'
    ]
  }
};

const mobileAdditionalProjects = [
  {
    name: 'Purdue Course Request Planner',
    description: 'A Chrome extension prototype that helps Purdue students compare course requests before submitting them. It previews a weekly timetable beside UniTime and flags overlapping meetings; final assigned schedules may differ.',
    links: []
  },
  {
    name: 'gemini-api',
    description: 'A JavaScript command-line experiment that sends prompts to Gemini Enterprise and returns responses through browser automation, bringing a browser-only service into scripts and terminal workflows.',
    links: [['GitHub', 'https://github.com/rishabh-mohan/gemini-api']]
  }
];

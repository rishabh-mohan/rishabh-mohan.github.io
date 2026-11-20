// Mobile copy checked against public repository READMEs and local project READMEs, November 2026.
// Public sources: github.com/rishabh-mohan/{brightspace-canvas-wrapper,d31,pack-studio,rr-scraper,hydrogen-bridge,gemini-api}.
// Additional local sources: canvas-personal, gemini-api, purdue/purdue-course-request-planner.
// Shared introductions live in projects.js; these are mobile-only supporting details.
const mobileProjectDetails = {
  'Brightspace Canvas Wrapper': {
    stack: ['JavaScript', 'Browser extension', 'Brightspace'],
    highlights: [
      'Plan ahead with a shared calendar and what-if grades that account for dropped assignments.',
      'Connect Gradescope and Ed Discussion to bring work together without listing the same assignment twice.',
      'Pin course resources, submit files and reply to discussions from one interface, using an existing school sign-in.'
    ]
  },
  'd31 + Pack Studio': {
    stack: ['Dart', 'Flutter', 'JSON content packs', 'Android'],
    highlights: [
      'Balance study, work and rest while managing time, money and stamina. Branching encounters respond to choices and game state.',
      'Create characters, locations and events through Pack Studio’s forms, with automatic saving and validation by the same engine that runs the game.',
      'Start from an example campaign, add artwork and colors, and build a new scenario with editable JSON content packs.'
    ]
  },
  'rr-scraper': {
    stack: ['Node.js', 'Playwright', 'Cheerio', 'PDFKit', 'JSZip'],
    highlights: [
      'Choose TXT, PDF or EPUB, with the whole story in one file or split into chapter groups.',
      'Recover from interrupted downloads with chapter retries, protected file writes and reruns that skip completed exports.',
      'Runs on Windows and macOS with automatic first-run setup. Exports focus on readable text rather than illustrations or page styling.'
    ]
  },
  'Gemini Bridge': {
    stack: ['Python', 'Playwright', 'OpenCode', 'OpenAI-compatible API'],
    highlights: [
      'Connect OpenCode to read and edit project files, select an available model, and include images or PDFs in a request.',
      'An OpenAI-compatible interface connects coding clients to a signed-in browser, with queued requests, cancellation and timeout handling.',
      'Uses the organization’s normal sign-in flow. An independent project, not an official Google integration.'
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

const sections = ['Intro', 'Demo', 'Inspiration', 'Implementation', 'Impact', 'Check It Out'];
// A project can name its own six sections; otherwise it uses the shared labels above.
const labelsFor = project => project.sections || sections;

const projects = [
  {
    name: 'Brightspace Canvas Wrapper',
    tagline: 'A Firefox extension that gives Brightspace a Canvas-style dashboard.',
    detail: [
      'I built a Canvas-style dashboard for Brightspace so I could see courses, grades, assignments, and the calendar in one place.',
      'Try two sample classes and see how an ungraded assignment could change your grade.',
      'The dashboard grew to include what-if grades alongside optional Gradescope and Ed Discussion integrations.',
      'A Firefox extension combines Brightspace course data with its own dashboard and optional integrations.',
      'It brings the information I check most often into one view, from upcoming due dates to grade scenarios.',
      'Find the extension source and setup instructions on GitHub.'
    ],
    image: ['brightspace-demo-dashboard.webp', 'Brightspace dashboard with course cards and upcoming assignments', 1200, 708],
    demo: 'grades',
    links: [['GitHub', 'https://github.com/rishabh-mohan/brightspace-canvas-wrapper']]
  },
  {
    name: 'd31 + Pack Studio',
    tagline: 'A life-sim engine whose scenarios are all JSON, plus an Android pack editor.',
    detail: [
      'I wanted a version of 31-Day Mode whose scenarios could be changed without rewriting the game.',
      'Try a short, simplified turn to see how an activity trades time for a stat.',
      'The 31-Day Mode rebuild and its Android pack editor grew into companion projects.',
      'The Dart and Flutter engine reads calendars, locations, items, and branching events from JSON. Pack Studio validates packs with the same engine.',
      'A campaign can be authored as data and run without an engine change.',
      'Explore the game engine and the companion editor.'
    ],
    image: ['d31-gameplay.webp', 'd31 gameplay showing the schedule and activity choices', 466, 960],
    extra: ['pack-studio-screenshot.webp', 'Pack Studio showing its pack tools', 457, 960],
    demo: 'd31',
    links: [['d31 on GitHub', 'https://github.com/rishabh-mohan/d31'], ['Pack Studio on GitHub', 'https://github.com/rishabh-mohan/pack-studio']]
  },
  {
    name: 'rr-scraper',
    tagline: 'A CLI that saves Royal Road stories as TXT, PDF, or EPUB.',
    detail: [
      'I wanted to take Royal Road stories offline and read them in the format that suited me.',
      'Choose a sample book format and preview the resulting filename.',
      'The tool covers both finding a story by title and opening a story directly by URL.',
      'A Node.js CLI collects chapters and exports TXT, PDF, or EPUB.',
      'An export turns a serialized story into a single file for offline reading.',
      'See the CLI source, usage, and the available export formats.'
    ],
    image: ['rr-scraper-demo-still.svg', 'Terminal replay of a Royal Road story export', 650, 520],
    demo: 'export',
    reading: true,
    links: [['GitHub', 'https://github.com/rishabh-mohan/rr-scraper']]
  },
  {
    name: 'Gemini Bridge',
    tagline: 'Use a Gemini Enterprise web account as a terminal coding agent, no API key needed.',
    detail: [
      'Gemini Bridge lets me use my school’s Gemini Enterprise web account as a coding agent in the terminal.',
      'Point OpenCode at the bridge, pick a model with /models, and it reads and edits files like any coding agent.',
      'Purdue offers Gemini Enterprise in the browser, but students don’t get an API key to use it from coding tools.',
      'A Python server mimics the OpenAI API and relays each request through a signed-in Chromium window. Tool use is emulated through the chat.',
      'Any OpenAI-compatible tool can reach the models my school already offers, from Gemini to Claude.',
      'Find the setup steps, supported models, and launcher on GitHub.'
    ],
    art: 'local client\n    |\n    v\n[ bridge.py ]  --->  Gemini',
    artAlt: 'Diagram: a local client sends requests to bridge.py, which relays them to Gemini',
    links: [['hydrogen-bridge on GitHub', 'https://github.com/rishabh-mohan/hydrogen-bridge']]
  },
  {
    name: 'Currently Working On',
    tagline: 'What I’m building and improving right now.',
    // This window is a list of projects, so each section is named after one.
    sections: ['This Site', 'D30 Mode', 'rr-scraper', 'Gemini Bridge', 'Brightspace Wrapper', 'Pack Studio'],
    detail: [
      'This portfolio: six windows you can rearrange, framed by ASCII scenery that changes theme on every shuffle.',
      'A clean-room Flutter simulation engine with an editable JSON content pack: 321 branching events and 10,755 nodes, checked by 27 automated tests and 200 seeded runs.',
      'Exports Royal Road stories as TXT, bookmarked PDF, or EPUB 3, with retries, atomic writes, and 9 automated tests.',
      'An OpenAI-compatible server that relays coding-agent requests through a signed-in Gemini Enterprise browser window.',
      'A Firefox extension that gives Brightspace a Canvas-style dashboard, with what-if grades and optional Gradescope and Ed Discussion integrations.',
      'An Android editor that validates d31 content packs with the same engine the game uses. Find all of these on GitHub.'
    ],
    art: '+---+ +---+ +---+\n| 1 | | 2 | | 3 |\n+---+ +---+ +---+\n| 4 | | 5 | | 6 |\n+---+ +---+ +---+',
    artAlt: 'Diagram: six numbered windows in a three-by-two grid',
    links: [['GitHub', 'https://github.com/rishabh-mohan']]
  },
  {
    name: 'Resume',
    tagline: 'Purdue CS student, payment-systems analyst intern, and lead math tutor.',
    sections: ['Skills', 'Experience', 'Academics', 'Projects', 'Tutoring', 'Full Resume'],
    detail: [
      'Languages: JavaScript, Java, HTML/CSS, SQL (PostgreSQL), R, Python, Dart. Frameworks: Node.js, Playwright, Cheerio, PDFKit, JSZip, Flutter. Tools: Git, LaTeX, JSON, ADB, Regex, Linux.',
      'Technical Systems Analyst Intern at Ayris Global (May 2024 – July 2026): drafted a provisional patent for the Assure PAT payment-testing platform, ran functional and visual QA, and helped present it to Discover’s certification teams.',
      'B.S. in Computer Science at Purdue University, expected May 2029. Adlai E. Stevenson High School, Highest Honors, 4.25 weighted GPA.',
      'D30 Mode (Flutter simulation engine), Royal Road Text Scraper (Node.js exporter), Modular Maze Solver (Java pathfinding), and two TTRPG campaign engines built in Google Sheets.',
      'Lead Math Tutor at Eye Level Learning Center (Nov 2024 – Aug 2026): tutored 200+ students from pre-K through trigonometry and redesigned a grading workflow most tutors adopted.',
      'Download the full one-page resume as a PDF, or find me on LinkedIn and GitHub.'
    ],
    art: ' ____________\n|            |\n|   RESUME   |\n|  --------  |\n|  --------  |\n|  -----     |\n|____________|',
    artAlt: 'Drawing of a one-page resume',
    links: [['Resume (PDF)', 'assets/Rishabh-Mohan-Resume.pdf'], ['LinkedIn', 'https://www.linkedin.com/in/mohan-rishabh'], ['GitHub', 'https://github.com/rishabh-mohan']]
  }
];

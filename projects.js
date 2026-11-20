const sections = ['Intro', 'Demo', 'Inspiration', 'Implementation', 'Impact', 'Check It Out'];
// A project can name its own six sections; otherwise it uses the shared labels above.
const labelsFor = project => project.sections || sections;

const projects = [
  {
    name: 'Brightspace Canvas Wrapper',
    icon: 'brightspace-icon.png',
    tagline: 'A Chrome and Firefox extension that gives Brightspace a Canvas-style dashboard.',
    detail: [
      'A browser extension that brings courses, deadlines and grades into one Canvas-style dashboard for Brightspace students. Available for Chrome and Firefox.',
      'The real extension, running on two made-up classes. Open a course to browse its modules, assignments and announcements, try what-if grades, or check the calendar.',
      'Coursework is often spread across several sites. The wrapper brings Brightspace, Gradescope and Ed Discussion together, combining matching assignments to avoid duplicate reminders.',
      'The JavaScript extension uses an existing school sign-in to show course modules, pinned resources, file submissions and discussion replies in one interface.',
      'Students can plan ahead with a shared calendar and estimate grade outcomes with what-if scores that account for dropped assignments.',
      'Install from the Chrome Web Store or Firefox Add-ons, or explore the source on GitHub.'
    ],
    image: ['brightspace-demo-dashboard.webp', 'Brightspace dashboard with course cards and upcoming assignments', 1200, 708],
    // Static build of the extension on its dev-server data (website-notes/tools/build-bsx-demo.js).
    embed: 'd2l/home/#/',
    links: [['Chrome Web Store', 'https://chromewebstore.google.com/detail/brightspace-canvas-wrappe/ediicphlmlkiglmhnmfdkinefbnbckbp'], ['Firefox Add-ons', 'https://addons.mozilla.org/en-US/firefox/addon/brightspace-canvas-wrapper/'], ['GitHub', 'https://github.com/rishabh-mohan/brightspace-canvas-wrapper']]
  },
  {
    name: 'd31 + Pack Studio',
    icon: ['d31-icon.png', 'pack-studio-icon.png'],
    tagline: 'Balance study, work and rest, then create your own campaigns with Pack Studio.',
    detail: [
      'A playable life-sim prototype where daily choices shape a character’s progress. Manage time, money and stamina, prepare for exams, and explore branching stories. Pack Studio lets you create your own campaigns on Android.',
      'd31 is a clean-room rebuild of Korean Student Simulator’s 31-Day Mode. Play the original game to see what it recreates.',
      'Rebuilt from 31-Day Mode, the simulation balances study, work and rest against time, money and stamina. Branching encounters respond to choices and game state.',
      'Pack Studio lets creators edit characters, places, items and story choices through forms. The Flutter game reads those campaigns from JSON content packs.',
      'Creators can start from an example campaign, add artwork and colors, and build a new scenario without changing engine code.',
      'Explore the game engine and the companion editor.'
    ],
    image: ['d31-gameplay.webp', 'd31 gameplay showing the schedule and activity choices', 466, 960],
    extra: ['pack-studio-screenshot.webp', 'Pack Studio showing its pack tools', 457, 960],
    gallery: [
      ['d31-gameplay.webp', 'd31: schedule and activity choices', 466, 960],
      ['pack-studio-screenshot.webp', 'Pack Studio: create or open a content pack', 457, 960],
      ['pack-studio-editor.webp', 'Pack Studio: edit locations, traits, characters, books and items', 1080, 2288]
    ],
    demo: 'd31',
    links: [['d31 on GitHub', 'https://github.com/rishabh-mohan/d31'], ['Pack Studio on GitHub', 'https://github.com/rishabh-mohan/pack-studio']]
  },
  {
    name: 'rr-scraper',
    icon: 'rr-scraper-icon.svg',
    tagline: 'A CLI that saves Royal Road stories as TXT, PDF, or EPUB.',
    detail: [
      'A terminal tool for taking Royal Road stories offline. Search by title or paste a story link, then export a book in the format that suits your reader.',
      'How to use it: run one command, answer four prompts, and the finished book lands in its own folder.',
      'Serialized fiction can span hundreds of web pages. The exporter gathers chapters into a whole book or smaller chapter groups for offline reading.',
      'The Node.js tool gathers chapters with Playwright and saves them as TXT, PDF or EPUB. If a download is interrupted, rerun it to retry missing exports while keeping completed files.',
      'Readers can choose a format for their device on Windows or macOS, with automatic first-run setup. Exports focus on text rather than illustrations or page styling.',
      'See the CLI source, usage, and the available export formats.'
    ],
    image: ['rr-scraper-demo-still.svg', 'Terminal replay of a Royal Road story export', 650, 520],
    // Currently Reading: [title, author, Goodreads page, cover in assets/].
    reading: [
      ['Mother of Learning', 'Domagoj Kurmaić', 'https://www.goodreads.com/book/show/59661342', 'books/mother-of-learning.webp'],
      ['Atomic Habits', 'James Clear', 'https://www.goodreads.com/book/show/40121378', 'books/atomic-habits.webp'],
      ['Dungeon Crawler Carl: A Parade of Horribles', 'Matt Dinniman', 'https://www.goodreads.com/book/show/228928465', 'books/parade-of-horribles.webp'],
      ['Incendiaries: Advanced Improvised Explosives', 'Seymour Lecker', 'https://www.goodreads.com/book/show/2470797', 'books/incendiaries.webp']
    ],
    links: [['GitHub', 'https://github.com/rishabh-mohan/rr-scraper']]
  },
  {
    name: 'Gemini Bridge',
    icon: 'gemini-bridge-icon.svg',
    image: ['gemini-bridge-diagram.svg', 'OpenCode sends coding requests through a local Gemini Bridge to a signed-in Gemini Enterprise browser session; responses return to OpenCode.', 720, 400],
    tagline: 'Use a Gemini Enterprise web account as a terminal coding agent, no API key needed.',
    detail: [
      'A bridge from browser-based Gemini Enterprise accounts to terminal coding tools. Built to make Purdue’s existing AI access usable in a coding workflow without a separate API key.',
      'Point OpenCode at the bridge, pick a model with /models, and it reads and edits files like any coding agent.',
      'Purdue offers Gemini Enterprise in the browser, but students don’t get an API key to use it from coding tools.',
      'A Python bridge connects OpenCode to a signed-in Gemini Enterprise browser. Choose an available model and include screenshots or PDFs alongside requests to read, explain or edit project files.',
      'Developers can use their organization’s available models inside OpenCode with the normal sign-in flow. This is an independent project, not an official Google integration.',
      'Find the setup steps, supported models, and launcher on GitHub.'
    ],
    links: [['hydrogen-bridge on GitHub', 'https://github.com/rishabh-mohan/hydrogen-bridge']]
  },
  {
    name: 'Currently Working On',
    tagline: 'What I’m building and improving right now.',
    // This window is a list of projects, so each section is named after one.
    sections: ['This Site', 'd31', 'rr-scraper', 'Gemini Bridge', 'Brightspace Wrapper', 'Pack Studio'],
    detail: [
      'This portfolio: six windows you can rearrange, framed by ASCII scenery that changes theme on every shuffle.',
      'A life-sim where players balance study, work and rest, prepare for exams and explore branching stories.',
      'Take Royal Road stories offline as TXT, PDF or EPUB, with chapter grouping and recovery from interrupted downloads.',
      'Use an existing Gemini Enterprise account to read, explain and edit code in OpenCode, without a separate API key.',
      'A Chrome and Firefox extension that brings courses, deadlines and what-if grades together, with optional Gradescope and Ed Discussion integrations.',
      'Create d31 campaigns on Android by editing characters, places, items and story choices through forms. Find all of these on GitHub.'
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
      'd31 (Flutter simulation engine), rr-scraper (Node.js exporter), Modular Maze Solver (Java pathfinding), and two TTRPG campaign engines built in Google Sheets.',
      'Lead Math Tutor at Eye Level Learning Center (Nov 2024 – Aug 2026): tutored 200+ students from pre-K through trigonometry and redesigned a grading workflow most tutors adopted.',
      'Download the full one-page resume as a PDF, or find me on LinkedIn and GitHub.'
    ],
    art: ' ____________\n|            |\n|   RESUME   |\n|  --------  |\n|  --------  |\n|  -----     |\n|____________|',
    artAlt: 'Drawing of a one-page resume',
    links: [['Resume (PDF)', 'assets/Rishabh-Mohan-Resume.pdf'], ['LinkedIn', 'https://www.linkedin.com/in/mohan-rishabh'], ['GitHub', 'https://github.com/rishabh-mohan']]
  }
];

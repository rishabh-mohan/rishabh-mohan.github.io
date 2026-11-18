const sections = ['Intro', 'Demo', 'History', 'Implementation', 'Impact', 'Check It Out'];

const projects = [
  {
    name: 'Brightspace Canvas Wrapper',
    detail: [
      'I built a Canvas-style dashboard for Brightspace so I could see courses, grades, assignments, and the calendar in one place.',
      'Try two sample classes and see how an ungraded assignment could change your grade.',
      'The dashboard grew to include what-if grades alongside optional Gradescope and Ed Discussion integrations.',
      'A Firefox extension combines Brightspace course data with its own dashboard and optional integrations.',
      'It brings the information I check most often into one view, from upcoming due dates to grade scenarios.',
      'Find the extension source and setup instructions on GitHub.'
    ],
    image: ['brightspace-demo-dashboard.png', 'Brightspace dashboard with course cards and upcoming assignments'],
    demo: 'grades',
    links: [['GitHub', 'https://github.com/rishabh-mohan/brightspace-canvas-wrapper']]
  },
  {
    name: 'd31 + Pack Studio',
    detail: [
      'I wanted a version of 31-Day Mode whose scenarios could be changed without rewriting the game.',
      'Try a short, simplified turn to see how an activity trades time for a stat.',
      'The 31-Day Mode rebuild and its Android pack editor grew into companion projects.',
      'The Dart and Flutter engine reads calendars, locations, items, and branching events from JSON. Pack Studio validates packs with the same engine.',
      'A campaign can be authored as data and run without an engine change.',
      'Explore the game engine and the companion editor.'
    ],
    image: ['d31-gameplay.jpg', 'd31 gameplay showing the schedule and activity choices'],
    extra: ['pack-studio-screenshot.jpg', 'Pack Studio showing its pack tools'],
    demo: 'd31',
    links: [['d31 on GitHub', 'https://github.com/rishabh-mohan/d31'], ['Pack Studio on GitHub', 'https://github.com/rishabh-mohan/pack-studio']]
  },
  {
    name: 'rr-scraper',
    detail: [
      'I wanted to take Royal Road stories offline and read them in the format that suited me.',
      'Choose a sample book format and preview the resulting filename.',
      'The tool covers both finding a story by title and opening a story directly by URL.',
      'A Node.js CLI collects chapters and exports TXT, PDF, or EPUB.',
      'An export turns a serialized story into a single file for offline reading.',
      'See the CLI source, usage, and the available export formats.'
    ],
    image: ['rr-scraper-demo-still.svg', 'Terminal replay of a Royal Road story export'],
    demo: 'export',
    reading: true,
    links: [['GitHub', 'https://github.com/rishabh-mohan/rr-scraper']]
  },
  {
    name: 'Gemini Bridge',
    detail: [
      'Gemini Bridge is an experiment in connecting a local workflow to Gemini.',
      'An interactive request and reply replay is planned.',
      'A public project timeline is still to come.',
      'The local bridge is written in Python. A fuller write-up is still to come.',
      'The project explores what it takes to put Gemini inside an existing local workflow.',
      'I’ll add a project link when there’s one to share.'
    ],
    art: 'local client\n    |\n    v\n[ bridge.py ]  --->  Gemini'
  },
  {
    name: 'Currently Working On',
    detail: [
      'I’m building this portfolio as a set of windows you can move around.',
      'Shuffle the grid to see how moving a window changes its preview.',
      'The first prototype is a six-window desktop layout.',
      'Plain HTML, CSS, and JavaScript power the desktop, typing effects, and ASCII forest.',
      'One grid makes room for six different ways to explore each project.',
      'You’re already here. Take a look at the rest of my work on GitHub.'
    ],
    art: '+---+ +---+ +---+\n| 1 | | 2 | | 3 |\n+---+ +---+ +---+\n| 4 | | 5 | | 6 |\n+---+ +---+ +---+',
    links: [['GitHub', 'https://github.com/rishabh-mohan']]
  },
  {
    name: 'WikiSpeedruns',
    detail: [
      'A space for my Wikipedia speedruns under the handle alvaret.',
      'Start on one Wikipedia article and reach another by following links.',
      'I’ll add selected runs here once the profile details are available.',
      'The game uses the links between Wikipedia articles as routes.',
      'A run records a path between topics that might seem unrelated at first.',
      'See my WikiSpeedruns profile or try the game.'
    ],
    art: ' [ start ]\n     |\n [ article ] --- [ article ]\n                      |\n                   [ goal ]',
    links: [['alvaret’s profile', 'https://wikispeedruns.com/profile/alvaret'], ['WikiSpeedruns', 'https://wikispeedruns.com/']]
  }
];

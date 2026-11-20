// Desktop-only depth for the six windows: extra blocks per section, shown under each section's paragraph
// in the grid cards and in the expanded view. Mobile never reads this file.
// Sources: each project's README and source (canvas-personal, d30mode, pack-studio, rr-scraper, hydrogen-bridge)
// and github.com/rishabh-mohan, November 2026. Brightspace screenshots use the extension's dev server and
// its made-up courses. No Korean Student Simulator art is used anywhere.
//
// Block types:
//   ['p', text]                                  paragraph
//   ['h', text]                                  small heading
//   ['img', file, alt, width, height, caption]   figure from assets/
//   ['list', [text, ...]]                        bullet list
//   ['steps', [[title, text], ...]]              numbered walkthrough
//   ['stats', [[value, label], ...]]             row of number tiles
//   ['code', text, caption]                      monospace sample
//   ['tags', [text, ...]]                        small labels

// Desktop replaces a project's main image without changing the mobile one.
const desktopImages = {
  'Brightspace Canvas Wrapper': ['brightspace-dash.webp', 'Canvas-style dashboard with course cards, a To Do sidebar and recent feedback, shown with sample courses', 1200, 750]
};

const sampleData = 'Sample courses from the extension’s own dev server.';

const desktopBlocks = {
  'Brightspace Canvas Wrapper': [
    // Intro
    [
      ['stats', [['3', 'sites in one view: Brightspace, Gradescope, Ed'], ['0', 'data sent anywhere else'], ['Any', 'school on *.brightspace.com']]],
      ['h', 'What it replaces'],
      ['list', [
        'Course cards with your own nicknames and colours, plus a day-by-day List View you can tick off.',
        'A To Do sidebar (overdue first), Recent Feedback, and a Recent Activity feed of new grades and announcements.',
        'Modules, assignments, quizzes, discussions, grades and a calendar, all laid out the way Canvas does it.',
        'Every other Brightspace page still opens inside the wrapper, with the course menu beside it.'
      ]],
      ['tags', ['JavaScript', 'WebExtension', 'Firefox 140+', 'Chrome / Edge 121+', 'MIT']]
    ],
    // Demo: the live frame says it all; just point at the parts worth trying.
    [
      ['list', [
        'CS 25100 \u2192 Grades: type a what-if score and watch the total change. The lowest quiz is dropped.',
        'CS 25100 \u2192 Assignments: Gradescope and Ed work is merged in, with duplicates folded into one item.',
        'Dashboard \u22ee \u2192 Tasks Panel, or press ? for keyboard shortcuts.',
        'Purdue extras (dining menus, BoilerClasses, class times) need live services, so they don\u2019t work in the demo.'
      ]]
    ],
    // Inspiration
    [
      ['p', 'Brightspace holds course content and grades, but many classes also post work on Gradescope or Ed Discussion. That means three sites to check, and the same homework can show up as three separate reminders.'],
      ['img', 'brightspace-gsassign.webp', 'Assignments list with Gradescope work merged in and labelled', 1200, 750, 'Gradescope work merged into a course’s assignments. ' + sampleData],
      ['h', 'How duplicates are folded'],
      ['steps', [
        ['Match names.', '“HW 4” and “Homework Assignment #4” count as the same item.'],
        ['Check dates.', 'Due dates have to fall within a day and a half of each other.'],
        ['Keep one.', 'Brightspace’s copy wins, then Gradescope’s, then Ed’s. The others become small links on it.'],
        ['Override.', 'On Connected Sites, any pair can be linked by hand (Same as …) or kept apart.']
      ]]
    ],
    // Implementation
    [
      ['p', 'Everything runs in the browser with the student’s own sign-in. The extension reads Brightspace’s student API and reshapes the answers into Canvas-style data before any page is drawn.'],
      ['code', 'extension/src/\n  client.js        Brightspace API: versions, paging, throttling, caching\n  data.js          answers -> Canvas-shaped courses, work, grades, modules\n  gradescope.js    optional Gradescope reader\n  ed.js            optional Ed Discussion reader (personal API token)\n  ui-core.js       frame, routing, framed Brightspace pages, overlap folding\n  ui-dashboard.js  dashboard, Tasks Panel, inbox, connected sites\n  ui-course.js     every page inside a course\n  ui-calendar.js   month and agenda views\nextension/background.js   access probe, toolbar badge', 'How the code is split'],
      ['list', [
        'A local dev server fakes Brightspace, Gradescope and Ed, so every page can be built and tested without a real account.',
        'A screenshot script opens about 75 pages in headless Chrome or Edge and fails if any of them doesn’t render.',
        'Instructor text is cleaned before it’s shown. Only formatting, links and images are kept.',
        'It only writes to Brightspace when you press Submit Assignment or Post Reply.'
      ]]
    ],
    // Impact
    [
      ['img', 'brightspace-tasks.webp', 'Dashboard with the weekly Tasks Panel and completion rings per course', 1200, 750, 'The Tasks Panel: a weekly sidebar with a completion ring per course. ' + sampleData],
      ['h', 'Grades that match the gradebook'],
      ['list', [
        'Drop rules are applied, with dropped scores struck through. Locked items say why they can\u2019t be changed.',
        '\u201cCalculate based only on graded assignments\u201d and \u201cCount items marked not counted\u201d match how instructors set up the gradebook.',
        'Gradescope scores fill in where Brightspace hasn\u2019t posted one yet.'
      ]],
      ['h', 'Purdue extras'],
      ['list', [
        'Dining menus for every dining court, with a food filter (beef also blocks steak and burgers) and favourites.',
        'Past grade distributions and average GPA per instructor from BoilerClasses, with a rough percentile for your current total.',
        'Upcoming exam dates and rooms from BoilerExams, also shown on the calendar.',
        'Class times from purdue.io: where your lecture, lab and PSO meet, with room map links.'
      ]],
      ['img', 'brightspace-calendar.webp', 'Month calendar with assignments and exams coloured by course', 1200, 750, 'Calendar with a checkbox per course and your own To Do items. ' + sampleData]
    ],
    // Check It Out
    [
      ['list', [
        'Light, dark or automatic theme, keyboard shortcuts (press ?), and a search across every course.',
        'Works at phone width too, including Firefox for Android.',
        'Unofficial and not affiliated with D2L or Instructure.'
      ]]
    ]
  ],

  'd31 + Pack Studio': [
    // Intro
    [
      ['stats', [['0', 'lines of game content in the engine'], ['~490', 'automated tests'], ['200', 'seeded full runs that must finish'], ['~60', 'effect verbs for events']]],
      ['p', 'Change the pack and you change the game. The calendar, places, actions, events, items, traits, characters, colleges and every tuning number are JSON files. Pack Studio is the Android app that edits those files through forms.'],
      ['tags', ['Dart', 'Flutter', 'JSON', 'Android', 'Windows', 'MIT (engine)']]
    ],
    // Demo
    [
      ['h', 'One run, start to finish'],
      ['steps', [
        ['Set up.', 'Pick a mode, a character, up to seven university badges and five traits.'],
        ['Play the day.', 'Each tick deals a weighted hand of action blocks for where you are: study, work, exercise, sleep or a pack’s own actions.'],
        ['Manage.', 'Spend stamina and money, level up, finish study books and chase weekly goals.'],
        ['React.', 'Events branch on dialogue choices, dates, items, traits and earlier switches.'],
        ['Exam day.', 'The final exam, university applications with acceptance odds, results and an ending.']
      ]]
    ],
    // Inspiration
    [
      ['p', 'Korean Student Simulator’s 31-Day Mode has no way to add your own content. d31 rebuilds it as an engine that only knows rules, so a new campaign can be written as data.'],
      ['h', 'Clean-room rules I kept to'],
      ['list', [
        'All engine code is original.',
        'No text, art, audio or data from the original game is in either repository.',
        'The app icon is drawn by a script from the project’s own palette, not from game art.',
        'Some original rules couldn’t be recovered, so exam scoring and admission odds are fitted approximations.'
      ]]
    ],
    // Implementation
    [
      ['code', 'my-pack/\n  pack.json           name, calendar, subjects, start location\n  rules.json          every tuning number (optional, with defaults)\n  locations.json      places and the actions at each\n  events/events.json  events and their node graphs\n  characters.json     playable characters\n  items.json, traits.json, books.json, mechanics.json, ...\n  images/             the pack’s own art', 'A content pack is just a folder'],
      ['code', '{\n  "id": "workshop",\n  "name": "Workshop example",\n  "calendar": { "startDate": "DATE_2023101600",\n                "endDate": "DATE_2023111600", "ticksPerDay": 15 },\n  "start": { "locationId": 801 },\n  "subjects": ["craft", "design"],\n  "colorScheme": { "preset": "peach" }\n}', 'pack.json from the bundled Workshop example'],
      ['list', [
        'event_engine.dart runs node-graph events. conditions.dart is a recursive condition language over switches, dates, items and traits.',
        'mechanics.json defines trait and character abilities, so special blocks aren’t hard-coded.',
        'A developer panel edits the live run, fires any event, reloads the pack from disk and lists effects the engine didn’t recognise.'
      ]]
    ],
    // Impact
    [
      ['img', 'pack-studio-colors.webp', 'Pack Studio colour scheme settings with the Ocean preset selected', 540, 1200, 'Per-pack colour schemes in Pack Studio. The game uses them for the mode card and interface.'],
      ['h', 'What Pack Studio handles'],
      ['list', [
        'Forms for pack info, locations and their actions, traits, characters, items and books.',
        'An event builder: when and where it happens, then lines, choices and rewards.',
        'New packs start from the Workshop template, with study books for every subject and a ten-level table.',
        'It saves as you edit, then loads the pack with the real engine and says whether it still works.',
        'Six colour presets (Peach, Ocean, Forest, Lavender, Rose, Slate) or custom colours.'
      ]]
    ],
    // Check It Out
    [
      ['code', 'flutter pub get\nflutter test                 # ~490 tests, 200 seeded full runs\nflutter run -d windows       # fastest loop\nflutter build apk --profile  # Android', 'Build d31'],
      ['p', 'Pack Studio and the game share a packs folder on Android, so a pack made on the phone shows up in the game after a restart.']
    ]
  ],

  'rr-scraper': [
    // Intro
    [
      ['stats', [['3', 'formats: TXT, PDF, EPUB'], ['3', 'retries per chapter'], ['0', 'manual installs after Node.js']]],
      ['h', 'Four prompts'],
      ['steps', [
        ['Find it.', 'Paste a story link or type a title and pick from the top results.'],
        ['Pick a format.', 'TXT, PDF (the default) or EPUB.'],
        ['Group chapters.', 'One book, or files of any number of chapters.'],
        ['Read.', 'Files land in downloads/Title (fiction ID)/ and the folder opens.']
      ]],
      ['tags', ['Node.js 22', 'Playwright', 'Cheerio', 'PDFKit', 'JSZip', 'Windows', 'macOS']]
    ],
    // Demo
    [
      ['code', 'downloads/\n  Mother of Learning (21220)/\n    Mother of Learning.epub        chapters 1-109\n\n  or, with 25 chapters per file:\n    Mother of Learning 001-025.pdf\n    Mother of Learning 026-050.pdf\n    ...', 'Where exports go'],
      ['p', 'The fiction ID in the folder name keeps two books with the same title apart.']
    ],
    // Inspiration
    [
      ['p', 'Royal Road serials run to hundreds of chapters, each on its own web page. Reading one offline, or on an e-reader, means collecting every chapter into a single file.'],
      ['h', 'What made it harder than it looks'],
      ['list', [
        'Royal Road injects hidden anti-piracy paragraphs. A plain HTML parser copies them into the book.',
        'Search results hide ratings in tooltips and split chapter counts across elements.',
        'Some pages ask for a manual access check.'
      ]]
    ],
    // Implementation
    [
      ['code', '// Read paragraphs in the browser, so CSS-hidden ones are skipped.\nconst paragraphs = await page.$$eval(\n  \'.chapter-inner.chapter-content p\', ps => ps\n    .filter(p => {\n      const s = getComputedStyle(p);\n      return s.display !== \'none\' && s.visibility !== \'hidden\';\n    })\n    .map(p => p.innerText.trim())\n    .filter(Boolean));', 'src/royal-road.js: the hidden-paragraph filter'],
      ['list', [
        'Search and metadata are parsed with Cheerio. Chapters are read with headless Chromium through Playwright.',
        'Images and fonts are blocked to save bandwidth. Stylesheets aren’t, because the hidden-paragraph check depends on them.',
        'Writers for TXT, PDF and EPUB share one atomic-write path through temporary .part files.',
        'The launcher installs pinned dependencies and Chromium on first run.'
      ]]
    ],
    // Impact
    [
      ['h', 'Built to survive interruptions'],
      ['steps', [
        ['Retry.', 'A chapter that fails, or comes back empty, is retried three times.'],
        ['Hold the file.', 'If a chapter still fails, its whole group is left unwritten instead of saved with a gap.'],
        ['Rerun.', 'Finished files are skipped by name, so running it again only fetches what’s missing.'],
        ['Report.', 'Any failed export gives a nonzero exit status.']
      ]],
      ['p', 'Exports keep the text only. Images, tables and original styling aren’t preserved, and existing exports aren’t refreshed when chapters are added.']
    ],
    // Check It Out
    [
      ['code', 'node chapter-scraper.js           # interactive\nnode chapter-scraper.js --setup   # install only\nnode chapter-scraper.js --show-browser', 'Run it']
    ]
  ],

  'Gemini Bridge': [
    // Intro
    [
      ['stats', [['0', 'API keys or stored passwords'], ['10+', 'models, discovered at startup'], ['1', 'command to launch']]],
      ['list', [
        'Gemini 4, 3.x Flash and Pro models, plus Claude Opus and Sonnet, whichever the organisation offers.',
        'Low, medium and high effort as OpenCode variants.',
        'Tool use (read, edit, run commands) emulated through the chat.',
        'Image and PDF attachments.'
      ]],
      ['tags', ['Python', 'Playwright', 'FastAPI', 'OpenAI-compatible API', 'OpenCode']]
    ],
    // Demo
    [
      ['code', 'hydrogen-manual                         # OpenCode in this folder\nhydrogen-manual C:\\path\\to\\project      # or another one\nhydrogen-manual -Model claude-opus-5-5  # start on another model\nhydrogen-manual -BridgeOnly             # just the server', 'Launch'],
      ['p', 'The first run opens a browser window. You sign in normally (SSO, two-factor) and it closes itself. After that the bridge runs headless until the session expires.'],
      ['p', 'With -BridgeOnly, any OpenAI-compatible client can use http://127.0.0.1:8766/v1.']
    ],
    // Inspiration
    [
      ['p', 'Purdue gives students Gemini Enterprise in the browser, including strong coding models, but no API key. Terminal coding agents need an API. The bridge closes that gap with the access students already have.'],
      ['p', 'An earlier experiment, gemini-api, sent one prompt and scraped the reply. The bridge goes further: a full server that coding tools can talk to.']
    ],
    // Implementation
    [
      ['h', 'One request, end to end'],
      ['steps', [
        ['Receive.', 'OpenCode sends a normal OpenAI chat request to the local server.'],
        ['Flatten.', 'render() turns the messages, tool results and attachments into one prompt plus files to upload.'],
        ['Send.', 'A signed-in Chromium page calls the web app’s own streaming endpoint.'],
        ['Read.', 'extract() keeps the answer text, skips “thought” parts, and follows hand-offs to the app’s built-in sub-agents.'],
        ['Return.', 'split_calls() parses tool blocks with a real JSON decoder and sends them back as OpenAI tool_calls.']
      ]],
      ['code', 'bridge.py           489 lines  server, prompt rendering, parsing\ntransport.py        150 lines  browser calls, errors, sign-in recovery\nrequest_runtime.py   97 lines  cancellation and streaming\ntest_*.py           349 lines  run without a Google account', 'Files']
    ],
    // Impact
    [
      ['h', 'Reliability'],
      ['list', [
        'Browser calls run one at a time, so a sign-in can never interrupt another request.',
        'Disconnecting cancels queued work, stops retries and aborts the active fetch.',
        'Timeouts per fetch (600 s) and per request (1,200 s), with keepalives while streaming.',
        'Errors carry a type, a retryable hint and the upstream status. Only a real 401 triggers sign-in.',
        'If the organisation’s content filter blocks a reply, it asks again twice, then retries with less history.'
      ]]
    ],
    // Check It Out
    [
      ['p', 'Unofficial: it drives the web app the way a browser does, so it can break when the site changes. Other organisations can point it at their own setup with five environment variables.']
    ]
  ],

  'Currently Working On': [
    // This Site
    [
      ['stats', [['5', 'desktop themes'], ['6', 'swappable windows'], ['1', 'Krillion-style mobile dive']]],
      ['list', ['Forest, Space, Mountains, Postmodern and Snowdrift scenery, each drawn as shaded ASCII on one canvas.', 'Mobile opens with a “Name a SWE” dive, inspired by krillion.io with the creator’s permission.', 'Next: a reading list for rr-scraper and more demos.']]
    ],
    // d31
    [
      ['list', ['Working: day loop, events, run setup, exam day, saves and a developer panel.', 'Next: audio, sudden missions and the rest of the event dispatcher.']]
    ],
    // rr-scraper
    [
      ['list', ['Working: search, three formats, chapter grouping and safe reruns.', 'Known limit: existing exports aren’t refreshed when a story adds chapters.']]
    ],
    // Gemini Bridge
    [
      ['list', ['Working: model discovery, tool use, attachments, cancellation and content-filter retries.', 'Known limit: Google doesn’t report token usage, so counts are estimates.']]
    ],
    // Brightspace Wrapper
    [
      ['list', ['Working: dashboard, courses, grades, calendar, Gradescope, Ed and Purdue extras.', 'Next: Ed scores, once it’s confirmed where Ed stores them.']]
    ],
    // Pack Studio
    [
      ['list', ['Working: forms for every content type, an event builder and colour schemes.', 'Not yet: no licence has been chosen.']]
    ]
  ]
};

// The Resume window reuses the structured background written for mobile.
if (typeof mobileBackground !== 'undefined') {
  const bg = mobileBackground;
  desktopBlocks.Resume = [
    bg.skills.flatMap(group => [['h', group.name], ['p', group.description], ['tags', group.tools]]),
    bg.experience.flatMap(job => [['h', job.role + ' · ' + job.org + ' · ' + job.dates], ['list', job.bullets]]),
    [['list', bg.education.map(entry => entry.school + ': ' + entry.qualification + ' (' + entry.note + ')')]],
    [['stats', [['4', 'featured projects in this grid'], ['8', 'public repositories']]]],
    [['stats', [['200+', 'students tutored'], ['Pre-K', 'to trigonometry']]]],
    []
  ];
}

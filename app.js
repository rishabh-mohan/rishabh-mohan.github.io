const grid = document.querySelector('#grid');
const desk = document.querySelector('#desk');
const expanded = document.querySelector('#expanded');
const content = document.querySelector('#project-content');
const detailNav = document.querySelector('#detail-nav');
const closeButton = document.querySelector('#close');
const shuffleButton = document.querySelector('#shuffle');
const motionButton = document.querySelector('#motion');
const status = document.querySelector('#status');
const eyeCanvas = document.querySelector('.eye-assembly');
const eyeToolbar = document.querySelector('.toolbar');
const eyeHeadline = document.querySelector('.site-header h1');
const eyeSchool = document.querySelector('.school');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const supported = matchMedia('(min-width: 900px) and (min-height: 640px) and (aspect-ratio > 5/4)');
const order = projects.map((_, index) => index);
let selected = null;
let dragged = null;
let openSlot = null;
let busy = false;
let animationToken = 0;
let paused = false;

function node(tag, value, className) {
  const element = document.createElement(tag);
  if (value) element.textContent = value;
  if (className) element.className = className;
  return element;
}

function projectVisual(project, section) {
  if (section === 5) {
    return node('pre', '   .--------------------.\n   |  [ open a link ]   |\n   \x27--------------------\x27\n         \\   ^__^\n             (oo)\\_______\n             (__)\\       )\\/\\\n                 ||----w |\n                 ||     ||', 'art');
  }
  const asset = (section === 3 && project.extra) || project.image;
  if (!asset) return node('pre', project.art, 'art');
  const frame = node('figure', '', 'visual');
  const image = node('img');
  image.src = 'assets/' + asset[0];
  image.alt = asset[1];
  frame.append(image);
  return frame;
}

function paintCard(slot) {
  const card = grid.children[slot];
  const project = projects[order[slot]];
  const title = project.name + ' - ' + sections[slot];
  card.querySelector('h2').textContent = title;
  card.querySelector('button').setAttribute('aria-label', 'Expand ' + project.name);
  const preview = card.querySelector('.preview');
  preview.querySelector('.copy').textContent = project.detail[slot];
  const details = preview.querySelector('.preview-details');
  details.replaceChildren(projectVisual(project, slot));
  appendSectionExtras(details, project, slot);
  preview.scrollTo({ top: 0, behavior: 'instant' });
}

function makeCard(slot) {
  const card = node('article', '', 'window');
  card.dataset.slot = slot;
  const bar = node('header', '', 'window-bar');
  const title = node('h2');
  title.id = 'slot-title-' + slot;
  const grip = node('span', '⠿', 'grip');
  grip.draggable = true;
  grip.title = 'Drag slot ' + (slot + 1);
  grip.setAttribute('aria-hidden', 'true');
  const button = node('button', '↗');
  button.type = 'button';
  button.addEventListener('click', () => openProject(slot));
  bar.append(title, grip, button);
  const preview = node('div', '', 'preview');
  preview.tabIndex = 0;
  preview.setAttribute('role', 'region');
  preview.setAttribute('aria-labelledby', title.id);
  const copy = node('p', '', 'copy');
  const badge = node('span', String(slot + 1), 'slot');
  badge.setAttribute('aria-hidden', 'true');
  const caption = node('div', '', 'caption');
  caption.append(badge, copy);
  preview.append(caption, node('div', '', 'preview-details'));
  card.append(bar, preview);

  grip.addEventListener('dragstart', event => {
    if (busy) { event.preventDefault(); return; }
    dragged = slot;
    selectSlot(slot);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(slot));
    event.dataTransfer.setDragImage(card, card.clientWidth / 2, 18);
  });
  grip.addEventListener('dragend', endDrag);
  card.addEventListener('dragover', event => {
    if (dragged === null || dragged === slot || busy) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    card.classList.add('destination');
  });
  card.addEventListener('dragleave', event => {
    if (!card.contains(event.relatedTarget)) card.classList.remove('destination');
  });
  card.addEventListener('drop', event => {
    if (dragged === null || busy) return;
    event.preventDefault();
    const from = dragged;
    endDrag();
    if (from !== slot) void runSwaps([[from, slot]]);
  });
  return card;
}

function selectSlot(slot) {
  selected = slot;
  Array.from(grid.children).forEach((card, index) => card.classList.toggle('selected', index === slot));
  if (slot !== null) status.textContent = 'Slot ' + (slot + 1) + ' selected. Press another slot number to swap.';
}

function endDrag() {
  dragged = null;
  selectSlot(null);
  grid.querySelectorAll('.destination').forEach(card => card.classList.remove('destination'));
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function typeTo(element, target, duration, valid = () => true) {
  if (reduced.matches || !duration) {
    if (valid()) element.textContent = target;
    return;
  }
  const original = Array.from(element.textContent);
  const next = Array.from(target);
  const start = performance.now();
  element.classList.add('cursor');
  await new Promise(resolve => {
    function frame(now) {
      if (!valid()) { resolve(); return; }
      const amount = Math.min(1, (now - start) / duration);
      const letters = target ? next : original;
      const count = Math.floor(letters.length * (target ? amount : 1 - amount));
      element.textContent = letters.slice(0, count).join('');
      if (amount < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
  element.classList.remove('cursor');
}

async function runSwaps(pairs, nextTheme) {
  if (busy || openSlot !== null) return;
  busy = true;
  shuffleButton.disabled = true;
  selectSlot(null);
  try {
    const scene = nextTheme ? rebuildScene(nextTheme) : Promise.resolve();
    for (const [from, to] of pairs) {
      const cards = [grid.children[from], grid.children[to]];
      cards.forEach(card => card.classList.add('destination'));
      const before = cards.map(card => card.getBoundingClientRect());
      await Promise.all(cards.flatMap(card => Array.from(card.querySelectorAll('h2, .copy'), el => typeTo(el, '', 90))));
      [order[from], order[to]] = [order[to], order[from]];
      paintCard(from);
      paintCard(to);
      const motion = cards.map((card, index) => {
        const other = before[1 - index];
        const at = before[index];
        if (reduced.matches) return Promise.resolve();
        return card.animate([
          { transform: 'translate(' + (other.left - at.left) + 'px,' + (other.top - at.top) + 'px)', opacity: .72 },
          { transform: 'translate(0,0)', opacity: 1 }
        ], { duration: 250, easing: 'cubic-bezier(.2,.75,.3,1)' }).finished;
      });
      const lines = cards.flatMap(card => Array.from(card.querySelectorAll('h2, .copy')));
      const text = lines.map(el => el.textContent);
      lines.forEach(el => { el.textContent = ''; });
      await Promise.all([...motion, ...lines.map((el, index) => typeTo(el, text[index], 280))]);
      cards.forEach(card => card.classList.remove('destination'));
      status.textContent = 'Swapped slots ' + (from + 1) + ' and ' + (to + 1) + '.';
      if (pairs.length > 1 && !reduced.matches) await delay(90);
    }
    await scene;
    if (nextTheme) status.textContent = 'Projects shuffled. Theme: ' + nextTheme + '.';
  } finally {
    busy = false;
    shuffleButton.disabled = false;
  }
}

shuffleButton.addEventListener('click', () => {
  const pairs = [];
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    if (other !== index) pairs.push([index, other]);
  }
  if (!pairs.length) pairs.push([0, 1 + Math.floor(Math.random() * (order.length - 1))]);
  void runSwaps(pairs, chooseTheme());
});

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.repeat || !supported.matches) return;
  if (openSlot !== null) {
    if (event.key === 'Escape') closeProject();
    return;
  }
  if (busy || event.target.closest('input, textarea, select, [contenteditable]')) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !/^[1-6]$/.test(event.key)) {
    if (selected !== null) {
      selectSlot(null);
      status.textContent = 'Swap canceled.';
    }
    return;
  }
  event.preventDefault();
  const next = Number(event.key) - 1;
  if (selected === null) selectSlot(next);
  else {
    const first = selected;
    selectSlot(null);
    if (first !== next) void runSwaps([[first, next]]);
  }
});

function demoFor(project) {
  const demo = node('div', '', 'demo');
  const out = node('output');
  if (project.demo === 'grades') {
    const classes = [
      ['Algorithms', 'Recurrence worksheet', 84, 100],
      ['Systems', 'Process lab', 93, 100]
    ];
    const pick = node('select');
    classes.forEach(([name], index) => {
      const option = node('option', name);
      option.value = index;
      pick.append(option);
    });
    const classLabel = node('label', 'Class ');
    classLabel.append(pick);
    const assignment = node('span');
    const grade = node('input');
    grade.type = 'number';
    grade.min = 0;
    grade.max = 20;
    grade.value = 17;
    const gradeLabel = node('label', 'What-if score (out of 20) ');
    gradeLabel.append(grade);
    function update() {
      const [, task, earned, total] = classes[pick.value];
      assignment.textContent = 'Assignment: ' + task;
      if (grade.value === '' || !grade.validity.valid) {
        out.textContent = 'Enter a score from 0 to 20.';
        return;
      }
      out.textContent = 'Current: ' + (earned / total * 100).toFixed(1) + '% → What-if: ' + ((earned + grade.valueAsNumber) / (total + 20) * 100).toFixed(1) + '%';
    }
    pick.addEventListener('change', update);
    grade.addEventListener('input', update);
    demo.append(node('p', 'Sample dashboard data'), classLabel, node('p'), gradeLabel, out);
    demo.children[2].append(assignment);
    update();
  } else if (project.demo === 'd31') {
    const choose = (label, callback) => {
      const button = node('button', label);
      button.type = 'button';
      button.addEventListener('click', callback);
      return button;
    };
    const study = choose('Study', () => finish('17:00 · Academics +2'));
    const walk = choose('Take a walk', () => finish('17:00 · Energy +2'));
    const reset = choose('Restart turn', () => {
      out.textContent = '16:00 · One hour free. Choose an activity.';
      study.disabled = walk.disabled = false;
    });
    function finish(result) {
      out.textContent = result;
      study.disabled = walk.disabled = true;
    }
    reset.click();
    demo.append(node('p', 'Sample turn'), study, walk, reset, out);
  } else if (project.demo === 'export') {
    const label = node('label', 'Format ');
    const format = node('select');
    ['TXT', 'PDF', 'EPUB'].forEach(value => format.append(node('option', value)));
    const update = () => { out.textContent = 'Example-story.' + format.value.toLowerCase(); };
    format.addEventListener('change', update);
    label.append(format);
    demo.append(label, out);
    update();
  } else {
    return null;
  }
  return demo;
}

function appendSectionExtras(target, project, section) {
  if (section === 1) {
    const demo = demoFor(project);
    if (demo) target.append(demo);
  }
  if (section === 4 && project.reading) {
    target.append(node('h3', 'Currently Reading'), node('p', 'Reading list coming soon.'));
  }
  if (section === 5 && project.links) {
    const links = node('ul');
    project.links.forEach(([name, href]) => {
      const li = node('li');
      const link = node('a', name);
      link.href = href;
      li.append(link);
      links.append(li);
    });
    target.append(links);
  }
}

function openProject(slot) {
  if (openSlot !== null || busy || !supported.matches) return;
  selectSlot(null);
  const start = grid.children[slot].getBoundingClientRect();
  const end = desk.getBoundingClientRect();
  const project = projects[order[slot]];
  const token = ++animationToken;
  const active = () => token === animationToken;
  const incoming = [];
  openSlot = slot;
  document.querySelector('#expanded-title').textContent = project.name;
  sections.forEach((label, index) => {
    const part = node('section');
    const sectionButton = node('button', label);
    sectionButton.type = 'button';
    sectionButton.addEventListener('click', () => {
      content.scrollTop += part.getBoundingClientRect().top - content.getBoundingClientRect().top;
    });
    detailNav.append(sectionButton);
    const paragraph = node('p', index === slot || reduced.matches ? project.detail[index] : '');
    part.append(node('h3', label), paragraph);
    if (index !== slot) incoming.push([paragraph, project.detail[index]]);
    if (index === 0 || (index === slot && index !== 5) || index === 5 || (index === 3 && project.extra)) {
      part.append(projectVisual(project, index));
    }
    appendSectionExtras(part, project, index);
    content.append(part);
  });
  expanded.hidden = false;
  grid.inert = true;
  shuffleButton.disabled = true;
  closeButton.focus();
  const activeSection = content.children[slot];
  content.scrollTop = activeSection.getBoundingClientRect().top - content.getBoundingClientRect().top;
  drawForest(forestTime);
  if (!reduced.matches) {
    const animation = expanded.animate([
      { transformOrigin: 'top left', transform: 'translate(' + (start.left - end.left) + 'px,' + (start.top - end.top) + 'px) scale(' + (start.width / end.width) + ',' + (start.height / end.height) + ')' },
      { transformOrigin: 'top left', transform: 'none' }
    ], { duration: 270, easing: 'cubic-bezier(.2,.75,.3,1)' });
    animation.finished.then(() => {
      if (active()) incoming.forEach(([paragraph, value]) => { void typeTo(paragraph, value, 410, active); });
    }, () => {});
  }
}

function closeProject() {
  if (openSlot === null) return;
  const slot = openSlot;
  openSlot = null;
  animationToken++;
  expanded.getAnimations().forEach(animation => animation.cancel());
  expanded.hidden = true;
  content.replaceChildren();
  detailNav.replaceChildren();
  grid.inert = false;
  shuffleButton.disabled = false;
  if (supported.matches) grid.children[slot].querySelector('button').focus();
  drawForest(forestTime);
}

closeButton.addEventListener('click', closeProject);
supported.addEventListener('change', event => {
  if (!event.matches) { closeProject(); endDrag(); }
});

projects.forEach((_, index) => { grid.append(makeCard(index)); paintCard(index); });

const forest = document.querySelector('#forest');
const context = forest.getContext('2d');
const ramp = ' .,:;irsXAHM#@';
const glyphWidth = 4.4;
const glyphHeight = 6.1;
const themes = ['forest', 'space', 'mountains', 'postmodern'];
let currentTheme = 'forest';
let postmodernStartedAt = 0;
let themeBag = [];
let sceneVisibility = 1;
let rebuilding = false;
const palettes = {
  pine: ['#233a35', '#34594c', '#51866a', '#79ae81', '#bce09b'],
  deer: ['#4b352e', '#79523c', '#b47c52', '#dfac73', '#ffe3ad'],
  rabbit: ['#3b3434', '#66564e', '#968477', '#c8b5a4', '#f9dfc6'],
  water: ['#203b48', '#315b6e', '#438393', '#72b1b5', '#b4dbd2'],
  stone: ['#333a3b', '#4b5657', '#6b7774', '#919a8c', '#c8c9a8'],
  cloud: ['#2c4246', '#405d63', '#638187', '#91adae', '#bed1c8'],
  earth: ['#2b3d2d', '#405939', '#557448', '#789256', '#aac378'],
  star: ['#372e58', '#59547c', '#8f82af', '#c2b6e2', '#f7eaff'],
  planet: ['#352c60', '#53417e', '#7e639b', '#ab92cb', '#dfcaff'],
  ice: ['#293f59', '#3d5873', '#63809c', '#9cb8cf', '#e1f1f5'],
  shale: ['#263545', '#374c62', '#567289', '#7994a8', '#acc4cf']
};

function chooseTheme() {
  if (!themeBag.length) themeBag = themes.filter(theme => theme !== currentTheme);
  return themeBag.splice(Math.floor(Math.random() * themeBag.length), 1)[0];
}

function setTheme(theme) {
  if (theme === 'postmodern' && currentTheme !== theme) postmodernStartedAt = forestTime;
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  centerEye();
  positionEye();
}

let eyeGazeX = 0;
let eyeGazeY = 0;
let eyeFrame = 0;

function positionEye() {
  if (currentTheme !== 'postmodern' || !supported.matches) return;
  const text = document.createRange();
  text.selectNodeContents(eyeHeadline);
  const nameEnd = text.getBoundingClientRect().right;
  text.selectNodeContents(eyeSchool);
  const schoolStart = text.getBoundingClientRect().left;
  const toolbarBounds = eyeToolbar.getBoundingClientRect();
  const anchor = (nameEnd + schoolStart) / 2 - toolbarBounds.left;
  eyeToolbar.style.setProperty('--eye-anchor', anchor + 'px');
  eyeToolbar.style.setProperty('--eye-rise', (toolbarBounds.top + window.scrollY) + 'px');
  paintPostmodernEye(eyeCanvas, eyeGazeX, eyeGazeY);
}

function queueEyeFrame() {
  if (currentTheme !== 'postmodern' || !supported.matches || eyeFrame) return;
  eyeFrame = requestAnimationFrame(() => {
    eyeFrame = 0;
    if (currentTheme === 'postmodern' && supported.matches) {
      paintPostmodernEye(eyeCanvas, eyeGazeX, eyeGazeY);
    }
  });
}

function centerEye() {
  eyeGazeX = 0;
  eyeGazeY = 0;
  queueEyeFrame();
}

document.addEventListener('pointermove', event => {
  if (currentTheme !== 'postmodern' || !supported.matches || reduced.matches || paused || event.pointerType === 'touch') return;
  const eye = eyeCanvas.getBoundingClientRect();
  const x = (event.clientX - eye.left - eye.width / 2) / 140;
  const y = (event.clientY - eye.bottom + eyeCenterFromBottom) / 110;
  const distance = Math.max(1, Math.hypot(x, y));
  eyeGazeX = x / distance * 23;
  eyeGazeY = y / distance * 8;
  queueEyeFrame();
}, { passive: true });
document.documentElement.addEventListener('pointerleave', centerEye);
window.addEventListener('blur', centerEye);
window.addEventListener('resize', positionEye);
const eyeLayoutObserver = new ResizeObserver(positionEye);
eyeLayoutObserver.observe(eyeHeadline);
eyeLayoutObserver.observe(eyeSchool);

async function rebuildScene(nextTheme) {
  if (reduced.matches || paused) {
    setTheme(nextTheme);
    syncForest();
    return;
  }
  rebuilding = true;
  cancelAnimationFrame(forestRequest);
  const sceneDuration = 710;
  const eyeExit = currentTheme === 'postmodern' && nextTheme !== currentTheme && supported.matches
    ? eyeCanvas.animate([
        { transform: getComputedStyle(eyeCanvas).transform },
        { transform: 'translateY(-100%)' }
      ], { duration: sceneDuration / 2 - 35, easing: 'cubic-bezier(.55,.05,.8,.55)', fill: 'forwards' })
    : null;
  try {
    await new Promise(resolve => {
      const start = performance.now();
      let eyeCleared = !eyeExit;
      function frame(now) {
        const skipMotion = reduced.matches || paused;
        const canSwitchTheme = skipMotion || eyeCleared;
        const progress = skipMotion ? 1 : Math.min(canSwitchTheme ? 1 : .5, (now - start) / sceneDuration);
        if (progress >= .5 && canSwitchTheme && currentTheme !== nextTheme) {
          setTheme(nextTheme);
          if (!skipMotion) {
            document.querySelectorAll('.site-header h1, .school, .toolbar p').forEach(element => {
              element.animate([
                { transform: 'translateX(-3px)', opacity: .76 },
                { transform: 'translateX(2px)', opacity: .88 },
                { transform: 'translateX(-1px)', opacity: .94 },
                { transform: 'translateX(0)', opacity: 1 }
              ], { duration: 210, easing: 'ease-out' });
            });
          }
        }
        // Leave one frame for the eye to clear the viewport before closing the gap.
        if (eyeExit?.playState === 'finished') eyeCleared = true;
        sceneVisibility = Math.abs(1 - 2 * progress);
        drawForest(forestTime);
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  } finally {
    eyeExit?.cancel();
    rebuilding = false;
    sceneVisibility = 1;
    syncForest();
  }
}

function drawForest(time) {
  if (!supported.matches) return;
  const { left, top, right, bottom } = desk.getBoundingClientRect();
  const width = forest.clientWidth;
  const height = forest.clientHeight;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (forest.width !== pixelWidth || forest.height !== pixelHeight) {
    forest.width = pixelWidth;
    forest.height = pixelHeight;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  context.font = '7px "Courier New", monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const gridWidth = right - left;
  const gridHeight = bottom - top;
  if (currentTheme === 'postmodern') {
    const shipTime = reduced.matches ? 2.7 : Math.max(0, time - postmodernStartedAt);
    paintPostmodernShips(context, shipTime, width, height, top, bottom, sceneVisibility);
    drawPostmodernShell(left, top, right, bottom, shipTime);
    if (expanded.hidden) drawGutters(left, top, gridWidth, gridHeight, shipTime);
    return;
  }
  const style = getComputedStyle(desk);
  const end = parseFloat(style.marginTop);
  const side = parseFloat(getComputedStyle(document.querySelector('#main')).paddingLeft);
  drawGround(left, top, right, bottom);
  const edges = [
    { x: left, y: top, tangentX: 1, tangentY: 0, length: gridWidth, depth: end, id: 3 },
    { x: left, y: bottom, tangentX: 0, tangentY: -1, length: gridHeight, depth: side, id: 0 },
    { x: right, y: top, tangentX: 0, tangentY: 1, length: gridHeight, depth: side, id: 1 },
    { x: right, y: bottom, tangentX: -1, tangentY: 0, length: gridWidth, depth: end, id: 2 }
  ];
  edges.forEach(({ x, y, tangentX, tangentY, length, depth, id }) => {
    const acrossX = -tangentY;
    const acrossY = tangentX;
    const farX = x + length * tangentX - depth * acrossX;
    const farY = y + length * tangentY - depth * acrossY;
    context.save();
    context.beginPath();
    context.rect(
      Math.min(x, farX), Math.min(y, farY),
      Math.abs(x - farX), Math.abs(y - farY)
    );
    context.clip();
    // Turn the scene around the grid while keeping the individual glyphs upright.
    drawEdge(length, depth, id, time, (glyph, along, across) => {
      context.fillText(glyph, x + along * tangentX + across * acrossX, y + along * tangentY + across * acrossY);
    });
    context.restore();
  });
  if (currentTheme === 'space') {
    drawSpaceCorner('northWest', left, top, -1, -1, side, end, time);
    drawSpaceCorner('northEast', right, top, 1, -1, side, end, time);
    drawSpaceCorner('southEast', right, bottom, 1, 1, side, end, time);
    drawSpaceCorner('southWest', left, bottom, -1, 1, side, end, time);
  }
  if (expanded.hidden) drawGutters(left, top, gridWidth, gridHeight);
}

function borderPulse(time, distance) {
  return .5 + .5 * Math.sin(time * 2.65 - distance * .016);
}

function drawPostmodernShell(left, top, right, bottom, time) {
  const columns = Math.round((right - left) / glyphWidth);
  const rows = Math.round((bottom - top) / glyphHeight);
  const stepX = (right - left) / columns;
  const stepY = (bottom - top) / rows;
  const edgeColors = ['#ff594f', '#ad2630', '#65121c'];
  context.save();
  for (let col = -3; col < columns + 3; col++) {
    const x = left + (col + .5) * stepX;
    const corner = col < 0 || col >= columns;
    for (let band = 0; band < 2; band++) {
      const glyph = corner ? '+' : band === 0 ? '=' : '-';
      context.fillStyle = edgeColors[band];
      context.globalAlpha = sceneVisibility * (.65 + .34 * borderPulse(time, x - left));
      context.fillText(glyph, x, top - (band + .5) * stepY);
      context.globalAlpha = sceneVisibility * (.65 + .34 * borderPulse(time, x - left + bottom - top));
      context.fillText(glyph, x, bottom + (band + .5) * stepY);
    }
  }
  for (let row = 0; row < rows; row++) {
    const y = top + (row + .5) * stepY;
    for (let band = 0; band < 3; band++) {
      context.fillStyle = edgeColors[band];
      const glyph = band === 0 ? '|' : ':';
      context.globalAlpha = sceneVisibility * (.65 + .34 * borderPulse(time, y - top));
      context.fillText(glyph, left - (band + .5) * stepX, y);
      context.globalAlpha = sceneVisibility * (.65 + .34 * borderPulse(time, y - top + right - left));
      context.fillText(glyph, right + (band + .5) * stepX, y);
    }
  }
  context.restore();
}

const groundStyles = {
  forest: { fill: '#26372a', material: 'earth', marks: ['.v,:', "';i.", ',:r.', '.:-;'] },
  space: { fill: '#212038', material: 'star', marks: ['. .:', ' .,.', ': . ', ' ,. '] },
  mountains: { fill: '#253544', material: 'shale', marks: ['.:,v', ":.'.", '.,i:', ':.-.'] }
};

function drawGround(left, top, right, bottom) {
  const depth = 8;
  const { fill, material, marks } = groundStyles[currentTheme];
  context.save();
  context.beginPath();
  context.roundRect(left - depth, top - depth, right - left + 2 * depth, bottom - top + 2 * depth, depth);
  context.rect(left, top, right - left, bottom - top);
  context.clip('evenodd');
  context.globalAlpha = sceneVisibility;
  context.fillStyle = fill;
  context.fillRect(left - depth, top - depth, right - left + 2 * depth, bottom - top + 2 * depth);
  context.font = '6px "Courier New", monospace';

  const runs = [
    { x: left - 3, y: top - 4, dx: 1, dy: 0, length: right - left + 6 },
    { x: right + 4, y: top - 3, dx: 0, dy: 1, length: bottom - top + 6 },
    { x: right + 3, y: bottom + 4, dx: -1, dy: 0, length: right - left + 6 },
    { x: left - 4, y: bottom + 3, dx: 0, dy: -1, length: bottom - top + 6 }
  ];
  runs.forEach(({ x, y, dx, dy, length }, edge) => {
    for (let step = 0; step * glyphWidth <= length; step++) {
      const grain = .5 + .5 * Math.sin(step * 3.83 + edge * 6.1);
      if (grain >= sceneVisibility) continue;
      const mark = marks[edge][Math.floor(grain * marks[edge].length)];
      context.fillStyle = palettes[material][1 + Math.round(grain * 2)];
      context.fillText(mark, x + step * glyphWidth * dx, y + step * glyphWidth * dy);
    }
  });
  context.restore();
}

function drawGutters(left, top, width, height, pulseTime) {
  const style = getComputedStyle(grid);
  const columnGap = parseFloat(style.columnGap);
  const rowGap = parseFloat(style.rowGap);
  const columnWidth = (width - 2 * columnGap) / 3;
  const rowHeight = (height - rowGap) / 2;
  const firstDivider = left + columnWidth;
  const secondDivider = firstDivider + columnGap + columnWidth;
  const centerDivider = top + rowHeight;

  context.save();
  context.beginPath();
  context.rect(firstDivider, top, columnGap, height);
  context.rect(secondDivider, top, columnGap, height);
  context.rect(left, centerDivider, width, rowGap);
  context.clip();
  context.fillStyle = style.getPropertyValue('--media').trim();
  context.fillRect(left, top, width, height);
  const pulsing = pulseTime !== undefined;
  context.fillStyle = style.getPropertyValue(pulsing ? '--accent' : '--edge').trim();
  context.font = '6px "Courier New", monospace';

  function engrave(x, y, bandWidth, bandHeight, glyphs) {
    for (let row = 0; (row + .5) * 5.2 < bandHeight; row++) {
      for (let col = 0; (col + .5) * glyphWidth < bandWidth; col++) {
        const markX = x + (col + .5) * glyphWidth;
        const markY = y + (row + .5) * 5.2;
        const grain = .5 + .5 * Math.sin(markX * 11.3 + markY * 21.7);
        if (grain >= sceneVisibility) continue;
        context.globalAlpha = pulsing
          ? .17 + .12 * grain + .68 * borderPulse(pulseTime, markX - left + markY - top)
          : .3 + grain * .32;
        const glyph = glyphs[Math.floor(grain * glyphs.length)];
        context.fillText(glyph, markX, markY);
      }
    }
  }

  engrave(firstDivider, top, columnGap, height, '.:|');
  engrave(secondDivider, top, columnGap, height, '.:|');
  engrave(left, centerDivider, width, rowGap, '.:-');
  context.restore();
}

function drawSpaceCorner(name, originX, originY, directionX, directionY, width, height, time) {
  const artwork = spaceCornerArt[name];
  const cols = Math.max(...artwork.map(row => row.length));
  const scale = Math.min(1, width / (cols * glyphWidth), height / (artwork.length * glyphHeight));
  context.save();
  context.font = (7 * scale) + 'px "Courier New", monospace';

  artwork.forEach((row, rowIndex) => {
    for (let col = 0; col < row.length; col++) {
      const mark = row[col];
      if (mark === ' ') continue;
      const grain = .5 + .5 * Math.sin(col * 23.715 + rowIndex * 17.29);
      if (sceneVisibility < 1 && grain >= sceneVisibility) continue;
      const x = (cols - col - .5) * glyphWidth * scale;
      const y = (artwork.length - rowIndex - .5) * glyphHeight * scale;
      const twinkle = Math.sin(time * 2 + col) > .55 ? 3 : 4;
      context.fillStyle = mark === '.' ? palettes.star[2] : palettes.ice[twinkle];
      context.fillText(mark, originX + x * directionX, originY + y * directionY);
    }
  });
  context.restore();
}

function drawEdge(length, depth, edge, time, paintGlyph) {
  if (depth < 18) return;
  const cellWidth = glyphWidth;
  const cellHeight = glyphHeight;
  const cols = Math.floor(length / cellWidth);
  const rows = Math.floor(depth / cellHeight);
  const cells = Array.from({ length: rows }, () => Array(cols));
  const noise = (x, y) => (Math.sin(x * 71.7 + y * 113.4 + edge * 41.1) + 1) / 2;

  function write(x, y, light, material, glyph) {
    if (!cells[y] || x < 0 || x >= cols) return;
    const value = Math.max(0, Math.min(1, light));
    cells[y][x] = [glyph ?? ramp[Math.round(value * (ramp.length - 1))], palettes[material][Math.round(value * 4)]];
  }

  // Project each rounded cross-section and light the visible surface from the upper left.
  function surface(cx, cy, rx, ry, material, tilt = 0) {
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const spanX = Math.abs(rx * cos) + Math.abs(ry * sin);
    const spanY = Math.abs(rx * sin) + Math.abs(ry * cos);
    for (let y = Math.ceil(cy - spanY); y <= cy + spanY; y++) {
      for (let x = Math.ceil(cx - spanX); x <= cx + spanX; x++) {
        const u = ((x - cx) * cos + (y - cy) * sin) / rx;
        const v = (-(x - cx) * sin + (y - cy) * cos) / ry;
        const radius = u * u + v * v;
        if (radius > 1) continue;
        const z = Math.sqrt(1 - radius);
        const nx = u * cos - v * sin;
        const ny = u * sin + v * cos;
        write(x, y, .27 + .54 * z - .36 * nx - .22 * ny + .08 * noise(x, y), material);
      }
    }
  }

  function renderCells() {
    cells.forEach((row, y) => row.forEach(([glyph, color], x) => {
      if (sceneVisibility < 1 && noise(x + 23, y + 73) >= sceneVisibility) return;
      const scatter = 1 - sceneVisibility;
      const dx = (noise(x, y + 89) - .5) * scatter * 12;
      const dy = (noise(x + 9, y + 11) - .5) * scatter * 9;
      context.fillStyle = color;
      const along = Math.max(3.5, Math.min(length - 3.5, (x + .5) * cellWidth + dx));
      const across = Math.max(3.5 - depth, Math.min(-3.5, (y - rows + .5) * cellHeight + dy));
      paintGlyph(glyph, along, across);
    }));
  }

  if (currentTheme !== 'forest') {
    drawAlternateScene(currentTheme, { cols, rows, edge, time, noise, write, surface });
    renderCells();
    return;
  }

  for (let x = 2; x < cols - 2; x++) {
    const clearance = Math.min(x, cols - 1 - x);
    const ground = Math.min(1, (clearance - 1) / 11);
    if (noise(x, 4) < ground) write(x, rows - 1, ground * (.44 + .49 * noise(x, 0)), 'earth');
    if (noise(x, 1) > 1 - ground * .21) write(x, rows - 2, .38 + .4 * noise(x, 2), 'earth');
    if (clearance > 7 && noise(x, 13) > .988) {
      surface(x, rows - 2, 1.8, .8, 'earth');
      write(x, rows - 2, .82, 'pine');
    }
  }

  function pine(x, base, treeHeight, distant) {
    const top = base - treeHeight;
    const sway = Math.sin(time * 1.7 + x) * (distant ? .4 : 1.2);
    write(x, base, distant ? .31 : .73, 'deer');
    for (let y = top; y < base; y++) {
      const level = (y - top) / Math.max(1, treeHeight - 2);
      const center = x + sway * (1 - level);
      const radius = .65 + level * (distant ? 2.8 : 4.7) + ((y - top) % 3) * .45;
      for (let i = Math.ceil(center - radius); i <= center + radius; i++) {
        const u = (i - center) / radius;
        const bulge = Math.sqrt(1 - u * u);
        const light = .18 + .57 * bulge - .31 * u + ((y - top) % 3) * .07;
        write(i, y, light * (distant ? .58 : 1), 'pine');
      }
    }
  }
  const deerX = Math.floor(cols * .52);
  const rabbitX = Math.floor(cols * .75);
  if (edge === 3) {
    // A distant timberline, with uneven stands of taller firs in front.
    const cloudX = cols * (.39 + .15 * Math.sin(time * .42));
    surface(cloudX - 3, 1.2, 4.6, 1, 'cloud');
    surface(cloudX + 2, .9, 4.2, 1.3, 'cloud');
    surface(cloudX + 5, 1.7, 4.8, .8, 'cloud');
    for (let x = 7; x < cols - 6; x += 4 + Math.floor(noise(x, 27) ** 3 * 16)) {
      const base = rows - 3 - Math.floor(noise(x, 19) * 2);
      pine(x, base, Math.min(base, 2 + Math.floor(noise(x, 31) * rows * .48)), true);
    }
    for (let x = 12; x < cols - 11; x += 7 + Math.floor(noise(x, 4) ** 2 * 29)) {
      const base = rows - 2;
      pine(x, base, Math.max(2, Math.round(base * (.38 + .58 * noise(x, 6)))), false);
    }
  }
  if (edge === 0) {
    // A shaded clearing frames the deer and a fallen log.
    pine(cols * .18, rows - 2, Math.round(rows * .74), false);
    pine(cols * .27, rows - 3, Math.round(rows * .47), true);
    pine(cols * .86, rows - 2, Math.round(rows * .61), false);
    const log = cols * .73;
    surface(log, rows - 2.6, 6.8, 1.1, 'deer', -.13);
    surface(log - 5, rows - 2.3, 1.4, 1.25, 'rabbit');
    surface(log - 5, rows - 2.3, .6, .57, 'deer');
  }
  if (edge === 1) {
    // Rounded crowns, stems and stones along a woodland path.
    for (const [position, size] of [[.18,.8],[.43,.58],[.77,.93]]) {
      const trunk = Math.round(cols * position);
      const crown = rows * (1 - size * .68);
      for (let y = Math.floor(crown); y < rows - 1; y++) {
        write(trunk - 1, y, .68, 'deer', '/');
        write(trunk, y, .4, 'deer', '|');
      }
      surface(trunk - 3, crown + .9, size * 6.5, size * 2.7, 'pine', -.15);
      surface(trunk + 3, crown + 2, size * 5.7, size * 2.5, 'pine', .12);
      surface(trunk, crown, size * 5.8, size * 3.3, 'pine');
    }
    for (const [position, radius] of [[.31,3.4],[.55,2.5],[.62,4.3],[.89,2.2]]) {
      surface(cols * position, rows - 2, radius, 1.25, 'stone');
    }
  }
  if (edge === 2 && rows >= 6) {
    const shrubs = [
      [.09,7,3.2], [.18,11,4.2], [.30,7,2.5], [.36,10,4.6],
      [.48,12,3.4], [.59,8,2.9], [.65,5,2.2], [.83,8,3.5], [.91,7,2.7]
    ];
    for (const [position, width, height] of shrubs) {
      const root = Math.round(cols * position);
      const sway = Math.sin(time * 1.4 + root) * .65;
      const base = rows - 1;
      surface(root - width * .36, base - height * .39, width * .64, height * .65, 'pine', -.12);
      surface(root + width * .43, base - height * .29, width * .56, height * .5, 'earth', .1);
      surface(root + sway, base - height * .7, width * .61, height * .66, 'pine', -.09);
      for (let dx = -3; dx <= 3; dx += 3) {
        const y = Math.round(base - height * (.6 + noise(root + dx, 3) * .45));
        if (noise(root + dx, 12) > .66) write(root + dx, y, .77, 'deer', 'o');
      }
    }
  }

  if (edge === 0) {
    const x = deerX;
    const y = rows - 4.7;
    const headDown = time % 8 < 6;
    surface(x - 3.4, y + 1.65, .58, 1.75, 'deer', -.18);
    surface(x + 3.3, y + 1.65, .57, 1.75, 'deer', .22);
    surface(x - 5.5, y - .25, 1.5, .48, 'deer', -.32);
    surface(x, y, 5.8, 1.6, 'deer', -.08);
    surface(x + 4.7, y + (headDown ? .65 : -.9), 2.7, .85, 'deer', headDown ? .63 : -.78);
    const faceY = y + (headDown ? 2 : -2.35);
    surface(x + 7, faceY, 1.9, .87, 'deer', headDown ? .4 : -.03);
    surface(x + 6, faceY - .7, .9, .47, 'deer', -.65);
    write(x + 7, Math.round(faceY), .2, 'deer');
  }
  if (edge === 2 && rows >= 6) {
    const y = rows - 2.7;
    const twitch = Math.sin(time * 4) * .19;
    surface(rabbitX - 2.8, y - .1, .95, .75, 'rabbit');
    surface(rabbitX, y, 2.75, 1.37, 'rabbit', -.13);
    surface(rabbitX + 1.5, y + .7, 2.2, .7, 'rabbit');
    surface(rabbitX + 2.4, y - .7, 1.6, 1, 'rabbit');
    surface(rabbitX + 1.6, y - 2.15, .52, 1.48, 'rabbit', -.4 + twitch);
    surface(rabbitX + 2.65, y - 2.1, .45, 1.3, 'rabbit', -.15 + twitch);
    write(rabbitX + 3, Math.round(y - .7), .17, 'rabbit');
  }

  renderCells();
}

// Each list is a spaced arrangement along one edge, laid out as [along, height].
const edgeStars = [
  [[.07,.22],[.18,.76],[.29,.45],[.41,.15],[.5,.64],[.6,.3],[.8,.75],[.91,.38]],
  [[.06,.66],[.15,.22],[.38,.76],[.49,.19],[.58,.52],[.7,.78],[.83,.32],[.93,.61]],
  [[.04,.37],[.1,.73],[.17,.17],[.24,.56],[.31,.8],[.39,.3],[.44,.65],[.52,.12],[.59,.49],[.66,.77],[.81,.18],[.87,.68],[.93,.41],[.97,.79]],
  [[.04,.7],[.11,.21],[.19,.55],[.26,.18],[.35,.69],[.42,.36],[.49,.76],[.57,.22],[.64,.57],[.73,.14],[.79,.68],[.85,.39],[.92,.78],[.97,.19]]
];

function drawSpace({ cols, rows, edge, time, write, surface }) {
  edgeStars[edge].forEach(([along, height], index) => {
    const x = Math.round((cols - 1) * along);
    const y = Math.round((rows - 1) * height);
    const twinkle = .47 + .26 * Math.sin(time * 1.7 + x);
    const glyph = index % 5 === 0 ? '*' : index % 3 === 0 ? '+' : '.';
    write(x, y, twinkle, 'star', glyph);
  });

  if (edge === 3) {
    const x = Math.round(cols * .3);
    const y = rows * .51;
    surface(x, y, 6.6, rows * .24, 'planet');
    for (let dx = -11; dx <= 10; dx++) {
      if (dx < -5 || dx > 1) write(x + dx, Math.round(y + dx * .14), .83 - Math.abs(dx) * .03, 'ice');
    }
    const starX = Math.round(cols * .72);
    const starY = Math.round(rows * .42);
    const glow = .83 + Math.sin(time * 1.2) * .12;
    write(starX, starY, 1, 'ice', '*');
    write(starX - 1, starY, glow, 'star', '-');
    write(starX + 1, starY, glow, 'star', '-');
    write(starX, starY - 1, glow, 'star', '|');
    write(starX, starY + 1, glow, 'star', '|');
    return;
  }
  if (edge === 0) {
    const x = cols * .39;
    const y = rows * .52;
    surface(x, y, 5.9, rows * .25, 'ice');
    surface(x - 2.6, y - 1.1, 1.25, .85, 'shale');
    surface(x + 2.2, y + 1.15, 1.45, .95, 'shale');
    surface(x - 1.4, y + 1.65, .9, .48, 'planet');
    return;
  }
  if (edge === 1) {
    const x = Math.round(cols * .57);
    const y = Math.floor(rows * .46);
    surface(x, y, 3.2, 2.4, 'ice', -.2);
    for (let offset = -10; offset <= 10; offset++) {
      if (Math.abs(offset) < 4) continue;
      const lit = offset < 0 ? .8 : .55;
      for (let row = -1; row <= 1; row++) {
        write(x + offset, y + row, lit - row * .12, 'planet', offset % 3 === 0 ? '|' : '=');
      }
    }
    write(x + 1, y - 3, .82, 'ice', '/');
    write(x + 3, y - 4, .67, 'ice', '+');
    return;
  }

  for (const [position, height, size] of [[.24,.62,3.6],[.34,.32,2.2],[.57,.67,4.2],[.63,.38,2.8],[.83,.51,2]]) {
    surface(cols * position, rows * height, size, size * .46, 'shale', -.34);
  }
  const flight = (.18 + time * 4 / cols) % 1;
  const comet = 12 + Math.floor((cols - 18) * flight);
  const brightness = Math.min(1, flight * 9, (1 - flight) * 9);
  for (let i = 0; i < 12; i++) {
    write(comet - i, 2 + Math.floor(i / 4), brightness * (.96 - i * .068), 'star', i < 2 ? '*' : '.');
  }
}

function drawMountains({ cols, rows, edge, time, noise, write, surface }) {
  const base = rows - 1;
  function peak(position, height, leftSlope, rightSlope, snowline) {
    const summit = Math.round(cols * position);
    const rise = Math.min(Math.round(height), base, Math.floor((summit - 3) / leftSlope), Math.floor((cols - 4 - summit) / rightSlope));
    for (let slope = 0; slope <= rise; slope++) {
      const y = base - rise + slope;
      const toLeft = Math.floor(slope * leftSlope);
      const toRight = Math.floor(slope * rightSlope);
      for (let dx = -toLeft; dx <= toRight; dx++) {
        const grain = noise(summit + dx, y);
        const ridge = slope * .21 - 1.1;
        const lit = dx < ridge ? .64 : .34;
        const isSnow = slope + grain * 1.8 < snowline * rise;
        write(summit + dx, y, lit + grain * .21, isSnow ? 'ice' : 'shale');
      }
    }
  }

  if (edge === 3) {
    peak(.1, rows * .44, 1.9, 2.6, .27);
    peak(.19, rows * .66, 2, 2.9, .34);
    peak(.39, rows * .51, 2.8, 2.2, .32);
    peak(.48, rows * .72, 2.6, 2, .42);
    peak(.69, rows * .58, 1.7, 2.5, .4);
    peak(.79, rows * .65, 2, 2.4, .38);
    peak(.92, rows * .48, 2.2, 2.1, .27);
    peak(.27, rows * .64, 2.1, 2.2, .43);
    peak(.57, rows * .87, 2.2, 2.8, .47);
    peak(.84, rows * .64, 2.3, 1.9, .35);
    const gustX = cols * (.38 + .15 * Math.sin(time * .54));
    surface(gustX, 1.45, 8, .82, 'cloud');
    return;
  }
  if (edge === 0) {
    // Stepped rock faces, with narrow lit ledges and darker vertical faults.
    peak(.3, rows * .63, 1.17, 1.42, .41);
    peak(.61, rows * .73, 1.09, 1.22, .36);
    for (const [position, width, rise] of [[.11,6,.39],[.2,9,.52],[.43,14,.84],[.75,12,.65],[.91,5,.38]]) {
      const center = Math.round(cols * position);
      for (let dx = -width; dx <= width; dx++) {
        const profile = 1 - (Math.abs(dx) / width) ** 2;
        const tall = Math.round(rows * rise * profile) - (dx % 5 === 0 ? 1 : 0);
        for (let y = rows - tall; y < rows; y++) {
          const ledge = (y + Math.floor(dx / 4)) % 4 === 0;
          const light = (dx < 0 ? .56 : .31) + (ledge ? .23 : 0) + noise(dx, y) * .15;
          write(center + dx, y, light, ledge && y < rows * .45 ? 'ice' : 'shale');
        }
      }
    }
    return;
  }
  if (edge === 1) {
    // A glacier tongue widens as it descends between the valley walls.
    peak(.15, rows * .49, 1.2, 1.35, .35);
    peak(.29, rows * .78, 1.34, 1.5, .42);
    peak(.76, rows * .67, 1.16, 1.66, .4);
    peak(.88, rows * .49, 1.19, 1.28, .33);
    const center = cols * .54;
    for (let y = 1; y < rows; y++) {
      const drop = y / (rows - 1);
      const bed = center + drop ** 2 * cols * .08;
      const span = 3 + drop * cols * .15;
      for (let x = Math.ceil(bed - span); x <= bed + span; x++) {
        const face = (x - bed) / span;
        const fracture = Math.sin(x * .8 + y * 1.7);
        const light = .58 - .22 * face + .22 * noise(x, y) - (fracture > .89 ? .32 : 0);
        write(x, y, light, Math.abs(face) > .82 ? 'shale' : 'ice');
      }
    }
    surface(cols * .23, rows - 2.2, 8, 1.7, 'stone', -.15);
    surface(cols * .82, rows - 2.4, 5.5, 1.6, 'shale');
    return;
  }

  peak(.16, rows * .59, 2.4, 2.1, .35);
  peak(.31, rows * .71, 2, 2.5, .41);
  peak(.69, rows * .63, 2.1, 2.6, .36);
  peak(.84, rows * .54, 1.9, 2.3, .33);
  // Rolling foothills sit around a small, bright tarn.
  for (const [position, width, rise] of [[.15,.105,.41],[.29,.14,.52],[.69,.18,.45],[.86,.1,.35]]) {
    const center = position * cols;
    const half = width * cols;
    for (let x = Math.ceil(center - half); x <= center + half; x++) {
      const cross = (x - center) / half;
      const height = rows * rise * Math.cos(cross * Math.PI / 2) ** 2;
      for (let y = Math.ceil(rows - height); y < rows; y++) {
        const light = .34 - .21 * cross + .27 * noise(x, y);
        write(x, y, light, 'shale');
      }
    }
  }
  surface(cols * .48, rows - 3, Math.min(17, cols * .1), 1.8, 'water');
  surface(cols * .53, rows - 2.7, Math.min(9, cols * .08), .7, 'ice');
}

function drawAlternateScene(theme, scene) {
  if (theme === 'space') drawSpace(scene);
  else drawMountains(scene);
}

let forestRequest;
let forestTime = 0;
let lastFrame;
let lastDraw;
function animateForest(now) {
  if (lastFrame !== undefined) forestTime += Math.min(80, now - lastFrame) / 1000;
  lastFrame = now;
  const interval = currentTheme === 'postmodern' ? 1000 / 30 : 100;
  if (lastDraw === undefined || now - lastDraw >= interval) {
    drawForest(forestTime);
    lastDraw = now;
  }
  forestRequest = requestAnimationFrame(animateForest);
}
function syncForest() {
  cancelAnimationFrame(forestRequest);
  lastFrame = undefined;
  lastDraw = undefined;
  drawForest(forestTime);
  if (!paused && !reduced.matches && !document.hidden && !rebuilding) {
    forestRequest = requestAnimationFrame(animateForest);
  }
}
motionButton.addEventListener('click', () => {
  paused = !paused;
  if (paused) centerEye();
  motionButton.textContent = paused ? 'Resume background' : 'Pause background';
  motionButton.setAttribute('aria-pressed', String(paused));
  syncForest();
});
function updateMotionPreference() {
  motionButton.hidden = reduced.matches;
  if (reduced.matches) centerEye();
  syncForest();
}
reduced.addEventListener('change', updateMotionPreference);
document.addEventListener('visibilitychange', syncForest);
window.addEventListener('resize', syncForest);
updateMotionPreference();

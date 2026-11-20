const grid = document.querySelector('#grid');
const desk = document.querySelector('#desk');
const expanded = document.querySelector('#expanded');
const content = document.querySelector('#project-content');
const detailNav = document.querySelector('#detail-nav');
const closeButton = document.querySelector('#close');
const shuffleButton = document.querySelector('#shuffle');
const themeMenu = document.querySelector('#theme-menu');
const motionButton = document.querySelector('#motion');
const status = document.querySelector('#status');
const eyeCanvas = document.querySelector('.eye-assembly');
const eyeToolbar = document.querySelector('.toolbar');
const eyeHeadline = document.querySelector('.site-header h1');
const eyeSchool = document.querySelector('.school');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const supported = matchMedia('(min-width: 900px) and (min-height: 640px) and (aspect-ratio > 5/4)');
// ?view=krillion shows the mobile page instead; the grid, its keys and the scenery stay idle.
const krillView = document.documentElement.classList.contains('krill-view');
const order = projects.map((_, index) => index);
let selected = null;
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

function linkBanner(project) {
  const art = node('pre', '', 'art');
  // One wrapper keeps the banner and the cow aligned as a single grid item.
  const lines = node('span');
  const [name, href] = project.links[0];
  const banner = node('a', '   .--------------------.\n   |  [ open a link ]   |\n   \x27--------------------\x27');
  banner.href = href;
  banner.setAttribute('aria-label', name);
  // The cow is decoration; the banner link already carries the accessible name.
  const cow = node('span', '\n         \\   ^__^\n             (oo)\\_______\n             (__)\\       )\\/\\\n                 ||----w |\n                 ||     ||');
  cow.setAttribute('aria-hidden', 'true');
  lines.append(banner, cow);
  art.append(lines);
  return art;
}

// A live page in a frame (the Brightspace wrapper demo), with a way to open it full size.
function embedFrame(project, lazy) {
  const frame = node('figure', '', 'visual embed');
  const view = node('iframe');
  view.src = project.embed;
  view.title = project.name + ' demo with two made-up classes';
  if (lazy) view.loading = 'lazy';
  const open = node('a', 'Open full size ↗', 'embed-open');
  open.href = project.embed;
  open.target = '_blank';
  open.rel = 'noopener';
  frame.append(view, open);
  return frame;
}

function imageFigure([file, alt, width, height], lazy) {
  const frame = node('figure', '', 'visual');
  const image = node('img');
  image.src = 'assets/' + file;
  image.alt = alt;
  image.width = width;
  image.height = height;
  image.decoding = 'async';
  if (lazy) image.loading = 'lazy';
  frame.append(image);
  return frame;
}

// desktop-content.js can give each section its own picture, so windows don't all repeat the project's main image.
const sectionImageFor = (project, section) => (typeof sectionImages !== 'undefined' && sectionImages[project.name]?.[section]) || null;

function projectVisual(project, section, lazy = false) {
  if (section === 1 && project.embed) return embedFrame(project, lazy);
  const own = sectionImageFor(project, section);
  if (own) return imageFigure(own, lazy);
  if (section === 5 && project.links) return linkBanner(project);
  if (project.gallery) {
    const frame = node('figure', '', 'visual screenshot-strip');
    project.gallery.forEach(([file, alt, width, height]) => {
      const image = node('img');
      image.src = 'assets/' + file; image.alt = alt; image.width = width; image.height = height;
      image.decoding = 'async'; if (lazy) image.loading = 'lazy';
      frame.append(image);
    });
    return frame;
  }
  const desktopImage = typeof desktopImages !== 'undefined' && desktopImages[project.name];
  const asset = (section === 3 && project.extra) || desktopImage || project.image;
  if (!asset) {
    // Announce the diagram as one image instead of reading its punctuation aloud.
    const art = node('pre', project.art, 'art');
    art.setAttribute('role', 'img');
    art.setAttribute('aria-label', project.artAlt);
    return art;
  }
  return imageFigure(asset, lazy);
}

// Extra depth per section from desktop-content.js: text, figures, lists, steps, stats and code.
function renderBlock([type, ...rest], lazy) {
  if (type === 'p') return node('p', rest[0]);
  if (type === 'h') return node('h4', rest[0], 'block-h');
  if (type === 'img') {
    const [file, alt, width, height, caption] = rest;
    const figure = node('figure', '', 'block-fig');
    const image = node('img');
    image.src = 'assets/' + file; image.alt = alt; image.width = width; image.height = height;
    image.decoding = 'async'; if (lazy) image.loading = 'lazy';
    figure.append(image);
    if (caption) figure.append(node('figcaption', caption));
    return figure;
  }
  if (type === 'list' || type === 'tags') {
    const list = node('ul', '', type === 'tags' ? 'block-tags' : 'block-list');
    rest[0].forEach(text => list.append(node('li', text)));
    return list;
  }
  if (type === 'steps') {
    const list = node('ol', '', 'block-steps');
    rest[0].forEach(([title, text]) => { const item = node('li'); item.append(node('b', title), ' ' + text); list.append(item); });
    return list;
  }
  if (type === 'stats') {
    const list = node('ul', '', 'block-stats');
    rest[0].forEach(([value, label]) => { const item = node('li'); item.append(node('b', value), node('span', label)); list.append(item); });
    return list;
  }
  if (type === 'code') {
    const figure = node('figure', '', 'block-code');
    if (rest[1]) figure.append(node('figcaption', rest[1]));
    figure.append(node('pre', rest[0]));
    return figure;
  }
  return null;
}

function sectionBlocks(project, section, lazy = false) {
  const list = (typeof desktopBlocks !== 'undefined' && desktopBlocks[project.name]?.[section]) || [];
  if (!list.length) return null;
  const wrap = node('div', '', 'blocks');
  list.forEach(block => { const element = renderBlock(block, lazy); if (element) wrap.append(element); });
  return wrap;
}

// Small project icons before a window title (projects.js `icon`: one file or a list).
function iconNodes(project) {
  return [].concat(project.icon || []).map(file => {
    const image = node('img', '', 'title-icon');
    image.src = 'assets/' + file; image.alt = ''; image.width = 18; image.height = 18; image.decoding = 'async';
    return image;
  });
}

function paintCard(slot) {
  const card = grid.children[slot];
  const project = projects[order[slot]];
  card.querySelector('.title-icons').replaceChildren(...iconNodes(project));
  const title = project.name + ' - ' + labelsFor(project)[slot];
  card.querySelector('h2').textContent = title;
  card.querySelector('button').setAttribute('aria-label', 'Expand ' + project.name);
  const preview = card.querySelector('.preview');
  preview.querySelector('.tagline').textContent = project.tagline;
  preview.querySelector('.copy').textContent = project.detail[slot];
  const details = preview.querySelector('.preview-details');
  details.replaceChildren(projectVisual(project, slot));
  appendSectionExtras(details, project, slot);
  const blocks = sectionBlocks(project, slot, true);
  if (blocks) details.append(blocks);
  preview.scrollTo({ top: 0, behavior: 'instant' });
}

function makeCard(slot) {
  const card = node('article', '', 'window');
  card.dataset.slot = slot;
  const bar = node('header', '', 'window-bar');
  const title = node('h2');
  title.id = 'slot-title-' + slot;
  const grip = node('span', '⠿', 'grip');
  grip.title = 'Drag slot ' + (slot + 1);
  grip.setAttribute('aria-hidden', 'true');
  const button = node('button', '↗');
  button.type = 'button';
  button.addEventListener('click', () => openProject(slot));
  const head = node('div', '', 'window-title');
  head.append(node('span', '', 'title-icons'), title);
  bar.append(head, grip, button);
  const preview = node('div', '', 'preview');
  preview.tabIndex = 0;
  preview.setAttribute('role', 'region');
  preview.setAttribute('aria-labelledby', title.id);
  const copy = node('p', '', 'copy');
  const badge = node('span', String(slot + 1), 'slot');
  badge.setAttribute('aria-hidden', 'true');
  const caption = node('div', '', 'caption');
  caption.append(badge, copy);
  preview.append(node('p', '', 'tagline'), caption, node('div', '', 'preview-details'));
  card.append(bar, preview);

  grip.addEventListener('pointerdown', event => startDrag(event, slot, card, grip));
  return card;
}

// Pointer drag: the window follows the pointer and leaves its cell empty. Dropping on another window
// swaps them; dropping anywhere else (or Escape) glides it back to its cell.
let drag = null;
function startDrag(event, slot, card, grip) {
  if (event.button !== 0 || busy || openSlot !== null || drag) return;
  event.preventDefault();
  grip.setPointerCapture(event.pointerId);
  drag = { slot, card, grip, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, over: null,
    rects: Array.from(grid.children, c => c.getBoundingClientRect()) };
  grip.addEventListener('pointermove', moveDrag);
  grip.addEventListener('pointerup', dropDrag);
  grip.addEventListener('pointercancel', cancelDrag);
  grip.addEventListener('lostpointercapture', cancelDrag);
}

function moveDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    selectSlot(drag.slot);
    drag.card.classList.add('lifted');
    document.documentElement.classList.add('dragging');
  }
  drag.card.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  const hit = drag.rects.findIndex((r, i) => i !== drag.slot && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom);
  const over = hit < 0 ? null : hit;
  if (over !== drag.over) {
    if (drag.over !== null) grid.children[drag.over].classList.remove('destination');
    if (over !== null) grid.children[over].classList.add('destination');
    drag.over = over;
  }
}

function finishDrag() {
  const d = drag;
  drag = null;
  d.grip.removeEventListener('pointermove', moveDrag);
  d.grip.removeEventListener('pointerup', dropDrag);
  d.grip.removeEventListener('pointercancel', cancelDrag);
  d.grip.removeEventListener('lostpointercapture', cancelDrag);
  if (d.grip.hasPointerCapture(d.id)) d.grip.releasePointerCapture(d.id);
  document.documentElement.classList.remove('dragging');
  return d;
}

function dropDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  const d = finishDrag();
  if (!d.moved) return;
  if (d.over !== null && !busy) {
    const at = d.card.getBoundingClientRect();
    d.card.style.transform = '';
    d.card.classList.remove('lifted');
    void runSwaps([[d.slot, d.over]], undefined, at);
  } else settle(d.card);
}

function cancelDrag(event) {
  if (!drag || (event && event.pointerId !== undefined && event.pointerId !== drag.id)) return;
  const d = finishDrag();
  if (d.moved) settle(d.card);
}

// Glide a lifted window back to its own cell.
function settle(card) {
  grid.querySelectorAll('.destination').forEach(c => c.classList.remove('destination'));
  selectSlot(null);
  const from = card.style.transform;
  card.style.transform = '';
  status.textContent = 'Move canceled.';
  if (reduced.matches || !from) { card.classList.remove('lifted'); return; }
  const done = () => card.classList.remove('lifted');
  card.animate([{ transform: from }, { transform: 'translate(0,0)' }], { duration: 240, easing: 'cubic-bezier(.2,.75,.3,1)' }).finished.then(done, done);
}

function selectSlot(slot) {
  selected = slot;
  Array.from(grid.children).forEach((card, index) => card.classList.toggle('selected', index === slot));
  if (slot !== null) status.textContent = 'Slot ' + (slot + 1) + ' selected. Press another slot number to swap.';
}

function endDrag() {
  if (drag) cancelDrag();
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

// dropAt: where a dragged window was let go, so it slides into its new cell from there.
async function runSwaps(pairs, nextTheme, dropAt) {
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
      if (!dropAt) await Promise.all(cards.flatMap(card => Array.from(card.querySelectorAll('h2, .tagline, .copy'), el => typeTo(el, '', 90))));
      [order[from], order[to]] = [order[to], order[from]];
      paintCard(from);
      paintCard(to);
      const motion = cards.map((card, index) => {
        const other = index === 1 && dropAt ? dropAt : before[1 - index];
        const at = before[index];
        if (reduced.matches) return Promise.resolve();
        return card.animate([
          { transform: 'translate(' + (other.left - at.left) + 'px,' + (other.top - at.top) + 'px)', opacity: .72 },
          { transform: 'translate(0,0)', opacity: 1 }
        ], { duration: 250, easing: 'cubic-bezier(.2,.75,.3,1)' }).finished;
      });
      const lines = cards.flatMap(card => Array.from(card.querySelectorAll('h2, .tagline, .copy')));
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

function shuffleTo(theme) {
  const pairs = [];
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    if (other !== index) pairs.push([index, other]);
  }
  if (!pairs.length) pairs.push([0, 1 + Math.floor(Math.random() * (order.length - 1))]);
  void runSwaps(pairs, theme);
}

document.addEventListener('keydown', event => {
  if (drag && event.key === 'Escape') { event.preventDefault(); cancelDrag(); return; }
  if (event.defaultPrevented || event.repeat || !supported.matches || krillView) return;
  if (openSlot !== null) {
    if (event.key === 'Escape') requestClose();
    return;
  }
  if (busy || !themeMenu.hidden || event.target.closest('input, textarea, select, [contenteditable]')) return;
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
  if (project.demo === 'd31') {
    // d31 is a clean-room rebuild, so the demo points at the original game instead of a mock turn.
    const link = node('a', 'Korean Student Simulator on Google Play ↗');
    link.href = 'https://play.google.com/store/apps/details?id=com.basakansoft.koreanstudentsimulator';
    link.target = '_blank';
    link.rel = 'noopener';
    demo.append(node('p', 'd31 is a clean-room rebuild of Korean Student Simulator’s 31-Day Mode, by Basakansoft. Play the original:'), link);
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

const slugOf = project => project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function openProject(slot, pushHistory = true) {
  if (openSlot !== null || busy || !supported.matches) return;
  if (pushHistory) history.pushState({ expanded: true }, '', '#' + slugOf(projects[order[slot]]));
  selectSlot(null);
  const start = grid.children[slot].getBoundingClientRect();
  const end = desk.getBoundingClientRect();
  const project = projects[order[slot]];
  const token = ++animationToken;
  const active = () => token === animationToken;
  const incoming = [];
  openSlot = slot;
  document.querySelector('#expanded-title').textContent = project.name;
  expandedIcons.replaceChildren(...iconNodes(project));
  labelsFor(project).forEach((label, index) => {
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
    if (index === 0 || (index === slot && index !== 5) || index === 5 || (index === 3 && project.extra) || (index === 1 && project.embed) || sectionImageFor(project, index)) {
      part.append(projectVisual(project, index, index !== slot));
    }
    appendSectionExtras(part, project, index);
    const blocks = sectionBlocks(project, index, index !== slot);
    if (blocks) part.append(blocks);
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

function clearProjectHash() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

// Closing steps back through history when this page opened the project, so Back and × agree.
function requestClose() {
  if (history.state?.expanded) history.back();
  else { closeProject(); clearProjectHash(); }
}

function syncFromHash() {
  const index = projects.findIndex(project => slugOf(project) === location.hash.slice(1));
  const slot = index < 0 ? null : order.indexOf(index);
  if (openSlot !== null && openSlot !== slot) closeProject();
  if (slot !== null && openSlot === null) openProject(slot, false);
}

closeButton.addEventListener('click', requestClose);
window.addEventListener('popstate', syncFromHash);
supported.addEventListener('change', event => {
  if (!event.matches) { closeProject(); clearProjectHash(); endDrag(); }
});

// The expanded view's title gets the same icon slot as the grid windows.
const expandedIcons = node('span', '', 'title-icons');
{
  const expandedTitle = document.querySelector('#expanded-title');
  const head = node('div', '', 'window-title');
  expandedTitle.replaceWith(head);
  head.append(expandedIcons, expandedTitle);
}

projects.forEach((_, index) => { grid.append(makeCard(index)); paintCard(index); });

// Snowdrift wraps the name in a sculpted red-and-white ASCII scarf, drawn on its own canvas so every
// stitch can be shaded like the scenery. It wraps on during the snow-in and scatters out with the scenery.
let scarfCells = [];
let scarfKey = '';
let scarfShown = 0;
let scarfLayout = null;
const scarfShades = {
  red: ['#5a121b', '#a02a35', '#c2343f', '#e24c57', '#ff8f94'],
  white: ['#5d6b7c', '#8e9fb2', '#bccad8', '#e2ebf3', '#ffffff']
};
// Fullness ramp: sparse glyphs where the wool turns away into shadow, dense ones where it faces the light.
// The low end avoids single-stroke glyphs like '-', which vanish at small sizes in dark red.
const scarfRamp = ['.', ':', ';', '=', '+', '*', 'x', 'X', '%', '#', '@'];
const knotRamp = ['.', ':', ';', 'o', 'o', 'O', 'O', '0', '&', '@', '@'];
// Light comes from the upper left and a little in front, like the scenery.
const scarfLight = (() => { const l = Math.hypot(.45, .6, .66); return [-.45 / l, -.6 / l, .66 / l]; })();

function buildScarf() {
  const scarf = document.querySelector('.scarf');
  if (!scarf) return;
  const name = scarf.parentElement;
  const box = name.getBoundingClientRect();
  const W = box.width;
  const H = box.height;
  if (!W || !H) return;
  const size = Math.max(6, Math.min(13, parseFloat(getComputedStyle(name).fontSize) * .15));
  const cw = size * .6;
  const ch = size;
  const text = document.createRange();
  text.selectNodeContents(document.querySelector('#instructions'));
  const words = text.getBoundingClientRect();
  const [lx, ly, lz] = scarfLight;
  // Lambert shading with an ambient floor, so the underside is darker but never disappears.
  const shade = (nx, ny, nz) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    return .2 + .8 * Math.max(0, (nx * lx + ny * ly + nz * lz) / l);
  };
  const cells = new Map();
  // Each cell keeps the nearest part (highest z); within one part, the sample closest to the cell centre.
  function put(x, y, z, light, tone, order, kind, glyph = null, opaque = true) {
    const i = Math.round(x / cw);
    const j = Math.round(y / ch);
    const dist = Math.hypot(x / cw - i, y / ch - j);
    const key = i + ',' + j;
    const old = cells.get(key);
    if (old && (old.z > z || (old.z === z && old.dist <= dist))) return;
    cells.set(key, { i, j, z, dist, light: Math.max(0, Math.min(1, light)), tone, order, kind, glyph, opaque });
  }
  // Knit ribs: a gentle ripple every three columns, smaller than one step of the ramp, so it reads as
  // texture instead of a checkerboard.
  const rib = x => .03 * Math.sin(x / cw * Math.PI * 2 / 3);
  // Stripes run along the scarf, three stitches long, continuing from the band into the ends.
  const stripe = distance => Math.floor(distance / (cw * 3)) % 2 === 0 ? 'red' : 'white';
  const radius = Math.max(1.5 * ch, .13 * H);

  // The band is a tube across the base of the name. It sags a little, and near each end it turns away
  // and lifts as it wraps behind the neck, so it shrinks, rotates out of the light, and darkens.
  const x0 = -.04 * W;
  const x1 = .94 * W;
  for (let x = x0; x <= x1; x += cw * .3) {
    const t = (x - x0) / (x1 - x0);
    const k = Math.max(0, 1 - Math.min(t, 1 - t) / .1);
    const phi = (t < .5 ? -1 : 1) * k * 1.1;
    const r = radius * (.92 + .12 * Math.sin(Math.PI * t)) * (1 - .3 * k);
    const cy = H * (.9 + .035 * Math.sin(Math.PI * t)) - .35 * radius * k;
    const step = Math.min(.25, ch * .3 / r);
    for (let a = -1; a <= 1 + 1e-6; a += step) {
      const across = Math.max(-1, Math.min(1, a));
      const nz0 = Math.sqrt(1 - across * across);
      const light = shade(Math.sin(phi) * nz0, across, Math.cos(phi) * nz0) * (1 - .25 * k) + rib(x);
      put(x, cy + across * r, 1, light, stripe(x - x0), .55 * t, 'knit');
    }
  }

  // The knot is a lumpy ball with folds, sitting in front of the band.
  const kx = x1 + .02 * W;
  const ky = H * .9;
  const krx = radius * 1.2;
  const kry = radius * 1.05;
  for (let y = ky - kry; y <= ky + kry; y += ch * .3) {
    for (let x = kx - krx; x <= kx + krx; x += cw * .3) {
      const u = (x - kx) / krx;
      const w = (y - ky) / kry;
      const d = u * u + w * w;
      if (d > 1) continue;
      const fold = .18 * Math.sin(Math.atan2(w, u) * 3 + d * 4);
      put(x, y, 4, shade(u + fold, w - fold * .5, Math.sqrt(1 - d)), Math.abs(u + .4 * w) < .25 ? 'white' : 'red', .6, 'knot');
    }
  }

  // Two ends droop from the knot; the front one ends over the end of the instructions line.
  // Each end is a thick ribbon that twists: where it turns edge-on it narrows, and past the turn
  // it shows its darker back face.
  const bandLength = x1 - x0;
  const midY = (words.top + words.bottom) / 2 - box.top;
  const endX = Math.max(.5 * W, Math.min(1.35 * W, words.right - box.left - 5 * cw));
  const endY = Math.max(ky + .5 * H, midY);
  const drop = endY - ky;
  const tails = [
    { points: [[kx, ky], [kx + .14 * W, ky + .3 * H], [endX + .26 * W, endY - .4 * drop], [endX + .14 * W, endY - .25 * drop]], z: 2, width: .8, twist: 1.5, order: [.62, .9] },
    { points: [[kx, ky], [kx + .2 * W, ky + .2 * H], [endX + .16 * W, endY - .6 * drop], [endX, endY]], z: 3, width: .9, twist: .8, order: [.64, .95] }
  ];
  const bezier = (p, s) => {
    const a = 1 - s;
    return [0, 1].map(n => a * a * a * p[0][n] + 3 * a * a * s * p[1][n] + 3 * a * s * s * p[2][n] + s * s * s * p[3][n]);
  };
  for (const tail of tails) {
    const samples = [];
    let length = 0;
    let prev = bezier(tail.points, 0);
    for (let n = 0; n <= 240; n++) {
      const s = n / 240;
      const at = bezier(tail.points, s);
      length += Math.hypot(at[0] - prev[0], at[1] - prev[1]);
      samples.push([s, at, length]);
      prev = at;
    }
    let last = null;
    for (let n = 1; n < samples.length; n++) {
      const [s, [x, y], along] = samples[n];
      const [px, py] = samples[n - 1][1];
      const tl = Math.hypot(x - px, y - py) || 1;
      const tx = (x - px) / tl;
      const ty = (y - py) / tl;
      const nxs = -ty;
      const nys = tx;
      const theta = tail.twist * Math.PI * s;
      const c = Math.cos(theta);
      const sn = Math.sin(theta);
      const r = radius * tail.width * (1 - .15 * s) * Math.max(.4, Math.abs(c));
      const backFace = c < 0 ? .78 : 1;
      const nearKnot = Math.min(1, .7 + s * 3);
      const order = tail.order[0] + (tail.order[1] - tail.order[0]) * s;
      const step = Math.min(.25, Math.min(cw, ch) * .3 / r);
      for (let a = -1; a <= 1 + 1e-6; a += step) {
        const across = Math.max(-1, Math.min(1, a));
        const nz0 = Math.sqrt(1 - across * across);
        // Half rounded tube, half flat face tilted by the twist.
        const nx = .5 * nxs * across + .5 * nxs * sn;
        const ny = .5 * nys * across + .5 * nys * sn;
        const nz = .5 * nz0 + .5 * Math.abs(c);
        const sx = x + nxs * across * r;
        const sy = y + nys * across * r;
        put(sx, sy, tail.z, shade(nx, ny, nz) * backFace * nearKnot + rib(sx), stripe(bandLength + along), order, 'knit');
      }
      last = { x, y, nxs, nys, r, tx, ty, order };
    }
    // A hem row, then fringe strands that hang mostly straight down.
    const fall = Math.hypot(last.tx * .3, last.ty * .3 + 1);
    const dirX = last.tx * .3 / fall;
    const dirY = (last.ty * .3 + 1) / fall;
    for (const u of [-.9, -.6, -.3, 0, .3, .6, .9]) {
      put(last.x + last.nxs * u * last.r + dirX * .9 * ch, last.y + last.nys * u * last.r + dirY * .9 * ch,
        tail.z, .55 - .2 * u, 'red', Math.min(1, last.order + .01), 'hem', '=');
    }
    for (const u of [-.8, -.27, .27, .8]) {
      for (let row = 2; row <= 4; row++) {
        put(last.x + last.nxs * u * last.r + dirX * row * ch, last.y + last.nys * u * last.r + dirY * row * ch,
          tail.z, .85 - (row - 2) * .2 - .1 * u, 'white', Math.min(1, last.order + .02 * row), 'fringe', row < 4 ? '|' : "'", false);
      }
    }
  }

  // Contact shadows: with light from the upper left, a nearer part darkens what sits below-right of it.
  for (const cell of cells.values()) {
    const over = cells.get((cell.i - 1) + ',' + (cell.j - 1));
    if (over && over.z > cell.z) cell.light *= .7;
  }

  scarfCells = [...cells.values()]
    .map((cell, index) => ({ ...cell, grain: hash(index, 7), dx: (hash(index, 8) - .5) * 14, dy: (hash(index, 9) - .5) * 10 }))
    .sort((a, b) => a.z - b.z);
  const columns = scarfCells.map(cell => cell.i);
  const rows = scarfCells.map(cell => cell.j);
  const minI = Math.min(...columns) - 2;
  const maxI = Math.max(...columns) + 2;
  const minJ = Math.min(...rows) - 2;
  const maxJ = Math.max(...rows) + 2;
  scarfLayout = { cw, ch, size, left: (minI - .5) * cw, top: (minJ - .5) * ch, width: (maxI - minI + 1) * cw, height: (maxJ - minJ + 1) * ch };
  let canvas = scarf.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    scarf.replaceChildren(canvas);
  }
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.left = scarfLayout.left + 'px';
  canvas.style.top = scarfLayout.top + 'px';
  canvas.style.width = scarfLayout.width + 'px';
  canvas.style.height = scarfLayout.height + 'px';
  canvas.width = Math.ceil(scarfLayout.width * ratio);
  canvas.height = Math.ceil(scarfLayout.height * ratio);
  scarfKey = '';
}

// Wraps on during the snow-in; scatters and dissolves on the same curve as the canvas ASCII when leaving.
function updateScarf() {
  if (!scarfCells.length || !scarfLayout || currentTheme !== 'snowdrift') { scarfKey = ''; return; }
  const entering = weather.burst >= 0;
  const wrap = entering ? smooth((weather.burst - .24) / .7) : 1;
  const visibility = entering ? 1 : sceneVisibility;
  // Exact values: a rounded key let the last transition frame (wrap 0.9996) stand in for wrap 1,
  // so the fringe tips never appeared after a real snow-in.
  const key = wrap + '|' + visibility;
  if (key === scarfKey) return;
  scarfKey = key;
  const canvas = document.querySelector('.scarf canvas');
  if (!canvas) return;
  const { cw, ch, size, left, top, width, height } = scarfLayout;
  const pen = canvas.getContext('2d');
  pen.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  pen.clearRect(0, 0, width, height);
  pen.font = '700 ' + size + 'px "IBM Plex Mono", "Courier New", monospace';
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const scatter = 1 - visibility;
  scarfShown = 0;
  for (const cell of scarfCells) {
    if (cell.order > wrap || cell.grain >= visibility) continue;
    scarfShown++;
    const x = cell.i * cw - left + cell.dx * scatter;
    const y = cell.j * ch - top + cell.dy * scatter;
    // Stitches are opaque, so the scarf reads as worn in front of the letters and the text below.
    if (cell.opaque) {
      pen.fillStyle = background;
      pen.fillRect(x - cw / 2 - .3, y - ch / 2 - .3, cw + .6, ch + .6);
    }
    const ramp = cell.kind === 'knot' ? knotRamp : scarfRamp;
    const glyph = cell.glyph ?? ramp[Math.max(1, Math.round(cell.light * (ramp.length - 1)))];
    const tone = Math.max(cell.opaque ? 1 : 0, Math.round(cell.light * 4));
    pen.fillStyle = scarfShades[cell.tone][tone];
    pen.fillText(glyph, x, y);
  }
}

// The ends aim at the instructions line, which can move without the name changing size.
window.addEventListener('resize', () => {
  if (currentTheme !== 'snowdrift') return;
  buildScarf();
  updateScarf();
});

const forest = document.querySelector('#forest');
const context = forest.getContext('2d');
const ramp = ' .,:;irsXAHM#@';
const glyphWidth = 4.4;
const glyphHeight = 6.1;
const themes = ['forest', 'space', 'mountains', 'postmodern', 'snowdrift'];
let currentTheme = 'forest';
let postmodernStartedAt = 0;
let themeBag = [];
let sceneVisibility = 1;
let rebuilding = false;
// Snowdrift weather: how much snow lies on the edges (0 bare, 1 full) and the transition overlays.
let snowCover = 1;
const weather = { burst: -1, melt: 0, sun: 0 };
function resetWeather() {
  weather.burst = -1;
  weather.melt = 0;
  weather.sun = 0;
  snowCover = 1;
}
function smooth(t) {
  const v = Math.max(0, Math.min(1, t));
  return v * v * (3 - 2 * v);
}
function hash(i, salt) {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
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
  shale: ['#263545', '#374c62', '#567289', '#7994a8', '#acc4cf'],
  snow: ['#3b4a5c', '#61758c', '#93a8bd', '#c9d8e6', '#f6fbff'],
  carrot: ['#5a2c14', '#8a4520', '#c2672b', '#e8904a', '#ffc08a'],
  sun: ['#6b3d12', '#b8691d', '#f0a43a', '#ffd27a', '#fff3c4']
};

function chooseTheme() {
  if (!themeBag.length) themeBag = themes.filter(theme => theme !== currentTheme);
  return themeBag.splice(Math.floor(Math.random() * themeBag.length), 1)[0];
}

// A click shuffles to a random theme; holding Shuffle (or right-click, or Down arrow) opens a menu to pick one.
const themeLabels = { forest: 'Forest', space: 'Space', mountains: 'Mountains', postmodern: 'Postmodern', snowdrift: 'Snowdrift' };
const holdDelay = 450;
let holdTimer = 0;
let suppressShuffleClick = false;
themes.forEach(theme => {
  const item = node('button', themeLabels[theme]);
  item.type = 'button';
  item.tabIndex = -1;
  item.dataset.theme = theme;
  item.setAttribute('role', 'menuitemradio');
  item.addEventListener('click', () => pickTheme(theme));
  const entry = node('li');
  entry.setAttribute('role', 'none');
  entry.append(item);
  themeMenu.append(entry);
});
const menuItems = () => Array.from(themeMenu.querySelectorAll('button'));
const pickableItems = () => menuItems().filter(item => item.getAttribute('aria-disabled') !== 'true');

function openThemeMenu() {
  if (!themeMenu.hidden || busy || openSlot !== null || shuffleButton.disabled) return;
  menuItems().forEach(item => {
    const current = item.dataset.theme === currentTheme;
    item.setAttribute('aria-checked', String(current));
    item.setAttribute('aria-disabled', String(current));
  });
  themeMenu.hidden = false;
  shuffleButton.setAttribute('aria-expanded', 'true');
  pickableItems()[0]?.focus();
}

function closeThemeMenu(returnFocus) {
  suppressShuffleClick = false;
  if (themeMenu.hidden) return;
  themeMenu.hidden = true;
  shuffleButton.setAttribute('aria-expanded', 'false');
  if (returnFocus) shuffleButton.focus();
}

function pickTheme(theme) {
  if (theme === currentTheme) return;
  closeThemeMenu(true);
  themeBag = themeBag.filter(entry => entry !== theme);
  shuffleTo(theme);
}

function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = 0;
  shuffleButton.classList.remove('holding');
}

shuffleButton.addEventListener('pointerdown', event => {
  if (event.button !== 0 || shuffleButton.disabled) return;
  cancelHold();
  suppressShuffleClick = false;
  shuffleButton.classList.add('holding');
  holdTimer = setTimeout(() => {
    cancelHold();
    suppressShuffleClick = true;
    openThemeMenu();
  }, holdDelay);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(type => shuffleButton.addEventListener(type, cancelHold));
shuffleButton.addEventListener('contextmenu', event => {
  event.preventDefault();
  cancelHold();
  openThemeMenu();
});
shuffleButton.addEventListener('click', () => {
  if (suppressShuffleClick) { suppressShuffleClick = false; return; }
  if (!themeMenu.hidden) { closeThemeMenu(false); return; }
  shuffleTo(chooseTheme());
});
shuffleButton.addEventListener('keydown', event => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  openThemeMenu();
});
themeMenu.addEventListener('keydown', event => {
  const items = pickableItems();
  const index = items.indexOf(document.activeElement);
  let next = null;
  if (event.key === 'ArrowDown') next = items[(index + 1) % items.length];
  else if (event.key === 'ArrowUp') next = items[(index - 1 + items.length) % items.length];
  else if (event.key === 'Home') next = items[0];
  else if (event.key === 'End') next = items.at(-1);
  else if (event.key === 'Escape') { event.preventDefault(); closeThemeMenu(true); return; }
  else if (event.key === 'Tab') { closeThemeMenu(false); return; }
  else return;
  event.preventDefault();
  next?.focus();
});
document.addEventListener('pointerdown', event => {
  if (!themeMenu.hidden && !event.target.closest('#theme-menu, #shuffle')) closeThemeMenu(false);
});

function setTheme(theme) {
  if (theme === 'postmodern' && currentTheme !== theme) postmodernStartedAt = forestTime;
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  if (theme === 'snowdrift') buildScarf();
  applyThemeIcon(theme);
  centerEye();
  positionEye();
}

// The painted gaze eases toward the target gaze, so the eye turns instead of jumping.
let eyeSightX = eyeRestSight[0];
let eyeSightY = eyeRestSight[1];
let eyeTargetX = eyeSightX;
let eyeTargetY = eyeSightY;
let eyeFrame = 0;
let eyeLastStep = 0;
// Seconds for the gaze to cover about 63 % of the remaining turn; it settles in roughly 0.35 s.
const eyeLag = .12;
// Distance, in CSS px, of the imaginary plane the pointer sits on in front of the globe.
const eyeDepth = 220;

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
  paintPostmodernEye(eyeCanvas, eyeSightX, eyeSightY);
}

function queueEyeFrame() {
  if (currentTheme !== 'postmodern' || !supported.matches || eyeFrame) return;
  eyeLastStep = performance.now();
  eyeFrame = requestAnimationFrame(stepEye);
}

function stepEye(now) {
  eyeFrame = 0;
  if (currentTheme !== 'postmodern' || !supported.matches) return;
  // Frame-rate independent easing; both gazes lie inside the turn limit, so every step does too.
  const ease = 1 - Math.exp(-Math.max(0, now - eyeLastStep) / 1000 / eyeLag);
  eyeLastStep = now;
  eyeSightX += (eyeTargetX - eyeSightX) * ease;
  eyeSightY += (eyeTargetY - eyeSightY) * ease;
  const settled = Math.hypot(eyeTargetX - eyeSightX, eyeTargetY - eyeSightY) < .003;
  if (settled) {
    eyeSightX = eyeTargetX;
    eyeSightY = eyeTargetY;
  }
  paintPostmodernEye(eyeCanvas, eyeSightX, eyeSightY);
  if (!settled) eyeFrame = requestAnimationFrame(stepEye);
}

// Pause, reduced motion and theme changes put the eye at rest at once, with no motion.
function centerEye() {
  [eyeSightX, eyeSightY] = eyeRestSight;
  [eyeTargetX, eyeTargetY] = eyeRestSight;
  queueEyeFrame();
}

// Aim straight at a point on the page, so level reads as level and both axes respond equally.
function lookAt(clientX, clientY) {
  const eye = eyeCanvas.getBoundingClientRect();
  const dx = clientX - eye.left - eye.width / 2;
  const dy = clientY - eye.bottom + eyeCenterFromBottom;
  const length = Math.hypot(dx, dy, eyeDepth);
  const turn = Math.hypot(dx, dy) / length;
  const limit = turn > eyeMaxTurn ? eyeMaxTurn / turn : 1;
  eyeTargetX = dx / length * limit;
  eyeTargetY = dy / length * limit;
  queueEyeFrame();
}

function canTrackEye() {
  return currentTheme === 'postmodern' && supported.matches && !reduced.matches && !paused;
}

// With no pointer to follow, the eye turns to stare at the Shuffle button.
function glanceAtShuffle() {
  if (!canTrackEye()) return;
  const target = shuffleButton.getBoundingClientRect();
  lookAt(target.left + target.width / 2, target.top + target.height / 2);
}

document.addEventListener('pointermove', event => {
  if (!canTrackEye() || event.pointerType === 'touch') return;
  lookAt(event.clientX, event.clientY);
}, { passive: true });
document.documentElement.addEventListener('pointerleave', glanceAtShuffle);
// mouseout with no relatedTarget is the most reliable signal that the pointer left the window.
document.addEventListener('mouseout', event => { if (!event.relatedTarget) glanceAtShuffle(); });
window.addEventListener('blur', glanceAtShuffle);
window.addEventListener('resize', positionEye);
const eyeLayoutObserver = new ResizeObserver(positionEye);
eyeLayoutObserver.observe(eyeHeadline);
eyeLayoutObserver.observe(eyeSchool);
// Refit the scarf when the name changes size (window resize, or Fraunces finishing loading).
new ResizeObserver(() => {
  if (currentTheme !== 'snowdrift') return;
  buildScarf();
  updateScarf();
}).observe(document.querySelector('.name'));

async function rebuildScene(nextTheme) {
  if (reduced.matches || paused) {
    resetWeather();
    setTheme(nextTheme);
    syncForest();
    return;
  }
  rebuilding = true;
  cancelAnimationFrame(forestRequest);
  const sceneDuration = 710;
  const entering = nextTheme === 'snowdrift' && currentTheme !== 'snowdrift';
  const leaving = currentTheme === 'snowdrift' && nextTheme !== 'snowdrift';
  // Snow blows in over 1.5 s. Leaving, the usual 0.71 s border swap runs inside a ~2 s melt.
  const swapStart = leaving ? 1000 : 0;
  const total = entering ? 1500 : leaving ? 2000 : sceneDuration;
  const eyeExit = currentTheme === 'postmodern' && nextTheme !== currentTheme && supported.matches
    ? eyeCanvas.animate([
        { transform: getComputedStyle(eyeCanvas).transform },
        { transform: 'translateY(-100%)' }
      ], { duration: sceneDuration / 2 - 35, easing: 'cubic-bezier(.55,.05,.8,.55)', fill: 'forwards' })
    : null;
  try {
    await new Promise(resolve => {
      const start = performance.now();
      let last = start;
      let eyeCleared = !eyeExit;
      function frame(now) {
        const skipMotion = reduced.matches || paused;
        const elapsed = skipMotion ? total : now - start;
        // Weather needs real time to fall and melt; other scenes hold still while they scatter.
        if (entering || leaving) forestTime += Math.min(80, Math.max(0, now - last)) / 1000;
        last = now;
        const canSwitchTheme = skipMotion || eyeCleared;
        const progress = Math.min(canSwitchTheme ? 1 : .5, Math.max(0, (elapsed - swapStart) / sceneDuration));
        if (progress >= .5 && canSwitchTheme && currentTheme !== nextTheme) {
          setTheme(nextTheme);
          if (entering) snowCover = 0;
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
        if (entering && !skipMotion) {
          weather.burst = Math.min(1, elapsed / total);
          if (currentTheme === 'snowdrift') snowCover = smooth((elapsed - sceneDuration / 2) / (total - sceneDuration / 2));
        }
        if (leaving && !skipMotion) {
          weather.melt = Math.min(1, elapsed / total);
          weather.sun = Math.max(0, Math.min(1, elapsed / 500, (total - elapsed) / 500));
          if (currentTheme === 'snowdrift') snowCover = 1 - .8 * smooth(elapsed / swapStart);
        }
        drawForest(forestTime);
        if (elapsed < total || progress < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  } finally {
    eyeExit?.cancel();
    rebuilding = false;
    sceneVisibility = 1;
    resetWeather();
    syncForest();
  }
}

// Edges without moving parts are drawn once per theme and size, then reused every frame.
const edgeCache = new Map();

function isStaticEdge(id) {
  return currentTheme === 'mountains' && id !== 3;
}

function cachedEdge(id, length, depth, originX, originY, width, height, ratio, painter) {
  const key = [currentTheme, length, depth, width, height, ratio].join('|');
  const cached = edgeCache.get(id);
  if (cached?.key === key) return cached.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  const pen = canvas.getContext('2d');
  pen.scale(canvas.width / width, canvas.height / height);
  pen.font = context.font;
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  drawEdge(length, depth, id, 0, painter(pen, originX, originY));
  edgeCache.set(id, { key, canvas });
  return canvas;
}

function drawForest(time) {
  updateScarf();
  if (!supported.matches || krillView) return;
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
    drawWeather(width, height, top, time);
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
    const clipX = Math.min(x, farX);
    const clipY = Math.min(y, farY);
    const clipWidth = Math.abs(x - farX);
    const clipHeight = Math.abs(y - farY);
    // Turn the scene around the grid while keeping the individual glyphs upright.
    const painter = (pen, originX, originY) => (glyph, along, across, color) => {
      pen.fillStyle = color;
      pen.fillText(glyph, x - originX + along * tangentX + across * acrossX, y - originY + along * tangentY + across * acrossY);
    };
    if (sceneVisibility === 1 && isStaticEdge(id)) {
      context.drawImage(cachedEdge(id, length, depth, clipX, clipY, clipWidth, clipHeight, ratio, painter), clipX, clipY, clipWidth, clipHeight);
      return;
    }
    context.save();
    context.beginPath();
    context.rect(clipX, clipY, clipWidth, clipHeight);
    context.clip();
    drawEdge(length, depth, id, time, painter(context, 0, 0));
    context.restore();
  });
  if (currentTheme === 'space') {
    drawSpaceCorner('northWest', left, top, -1, -1, side, end, time);
    drawSpaceCorner('northEast', right, top, 1, -1, side, end, time);
    drawSpaceCorner('southEast', right, bottom, 1, 1, side, end, time);
    drawSpaceCorner('southWest', left, bottom, -1, 1, side, end, time);
  }
  if (currentTheme === 'snowdrift') {
    const box = { left, top, right, bottom };
    for (const name of ['tl', 'tr', 'br', 'bl']) drawSnowCornerAt(name, box, side, end, time);
  }
  if (expanded.hidden) drawGutters(left, top, gridWidth, gridHeight);
  drawWeather(width, height, top, time);
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
  mountains: { fill: '#253544', material: 'shale', marks: ['.:,v', ":.'.", '.,i:', ':.-.'] },
  snowdrift: { fill: '#2a3747', material: 'snow', marks: [".*,'", "'.:*", ',.*.', ".:'*"] }
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
      const along = Math.max(3.5, Math.min(length - 3.5, (x + .5) * cellWidth + dx));
      const across = Math.max(3.5 - depth, Math.min(-3.5, (y - rows + .5) * cellHeight + dy));
      paintGlyph(glyph, along, across, color);
    }));
  }

  if (currentTheme !== 'forest') {
    drawAlternateScene(currentTheme, { cols, rows, edge, time, noise, write, surface });
    renderCells();
    return;
  }

  // On the left edge a gust climbs the clearing every 9 s. At time 0 its front sits just off the edge.
  const gustFront = edge === 0 ? (time / 9) % 1 * 1.6 - .3 : -1;
  const gust = x => edge === 0 ? Math.exp(-((((x / cols) - gustFront) * 6) ** 2)) : 0;

  for (let x = 2; x < cols - 2; x++) {
    const clearance = Math.min(x, cols - 1 - x);
    const ground = Math.min(1, (clearance - 1) / 11);
    const ripple = gust(x);
    if (noise(x, 4) < ground) write(x, rows - 1, ground * (.44 + .49 * noise(x, 0)) + ripple * .3, 'earth');
    if (noise(x, 1) > 1 - ground * (.21 + ripple * .5)) write(x, rows - 2, .38 + .4 * noise(x, 2) + ripple * .25, 'earth');
    if (clearance > 7 && noise(x, 13) > .988) {
      surface(x, rows - 2, 1.8, .8, 'earth');
      write(x, rows - 2, .82, 'pine');
    }
  }

  function pine(x, base, treeHeight, distant) {
    const top = base - treeHeight;
    const sway = Math.sin(time * 1.7 + x) * (distant ? .4 : 1.2) + gust(x) * (distant ? 1.4 : 3);
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
    // A slow cloud crosses the open sky beyond the treetops.
    const driftX = cols * (.55 + .3 * Math.sin(time * .19));
    surface(driftX, 1.3, 5.2, .9, 'cloud');
    surface(driftX + 4, 1, 3.6, 1.1, 'cloud');
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
    // Rounded crowns, stems and stones along a woodland path. Each crown rocks on its own beat.
    const crowns = [[.18,.8],[.43,.58],[.77,.93]];
    crowns.forEach(([position, size], index) => {
      const trunk = Math.round(cols * position);
      const crown = rows * (1 - size * .68);
      const rock = Math.sin(time * 1.1 + index * 2.1) * (.6 + size * .7);
      for (let y = Math.floor(crown); y < rows - 1; y++) {
        write(trunk - 1, y, .68, 'deer', '/');
        write(trunk, y, .4, 'deer', '|');
      }
      surface(trunk - 3 + rock * .7, crown + .9, size * 6.5, size * 2.7, 'pine', -.15 + rock * .04);
      surface(trunk + 3 + rock * .7, crown + 2, size * 5.7, size * 2.5, 'pine', .12 + rock * .04);
      surface(trunk + rock, crown, size * 5.8, size * 3.3, 'pine');
    });
    for (const [position, radius] of [[.31,3.4],[.55,2.5],[.62,4.3],[.89,2.2]]) {
      surface(cols * position, rows - 2, radius, 1.25, 'stone');
    }
    // Leaves drift from the crowns down to the path.
    for (const [index, phase] of [[0, 1.3], [1, 4.2], [2, .4], [2, 3.9]]) {
      const [position, size] = crowns[index];
      const crown = rows * (1 - size * .68);
      const fall = ((time + phase) / 6.5) % 1;
      const leafY = Math.round(crown + 2 + (rows - 3 - crown) * fall);
      const leafX = Math.round(cols * position + Math.sin((time + phase) * 1.9) * 2.5 + fall * 3);
      const glyph = Math.sin((time + phase) * 3) > 0 ? '~' : ',';
      write(leafX, leafY, .55 + .3 * Math.sin(time * 4 + phase), fall < .6 ? 'pine' : 'earth', glyph);
    }
    // A bird crosses the open sky beyond the crowns every 12 s; at time 0 it is off the edge.
    const flight = (time / 12) % 1;
    if (flight < .6) {
      const birdX = Math.round(cols * (1.05 - flight / .6 * 1.1));
      const birdY = Math.round(1.5 + Math.sin(flight * 20) * .8);
      write(birdX, birdY, .85, 'cloud', Math.sin(time * 9) > 0 ? 'v' : '-');
    }
  }
  if (edge === 2 && rows >= 6) {
    // A few pines stand behind the hedgerow, spaced away from the rabbit at .75.
    for (const [position, height, distant] of [[.05,.78,false],[.23,.55,true],[.42,.72,false],[.54,.46,true],[.96,.62,false]]) {
      pine(Math.round(cols * position), rows - 1, Math.round(rows * height), distant);
    }
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
    // Brief, sharp pulses: the tail flicks and the ear twitches between long rests.
    const flick = Math.max(0, Math.sin(time * 3.1)) ** 8;
    const twitch = Math.max(0, Math.sin(time * 2.3 + 1)) ** 12;
    surface(x - 5.5, y - .25 - flick * .6, 1.5, .48, 'deer', -.32 - flick * .9);
    surface(x, y, 5.8, 1.6, 'deer', -.08);
    surface(x + 4.7, y + (headDown ? .65 : -.9), 2.7, .85, 'deer', headDown ? .63 : -.78);
    const faceY = y + (headDown ? 2 : -2.35);
    surface(x + 7, faceY, 1.9, .87, 'deer', headDown ? .4 : -.03);
    surface(x + 6, faceY - .7 - twitch * .3, .9, .47, 'deer', -.65 + twitch * .5);
    write(x + 7, Math.round(faceY), .2, 'deer');

    // Needles flutter down from the crowns into the clearing; the gust pushes them along.
    for (const [start, phase] of [[.16, 0], [.25, 2.6], [.84, 5.1]]) {
      const fall = ((time + phase) / 7.5) % 1;
      const leafY = Math.round(rows * (.3 + .62 * fall));
      const leafX = Math.round(cols * start + Math.sin((time + phase) * 2.1) * 2 + gust(cols * start) * 4 * fall);
      const glyph = Math.sin((time + phase) * 3.3) > 0 ? "'" : ',';
      write(leafX, leafY, .62 + .25 * Math.sin(time * 5 + phase), fall < .5 ? 'pine' : 'deer', glyph);
    }
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

function drawSnowdrift({ cols, rows, edge, time, noise, write, surface }) {
  const cover = snowCover;
  const melt = 1 - cover;
  const base = rows - 1;

  // Pines carry snow on the upper-left of each tier; the caps thin out as the snow melts.
  function snowyPine(x, foot, height, distant) {
    const top = foot - height;
    const sway = Math.sin(time * 1.3 + x) * (distant ? .3 : .8);
    write(Math.round(x), foot, distant ? .3 : .6, 'deer');
    for (let y = top; y < foot; y++) {
      const level = (y - top) / Math.max(1, height - 2);
      const center = x + sway * (1 - level);
      const radius = .6 + level * (distant ? 2.6 : 4.2) + ((y - top) % 3) * .4;
      const tierTop = (y - top) % 3 === 0;
      for (let i = Math.ceil(center - radius); i <= center + radius; i++) {
        const u = (i - center) / radius;
        if (tierTop && u < .55 && noise(i, y) < cover) write(i, y, .62 + .3 * (1 - Math.abs(u)), 'snow');
        else write(i, y, (.16 + .5 * Math.sqrt(Math.max(0, 1 - u * u)) - .28 * u) * (distant ? .6 : 1), 'pine');
      }
    }
  }

  function stand(spots) {
    for (const [position, height, distant] of spots) {
      const foot = base - (distant ? 2 : 1);
      snowyPine(Math.round(cols * position), foot, Math.max(2, Math.min(foot, Math.round(rows * height))), distant);
    }
  }

  // Rolling banks along the ground; melting shrinks them and leaves puddles behind.
  function drifts() {
    for (let x = 0; x < cols; x++) {
      const swell = .55 + .45 * Math.sin(x * .085 + edge * 1.7) * Math.sin(x * .031 + edge);
      const tall = Math.round(rows * .3 * swell * cover + (cover > .05 ? 1 : 0));
      for (let y = rows - tall; y < rows; y++) {
        const inside = (y - (rows - tall)) / Math.max(1, tall);
        write(x, y, .92 - inside * .45 - .12 * noise(x, y), 'snow');
      }
      if (melt > .15 && noise(x, 7) < melt * .5) write(x, base, .5 + .3 * noise(x, 9), 'water', noise(x, 5) > .5 ? '~' : '_');
    }
  }

  function snowman(x) {
    const s = Math.max(.35, cover);
    const foot = base - 1;
    surface(x, foot - 1.6 * s, 2.6 * s, 1.6 * s, 'snow');
    surface(x + .2, foot - 4 * s, 1.9 * s, 1.15 * s, 'snow');
    surface(x + .3, foot - 6 * s, 1.4 * s, .9 * s, 'snow');
    if (cover < .5) return;
    const cx = Math.round(x);
    const head = Math.round(foot - 6 * s);
    const hat = Math.round(foot - 7.5 * s);
    for (let dx = -1; dx <= 1; dx++) write(cx + dx, hat, .25, 'stone', '=');
    write(cx, hat - 1, .2, 'stone', '#');
    write(cx, head, .1, 'stone', '.');
    write(cx + 1, head, .1, 'stone', '.');
    write(cx + 2, head + 1, .8, 'carrot', '>');
    const arms = Math.round(foot - 4 * s);
    write(cx - 3, arms - 1, .5, 'deer', '\\');
    write(cx + 3, arms - 1, .5, 'deer', '/');
  }

  if (edge === 3) {
    for (let x = 6; x < cols - 6; x += 5 + Math.floor(noise(x, 27) ** 3 * 14)) {
      const foot = base - 2 - Math.floor(noise(x, 19) * 2);
      snowyPine(x, foot, Math.max(2, Math.min(foot, 2 + Math.floor(noise(x, 31) * rows * .45))), true);
    }
    for (let x = 11; x < cols - 10; x += 8 + Math.floor(noise(x, 4) ** 2 * 26)) {
      const foot = base - 1;
      snowyPine(x, foot, Math.max(2, Math.round(foot * (.4 + .55 * noise(x, 6)))), false);
    }
    drifts();
    return;
  }
  if (edge === 0) {
    stand([[.15, .72, false], [.3, .45, true], [.85, .6, false]]);
    drifts();
    snowman(cols * .55);
    return;
  }
  if (edge === 1) {
    stand([[.14, .62, false], [.3, .4, true], [.78, .7, false], [.9, .44, true]]);
    drifts();
    // A frozen pond thaws to open water as the snow goes.
    surface(cols * .52, rows - 2.2, Math.min(14, cols * .12), 1.3, cover > .45 ? 'ice' : 'water');
    return;
  }
  stand([[.08, .7, false], [.27, .5, true], [.62, .66, false], [.93, .55, false]]);
  drifts();
  // Rabbit tracks cross the bank.
  if (cover > .6) {
    for (let x = Math.round(cols * .36); x < cols * .54; x += 5) write(x, base - 1, .25, 'shale', ':');
  }
}

// Corner drift sizes in characters, measured out from the grid corner at full snow:
// [length along the horizontal grid line, height along the vertical grid line].
const snowCornerSize = { tl: [6, 3], tr: [7, 4], br: [4, 3], bl: [4, 3] };
const snowCornerSpots = { tl: [-1, -1, 1], tr: [1, -1, 2], br: [1, 1, 3], bl: [-1, 1, 4] };

function drawSnowCornerAt(name, box, side, end, time = 0) {
  const [directionX, directionY, seed] = snowCornerSpots[name];
  const originX = directionX < 0 ? box.left : box.right;
  const originY = directionY < 0 ? box.top : box.bottom;
  const [sizeX, sizeY] = snowCornerSize[name];
  drawSnowCorner(originX, originY, directionX, directionY, side, end, time, seed, sizeX, sizeY);
}

// Each corner gets its own drift, piled into the angle where the two ground lines meet,
// deepest at the grid corner and sloping away, so it always rests on ground and never floats.
function drawSnowCorner(originX, originY, directionX, directionY, width, height, time, seed, sizeX, sizeY) {
  // Fixed character sizes at every window size; shrinks with the melt and is gone when melted.
  const cover = snowCover;
  if (cover <= .05) return;
  const cols = Math.min(Math.floor(width / glyphWidth), Math.max(1, Math.round(sizeX * cover)));
  const rows = Math.min(Math.floor(height / glyphHeight), Math.max(1, Math.round(sizeY * cover)));
  context.save();
  context.beginPath();
  context.rect(directionX < 0 ? originX - width : originX, directionY < 0 ? originY - height : originY, width, height);
  context.clip();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const along = (col + .5) * glyphWidth;
      const across = (row + .5) * glyphHeight;
      // A quarter ellipse in character cells: the two edges on the grid lines keep their full
      // length, and the outer edge is rounded. Being convex, it can never leave a floating piece.
      const u = (col + .5) / cols;
      const v = (row + .5) / rows;
      const d = Math.hypot(u, v);
      if (d > 1 && row > 0 && col > 0) continue;
      const grain = hash(col * 31 + row, seed + 11);
      if (sceneVisibility < 1 && grain >= sceneVisibility) continue;
      const z = Math.sqrt(Math.max(0, 1 - d * d));
      // The slope faces away from the corner; light comes from the upper left, like the edges.
      const nx = u / Math.max(d, .001) * directionX * (1 - z);
      const ny = v / Math.max(d, .001) * directionY * (1 - z);
      const light = Math.max(0, Math.min(1, .36 + .44 * z - .2 * nx - .15 * ny + .1 * grain));
      const sparkle = light > .75 && Math.sin(time * 2.4 + col * 1.3 + row * 2.7 + seed) > .985;
      context.fillStyle = palettes.snow[Math.round(light * 4)];
      context.fillText(sparkle ? '*' : ramp[Math.round(light * (ramp.length - 1))], originX + along * directionX, originY + across * directionY);
    }
  }
  context.restore();
}

function drawFlake(x, y, b, c, alpha) {
  context.globalAlpha = alpha * (.35 + .55 * b);
  context.fillStyle = palettes.snow[2 + Math.round(b * 2)];
  context.fillText(c < .55 ? '.' : c < .8 ? '*' : c < .9 ? "'" : '+', x, y);
}

// Full-page snowfall (fading in during the snow-in), melt drips and the sun, drawn behind the windows.
function drawWeather(width, height, deskTop, time) {
  const steady = currentTheme === 'snowdrift'
    ? Math.max(0, 1 - weather.melt * 2) * (weather.burst >= 0 ? smooth((weather.burst - .4) / .6) : 1)
    : 0;
  if (!steady && weather.burst < 0 && !weather.melt && !weather.sun) return;
  context.save();
  context.font = '7px "Courier New", monospace';
  const fall = height + 24;
  const flakes = Math.round(Math.min(160, width * height / 9000) * steady);
  for (let i = 0; i < flakes; i++) {
    const a = hash(i, 1), b = hash(i, 2), c = hash(i, 3);
    const y = (a * fall + time * (9 + 15 * b)) % fall - 12;
    const x = c * width + Math.sin(time * (.4 + .5 * b) + i) * (5 + 9 * a);
    drawFlake(x, y, b, c, 1);
  }
  if (weather.melt > .15 && weather.melt < .85) {
    const dripStrength = Math.sin(Math.PI * (weather.melt - .15) / .7);
    context.font = '7px "Courier New", monospace';
    context.fillStyle = palettes.water[3];
    for (let i = 0; i < 70; i++) {
      const a = hash(i, 7), b = hash(i, 8), c = hash(i, 9);
      const cycle = (weather.melt * 3 + a) % 1;
      context.globalAlpha = dripStrength * (1 - cycle * .6) * .8;
      context.fillText(cycle < .7 ? "'" : ',', b * width, c * height + cycle * cycle * 26);
    }
  }
  if (weather.sun > 0) {
    const cx = width / 2;
    const cy = -40 + weather.sun * 100;
    const radius = 24;
    context.globalAlpha = Math.min(1, weather.sun * 1.5);
    context.font = '7px "Courier New", monospace';
    for (let dy = -radius; dy <= radius; dy += glyphHeight) {
      for (let dx = -radius; dx <= radius; dx += glyphWidth) {
        const d = Math.hypot(dx, dy) / radius;
        if (d > 1) continue;
        const light = Math.max(0, Math.min(1, .55 + .45 * Math.sqrt(1 - d * d) - .15 * dx / radius));
        context.fillStyle = palettes.sun[Math.round(light * 4)];
        context.fillText(ramp[Math.round(light * (ramp.length - 1))], cx + dx, cy + dy);
      }
    }
    const rays = ['-', '\\', '|', '/'];
    for (let k = 0; k < 12; k++) {
      const angle = k * Math.PI / 6 + time * .4;
      const glyph = rays[Math.round((((angle % Math.PI) + Math.PI) % Math.PI) / (Math.PI / 4)) % 4];
      for (const reach of [radius + 6, radius + 12]) {
        context.fillStyle = palettes.sun[reach > radius + 8 ? 2 : 3];
        context.fillText(glyph, cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
      }
    }
  }
  context.restore();
}

function drawAlternateScene(theme, scene) {
  if (theme === 'space') drawSpace(scene);
  else if (theme === 'snowdrift') drawSnowdrift(scene);
  else drawMountains(scene);
}

let forestRequest;
let forestTime = 0;
let lastFrame;
let lastDraw;
function animateForest(now) {
  if (lastFrame !== undefined) forestTime += Math.min(80, now - lastFrame) / 1000;
  lastFrame = now;
  // Falling snow needs a smoother frame rate than the slow-swaying scenes.
  const interval = currentTheme === 'postmodern' ? 1000 / 30 : currentTheme === 'snowdrift' ? 1000 / 24 : 100;
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
  // The accessible name stays fixed and aria-pressed carries the state; the tooltip names the next action.
  motionButton.title = paused ? 'Play background animation' : 'Pause background animation';
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
applyThemeIcon(currentTheme);
syncFromHash();

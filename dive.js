// Mobile opening: a Krillion-style "Name a SWE" dive.
// The sea is a shaded ASCII field on a canvas, like the desktop scenery: every shape (clouds, sun, boat, rock
// ledges and canyon walls, kelp, coral) is stamped into a grid of cells with a light value, then drawn as a glyph
// from the same density ramp and a 5-tone palette. Solid materials get a dark cell fill so they read as mass.
// Krill, fish and bubbles are hand-drawn ASCII sprites shaded row by row. Labels and lines live in .world, which
// moves with the same camera. Plays once per session, tap to skip, "dive again" replays.
(() => {
  const dive = document.querySelector('#mobile .dive');
  if (!dive) return;
  const MPX = 2, SURF = 160; // css px per metre, waterline (css px from top of the world)
  const FONT = '600 8px "IBM Plex Mono", ui-monospace, monospace', SPRITE = '"IBM Plex Mono", ui-monospace, monospace';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = dive.querySelector('.scene'), ctx = canvas.getContext('2d');
  const world = dive.querySelector('.world');
  const depthEl = dive.querySelector('.depth'), scoreEl = dive.querySelector('.score');
  const typed = dive.querySelector('.typed'), answer = dive.querySelector('.answer'), timer = dive.querySelector('.timer');
  const diveBtn = dive.querySelector('.dive-btn'), name = typed.textContent;
  const depthY = m => SURF + m * MPX; // css px in world space
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.random() * list.length | 0];
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

  // ---------- Filled shapes ----------
  // Creatures and props are built from ellipses (and boxes), filled on a fine glyph grid: each cell is lit like a
  // little sphere (light from the upper left), backed by the shape's darkest tone so it reads as solid, and drawn
  // with a density glyph. Details (eyes, antennae, legs) go on top as plain characters.
  const FILL_RAMP = ' .:-=+*#'; // calm: the backing tone carries the shape, glyphs add shading
  const LIGHT = [-.45, -.7, .55];
  const PINK = ['#5c1530', '#8f2348', '#d23e70', '#ff6f9c', '#ffc6d8'];
  const GOLD = ['#5e3c0a', '#9a6a18', '#e0a838', '#ffd166', '#fff1b8'];
  // prims: [{ x, y, rx, ry, rot?, box? , bias? }] in css px relative to (ox, oy); flip mirrors x.
  const solid = (g, prims, ox, oy, tones, { flip = false, fx = 3.6, fy = 5, font = 6 } = {}) => {
    const cells = new Map();
    for (const p of prims) {
      const px = flip ? -p.x : p.x, rot = (flip ? -1 : 1) * (p.rot || 0), c = Math.cos(rot), s = Math.sin(rot), R = Math.max(p.rx, p.ry);
      const i0 = Math.floor((ox + px - R) / fx), i1 = Math.ceil((ox + px + R) / fx), j0 = Math.floor((oy + p.y - R) / fy), j1 = Math.ceil((oy + p.y + R) / fy);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = i * fx - ox - px, dy = j * fy - oy - p.y, lx = (dx * c + dy * s) / p.rx, ly = (-dx * s + dy * c) / p.ry;
        let v;
        if (p.box) {
          if (Math.abs(lx) > 1 || Math.abs(ly) > 1) continue;
          v = .78 - ly * .3 - lx * .12;
        } else {
          const q = lx * lx + ly * ly;
          if (q > 1) continue;
          const nz = Math.sqrt(1 - q);
          v = .12 + .88 * Math.max(0, (flip ? -lx : lx) * LIGHT[0] * c + ly * LIGHT[1] + nz * LIGHT[2]);
        }
        cells.set(j * 100000 + i, clamp(v + (p.bias || 0)));
      }
    }
    g.font = `700 ${font}px ${SPRITE}`;
    g.fillStyle = tones[0];
    for (const k of cells.keys()) { const j = Math.floor(k / 100000), i = k - j * 100000; g.fillRect(i * fx - fx / 2, j * fy - fy / 2, fx + .4, fy + .4); }
    for (const [k, v] of cells) {
      const j = Math.floor(k / 100000), i = k - j * 100000;
      g.fillStyle = tones[1 + Math.round(v * 3)];
      g.fillText(FILL_RAMP[1 + Math.round(v * (FILL_RAMP.length - 2))], i * fx - fx / 2, j * fy - fy / 2);
    }
  };
  const marks = (g, list, ox, oy, flip, size = 9) => {
    g.font = `700 ${size}px ${SPRITE}`;
    for (const [x, y, ch, color] of list) { g.fillStyle = color; g.fillText(flip ? (FLIP[ch] || ch) : ch, ox + (flip ? -x : x) - size * .3, oy + y - size * .5); }
  };
  const FLIP = { '(': ')', ')': '(', '/': '\\', '\\': '/', '<': '>', '>': '<', '`': "'", "'": '`' };

  // Krill, facing left: carapace, five tapering abdomen segments and a fan tail, curving gently down.
  const KRILL_BODY = [
    { x: 4, y: 0, rx: 5, ry: 2.4, rot: -.15 },
    { x: 15, y: -1, rx: 12, ry: 7.5, rot: .04 },
    { x: 28, y: 0, rx: 8.5, ry: 6.6, rot: .1 },
    { x: 37, y: 1.5, rx: 7.5, ry: 6, rot: .18 },
    { x: 45, y: 3.5, rx: 6.5, ry: 5.2, rot: .28 },
    { x: 52, y: 6, rx: 5.5, ry: 4.4, rot: .4 },
    { x: 57, y: 9.5, rx: 4.6, ry: 3.6, rot: .6 },
    { x: 61, y: 14, rx: 6, ry: 2.6, rot: 1.05, bias: .1 },
    { x: 57, y: 15, rx: 5, ry: 2.2, rot: .2, bias: .05 },
  ];
  const krillMarks = (tones, eye) => [
    [7, -2, '@', eye],
    ...[22.5, 32.5, 41.5, 49].map((x, i) => [x, -5 + i * 1.6, ')', tones[1]]),
    ...[10, 16, 22, 28, 34].map(x => [x, 8.5, '/', tones[2]]),
    ...[[-3, -3], [-8, -6], [-13, -9], [-18, -12], [-23, -15], [-28, -17]].map(([x, y]) => [x, y, '`', tones[3]]),
    ...[[-4, 1], [-9, 1], [-14, 0]].map(([x, y]) => [x, y, '-', tones[2]]),
  ];
  const drawKrill = (g, x, y, tones, flip, eye = '#14040c', k = 1) => {
    solid(g, KRILL_BODY.map(p => ({ ...p, x: p.x * k, y: p.y * k, rx: p.rx * k, ry: p.ry * k })), x, y, tones, { flip, fx: 3.6, fy: 4.8, font: 6 });
    marks(g, krillMarks(tones, eye).map(([mx, my, ch, c]) => [mx * k, my * k, ch, c]), x, y, flip, Math.round(8 * k));
  };
  // The result badge: the same krill in gold, drawn once into its own canvas (2x for crisp glyphs).
  const badge = document.createElement('canvas');
  badge.width = 300; badge.height = 120; badge.style.width = '150px'; badge.style.height = '60px';
  dive.querySelector('.badge').replaceChildren(badge);
  const drawBadge = () => {
    const g = badge.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 150, 60); g.textBaseline = 'top';
    drawKrill(g, 50, 30, GOLD, false, '#2a1800', 1.55);
  };

  // Fish: body, tail and a fin; small and big.
  const FISH_BODY = s => [
    { x: 0, y: 0, rx: 10 * s, ry: 5 * s },
    { x: -11 * s, y: -2.4 * s, rx: 4.5 * s, ry: 2 * s, rot: .6, bias: -.05 },
    { x: -11 * s, y: 2.4 * s, rx: 4.5 * s, ry: 2 * s, rot: -.6, bias: -.1 },
    { x: 1 * s, y: -5 * s, rx: 4 * s, ry: 1.6 * s, rot: -.3 },
  ];
  // Boat: stepped hull, cabin with portholes, mast.
  const BOAT = [
    { x: 30, y: 6, rx: 30, ry: 3.4, box: true },
    { x: 30, y: 11, rx: 26, ry: 2.6, box: true, bias: -.15 },
    { x: 30, y: 15, rx: 21, ry: 2, box: true, bias: -.3 },
    { x: 30, y: -2, rx: 12, ry: 5, box: true, bias: .05 },
    { x: 30, y: -16, rx: 1.2, ry: 10, box: true },
  ];
  const BOAT_TONES = ['#070f1d', '#13223a', '#22385a', '#365480', '#5579a6'];

  // ---------- Shaded rock ----------
  // Same idea as the desktop scenery: each cell gets a light value, drawn as a glyph from a density ramp in one of
  // five tones over a dark cell fill. The rock never moves, so it is rendered once per layout into its own canvas.
  const RAMP = ' .,:;=+*%#@'; // no letters: at this size they read as words
  const ROCK_TONES = [
    { fg: ['#10233d', '#1a3456', '#284a70', '#3a6189', '#5582aa'], bg: '#0a182c' }, // shallow
    { fg: ['#10213b', '#182e4c', '#223c60', '#2f4f78', '#406594'], bg: '#081428' }, // deep
  ];
  let CW = 4.8, CH = 8;
  const rockLayer = document.createElement('canvas');
  let rockTop = 0, rockHeight = 0;

  // Test hook: #cam=600 freezes the camera at that scroll position.
  const frozen = /^#cam=(\d+)/.exec(location.hash);

  // ---------- Scene layout (rebuilt on resize) ----------
  let w = 0, h = 0, camEnd = 0, chipY = 0, dpr = 1;
  let clouds = [], kelp = [], coral = [], fish = [], snow = [], noise = [];
  // Rock: canyon walls reaching in from each side, plus a ledge near 400 m whose top rounds down toward its tip.
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const LEDGE = [{ top: 380, len: .42 }, { top: 392, len: .36 }];
  // Is there rock at distance x (css px) in from this side, at depth m?
  const rock = (side, x, m) => {
    const L = LEDGE[side], len = L.len * w, u = x / len;
    const wallTop = L.top - 6, reach = w * (.1 + .05 * smooth(650, 1200, m)) + (vnoise(m / 22, side * 9) - .5) * 26;
    if (m > wallTop && x < reach * Math.sqrt(smooth(wallTop, wallTop + 40, m))) return true;
    if (u > 1) return false;
    const top = L.top + 26 * u * u + (vnoise(x / 26, side * 5) - .5) * 8;
    return m > top && m < top + 18 + 60 * (1 - Math.pow(u, 1.4));
  };
  const ledgeTop = (side, x) => { for (let m = 360; m < 560; m += 1) if (rock(side, side ? w - x : x, m)) return depthY(m); return depthY(560); };
  const layout = () => {
    w = dive.clientWidth; h = dive.clientHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.font = FONT; CW = ctx.measureText('M').width || 4.8; CH = 8;
    chipY = h * .44;
    camEnd = frozen ? +frozen[1] : depthY(1000) - chipY;
    noise = [0, 1].map(() => { let v = 0; return Array.from({ length: 400 }, () => (v = Math.max(-1, Math.min(1, v + rand(-.35, .35))))); });
    clouds = [[.02, 52, 1.25], [.5, 92, 1], [.28, 128, .8]].map(([fx, y, s]) => ({
      x: fx * w, y, speed: rand(2, 5), puffs: [[0, 9, 13], [14, 2, 16], [30, -4, 19], [47, 3, 15], [61, 9, 11], [26, 10, 15]].map(([dx, dy, r]) => [dx * s * 1.2, dy * s, r * s * 1.1]),
    }));
    kelp = Array.from({ length: 16 }, (_, i) => {
      const side = i % 2, x = side ? rand(w * .7, w - 10) : rand(8, w * .34), far = i % 3 === 0;
      return { side, x, base: ledgeTop(side, x) + 8, len: rand(far ? 150 : 110, far ? 260 : 220), far, phase: rand(0, 6), segs: 17 };
    }).sort((a, b) => b.far - a.far);
    coral = [[w * .22, 0], [w * .84, 1], [w * .1, 0], [w * .93, 1]].map(([x, side], i) => ({ x, base: ledgeTop(side, x) + 6, size: i > 1 ? 22 : 30, seed: rand(0, 9) }));
    fish = Array.from({ length: 9 }, (_, i) => ({ x: rand(0, w), y: i < 6 ? depthY(rand(25, 330)) : depthY(rand(560, 1150)), v: rand(12, 34) * (i % 2 ? 1 : -1), big: Math.random() < .4, deep: i >= 6 }));
    snow = Array.from({ length: 70 }, () => ({ x: rand(0, w), y: rand(SURF, depthY(1300)), v: rand(2, 6) }));
    buildRock();
  };

  // ---------- Colours ----------
  const STOPS = [[0, [38, 112, 163]], [60, [30, 96, 145]], [150, [24, 78, 124]], [300, [17, 56, 95]], [450, [12, 38, 70]], [650, [10, 27, 52]], [900, [8, 19, 38]], [1300, [6, 12, 25]]];
  const water = m => {
    let i = 1; while (i < STOPS.length - 1 && m > STOPS[i][0]) i++;
    const [m0, c0] = STOPS[i - 1], [m1, c1] = STOPS[i], f = clamp((m - m0) / (m1 - m0));
    return c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
  };
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

  // ---------- Bubbles ----------
  let bubbles = [];
  const addBubble = (x, y, fast) => bubbles.push({ x, y, c: pick(['o', 'o', '°', 'O', '.']), v: fast ? rand(110, 210) : rand(36, 72), ph: rand(0, 6) });

  // ---------- State ----------
  let cam = 0, tween = null, phase = 'idle', chipShown = false, swarm = null, last = 0, t = 0;
  const mascotIdle = () => [10, h * .7];
  let mascot = { x: 0, y: 0, tx: 0, ty: 0 };

  // Render the rock once: mark solid cells, then light each by how close it is to open water above and to the side.
  const buildRock = () => {
    rockTop = depthY(360); rockHeight = depthY(1420) - rockTop;
    rockLayer.width = Math.round(w * dpr); rockLayer.height = Math.round(rockHeight * dpr);
    const g = rockLayer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.textBaseline = 'top'; g.font = FONT;
    const cols = Math.ceil(w / CW) + 1, rows = Math.ceil(rockHeight / CH);
    const solid = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      const m = (rockTop + (j + .5) * CH - SURF) / MPX;
      for (let i = 0; i < cols; i++) {
        const x = (i + .5) * CW;
        if (rock(0, x, m) || rock(1, w - x, m)) solid[j * cols + i] = 1;
      }
    }
    const groups = new Map();
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (!solid[k]) continue;
      let up = 0; while (up < 4 && j - up - 1 >= 0 && solid[k - (up + 1) * cols]) up++;
      let side = 0; while (side < 5 && i - side - 1 >= 0 && i + side + 1 < cols && solid[k - side - 1] && solid[k + side + 1]) side++;
      const y = rockTop + j * CH, m = (y + CH / 2 - SURF) / MPX;
      const boulder = vnoise(i * CW / 16, y / 12), crack = Math.abs(vnoise(i * CW / 40 + 3, y / 30) - .5) < .04;
      let v = Math.max([.92, .74, .56, .42, .3][up], .62 - side * .1) * (.55 + boulder * .6);
      if (crack) v *= .45;
      v = clamp(v * (1 - smooth(420, 1250, m) * .25));
      const tone = ROCK_TONES[m < 620 ? 0 : 1];
      g.fillStyle = tone.bg; g.fillRect(i * CW, j * CH, CW + .6, CH + .6);
      const key = (m < 620 ? 0 : 8) + Math.round(v * 4);
      let list = groups.get(key); if (!list) groups.set(key, list = []);
      list.push([i * CW, j * CH, RAMP[1 + Math.round(v * (RAMP.length - 2))]]);
    }
    for (const [key, list] of groups) {
      g.fillStyle = ROCK_TONES[key >> 3].fg[key & 7];
      for (const [x, y, c] of list) g.fillText(c, x, y);
    }
  };

  // Kelp and coral are filled shapes rebuilt each frame, so they sway smoothly.
  // Kelp: a filled tube stalk with filled leaf blades, swaying more toward the tip.
  const KELP_TONES = { far: ['#103250', '#174263', '#1e5174', '#286387', '#35779a'], near: ['#05182a', '#0b2539', '#123349', '#1a435c', '#245570'] };
  const drawKelp = k => {
    if (k.base - k.len > cam + h || k.base < cam - 40) return;
    const step = k.len / k.segs, prims = [], thick = k.far ? 3.8 : 5;
    let x = k.x, y = k.base - cam;
    for (let s = 0; s < k.segs; s++) {
      const f = s / k.segs;
      const ang = Math.sin(t * 1.1 + k.phase + f * 2.2) * .17 * (.25 + f) + Math.sin(t * .5 + k.phase) * .05;
      x += Math.sin(ang) * step; y -= Math.cos(ang) * step;
      prims.push({ x, y, rx: thick * (1 - f * .45), ry: step * .8, rot: ang });
      if (s % 2 === 1 && s < k.segs - 1) {
        const dir = (s / 2 | 0) % 2 ? 1 : -1, len = (k.far ? 10 : 13) * (1 - f * .35), tilt = ang + dir * 1.05;
        prims.push({ x: x + Math.sin(tilt) * len * .9, y: y - Math.cos(tilt) * len * .9, rx: k.far ? 3.6 : 4.4, ry: len, rot: tilt, bias: dir > 0 ? -.08 : .06 });
      }
    }
    solid(ctx, prims, 0, 0, KELP_TONES[k.far ? 'far' : 'near'], { fx: 3.4, fy: 4.6, font: 6 });
  };
  const CORAL_TONES = ['#3e1230', '#6e2350', '#a83a6e', '#dc5d8d', '#ffa6c3'];
  const drawCoral = c => {
    if (c.base < cam - 60 || c.base - 80 > cam + h) return;
    const prims = [];
    const branch = (x, y, ang, len, d) => {
      const sway = Math.sin(t * .8 + c.seed + d) * .05, dx = Math.cos(ang + sway), dy = -Math.sin(ang + sway);
      for (let s = 0; s <= len; s += 3) prims.push({ x: x + dx * s, y: y + dy * s, rx: 2.2 + d * .8, ry: 2.2 + d * .8 });
      const ex = x + dx * len, ey = y + dy * len;
      if (d > 0) for (const turn of [-.6, .55]) branch(ex, ey, ang + turn + Math.sin(c.seed * (d + 1)) * .2, len * .68, d - 1);
      else prims.push({ x: ex, y: ey, rx: 3.6, ry: 3.6, bias: .2 });
    };
    branch(c.x, c.base - cam, Math.PI / 2, c.size * .6, 3);
    solid(ctx, prims, 0, 0, CORAL_TONES, { fx: 3.2, fy: 4.4, font: 6 });
  };

  // Sky: clouds and sun sampled on a fine local grid so their soft edges and shading survive.
  const SKY_RAMP = ' .:-=+*#%@';
  const CLOUD_TONES = ['#a9c7de', '#c3d9ea', '#dcebf5', '#f1f8fc', '#ffffff'];
  const SUN_TONES = ['#f2b233', '#f9c94a', '#ffdb6a', '#ffe99a', '#fff7d6'];
  const drawSky = () => {
    if (cam > SURF + 40) return;
    const fx = 4, fy = 5;
    ctx.font = `600 7px ${SPRITE}`;
    // Sun: bright core fading to a dotted rim, with slowly turning rays.
    const sx = w * .64, sy = 74 - cam, R = 24;
    for (let y = -R; y <= R; y += fy) for (let x = -R; x <= R; x += fx) {
      const d = Math.hypot(x, y) / R;
      if (d > 1) continue;
      const v = clamp(1 - d * .75 + (x * -.004 + y * -.006));
      ctx.fillStyle = SUN_TONES[Math.round(v * 4)];
      ctx.fillText(SKY_RAMP[Math.max(2, Math.round(v * (SKY_RAMP.length - 1)))], sx + x, sy + y);
    }
    ctx.font = `600 10px ${SPRITE}`; ctx.fillStyle = '#ffd451';
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4 + t * .15, r = R + 9 + Math.sin(t * 2 + a) * 2;
      ctx.fillText('|/-\\|/-\\'[((Math.round((ang % Math.PI) / (Math.PI / 4)) % 4) + 4) % 4 + (a > 3 ? 0 : 0)], sx + Math.sin(ang) * r - 3, sy - Math.cos(ang) * r - 5);
    }
    // Clouds: a density field from overlapping puffs, lit from above, thinning to dots at the edges.
    ctx.font = `600 7px ${SPRITE}`;
    for (const c of clouds) {
      const ox = ((c.x + t * c.speed) % (w + 160)) - 80, oy = c.y - cam;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [dx, dy, r] of c.puffs) { x0 = Math.min(x0, dx - r); x1 = Math.max(x1, dx + r); y0 = Math.min(y0, dy - r); y1 = Math.max(y1, dy + r * .4); }
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      for (const [dx, dy, r] of c.puffs) { ctx.beginPath(); ctx.ellipse(ox + dx, oy + dy, r * .85, r * .65, 0, 0, 7); ctx.fill(); }
      for (let y = Math.floor(y0 / fy) * fy; y <= y1; y += fy) for (let x = Math.floor(x0 / fx) * fx; x <= x1; x += fx) {
        let field = 0;
        for (const [dx, dy, r] of c.puffs) { const q = ((x - dx) ** 2 + ((y - dy) * 1.25) ** 2) / (r * r); if (q < 1) field += (1 - q) ** 2; }
        if (field < .08) continue;
        const height = clamp((y - y0) / (y1 - y0)), v = clamp(Math.min(1, field * 1.6) * (1.05 - height * .7));
        ctx.fillStyle = CLOUD_TONES[Math.round(v * 4)];
        ctx.fillText(SKY_RAMP[Math.max(1, Math.round(v * (SKY_RAMP.length - 1)))], ox + x, oy + y);
      }
    }
    // Boat, shaded top to bottom, with a pink pennant.
    const bx = w * .14, by = SURF - 38 + Math.sin(t * 2) * 1.5 - cam;
    solid(ctx, BOAT, bx, by + 22, BOAT_TONES, { fx: 3.4, fy: 4.4 });
    marks(ctx, [[22, -2, 'o', '#e8f1ff'], [30, -2, 'o', '#e8f1ff'], [38, -2, 'o', '#e8f1ff'], [34, -25, '>', '#ff5d8f'], [36, -25, '>', '#ff5d8f']], bx, by + 22, false);
  };

  const draw = now => {
    // About 30 fps: plenty for ASCII, and half the glyph work. Labels move with the canvas, so they stay in step.
    if (now - last < 30 && last) { if (running) requestAnimationFrame(draw); return; }
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now; t += dt;
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur), e = k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      cam = tween.from + (tween.to - tween.from) * e;
      if (k === 1) tween = null;
    }
    world.style.transform = `translate3d(0,${-cam}px,0)`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const surf = SURF - cam;

    // Sky and water in flat bands (water posterised into 25 m slabs).
    for (let y = 0; y < h; y += 6) {
      const wy = y + cam;
      if (wy < SURF) {
        const f = Math.floor(wy / SURF * 10) / 10;
        ctx.fillStyle = rgb([58 + 52 * f, 142 + 44 * f, 210 + 22 * f].map(Math.round));
      } else ctx.fillStyle = rgb(water(Math.floor((wy - SURF) / MPX / 25) * 25 + 12));
      ctx.fillRect(0, y, w, 6);
    }
    // Light rays.
    for (const [fx, wd] of [[.12, 20], [.32, 32], [.52, 18], [.7, 30], [.9, 20]]) {
      const x0 = w * fx + Math.sin(t * .4 + fx * 9) * 9, len = 450;
      const g = ctx.createLinearGradient(0, surf, 0, surf + len); g.addColorStop(0, 'rgba(200,235,255,.08)'); g.addColorStop(1, 'rgba(200,235,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, surf); ctx.lineTo(x0 + wd, surf); ctx.lineTo(x0 + wd + 100, surf + len); ctx.lineTo(x0 + 100, surf + len); ctx.fill();
    }
    if (surf > 0) { ctx.fillStyle = 'rgba(255,229,138,.22)'; ctx.beginPath(); ctx.arc(w * .64, 74 - cam, 40, 0, 7); ctx.fill(); }
    drawSky();

    // Far kelp behind the rock, then the pre-rendered rock.
    kelp.forEach(k => k.far && drawKelp(k));
    if (rockTop - cam < h && rockTop + rockHeight - cam > 0) ctx.drawImage(rockLayer, 0, rockTop - cam, w, rockHeight);

    coral.forEach(drawCoral);
    kelp.forEach(k => k.far || drawKelp(k));
    // Waves and the boat's flag.
    if (surf > -20) {
      ctx.font = `600 13px ${SPRITE}`;
      const shift = (t * 16) % 24;
      for (let x = -24; x < w + 24; x += 8) {
        const hgt = Math.sin((x + shift * 2) * .05 + t) * 2.5;
        ctx.fillStyle = hgt > 1 ? '#d8eefa' : hgt > -1 ? '#7fc0e6' : '#3d8fc4';
        ctx.fillText(hgt > 1 ? '^' : '~', x - shift, surf - 9 + hgt);
      }
    }
    // Fish, shaded top to bottom.
    for (const f of fish) {
      f.x += f.v * dt; if (f.x > w + 50) f.x = -50; if (f.x < -50) f.x = w + 50;
      const y = f.y - cam;
      if (y < -30 || y > h + 30) continue;
      const tones = f.deep ? ['#0b1a30', '#1a2f4d', '#2a4466', '#3d5b82', '#5677a0'] : ['#06203a', '#0c2f50', '#164468', '#245b84', '#3a78a2'];
      solid(ctx, FISH_BODY(f.big ? 1.15 : .75), f.x, y, tones, { flip: f.v < 0, fx: 3.2, fy: 4.2, font: 5.5 });
      marks(ctx, [[6.5 * (f.big ? 1.15 : .75), -1.5, '.', '#e8f1ff']], f.x, y, f.v < 0, 8);
    }
    // Marine snow.
    ctx.font = `10px ${SPRITE}`; ctx.fillStyle = 'rgba(170,200,230,.4)';
    for (const s of snow) { s.y += s.v * dt; const y = s.y - cam; if (y >= 0 && y < h) ctx.fillText('.', s.x + Math.sin(t + s.y) * 2, y); }
    // Ruler.
    const rx = w - 9;
    ctx.fillStyle = 'rgba(125,147,184,.45)';
    ctx.fillRect(rx, Math.max(0, surf), 1, h);
    for (let m = 0; m <= 1400; m += 20) {
      const y = depthY(m) - cam;
      if (y >= 0 && y < h) ctx.fillRect(rx - (m % 100 ? 6 : 12), Math.round(y), m % 100 ? 6 : 12, 1);
    }
    // Bubbles.
    if (Math.random() < dt * 2.2) addBubble(rand(0, w), cam + h + 10, false);
    ctx.font = `600 12px ${SPRITE}`; ctx.fillStyle = 'rgba(200,228,248,.65)';
    bubbles = bubbles.filter(b => {
      b.y -= b.v * dt; const y = b.y - cam;
      if (y < surf || y < -16) return false;
      ctx.fillText(b.c, b.x + Math.sin(t * 3 + b.ph) * 2.5, y); return true;
    });
    // Krill: the mascot idles bottom-left, then joins the answer chip with its swarm.
    mascot.x += (mascot.tx - mascot.x) * Math.min(1, dt * 6); mascot.y += (mascot.ty - mascot.y) * Math.min(1, dt * 6);
    if (phase === 'card' || phase === 'chip') {
      if (swarm) {
        ctx.font = `600 10px ${SPRITE}`;
        for (const s of swarm) {
          const a = s.a + t * s.v, right = -Math.sin(a) * s.v > 0;
          ctx.fillStyle = s.c;
          ctx.fillText(right ? '~)>' : '<(~', w / 2 + Math.cos(a) * s.rx - 8, chipY + Math.sin(a) * s.ry - 6);
        }
      }
      drawKrill(ctx, mascot.x + 40, mascot.y + 26 + Math.sin(t * 2.4) * 4, PINK, swarm !== null, '#14040c', 1.4);
    }
    // Lines light up as the answer sinks past them.
    if (chipShown) for (const el of tiers) el.classList.toggle('lit', el._y - cam < chipY + 4);
    if (running) requestAnimationFrame(draw);
  };

  // ---------- World labels ----------
  const tiers = [];
  const put = (cls, m, html, style = '') => { const el = document.createElement('div'); el.className = cls; el.style.cssText = `top:${depthY(m)}px;${style}`; el.innerHTML = html; el._y = depthY(m); world.append(el); return el; };
  put('mark', 0, '0m');
  for (let m = 100; m <= 1300; m += 100) if (m !== 1000) put('mark', m, `-${m.toLocaleString('en-US')}m`);
  [[90, 'PLANKTON · 10', '#e8f1ff'], [150, 'COMMON · 15', '#ffb547'], [300, 'SCHOOLER · 30', '#4de3ff'], [600, 'RARE · 60', '#ff5d6c'], [850, 'DEEP CUT · 85', '#b18cff'], [1000, 'ONE IN A KRILLION · 100', '#ffd166']]
    .forEach(([m, text, c]) => tiers.push(put('tier', m, `<span>◆ ${text}</span>`, `--c:${c}`)));
  [[45, 'left', '── the sea goes blue-green here'], [200, 'right', 'THE TWILIGHT ZONE', 'big'], [240, 'right', 'most sunlight stops here ──'], [332, 'left', '── deepest scuba dive on record: 332m'],
    [480, 'right', 'most military subs turn back here ──'], [700, 'left', '── lanternfish hide here by day'], [900, 'right', 'no sunlight at all past here ──'], [1050, 'left', 'THE MIDNIGHT ZONE', 'big']]
    .forEach(([m, side, text, extra]) => put(`note ${side} ${extra || ''}`, m, text));

  // ---------- Timeline ----------
  let running = false, timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const kick = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  const start = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(draw); } };
  const count = (ms, fn) => { const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / ms); fn(1 - (1 - k) ** 3); if (k < 1 && phase === 'counting') requestAnimationFrame(step); }; requestAnimationFrame(step); };

  const finish = () => {
    timers.forEach(clearTimeout); timers = []; tween = null;
    cam = camEnd; phase = 'done'; chipShown = false; swarm = null;
    dive.classList.remove('playing', 'zap', 'chip-in', 'sinking', 'gone');
    typed.textContent = name; answer.classList.remove('empty'); diveBtn.classList.remove('press', 'spent');
    depthEl.textContent = '1,000m'; scoreEl.textContent = '100';
    removeEventListener('pointerdown', skip); removeEventListener('keydown', skip);
  };
  const skip = event => { if (!event.target.closest || !event.target.closest('.menu, .menu-btn')) finish(); };

  const play = () => {
    finish();
    dive.classList.remove('landing'); void dive.offsetWidth;
    phase = 'card'; cam = 0; bubbles = [];
    [mascot.x, mascot.y] = mascotIdle(); [mascot.tx, mascot.ty] = mascotIdle();
    dive.classList.add('playing');
    typed.textContent = ''; answer.classList.add('empty'); depthEl.textContent = '0m'; scoreEl.textContent = '0'; timer.textContent = '25';
    addEventListener('pointerdown', skip); addEventListener('keydown', skip);
    for (let sec = 1; sec <= 9; sec++) at(450 + sec * 1000, () => { timer.textContent = 25 - sec; });
    let s = 1500;
    [...name].forEach((_, i) => at(s += rand(90, 160), () => { typed.textContent = name.slice(0, i + 1); answer.classList.remove('empty'); }));
    at(s += 600, () => diveBtn.classList.add('press'));
    // Submit: the button spends, bubbles burst up from below.
    at(s += 140, () => {
      diveBtn.classList.remove('press'); diveBtn.classList.add('spent');
      for (let i = 0; i < 46; i++) addBubble(w / 2 + rand(-80, 80), cam + h + rand(0, 120), true);
    });
    // The answer lands in the water with its swarm; the lines appear.
    at(s += 650, () => {
      dive.classList.add('zap', 'chip-in'); chipShown = true; phase = 'chip';
      swarm = Array.from({ length: 14 }, () => ({ a: rand(0, 7), v: rand(1.5, 3) * (Math.random() < .5 ? -1 : 1), rx: rand(50, 100), ry: rand(16, 36), c: pick(['#ff5d8f', '#ff86ab', '#c23a66']) }));
      mascot.tx = w / 2 + 84; mascot.ty = chipY - 52;
    });
    at(s += 550, () => dive.classList.add('gone'));
    // Descent: the world scrolls up past the answer, which rocks in place.
    at(s += 150, () => { dive.classList.add('sinking'); tween = { from: 0, to: camEnd, start: performance.now(), dur: 4300 }; });
    // Landing: banner pops where the answer was, the gold krill flips in, then the counters run.
    at(s += 4300, () => {
      chipShown = false; swarm = null; phase = 'landed';
      dive.classList.remove('playing', 'zap', 'chip-in', 'sinking', 'gone'); dive.classList.add('landing');
    });
    at(s += 900, () => {
      phase = 'counting';
      count(1400, k => {
        const m = Math.round(k * 1000);
        if (depthEl.textContent !== m.toLocaleString('en-US') + 'm') { depthEl.textContent = m.toLocaleString('en-US') + 'm'; if (m % 125 < 25) kick(depthEl, 'jolt'); }
        scoreEl.textContent = Math.round(k * 100);
      });
    });
    at(s += 1450, () => { kick(scoreEl, 'slam'); finish(); });
  };

  // ---------- Wiring ----------
  layout();
  drawBadge();
  if (document.fonts) document.fonts.load(FONT).then(() => { layout(); drawBadge(); if (phase === 'done') cam = camEnd; if (reduced) draw(performance.now()); });
  [mascot.x, mascot.y] = mascotIdle();
  addEventListener('resize', () => { const k = cam === camEnd; layout(); if (k || phase === 'done') cam = camEnd; if (reduced) { running = false; draw(performance.now()); } });
  const menuBtn = dive.querySelector('.menu-btn'), menu = dive.querySelector('.menu');
  menuBtn.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', open); });
  menu.addEventListener('click', event => { if (event.target.closest('a, button')) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } });
  dive.querySelectorAll('.replay').forEach(btn => btn.addEventListener('click', () => { scrollTo({ top: 0 }); play(); }));

  cam = camEnd; phase = 'done';
  if (reduced) { dive.querySelectorAll('.replay').forEach(btn => { btn.hidden = true; }); draw(performance.now()); return; }
  // Only animate while the opening is on screen.
  new IntersectionObserver(([entry]) => { if (entry.isIntersecting) start(); else running = false; }).observe(dive);
  const small = matchMedia('(max-width: 899px), (max-height: 639px), (max-aspect-ratio: 5/4)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('dove') === '1'; sessionStorage.setItem('dove', '1'); } catch {}
  if (frozen) { cam = camEnd; return; }
  if (small && !seen) play();
})();

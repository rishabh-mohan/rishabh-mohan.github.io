// Mobile opening: a Krillion-style "Name a SWE" dive.
// The sea is pixel art drawn on a low-res canvas (one art pixel = P css px); labels and lines live in .world,
// which moves with the same camera. Plays once per session, tap to skip, "dive again" replays.
(() => {
  const dive = document.querySelector('#mobile .dive');
  if (!dive) return;
  const P = 3, MPX = 2, SURF = 160; // art pixel size, css px per metre, waterline (css px from top)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = dive.querySelector('.scene'), ctx = canvas.getContext('2d');
  const world = dive.querySelector('.world'), chip = dive.querySelector('.chip');
  const depthEl = dive.querySelector('.depth'), scoreEl = dive.querySelector('.score');
  const typed = dive.querySelector('.typed'), answer = dive.querySelector('.answer'), timer = dive.querySelector('.timer');
  const diveBtn = dive.querySelector('.dive-btn'), name = typed.textContent;
  const depthY = m => SURF + m * MPX; // css px in world space
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- Sprites ----------
  // Our own krill: curled, facing left. Letters are palette keys; '.' is empty.
  const KRILL = [
    'a..............',
    '.a..aa.........',
    '..aa..oooo.....',
    '....oobhhbo....',
    '...obhhbbsbo...',
    '..oebbbbsbbbo..',
    '..obbbbsbbsbo..',
    '...oobbsbbsbbo.',
    '..l.l.oobsbbbo.',
    '.l.l.l..obsbo..',
    '........obbo...',
    '......oobbo....',
    '.....otttoo....',
    '....ot.t.to....',
    '.....o...o.....',
  ];
  const PINK = { o: '#7d1d3c', b: '#ff5d8f', h: '#ffc2d4', e: '#1a0610', a: '#ff9fbc', l: '#c23a66', s: '#d63f70', t: '#ff9fbc' };
  const GOLD = { o: '#8a5a12', b: '#ffd166', h: '#fff1b8', e: '#2a1a00', a: '#ffe9a8', l: '#c9962e', s: '#e0a83a', t: '#ffe9a8' };
  const drawSprite = (map, pal, x, y, flip) => map.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '.') return;
    ctx.fillStyle = pal[c]; ctx.fillRect(Math.round(x + (flip ? map[0].length - 1 - i : i)), Math.round(y + j), 1, 1);
  }));
  // Gold badge for the result, as crisp SVG rects.
  dive.querySelector('.badge').innerHTML = `<svg viewBox="0 0 ${KRILL[0].length} ${KRILL.length}" shape-rendering="crispEdges">${
    KRILL.flatMap((row, j) => [...row].map((c, i) => c === '.' ? '' : `<rect x="${i}" y="${j}" width="1" height="1" fill="${GOLD[c]}"/>`)).join('')}</svg>`;

  // ---------- Scene layout (rebuilt on resize) ----------
  let W = 0, H = 0, w = 0, h = 0, camEnd = 0, chipY = 0;
  let clouds = [], kelp = [], coral = [], fish = [], snow = [], walls = [];
  const cloudSprite = (cw, ch) => { // union of circles, flat-ish bottom, shaded underside
    const blobs = Array.from({ length: 5 }, (_, i) => [cw * (.15 + i * .17) + rand(-2, 2), ch * rand(.45, .7), ch * rand(.35, .6)]);
    const px = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (!blobs.some(([bx, by, r]) => (x - bx) ** 2 + ((y - by) * 1.4) ** 2 < r * r) || y > ch * .85) continue;
      px.push([x, y, y > ch * .62 ? 1 : 0]);
    }
    return px;
  };
  const layout = () => {
    w = dive.clientWidth; h = dive.clientHeight;
    W = Math.ceil(w / P); H = Math.ceil(h / P);
    canvas.width = W; canvas.height = H;
    chipY = h * .44;
    camEnd = depthY(1000) - chipY;
    clouds = [[.02, 8, 64, 16], [.55, 20, 52, 13], [.3, 34, 44, 11]].map(([fx, y, cw, ch]) => ({ x: fx * W, y, px: cloudSprite(cw, ch), speed: rand(.4, .9) }));
    kelp = Array.from({ length: 16 }, (_, i) => {
      const left = i % 2 === 0;
      return { x: left ? rand(-2, W * .22) : rand(W * .72, W - 4), base: (depthY(380) + rand(-40, 30)) / P, len: rand(55, 140) | 0, back: i % 3 === 0, phase: rand(0, 6) };
    }).sort((a, b) => b.back - a.back);
    coral = [];
    for (const [cx, base, size] of [[W * .1, depthY(395) / P, 22], [W * .85, depthY(385) / P, 28], [W * .7, depthY(1150) / P, 20], [W * .2, depthY(1170) / P, 18]]) {
      const branch = (x, y, ang, len, depth) => {
        for (let k = 0; k < len; k++) coral.push([Math.round(x + Math.cos(ang) * k), Math.round(y - Math.sin(ang) * k), base > depthY(800) / P]);
        if (depth > 0) for (const turn of [-.5, .45]) branch(x + Math.cos(ang) * len, y - Math.sin(ang) * len, ang + turn + rand(-.2, .2), len * .68, depth - 1);
      };
      branch(cx, base, Math.PI / 2, size * .45, 3);
    }
    fish = Array.from({ length: 9 }, (_, i) => ({ x: rand(0, W), y: (i < 6 ? depthY(rand(20, 330)) : depthY(rand(650, 1150))) / P, v: rand(4, 11) * (i % 2 ? 1 : -1), deep: i >= 6 }));
    snow = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(SURF, depthY(1300)) / P, v: rand(.6, 2) }));
    // Rock walls below 600m: smoothed noise per art row.
    const rows = Math.ceil((depthY(1400) - depthY(600)) / P);
    let a = 6, b = 6;
    walls = Array.from({ length: rows }, () => { a = Math.max(2, Math.min(18, a + rand(-1.2, 1.2))); b = Math.max(2, Math.min(18, b + rand(-1.2, 1.2))); return [a, b]; });
  };

  // ---------- Colours ----------
  const STOPS = [[0, [38, 112, 163]], [60, [30, 96, 145]], [150, [24, 78, 124]], [300, [17, 56, 95]], [450, [12, 38, 70]], [650, [10, 27, 52]], [900, [8, 19, 38]], [1300, [6, 12, 25]]];
  const water = m => {
    let i = 1; while (i < STOPS.length - 1 && m > STOPS[i][0]) i++;
    const [m0, c0] = STOPS[i - 1], [m1, c1] = STOPS[i], f = Math.max(0, Math.min(1, (m - m0) / (m1 - m0)));
    return c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
  };
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const band = m => water(Math.floor(m / 25) * 25 + 12); // posterised into 25 m slabs

  // ---------- Bubbles ----------
  let bubbles = [];
  const addBubble = (x, y, fast) => bubbles.push({ x, y, r: Math.random() < .35 ? 2 : 1, v: fast ? rand(35, 70) : rand(12, 24), ph: rand(0, 6) });
  const ring = (x, y, r) => {
    x = Math.round(x); y = Math.round(y);
    if (r === 1) { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); return; }
    ctx.fillRect(x - 1, y - 2, 3, 1); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x - 2, y - 1, 1, 3); ctx.fillRect(x + 2, y - 1, 1, 3);
  };

  // ---------- State ----------
  let cam = 0, tween = null, phase = 'idle', chipShown = false, swarm = null, last = 0, t = 0;
  const mascotIdle = () => [8, H * .7];
  let mascot = { x: 0, y: 0, tx: 0, ty: 0 };

  const draw = now => {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now; t += dt;
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur), e = k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      cam = tween.from + (tween.to - tween.from) * e;
      if (k === 1) tween = null;
    }
    world.style.transform = `translate3d(0,${-cam}px,0)`;
    const camA = cam / P, surf = SURF / P;

    // Sky and water, row by row.
    for (let y = 0; y < H; y++) {
      const wy = y + camA;
      if (wy < surf) {
        const f = Math.floor(wy / surf * 10) / 10;
        ctx.fillStyle = rgb([120 + 106 * f, 190 + 53 * f, 232 + 18 * f].map(Math.round));
      } else ctx.fillStyle = rgb(band((wy - surf) * P / MPX));
      ctx.fillRect(0, y, W, 1);
    }
    // Sun and clouds.
    if (camA < surf) {
      const sx = W * .8, sy = 16 - camA;
      ctx.fillStyle = 'rgba(255,229,138,.18)'; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,229,138,.3)'; ctx.beginPath(); ctx.arc(sx, sy, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 7); ctx.fill();
      for (const c of clouds) {
        const cx = Math.round(((c.x + t * c.speed) % (W + 80)) - 40), cy = Math.round(c.y - camA);
        for (const [x, y, s] of c.px) { ctx.fillStyle = s ? '#d4e6f2' : '#fff'; ctx.fillRect(cx + x, cy + y, 1, 1); }
      }
      // Waves and boat.
      for (let x = 0; x < W; x++) {
        const wy = Math.round(surf - camA + Math.sin(x * .09 + t * 1.6) * .8);
        ctx.fillStyle = 'rgb(68,148,199)'; ctx.fillRect(x, wy, 1, 1);
      }
      const bx = Math.round(W * .2), by = Math.round(surf - camA + Math.sin(t * 2) * .6) - 6;
      ctx.fillStyle = '#ff5d8f'; ctx.fillRect(bx + 4, by - 6, 3, 2);
      ctx.fillStyle = '#0d1830'; ctx.fillRect(bx + 3, by - 6, 1, 5); ctx.fillRect(bx + 2, by - 1, 6, 2); ctx.fillRect(bx - 3, by + 1, 16, 2); ctx.fillRect(bx - 2, by + 3, 14, 1);
      ctx.fillStyle = '#e8f1ff'; ctx.fillRect(bx + 3, by, 1, 1); ctx.fillRect(bx + 6, by, 1, 1);
    }
    // Light rays.
    for (const [fx, wd] of [[.12, 7], [.32, 11], [.52, 6], [.7, 10], [.9, 7]]) {
      const x0 = W * fx + Math.sin(t * .4 + fx * 9) * 3, y0 = surf - camA, len = 150;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + len); g.addColorStop(0, 'rgba(200,235,255,.09)'); g.addColorStop(1, 'rgba(200,235,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + wd, y0); ctx.lineTo(x0 + wd + 34, y0 + len); ctx.lineTo(x0 + 34, y0 + len); ctx.fill();
    }
    // Rock walls.
    const wallTop = depthY(600) / P;
    for (let y = 0; y < H; y++) {
      const r = walls[Math.floor(y + camA - wallTop)];
      if (!r) continue;
      ctx.fillStyle = '#0a1830'; ctx.fillRect(0, y, Math.round(r[0] + 6), 1); ctx.fillRect(W - Math.round(r[1] + 6), y, Math.round(r[1] + 6), 1);
      ctx.fillStyle = '#060f20'; ctx.fillRect(0, y, Math.round(r[0]), 1); ctx.fillRect(W - Math.round(r[1]), y, Math.round(r[1]), 1);
    }
    // Kelp: stems with stair-stepped leaflets, swaying more toward the tip.
    for (const k of kelp) {
      const by = k.base - camA;
      if (by - k.len > H || by < 0) continue;
      ctx.fillStyle = k.back ? '#123d66' : '#0a2a4a';
      const stem = k.back ? 1 : 2;
      for (let i = 0; i < k.len; i++) {
        const f = i / k.len, x = Math.round(k.x + Math.sin(t * .9 + k.phase + i * .045) * f * f * 6), y = Math.round(by - i);
        ctx.fillRect(x, y, stem, 1);
        if (i % 3 === 1 && i < k.len - 2) {
          const leaf = Math.round(3 + (1 - f) * 5), dir = (i / 3 | 0) % 2 ? 1 : -1, x0 = dir > 0 ? x + stem - 1 : x;
          for (let j = 1; j <= leaf; j++) ctx.fillRect(x0 + dir * j, y - Math.round(j * .6), 1, 2);
        }
      }
    }
    for (const [x, y, deep] of coral) { ctx.fillStyle = deep ? '#071328' : '#0b2a48'; ctx.fillRect(x, Math.round(y - camA), 2, 1); }
    // Fish.
    for (const f of fish) {
      f.x += f.v * dt; if (f.x > W + 10) f.x = -10; if (f.x < -10) f.x = W + 10;
      const x = Math.round(f.x), y = Math.round(f.y - camA);
      if (y < -4 || y > H + 4) continue;
      ctx.fillStyle = f.deep ? '#050c1a' : '#0b2744';
      const tx = f.v > 0 ? x - 3 : x + 3;
      ctx.fillRect(x - 2, y, 5, 2); ctx.fillRect(x - 1, y - 1, 3, 1); ctx.fillRect(tx, y - 1, 1, 4);
    }
    // Marine snow.
    ctx.fillStyle = 'rgba(170,200,230,.35)';
    for (const s of snow) { s.y += s.v * dt; const y = Math.round(s.y - camA); if (y >= 0 && y < H) ctx.fillRect(Math.round(s.x + Math.sin(t + s.y) * .6), y, 1, 1); }
    // Ruler.
    const rx = W - 3;
    ctx.fillStyle = 'rgba(125,147,184,.45)';
    ctx.fillRect(rx, Math.max(0, Math.round(surf - camA)), 1, H);
    for (let m = 0; m <= 1400; m += 20) {
      const y = Math.round(depthY(m) / P - camA);
      if (y >= 0 && y < H) ctx.fillRect(rx - (m % 100 ? 2 : 4), y, m % 100 ? 2 : 4, 1);
    }
    // Bubbles.
    if (Math.random() < dt * 2.2) addBubble(rand(0, W), camA + H + 4, false);
    ctx.fillStyle = 'rgba(190,220,245,.55)';
    bubbles = bubbles.filter(b => {
      b.y -= b.v * dt; const y = b.y - camA;
      if (y < surf - camA || y < -6) return false;
      ring(b.x + Math.sin(t * 3 + b.ph) * .8, y, b.r); return true;
    });
    // Krill: the mascot idles bottom-left, then joins the answer chip with its swarm.
    mascot.x += (mascot.tx - mascot.x) * Math.min(1, dt * 6); mascot.y += (mascot.ty - mascot.y) * Math.min(1, dt * 6);
    if (phase === 'card' || phase === 'chip') {
      if (swarm) for (const s of swarm) {
        const a = s.a + t * s.v, x = W / 2 + Math.cos(a) * s.rx, y = chipY / P + Math.sin(a) * s.ry;
        ctx.fillStyle = '#ff5d8f'; ctx.fillRect(Math.round(x), Math.round(y), 2, 1); ctx.fillStyle = '#c23a66'; ctx.fillRect(Math.round(x) + (Math.cos(a) > 0 ? -1 : 2), Math.round(y) + 1, 1, 1);
      }
      drawSprite(KRILL, PINK, mascot.x, mascot.y + Math.sin(t * 2.4) * 1.5, swarm !== null);
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
      for (let i = 0; i < 46; i++) addBubble(W / 2 + rand(-26, 26), cam / P + H + rand(0, 40), true);
    });
    // The answer lands in the water with its swarm; the lines appear.
    at(s += 650, () => {
      dive.classList.add('zap', 'chip-in'); chipShown = true; phase = 'chip';
      swarm = Array.from({ length: 14 }, () => ({ a: rand(0, 7), v: rand(1.5, 3) * (Math.random() < .5 ? -1 : 1), rx: rand(16, 32), ry: rand(5, 12) }));
      mascot.tx = W / 2 + 26; mascot.ty = chipY / P - 12;
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
  if (small && !seen) play();
})();

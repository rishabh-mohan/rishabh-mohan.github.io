// Mobile opening: a Krillion-style "Name a SWE" dive.
// The sea is drawn on a canvas, and everything in it (krill, boat, clouds, kelp, coral, fish, rocks, bubbles) is
// homemade ASCII set in VT323. Labels and lines live in .world, which moves with the same camera.
// Plays once per session, tap to skip, "dive again" replays.
(() => {
  const dive = document.querySelector('#mobile .dive');
  if (!dive) return;
  const MPX = 2, SURF = 160, FONT = '"VT323", ui-monospace, monospace'; // css px per metre, waterline (css px from top)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = dive.querySelector('.scene'), ctx = canvas.getContext('2d');
  const world = dive.querySelector('.world');
  const depthEl = dive.querySelector('.depth'), scoreEl = dive.querySelector('.score');
  const typed = dive.querySelector('.typed'), answer = dive.querySelector('.answer'), timer = dive.querySelector('.timer');
  const diveBtn = dive.querySelector('.dive-btn'), name = typed.textContent;
  const depthY = m => SURF + m * MPX; // css px in world space
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.random() * list.length | 0];

  // ---------- ASCII art ----------
  const KRILL_L = [
    ' \\\\ ___',
    '=(o  ``-.',
    '  `-,,,_ )',
    "    ///-'",
  ];
  const KRILL_R = [
    '    ___ //',
    "  .-''  o)=",
    ' ( _,,,-`',
    " `-\\\\\\",
  ];
  const SUN = ['\\ | /', '-( )-', '/ | \\'];
  const CLOUDS = [
    ['    .--.', ' .-(    )-.', "(___.__)__.)"],
    ['   _  _', ' _( )( )_', '(___..___)'],
    ['  .-.', ' (   ).', '(___(__)'],
  ];
  const BOAT = ['  ___|___', '  \\_o_o_/'];
  const CORAL = [' \\|/ \\|/', '  \\Y/ \\|', '   \\| /', '    |/', '   _|_'];
  const FISH = { r: ['><>', '><((°>'], l: ['<><', '<°))><'] };
  const ROCK = '#%@%#:%#@:.';
  dive.querySelector('.badge').textContent = KRILL_L.join('\n');

  const art = (lines, x, y, color, size = 16, lh = size * .9) => {
    ctx.font = `${size}px ${FONT}`; ctx.fillStyle = color;
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lh));
  };

  // ---------- Scene layout (rebuilt on resize) ----------
  let w = 0, h = 0, camEnd = 0, chipY = 0, dpr = 1;
  let clouds = [], kelp = [], coral = [], fish = [], snow = [], walls = [];
  const layout = () => {
    w = dive.clientWidth; h = dive.clientHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    chipY = h * .44;
    camEnd = depthY(1000) - chipY;
    clouds = CLOUDS.map((lines, i) => ({ lines, x: [.04, .5, .26][i] * w, y: [30, 62, 98][i], speed: rand(1.5, 3) }));
    kelp = Array.from({ length: 14 }, (_, i) => {
      const left = i % 2 === 0, back = i % 3 === 0;
      return { x: left ? rand(-6, w * .2) : rand(w * .74, w - 20), base: depthY(385) + rand(-30, 30), rows: rand(14, 34) | 0, back, phase: rand(0, 6) };
    }).sort((a, b) => b.back - a.back);
    coral = [[w * .04, depthY(395), false], [w * .66, depthY(390), false], [w * .62, depthY(1175), true], [w * .1, depthY(1190), true]];
    fish = Array.from({ length: 9 }, (_, i) => ({ x: rand(0, w), y: i < 6 ? depthY(rand(25, 330)) : depthY(rand(650, 1150)), v: rand(12, 34) * (i % 2 ? 1 : -1), big: Math.random() < .35, deep: i >= 6 }));
    snow = Array.from({ length: 70 }, () => ({ x: rand(0, w), y: rand(SURF, depthY(1300)), v: rand(2, 6) }));
    // Rock walls below 600m: a row of ASCII every 12px, width wandering slowly.
    let a = 4, b = 4;
    walls = Array.from({ length: Math.ceil((depthY(1400) - depthY(600)) / 12) }, () => {
      a = Math.max(1, Math.min(8, a + rand(-.8, .8))); b = Math.max(1, Math.min(8, b + rand(-.8, .8)));
      const row = n => Array.from({ length: Math.round(n) }, (_, k) => ROCK[(k * 3 + (Math.random() * 3 | 0)) % ROCK.length]).join('');
      return [row(a), row(b)];
    });
  };

  // ---------- Colours ----------
  const STOPS = [[0, [38, 112, 163]], [60, [30, 96, 145]], [150, [24, 78, 124]], [300, [17, 56, 95]], [450, [12, 38, 70]], [650, [10, 27, 52]], [900, [8, 19, 38]], [1300, [6, 12, 25]]];
  const water = m => {
    let i = 1; while (i < STOPS.length - 1 && m > STOPS[i][0]) i++;
    const [m0, c0] = STOPS[i - 1], [m1, c1] = STOPS[i], f = Math.max(0, Math.min(1, (m - m0) / (m1 - m0)));
    return c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
  };
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

  // ---------- Bubbles ----------
  let bubbles = [];
  const addBubble = (x, y, fast) => bubbles.push({ x, y, c: pick(['o', 'o', '°', 'O']), v: fast ? rand(110, 210) : rand(36, 72), ph: rand(0, 6) });

  // ---------- State ----------
  let cam = 0, tween = null, phase = 'idle', chipShown = false, swarm = null, last = 0, t = 0;
  const mascotIdle = () => [12, h * .68];
  let mascot = { x: 0, y: 0, tx: 0, ty: 0 };

  const draw = now => {
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
        ctx.fillStyle = rgb([74 + 70 * f, 160 + 50 * f, 222 + 22 * f].map(Math.round));
      } else ctx.fillStyle = rgb(water(Math.floor((wy - SURF) / MPX / 25) * 25 + 12));
      ctx.fillRect(0, y, w, 6);
    }
    // Surface: sun, clouds, boat and waves.
    if (surf > 0) {
      const sx = w * .64, sy = 74 - cam;
      ctx.fillStyle = 'rgba(255,229,138,.22)'; ctx.beginPath(); ctx.arc(sx, sy, 40, 0, 7); ctx.fill();
      art(SUN, sx - 20, sy - 22, '#ffd84a', 18, 15);
      for (const c of clouds) {
        const cx = ((c.x + t * c.speed) % (w + 140)) - 70;
        art(c.lines.slice(0, -1), cx, c.y - cam, '#fff', 17, 14);
        art(c.lines.slice(-1), cx, c.y - cam + (c.lines.length - 1) * 14, '#cfe6f6', 17, 14);
      }
      const bx = w * .2, by = surf - 34 + Math.sin(t * 2) * 1.2;
      art(['     |'], bx, by - 14, '#0d1830', 17, 14);
      art(['      >'], bx, by - 15, '#ff5d8f', 17, 14);
      art(BOAT, bx, by, '#0d1830', 17, 14);
      ctx.font = `16px ${FONT}`; ctx.fillStyle = '#5aa5d6';
      const wave = ".-'``'-.", cw = 7, shift = (t * 14) % (wave.length * cw);
      let row = ''; for (let i = 0; i < w / cw + wave.length * 2; i++) row += wave[i % wave.length];
      ctx.fillText(row, -shift, surf - 9);
    }
    // Light rays.
    for (const [fx, wd] of [[.12, 20], [.32, 32], [.52, 18], [.7, 30], [.9, 20]]) {
      const x0 = w * fx + Math.sin(t * .4 + fx * 9) * 9, len = 450;
      const g = ctx.createLinearGradient(0, surf, 0, surf + len); g.addColorStop(0, 'rgba(200,235,255,.08)'); g.addColorStop(1, 'rgba(200,235,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, surf); ctx.lineTo(x0 + wd, surf); ctx.lineTo(x0 + wd + 100, surf + len); ctx.lineTo(x0 + 100, surf + len); ctx.fill();
    }
    // Rock walls.
    ctx.font = `15px ${FONT}`; ctx.fillStyle = '#1c3658';
    const wallTop = depthY(600);
    for (let i = Math.max(0, Math.floor((cam - wallTop) / 12)); i < walls.length; i++) {
      const y = wallTop + i * 12 - cam;
      if (y > h) break;
      ctx.textAlign = 'left'; ctx.fillText(walls[i][0], 0, y);
      ctx.textAlign = 'right'; ctx.fillText(walls[i][1], w, y);
    }
    ctx.textAlign = 'left';
    // Kelp: "(|" and "|)" stacked, swaying more toward the tip.
    for (const k of kelp) {
      const size = k.back ? 15 : 20, lh = size * .7, by = k.base - cam;
      if (by - k.rows * lh > h || by < -20) continue;
      ctx.font = `${size}px ${FONT}`; ctx.fillStyle = k.back ? '#0d3256' : '#06192e';
      for (let i = 0; i < k.rows; i++) {
        const f = i / k.rows, x = k.x + Math.sin(t * .9 + k.phase + i * .18) * f * f * 14;
        ctx.fillText(i === k.rows - 1 ? ' )' : i % 2 ? '(|' : ' |)', x, by - i * lh);
      }
    }
    for (const [x, y, deep] of coral) art(CORAL, x, y - cam - CORAL.length * 14, deep ? '#1c3658' : '#081f38', 17, 14);
    // Fish.
    for (const f of fish) {
      f.x += f.v * dt; if (f.x > w + 40) f.x = -40; if (f.x < -40) f.x = w + 40;
      const y = f.y - cam;
      if (y < -20 || y > h + 20) continue;
      art([FISH[f.v > 0 ? 'r' : 'l'][f.big ? 1 : 0]], f.x, y, f.deep ? '#2a4466' : '#08213b', 15);
    }
    // Marine snow.
    ctx.font = `12px ${FONT}`; ctx.fillStyle = 'rgba(170,200,230,.4)';
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
    ctx.font = `15px ${FONT}`; ctx.fillStyle = 'rgba(190,220,245,.6)';
    bubbles = bubbles.filter(b => {
      b.y -= b.v * dt; const y = b.y - cam;
      if (y < surf || y < -16) return false;
      ctx.fillText(b.c, b.x + Math.sin(t * 3 + b.ph) * 2.5, y); return true;
    });
    // Krill: the mascot idles bottom-left, then joins the answer chip with its swarm.
    mascot.x += (mascot.tx - mascot.x) * Math.min(1, dt * 6); mascot.y += (mascot.ty - mascot.y) * Math.min(1, dt * 6);
    if (phase === 'card' || phase === 'chip') {
      if (swarm) {
        ctx.font = `13px ${FONT}`; ctx.fillStyle = '#ff5d8f';
        for (const s of swarm) {
          const a = s.a + t * s.v;
          ctx.fillText(Math.cos(a) * s.v > 0 ? '>' : '<', w / 2 + Math.cos(a) * s.rx, chipY + Math.sin(a) * s.ry - 6);
        }
      }
      art(swarm ? KRILL_R : KRILL_L, mascot.x, mascot.y + Math.sin(t * 2.4) * 4, '#ff5d8f', 16, 13);
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
      swarm = Array.from({ length: 14 }, () => ({ a: rand(0, 7), v: rand(1.5, 3) * (Math.random() < .5 ? -1 : 1), rx: rand(50, 100), ry: rand(16, 36) }));
      mascot.tx = w / 2 + 92; mascot.ty = chipY - 46;
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
  if (document.fonts) document.fonts.load(`16px ${FONT}`).then(() => { if (reduced) draw(performance.now()); });
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

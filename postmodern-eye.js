const eyeRamp = ' .,:;irsxXAM#%@';
const nerveFlesh = ['#350b14', '#71151f', '#a92834', '#e44648', '#ff8a71'];
const eyeWhite = ['#49212b', '#8e464b', '#bd746b', '#ecc0a2', '#fff1d0'];
const eyeIris = ['#351019', '#6d1521', '#ba2d3b', '#ff6357', '#ffad88'];
const eyeCenterFromBottom = 60;

function paintPostmodernEye(canvas, gazeX, gazeY) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const density = Math.min(2, window.devicePixelRatio || 1);
  const deviceWidth = Math.round(width * density);
  const deviceHeight = Math.round(height * density);
  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
  }

  const context = canvas.getContext('2d');
  context.setTransform(deviceWidth / width, 0, 0, deviceHeight / height, 0, 0);
  context.clearRect(0, 0, width, height);
  context.font = '6px "Courier New", monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const centerX = width / 2;
  const centerY = height - eyeCenterFromBottom;
  const cellWidth = 3.7;
  const cellHeight = 4.2;

  function glyph(x, y, light, palette, mark) {
    const tone = Math.max(0, Math.min(1, light));
    context.fillStyle = palette[Math.round(tone * (palette.length - 1))];
    context.fillText(mark ?? eyeRamp[Math.round(tone * (eyeRamp.length - 1))], x, y);
  }

  const radius = 53;
  const root = centerY - radius * .61;
  const sightX = .19 + gazeX / 53;
  const sightY = .28 + gazeY / 25;
  const sightZ = Math.sqrt(1 - sightX * sightX - sightY * sightY);

  // The weight of the eye keeps the cord mostly vertical before it tucks behind the globe.
  for (let y = 2; y <= root; y += cellHeight) {
    const along = y / root;
    const tuck = Math.max(0, (along - .65) / .35);
    const bend = 2.2 * Math.sin(along * Math.PI * 1.5) - radius * .13 * tuck;
    const cordRadius = 5.6 + 9.4 * Math.exp(-along * 13) + 10.5 * along ** 9;
    for (let dx = -Math.floor(cordRadius); dx <= cordRadius; dx += cellWidth * .81) {
      const x = centerX + bend + dx;
      if (Math.hypot(x - centerX, y - centerY) <= radius) continue;
      const u = dx / cordRadius;
      const depth = Math.sqrt(Math.max(0, 1 - u * u));
      const fibre = Math.sin(u * 17 + along * 15 + Math.sin(along * 16)) * .14;
      const striation = Math.sin(u * 39 - along * 7) * .085;
      const light = .18 + .51 * depth - u * .23 + fibre + striation;
      const distinctFibre = light > .52 && Math.sin(u * 11 + along * 12) > .66;
      glyph(x, y, light, nerveFlesh, distinctFibre ? '|' : undefined);
    }
  }

  // The attachment sits behind the upper rim, facing away from the downward gaze.
  for (let dy = -65; dy < -32; dy += cellHeight) {
    for (let dx = -26; dx < 15; dx += cellWidth) {
      const socket = Math.hypot((dx + 7) / 16, (dy + 48) / 15);
      if (socket > 1 || Math.hypot(dx, dy) <= radius) continue;
      const folds = Math.sin(dx * .52 + dy * .44) * .14;
      glyph(centerX + dx, centerY + dy, .28 + (1 - socket) * .5 + folds, nerveFlesh);
    }
  }

  // Shade the globe as a sphere and project the iris onto its turning front.
  for (let dy = -radius; dy <= radius; dy += cellHeight) {
    for (let dx = -radius; dx <= radius; dx += cellWidth) {
      const u = dx / radius;
      const v = dy / radius;
      const distance = Math.hypot(u, v);
      if (distance > 1) continue;
      const depth = Math.sqrt(1 - distance * distance);
      const grain = .5 + .5 * Math.sin(dx * 3.77 + dy * 8.92);
      const x = centerX + dx;
      const y = centerY + dy;
      if (u < -.63 && distance > .87 + .045 * Math.sin(dy * .2) && dy < 5) {
        const folds = Math.sin(dx * .7 + dy * .22) * .13 + Math.sin(dx * .19 - dy * .43) * .11;
        glyph(x, y, .24 + depth * .39 - u * .16 - v * .12 + folds + grain * .09, nerveFlesh);
        continue;
      }

      const irisX = dx - sightX * radius;
      const irisY = dy - sightY * radius;
      const facing = u * sightX + v * sightY + depth * sightZ;
      const irisRadius = facing > 0 ? Math.sqrt(Math.max(0, 1 - facing * facing)) / .48 : Infinity;
      if (irisRadius < .39) {
        const glint = Math.abs(irisX + 3.5) < 2.6 && Math.abs(irisY + 5) < 2.7;
        glyph(x, y, glint ? 1 : .08, eyeIris, glint ? '*' : '.');
        continue;
      }
      if (irisRadius < 1.03) {
        const angle = Math.atan2(irisY, irisX);
        const fibres = Math.sin(angle * 23 + irisRadius * 8) * .17;
        const rim = irisRadius > .87 ? .21 : 0;
        const light = .62 + fibres - irisX * .008 - irisY * .009 - rim;
        glyph(x, y, light, eyeIris);
        continue;
      }

      const rearShadow = Math.max(0, -u - .53) * .8;
      const light = .25 + depth * .61 - u * .23 - v * .16 - rearShadow + grain * .045;
      glyph(x, y, light, eyeWhite);
    }
  }
}

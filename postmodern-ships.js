// Each pass specifies its own direction, banking curve and formation.
const crimsonPasses = [
  { start: 0, duration: 6.5, direction: 1, lane: 'upper', bank: 8, phase: .3, ships: [[0, 0, '-=>']] },
  { start: 1.1, duration: 5.8, direction: -1, lane: 'lower', bank: 11, phase: 1.8,
    ships: [[0, 0, '<=+'], [.15, -7, '<-|'], [.31, 8, '<=+']] },
  { start: 5.9, duration: 5.3, direction: -1, lane: 'upper', bank: 10, phase: .1,
    ships: [[0, -3, '<-='], [.24, 6, '<+']] },
  { start: 7.3, duration: 5.8, direction: 1, lane: 'upper', bank: 13, phase: 2.9,
    ships: [[0, 7, '=+>'], [.2, -6, '->']] },
  { start: 10.8, duration: 5.7, direction: 1, lane: 'lower', bank: 10, phase: 4.2, ships: [[0, 2, '=/>']] }
];

function paintPostmodernShips(context, time, width, height, gridTop, gridBottom, visibility) {
  const period = 17;
  const upper = Math.max(22, Math.min(height - 22, gridTop - 36));
  const lower = Math.max(22, Math.min(height - 22, gridBottom + 39));
  const startPad = 25;
  const run = width + startPad * 2;
  context.save();
  context.font = '5px "Courier New", monospace';

  crimsonPasses.forEach(pass => {
    const altitude = pass.lane === 'upper' ? upper : lower;
    pass.ships.forEach(([lag, offset, hull], index) => {
      const elapsed = ((time - pass.start - lag) % period + period) % period;
      if (elapsed >= pass.duration) return;
      const progress = elapsed / pass.duration;
      const x = pass.direction > 0 ? -startPad + run * progress : width + startPad - run * progress;
      const angle = progress * Math.PI * 2 + pass.phase + index * .47;
      const heightOffset = Math.sin(angle) * pass.bank + Math.sin(angle * 2.2) * 2;
      const y = Math.max(8, Math.min(height - 8, altitude + offset + heightOffset));
      context.globalAlpha = visibility * (.78 + .22 * Math.cos(angle) ** 2);
      context.fillStyle = index % 2 === 0 ? '#dc2445' : '#b81b38';
      context.fillText(hull, x, y);
      context.fillStyle = '#a61933';
      context.fillText(Math.cos(angle) > 0 ? '/' : '\\', x - pass.direction, y + 3);
      context.globalAlpha *= .45;
      context.fillText('-', x - pass.direction * 8, y);
      context.fillText('.', x - pass.direction * 13, y + (Math.sin(angle) > 0 ? -1 : 1));
    });
  });
  context.restore();
}

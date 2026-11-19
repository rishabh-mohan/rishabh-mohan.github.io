// A ρ (rho) favicon drawn in each theme's colors and letter style.
const rhoBowl = '<circle cx="17.5" cy="12.5" r="6.5"/><path d="M11 12.5V28"/>';
const pixelRho = ['.####.', '#....#', '#....#', '#....#', '#####.', '#.....', '#.....', '#.....'];

const themeIcons = {
  forest: { bg: '#101510', ink: '#d5e49d', mark: '<g transform="translate(3 0) skewX(-12)">' + rhoBowl + '</g>' },
  space: { bg: '#100f20', ink: '#aeeafa', mark: rhoBowl + '<path d="M26 3v4M24 5h4" stroke="#f7eaff" stroke-width="1.4"/>' },
  mountains: { bg: '#161f29', ink: '#cdeaff', mark: rhoBowl + '<path d="M7.5 28h7"/>' },
  // Snow piled on the bowl, a drift at the foot of the stem, and a large flake.
  snowdrift: { bg: '#0f1720', ink: '#7fb8e6', mark: rhoBowl
    + '<path d="M11.6 10.2Q13 5.4 17.5 5.2T23.6 10" stroke="#f6fbff" stroke-width="3.6"/>'
    + '<path d="M5 28.5Q11 25 17 28.5" stroke="#f6fbff" stroke-width="2.6"/>'
    + '<path d="M26.5 17v8M23 19l7 4M23 23l7-4" stroke="#f6fbff" stroke-width="1.4"/>' },
  postmodern: {
    bg: '#160709',
    ink: '#ff594f',
    pixels: pixelRho.flatMap((row, y) => Array.from(row, (cell, x) => cell === '#'
      ? '<rect x="' + (5.5 + x * 3.5) + '" y="' + (2 + y * 3.5) + '" width="3.5" height="3.5"/>'
      : '')).join('')
  }
};

function themeIconSvg(theme) {
  const { bg, ink, mark, pixels } = themeIcons[theme];
  const glyph = pixels
    ? '<g fill="' + ink + '">' + pixels + '</g>'
    : '<g fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round">' + mark + '</g>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="' + bg + '"/>' + glyph + '</svg>';
}

function applyThemeIcon(theme) {
  document.querySelector('link[rel="icon"]').href = 'data:image/svg+xml,' + encodeURIComponent(themeIconSvg(theme));
  document.querySelector('meta[name="theme-color"]').content = themeIcons[theme].bg;
}

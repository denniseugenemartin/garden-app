// Source for the app logo. Run `node assets/logo/render.js` to regenerate the PNG icons.

const COLORS = {
  bgTop: '#eaf5e1',
  bgBottom: '#c6e2b2',
  outline: '#5a2a22',
  body: '#f2937a',
  rings: '#d76b55',
  metal: '#c3ced6',
  metalShine: '#eef3f6',
  metalOutline: '#3d4a52',
  wood: '#d08a45',
  woodLines: '#9c5f28',
  woodOutline: '#5a3218',
};

// Android themed icons only use alpha: white = shape, black = cut-out detail.
const MONO = Object.fromEntries(Object.keys(COLORS).map((key) => [key, '#fff']));
Object.assign(MONO, {
  metalShine: '#000', woodLines: '#000',
  outline: '#000', metalOutline: '#000', woodOutline: '#000',
});

// Drawn pointing down with the blade tip at (0, 0).
function trowel(c, outlineWidth) {
  return `
  <rect x="-30" y="-500" width="60" height="205" rx="30" fill="${c.wood}" stroke="${c.woodOutline}" stroke-width="${outlineWidth}" />
  <path d="M -14 -455 L -14 -340 M 6 -465 L 6 -330" stroke="${c.woodLines}" stroke-width="7" stroke-linecap="round" />
  <rect x="-11" y="-300" width="22" height="80" fill="${c.metal}" stroke="${c.metalOutline}" stroke-width="${outlineWidth * 0.8}" />
  <path d="M 0 0 C -70 -55, -82 -165, -62 -228 L 62 -228 C 82 -165, 70 -55, 0 0 Z" fill="${c.metal}" stroke="${c.metalOutline}" stroke-width="${outlineWidth}" stroke-linejoin="round" />
  <path d="M -30 -205 C -42 -150, -36 -95, -14 -55" fill="none" stroke="${c.metalShine}" stroke-width="12" stroke-linecap="round" />`;
}

function wormSegment(c, d) {
  return `
  <path d="${d}" fill="none" stroke="${c.outline}" stroke-width="54" stroke-linecap="round" />
  <path d="${d}" fill="none" stroke="${c.body}" stroke-width="46" stroke-linecap="round" />
  <path d="${d}" fill="none" stroke="${c.rings}" stroke-width="30" stroke-dasharray="3 20" stroke-opacity="0.6" />`;
}

// Like the Rod of Asclepius: the worm coils around an upright trowel. Each half-turn runs between
// the coil's left (444) and right (580) edges; segments passing behind the handle are drawn first.
function artwork(c) {
  const turn = (x1, y1, x2) => `M ${x1} ${y1} C ${x1} ${y1 - 42}, ${x2} ${y1 - 42}, ${x2} ${y1 - 85}`;
  return `
  <g transform="translate(512 512) scale(1.12) translate(-512 -474)">
  ${wormSegment(c, turn(444, 475, 580))}
  ${wormSegment(c, turn(444, 305, 580))}
  <g transform="translate(512 870) scale(1.4)">${trowel(c, 7)}</g>
  ${wormSegment(c, turn(580, 560, 444))}
  ${wormSegment(c, turn(580, 390, 444))}
  ${wormSegment(c, 'M 580 220 C 580 180, 565 152, 528 142')}
  </g>`;
}

const background = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${COLORS.bgTop}" />
      <stop offset="1" stop-color="${COLORS.bgBottom}" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)" />`;

const svg = (content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${content}</svg>`;

// Artwork is centered on the canvas; shrink it into Android's adaptive-icon safe zone.
const centered = (c) => artwork(c);
const safeZone = (c) => `<g transform="translate(512 512) scale(0.68) translate(-512 -512)">${artwork(c)}</g>`;

module.exports = {
  icon: svg(background + centered(COLORS)),
  androidForeground: svg(safeZone(COLORS)),
  androidBackground: svg(background),
  androidMonochrome: svg(`<mask id="m">${safeZone(MONO)}</mask><rect width="1024" height="1024" fill="#fff" mask="url(#m)" />`),
  splash: svg(centered(COLORS)),
};

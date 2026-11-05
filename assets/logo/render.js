// Renders the logo SVGs in logo.js to the PNGs referenced by app.json.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const logo = require('./logo');

const assets = path.join(__dirname, '..');
const outputs = [
  ['icon.png', logo.icon, 1024],
  ['android-icon-foreground.png', logo.androidForeground, 1024],
  ['android-icon-background.png', logo.androidBackground, 1024],
  ['android-icon-monochrome.png', logo.androidMonochrome, 1024],
  ['splash-icon.png', logo.splash, 1024],
  ['favicon.png', logo.icon, 48],
];

for (const [file, svg, size] of outputs) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(assets, file), png);
  fs.writeFileSync(path.join(__dirname, file.replace('.png', '.svg')), svg);
  console.log(`${file} (${size}px)`);
}

// Erzeugt palettes.ts (Paletten je Stil) mit dem Arcade Asset Generator. Aufruf: node tools/build-palettes.js
const fs = require('fs'), path = require('path');
const G = require('../../generator/assetgen.js');
fs.writeFileSync(path.join(__dirname, '../palettes.ts'), G.paletteTS('mzPalettes', 'maze', ['neon', 'candy', 'hedge'],
    '// AUTOMATISCH ERZEUGT von tools/build-palettes.js – Farben in generator/assetgen.js (GENRE_PALETTES) ändern.'));
console.log('palettes.ts geschrieben');

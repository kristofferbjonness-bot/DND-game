// Builds the painted icons in public/art/icons/ (96px WebP, transparent).
// Two sources: the painted PNGs in hero-sheet-design-pack/public/art/all-icons/ (trimmed and
// centred), and the drawings below for icons the pack does not have, drawn in the same style:
// a dark brown ink outline, muted colours shaded from a light top-left to a dark bottom-right,
// and a soft highlight. Run: node tools/paint-icons.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PACK = 'hero-sheet-design-pack/public/art/all-icons';
const OUT = 'public/art/icons';
const SIZE = 96;

// Icon name → painted PNG from the pack.
const FROM_PACK = {
  map: 'tabs/map', journal: 'tabs/journal', bestiary: 'tabs/bestiary',
  armour: 'gear/armour', potion: 'gear/health-potion', sword: 'gear/sword', longsword: 'gear/longsword',
  ac: 'gear/shield', bow: 'gear/shortbow', dagger: 'gear/throwing-knives', chart: 'gear/map-item',
  protection: 'gear/magnum-protection',
};

const INK = '#2e1c10';
// Gradients: light, mid, dark.
const G = {
  gold: ['#f2cf73', '#c99a3e', '#8a6220'], red: ['#d4645a', '#a1302c', '#5e1714'],
  parch: ['#f7e9c6', '#e3c891', '#b8955a'], steel: ['#f1f3f4', '#b9c0c6', '#6f7a84'],
  wood: ['#c88c55', '#9a6235', '#5f3818'], blue: ['#86a8cf', '#4f72a0', '#2c4469'],
  purple: ['#b59ad6', '#7a5aa6', '#45306a'], green: ['#a8cf7a', '#6f9a45', '#3c5e22'],
  grey: ['#d7d4ce', '#9c978f', '#5f5a53'], storm: ['#a8a3b4', '#6f6a7e', '#423e4e'],
  skin: ['#f4c9a0', '#d99a6c', '#9c6440'], ice: ['#ffffff', '#cfe6f2', '#8fb6cc'],
};
const defs = `<defs>${Object.entries(G).map(([k, [a, b, c]]) =>
  `<linearGradient id="${k}" x1="0.15" y1="0.05" x2="0.85" y2="0.95"><stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`).join('')}</defs>`;

// Shorthands: an inked shape, a highlight stroke, a dark shade stroke.
const S = (d, fill) => `<path d="${d}" fill="url(#${fill})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
const C = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${fill})" stroke="${INK}" stroke-width="2.2"/>`;
const HI = (d, w = 2, o = 0.75) => `<path d="${d}" fill="none" stroke="#fffaf0" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
const LN = (d, w = 2, col = INK) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const F = (d, col) => `<path d="${d}" fill="${col}"/>`;

const ART = {
  // A red heart.
  hp: S('M24 41S6 30 6 17.5A9 9 0 0 1 24 12a9 9 0 0 1 18 5.5C42 30 24 41 24 41z', 'red')
    + HI('M11 15.5a5 5 0 0 1 4.5-4') + F('M24 41s14-8.7 17-19c-3 6-9 11-17 15z', 'rgba(60,10,8,0.3)'),
  // A lightning bolt.
  init: S('M28 4L9 27h11l-4 17 23-26H27l5-14z', 'gold') + HI('M26.5 7.5L14 23.5', 1.8),
  // A winged leather boot.
  speed: S('M17 6h12v17l9 4c3 1.3 4 3.4 4 6v5H16z', 'wood') + LN('M16 33h26', 2) + LN('M22 12h5M22 17h5', 1.6, '#3e2412')
    + S('M16 12c-5-1.5-10 0-13 4 4.5-.5 7.5.3 13 3z', 'parch') + S('M16 19c-4-.7-8 .4-11 3.6 4-.3 6.5.4 11 2.4z', 'parch')
    + HI('M20 9v12', 1.6, 0.5),
  // A gold star.
  prof: S('M24 4l6 12.4 13.6 2-9.8 9.5 2.3 13.5L24 35l-12.1 6.4 2.3-13.5-9.8-9.5 13.6-2z', 'gold') + HI('M20.5 17.5l3.5-7', 1.8),
  // A gold diamond.
  xp: S('M24 4l15 20-15 20L9 24z', 'gold') + LN('M9 24h30M24 4v40', 1.3, '#7a5418') + HI('M14 22.5l8-11', 1.8),
  // Strength: a clenched fist seen from the front, with a leather cuff.
  str: S('M15 36h18v9H15z', 'wood') + LN('M15 40h18', 1.4, '#3e2412')
    + S('M10 20a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v12c0 4-3 6-7 6H17c-4 0-7-2-7-6z', 'skin')
    + [10, 17, 24, 31].map((x) => S(`M${x + 3.5} 9a3.5 3.5 0 0 1 3.5 3.5V21a3.5 3.5 0 0 1-7 0v-8.5A3.5 3.5 0 0 1 ${x + 3.5} 9z`, 'skin')).join('')
    + S('M9 27.5a4 4 0 0 1 4-4h12.5a4 4 0 0 1 0 8H13a4 4 0 0 1-4-4z', 'skin')
    + [12, 19, 26, 33].map((x) => HI(`M${x} 12.5v3`, 1.6, 0.7)).join('') + HI('M13 26h9', 1.6, 0.6),
  // The Hero tab: a plain knight's helm with a red plume.
  hero: S('M24 3c4 0 8 2 8.5 6-3-1.5-5.5-1.8-8.5-1.8S18.5 7.5 15.5 9C16 5 20 3 24 3z', 'red')
    + S('M11 42V23a13 13 0 0 1 26 0v19c-4 2.5-8.5 3.5-13 3.5S15 44.5 11 42z', 'steel')
    + F('M14.5 24h19v4.5h-7V38h-5v-9.5h-7z', INK) + LN('M24 10.5v12', 1.6, '#6f7a84')
    + S('M11 39c4 2.5 8.5 3.5 13 3.5s9-1 13-3.5v3c-4 2.5-8.5 3.5-13 3.5S15 44.5 11 42z', 'gold') + HI('M15 17a10 10 0 0 1 5-4.5', 2.2, 0.85),
  // The Fight tab: two crossed swords.
  combat: [40, -40].map((r) => `<g transform="rotate(${r} 24 24)">${S('M21.8 31V9L24 3.5 26.2 9v22z', 'steel') + LN('M24 8v22', 1, '#6f7a84')
    + S('M16 30.5h16a2 2 0 0 1 0 4H16a2 2 0 0 1 0-4z', 'gold') + S('M22 34.5h4v7h-4z', 'wood') + C(24, 43.5, 2.6, 'gold')}</g>`).join(''),
  // Dexterity: an arrow.
  dex: LN('M9 39L35 13', 6) + LN('M9 39L35 13', 3, '#c79a63') + S('M35 13l-1.5-7 9.5-1.5-1.5 9.5z', 'steel')
    + S('M9 39l-3-6 4.5-2.5 4.5 3.5zM12.5 35.5L10 30l4.5-2.5 4 3.5', 'red'),
  // Constitution: a drumstick (health and stamina).
  con: S('M29 6.5a12.4 12.4 0 0 1 12 14c-.8 6-6 10.6-12 10.6l-7 7a4.2 4.2 0 1 1-6-6 4.2 4.2 0 1 1-6-6l7-7c0-6.4 5.7-12.6 12-12.6z', 'wood')
    + S('M21.8 38.8a4.2 4.2 0 1 1-6-6 4.2 4.2 0 1 1-6-6l3.2-3.2 12 12z', 'parch') + HI('M26 12.5c3-2 7-2 9 .6', 2),
  // Intelligence: an open book.
  int: S('M4 11c6.5-2 13-2 20 2 7-4 13.5-4 20-2v27c-6.5-2-13-2-20 2-7-4-13.5-4-20-2z', 'parch') + LN('M24 13v27', 2)
    + LN('M9.5 18.5c3.2-.6 6.4-.4 9.2.8M9.5 24.5c3.2-.6 6.4-.4 9.2.8M29 19.3c2.8-1.2 6-1.4 9.2-.8M29 25.3c2.8-1.2 6-1.4 9.2-.8', 1.5, '#7a5a35'),
  // Wisdom: an eye.
  wis: S('M3 24S10 12 24 12s21 12 21 12-7 12-21 12S3 24 3 24z', 'parch') + C(24, 24, 7.5, 'purple') + F('M24 21a3 3 0 1 0 .01 0z', INK)
    + `<circle cx="26.5" cy="21.5" r="1.5" fill="#fff"/>`,
  // Charisma: a speech bubble with a heart.
  cha: S('M8 7h32a3.5 3.5 0 0 1 3.5 3.5v18A3.5 3.5 0 0 1 40 32H23l-10 8.5V32H8a3.5 3.5 0 0 1-3.5-3.5v-18A3.5 3.5 0 0 1 8 7z', 'parch')
    + S('M17 18.5c.6-2.8 4.3-2.8 4.8 0 .6-2.8 4.3-2.8 4.8 0 0 2.8-4.8 5.6-4.8 5.6s-4.8-2.8-4.8-5.6z', 'red') + HI('M9.5 11.5h8', 1.8, 0.6),
  // Party: a red banner on a pole.
  party: LN('M10 4v40', 6) + LN('M10 4v40', 3, '#a8693f') + S('M12 7h28l-6.5 9.5L40 26H12z', 'red')
    + S('M23.5 11.8l1.7 3.4 3.7.5-2.7 2.6.7 3.7-3.4-1.8-3.3 1.8.6-3.7-2.6-2.6 3.7-.5z', 'gold') + `<circle cx="10" cy="4" r="3" fill="url(#gold)" stroke="${INK}" stroke-width="2"/>`,
  // The Dungeon Master: a crown.
  crown: S('M6 15l9.2 8.2L24 9l8.8 14.2L42 15l-4 23H10z', 'gold') + LN('M11 32h26', 1.6, '#7a5418')
    + C(24, 25.5, 3, 'red') + C(6, 14, 2.2, 'gold') + C(42, 14, 2.2, 'gold') + C(24, 8, 2.2, 'gold') + HI('M12.5 26l-1 6', 1.6, 0.6),
  // Magic: a sparkling star.
  magic: S('M24 5l4.2 14.8L43 24l-14.8 4.2L24 43l-4.2-14.8L5 24l14.8-4.2z', 'ice')
    + F('M24 15l2 7 7 2-7 2-2 7-2-7-7-2 7-2z', '#fff') + S('M38 5l1.6 4 4 1.6-4 1.6L38 16l-1.6-3.8-4-1.6 4-1.6z', 'purple'),
  // A leather bag.
  bag: S('M16.8 15c-6 4-9.2 11.2-9.2 17.2 0 6 5.2 8.8 16.4 8.8s16.4-2.8 16.4-8.8c0-6-3.2-13.2-9.2-17.2z', 'wood')
    + S('M16.8 15L14 6.8h20L31.2 15z', 'wood') + LN('M17 15h14', 3.2, '#e1b04a') + HI('M12.5 28c.5-3.5 2-6.5 4-8.5', 2, 0.5),
  // A gold coin.
  coin: C(24, 24, 17, 'gold') + `<circle cx="24" cy="24" r="11" fill="none" stroke="#7a5418" stroke-width="1.8"/>`
    + LN('M24 17v14M20.5 20.5h7M20.5 27.5h7', 1.8, '#7a5418') + HI('M14 16.5a12 12 0 0 1 6-4.5', 2.2),
  // A blue gem.
  gem: S('M14 8h20l8.6 10.4L24 41 5.4 18.4z', 'blue') + LN('M5.4 18.4h37.2M18 8l-2.8 10.4L24 41M30 8l2.8 10.4L24 41', 1.4) + HI('M17 11l-2 5', 2.2),
  // The sun.
  sun: LN('M24 3v6M24 39v6M3 24h6M39 24h6M9.2 9.2l4.2 4.2M34.6 34.6l4.2 4.2M9.2 38.8l4.2-4.2M34.6 13.4l4.2-4.2', 6)
    + LN('M24 3v6M24 39v6M3 24h6M39 24h6M9.2 9.2l4.2 4.2M34.6 34.6l4.2 4.2M9.2 38.8l4.2-4.2M34.6 13.4l4.2-4.2', 3, '#e8b84a')
    + C(24, 24, 10.5, 'gold') + HI('M18.5 21a6 6 0 0 1 4-4', 2.2),
  // The moon.
  moon: S('M31 5.5a18 18 0 1 0 11.6 29A14.6 14.6 0 0 1 31 5.5z', 'parch') + F('M18 20a2.4 2.4 0 1 0 .01 0zM23 31a1.8 1.8 0 1 0 .01 0zM14 30a1.4 1.4 0 1 0 .01 0z', '#c9ad78')
    + HI('M14 13a15 15 0 0 1 6-4', 2),
  // Weather.
  cloud: S('M14 37a8.5 8.5 0 0 1-1.2-16.8 11.5 11.5 0 0 1 22.2-2.6 9.6 9.6 0 0 1 .4 19.4z', 'ice') + HI('M15.5 22.5a6 6 0 0 1 4-1.8', 2, 0.9),
  rain: S('M14 27a8.2 8.2 0 0 1-1.2-16.2 11.2 11.2 0 0 1 21.6-2.6 9.4 9.4 0 0 1 .4 18.8z', 'grey')
    + LN('M16 33l-2.4 7M25 33l-2.4 7M34 33l-2.4 7', 5) + LN('M16 33l-2.4 7M25 33l-2.4 7M34 33l-2.4 7', 2.6, '#6fb3d6'),
  storm: S('M14 26.8a8.2 8.2 0 0 1-1.2-16.2 11.2 11.2 0 0 1 21.6-2.6 9.4 9.4 0 0 1 .4 18.8z', 'storm')
    + S('M25.6 23l-7.2 10.6h5.2l-2 10 8.8-12.8h-5.4l2.8-7.8z', 'gold'),
  snow: LN('M24 5v38M7.6 14.4l32.8 19.2M7.6 33.6l32.8-19.2M19 7.6L24 12.4l5-4.8M19 40.4l5-4.8 5 4.8', 6)
    + LN('M24 5v38M7.6 14.4l32.8 19.2M7.6 33.6l32.8-19.2M19 7.6L24 12.4l5-4.8M19 40.4l5-4.8 5 4.8', 3, '#e4f2fa'),
  windy: LN('M5 18h24a6 6 0 1 0-6-6M5 28h32a6 6 0 1 1-6 6M9 23h12', 6) + LN('M5 18h24a6 6 0 1 0-6-6M5 28h32a6 6 0 1 1-6 6M9 23h12', 3, '#efe5d2'),
  // A rolled scroll (a quest).
  scroll: S('M13 8.4h24v27.2a5.2 5.2 0 0 1-5.2 5.2H10.6', 'parch') + S('M10.6 40.8a5.2 5.2 0 0 0 5.2-5.2V11.2a2.8 2.8 0 0 0-5.6 0v5.2h5.6', 'parch')
    + LN('M21 17h11M21 23h11M21 29h8', 1.8, '#8a6a3a') + S('M33 34a3.4 3.4 0 1 1 .01 0z', 'red'),
  // A green tick.
  check: LN('M8 25l10 10L40 12', 9) + LN('M8 25l10 10L40 12', 5, '#7fb04f') + HI('M9.5 24.5l8 8', 1.5, 0.5),
  // A padlock.
  lock: LN('M16 21v-6a8 8 0 0 1 16 0v6', 7) + LN('M16 21v-6a8 8 0 0 1 16 0v6', 3.6, '#b9c0c6')
    + S('M9.6 20.6h28.8a3 3 0 0 1 3 3V39a3 3 0 0 1-3 3H9.6a3 3 0 0 1-3-3V23.6a3 3 0 0 1 3-3z', 'gold')
    + F('M24 27a3 3 0 0 0-1.6 5.5V36h3.2v-3.5A3 3 0 0 0 24 27z', INK) + HI('M11 25v10', 2, 0.55),
  // A map pin.
  pin: S('M24 43S11.4 30.2 11.4 20.6a12.6 12.6 0 0 1 25.2 0C36.6 30.2 24 43 24 43z', 'red') + C(24, 20.4, 4.8, 'parch') + HI('M16 16a8 8 0 0 1 4-4.5', 2),
  // A quill.
  pen: S('M41 6c-13 1.4-22.8 11.2-25.6 23.2l3.4 3.4C30.8 29.8 40.4 20 41 6z', 'parch') + LN('M41 6L17.2 31', 1.6)
    + LN('M16.8 31.2L8 40', 6) + LN('M16.8 31.2L8 40', 3, '#5f3818') + HI('M34 11c-4 2.5-8 6.5-10.5 11', 1.6, 0.8),
  // The Scene tab: a striped tent with a pennant.
  scene: LN('M24 4v8', 2.4) + S('M24.5 4.5l9 3-9 3z', 'red')
    + S('M24 11L6 40h36z', 'parch') + S('M24 11L15 40h18z', 'red') + S('M24 11l-3.5 29h7z', 'parch')
    + F('M24 26l-4.5 14h9z', INK) + LN('M3 41h42', 2.6) + HI('M21 15l-9 18', 1.6, 0.6),
  // A plus.
  plus: LN('M24 9v30M9 24h30', 9) + LN('M24 9v30M9 24h30', 5, '#f4ead8'),
};

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${SIZE}" height="${SIZE}">${defs}${inner}</svg>`;

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();

// Draws `src` (an image URL) trimmed to its pixels and centred in a SIZE square, as WebP.
async function webp(src, trim) {
  return page.evaluate(async (src, size, trim) => {
    const img = new Image(); img.src = src; await img.decode();
    const w = img.naturalWidth || size, h = img.naturalHeight || size;
    const a = new OffscreenCanvas(w, h), ac = a.getContext('2d'); ac.drawImage(img, 0, 0, w, h);
    let x0 = 0, y0 = 0, x1 = w, y1 = h;
    if (trim) {
      const d = ac.getImageData(0, 0, w, h).data; x0 = w; y0 = h; x1 = 0; y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
    }
    const cw = x1 - x0, ch = y1 - y0, s = Math.min(size / cw, size / ch);
    const c = new OffscreenCanvas(size, size), cc = c.getContext('2d');
    cc.imageSmoothingQuality = 'high';
    cc.drawImage(a, x0, y0, cw, ch, (size - cw * s) / 2, (size - ch * s) / 2, cw * s, ch * s);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: 0.92 })).arrayBuffer());
    let out = ''; for (let k = 0; k < buf.length; k += 8192) out += String.fromCharCode(...buf.subarray(k, k + 8192));
    return btoa(out);
  }, src, SIZE, trim);
}

for (const [name, file] of Object.entries(FROM_PACK)) {
  const b64 = await webp(`data:image/png;base64,${readFileSync(`${PACK}/${file}.png`).toString('base64')}`, true);
  writeFileSync(`${OUT}/${name}.webp`, Buffer.from(b64, 'base64'));
}
for (const [name, inner] of Object.entries(ART)) {
  const b64 = await webp(`data:image/svg+xml;base64,${Buffer.from(svg(inner)).toString('base64')}`, false);
  writeFileSync(`${OUT}/${name}.webp`, Buffer.from(b64, 'base64'));
}
await browser.close();
console.log(Object.keys(FROM_PACK).length + Object.keys(ART).length, 'icons in', OUT);

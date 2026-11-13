// Recolours the paper sheets so they all have the same light colour as the bar's rolled
// scroll, keeping their texture and torn edges. Reads the original PNGs from the design pack
// and writes WebP files to public/art/ui/paper/.
//   node tools/tone-paper.mjs [sourceDir]
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = process.argv[2] ?? 'hero-sheet-design-pack/public/art/ui/blank-paper-assets (1)';
const OUT = 'public/art/ui/paper';
const REFERENCE = 'rolled-scroll.png'; // the bar's colour is the target
const files = readdirSync(SRC).filter((f) => f.endsWith('.png'));

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
const load = (f) => `data:image/png;base64,${readFileSync(join(SRC, f)).toString('base64')}`;

// The average colour of the middle of a sheet (opaque pixels only, edges left out).
const meanColour = (src) => page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const { data } = x.getImageData(0, 0, img.width, img.height);
  const s = [0, 0, 0]; let n = 0;
  for (let y = Math.floor(img.height * 0.2); y < img.height * 0.8; y++) for (let xx = Math.floor(img.width * 0.2); xx < img.width * 0.8; xx++) {
    const i = (y * img.width + xx) * 4;
    if (data[i + 3] < 250) continue;
    s[0] += data[i]; s[1] += data[i + 1]; s[2] += data[i + 2]; n++;
  }
  return s.map((v) => v / n);
}, src);

const target = await meanColour(load(REFERENCE));
console.log('target colour', target.map(Math.round).join(','));

for (const f of files) {
  const mean = await meanColour(load(f));
  const b64 = await page.evaluate(async (src, mean, target, keep) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, img.width, img.height); const d = id.data;
    if (!keep) {
      // Scale each colour channel so the sheet's average lands on the target; the
      // light-dark texture stays, only the overall tone moves.
      const gain = mean.map((m, k) => target[k] / m);
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, d[i + k] * gain[k]);
      x.putImageData(id, 0, 0);
    }
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: 0.9 })).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return btoa(s);
  }, load(f), mean, target, f === REFERENCE);
  writeFileSync(join(OUT, `${basename(f, '.png')}.webp`), Buffer.from(b64, 'base64'));
  console.log(f.padEnd(20), 'was', mean.map(Math.round).join(','));
}
await browser.close();

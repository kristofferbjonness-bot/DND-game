// Converts the location postcards (public/art/places/*.jpg, made by npm run postcards) to WebP, about a
// third of the size, and removes nothing: delete the .jpg files after. Run: node tools/places-to-webp.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const dir = 'public/art/places';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.jpg'))) {
  const b64 = await p.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = new OffscreenCanvas(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: 0.82 })).arrayBuffer());
    let s = ''; for (let k = 0; k < buf.length; k += 8192) s += String.fromCharCode(...buf.subarray(k, k + 8192));
    return [btoa(s), img.width, img.height];
  }, `data:image/jpeg;base64,${readFileSync(`${dir}/${f}`).toString('base64')}`);
  writeFileSync(`${dir}/${f.replace('.jpg', '.webp')}`, Buffer.from(b64[0], 'base64'));
  console.log(f, b64[1] + 'x' + b64[2]);
}
await b.close();

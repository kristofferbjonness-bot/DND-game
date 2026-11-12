// Saves every location postcard to public/art/places/<id>.jpg.
// Needs the dev server running (npm run dev) and Google Chrome installed.
// Run: node tools/postcards/capture.mjs [id ...]   (no ids = all)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : [
  'razz', 'tine', 'bartedalen', 'kolaveri', 'hrimnir', 'ferran', 'ytterhavn', 'sirivik',
  'ikeheim', 'sortland', 'skinder', 'siris-gap', 'lama', 'rama',
];

fs.mkdirSync('public/art/places', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 750 });
page.on('pageerror', (e) => console.error('page error:', e.message));
for (const id of ids) {
  await page.goto(`${BASE}/tools/postcards/?id=${id}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const png = `public/art/places/${id}.png`;
  await (await page.$('canvas')).screenshot({ path: png });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', png, '--out', png.replace('.png', '.jpg')], { stdio: 'ignore' });
  fs.unlinkSync(png);
  console.log('saved', id);
}
await browser.close();

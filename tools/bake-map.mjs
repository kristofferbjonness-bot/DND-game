// Converts the hand-drawn world map (assets/source/world-map.png) into a voxel
// grid the game can render: land/sea, biome, height and rivers per cell.
// Run with: npm run bake
import fs from 'node:fs';
import { PNG } from 'pngjs';

const SRC = 'assets/source/world-map.png';
const OUT = 'src/data/world-grid.json';
const CELL = 5; // source pixels per voxel column

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width: PW, height: PH, data } = png;
const W = Math.floor(PW / CELL);
const H = Math.floor(PH / CELL);

const rgb = (x, y) => {
  const i = (y * PW + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

// --- Pixel classes -----------------------------------------------------------
const isDark = (c) => lum(c) < 95;
const isRiver = ([r, g, b]) => lum([r, g, b]) < 115 && b - r > 12 && g - r > 6;
// Paper plus the soft grey drop-shadow the map draws around every coastline.
// The strait between Lama and Rama is painted pale blue rather than left as
// paper, so inside that box pale blue counts as sea too. Elsewhere it would
// wash away the equally pale snowfields and icy islands.
const STRAIT_BOX = [440, 280, 610, 500];
const isParchment = ([r, g, b], x, y) => {
  const l = lum([r, g, b]);
  if (l > 192 && Math.abs(r - g) < 14 && r - b >= -2 && r - b <= 38) return true;
  const [x0, y0, x1, y1] = STRAIT_BOX;
  const inStrait = x >= x0 && x <= x1 && y >= y0 && y <= y1;
  return inStrait && l > 196 && b >= r && b - r < 40 && Math.abs(g - b) < 22;
};

// The map's handwritten region names ("Cold", "Desert", ...) would otherwise be
// read as mountain ink. Boxes are in source-image pixels: [x0, y0, x1, y1].
const TEXT_BOXES = [
  [425, 200, 492, 245], // Cold (west)
  [865, 305, 955, 350], // Cold (east)
  [482, 305, 550, 368], // mild temp
  [320, 580, 400, 620], // Tropic (west)
  [712, 525, 812, 575], // Desert
  [845, 635, 925, 675], // Tropic (east)
];
const inText = (x, y) => TEXT_BOXES.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

// --- Sea: flood fill parchment from the image border -------------------------
const sea = new Uint8Array(PW * PH);
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= PW || y >= PH) return;
  const i = y * PW + x;
  if (sea[i]) return;
  const c = rgb(x, y);
  if (isDark(c) || !isParchment(c, x, y)) return;
  sea[i] = 1;
  stack.push(i);
};
for (let x = 0; x < PW; x++) { push(x, 0); push(x, PH - 1); }
for (let y = 0; y < PH; y++) { push(0, y); push(PW - 1, y); }
while (stack.length) {
  const i = stack.pop();
  const x = i % PW, y = (i / PW) | 0;
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
}

// --- Local "paper wash" brightness, so mountain ink is found relative to it ----
// Ink on the pale snow and on the yellow desert have very different absolute
// colours, but both are clearly darker than the watercolour around them.
const cellsW = Math.floor(PW / CELL), cellsH = Math.floor(PH / CELL);
const washRaw = new Float32Array(cellsW * cellsH);
for (let cy = 0; cy < cellsH; cy++) for (let cx = 0; cx < cellsW; cx++) {
  const ls = [];
  for (let y = cy * CELL; y < (cy + 1) * CELL; y++) for (let x = cx * CELL; x < (cx + 1) * CELL; x++) {
    if (!sea[y * PW + x]) ls.push(lum(rgb(x, y)));
  }
  ls.sort((a, b) => a - b);
  washRaw[cy * cellsW + cx] = ls.length ? ls[Math.floor(ls.length * 0.8)] : 0;
}
const wash = new Float32Array(cellsW * cellsH);
for (let cy = 0; cy < cellsH; cy++) for (let cx = 0; cx < cellsW; cx++) {
  let m = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && y >= 0 && x < cellsW && y < cellsH) m = Math.max(m, washRaw[y * cellsW + x]);
  }
  wash[cy * cellsW + cx] = m;
}

// Pixel distance to the sea, so the black coastline isn't mistaken for mountains.
const seaDist = new Uint16Array(PW * PH).fill(65535);
{
  const q = [];
  for (let i = 0; i < PW * PH; i++) if (sea[i]) { seaDist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % PW, y = (i / PW) | 0, d = seaDist[i] + 1;
    if (d > 24) continue;
    for (const j of [x + 1 < PW ? i + 1 : -1, x > 0 ? i - 1 : -1, y + 1 < PH ? i + PW : -1, y > 0 ? i - PW : -1]) {
      if (j >= 0 && seaDist[j] > d) { seaDist[j] = d; q.push(j); }
    }
  }
}
const isMountainInk = (x, y, c) =>
  !inText(x, y) && seaDist[y * PW + x] > 20 && !isRiver(c) &&
  lum(c) < wash[((y / CELL) | 0) * cellsW + ((x / CELL) | 0)] - 34;

// --- Downsample into cells -----------------------------------------------------
const land = new Uint8Array(W * H);
const river = new Uint8Array(W * H);
const mtn = new Float32Array(W * H);
const inkOutline = new Uint16Array(W * H);
const fill = new Float32Array(W * H * 3);

for (let cy = 0; cy < H; cy++) {
  for (let cx = 0; cx < W; cx++) {
    let landPx = 0, riverPx = 0, mtnPx = 0, n = 0;
    let fr = 0, fg = 0, fb = 0, fn = 0;
    for (let y = cy * CELL; y < (cy + 1) * CELL; y++) {
      for (let x = cx * CELL; x < (cx + 1) * CELL; x++) {
        n++;
        if (sea[y * PW + x]) continue;
        landPx++;
        const c = rgb(x, y);
        if (inText(x, y)) { if (!isDark(c)) { fr += c[0]; fg += c[1]; fb += c[2]; fn++; } continue; }
        if (isRiver(c)) riverPx++;
        else if (isMountainInk(x, y, c)) {
          mtnPx++;
          if (isDark(c)) inkOutline[cy * W + cx]++;
        }
        else if (!isDark(c)) { fr += c[0]; fg += c[1]; fb += c[2]; fn++; }
      }
    }
    const k = cy * W + cx;
    land[k] = landPx / n > 0.5 ? 1 : 0;
    river[k] = land[k] && riverPx / n > 0.1 ? 1 : 0;
    mtn[k] = land[k] ? mtnPx / n : 0;
    if (fn) { fill[k * 3] = fr / fn; fill[k * 3 + 1] = fg / fn; fill[k * 3 + 2] = fb / fn; }
  }
}

// Mountain icons always have a black outline; darker watercolour near some
// coasts doesn't. Drop ink that has no black stroke nearby.
{
  const keep = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) n += inkOutline[ny * W + nx];
    }
    keep[y * W + x] = n >= 3 ? 1 : 0;
  }
  for (let k = 0; k < W * H; k++) if (!keep[k]) mtn[k] = 0;
}

// Cells that are land but had no clean fill pixels borrow from a neighbour.
for (let pass = 0; pass < 4; pass++) {
  for (let k = 0; k < W * H; k++) {
    if (!land[k] || fill[k * 3]) continue;
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * W + (x + dx);
      if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || !fill[j * 3]) continue;
      fill[k * 3] = fill[j * 3]; fill[k * 3 + 1] = fill[j * 3 + 1]; fill[k * 3 + 2] = fill[j * 3 + 2];
      break;
    }
  }
}

// --- Biomes from the watercolour fill -----------------------------------------
// 0 snow, 1 meadow, 2 plains, 3 desert, 4 jungle
const biome = new Uint8Array(W * H);
for (let k = 0; k < W * H; k++) {
  if (!land[k]) continue;
  const r = fill[k * 3], g = fill[k * 3 + 1], b = fill[k * 3 + 2];
  if (b > r + 6) biome[k] = 0;
  else if (r - b > 62) biome[k] = 3;
  else if (g - r > 7) biome[k] = 4;
  else if (g >= r - 2) biome[k] = 1;
  else biome[k] = 2;
}

// The pale wash just inside many coastlines reads as "snow". Real snowfields
// are large, so snow cells with few snowy neighbours take their neighbours' biome.
for (let pass = 0; pass < 3; pass++) {
  const next = biome.slice();
  for (let k = 0; k < W * H; k++) {
    if (!land[k] || biome[k] !== 0) continue;
    const x = k % W, y = (k / W) | 0, votes = [0, 0, 0, 0, 0];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && land[ny * W + nx]) votes[biome[ny * W + nx]]++;
    }
    if (votes[0] >= 12) continue;
    votes[0] = 0;
    const best = votes.indexOf(Math.max(...votes));
    if (votes[best] > 0) next[k] = best;
  }
  biome.set(next);
}

// --- Distance fields (BFS) -----------------------------------------------------
function distanceFrom(isSource) {
  const d = new Float32Array(W * H).fill(Infinity);
  const q = [];
  for (let k = 0; k < W * H; k++) if (isSource(k)) { d[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (d[j] > d[k] + 1) { d[j] = d[k] + 1; q.push(j); }
    }
  }
  return d;
}
const distToSea = distanceFrom((k) => !land[k]);
const distToLand = distanceFrom((k) => land[k]);

// --- Mountain height: blurred ink density ------------------------------------
function blur(src, radius) {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const w = 1 - Math.hypot(dx, dy) / (radius + 1);
      if (w <= 0) continue;
      s += src[ny * W + nx] * w; n += w;
    }
    out[y * W + x] = s / n;
  }
  return out;
}
const ridge = blur(mtn, 2);
const massif = blur(mtn, 5);

// Mountain outlines on the snowy island share the rivers' blue-grey ink, so a
// "river" deep inside a mountain range is treated as mountain instead.
for (let k = 0; k < W * H; k++) if (river[k] && ridge[k] > 0.12) river[k] = 0;

// Smooth biomes with a 3x3 majority vote to remove speckle along coastlines.
for (let pass = 0; pass < 2; pass++) {
  const next = biome.slice();
  for (let k = 0; k < W * H; k++) {
    if (!land[k]) continue;
    const x = k % W, y = (k / W) | 0, votes = [0, 0, 0, 0, 0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && land[ny * W + nx]) votes[biome[ny * W + nx]]++;
    }
    const best = votes.indexOf(Math.max(...votes));
    if (votes[best] >= 5) next[k] = best;
  }
  biome.set(next);
}

// Deterministic hash noise so the bake is reproducible.
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// Heights are in voxel layers (each layer is half a unit tall in the game).
const height = new Int8Array(W * H);
for (let k = 0; k < W * H; k++) {
  const x = k % W, y = (k / W) | 0;
  if (!land[k]) {
    height[k] = -Math.min(1 + Math.floor(distToLand[k] / 2), 4);
    continue;
  }
  if (river[k]) { height[k] = 0; continue; }
  const inland = Math.min(distToSea[k], 8) * 0.35;
  const peaks = Math.min(ridge[k] * 30 + massif[k] * 24, 13);
  const jitter = hash(x, y) * 0.9;
  height[k] = Math.max(1, Math.round(1 + inland + peaks + jitter));
}

// --- Write --------------------------------------------------------------------
const b64 = (arr) => Buffer.from(arr.buffer).toString('base64');
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  cols: W, rows: H, cell: CELL, sourceWidth: PW, sourceHeight: PH,
  land: b64(land), river: b64(river), biome: b64(biome), heights: b64(height),
}));

const count = (a) => a.reduce((s, v) => s + (v ? 1 : 0), 0);
const biomes = [0, 0, 0, 0, 0];
for (let k = 0; k < W * H; k++) if (land[k]) biomes[biome[k]]++;
console.log(`${W}x${H} grid, ${count(land)} land cells, ${count(river)} river cells`);
console.log(`biomes snow/meadow/plains/desert/jungle: ${biomes.join('/')}`);
console.log(`max height ${Math.max(...height)} layers`);

// Debug preview: top-down PNG of the bake for a quick sanity check.
const PAL = [[235, 242, 247], [126, 190, 92], [190, 196, 120], [232, 204, 130], [64, 150, 70]];
const prev = new PNG({ width: W, height: H });
for (let k = 0; k < W * H; k++) {
  let c;
  if (!land[k]) c = [70, 140, 190 + height[k] * 10];
  else if (river[k]) c = [60, 120, 200];
  else {
    const shade = 0.75 + Math.min(height[k], 20) * 0.025;
    c = PAL[biome[k]].map((v) => Math.min(255, v * shade));
    if (height[k] > 9) c = [150, 140, 130].map((v) => v + height[k] * 3);
  }
  prev.data.set([...c, 255], k * 4);
}
fs.mkdirSync('tools/out', { recursive: true });
fs.writeFileSync('tools/out/bake-preview.png', PNG.sync.write(prev));

if (process.env.DEBUG_INK) {
  const dbg = new PNG({ width: W, height: H });
  for (let k = 0; k < W * H; k++) {
    const v = Math.min(255, mtn[k] * 600);
    dbg.data.set(land[k] ? [v, v, 255 - v, 255] : [0, 0, 0, 255], k * 4);
  }
  fs.writeFileSync('tools/out/ink.png', PNG.sync.write(dbg));
}

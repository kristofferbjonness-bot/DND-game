// Loads the baked world grid (see tools/bake-map.mjs) and answers questions
// about it: what's at a cell, where a map pixel lands in the 3D world, etc.
import raw from '../data/world-grid.json';

export const LAYER = 0.5;       // height of one voxel layer in world units
export const WATER_LEVEL = 0.2; // sits between layer 0 (rivers) and layer 1 (land)

export const BIOME = { SNOW: 0, MEADOW: 1, PLAINS: 2, DESERT: 3, JUNGLE: 4 };

const decode = (b64, Type) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Type(bytes.buffer);
};

export const grid = {
  cols: raw.cols,
  rows: raw.rows,
  cell: raw.cell,
  land: decode(raw.land, Uint8Array),
  river: decode(raw.river, Uint8Array),
  biome: decode(raw.biome, Uint8Array),
  heights: decode(raw.heights, Int8Array),
};

const { cols, rows } = grid;

// Great peaks raised on top of the baked land (heights in layers; the highest painted peak is 18):
//   Fjellene av Ferran's volcano, with a crater of lava, and the blue ice mountain on the snowy island
//   north of Bartedalen: the tallest point in the world.
export const PEAKS = [
  { id: 'ferran', kind: 'volcano', cx: 76, cz: 59, r: 9, top: 38, crater: 2.2 },
  { id: 'ice', kind: 'ice', cx: 190, cz: 14, r: 8, top: 92 },
];
for (const p of PEAKS) {
  const rim = Math.round(p.top * (1 - (p.crater ?? 0) / p.r) ** 1.3);
  for (let z = Math.floor(p.cz - p.r); z <= p.cz + p.r; z++) for (let x = Math.floor(p.cx - p.r); x <= p.cx + p.r; x++) {
    if (x < 0 || z < 0 || x >= cols || z >= rows || !grid.land[z * cols + x]) continue;
    const d = Math.hypot(x - p.cx, z - p.cz), t = 1 - d / p.r;
    if (t <= 0) continue;
    let h;
    if (p.kind === 'volcano') h = d < p.crater ? rim - 4 : p.top * t ** 1.3 + (hash(x, z, 81) - 0.5) * 1.5;
    else h = p.top * t ** 1.15 + (hash(x, z, 82) - 0.5) * 6 * t + Math.max(0, Math.sin(Math.atan2(z - p.cz, x - p.cx) * 4)) * 6 * t; // a sharp, thin spire
    const k = z * cols + x;
    grid.heights[k] = Math.max(grid.heights[k], Math.min(120, Math.round(h)));
    grid.river[k] = 0;
  }
}
// The cells of Rama (the eastern continent), found from its label: its mountains carry far less snow.
export const onRama = (() => {
  const out = new Uint8Array(cols * rows);
  const q = [Math.floor(493 / grid.cell) * cols + Math.floor(870 / grid.cell)];
  while (q.length) {
    const k = q.pop();
    if (out[k] || !grid.land[k]) continue;
    out[k] = 1;
    const x = k % cols;
    if (x > 0) q.push(k - 1);
    if (x < cols - 1) q.push(k + 1);
    if (k >= cols) q.push(k - cols);
    if (k < cols * (rows - 1)) q.push(k + cols);
  }
  return out;
})();

// Which great peak (if any) a cell belongs to: { kind, d (distance from the middle), t (0 edge – 1 middle) }.
export function peakAt(x, z) {
  for (const p of PEAKS) {
    const d = Math.hypot(x - p.cx, z - p.cz);
    if (d < p.r) return { kind: p.kind, d, t: 1 - d / p.r, crater: d < (p.crater ?? 0) };
  }
  return null;
}

export const inBounds = (x, z) => x >= 0 && z >= 0 && x < cols && z < rows;
export const idx = (x, z) => z * cols + x;
export const heightAt = (x, z) => (inBounds(x, z) ? grid.heights[idx(x, z)] : -4);

// Cell <-> world. The map is centred on the origin, one cell per world unit.
export const cellToWorld = (x, z) => [x - cols / 2 + 0.5, z - rows / 2 + 0.5];
export const worldToCell = (wx, wz) => [Math.floor(wx + cols / 2), Math.floor(wz + rows / 2)];
export const pixelToCell = ([px, py]) => [Math.floor(px / grid.cell), Math.floor(py / grid.cell)];

// Dark forests: dense, grey, gloomy woods (Sortland, under its mist). Centre in map pixels,
// radius in cells. `darkForest` is 1 deep inside and fades to 0 over `fade` cells at the
// edge (with a little noise), so the woods turn dark gradually.
const DARK_FORESTS = [{ px: [595, 492], r: 9, fade: 6 }];
export function darkForest(x, z) {
  let best = 0;
  for (const { px, r, fade } of DARK_FORESTS) {
    const [cx, cz] = pixelToCell(px);
    const d = Math.hypot(x - cx, z - cz) + (hash(x, z, 77) - 0.5) * 2.5;
    best = Math.max(best, Math.min(1, Math.max(0, (r + fade / 2 - d) / fade)));
  }
  return best;
}

// Number of cells to the nearest sea cell (0 for sea).
export const distToSea = (() => {
  const d = new Uint16Array(cols * rows).fill(65535);
  const q = [];
  for (let k = 0; k < cols * rows; k++) if (!grid.land[k]) { d[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % cols, z = (k / cols) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!inBounds(nx, nz)) continue;
      const j = idx(nx, nz);
      if (d[j] > d[k] + 1) { d[j] = d[k] + 1; q.push(j); }
    }
  }
  return d;
})();

// Nearest land cell to (x, z), searching outward in rings. Used to snap
// location markers that sit right on a drawn coastline.
export function nearestLand(x, z, maxR = 8) {
  if (inBounds(x, z) && grid.land[idx(x, z)] && !grid.river[idx(x, z)]) return [x, z];
  for (let r = 1; r <= maxR; r++) {
    let best = null, bestD = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const nx = x + dx, nz = z + dz;
      if (!inBounds(nx, nz)) continue;
      const k = idx(nx, nz);
      if (!grid.land[k] || grid.river[k]) continue;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = [nx, nz]; }
    }
    if (best) return best;
  }
  return [x, z];
}

// Small deterministic hash -> [0, 1). Same input always gives the same value,
// so trees and colour variation don't change between reloads.
export function hash(x, z, seed = 0) {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

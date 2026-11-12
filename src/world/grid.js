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

export const inBounds = (x, z) => x >= 0 && z >= 0 && x < cols && z < rows;
export const idx = (x, z) => z * cols + x;
export const heightAt = (x, z) => (inBounds(x, z) ? grid.heights[idx(x, z)] : -4);

// Cell <-> world. The map is centred on the origin, one cell per world unit.
export const cellToWorld = (x, z) => [x - cols / 2 + 0.5, z - rows / 2 + 0.5];
export const worldToCell = (wx, wz) => [Math.floor(wx + cols / 2), Math.floor(wz + rows / 2)];
export const pixelToCell = ([px, py]) => [Math.floor(px / grid.cell), Math.floor(py / grid.cell)];

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

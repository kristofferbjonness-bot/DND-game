// Roads on the world map, found over the land with A* (so they go round mountains and the sea, and
// ford rivers where they must). Road cells get a dirt colour on the terrain, keep clear of trees,
// and where a road crosses a river a little plank bridge is built (see main.js).
//   - an old, unkept dirt road from Razz of Mataz to Ikeheim and on to the Empire of Tine, with a
//     fork to Sirivik;
//   - a gravel road from the mine in the mountains to Bartedalen.
import { grid, idx, inBounds, hash, darkForest } from './grid.js';
import { LOCATIONS } from './locations.js';

export const MINE = { cx: 165, cz: 86 }; // the mine's mouth, in the mountain corner south-east of Bartedalen
// A flat yard cut into the mountainside round the mine, so its buildings stand on level ground.
{
  const yard = grid.heights[idx(MINE.cx, MINE.cz)];
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    if (Math.hypot(dx, dz) > 2.6 || !inBounds(MINE.cx + dx, MINE.cz + dz)) continue;
    const k = idx(MINE.cx + dx, MINE.cz + dz);
    if (grid.land[k] && grid.heights[k] > yard) grid.heights[k] = yard;
  }
}

const cellOf = (id) => { const p = LOCATIONS.find((l) => l.id === id).px; return [Math.floor(p[0] / grid.cell), Math.floor(p[1] / grid.cell)]; };

// Cost of stepping onto a cell (Infinity = can't): flat land is cheap; slopes, mountains,
// rivers (fords) and the dark forest cost more.
function cost(k, from) {
  if (!grid.land[k]) return Infinity;
  const h = grid.heights[k];
  let c = 1 + Math.abs(h - grid.heights[from]) * 3;
  if (h >= 7) c += 10 + (h - 7) * 2;
  if (grid.river[k]) c += 6;
  return c;
}

// A* from cell a to cell b; returns a list of cell indexes, or [] if there is no way.
function route([ax, az], [bx, bz]) {
  const start = idx(ax, az), goal = idx(bx, bz), n = grid.cols * grid.rows;
  const g = new Float32Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const heap = [[0, start]];
  g[start] = 0;
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [, k] = pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === goal) break;
    const x = k % grid.cols, z = (k / grid.cols) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!inBounds(nx, nz)) continue;
      const j = idx(nx, nz);
      if (done[j]) continue;
      const c = j === goal ? 1 : cost(j, k);
      if (!Number.isFinite(c) || g[k] + c >= g[j]) continue;
      g[j] = g[k] + c;
      came[j] = k;
      push(g[j] + Math.hypot(nx - bx, nz - bz), j);
    }
  }
  if (came[goal] < 0) return [];
  const path = [];
  for (let k = goal; k !== -1; k = came[k]) path.push(k);
  return path.reverse();
}

// road[k]: 0 none, 1 old dirt road, 2 the mine's gravel road.
export const road = new Uint8Array(grid.cols * grid.rows);
export const crossings = []; // [cx, cz, along x?] where a road crosses a river: bridges

function lay(path, kind) {
  path.forEach((k, i) => {
    if (!road[k]) road[k] = kind;
    if (grid.river[k]) {
      const prev = path[i - 1] ?? k, next = path[i + 1] ?? k;
      crossings.push([k % grid.cols, (k / grid.cols) | 0, Math.abs((next % grid.cols) - (prev % grid.cols)) > 0]);
    }
  });
}
{
  const razz = cellOf('razz'), ikeheim = cellOf('ikeheim'), tine = cellOf('tine'), sirivik = cellOf('sirivik');
  const main1 = route(razz, ikeheim), main2 = route(ikeheim, tine);
  lay(main1, 1); lay(main2, 1);
  // The fork to Sirivik leaves the road where it passes closest.
  const [sx, sz] = sirivik;
  const fork = [...main1, ...main2].reduce((best, k) => {
    const d = Math.hypot((k % grid.cols) - sx, ((k / grid.cols) | 0) - sz);
    return d < best[0] ? [d, k] : best;
  }, [Infinity, -1])[1];
  if (fork >= 0) lay(route([fork % grid.cols, (fork / grid.cols) | 0], sirivik), 1);
  lay(route([MINE.cx, MINE.cz], cellOf('bartedalen')), 2);
}

// How a road cell looks: 0 = no road; otherwise how much of the road colour shows (an old road is
// patchy and grown over).
export function roadAt(x, z) {
  const r = road[idx(x, z)];
  if (!r) return 0;
  if (r === 2) return 0.95;
  return hash(x, z, 89) > 0.8 ? 0.6 : 0.92 - darkForest(x, z) * 0.25;
}

// Razz of Mataz as a detailed voxel city: a real maze of streets around the
// central plateau, the harbour, and the places from the campaign.
// Coordinates are voxels: x runs west -> east, z runs north -> south.
// The sea is to the south and east; the city walls guard the north and west.
import { Vox, hash, noise, house, person, boat, flag, shade } from './vox.js';

const S = 104;          // city size in voxels
const STEP = 6;         // maze grid: 2-wide streets every 6 voxels
const G = 2;            // street level (top of the ground)
const PLATEAU_Y = 9;    // top of the central plateau
const PLAZA = { x: 50, z: 44, r: 13 };
const SQUARE = [43, 37, 57, 51]; // the big square building on the plateau [x0, z0, x1, z1)

// Hand-placed areas the maze must leave free.
const ZONES = {
  wolf: [9, 56, 33, 76],
  hideout: [5, 5, 25, 23],
  kvini: [69, 29, 79, 39],
  gate: [3, 34, 10, 44],
  habibi: [76, 67, 88, 77],
};
const inZone = (x, z, [x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1;

const SAND = ['#e3c08f', '#d9b07a', '#ecd3a6', '#cfa46d', '#e8c99a', '#dcb886'];
const CLOTH = ['#c9473d', '#3a7d8c', '#d9a23a', '#7b3f8f', '#4f8a3a', '#e07b39', '#2f5d9e'];
const STONE = (x, y, z) => (hash(x, y, z) > 0.5 ? '#cba371' : '#c19663');
const HOOKNOSE = '#3b3a7a';

// 3x5 voxel letters for signs.
const FONT = {
  W: ['101', '101', '101', '111', '101'], O: ['111', '101', '101', '101', '111'],
  L: ['100', '100', '100', '100', '111'], F: ['111', '100', '110', '100', '100'],
  K: ['101', '101', '110', '101', '101'], V: ['101', '101', '101', '101', '010'],
  I: ['111', '010', '010', '010', '111'], N: ['111', '101', '101', '101', '101'],
  T: ['111', '010', '010', '010', '010'], H: ['101', '101', '111', '101', '101'],
  E: ['111', '100', '110', '100', '111'],
};
// Writes text on a wall facing +z (the camera side), left to right along +x.
function sign(v, text, x, y, z, colour) {
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') { cx += 2; continue; }
    FONT[ch].forEach((row, r) => [...row].forEach((bit, c) => {
      if (bit === '1') v.set(cx + c, y + 4 - r, z, colour);
    }));
    cx += 4;
  }
}

export function buildRazz() {
  const v = new Vox(S, { corner: 12 });

  // --- Land and sea ---------------------------------------------------------
  const sea = (x, z) => {
    const n = noise(x, z, 7, 40) * 4;
    if (x > 88 + n || z > 86 + n) return true;
    return x > 62 && z > 58 && Math.hypot(x - 62, z - 58) > 25 + n;
  };
  const seaNear = (x, z, r) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (sea(x + dx, z + dz)) return true;
    return false;
  };
  const onPlateau = (x, z) => Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r;
  const isWall = (x, z) => (x < 3 || z < 3) && !sea(x, z);
  const promenade = (x, z) => !sea(x, z) && seaNear(x, z, 4);

  // Stairs down from the plateau in four directions.
  const stairs = new Map();
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 0; i < 9; i++) for (let w = -1; w <= 1; w++) {
      const d = PLAZA.r - 1 + i;
      const x = PLAZA.x + dx * d + (dz ? w : 0);
      const z = PLAZA.z + dz * d + (dx ? w : 0);
      stairs.set(`${x},${z}`, Math.max(G, PLATEAU_Y - i));
    }
  }

  // --- The maze ---------------------------------------------------------------
  // Nodes sit on a grid; a randomised depth-first search links neighbours with
  // 2-wide streets, then a few extra links add loops. Areas left over become
  // houses, so every street is part of one connected, confusing maze.
  const street = new Uint8Array(S * S);
  const reserved = (x, z) =>
    sea(x, z) || isWall(x, z) || onPlateau(x, z) || Object.values(ZONES).some((zn) => inZone(x, z, zn));
  const nodes = Math.floor((S - 4) / STEP);
  const nodePos = (i) => 3 + i * STEP;
  const nodeOk = (i, j) => {
    const x = nodePos(i), z = nodePos(j);
    return v.inside(x, z) && v.inside(x + 1, z + 1) && !sea(x, z) && !sea(x + 1, z + 1) && !isWall(x, z) && !onPlateau(x, z);
  };
  const carve = (x0, z0, x1, z1) => {
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
      if (x >= 0 && z >= 0 && x < S && z < S && !sea(x, z) && !isWall(x, z)) street[z * S + x] = 1;
    }
  };
  const seen = new Set();
  let seed = 1;
  const rand = () => hash(seed++, 7, 41);
  for (let si = 0; si < nodes; si++) for (let sj = 0; sj < nodes; sj++) {
    if (!nodeOk(si, sj) || seen.has(`${si},${sj}`)) continue;
    const stack = [[si, sj]];
    seen.add(`${si},${sj}`);
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([di, dj]) => [i + di, j + dj])
        .filter(([a, b]) => a >= 0 && b >= 0 && a < nodes && b < nodes && nodeOk(a, b) && !seen.has(`${a},${b}`));
      if (!options.length) { stack.pop(); continue; }
      const [a, b] = options[Math.floor(rand() * options.length)];
      seen.add(`${a},${b}`);
      carve(Math.min(nodePos(i), nodePos(a)), Math.min(nodePos(j), nodePos(b)), Math.max(nodePos(i), nodePos(a)) + 2, Math.max(nodePos(j), nodePos(b)) + 2);
      stack.push([a, b]);
    }
  }
  // Extra loops so the maze has more than one way round.
  for (let i = 0; i < nodes - 1; i++) for (let j = 0; j < nodes - 1; j++) {
    if (!nodeOk(i, j)) continue;
    if (hash(i, j, 42) < 0.12 && nodeOk(i + 1, j)) carve(nodePos(i), nodePos(j), nodePos(i + 1) + 2, nodePos(j) + 2);
    if (hash(i, j, 43) < 0.12 && nodeOk(i, j + 1)) carve(nodePos(i), nodePos(j), nodePos(i) + 2, nodePos(j + 1) + 2);
  }
  // Streets that reach the plateau stairs, the gate and the harbour.
  for (const [x, z] of [...stairs.keys()].map((k) => k.split(',').map(Number))) carve(x - 1, z - 1, x + 2, z + 2);
  carve(3, 37, 16, 41);
  // Short streets up to the front doors of the hand-built places.
  carve(25, 17, 30, 19);   // hideout opening
  carve(19, 76, 23, 81);   // The Wolf's yard
  carve(14, 52, 17, 56);   // The Wolf's back entrance
  carve(72, 39, 75, 43);   // Kvini
  // Hooknose Alley: a single-voxel cut from the harbour toward the plateau.
  for (let z = 57; z < 80; z++) street[z * S + 61] = 1;

  const isStreet = (x, z) => street[z * S + x] === 1;
  const isBuilding = (x, z) =>
    v.inside(x, z) && !reserved(x, z) && !isStreet(x, z) && !promenade(x, z) && !stairs.has(`${x},${z}`);

  // --- Ground -------------------------------------------------------------------
  v.ground({
    waterLevel: 0,
    bottom: -4,
    heightAt: (x, z) => {
      if (sea(x, z)) return -2 - Math.floor(noise(x, z, 5, 44) * 2);
      if (onPlateau(x, z)) return PLATEAU_Y;
      return stairs.get(`${x},${z}`) ?? G;
    },
    top: (x, z, h) => {
      if (h === PLATEAU_Y && onPlateau(x, z)) return (x + z) % 2 ? '#e4c592' : '#dcb983';
      if (promenade(x, z)) return (x + z) % 3 ? '#efe3c6' : '#e3d4b2';
      if (stairs.has(`${x},${z}`)) return '#d8b583';
      return hash(x, z, 45) > 0.5 ? '#d9c08f' : '#d2b884';
    },
    side: (x, z, y, h) => (onPlateau(x, z) || stairs.has(`${x},${z}`) ? STONE(x, y, z) : '#bf9a6a'),
    bed: (x, z, h) => (h >= -2 ? '#e8d6a0' : '#8fd0c9'),
  });

  // --- Houses -------------------------------------------------------------------
  // Each maze block gets its own height and colour; edges get a lighter,
  // bowed parapet; walls facing a street get windows, doors and awnings.
  const blockOf = (x, z) => [Math.floor((x - 3) / STEP), Math.floor((z - 3) / STEP)];
  const heightOf = (x, z) => {
    const [bx, bz] = blockOf(x, z);
    const half = (x - 3) % STEP < 3 ? 0 : 1;
    return 3 + Math.floor(hash(bx * 2 + half, bz, 46) * 6);
  };
  const colourOf = (x, z) => {
    const [bx, bz] = blockOf(x, z);
    const half = (x - 3) % STEP < 3 ? 0 : 1;
    return SAND[Math.floor(hash(bx * 2 + half, bz, 47) * SAND.length)];
  };
  for (let x = 0; x < S; x++) for (let z = 0; z < S; z++) {
    if (!isBuilding(x, z)) continue;
    const h = heightOf(x, z), c = colourOf(x, z);
    v.box(x, G + 1, z, x + 1, G + 1 + h, z + 1, c);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !isBuilding(x + dx, z + dz) || heightOf(x + dx, z + dz) !== h);
    if (edge && hash(x, z, 48) > 0.25) v.set(x, G + 1 + h, z, shade(c, 1.07));
  }
  // Facades.
  for (let x = 0; x < S; x++) for (let z = 0; z < S; z++) {
    if (!isBuilding(x, z)) continue;
    const h = heightOf(x, z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!(isStreet(nx, nz) || promenade(nx, nz))) continue;
      const r = hash(x, z, 49 + dx * 3 + dz);
      if (h >= 3 && (x + z) % 3 === 0) {
        if (r > 0.8) v.light(x, G + h - 1, z, '#ffd27a');
        else v.set(x, G + h - 1, z, '#5a4632');
      }
      if (r < 0.06) { v.set(x, G + 1, z, '#6b4a2e'); v.set(x, G + 2, z, '#6b4a2e'); }
      if (r > 0.93 && h >= 3) v.set(nx, G + 3, nz, CLOTH[Math.floor(r * 100) % CLOTH.length]);
      if (r > 0.6 && r < 0.62) { v.light(nx, G + 4, nz, '#ffb54d'); }
    }
  }
  // Rooftop life: rugs drying, water jars, potted plants and washing lines.
  for (let bx = 0; bx < nodes; bx++) for (let bz = 0; bz < nodes; bz++) {
    const x = nodePos(bx) + 3, z = nodePos(bz) + 3;
    if (!isBuilding(x, z) || !isBuilding(x + 1, z + 1) || heightOf(x, z) !== heightOf(x + 1, z + 1)) continue;
    const top = G + 1 + heightOf(x, z);
    const r = hash(bx, bz, 50);
    if (r < 0.3) v.box(x, top, z, x + 2, top + 1, z + 1, CLOTH[bx % CLOTH.length]);
    else if (r < 0.5) { v.set(x, top, z, '#a5623a'); v.set(x + 1, top, z, '#a5623a'); }
    else if (r < 0.65) { v.set(x, top, z, '#8a5a34'); v.set(x, top + 1, z, '#4f9a45'); }
  }
  for (let i = 0; i < 70; i++) {
    const x = 4 + Math.floor(hash(i, 1, 51) * (S - 8)), z = 4 + Math.floor(hash(i, 2, 51) * (S - 8));
    if (!isStreet(x, z)) continue;
    const across = isBuilding(x + 1, z) || isBuilding(x - 1, z) ? [1, 0] : [0, 1];
    const y = G + 4;
    for (let k = -1; k <= 2; k++) {
      const lx = x + across[0] * k, lz = z + across[1] * k;
      if (isStreet(lx, lz)) v.set(lx, y, lz, k % 2 ? '#f2ecdf' : CLOTH[(i + k + 3) % CLOTH.length]);
    }
  }

  // --- City walls and the gate -------------------------------------------------------
  for (let x = 0; x < S; x++) for (let z = 0; z < S; z++) {
    if (!v.inside(x, z) || !isWall(x, z)) continue;
    if (z >= 37 && z < 41 && x < 3) continue; // gate opening
    v.box(x, G + 1, z, x + 1, G + 10, z + 1, STONE);
    if ((x + z) % 2 === 0) v.set(x, G + 10, z, '#c19663');
  }
  for (let t = 10; t < S - 12; t += 16) {
    for (const [x, z] of [[0, t], [t, 0]]) {
      if (!v.inside(x, z) || sea(x, z)) continue;
      v.box(x, G + 1, z, x + 4, G + 14, z + 4, STONE);
      for (let i = 0; i < 4; i += 2) { v.set(x + i, G + 14, z, '#c19663'); v.set(x + i, G + 14, z + 3, '#c19663'); }
    }
  }
  // Gate: an arch over the opening with towers either side.
  v.box(0, G + 1, 33, 4, G + 15, 37, STONE);
  v.box(0, G + 1, 41, 4, G + 15, 45, STONE);
  v.box(0, G + 7, 37, 3, G + 10, 41, STONE);
  flag(v, 1, G + 15, 34, '#7b3f8f', { height: 4 });
  flag(v, 1, G + 15, 42, '#7b3f8f', { height: 4 });
  // Guides waiting for customers just inside the gate.
  for (let i = 0; i < 4; i++) person(v, 5 + (i % 2) * 2, G, 36 + i * 2, CLOTH[(i + 2) % CLOTH.length], { hat: '#f2ecdf' });

  // --- The plateau, plaza and the square building ------------------------------------
  const [sx0, sz0, sx1, sz1] = SQUARE;
  const top = PLATEAU_Y + 15;
  v.box(sx0, PLATEAU_Y + 1, sz0, sx1, top, sz1, (x, y, z) => (hash(x, y, z) > 0.6 ? '#dcb886' : '#d8b583'));
  v.box(sx0 - 1, top, sz0 - 1, sx1 + 1, top + 1, sz1 + 1, '#c9a674');
  for (let i = sx0 - 1; i <= sx1; i += 2) { v.set(i, top + 1, sz0 - 1, '#c9a674'); v.set(i, top + 1, sz1, '#c9a674'); }
  for (let i = sz0 - 1; i <= sz1; i += 2) { v.set(sx0 - 1, top + 1, i, '#c9a674'); v.set(sx1, top + 1, i, '#c9a674'); }
  for (const y of [PLATEAU_Y + 5, PLATEAU_Y + 9, PLATEAU_Y + 13]) {
    for (let i = sx0 + 1; i < sx1 - 1; i += 2) { v.light(i, y, sz1 - 1, '#ffcf73'); v.light(i, y, sz0, '#ffcf73'); }
    for (let i = sz0 + 1; i < sz1 - 1; i += 2) { v.light(sx1 - 1, y, i, '#ffcf73'); v.light(sx0, y, i, '#ffcf73'); }
  }
  v.box(48, PLATEAU_Y + 1, sz1 - 1, 52, PLATEAU_Y + 6, sz1, '#5a4632');
  for (let y = PLATEAU_Y + 7; y < PLATEAU_Y + 13; y++) for (let i = 46; i < 54; i++) v.set(i, y, sz1, i % 2 ? '#7b3f8f' : '#8d4fa1');
  // The roof terrace on the top floor.
  const ry = top + 1;
  v.box(sx0 + 1, top, sz0 + 1, sx1 - 1, top + 1, sz1 - 1, (x, y, z) => ((x + z) % 2 ? '#e4c592' : '#d9b07a'));
  v.box(sx0 + 2, ry, sz0 + 2, sx0 + 5, ry + 3, sz0 + 5, '#d8b583'); // stair house
  v.set(sx0 + 4, ry, sz0 + 5, '#5a4632'); v.set(sx0 + 4, ry + 1, sz0 + 5, '#5a4632');
  v.box(47, ry - 1, 42, 53, ry, 47, '#9a2f2f'); // a large rug
  v.box(48, ry - 1, 43, 52, ry, 46, '#c9473d');
  v.box(49, ry, 44, 51, ry + 1, 45, '#8a6440'); // low table
  for (const [x, z] of [[46, 44], [54, 45], [50, 48]]) { v.set(x, ry, z, '#7b3f8f'); }
  v.set(50, ry + 1, 44, '#ffd27a');
  for (let y = ry; y < ry + 5; y++) v.set(sx1 - 3, y, sz1 - 3, '#6b4a2e'); // parasol
  v.box(sx1 - 6, ry + 5, sz1 - 6, sx1, ry + 6, sz1, (x, y, z) => ((x + z) % 2 ? '#d9a23a' : '#c9473d'));
  for (const [x, z] of [[sx0 + 1, sz1 - 2], [sx1 - 2, sz0 + 1], [sx1 - 2, sz0 + 6]]) { v.set(x, ry, z, '#a5623a'); v.set(x, ry + 1, z, '#4f9a45'); v.set(x, ry + 2, z, '#5fae48'); }
  for (const [x, z] of [[sx0 + 1, sz0 + 7], [sx0 + 7, sz0 + 1], [sx1 - 2, sz1 - 8]]) { v.set(x, ry, z, '#5b4a3a'); v.light(x, ry + 1, z, '#ffb54d'); }
  person(v, 52, top, 43, '#2b2833');
  flag(v, 50, top + 1, 39, '#7b3f8f', { height: 6, width: 4 });

  // Market stalls, lanterns and crowds around the plaza.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const x = Math.round(PLAZA.x + Math.cos(a) * 10), z = Math.round(PLAZA.z + Math.sin(a) * 10);
    if (inZone(x, z, [sx0 - 1, sz0 - 1, sx1 + 1, sz1 + 1])) continue;
    v.box(x, PLATEAU_Y + 1, z, x + 2, PLATEAU_Y + 2, z + 2, '#8a6440');
    v.box(x - 1, PLATEAU_Y + 3, z - 1, x + 3, PLATEAU_Y + 4, z + 3, CLOTH[i % CLOTH.length]);
    v.set(x - 1, PLATEAU_Y + 1, z - 1, '#6b4a2e'); v.set(x - 1, PLATEAU_Y + 2, z - 1, '#6b4a2e');
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = Math.round(PLAZA.x + Math.cos(a) * 12), z = Math.round(PLAZA.z + Math.sin(a) * 12);
    if (stairs.has(`${x},${z}`)) continue;
    v.set(x, PLATEAU_Y + 1, z, '#5b4a3a'); v.set(x, PLATEAU_Y + 2, z, '#5b4a3a'); v.light(x, PLATEAU_Y + 3, z, '#ffb54d');
  }
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 1, 52) * Math.PI * 2, r = 8 + hash(i, 2, 52) * 3.5;
    const x = Math.round(PLAZA.x + Math.cos(a) * r), z = Math.round(PLAZA.z + Math.sin(a) * r);
    if (!v.has(x, PLATEAU_Y + 1, z) && !v.has(x, PLATEAU_Y + 2, z)) person(v, x, PLATEAU_Y, z, CLOTH[i % CLOTH.length]);
  }

  // --- The Wolf: half luxury brothel, half gym ------------------------------------------
  {
    const [x0, z0, x1, z1] = ZONES.wolf;
    const red = (x, y, z) => (hash(x, y, z) > 0.5 ? '#9a2f2f' : '#8c2a2a');
    v.box(x0, G, z0, x1, G + 1, z1, (x, y, z) => ((x + z) % 2 ? '#e8d6b0' : '#dcc89e'));
    const hx0 = x0 + 2, hx1 = x1 - 2, hz0 = z0 + 1, hz1 = z0 + 12;
    v.box(hx0, G + 1, hz0, hx1, G + 10, hz1, red);
    v.box(hx0 - 1, G + 10, hz0 - 1, hx1 + 1, G + 11, hz1 + 1, '#d9a23a');
    v.box(hx0 + 1, G + 10, hz0 + 1, hx1 - 1, G + 11, hz1 - 1, '#7a2525');
    for (let i = hx0; i < hx1; i += 3) v.set(i, G + 11, hz0 - 1, '#d9a23a');
    // Golden pillars and the name over the front door.
    for (const px of [hx0, hx1 - 1]) v.box(px, G + 1, hz1, px + 1, G + 10, hz1 + 1, '#d9a23a');
    v.box(hx0 + 2, G + 3, hz1, hx1 - 1, G + 9, hz1 + 1, '#5a1a1a');
    sign(v, 'WOLF', hx0 + 3, G + 3, hz1 + 1, '#ffd36b');
    v.box(hx0 + 8, G + 1, hz1, hx0 + 12, G + 3, hz1 + 1, '#2b1a14');
    for (const wx of [hx0 + 2, hx1 - 3]) for (const y of [G + 4, G + 7]) v.light(wx, y, hz1, '#ffcf73');
    for (let i = hz0 + 2; i < hz1 - 1; i += 3) { v.light(hx1, G + 5, i, '#ffcf73'); v.light(hx0 - 1, G + 5, i, '#ffcf73'); }
    // Back entrance on the north side: a small door, crates and a lantern.
    v.box(hx0 + 3, G + 1, hz0 - 1, hx0 + 4, G + 3, hz0, '#2b1a14');
    v.set(hx0 + 5, G + 1, hz0 - 2, '#a8743e'); v.set(hx0 + 6, G + 1, hz0 - 2, '#a8743e'); v.set(hx0 + 5, G + 2, hz0 - 2, '#a8743e');
    v.light(hx0 + 2, G + 4, hz0 - 1, '#ffb54d');
    // The gym yard out front: mats, dumbbells and kettlebells.
    v.box(hx0 + 1, G + 1, hz1 + 2, hx0 + 7, G + 2, hz1 + 6, '#3a5f9e');
    for (const [x, z] of [[hx1 - 8, hz1 + 3], [hx1 - 5, hz1 + 5], [hx1 - 3, hz1 + 2]]) {
      v.set(x, G + 1, z, '#555a63'); v.set(x + 1, G + 1, z, '#9aa0a8'); v.set(x + 2, G + 1, z, '#555a63');
    }
    for (const [x, z] of [[hx0 + 9, hz1 + 6], [hx0 + 11, hz1 + 6]]) { v.set(x, G + 1, z, '#d9a23a'); v.set(x, G + 2, z, '#d9a23a'); }
    // The Silk Sisters on guard at the door.
    for (const [x, c] of [[hx0 + 7, '#9a2f6f'], [hx0 + 13, '#2f7a5a'], [hx0 + 4, '#7b3f8f']]) person(v, x, G, hz1 + 1, c, { hat: '#2b1a14' });
  }

  // --- Ulrik's hideout: a walled courtyard with a dark tent ---------------------------------
  {
    const [x0, z0, x1, z1] = ZONES.hideout;
    v.box(x0, G, z0, x1, G + 1, z1, '#c9b089');
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
      const edge = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
      const opening = x === x1 - 1 && z >= z0 + 12 && z < z0 + 14;
      if (edge && !opening) v.box(x, G + 1, z, x + 1, G + 6, z + 1, '#b89466');
    }
    // Rugs, the tent and a heavy chair.
    v.box(x0 + 3, G, z0 + 9, x1 - 3, G + 1, z1 - 3, (x, y, z) => ((x + z) % 3 ? '#8c2a2a' : '#c9473d'));
    const tx = x0 + 5, tz = z0 + 2;
    for (let i = 0; i < 6; i++) v.box(tx - 1 + i, G + 1 + i, tz - 1, tx + 11 - i, G + 2 + i, tz + 8, '#2e2a28');
    v.box(tx + 2, G + 1, tz + 7, tx + 8, G + 4, tz + 8, '#1a1716');
    v.box(tx + 4, G + 1, tz + 8, tx + 6, G + 3, tz + 9, '#6b4a2e');
    person(v, tx + 5, G + 1, tz + 9, '#2b2833');
    v.set(tx + 5, G + 5, tz + 9, '#2b2833');
    for (const [x, z] of [[x0 + 2, z0 + 9], [x1 - 3, z0 + 9], [x0 + 2, z1 - 3], [x1 - 3, z1 - 3]]) { v.set(x, G + 1, z, '#5b4a3a'); v.set(x, G + 2, z, '#5b4a3a'); v.light(x, G + 3, z, '#ffb54d'); }
    for (const [x, z] of [[x0 + 4, z1 - 4], [x1 - 5, z1 - 5], [x1 - 3, z0 + 13]]) person(v, x, G, z, '#4a3a2c', { hat: '#d8cbb4' });
    // A camel resting by the wall.
    const cx = x0 + 15, cz = z0 + 4;
    v.box(cx, G + 1, cz, cx + 4, G + 3, cz + 2, '#c9a06e');
    v.set(cx + 2, G + 3, cz, '#c9a06e'); v.set(cx + 2, G + 3, cz + 1, '#c9a06e');
    v.box(cx + 4, G + 2, cz, cx + 5, G + 5, cz + 1, '#c9a06e'); v.set(cx + 5, G + 5, cz, '#c9a06e');
  }

  // --- Kvini, the store --------------------------------------------------------------------------
  {
    const [x0, z0] = ZONES.kvini;
    v.box(x0, G, z0, x0 + 10, G + 1, z0 + 10, '#e8d6b0');
    house(v, x0 + 1, G + 1, z0 + 1, { w: 8, d: 6, h: 6, wall: '#ecd3a6', roof: '#c9a674', roofType: 'flat', door: '#4f8a3a' });
    for (let i = x0; i < x0 + 10; i++) v.set(i, G + 4, z0 + 7, i % 2 ? '#4f8a3a' : '#f2ecdf');
    v.box(x0 + 1, G + 6, z0 + 6, x0 + 9, G + 7, z0 + 7, '#4f8a3a');
    // Shop board over the door with a red potion painted on it.
    v.box(x0 + 3, G + 7, z0 + 7, x0 + 7, G + 9, z0 + 8, '#2f5a2a');
    v.set(x0 + 5, G + 7, z0 + 8, '#ff5a5a'); v.set(x0 + 5, G + 8, z0 + 8, '#ffb0b0');
    v.box(x0 + 2, G + 1, z0 + 8, x0 + 6, G + 2, z0 + 9, '#8a6440');
    for (const [i, c] of [[0, '#ff5a5a'], [1, '#5ab4ff'], [2, '#ff5a5a'], [3, '#7dff8a']]) v.light(x0 + 2 + i, G + 2, z0 + 8, c);
    person(v, x0 + 7, G, z0 + 8, '#d9a23a', { hat: '#4f8a3a' });
  }

  // --- The harbour ---------------------------------------------------------------------------------
  for (const [x, z, len, axis] of [[70, 84, 10, 'z'], [80, 78, 10, 'z'], [86, 66, 10, 'x'], [88, 48, 9, 'x']]) {
    for (let i = 0; i < len; i++) {
      const px = axis === 'x' ? x + i : x, pz = axis === 'z' ? z + i : z;
      v.box(px, 1, pz, px + 2, 2, pz + 2, '#8a6440');
      if (i % 3 === 0) v.set(px, 0, pz, '#6b4a2e');
    }
  }
  boat(v, 74, 0, 90, { length: 9, sail: '#f4e6c8', axis: 'z' });
  boat(v, 84, 0, 88, { length: 7, sail: '#c9473d', axis: 'z' });
  boat(v, 90, 0, 71, { length: 9, sail: '#3a7d8c', axis: 'x' });
  boat(v, 93, 0, 52, { length: 6, mast: false, hull: '#d9a23a', axis: 'x' });
  boat(v, 62, 0, 90, { length: 5, mast: false, hull: '#7b3f8f', axis: 'z' });
  for (let i = 0; i < 30; i++) {
    const x = 50 + Math.floor(hash(i, 3, 53) * 45), z = 40 + Math.floor(hash(i, 4, 53) * 55);
    if (!promenade(x, z) || v.has(x, G + 1, z)) continue;
    if (i % 3 === 0) { v.set(x, G + 1, z, '#a8743e'); if (i % 2) v.set(x, G + 2, z, '#a8743e'); }
    else person(v, x, G, z, CLOTH[i % CLOTH.length]);
  }

  // --- Habibi Hands: Grill & Guide ---------------------------------------------------------------------
  const hb = { x: 79, z: 71 };
  {
    const { x, z } = hb;
    v.box(x, G + 1, z, x + 4, G + 2, z + 2, '#8a6440');
    v.light(x + 1, G + 2, z, '#ff7a2e'); v.light(x + 2, G + 2, z, '#ffb54d');
    v.set(x, G + 1, z - 1, '#6b4a2e'); v.set(x, G + 2, z - 1, '#6b4a2e'); v.set(x + 3, G + 1, z - 1, '#6b4a2e'); v.set(x + 3, G + 2, z - 1, '#6b4a2e');
    for (let i = -1; i < 5; i++) for (let j = -1; j < 3; j++) v.set(x + i, G + 4, z + j, (i + 1) % 2 ? '#c9473d' : '#f2ecdf');
    for (let y = G + 1; y < G + 7; y++) v.set(x + 6, y, z + 2, '#6b4a2e');
    v.box(x + 5, G + 5, z + 2, x + 9, G + 8, z + 3, '#3a7d8c');
    v.box(x + 6, G + 6, z + 2, x + 8, G + 7, z + 3, '#d9a23a');
    person(v, x + 2, G, z + 3, '#2f5d9e', { hat: '#c9473d' });
    v.set(x - 2, G + 3, z + 3, '#2b2833');
  }

  // --- Hooknose Alley: indigo cloth, shadows, and those noses ---------------------------------------------
  for (let z = 60; z < 78; z += 3) v.set(61, G + 5, z, HOOKNOSE);
  for (const [z, dx] of [[64, 1], [70, 1], [74, -1]]) {
    person(v, 61, G, z, HOOKNOSE, { hat: HOOKNOSE, skin: HOOKNOSE });
    v.set(61 + dx, G + 3, z, '#d8a87a');
    v.set(61 - dx, G + 2, z, '#d8dde3');
  }

  // --- Named places -------------------------------------------------------------------------------------------
  const topY = (x, z) => { for (let y = 40; y > -5; y--) if (v.has(x, y, z)) return y + 1; return 0; };
  const at = (x, z) => [x, topY(x, z), z];
  const places = [
    {
      id: 'harbour', name: 'The Harbour', tier: 'district', pos: [80, G + 1, 82],
      subtitle: 'Razz of Mataz · the sea front',
      text: 'Where every newcomer arrives. Fishing boats and traders crowd the piers, and the guides are already waiting for anyone who looks lost.',
    },
    {
      id: 'habibi', name: 'Habibi Hands: Grill & Guide', tier: 'spot', pos: at(hb.x + 2, hb.z),
      subtitle: 'The harbour promenade',
      text: 'Habibi’s kebab stand. Warm, fast-talking and calling everyone “sjef” and “bror”, he will gladly guide you anywhere in the city, for 20 nugs.',
    },
    {
      id: 'hooknose', name: 'Hooknose Alley', tier: 'spot', pos: [61, G + 6, 68],
      subtitle: 'Between the harbour and the plaza',
      text: 'A narrow, shadowy cut through the maze. The Hooknose gang waits here: hunched robbers in indigo cloth, their noses curved like their knives.',
    },
    {
      id: 'plaza', name: 'The Central Plaza', tier: 'district', pos: [50, PLATEAU_Y + 1, 57],
      subtitle: 'The heart of the maze',
      text: 'A plateau of markets and lanterns around the great square building. However hard you try to leave Razz, the streets always bring you back here.',
    },
    {
      id: 'roof', name: 'The Roof', tier: 'spot', pos: [50, top + 2, 44],
      subtitle: 'Top floor of the square building',
      text: '',
    },
    {
      id: 'wolf', name: 'The Wolf', tier: 'spot', pos: at(21, 62),
      subtitle: 'Lord Wolf’s den',
      text: 'Half luxury brothel, half gym. Red drapes, golden dumbbells and the Silk Sisters on guard at the front. There is a back entrance on the north side, for those who know.',
    },
    {
      id: 'hideout', name: 'Ulrik’s Hideout', tier: 'spot', pos: at(15, 8),
      subtitle: 'A walled courtyard by the north wall',
      text: '',
    },
    {
      id: 'kvini', name: 'Kvini', tier: 'spot', pos: at(74, 33),
      subtitle: 'The store',
      text: 'The general store. Health potions and supplies, and a good price if you can talk your way into one.',
    },
    {
      id: 'gate', name: 'The City Gate', tier: 'district', pos: [2, G + 16, 39],
      subtitle: 'The west wall',
      text: 'The way out of Razz, if you can find it. Guides wait just inside, because only they can lead you here through the maze.',
    },
  ];
  return { vox: v, places, size: S };
}

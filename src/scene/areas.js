// The places a scene can be set in: small voxel dioramas (city/vox.js) where the heroes and
// the people they meet stand together. Each area is built on a 60×60 slab; one diorama voxel is
// 2 world units, so a hero figure (about 24 units) is a little under two blocks of wall high.
// The camera looks from the front (+z); the heroes stand in a row near the front, the people
// of the scene further back at `npcSpots` (in slab voxels, the first is the place of honour).
import { Vox, hash, noise, shade, palm, boat } from '../city/vox.js';

export const SCALE = 2;
export const SIZE = 60;
const HERO_SPOTS = [[24, 45], [36, 45], [18, 50], [42, 50], [30, 51], [12, 54], [48, 54]];

// --- Shared bits -------------------------------------------------------------------------------

function slab(v, top, { bottom = -3, height = () => 0, water = null, bed } = {}) {
  v.ground({
    heightAt: height,
    top,
    side: (x, z, y) => (y < -1 ? '#8a6a48' : '#a8875a'),
    bottom,
    waterLevel: water,
    bed,
  });
}
const pick = (x, z, seed, colours) => colours[Math.floor(noise(x, z, 3, seed) * colours.length) % colours.length];

function lantern(v, x, y, z, { post = 5, wood = '#4a3426' } = {}) {
  for (let i = 1; i <= post; i++) v.set(x, y + i, z, wood);
  v.light(x, y + post + 1, z, '#ffcf70');
  v.set(x, y + post + 2, z, '#3a2a1e');
}
function barrel(v, x, y, z) {
  for (let i = 1; i <= 3; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) v.set(x + dx, y + i, z + dz, i === 2 ? '#5a3a22' : '#8a5a34');
}
function crate(v, x, y, z, s = 2, c = '#a87a48') {
  v.box(x, y + 1, z, x + s, y + 1 + s, z + s, (cx, cy, cz) => ((cx + cy + cz) % 2 ? c : shade(c, 0.85)));
}
// A rug laid on the ground (recolours the top layer).
function rug(v, x0, z0, x1, z1, { field = '#9b2f2a', border = '#d8a845', motif = '#2f4f7a' } = {}) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    const inner = x === x0 + 2 || x === x1 - 2 || z === z0 + 2 || z === z1 - 2;
    const diamond = Math.abs(x - (x0 + x1) / 2) + Math.abs(z - (z0 + z1) / 2) < 3;
    v.set(x, 0, z, edge ? border : diamond ? motif : inner ? shade(border, 0.8) : field);
  }
}
function sandstoneWall(v, x0, z0, x1, z1, h, { colour = '#d4b07a', windows = true, lit = false } = {}) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 1; y <= h; y++) {
    v.set(x, y, z, hash(x, y, z) > 0.86 ? shade(colour, 0.9) : y === h ? shade(colour, 1.06) : colour);
  }
  if (!windows) return;
  // Little windows on the faces the camera sees.
  for (let y = 6; y < h - 2; y += 7) {
    for (let z = z0 + 3; z < z1 - 1; z += 6) for (const x of [x0, x1]) {
      const win = (wx, wy, wz) => (lit && hash(wx, wy, wz) > 0.5 ? v.light(wx, wy, wz, '#ffcf70') : v.set(wx, wy, wz, '#3a2a22'));
      win(x, y, z); win(x, y + 1, z); win(x, y, z + 1); win(x, y + 1, z + 1);
    }
    for (let x = x0 + 3; x < x1 - 1; x += 6) {
      const win = (wx, wy, wz) => (lit && hash(wx, wy, wz) > 0.5 ? v.light(wx, wy, wz, '#ffcf70') : v.set(wx, wy, wz, '#3a2a22'));
      win(x, y, z1); win(x, y + 1, z1); win(x + 1, y, z1); win(x + 1, y + 1, z1);
    }
  }
}

// --- The camp of the Man Who Makes Himself Known ------------------------------------------------
// Black tents in a desert canyon at dusk, rugs on the sand, lanterns, a campfire, and his
// carved throne draped with a pelt.
function camp() {
  const v = new Vox(SIZE, { corner: 8 });
  slab(v, (x, z) => pick(x, z, 4, ['#d9b77e', '#cfa96c', '#e3c48e', '#d9b77e']));
  // Canyon walls behind.
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < 9; z++) {
    if (!v.inside(x, z)) continue;
    const top = Math.round(8 + noise(x, z, 6, 2) * 16 - z * 0.9);
    for (let y = 1; y <= top; y++) v.set(x, y, z, y > top - 2 ? '#c47a48' : hash(x, y, z) > 0.8 ? '#8e4a2e' : '#b0603a');
  }
  // Two big black tents.
  for (const [x0, z0, w, d] of [[3, 10, 14, 11], [43, 10, 14, 11]]) {
    for (let i = 0; i <= 6; i++) {
      const h = 9 - i;
      for (let x = x0 + i; x < x0 + w - i; x++) for (let z = z0; z < z0 + d; z++) v.set(x, h, z, i === 0 && (x + z) % 3 === 0 ? '#2f2925' : '#24201d');
    }
    for (let x = x0 + 1; x < x0 + w - 1; x++) for (let y = 1; y <= 8 - Math.abs(x - (x0 + w / 2)) * 0.7; y++) v.set(x, y, z0, '#1f1b19');
    // The open front, lit from inside.
    const mid = x0 + Math.floor(w / 2);
    for (let x = mid - 2; x <= mid + 2; x++) for (let y = 1; y <= 5; y++) {
      if (Math.abs(x - mid) <= 1 && y <= 4) v.light(x, y, z0 + d - 1, '#ffb35c'); else v.set(x, y, z0 + d - 1, '#2a2522');
    }
    for (let y = 1; y <= 10; y++) v.set(x0 + 1, y, z0 + d, '#5a3a22');
    v.light(x0 + 1, 11, z0 + d, '#ffcf70');
  }
  // Rugs, the throne and its pelt.
  rug(v, 20, 14, 40, 30);
  rug(v, 8, 26, 16, 34, { field: '#2f4f7a', border: '#d8a845', motif: '#9b2f2a' });
  rug(v, 44, 26, 52, 34, { field: '#6b3a2a', border: '#e3c48e', motif: '#2f6a4a' });
  const tx = 30, tz = 15;
  v.box(tx - 3, 1, tz - 1, tx + 4, 3, tz + 3, '#5a3a22');
  v.box(tx - 3, 3, tz - 1, tx + 4, 11, tz, '#4a2e1a');
  v.box(tx - 3, 11, tz - 1, tx - 2, 13, tz, '#6b4528'); v.box(tx + 3, 11, tz - 1, tx + 4, 13, tz, '#6b4528');
  v.box(tx - 2, 3, tz + 1, tx + 3, 4, tz + 3, '#e8dcc4');
  v.box(tx - 2, 4, tz, tx + 3, 10, tz + 1, (x, y) => (hash(x, y, 3) > 0.6 ? '#d6c8ae' : '#e8dcc4'));
  // The campfire: a ring of stones, logs and flames.
  const fx = 30, fz = 38;
  for (let a = 0; a < 12; a++) v.set(fx + Math.round(Math.cos(a / 12 * Math.PI * 2) * 3), 1, fz + Math.round(Math.sin(a / 12 * Math.PI * 2) * 3), '#7a7068');
  v.box(fx - 1, 1, fz, fx + 2, 2, fz + 1, '#5a3a22'); v.box(fx, 1, fz - 1, fx + 1, 2, fz + 2, '#4a2e1a');
  v.light(fx, 2, fz, '#ff8a3c'); v.light(fx + 1, 2, fz, '#ffb347'); v.light(fx, 3, fz, '#ffd27a'); v.light(fx, 2, fz + 1, '#ff9a3c');
  for (const [x, z] of [[19, 22], [41, 22], [12, 40], [48, 40]]) lantern(v, x, 0, z);
  // Crates, rifles leaning on them (sticks), rocks.
  crate(v, 6, 0, 36, 3, '#8a5a34'); crate(v, 9, 0, 38); barrel(v, 50, 0, 36); barrel(v, 53, 0, 38);
  for (const [x, z] of [[4, 46], [55, 46], [16, 55], [45, 56]]) v.box(x, 1, z, x + 2, 2 + Math.round(hash(x, z) * 2), z + 2, '#a8865a');
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 19], [23, 24], [37, 24], [18, 30], [42, 30], [26, 31], [34, 31], [13, 36], [47, 36]],
    mood: { bg: 'linear-gradient(#3b2a4a, #b0603a 60%, #e09a5a)', sky: '#ffd8b0', ground: '#5a3a3a', hemi: 1.15, sun: '#ff9a50', sunPower: 2.1, sunAt: [-60, 40, 30], exposure: 1.05 },
  };
}

// --- The Wolf: Lord Wolf's club -------------------------------------------------------------------
// Half palace, half gym: a wooden floor, red and gold drapes, a banner, pillars, weights and
// kettlebells, wrestling mats, cushions, and the red throne.
function wolf() {
  const v = new Vox(SIZE, { corner: 4 });
  slab(v, (x, z) => (Math.floor(x / 3) % 2 ? '#8a5a34' : '#7a4e2c'));
  // Back and side walls.
  sandstoneWall(v, 0, 0, SIZE - 1, 3, 26, { colour: '#d8c3a0', windows: false });
  for (const [x0, x1] of [[0, 2], [SIZE - 3, SIZE - 1]]) sandstoneWall(v, x0, 4, x1, 40, 14, { colour: '#cdb592', windows: false });
  // Drapes on the back wall, gathered at the top.
  for (let x = 2; x < SIZE - 2; x++) {
    const fold = x % 8;
    if (fold > 5) continue;
    const red = Math.floor(x / 8) % 3 !== 1;
    for (let y = 4; y <= 25; y++) v.set(x, y, 4, (y > 23 ? '#d9a63a' : red ? (fold % 2 ? '#a3242a' : '#8a1f22') : (fold % 2 ? '#d9a63a' : '#c4902a')));
  }
  // The banner: THE WOLF, a wolf's head on cream.
  for (let x = 24; x <= 36; x++) for (let y = 10; y <= 24; y++) v.set(x, y, 5, x === 24 || x === 36 || y === 10 || y === 24 ? '#d9a63a' : '#efe2c4');
  const head = ['..x.....x..', '.xxx...xxx.', '.xxxxxxxxx.', 'xxxxxxxxxxx', 'xx.xxxxx.xx', 'xxxxxxxxxxx', '.xxxxxxxxx.', '..xxx.xxx..', '...xxxxx...', '....xxx....'];
  head.forEach((row, r) => [...row].forEach((ch, i) => { if (ch === 'x') v.set(25 + i, 22 - r, 6, r === 4 ? '#3a3a42' : '#6a6a74'); }));
  // The red throne with gold.
  const tx = 30, tz = 9;
  v.box(tx - 4, 1, tz - 2, tx + 5, 4, tz + 3, '#a3242a');
  v.box(tx - 4, 4, tz - 2, tx + 5, 14, tz, '#8a1f22');
  v.box(tx - 4, 14, tz - 2, tx + 5, 15, tz, '#d9a63a');
  v.box(tx - 5, 1, tz - 2, tx - 4, 8, tz + 3, '#d9a63a'); v.box(tx + 5, 1, tz - 2, tx + 6, 8, tz + 3, '#d9a63a');
  // Pillars with lanterns.
  for (const x of [10, 49]) {
    for (let y = 1; y <= 24; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) v.set(x + dx, y, 12 + dz, y === 1 || y === 24 ? '#bfae90' : y % 6 === 0 ? '#c9b89a' : '#e0d2b8');
    v.light(x, 14, 14, '#ffcf70'); v.light(x + 1, 14, 14, '#ffcf70');
  }
  // The gym: a rack of dumbbells, kettlebells, a blue wrestling mat.
  for (let x = 4; x <= 15; x++) { v.set(x, 1, 20, '#5a5a62'); v.set(x, 4, 20, '#5a5a62'); }
  for (const x of [4, 15]) for (let y = 1; y <= 5; y++) v.set(x, y, 20, '#4a4a52');
  for (let x = 6; x <= 13; x += 3) for (const y of [2, 5]) { v.set(x, y, 21, '#3a3a42'); v.set(x + 1, y, 21, '#9aa0a8'); v.set(x + 2, y, 21, '#3a3a42'); }
  for (const [x, z] of [[6, 25], [9, 26], [12, 25]]) { v.box(x, 1, z, x + 2, 3, z + 2, '#3a3a42'); v.set(x, 3, z, '#3a3a42'); v.set(x + 1, 3, z, '#3a3a42'); }
  for (let x = 4; x <= 16; x++) for (let z = 30; z <= 40; z++) v.set(x, 0, z, x === 4 || x === 16 || z === 30 || z === 40 ? '#2a3a5a' : '#3a4f7a');
  for (let x = 6; x <= 14; x += 4) { v.box(x, 1, 34, x + 3, 2, 35, '#4a4a52'); v.set(x, 1, 33, '#2a2a30'); v.set(x + 2, 1, 33, '#2a2a30'); }
  // Silk cushions, a silver chest of gold.
  for (const [x, z, c] of [[42, 20, '#6b3a7a'], [46, 22, '#d9a63a'], [43, 25, '#a3242a'], [48, 26, '#3f6b4a'], [40, 28, '#6b3a7a']]) v.box(x, 1, z, x + 3, 2, z + 3, c);
  v.box(46, 1, 32, 53, 5, 37, '#b9c0c6'); v.box(46, 5, 32, 53, 6, 37, '#8a929a');
  for (let x = 47; x <= 52; x++) for (let z = 33; z <= 36; z++) v.set(x, 5, z, hash(x, z) > 0.4 ? '#f2c94c' : '#d9a63a');
  // A red carpet up to the throne.
  for (let x = 26; x <= 34; x++) for (let z = 12; z <= 58; z++) v.set(x, 0, z, x === 26 || x === 34 ? '#d9a63a' : '#9b1f24');
  for (const [x, z] of [[20, 44], [40, 44]]) lantern(v, x, 0, z, { wood: '#d9a63a' });
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 16], [22, 18], [38, 18], [19, 24], [41, 24], [25, 27], [35, 27], [15, 30], [45, 31]],
    mood: { bg: 'radial-gradient(ellipse at 50% 30%, #6a3424, #2a1410)', sky: '#ffd9a8', ground: '#4a2a1a', hemi: 1.35, sun: '#ffcf90', sunPower: 1.7, sunAt: [-20, 70, 50], exposure: 1.1 },
  };
}

// --- The port of Razz of Mataz -------------------------------------------------------------------
// A sandstone quay at the end of the day: the sea and moored boats behind, houses with flat
// roofs and domes on both sides, palms, crates and barrels, and Habibi's grill-and-guide stall.
function port() {
  const v = new Vox(SIZE, { corner: 8 });
  v.waterColour = '#3fa6c9';
  const sea = (x, z) => z < 17;
  slab(v, (x, z, h) => (h < 0 ? '#c9b48a' : z === 17 || z === 18 ? '#b89a6a' : (x + z) % 4 === 0 ? '#d8bf8e' : '#e4cfa2'),
    { height: (x, z) => (sea(x, z) ? -3 : 0), water: 0, bed: () => '#b8a37a' });
  // Mooring posts and boats.
  for (let x = 6; x < SIZE - 6; x += 9) { v.set(x, 1, 18, '#5a3a22'); v.set(x, 2, 18, '#5a3a22'); }
  boat(v, 10, 0, 9, { length: 13, hull: '#7a4e2c', sail: '#f4ecdc' });
  boat(v, 34, 0, 6, { length: 15, hull: '#5a6a8a', sail: '#e8d2b0' });
  boat(v, 48, 0, 13, { length: 7, hull: '#9a6a3a', mast: false });
  // Houses along both sides.
  for (const [x0, z0, w, h, dome] of [[0, 20, 9, 16, false], [0, 31, 8, 12, true], [0, 41, 9, 18, false], [51, 21, 9, 14, true], [52, 34, 8, 19, false], [51, 46, 9, 12, false]]) {
    sandstoneWall(v, x0, z0, x0 + w - 1, z0 + 9, h, { colour: hash(x0, z0) > 0.5 ? '#e0c28f' : '#d4b07a' });
    v.box(x0, h + 1, z0, x0 + w, h + 2, z0 + 10, '#c4a06a');
    if (dome) for (let i = 0; i < 4; i++) v.box(x0 + 1 + i, h + 2 + i, z0 + 2 + i, x0 + w - 1 - i, h + 3 + i, z0 + 8 - i, '#f2ebe0');
  }
  // Habibi's stall: an awning, a counter, a grill and the sign.
  v.box(38, 1, 22, 48, 4, 26, '#7a4e2c');
  v.box(38, 4, 22, 48, 5, 26, '#9a6a3a');
  for (let x = 40; x <= 45; x++) v.light(x, 5, 24, x % 2 ? '#ff8a3c' : '#ffb347');
  for (const x of [38, 47]) for (let y = 5; y <= 11; y++) v.set(x, y, 22, '#5a3a22');
  for (let x = 37; x <= 48; x++) for (let z = 20; z <= 26; z++) v.set(x, 12, z, (x + Math.floor(z / 2)) % 4 < 2 ? '#c94a3a' : '#f2ebe0');
  for (let x = 39; x <= 46; x++) for (let y = 13; y <= 16; y++) v.set(x, y, 22, x === 39 || x === 46 || y === 13 || y === 16 ? '#d8a845' : '#5a3a22');
  for (let x = 41; x <= 44; x++) v.set(x, 15, 23, '#f2d27a');
  // Palms, crates, barrels, nets.
  for (const [x, z] of [[14, 24], [26, 21], [12, 48], [48, 50]]) palm(v, x, 0, z, { lean: x < 30 ? 1 : -1 });
  crate(v, 18, 0, 20); crate(v, 20, 0, 22); crate(v, 18, 2, 20, 2, '#8a5a34'); barrel(v, 31, 0, 20); barrel(v, 33, 0, 21);
  for (let x = 22; x <= 26; x++) for (let z = 26; z <= 28; z++) if ((x + z) % 2) v.set(x, 1, z, '#9a8a6a');
  for (const [x, z] of [[18, 40], [42, 40]]) lantern(v, x, 0, z);
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 27], [43, 30], [22, 31], [37, 33], [16, 34], [26, 35], [34, 36], [46, 36], [12, 38]],
    mood: { bg: 'linear-gradient(#7fb6d9, #f2c48a 70%, #f7e2b8)', sky: '#fff1dc', ground: '#b89a70', hemi: 1.45, sun: '#ffd6a0', sunPower: 2.4, sunAt: [-50, 55, 40], exposure: 1.05 },
  };
}

// --- Hooknose Alley -------------------------------------------------------------------------------
// A narrow alley at night between tall sandstone walls: torn cloth awnings, lanterns, broken
// crates, an arch at the far end.
function alley() {
  const v = new Vox(SIZE, { corner: 6 });
  slab(v, (x, z) => pick(x, z, 9, ['#8a7050', '#9a7c58', '#7a6448', '#8a7050']));
  sandstoneWall(v, 0, 0, 13, SIZE - 1, 18, { colour: '#c4a170', lit: true });
  sandstoneWall(v, 46, 0, SIZE - 1, SIZE - 1, 16, { colour: '#b8966a', lit: true });
  // The arch at the end.
  sandstoneWall(v, 14, 0, 45, 3, 20, { colour: '#b8966a', windows: false });
  for (let x = 25; x <= 34; x++) for (let y = 1; y <= 13 - Math.max(0, Math.abs(x - 29.5) - 3); y++) v.set(x, y, 3, '#141018');
  // Doors along the walls.
  for (const z of [12, 30, 46]) { v.box(13, 1, z, 14, 8, z + 3, '#3a2a1e'); v.box(46, 1, z + 4, 47, 8, z + 7, '#3a2a1e'); }
  // Torn awnings across the alley.
  for (const [z, c] of [[14, '#6a4a3a'], [26, '#4a3a5a'], [38, '#5a4a3a']]) {
    for (let x = 14; x <= 45; x++) if (hash(x, z) > 0.18) for (let dz = 0; dz < 4; dz++) if (hash(x, z + dz, 5) > 0.15) v.set(x, 16 - Math.round(Math.sin((x - 14) / 31 * Math.PI) * 3), z + dz, c);
  }
  // Lanterns on brackets.
  for (const [x, z] of [[14, 20], [45, 34], [14, 44], [45, 10]]) { v.set(x, 11, z, '#3a2a1e'); v.light(x + (x < 30 ? 1 : -1), 10, z, '#ffb347'); }
  // Broken crates, planks and rubbish.
  crate(v, 18, 0, 8, 3, '#7a5a38'); crate(v, 39, 0, 22); crate(v, 40, 0, 25, 2, '#6a4a2e');
  for (const [x, z, l] of [[20, 34, 5], [36, 42, 4], [24, 50, 6]]) for (let i = 0; i < l; i++) v.set(x + i, 1, z + Math.floor(i / 3), '#6a4a2e');
  barrel(v, 17, 0, 52);
  return {
    v, heroSpots: HERO_SPOTS.slice(0, 5),
    npcSpots: [[30, 21], [21, 23], [39, 23], [25, 15], [35, 15], [18, 30], [42, 30], [30, 28], [30, 10]],
    mood: { bg: 'linear-gradient(#141a3a, #34406a)', sky: '#c4d0f0', ground: '#4a3a2a', hemi: 1.3, sun: '#b8c4ff', sunPower: 1.6, sunAt: [30, 70, 30], exposure: 1.2 },
  };
}

// --- Outside the city gates ------------------------------------------------------------------------
// The great sandstone wall of Razz with its gate and two towers, a road out into the desert,
// scrub, rocks, palms and a cart.
function gate() {
  const v = new Vox(SIZE, { corner: 8 });
  const road = (x, z) => Math.abs(x - 30 + Math.sin(z / 9) * 2) < 5;
  slab(v, (x, z) => (road(x, z) ? (hash(x, z) > 0.8 ? '#b8986a' : '#c4a46e') : pick(x, z, 6, ['#dcc08a', '#d2b47c', '#e2c896', '#dcc08a'])));
  sandstoneWall(v, 0, 2, SIZE - 1, 9, 22, { colour: '#d4b07a', windows: false });
  for (let x = 0; x < SIZE; x += 2) v.box(x, 23, 2, x + 1, 25, 10, '#c9a46e');
  // Towers.
  for (const x0 of [13, 39]) {
    sandstoneWall(v, x0, 0, x0 + 8, 12, 32, { colour: '#cfa86e' });
    for (let x = x0; x <= x0 + 8; x += 2) v.box(x, 33, 0, x + 1, 35, 13, '#c49a62');
    for (let y = 36; y <= 41; y++) v.set(x0 + 4, y, 6, '#5a3a22');
    for (let i = 1; i <= 4; i++) for (let j = 0; j < 2; j++) v.set(x0 + 4 + i, 41 - j, 6, '#a3242a');
  }
  // The gate: an arch with the doors swung open.
  for (let x = 24; x <= 35; x++) for (let y = 1; y <= 16 - Math.max(0, Math.abs(x - 29.5) - 3.5); y++) for (let z = 2; z <= 9; z++) v.clear(x, y, z);
  for (let x = 24; x <= 35; x++) for (let y = 1; y <= 16; y++) if (!v.has(x, y, 3)) v.set(x, y, 2, y < 3 ? '#8a6a48' : '#4a3626');
  v.box(21, 1, 10, 23, 14, 15, '#6b4528'); v.box(37, 1, 10, 39, 14, 15, '#6b4528');
  // Scrub, rocks, palms and a cart on the road.
  for (const [x, z] of [[6, 20], [10, 34], [52, 24], [48, 40], [18, 52], [44, 54]]) {
    for (let i = 0; i < 6; i++) v.set(x + Math.round((hash(x, z, i) - 0.5) * 4), 1 + (i > 3 ? 1 : 0), z + Math.round((hash(z, x, i) - 0.5) * 4), i % 2 ? '#7a8a4a' : '#6a7a3e');
  }
  for (const [x, z] of [[4, 44], [56, 46], [20, 24], [50, 14]]) v.box(x, 1, z, x + 3, 2 + Math.round(hash(x, z) * 2), z + 2, '#a8865a');
  palm(v, 8, 0, 14); palm(v, 52, 0, 16, { lean: -1 });
  // A cart.
  v.box(36, 2, 32, 42, 4, 37, '#8a5a34'); v.box(36, 4, 32, 42, 6, 33, '#7a4e2c');
  for (const [x, z] of [[36, 31], [41, 31], [36, 37], [41, 37]]) { v.set(x, 1, z, '#4a3426'); v.set(x, 2, z, '#4a3426'); }
  crate(v, 37, 4, 34); barrel(v, 40, 4, 34);
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 20], [22, 21], [38, 21], [25, 27], [35, 27], [18, 30], [42, 30], [30, 31], [14, 26]],
    mood: { bg: 'linear-gradient(#8cc6e8, #f3dcae)', sky: '#fff3e2', ground: '#b89a70', hemi: 1.5, sun: '#ffe9cf', sunPower: 2.5, sunAt: [-40, 70, 50], exposure: 1.05 },
  };
}

export const AREAS = {
  camp: { name: 'The camp of the Man Who Makes Himself Known', short: 'The camp', build: camp },
  wolf: { name: 'The Wolf', short: 'The Wolf', build: wolf },
  port: { name: 'The port of Razz of Mataz', short: 'The port', build: port },
  alley: { name: 'Hooknose Alley', short: 'Hooknose Alley', build: alley },
  gate: { name: 'Outside the city gates', short: 'The city gates', build: gate },
};

// World position → slab voxel, and back.
export const toVox = ([x, z]) => [Math.round(x / SCALE + SIZE / 2 - 0.5), Math.round(z / SCALE + SIZE / 2 - 0.5)];
export const toWorld = ([x, z]) => [(x - SIZE / 2 + 0.5) * SCALE, (z - SIZE / 2 + 0.5) * SCALE];

// The nearest spot to `want` (world units) with clear, dry, flat ground around it (`r` voxels),
// not too close to the spots already `taken`. Used to stand fighters in an area.
export function clearSpot(v, want, taken = [], r = 2) {
  const [cx, cz] = toVox(want);
  const free = (x, z) => {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (!v.inside(x + dx, z + dz, v.corner + 2) || v.groundY(x + dx, z + dz) !== 0) return false;
      for (let y = 1; y <= 5; y++) if (v.has(x + dx, y, z + dz)) return false;
    }
    return taken.every(([tx, tz]) => Math.hypot(tx - x, tz - z) >= r * 2 + 2);
  };
  for (let ring = 0; ring <= 14; ring++) {
    for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      if (free(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    }
  }
  return [cx, cz];
}

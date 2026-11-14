// The places a scene can be set in: small voxel dioramas (city/vox.js) where the heroes and
// the people they meet stand together. Each area is built on a 60×60 slab; one diorama voxel is
// 2 world units, so a hero figure (about 24 units) is a little under two blocks of wall high.
// The camera looks from the front (+z); the heroes stand in a row near the front, the people
// of the scene further back at `npcSpots` (in slab voxels, the first is the place of honour).
import { Vox, hash, noise, shade, palm, boat, tree } from '../city/vox.js';

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

// --- Ytterhavn ------------------------------------------------------------------------------------
// A rich seafaring city: tall, colourful merchant houses with stepped gables (Copenhagen), pale
// stone and blue-and-white tiles with terracotta roofs (Lisbon), wave-patterned paving.

// A town house. `face` is the side its front looks to: 'south' (+z, towards the camera), 'east'
// (+x) or 'west' (−x). w is the width along the front, d the depth, h the wall height.
function townhouse(v, { x, z, w, d, h, face = 'south', wall, roof = '#5a4a48', trim = '#f2ece0', tiles = false, door = '#4a3020' }) {
  const P = (u, y, t, c) => {
    if (face === 'south') v.set(x + u, y, z + d - 1 - t, c);
    else if (face === 'east') v.set(x + d - 1 - t, y, z + u, c);
    else v.set(x + t, y, z + u, c);
  };
  const mid = Math.floor(w / 2);
  for (let u = 0; u < w; u++) for (let t = 0; t < d; t++) for (let y = 1; y <= h; y++) {
    let c = wall;
    if (t === 0) {
      if (u === 0 || u === w - 1) c = trim;
      else if ((u === mid || u === mid - 1) && y <= 3) c = door;
      else if (tiles && y <= 3) c = (u + y) % 2 ? '#3f6fa8' : '#e8eef4';
      else if (u % 3 === 1 && y >= 5 && y < h - 1 && (y - 5) % 4 < 2) c = '#34404e';
      else if (u % 3 === 1 && y >= 5 && y < h - 1 && (y - 5) % 4 === 2) c = trim;
      else if (y === 4) c = trim; // a band above the ground floor
    }
    P(u, y, t, c);
  }
  // A stepped gable facing the street; the roof runs back from it.
  for (let i = 0; ; i++) {
    const lo = i, hi = w - 1 - i;
    if (lo > hi) break;
    for (let u = lo; u <= hi; u++) for (let t = 0; t < d; t++) P(u, h + 1 + i, t, t === 0 ? (u === lo || u === hi ? trim : wall) : roof);
  }
  P(w - 2, h + 2, Math.floor(d / 2), '#6a5a52'); P(w - 2, h + 3, Math.floor(d / 2), '#6a5a52'); // chimney
}
const PALETTE_TOWN = ['#e8b84a', '#c94a3a', '#3f6fa8', '#e89a5a', '#7aa86a', '#f2ece0', '#d9a6b0', '#e6d7a0'];
const ROOFS_TOWN = ['#c4623a', '#5a4a48', '#b8552f', '#4a4a52'];
function row(v, along, from, to, opts) {
  let u = from, i = 0;
  while (u < to) {
    const w = Math.min(to - u, 6 + Math.floor(hash(u, i, opts.seed ?? 3) * 4));
    const k = Math.floor(hash(i, u, (opts.seed ?? 3) + 1) * PALETTE_TOWN.length);
    const h = opts.h[0] + Math.floor(hash(u, i, (opts.seed ?? 3) + 2) * (opts.h[1] - opts.h[0]));
    townhouse(v, { ...opts, [along]: u, w, h, wall: PALETTE_TOWN[k], roof: ROOFS_TOWN[(i + k) % ROOFS_TOWN.length], tiles: hash(i, u, 9) > 0.65 });
    u += w; i++;
  }
}
function lamp(v, x, z, h = 6) {
  for (let y = 1; y <= h; y++) v.set(x, y, z, '#2e2a2e');
  v.light(x, h + 1, z, '#ffd27a');
  v.set(x, h + 2, z, '#2e2a2e');
}

// The road between Razz of Mataz and Ytterhavn: a grassy plain with a worn dirt track, fences,
// wildflowers, a few trees, hay and a signpost, low hills behind.
function plainRoad() {
  const v = new Vox(SIZE, { corner: 8 });
  const path = (x, z) => Math.abs(x - (30 + Math.sin(z / 9) * 5)) < 3 + (hash(x, z, 4) > 0.8 ? 1 : 0);
  slab(v, (x, z, h) => (h > 0 ? pick(x, z, 21, ['#86b85a', '#7aac50', '#94c464']) : path(x, z) ? (hash(x, z, 5) > 0.8 ? '#8a7a56' : '#a68e64') : pick(x, z, 22, ['#8cc35c', '#7fb553', '#98cb66', '#86bd58'])),
    { height: (x, z) => (z < 12 ? Math.round(Math.max(0, noise(x, z, 9, 6) * 9 - z * 0.4)) : 0) });
  // Wildflowers on the grass.
  for (let x = 0; x < SIZE; x++) for (let z = 12; z < SIZE; z++) if (v.inside(x, z, 9) && !path(x, z) && hash(x, z, 23) > 0.94) v.set(x, 1, z, ['#e8d24a', '#f2f2f2', '#d9503f', '#b98cd9'][Math.floor(hash(z, x, 24) * 4)]);
  // Fences along the track, a signpost, hay bales, trees.
  for (let z = 14; z < 40; z++) if (hash(z, 1, 25) > 0.25) for (const side of [-1, 1]) {
    const x = Math.round(30 + Math.sin(z / 9) * 5 + side * 6);
    v.set(x, 2, z, '#8a6440'); if (z % 3 === 0) v.set(x, 1, z, '#6b4a2e');
  }
  for (let y = 1; y <= 6; y++) v.set(40, y, 30, '#6b4a2e');
  for (let x = 41; x <= 44; x++) v.set(x, 6, 30, '#a8784a');
  for (let x = 37; x <= 39; x++) v.set(x, 5, 30, '#a8784a');
  for (const [x, z] of [[10, 22], [50, 20], [47, 40]]) { v.box(x, 1, z, x + 3, 3, z + 2, '#e3c46a'); v.box(x, 3, z, x + 3, 4, z + 2, '#d4b45a'); }
  for (const [x, z, s] of [[6, 16, 2], [52, 14, 2], [8, 34, 1], [54, 32, 1], [16, 8, 1], [44, 6, 2]]) tree(v, x, v.groundY(x, z), z, { size: s });
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 24], [24, 20], [36, 20], [22, 28], [38, 28], [30, 16], [26, 32], [34, 33], [18, 24]],
    mood: { bg: 'linear-gradient(#8cc6e8, #e8f2e0)', sky: '#fff6e8', ground: '#8aa86a', hemi: 1.5, sun: '#fff0d4', sunPower: 2.5, sunAt: [-40, 70, 50], exposure: 1.05 },
  };
}

// Ytterhavn's city centre: a wave-paved square with a fountain, rows of tall merchant houses, a
// domed exchange with a copper-green roof, and a canal with boats down one side.
function ytterCentre() {
  const v = new Vox(SIZE, { corner: 5 });
  v.waterColour = '#3f8fb0';
  const canal = (x) => x < 8;
  slab(v, (x, z, h) => (h < 0 ? '#9a948a' : x === 8 ? '#b8b0a2' : Math.sin(x * 0.55 + Math.sin(z * 0.3) * 2.2) > 0.8 ? '#8a8478' : '#e8e2d6'),
    { height: (x) => (canal(x) ? -2 : 0), water: 0, bed: () => '#5a6a72' });
  boat(v, 2, 0, 20, { length: 9, hull: '#9a3a2a', axis: 'z' }); boat(v, 3, 0, 36, { length: 7, hull: '#3f6fa8', axis: 'z', mast: false });
  // The back row and the right side.
  row(v, 'x', 9, 21, { z: 0, d: 10, h: [14, 20], seed: 3 });
  row(v, 'x', 39, 60, { z: 0, d: 10, h: [14, 20], seed: 7 });
  row(v, 'z', 12, 50, { x: 50, d: 10, face: 'west', h: [12, 18], seed: 11 });
  // The exchange: pale stone, columns, and a copper-green dome with a lantern on top.
  townhouse(v, { x: 21, z: 0, w: 18, d: 11, h: 15, wall: '#f2ece0', roof: '#c4623a', trim: '#e0d6c4' });
  for (let x = 22; x <= 37; x += 3) for (let y = 1; y <= 12; y++) v.set(x, y, 11, '#f7f2e8');
  for (let x = 21; x <= 38; x++) v.set(x, 13, 11, '#e0d6c4');
  for (let y = 0; y < 8; y++) {
    const r = Math.round(Math.sqrt(Math.max(0, 36 - (y * 0.85) ** 2)));
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r) v.set(30 + x, 22 + y, 5 + z, y === 0 ? '#e0d6c4' : '#5f9a86');
  }
  for (let y = 30; y <= 32; y++) v.set(30, y, 5, '#e0d6c4'); v.light(30, 33, 5, '#ffd27a');
  // The fountain.
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    const d = Math.hypot(x, z);
    if (d > 4.4) continue;
    if (d > 3.4) { v.set(30 + x, 1, 21 + z, '#cfc6b6'); v.set(30 + x, 2, 21 + z, '#e0d6c4'); } else v.water.set(v.key(30 + x, 1, 21 + z), 1);
  }
  for (let y = 1; y <= 5; y++) v.set(30, y, 21, '#cfc6b6');
  v.set(30, 6, 21, '#8a7a4a'); v.set(30, 7, 21, '#8a7a4a'); v.set(31, 7, 21, '#8a7a4a'); v.set(30, 8, 21, '#9a8a5a');
  for (const [x, z] of [[14, 16], [46, 16], [14, 40], [46, 42]]) lamp(v, x, z);
  for (const [x, z] of [[18, 12], [42, 12]]) { v.box(x - 1, 1, z - 1, x + 2, 2, z + 2, '#9a948a'); tree(v, x, 1, z, { size: 1 }); }
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 30], [22, 28], [38, 28], [19, 22], [41, 22], [24, 35], [36, 35], [14, 32], [45, 34]],
    mood: { bg: 'linear-gradient(#7fbce8, #f4e6c8)', sky: '#fff4e2', ground: '#b8b0a0', hemi: 1.5, sun: '#ffe6c0', sunPower: 2.5, sunAt: [-45, 65, 45], exposure: 1.05 },
  };
}

// A three-masted merchant ship for the harbour, along x. y is the waterline.
function galleon(v, x0, y, z0, len = 30) {
  for (let i = 0; i < len; i++) {
    const end = Math.min(i, len - 1 - i), hw = Math.min(3, 1 + end / 2);
    for (let k = -Math.floor(hw); k <= Math.floor(hw); k++) {
      for (let j = -2; j <= 2; j++) v.set(x0 + i, y + j, z0 + k, j === 0 ? '#c9a44a' : j === 2 && Math.abs(k) < hw - 1 ? '#a8784a' : '#5a3a22');
    }
  }
  v.box(x0 + len - 6, y + 3, z0 - 2, x0 + len - 1, y + 5, z0 + 3, '#6b4528'); // the stern castle
  for (const [i, h] of [[6, 18], [14, 22], [22, 16]]) {
    for (let j = 3; j <= h; j++) v.set(x0 + i, y + j, z0, '#4a3020');
    for (const [a, b] of [[7, h - 6], [h - 5, h - 1]]) for (let j = a; j <= b; j++) for (let k = -4; k <= 4; k++) if (!(j === b && Math.abs(k) === 4)) v.set(x0 + i + 1, y + j, z0 + k, '#f4ecdc');
  }
  for (let i = -5; i < 0; i++) v.set(x0 + i, y + 2 - i * 0.3 | 0, z0, '#4a3020'); // the bowsprit
  for (let k = 1; k <= 3; k++) for (let j = 0; j < 2; j++) v.set(x0 + 14 + k, y + 22 - j, z0, '#3f6fa8');
}

// The port of Ytterhavn: a grey stone quay, a big merchant ship and smaller boats, a crane,
// warehouses, crates, barrels and nets.
function ytterPort() {
  const v = new Vox(SIZE, { corner: 6 });
  v.waterColour = '#3a8fb4';
  slab(v, (x, z, h) => (h < 0 ? '#9a948a' : z === 22 || z === 23 ? '#8a847c' : (x + z) % 5 === 0 ? '#a8a296' : '#bab4a8'),
    { height: (x, z) => (z < 22 ? -3 : 0), water: 0, bed: () => '#6a7a80' });
  galleon(v, 14, 0, 9, 32);
  boat(v, 4, 0, 17, { length: 7, hull: '#9a3a2a' }); boat(v, 50, 0, 16, { length: 7, hull: '#3f6fa8', mast: false });
  for (let x = 4; x < SIZE - 4; x += 8) { v.set(x, 1, 22, '#4a4a50'); v.set(x, 2, 22, '#4a4a50'); }
  // A wooden crane swinging a load over the quay.
  for (let y = 1; y <= 14; y++) v.set(10, y, 26, '#6b4528');
  for (let z = 18; z <= 27; z++) v.set(10, 14, z, '#6b4528');
  for (let y = 9; y <= 13; y++) v.set(10, y, 19, '#3a3a3a');
  v.box(9, 6, 18, 12, 9, 21, '#a87a48');
  // Warehouses on both sides.
  row(v, 'z', 26, 58, { x: 0, d: 8, face: 'east', h: [10, 14], seed: 13 });
  row(v, 'z', 26, 58, { x: 52, d: 8, face: 'west', h: [10, 14], seed: 17 });
  for (const [x, z] of [[16, 26], [18, 28], [16, 28], [44, 25], [46, 27]]) crate(v, x, 0, z, 2, hash(x, z) > 0.5 ? '#a87a48' : '#8a5a34');
  for (const [x, z] of [[40, 30], [42, 32], [22, 34]]) barrel(v, x, 0, z);
  for (let x = 26; x <= 34; x++) for (let z = 40; z <= 42; z++) if ((x + z) % 2) v.set(x, 1, z, '#8a7a5a');
  for (const [x, z] of [[14, 40], [46, 40]]) lamp(v, x, z, 5);
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 28], [24, 30], [36, 30], [20, 34], [40, 36], [27, 35], [33, 36], [15, 36], [45, 34]],
    mood: { bg: 'linear-gradient(#7ab4dc, #f2dcb4)', sky: '#fff1dc', ground: '#9a948a', hemi: 1.45, sun: '#ffd8a8', sunPower: 2.4, sunAt: [-50, 55, 40], exposure: 1.05 },
  };
}

// A small wooden ship at sea (on the way to Sirivik): its deck fills the scene, two masts with
// square sails, a raised bow, barrels, rope and the helm at the stern.
function ship() {
  const v = new Vox(SIZE, { corner: 10 });
  v.waterColour = '#2f86b0';
  slab(v, () => '#3a6a80', { height: () => -4, water: -1, bed: () => '#2a4a5a', bottom: -6 });
  const half = (z) => (z > 30 ? 16 * Math.sqrt(Math.max(0, 1 - ((z - 30) / 32) ** 2)) : 16 * Math.sqrt(Math.max(0, 1 - ((z - 30) / 27) ** 2)));
  for (let z = 3; z <= 57; z++) {
    const hw = half(z);
    for (let x = 0; x < SIZE; x++) {
      const off = Math.abs(x + 0.5 - 30);
      if (off > hw) continue;
      const edge = off > hw - 1.2;
      for (let y = -4; y <= 0; y++) v.set(x, y, z, y === 0 ? (edge ? '#5a3a22' : x % 2 ? '#a8784a' : '#9a6c40') : y === -1 ? '#c9a44a' : '#6b4528');
      if (edge && !(z > 20 && z < 26)) { v.set(x, 1, z, '#5a3a22'); v.set(x, 2, z, '#7a5032'); } // the rail (a gap amidships)
      if (z < 9 && !edge) { v.set(x, 1, z, '#9a6c40'); v.set(x, 2, z, '#a8784a'); } // the raised bow
    }
  }
  for (let z = 57; z <= 57; z++) for (let x = 20; x <= 40; x++) if (Math.abs(x + 0.5 - 30) <= half(57)) { v.set(x, 1, z, '#5a3a22'); v.set(x, 2, z, '#5a3a22'); }
  for (let z = 2; z >= -4; z--) v.set(30, 3 + Math.round((2 - z) * 0.3), z, '#4a3020'); // the bowsprit
  // Masts and sails.
  for (const [mz, h] of [[12, 30], [34, 36]]) {
    for (let y = 1; y <= h; y++) v.set(30, y, mz, '#4a3020');
    for (const [a, b, w] of [[h - 18, h - 9, 9], [h - 8, h - 2, 7]]) {
      for (let x = 30 - w; x <= 30 + w; x++) v.set(x, b + 1, mz, '#4a3020');
      for (let y = a; y <= b; y++) for (let x = 30 - w; x <= 30 + w; x++) v.set(x, y, mz + 1 + (Math.abs(x - 30) < w - 2 && y > a && y < b ? 1 : 0), '#f4ecdc');
    }
    v.box(29, h - 1, mz - 1, 32, h, mz + 2, '#6b4528'); // crow's nest
  }
  for (let x = 31; x <= 34; x++) for (let j = 0; j < 2; j++) v.set(x, 36 - j, 34, '#3f6fa8'); // pennant
  // The helm, barrels, crates and coiled rope.
  for (let y = 1; y <= 3; y++) v.set(30, y, 56, '#4a3020');
  for (const [dx, dy] of [[-1, 3], [1, 3], [0, 4], [0, 2], [-1, 4], [1, 4], [-1, 2], [1, 2]]) v.set(30 + dx, dy + 1, 55, '#6b4528');
  barrel(v, 20, 0, 14); barrel(v, 38, 0, 15); crate(v, 21, 0, 42); crate(v, 37, 0, 41, 2, '#8a5a34');
  for (const [x, z] of [[24, 28], [36, 18]]) for (let a = 0; a < 8; a++) v.set(x + Math.round(Math.cos(a) * 1.2), 1, z + Math.round(Math.sin(a) * 1.2), '#c4a878');
  v.light(30, 4, 57, '#ffd27a');
  return {
    v,
    heroSpots: [[26, 46], [34, 46], [22, 50], [38, 50], [30, 50], [26, 53], [34, 53]],
    npcSpots: [[30, 22], [23, 24], [37, 24], [22, 30], [38, 30], [25, 38], [35, 38], [30, 28], [20, 20]],
    mood: { bg: 'linear-gradient(#6aaad8, #cfe8f4 70%, #3a86b0 71%)', sky: '#f4f8ff', ground: '#3a6a80', hemi: 1.45, sun: '#fff0d4', sunPower: 2.5, sunAt: [-40, 70, 40], exposure: 1.05 },
  };
}

// A finer sailors' bar in Ytterhavn: polished wood, a long bar with brass, shelves of bottles,
// kegs, a ship's wheel and a sea chart on the walls, portholes, a fireplace, tables and lanterns.
function tavern() {
  const v = new Vox(SIZE, { corner: 3 });
  slab(v, (x, z) => (Math.floor(z / 2) % 2 ? '#8a5a34' : '#7a4e2c'));
  for (let x = 0; x < SIZE; x++) for (let z = 0; z <= 2; z++) for (let y = 1; y <= 22; y++) v.set(x, y, z, y % 6 === 0 ? '#3a2416' : '#4a3020');
  for (const [x0, x1] of [[0, 2], [SIZE - 3, SIZE - 1]]) for (let x = x0; x <= x1; x++) for (let z = 3; z <= 44; z++) for (let y = 1; y <= 14; y++) v.set(x, y, z, y === 14 ? '#3a2416' : y < 5 ? '#4a3020' : '#5a3a26');
  // Shelves of bottles behind the bar, kegs below.
  for (let x = 14; x <= 46; x++) for (const y of [7, 11, 15]) v.set(x, y, 3, '#3a2416');
  for (let x = 15; x <= 45; x++) for (const y of [8, 12, 16]) if (hash(x, y, 31) > 0.35) v.set(x, y, 3, ['#3f8a5a', '#8a3a2a', '#c9a44a', '#5a7aa8', '#e8e2d6'][Math.floor(hash(y, x, 32) * 5)]);
  for (let x = 15; x <= 45; x += 4) v.box(x, 1, 3, x + 3, 4, 5, (cx, cy) => (cy === 2 ? '#c9a44a' : '#7a4e2c'));
  // The bar: dark wood with a polished top and a brass foot rail.
  v.box(16, 1, 9, 45, 4, 12, '#5a3a26');
  v.box(16, 4, 9, 45, 5, 12, '#7a3e1e');
  for (let x = 16; x < 45; x++) v.set(x, 1, 12, '#c9a44a');
  for (const x of [20, 27, 34, 41]) { v.light(x, 5, 10, '#ffd27a'); }
  // A ship's wheel and a sea chart on the walls, portholes, a fireplace.
  for (let a = 0; a < 16; a++) v.set(3, 11 + Math.round(Math.sin(a / 16 * 6.28) * 3), 20 + Math.round(Math.cos(a / 16 * 6.28) * 3), '#6b4528');
  for (let a = 0; a < 4; a++) for (let r = 0; r <= 4; r++) v.set(3, 11 + Math.round(Math.sin(a * 0.785) * r), 20 + Math.round(Math.cos(a * 0.785) * r), '#7a5032');
  for (let z = 18; z <= 30; z++) for (let y = 6; y <= 12; y++) v.set(56, y, z, z === 18 || z === 30 || y === 6 || y === 12 ? '#3a2416' : noise(z, y, 3, 7) > 0.55 ? '#c9b07a' : '#7aa8c8');
  for (const z of [10, 36]) for (const x of [3, 56]) for (const [dz, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) v.light(x, 9 + dy, z + dz, '#bfe0f0');
  v.box(3, 1, 30, 6, 9, 39, '#7a7068');
  v.box(4, 1, 32, 6, 5, 37, '#2a2220');
  v.light(5, 1, 33, '#ff8a3c'); v.light(5, 2, 34, '#ffb347'); v.light(5, 1, 35, '#ff9a3c');
  // Tables with stools, lanterns.
  for (const [x, z] of [[11, 22], [48, 22], [12, 40], [48, 38]]) {
    v.box(x, 1, z, x + 1, 3, z + 1, '#4a3020');
    v.box(x - 1, 3, z - 1, x + 2, 4, z + 2, '#7a4e2c');
    for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) v.set(x + dx, 1, z + dz, '#5a3a26');
    v.light(x, 4, z, '#ffd27a');
  }
  // A blue-and-gold rug before the bar.
  for (let x = 22; x <= 38; x++) for (let z = 15; z <= 33; z++) v.set(x, 0, z, x === 22 || x === 38 || z === 15 || z === 33 ? '#c9a44a' : (x + z) % 6 === 0 ? '#c9a44a' : '#2f4f7a');
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 7], [24, 17], [36, 17], [17, 28], [43, 28], [26, 24], [34, 24], [24, 31], [36, 31]],
    mood: { bg: 'radial-gradient(ellipse at 50% 30%, #4a2a18, #1a0e08)', sky: '#ffd9a8', ground: '#4a2a1a', hemi: 1.3, sun: '#ffcf90', sunPower: 1.6, sunAt: [-20, 70, 50], exposure: 1.1 },
  };
}

// A simple street shop: a shopfront with a striped awning and a counter, shelves of goods,
// potions, a rack of blades, barrels of apples outside, houses on both sides.
function shop() {
  const v = new Vox(SIZE, { corner: 5 });
  slab(v, (x, z) => ((x + Math.floor(z / 2)) % 3 === 0 ? '#c4b8a4' : '#d8ccb8'));
  // The shop: back and side walls, a roof over the back, open at the front.
  v.box(14, 1, 0, 47, 15, 2, '#e3d4b4');
  for (const x0 of [14, 45]) v.box(x0, 1, 2, x0 + 2, 15, 13, '#d8c8a4');
  for (let i = 0; i <= 4; i++) v.box(13 + i, 15 + i, 0, 48 - i, 16 + i, 7, '#b8552f');
  v.box(16, 9, 12, 45, 15, 13, '#e3d4b4'); // the wall above the shopfront
  // The striped awning and the sign.
  for (let x = 15; x <= 46; x++) for (let z = 13; z <= 17; z++) v.set(x, 9 - (z - 13 > 2 ? 1 : 0), z, Math.floor(x / 2) % 2 ? '#c94a3a' : '#f2ece0');
  for (let x = 25; x <= 35; x++) for (let y = 11; y <= 13; y++) v.set(x, y, 13, x === 25 || x === 35 || y === 11 || y === 13 ? '#c9a44a' : '#4a3020');
  v.set(29, 12, 14, '#e8e2d6'); v.set(30, 12, 14, '#c94a3a'); v.set(31, 12, 14, '#3f8a5a');
  // Shelves of goods, the counter with potions, a rack of blades.
  for (let x = 17; x <= 44; x++) for (const y of [4, 8, 12]) { v.set(x, y, 2, '#6b4528'); if (hash(x, y, 41) > 0.45) v.set(x, y + 1, 2, ['#a87a48', '#e8e2d6', '#8a3a2a', '#5a7aa8', '#c9a44a'][Math.floor(hash(y, x, 42) * 5)]); }
  v.box(18, 1, 9, 43, 3, 11, '#7a4e2c');
  v.box(18, 3, 9, 43, 4, 11, '#9a6c40');
  for (const [x, c] of [[21, '#d9503f'], [23, '#5aa8d9'], [25, '#8fd36a'], [27, '#b98cd9']]) v.light(x, 4, 10, c);
  for (let i = 0; i < 4; i++) { v.set(36 + i * 2, 4, 10, '#e8dcc0'); v.set(36 + i * 2, 5, 10, '#e8dcc0'); }
  for (let y = 1; y <= 7; y++) v.set(16, y, 6, '#6b4528');
  for (let i = 0; i < 3; i++) for (let y = 3; y <= 8; y++) v.set(17, y, 4 + i * 2, y === 3 ? '#4a3020' : '#dfe6ee');
  // Outside: barrels of apples, crates, a bench, lanterns, houses on both sides.
  for (const [x, z] of [[11, 18], [48, 19]]) { barrel(v, x, 0, z); v.set(x, 4, z, '#c9302a'); v.set(x + 1, 4, z + 1, '#d9503f'); v.set(x + 1, 4, z, '#7aa84a'); }
  crate(v, 8, 0, 22); crate(v, 50, 0, 23, 2, '#8a5a34');
  for (const [x, z] of [[14, 20], [46, 20]]) lamp(v, x, z, 5);
  row(v, 'z', 0, 16, { x: 0, d: 13, face: 'east', h: [13, 17], seed: 19 });
  row(v, 'z', 0, 16, { x: 47, d: 13, face: 'west', h: [13, 17], seed: 23 });
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 6], [22, 18], [38, 18], [26, 24], [34, 24], [18, 28], [42, 28], [30, 30], [14, 25]],
    mood: { bg: 'linear-gradient(#8cc6e8, #f4e6c8)', sky: '#fff4e2', ground: '#b8b0a0', hemi: 1.5, sun: '#ffe6c0', sunPower: 2.4, sunAt: [-45, 65, 45], exposure: 1.05 },
  };
}

export const AREAS = {
  camp: { name: 'The camp of the Man Who Makes Himself Known', short: 'The camp', build: camp },
  wolf: { name: 'The Wolf', short: 'The Wolf', build: wolf },
  port: { name: 'The port of Razz of Mataz', short: 'The port', build: port },
  alley: { name: 'Hooknose Alley', short: 'Hooknose Alley', build: alley },
  gate: { name: 'Outside the city gates', short: 'The city gates', build: gate },
  road: { name: 'The road from Razz to Ytterhavn', short: 'The road', build: plainRoad },
  ytter: { name: 'Ytterhavn city centre', short: 'Ytterhavn', build: ytterCentre },
  ytterport: { name: 'The port of Ytterhavn', short: 'Ytterhavn port', build: ytterPort },
  ship: { name: 'Aboard a small ship', short: 'The ship', build: ship },
  tavern: { name: 'A sailors’ bar in Ytterhavn', short: 'The bar', build: tavern },
  shop: { name: 'A street shop', short: 'The shop', build: shop },
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

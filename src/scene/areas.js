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

function slab(v, top, { bottom = -3, height = () => 0, water = null, bed, side = null } = {}) {
  v.ground({
    heightAt: height,
    top,
    side: side ?? ((x, z, y) => (y < -1 ? '#8a6a48' : '#a8875a')),
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
// Props are sized to the figures (about 12 voxels tall): a barrel is waist high, a crate knee high.
function barrel(v, x, y, z) {
  for (let i = 1; i <= 5; i++) for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) {
    if ((dx === 0 || dx === 2) && (dz === 0 || dz === 2)) continue; // round it off
    v.set(x + dx, y + i, z + dz, i === 2 || i === 4 ? '#4a3a2a' : '#8a5a34');
  }
}
function crate(v, x, y, z, s = 2, c = '#a87a48') {
  const n = s * 2;
  v.box(x, y + 1, z, x + n, y + 1 + n, z + n, (cx, cy, cz) => {
    const edge = [cx - x, cy - y - 1, cz - z].filter((q) => q === 0 || q === n - 1).length >= 2;
    return edge ? shade(c, 0.7) : c;
  });
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
  crate(v, 18, 0, 8, 3, '#7a5a38'); crate(v, 41, 0, 25);
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
// A rich seafaring city: tall merchant houses with stepped gables (Copenhagen), pale stone and
// terracotta roofs (Lisbon). Everything is sized to the figures (about 12 voxels tall): doors are
// 13 high, a ground floor 16, an upper floor 13. Detail comes from the architecture: plinths,
// quoins, string courses, framed doors and windows with sills and lintels, shutters, a cornice.

// A town house. `face` is the side its front looks to: 'south' (+z, towards the camera), 'east'
// (+x) or 'west' (−x). w is the width along the front, d the depth.
function townhouse(v, { x, z, w, d, floors = 2, face = 'south', wall, roof = '#5a4a48', trim = '#f2ece0', door = '#4a3020', shutters = null }) {
  const P = (u, y, t, c) => {
    if (face === 'south') v.set(x + u, y, z + d - 1 - t, c);
    else if (face === 'east') v.set(x + d - 1 - t, y, z + u, c);
    else v.set(x + t, y, z + u, c);
  };
  const G = 16, F = 13, top = G + F * (floors - 1) + 1; // the cornice row
  const base = shade(wall, 0.78), glass = '#2e3a48';
  for (let u = 0; u < w; u++) for (let t = 0; t < d; t++) for (let y = 1; y < top; y++) P(u, y, t, y <= 2 ? base : wall);
  // Corner quoins, string courses between the floors, the cornice.
  for (let y = 3; y < top; y++) if (Math.floor(y / 2) % 2) { P(0, y, 0, trim); P(w - 1, y, 0, trim); }
  for (let k = 0; k < floors - 1; k++) for (let u = 0; u < w; u++) { P(u, G + F * k, 0, trim); P(u, G + F * k, -1, trim); }
  for (let u = -1; u <= w; u++) { P(u, top, 0, trim); P(u, top, -1, trim); }
  // Bays of windows; the middle bay of the ground floor is the door.
  const n = Math.max(2, Math.floor((w - 2) / 5)), bay = (i) => Math.round(1 + (i + 0.5) * (w - 2) / n);
  const win = (cu, y0, h) => {
    for (let u = cu - 1; u <= cu + 1; u++) {
      for (let y = y0; y < y0 + h; y++) P(u, y, 0, y === y0 + Math.floor(h / 2) || u === cu ? shade(trim, 0.92) : glass);
      P(u, y0 - 1, -1, trim); P(u, y0 + h, 0, trim); // the sill and the lintel
    }
    if (shutters) for (let y = y0; y < y0 + h; y++) { P(cu - 2, y, 0, shutters); P(cu + 2, y, 0, shutters); }
  };
  for (let i = 0; i < n; i++) {
    const cu = bay(i);
    if (i === Math.floor(n / 2)) {
      for (let u = cu - 2; u <= cu + 2; u++) for (let y = 1; y <= 13; y++) P(u, y, 0, u === cu - 2 || u === cu + 2 || y === 13 ? trim : y === 12 ? glass : door);
      for (let u = cu - 1; u <= cu + 1; u++) P(u, 1, -1, shade(trim, 0.85)); // the step
    } else win(cu, 5, 8);
    for (let k = 1; k < floors; k++) win(cu, G + F * (k - 1) + 3, 8);
  }
  // A stepped gable facing the street (steps of 2), with a little round window; the roof runs back.
  for (let i = 0; ; i++) {
    const lo = 2 * Math.floor(i / 2), hi = w - 1 - lo;
    if (lo > hi) break;
    for (let u = lo; u <= hi; u++) for (let t = 0; t < d; t++) P(u, top + 1 + i, t, t === 0 ? (u === lo || u === hi ? trim : wall) : (i % 2 ? roof : shade(roof, 0.88)));
  }
  const mid = Math.floor(w / 2);
  P(mid, top + 4, 0, glass); P(mid - 1, top + 4, 0, glass);
  for (let y = top + 1; y <= top + 7; y++) P(w - 3, y, Math.floor(d / 2), '#6a5a52');
}
const PALETTE_TOWN = ['#e8b84a', '#c94a3a', '#3f6fa8', '#e89a5a', '#7aa86a', '#f2ece0', '#d9a6b0', '#e6d7a0'];
const ROOFS_TOWN = ['#c4623a', '#5a4a48', '#b8552f', '#4a4a52'];
// A row of houses along x or z from `from` to `to`.
function row(v, along, from, to, opts) {
  let u = from, i = 0;
  const seed = opts.seed ?? 3;
  while (u < to) {
    let w = 12 + Math.floor(hash(u, i, seed) * 5);
    if (to - u - w < 10) w = to - u;
    const k = Math.floor(hash(i, u, seed + 1) * PALETTE_TOWN.length);
    const floors = opts.floors[0] + Math.floor(hash(u, i, seed + 2) * (opts.floors[1] - opts.floors[0] + 1));
    townhouse(v, { ...opts, [along]: u, w, floors, wall: PALETTE_TOWN[k], roof: ROOFS_TOWN[(i + k) % ROOFS_TOWN.length], shutters: hash(i, u, 9) > 0.55 ? shade(PALETTE_TOWN[(k + 3) % PALETTE_TOWN.length], 0.6) : null });
    u += w; i++;
  }
}
// A street lamp, a little taller than a person.
function lamp(v, x, z, h = 15) {
  for (let y = 1; y <= h; y++) v.set(x, y, z, '#2e2a2e');
  v.set(x, 1, z, '#3a3640'); v.set(x + 1, 1, z, '#3a3640');
  v.light(x, h + 1, z, '#ffd27a'); v.light(x, h + 2, z, '#ffd27a');
  v.set(x, h + 3, z, '#2e2a2e');
}

// The road between Razz of Mataz and Ytterhavn: a road of packed earth with cart ruts and a stone
// kerb, through land that turns from Razz's desert (left) into Ytterhavn's grassland (right).
function plainRoad() {
  const v = new Vox(SIZE, { corner: 8 });
  const mid = (z) => 30 + Math.sin(z / 11) * 3;
  const onRoad = (x, z) => Math.abs(x - mid(z)) <= 4;
  const green = (x, z) => Math.max(0, Math.min(1, (x - 24 + (noise(x, z, 7, 31) - 0.5) * 16 + (z - 30) * 0.15) / 10));
  const sand = ['#e8cf96', '#dfc489', '#ecd7a2'], grass = ['#8cc35c', '#7fb553', '#98cb66', '#86bd58'];
  slab(v, (x, z) => {
    if (onRoad(x, z)) {
      const d = Math.abs(x - mid(z));
      if (d > 3.5) return '#9a948a';
      if (Math.abs(d - 2) < 0.6) return '#8a7050';
      return hash(x, z, 5) > 0.85 ? '#a08060' : '#b09470';
    }
    const t = green(x, z);
    if (t <= 0.15) return pick(x, z, 21, sand);
    if (t >= 0.85) return pick(x, z, 22, grass);
    return hash(x, z, 26) < t ? '#b8c47a' : '#d8c890';
  }, { height: (x, z) => {
    if (z >= 12 || onRoad(x, z)) return 0;
    return green(x, z) > 0.5 ? Math.round(Math.max(0, noise(x, z, 9, 6) * 9 - z * 0.4)) : Math.round(Math.max(0, noise(x, z, 6, 8) * 5 - z * 0.25));
  } });
  // A milestone and a signpost by the road, a cart left on the verge.
  { const x = Math.round(mid(18) + 7); v.box(x, 1, 18, x + 2, 7, 20, '#cfc6b6'); v.box(x, 7, 18, x + 2, 8, 20, '#b8b0a2'); }
  { const x = Math.round(mid(30) - 7); for (let y = 1; y <= 17; y++) v.set(x, y, 30, '#6b4a2e'); for (let i = 1; i <= 6; i++) { v.set(x - i, 16, 30, '#a8784a'); v.set(x - i, 15, 30, '#a8784a'); } for (let i = 1; i <= 6; i++) { v.set(x + i, 13, 30, '#a8784a'); v.set(x + i, 12, 30, '#a8784a'); } }
  v.box(42, 4, 34, 50, 7, 42, '#8a5a34');
  for (const z of [34, 41]) for (let x = 42; x < 50; x++) v.set(x, 8, z, '#7a4e2c');
  for (const [x, z] of [[41, 35], [41, 40], [50, 35], [50, 40]]) for (let y = 1; y <= 5; y++) for (const dz of [-1, 0, 1]) if (y === 1 || y === 5 || dz === 0) v.set(x, y, z + dz, '#4a3426');
  for (let x = 44; x <= 47; x++) v.set(x, 4, 44, '#6b4528'); for (let z = 42; z <= 46; z++) { v.set(44, 4, z, '#6b4528'); v.set(47, 4, z, '#6b4528'); }
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 24], [25, 20], [35, 20], [23, 28], [36, 28], [30, 16], [26, 33], [33, 34], [20, 22]],
    mood: { bg: 'linear-gradient(#8cc6e8, #f2e8d0)', sky: '#fff6e8', ground: '#b8a878', hemi: 1.5, sun: '#fff0d4', sunPower: 2.5, sunAt: [-40, 70, 50], exposure: 1.05 },
  };
}

// Ytterhavn's city centre: a wave-paved square with a fountain and statue, rows of tall merchant
// houses, a domed exchange with a portico and a copper-green dome, and a canal along one side.
function ytterCentre() {
  const v = new Vox(SIZE, { corner: 5 });
  v.waterColour = '#3f8fb0';
  slab(v, (x, z, h) => (h < 0 ? '#9a948a' : x === 8 ? '#b8b0a2' : Math.sin(x * 0.55 + Math.sin(z * 0.3) * 2.2) > 0.8 ? '#8a8478' : '#e8e2d6'),
    { height: (x) => (x < 8 ? -2 : 0), water: 0, bed: () => '#5a6a72' });
  boat(v, 2, 0, 20, { length: 9, hull: '#9a3a2a', axis: 'z' });
  row(v, 'x', 9, 21, { z: 0, d: 10, floors: [2, 2], seed: 3 });
  row(v, 'x', 41, 60, { z: 0, d: 10, floors: [2, 2], seed: 7 });
  row(v, 'z', 12, 50, { x: 50, d: 10, face: 'west', floors: [2, 2], seed: 11 });
  // The exchange: pale stone, a portico of columns with a pediment, and a dome with a lantern.
  townhouse(v, { x: 21, z: 0, w: 20, d: 10, floors: 2, wall: '#f2ece0', roof: '#c4623a', trim: '#e0d6c4' });
  for (let x = 22; x <= 38; x += 4) for (let y = 1; y <= 25; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) v.set(x + dx, y, 11 + dz, y <= 1 || y >= 24 ? '#e0d6c4' : '#f7f2e8');
  v.box(21, 26, 10, 41, 28, 14, '#e0d6c4');
  for (let i = 0; i < 6; i++) v.box(21 + i * 2, 28 + i, 13, 41 - i * 2, 29 + i, 14, '#efe8da');
  for (let y = 0; y < 9; y++) {
    const r = Math.round(Math.sqrt(Math.max(0, 49 - (y * 0.85) ** 2)));
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r) v.set(30 + x, 31 + y, 5 + z, y === 0 ? '#e0d6c4' : y % 3 === 0 ? '#4f8a76' : '#5f9a86');
  }
  for (let y = 40; y <= 43; y++) v.set(30, y, 5, '#e0d6c4'); v.light(30, 44, 5, '#ffd27a');
  // The fountain: a stone basin, a column and a bronze statue of a sailor.
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
    const d = Math.hypot(x, z);
    if (d > 5.4) continue;
    if (d > 4.4) for (let y = 1; y <= 3; y++) v.set(30 + x, y, 21 + z, y === 3 ? '#e0d6c4' : '#cfc6b6');
    else { v.water.set(v.key(30 + x, 1, 21 + z), 1); v.water.set(v.key(30 + x, 2, 21 + z), 1); }
  }
  for (let y = 1; y <= 7; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) v.set(30 + dx, y, 21 + dz, '#cfc6b6');
  const bronze = '#7a6a4a';
  for (let y = 8; y <= 16; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) v.set(30 + dx, y, 21 + dz, bronze);
  v.box(30, 17, 21, 32, 19, 23, '#8a7a5a');
  for (let y = 13; y <= 18; y++) v.set(32, y, 21, bronze); // a raised arm
  // Two market stalls with striped awnings and baskets of produce.
  for (const [x0, cl] of [[10, '#3f6fa8'], [42, '#c94a3a']]) {
    v.box(x0, 1, 13, x0 + 8, 6, 16, '#8a5a34');
    v.box(x0, 6, 13, x0 + 8, 7, 16, '#6b4528');
    [['#c9302a', 1], ['#e89a3a', 4], ['#7aa84a', 7]].forEach(([c, dx]) => { v.box(x0 + dx - 1, 7, 13, x0 + dx + 1, 8, 15, '#7a5a38'); v.set(x0 + dx - 1, 8, 13, c); v.set(x0 + dx, 8, 13, c); v.set(x0 + dx - 1, 8, 14, c); v.set(x0 + dx, 8, 14, c); });
    for (const x of [x0, x0 + 7]) for (const z of [13, 16]) for (let y = 1; y <= 15; y++) v.set(x, y, z, '#5b4a3a');
    for (let x = x0 - 1; x <= x0 + 8; x++) for (let z = 12; z <= 18; z++) v.set(x, z > 16 ? 15 : 16, z, Math.floor(x / 2) % 2 ? cl : '#f2ece0');
  }
  for (const [x, z] of [[12, 24], [47, 24], [12, 42], [47, 42]]) lamp(v, x, z);
  // Bollards along the canal, a little arched bridge over it, two benches.
  for (let z = 12; z < 58; z += 4) { v.set(8, 1, z, '#4a4a50'); v.set(8, 2, z, '#4a4a50'); v.set(8, 3, z, '#4a4a50'); }
  for (let x = 0; x <= 8; x++) { const y = 1 + (x > 1 && x < 7 ? 1 : 0); for (let z = 46; z <= 50; z++) v.set(x, y, z, '#cfc6b6'); for (const z of [46, 50]) for (let k = 1; k <= 3; k++) v.set(x, y + k, z, '#b8b0a2'); }
  for (const [x, z] of [[20, 14], [35, 14]]) { v.box(x, 1, z, x + 6, 3, z + 2, '#6b4528'); v.box(x, 3, z, x + 6, 7, z + 1, '#6b4528'); v.set(x, 1, z, '#2e2a2e'); v.set(x + 5, 1, z, '#2e2a2e'); }
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 31], [21, 29], [39, 29], [18, 21], [42, 21], [24, 36], [36, 36], [16, 33], [44, 34]],
    mood: { bg: 'linear-gradient(#7fbce8, #f4e6c8)', sky: '#fff4e2', ground: '#b8b0a0', hemi: 1.5, sun: '#ffe6c0', sunPower: 2.5, sunAt: [-45, 65, 45], exposure: 1.05 },
  };
}

// A three-masted merchant ship for the harbour, along x, to the figures' scale. y is the waterline.
function galleon(v, x0, y, z0, len = 40) {
  for (let i = 0; i < len; i++) {
    const end = Math.min(i, len - 1 - i), hw = Math.min(5, 1 + end / 2.5);
    for (let k = -Math.floor(hw); k <= Math.floor(hw); k++) for (let j = -2; j <= 6; j++) {
      const side = Math.abs(k) >= Math.floor(hw) - 0;
      if (j === 6 && !side) { v.set(x0 + i, y + j, z0 + k, i % 2 ? '#a8784a' : '#9a6c40'); continue; }
      if (!side && j < 6) continue;
      v.set(x0 + i, y + j, z0 + k, j === 2 ? '#c9a44a' : j <= -1 ? '#7a3a2a' : j === 4 && i % 5 === 2 ? '#1e140c' : '#5a3a22');
    }
    if (Math.floor(hw) >= 2) { v.set(x0 + i, y + 7, z0 - Math.floor(hw), '#4a3020'); v.set(x0 + i, y + 7, z0 + Math.floor(hw), '#4a3020'); }
  }
  v.box(x0 + len - 8, y + 7, z0 - 3, x0 + len - 1, y + 11, z0 + 4, '#6b4528'); // the stern castle
  for (let k = -2; k <= 2; k += 2) v.light(x0 + len - 1, y + 9, z0 + k, '#ffcf70');
  for (const [i, h] of [[8, 30], [19, 36], [30, 26]]) {
    for (let j = 7; j <= h; j++) v.set(x0 + i, y + j, z0, '#4a3020');
    for (const [a, b, w] of [[12, h - 10, 7], [h - 9, h - 2, 5]]) {
      for (let k = -w - 1; k <= w + 1; k++) v.set(x0 + i, y + b + 1, z0 + k, '#4a3020');
      for (let j = a; j <= b; j++) for (let k = -w; k <= w; k++) v.set(x0 + i + 1, y + j, z0 + k, (j - a) % 4 === 3 ? '#e4dccb' : '#f4ecdc');
    }
  }
  for (let i = -7; i < 0; i++) v.set(x0 + i, y + 6 - Math.round(i * 0.35), z0, '#4a3020');
  for (let k = 1; k <= 4; k++) for (let j = 0; j < 2; j++) v.set(x0 + 19 + k, y + 36 - j, z0, '#3f6fa8');
}

// The port of Ytterhavn: a stone quay, a big merchant ship and a smaller boat, a crane, warehouses,
// crates and barrels.
function ytterPort() {
  const v = new Vox(SIZE, { corner: 6 });
  v.waterColour = '#3a8fb4';
  slab(v, (x, z, h) => (h < 0 ? '#9a948a' : z === 22 || z === 23 ? '#8a847c' : (x + z) % 5 === 0 ? '#a8a296' : '#bab4a8'),
    { height: (x, z) => (z < 22 ? -3 : 0), water: 0, bed: () => '#6a7a80' });
  galleon(v, 10, 0, 11, 40);
  boat(v, 50, 0, 18, { length: 7, hull: '#3f6fa8', mast: false });
  for (let x = 4; x < SIZE - 4; x += 8) for (let y = 1; y <= 3; y++) { v.set(x, y, 22, '#4a4a50'); v.set(x + 1, y, 22, '#4a4a50'); }
  // A wooden crane swinging a load over the quay.
  for (let y = 1; y <= 26; y++) for (const [dx, dz] of [[0, 0], [1, 0]]) v.set(12 + dx, y, 27 + dz, '#6b4528');
  for (let z = 16; z <= 28; z++) v.set(12, 26, z, '#6b4528');
  for (let y = 16; y <= 25; y++) v.set(12, y, 17, '#3a3a3a');
  crate(v, 10, 11, 16, 2, '#a87a48');
  // Warehouses on both sides.
  row(v, 'z', 26, 60, { x: 0, d: 8, face: 'east', floors: [2, 2], seed: 13 });
  row(v, 'z', 26, 60, { x: 52, d: 8, face: 'west', floors: [2, 2], seed: 17 });
  crate(v, 16, 0, 26); crate(v, 16, 4, 26, 2, '#8a5a34'); crate(v, 20, 0, 27, 2, '#8a5a34');
  crate(v, 42, 0, 26); barrel(v, 46, 0, 27); barrel(v, 38, 0, 40); barrel(v, 41, 0, 41);
  for (const [x, z] of [[16, 42], [44, 46]]) lamp(v, x, z);
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 29], [24, 31], [36, 31], [21, 35], [36, 36], [27, 36], [32, 38], [18, 34], [44, 34]],
    mood: { bg: 'linear-gradient(#7ab4dc, #f2dcb4)', sky: '#fff1dc', ground: '#9a948a', hemi: 1.45, sun: '#ffd8a8', sunPower: 2.4, sunAt: [-50, 55, 40], exposure: 1.05 },
  };
}

// A small wooden ship at sea (on the way to Sirivik), riding high so its hull shows: planked sides
// with a gold stripe and gun ports, a red bottom, a raised bow with a figurehead and an anchor,
// stern windows, two masts with sails and rigging, a hatch, the helm, a bell, barrels and rope.
// Its deck is at y = D (`standY`), so everyone stands on it.
function ship() {
  const D = 4;
  const v = new Vox(SIZE, { corner: 10 });
  v.waterColour = '#2f86b0';
  slab(v, () => '#3a6a80', { height: () => -6, water: -1, bed: () => '#2a4a5a', bottom: -8 });
  const half = (z) => (z > 30 ? 16 * Math.sqrt(Math.max(0, 1 - ((z - 30) / 32) ** 2)) : 16 * Math.sqrt(Math.max(0, 1 - ((z - 30) / 27) ** 2)));
  const width = (z, y) => half(z) * (0.5 + 0.5 * Math.min(1, (y + 6) / (D + 6)) ** 0.7); // the hull narrows below
  for (let z = 3; z <= 57; z++) {
    const hw = half(z);
    for (let x = 0; x < SIZE; x++) {
      const off = Math.abs(x + 0.5 - 30);
      for (let y = -6; y <= D; y++) {
        const w = width(z, y);
        if (off > w) continue;
        const side = off > w - 1.3 || z === 57 && y < D;
        let c;
        if (y === D) c = off > hw - 1.2 ? '#5a3a22' : x % 2 ? '#a8784a' : '#9a6c40';
        else if (y < -1) c = '#7a3a2a'; // the red bottom
        else if (y === 1) c = '#c9a44a'; // the gold stripe
        else if (side && y === 2 && z % 6 === 0 && z > 12 && z < 54) c = '#1e140c'; // gun ports
        else c = y % 2 ? '#6b4528' : '#5e3c22';
        v.set(x, y, z, c);
      }
      const edge = off > hw - 1.2 && off <= hw;
      if (edge && !(z > 20 && z < 26)) { v.set(x, D + 1, z, z % 3 ? '#7a5032' : '#4a3020'); v.set(x, D + 2, z, '#5a3a22'); }
      if (z < 9 && off <= hw - 1.2) { v.set(x, D + 1, z, '#9a6c40'); v.set(x, D + 2, z, '#a8784a'); } // the raised bow
      if (off <= hw && off > hw - 1.5 && hash(x, z, 71) > 0.6) v.set(x, -1, z + (z < 30 ? -1 : 1), '#e8f4f8'); // foam at the waterline
    }
  }
  // The transom with lit windows and lanterns at the stern corners.
  for (let x = 22; x <= 38; x++) if (Math.abs(x + 0.5 - 30) <= half(57)) { v.set(x, D + 1, 57, '#5a3a22'); v.set(x, D + 2, 57, '#5a3a22'); }
  for (const x of [25, 28, 31, 34]) for (const y of [2, 3]) v.light(x, y, 58, '#ffcf70');
  for (const x of [24, 36]) { v.set(x, D + 3, 57, '#2e2a2e'); v.light(x, D + 4, 57, '#ffd27a'); }
  // The bowsprit with a golden figurehead, and an anchor hanging at the bow.
  for (let z = 2; z >= -5; z--) v.set(30, D + 2 + Math.round((2 - z) * 0.35), z, '#4a3020');
  for (const [y, z] of [[D - 1, 2], [D, 2], [D + 1, 1], [D, 1]]) v.set(30, y, z, '#d9a63a');
  { const ax = Math.round(30 + half(8)); for (let y = D - 4; y <= D; y++) v.set(ax, y, 8, '#4a4a50'); v.set(ax, D - 4, 7, '#4a4a50'); v.set(ax, D - 4, 9, '#4a4a50'); v.set(ax, D - 3, 6, '#4a4a50'); v.set(ax, D - 3, 10, '#4a4a50'); }
  // Masts, sails, yards, crow's nests, and rigging down to the rails.
  for (const [mz, h] of [[12, 30], [34, 36]]) {
    for (let y = D + 1; y <= D + h; y++) v.set(30, y, mz, '#4a3020');
    for (const [a, b, w] of [[h - 18, h - 9, 9], [h - 8, h - 2, 7]]) {
      for (let x = 30 - w - 1; x <= 30 + w + 1; x++) v.set(x, D + b + 1, mz, '#4a3020');
      for (let y = a; y <= b; y++) for (let x = 30 - w; x <= 30 + w; x++) v.set(x, D + y, mz + 1 + (Math.abs(x - 30) < w - 2 && y > a && y < b ? 1 : 0), (y - a) % 4 === 3 ? '#e4dccb' : '#f4ecdc');
    }
    v.box(28, D + h - 1, mz - 2, 33, D + h, mz + 3, '#6b4528');
    const hw = half(mz);
    for (const s of [-1, 1]) for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      v.set(Math.round(30 + s * (1 + t * (hw - 2))), Math.round(D + h - 3 - t * (h - 6)), mz - 1, '#3a2a1e');
    }
  }
  for (let x = 31; x <= 35; x++) for (let j = 0; j < 2; j++) v.set(x, D + 36 - j, 34, x === 35 && j ? '#f4ecdc' : '#3f6fa8'); // the pennant
  // A hatch with a grating, the helm, a bell, barrels, crates and coiled rope.
  for (let x = 27; x <= 33; x++) for (let z = 39; z <= 43; z++) v.set(x, D, z, x === 27 || x === 33 || z === 39 || z === 43 ? '#5a3a22' : (x + z) % 2 ? '#3a2416' : '#7a5032');
  for (let y = D + 1; y <= D + 3; y++) v.set(30, y, 56, '#4a3020');
  for (let a = 0; a < 12; a++) v.set(30 + Math.round(Math.cos(a / 12 * 6.28) * 2), D + 4 + Math.round(Math.sin(a / 12 * 6.28) * 2), 55, '#6b4528');
  v.set(30, D + 4, 55, '#c9a44a');
  for (let y = D + 3; y <= D + 5; y++) v.set(26, y, 8, '#4a3020'); v.set(27, D + 5, 8, '#4a3020'); v.set(27, D + 4, 8, '#c9a44a');
  barrel(v, 20, D, 14); barrel(v, 38, D, 15); barrel(v, 39, D, 18); crate(v, 21, D, 42); crate(v, 37, D, 41, 2, '#8a5a34'); crate(v, 37, D + 2, 41, 2, '#a87a48');
  for (const [x, z] of [[24, 28], [36, 18]]) for (let a = 0; a < 8; a++) v.set(x + Math.round(Math.cos(a) * 1.2), D + 1, z + Math.round(Math.sin(a) * 1.2), '#c4a878');
  return {
    v, standY: D,
    heroSpots: [[26, 46], [34, 46], [22, 50], [38, 50], [30, 50], [26, 53], [34, 53]],
    npcSpots: [[30, 22], [23, 24], [37, 24], [22, 30], [38, 30], [25, 36], [35, 36], [30, 28], [20, 20]],
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

// A simple street shop, to the figures' scale: a two-storey house with an open shopfront under a
// striped awning, a counter, shelves of wares and a hanging sign; houses on both sides.
function shop() {
  const v = new Vox(SIZE, { corner: 5 });
  slab(v, (x, z) => ((x + Math.floor(z / 2)) % 3 === 0 ? '#c4b8a4' : '#d8ccb8'));
  const wall = '#e3d4b4', trim = '#f2ece0', wood = '#6b4528';
  // The shop: back wall, side walls, the upper floor over the front, a roof over the back half.
  v.box(14, 1, 0, 47, 31, 2, wall);
  for (const x0 of [14, 45]) v.box(x0, 1, 2, x0 + 2, 31, 13, wall);
  v.box(14, 18, 12, 47, 31, 14, wall);
  for (let x = 14; x < 47; x++) { v.set(x, 18, 14, trim); v.set(x, 31, 14, trim); v.set(x, 31, 13, trim); }
  for (const cx of [20, 30, 40]) { for (let x = cx - 1; x <= cx + 1; x++) { for (let y = 21; y <= 28; y++) v.set(x, y, 14, x === cx || y === 25 ? '#e4dccb' : '#2e3a48'); v.set(x, 20, 15, trim); v.set(x, 29, 14, trim); } }
  for (let i = 0; i <= 6; i++) v.box(13 + i, 32 + i, 0, 48 - i, 33 + i, 8, i % 2 ? '#b8552f' : '#a84a28');
  for (const x of [16, 44]) for (let y = 1; y <= 17; y++) v.set(x, y, 13, '#5a4a3a'); // the shopfront posts
  // The striped awning and the hanging sign.
  for (let x = 15; x <= 46; x++) for (let z = 14; z <= 19; z++) v.set(x, 17 - Math.floor((z - 14) / 2), z, Math.floor(x / 3) % 2 ? '#c94a3a' : '#f2ece0');
  for (let y = 18; y <= 19; y++) v.set(48, y, 15, '#2e2a2e'); for (let z = 15; z <= 18; z++) v.set(48, 19, z, '#2e2a2e');
  v.box(48, 12, 16, 49, 18, 20, '#4a3020'); v.box(48, 13, 17, 49, 17, 19, '#c9a44a');
  // Inside: shelves of wares (jars, rolls of cloth, books), a counter, a rack of blades, a lantern.
  for (const y of [5, 10, 15]) for (let x = 17; x <= 43; x++) v.set(x, y, 2, wood);
  for (let x = 18; x <= 42; x += 2) { v.set(x, 6, 2, '#a87a48'); v.set(x, 7, 2, '#a87a48'); }
  for (let x = 18; x <= 42; x += 3) { v.set(x, 11, 2, '#3f6fa8'); v.set(x + 1, 11, 2, '#7a3a44'); v.set(x, 12, 2, '#3f6fa8'); v.set(x + 1, 12, 2, '#7a3a44'); }
  for (let x = 18; x <= 42; x++) { v.set(x, 16, 2, x % 2 ? '#6a3a2a' : '#4a3a5a'); v.set(x, 17, 2, x % 2 ? '#6a3a2a' : '#4a3a5a'); }
  v.box(18, 1, 9, 43, 6, 12, '#7a4e2c');
  v.box(17, 6, 9, 44, 7, 12, '#9a6c40');
  for (const [x, c] of [[21, '#d9503f'], [24, '#5aa8d9'], [27, '#8fd36a']]) { v.light(x, 7, 10, c); v.light(x, 8, 10, c); v.set(x, 9, 10, '#8a6440'); }
  for (let i = 0; i < 3; i++) for (let y = 4; y <= 12; y++) v.set(18, y, 4 + i * 2, y === 4 ? '#4a3020' : '#dfe6ee');
  for (let y = 1; y <= 13; y++) v.set(18, y, 3, wood);
  v.light(30, 16, 7, '#ffd27a');
  // Outside: barrels of apples, a crate, a lamp, houses on both sides.
  for (const [x, z] of [[9, 18], [49, 22]]) { barrel(v, x, 0, z); for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) v.set(x + dx, 6, z + dz, '#c9302a'); }
  crate(v, 8, 0, 24);
  lamp(v, 12, 30); lamp(v, 48, 31);
  row(v, 'z', 0, 16, { x: 0, d: 13, face: 'east', floors: [2, 2], seed: 19 });
  row(v, 'z', 0, 16, { x: 47, d: 13, face: 'west', floors: [2, 2], seed: 23 });
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 6], [23, 19], [37, 19], [27, 25], [34, 25], [20, 28], [41, 28], [30, 31], [16, 24]],
    mood: { bg: 'linear-gradient(#8cc6e8, #f4e6c8)', sky: '#fff4e2', ground: '#b8b0a0', hemi: 1.5, sun: '#ffe6c0', sunPower: 2.4, sunAt: [-45, 65, 45], exposure: 1.05 },
  };
}

// --- Sirivik -------------------------------------------------------------------------------------
// The square of Sirivik at the top of its obsidian cliff, always in fog: dark stone houses, the
// wooden lift down to the ships, gibbet cages hanging over the drop with crows on them, a wall of
// black obsidian, a statue with an arm and its face broken off, and a
// small shrine with candles and an empty cradle.
// A shabby, broken wooden house for Sirivik, sized to the figures: grey weathered planks, gaps and
// holes in the walls, broken windows (one boarded up), a sagging roof missing shingles, a crooked
// door and a lean. Same arguments as townhouse (x, z, w, d, face); `seed` varies the damage.
function shack(v, { x, z, w, d, face = 'south', seed = 1, wall = '#8a8070' }) {
  const P = (u, y, t, c) => {
    if (face === 'south') v.set(x + u, y, z + d - 1 - t, c);
    else if (face === 'east') v.set(x + d - 1 - t, y, z + u, c);
    else v.set(x + t, y, z + u, c);
  };
  const C = (u, y, t) => {
    if (face === 'south') v.clear(x + u, y, z + d - 1 - t);
    else if (face === 'east') v.clear(x + d - 1 - t, y, z + u);
    else v.clear(x + t, y, z + u);
  };
  const h = 24, hole = '#1a1614', post = '#3e3630';
  const plank = (u, y, t) => { const n = hash(u + seed * 7, y, t + seed); return n > 0.88 ? shade(wall, 0.7) : n > 0.6 ? shade(wall, 0.88) : wall; };
  const lean = hash(seed, 1, 2) > 0.5 ? 1 : -1;
  for (let u = 0; u < w; u++) for (let t = 0; t < d; t++) for (let y = 1; y <= h; y++) {
    if (t > 0 && t < d - 1 && u > 0 && u < w - 1) continue; // hollow inside
    const uu = u + (y > h * 0.6 ? lean : 0); // the top leans a little
    P(uu, y, t, u === 0 || u === w - 1 || y === 13 ? post : plank(u, y, t));
  }
  // Holes and missing planks in the front.
  for (let i = 0; i < 4; i++) {
    const hu = 1 + Math.floor(hash(seed, i, 3) * (w - 3)), hy = 2 + Math.floor(hash(seed, i, 4) * (h - 6));
    for (let k = 0; k < 2 + Math.floor(hash(i, seed, 5) * 3); k++) C(hu, hy + k, 0);
    P(hu, hy - 1, -1, shade(wall, 0.7)); // a broken plank hanging off
  }
  // The door, crooked and dark, and broken windows: jagged holes with a few shards; some boarded up.
  const mid = Math.floor(w / 2);
  for (let u = mid - 2; u <= mid + 1; u++) for (let y = 1; y <= 12; y++) P(u, y, 0, u === mid + 1 && y > 9 ? hole : '#3a2e26');
  for (const [wu, wy, boarded] of [[2, 6, false], [w - 5, 6, hash(seed, 9, 9) > 0.5], [3, 17, false], [w - 5, 17, true]]) {
    if (wu < 1 || wu + 2 >= w - 1) continue;
    for (let u = wu; u <= wu + 2; u++) for (let y = wy; y <= wy + 4; y++) {
      if (boarded) P(u, y, 0, (y - wy) % 2 ? '#5a4632' : hole);
      else P(u, y, 0, hash(u, y, seed) > 0.75 ? '#8a9aa4' : hole);
    }
  }
  // A sagging, gappy roof.
  for (let i = 0; ; i++) {
    const lo = i, hi = w - 1 - i;
    if (lo > hi) break;
    for (let u = lo; u <= hi; u++) for (let t = 0; t < d; t++) {
      if (hash(u + seed, i, t) > 0.86) continue; // missing shingles
      P(u + lean, h + 1 + i, t, t === 0 ? post : i % 2 ? '#3a3632' : '#2e2a28');
    }
  }
  for (let y = h + 1; y <= h + 6; y++) P(w - 3, y, Math.floor(d / 2), '#4a4642');
  P(w - 2, h + 6, Math.floor(d / 2), '#4a4642');
}

// (the cliff edge of Sirivik)
function sirivikSquare() {
  const v = new Vox(SIZE, { corner: 5 });
  v.waterColour = '#2a4a5a';
  v.mistColour = '#b8bcc4';
  const cliff = (z) => z < 14;
  slab(v, (x, z, h) => (h < 0 ? '#1e1a24' : hash(x, z, 51) > 0.92 ? '#4e4a58' : (x + z) % 7 === 0 ? '#3a3644' : '#433f4c'),
    { height: (x, z) => (cliff(z) ? -12 : 0), water: -10, bed: () => '#1a2a30', bottom: -14, side: (x, z, y) => (hash(x, y, z) > 0.85 ? '#3e3a48' : '#24202c') });
  for (let x = 0; x < SIZE; x++) for (let y = -11; y <= 0; y++) if (v.inside(x, 14)) v.set(x, y, 14, hash(x, y, 52) > 0.85 ? '#3e3a48' : '#24202c'); // the cliff face
  // Houses of dark stone down the left side.
  for (const [i, z0] of [[0, 18], [1, 32], [2, 46]]) shack(v, { x: 0, z: z0, w: 14, d: 10, face: 'east', seed: i + 3, wall: ['#8a8070', '#7e7464', '#928674'][i] });
  // A wall of black obsidian down the right side.
  for (let x = 52; x < SIZE; x++) for (let z = 16; z < 52; z++) for (let y = 1; y <= 14; y++) v.set(x, y, z, hash(x, y, z) > 0.9 ? '#2e2a38' : '#1e1a24');
  // The lift: a wooden tower at the edge, a beam over the drop, ropes, the platform far below.
  const wood = '#4a3a2e', rope = '#a8906a';
  for (const [x, z] of [[8, 14], [14, 14], [8, 19], [14, 19]]) for (let y = 1; y <= 22; y++) v.set(x, y, z, wood);
  for (let x = 8; x <= 14; x++) for (const z of [14, 19]) { v.set(x, 22, z, wood); v.set(x, 12, z, wood); }
  for (let z = 6; z <= 19; z++) v.set(11, 23, z, wood);
  for (let y = -8; y <= 22; y++) { v.set(10, y, 7, rope); v.set(12, y, 7, rope); }
  v.box(8, -9, 4, 15, -8, 10, wood);
  v.box(10, 21, 15, 13, 24, 18, '#5a4632'); // the winch house
  // Gibbet cages hanging over the drop from posts at the edge, with crows.
  for (const x of [38, 47]) {
    for (let y = 1; y <= 20; y++) v.set(x, y, 16, wood);
    for (let z = 9; z <= 16; z++) v.set(x, 20, z, wood);
    for (let y = 14; y <= 19; y++) v.set(x, y, 9, '#3a3a40');
    for (let y = 6; y <= 13; y++) for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, -2], [0, 2], [-2, 0], [2, 0]]) v.set(x + dx, y, 9 + dz, '#3a3a40');
    v.box(x - 2, 6, 7, x + 3, 7, 12, '#3a3a40'); v.box(x - 2, 13, 7, x + 3, 14, 12, '#3a3a40');
    v.set(x, 7, 9, '#d8cfbe'); v.set(x, 8, 9, '#d8cfbe'); v.set(x - 1, 7, 8, '#d8cfbe');
    for (const [dx, dz] of [[-1, -2], [1, 2]]) { v.set(x + dx, 15, 9 + dz, '#141216'); v.set(x + dx, 16, 9 + dz, '#141216'); }
  }
  for (const [x, z] of [[30, 16], [20, 26]]) { v.set(x, 1, z, '#141216'); v.set(x, 2, z, '#141216'); }
  // The statue: a figure on a plinth, one arm gone (it lies at the foot), the face sheared off.
  const stone = '#8a857c';
  v.box(27, 1, 19, 34, 4, 25, '#5e5a54');
  v.box(29, 4, 21, 30, 12, 23, stone); v.box(31, 4, 21, 32, 12, 23, stone);
  v.box(28, 12, 21, 33, 21, 23, stone);
  for (let y = 13; y <= 20; y++) v.set(27, y, 22, stone);
  v.box(29, 21, 21, 32, 25, 23, stone);
  v.box(29, 22, 23, 32, 25, 24, '#6e6a62'); // the broken face
  v.box(34, 1, 26, 37, 2, 27, stone); v.set(37, 2, 26, stone);
  v.set(30, 26, 22, '#141216'); v.set(31, 26, 22, '#141216'); // a crow on its head
  // The shrine: an altar with candles, an empty cradle on it, and odd offerings left at its foot.
  v.box(17, 1, 15, 25, 5, 18, '#4a4650');
  v.box(19, 5, 16, 24, 6, 18, '#6b4a2e'); v.set(19, 6, 16, '#6b4a2e'); v.set(23, 6, 16, '#6b4a2e'); v.set(19, 6, 17, '#6b4a2e'); v.set(23, 6, 17, '#6b4a2e');
  v.box(20, 6, 16, 23, 7, 18, '#e8e0d0');
  for (const x of [17, 24]) { v.set(x, 5, 18, '#e8e0d0'); v.set(x, 6, 18, '#e8e0d0'); v.light(x, 7, 18, '#ffcf70'); }
  for (const [x, c] of [[18, '#5a3a22'], [20, '#8a6a4a'], [22, '#5a3a22']]) v.set(x, 1, 19, c); // odd shoes, one each
  // Dim lamps, barrels, and fog rolling up over the edge and through the square.
  for (const [x, z] of [[16, 34], [44, 36]]) lamp(v, x, z);
  barrel(v, 46, 0, 44);
  for (let x = 4; x < 56; x += 8) v.puff(x, -2 + hash(x, 1, 53) * 6, 6, 7, 5, 6);
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 31], [22, 28], [38, 29], [18, 23], [42, 22], [25, 37], [35, 37], [16, 30], [44, 30]],
    mood: { bg: 'linear-gradient(#4a4e5a, #8a8e96)', sky: '#d4d8e0', ground: '#4a4650', hemi: 1.45, sun: '#d8dce8', sunPower: 1.6, sunAt: [-30, 70, 40], exposure: 1.2 },
  };
}

// The guards' cellar under Ytterhavn's watch house, where troublemakers are thrown: damp stone, a
// row of barred cells with straw and a bucket, chains on the wall, a high grated window letting in
// a little daylight, a guard's table with a candle, a ring of keys and a stairway up.
function cellar() {
  const v = new Vox(SIZE, { corner: 3 });
  const stone = (x, y, z) => (hash(x, y, z) > 0.85 ? '#4e4a46' : hash(x, y, z) > 0.6 ? '#5a5650' : '#66625a');
  slab(v, (x, z) => (hash(x, z, 61) > 0.8 ? '#4a4640' : '#57534c'));
  // Walls: back and sides, a low vaulted feel.
  for (let x = 0; x < SIZE; x++) for (let z = 0; z <= 2; z++) for (let y = 1; y <= 26; y++) v.set(x, y, z, stone(x, y, z));
  for (const [x0, x1] of [[0, 2], [SIZE - 3, SIZE - 1]]) for (let x = x0; x <= x1; x++) for (let z = 3; z <= 44; z++) for (let y = 1; y <= 18; y++) v.set(x, y, z, stone(x, y, z));
  // A high grated window in the back wall with a shaft of light.
  for (let x = 27; x <= 33; x++) for (let y = 21; y <= 24; y++) if (x % 2) v.set(x, y, 2, '#2e2a26'); else v.light(x, y, 2, '#dfe8f0');
  for (let x = 27; x <= 33; x++) for (let z = 10; z <= 16; z++) v.set(x, 0, z, '#8a867c'); // the patch of daylight on the floor
  // Three cells across the back, with iron bars and a door each.
  const iron = '#2e2e34';
  for (const [x0, x1] of [[3, 18], [21, 38], [41, 56]]) {
    for (let x = x0; x <= x1; x++) for (let y = 1; y <= 16; y++) if (x % 2 === 0 || y === 1 || y === 8 || y === 16) v.set(x, y, 16, iron);
    for (let z = 3; z <= 16; z++) for (let y = 1; y <= 16; y++) { v.set(x0 - 1, y, z, stone(x0, y, z)); }
    for (let x = x0 + 1; x <= x0 + 8; x++) for (let z = 4; z <= 9; z++) if (hash(x, z, 62) > 0.3) v.set(x, 1, z, hash(x, z, 63) > 0.5 ? '#c4a860' : '#a88e4a'); // straw
    v.box(x1 - 3, 1, 4, x1 - 1, 3, 6, '#6b4528'); // a bucket
    for (let y = 9; y <= 13; y++) { v.set(x0 + 3, y, 3, '#3a3a40'); v.set(x0 + 8, y, 3, '#3a3a40'); } // chains on the wall
    v.box(x0 + 2, 8, 3, x0 + 4, 9, 4, '#3a3a40'); v.box(x0 + 7, 8, 3, x0 + 9, 9, 4, '#3a3a40');
  }
  // One cell door hangs open.
  for (let z = 17; z <= 23; z++) for (let y = 1; y <= 16; y++) if (z % 2 === 1 || y === 1 || y === 16) v.set(37, y, z, iron);
  // The guard's table with a candle, a stool, a ring of keys on a hook, the stair up.
  v.box(46, 1, 30, 54, 7, 36, '#5a3a22'); v.box(45, 7, 29, 55, 8, 37, '#6b4528');
  v.set(50, 8, 32, '#e8e0d0'); v.light(50, 9, 32, '#ffcf70'); v.set(52, 8, 34, '#d9a63a'); v.set(53, 8, 34, '#d9a63a');
  v.box(48, 1, 38, 51, 5, 41, '#4a3020');
  for (let y = 9; y <= 12; y++) v.set(56, y, 26, '#3a3a40'); v.set(56, 8, 27, '#d9a63a'); v.set(56, 7, 26, '#d9a63a');
  for (let i = 0; i < 8; i++) v.box(3, 1, 30 + i * 2, 9, 2 + i * 2, 32 + i * 2, '#6e6a62'); // stone steps up along the left wall
  v.light(4, 12, 30, '#ffb347'); v.set(3, 11, 30, '#3a3a40'); // a torch in a bracket
  return {
    v, heroSpots: [[12, 9], [16, 11], [24, 9], [30, 11], [44, 9], [49, 11], [36, 9]], // the heroes are inside the cells
    npcSpots: [[30, 30], [40, 33], [22, 32], [34, 38], [26, 38], [44, 26], [18, 26], [38, 28], [30, 42]],
    mood: { bg: 'radial-gradient(ellipse at 50% 30%, #2a2622, #0e0c0a)', sky: '#d0d4dc', ground: '#4a4640', hemi: 1.55, sun: '#ffe0b8', sunPower: 1.8, sunAt: [-20, 70, 40], exposure: 1.25 },
  };
}

// A bedroom at an inn in Ytterhavn, for resting and healing: a warm room under a sloping ceiling,
// two beds with patchwork quilts, a washstand with a jug, a chest, a little table with a candle,
// a rug, a fireplace, and a window looking out on the masts in the harbour.
function innRoom() {
  const v = new Vox(SIZE, { corner: 3 });
  slab(v, (x, z) => (Math.floor(x / 3) % 2 ? '#9a6c40' : '#8a5e36'));
  const plaster = (x, y, z) => (hash(x, y, z) > 0.9 ? '#e0d4bc' : '#ece2cc'), beam = '#5a3a22';
  for (let x = 0; x < SIZE; x++) for (let z = 0; z <= 2; z++) for (let y = 1; y <= 22; y++) v.set(x, y, z, x % 15 === 0 || y === 22 ? beam : plaster(x, y, z));
  for (const [x0, x1] of [[0, 2], [SIZE - 3, SIZE - 1]]) for (let x = x0; x <= x1; x++) for (let z = 3; z <= 44; z++) for (let y = 1; y <= 14; y++) v.set(x, y, z, z % 12 === 0 || y === 14 ? beam : plaster(x, y, z));
  // The window: harbour sky and masts outside, a sill with a pot of herbs.
  for (let x = 24; x <= 36; x++) for (let y = 8; y <= 17; y++) {
    const edge = x === 24 || x === 36 || y === 8 || y === 17 || x === 30 || y === 12;
    v.light(x, y, 2, edge ? '#5a3a22' : (x === 27 && y > 11) || (x === 33 && y > 13) ? '#4a3020' : y < 11 ? '#9cc8e8' : '#c8e0f0');
  }
  v.box(23, 7, 2, 38, 8, 4, '#6b4528'); v.set(34, 8, 3, '#b8552f'); v.set(34, 9, 3, '#5aa86a');
  // Two beds with quilts and pillows.
  const bed = (x0, quilt) => {
    v.box(x0, 1, 4, x0 + 10, 4, 22, '#6b4528');
    v.box(x0, 4, 4, x0 + 10, 9, 5, '#5a3a22');
    v.box(x0 + 1, 4, 6, x0 + 9, 5, 21, '#f2ece0');
    v.box(x0 + 2, 5, 6, x0 + 8, 6, 9, '#ffffff');
    for (let x = x0 + 1; x <= x0 + 9; x++) for (let z = 11; z <= 21; z++) v.set(x, 5, z, quilt[(Math.floor(x / 2) + Math.floor(z / 2)) % quilt.length]);
  };
  bed(5, ['#a8342a', '#e8b84a', '#3f6fa8', '#f2ece0']); bed(44, ['#3f7a5a', '#e8dcc0', '#a8342a', '#c4a050']);
  // A washstand with a jug and basin, a chest at the foot of a bed, a table with a candle and a book.
  v.box(17, 1, 4, 22, 7, 8, '#7a4e2c'); v.box(18, 7, 5, 21, 8, 7, '#e8eef0'); v.box(19, 8, 5, 20, 11, 6, '#e8eef0');
  v.box(45, 1, 24, 54, 6, 28, '#6b4528'); v.box(45, 6, 24, 54, 7, 28, '#5a3a22'); v.set(49, 5, 28, '#d9a63a');
  v.box(27, 1, 26, 33, 7, 31, '#7a4e2c'); v.box(26, 7, 25, 34, 8, 32, '#8a5a34');
  v.set(28, 8, 27, '#e8e0d0'); v.light(28, 9, 27, '#ffcf70'); v.box(31, 8, 28, 33, 9, 30, '#7a3a44');
  // A fireplace on the left wall, warm and lit.
  v.box(3, 1, 30, 6, 13, 40, '#7a7068'); v.box(4, 1, 32, 6, 6, 38, '#2a2220');
  v.light(5, 1, 33, '#ff8a3c'); v.light(5, 2, 34, '#ffb347'); v.light(5, 1, 36, '#ff9a3c'); v.light(5, 2, 35, '#ffd27a');
  v.box(3, 13, 29, 7, 14, 41, '#5a3a22');
  // A round rug in the middle and boots by the door.
  for (let x = -7; x <= 7; x++) for (let z = -5; z <= 5; z++) if ((x / 7) ** 2 + (z / 5) ** 2 <= 1) v.set(30 + x, 0, 38 + z, (x / 7) ** 2 + (z / 5) ** 2 > 0.7 ? '#c4a050' : '#3f6f8a');
  v.box(50, 1, 40, 52, 4, 42, '#3a2a20'); v.box(52, 1, 40, 54, 4, 42, '#3a2a20');
  return {
    v,
    heroSpots: [[10, 14], [49, 14], [26, 36], [34, 36], [30, 42], [20, 40], [40, 40]], // two lying in the beds
    npcSpots: [[30, 24], [38, 34], [22, 34], [40, 26], [20, 26], [44, 34], [16, 34], [30, 30], [36, 44]],
    mood: { bg: 'radial-gradient(ellipse at 50% 30%, #5a3a24, #2a160a)', sky: '#ffe2b8', ground: '#5a3a24', hemi: 1.45, sun: '#ffd8a8', sunPower: 1.8, sunAt: [-20, 70, 50], exposure: 1.1 },
  };
}

// The bridge east of Ytterhavn: a river running across the scene from the mountains (back) to the
// sea, an arched wooden bridge with stone ends, the dirt road over it, reeds, rocks, and under the
// bridge the troll's nook with bones and a stolen cart wheel.
function bridgeArea() {
  const v = new Vox(SIZE, { corner: 8 });
  v.waterColour = '#3f9ac0';
  const river = (x, z) => Math.abs(z - (26 + Math.sin(x / 8) * 3)) < 6;
  const road = (x) => Math.abs(x - 30) < 4;
  slab(v, (x, z, h) => (h < 0 ? '#7a8a8a' : road(x) ? (hash(x, z, 5) > 0.8 ? '#8a7050' : '#a68e64') : river(x, z + 1) || river(x, z - 1) ? '#8a9a5a' : pick(x, z, 22, ['#8cc35c', '#7fb553', '#98cb66'])),
    { height: (x, z) => (river(x, z) ? -3 : z < 8 ? Math.round(Math.max(0, noise(x, z, 8, 3) * 10 - z * 0.6)) : 0), water: -1, bed: () => '#6a7a6a' });
  // The bridge: an arch of planks with rails, on stone ends, at the figures' scale.
  const zc = 26, half = 10;
  for (let z = zc - half; z <= zc + half; z++) {
    const lift = Math.round(Math.cos(((z - zc) / half) * Math.PI / 2) * 4);
    for (let x = 26; x <= 34; x++) v.set(x, lift, z, (z + x) % 2 ? '#8a6440' : '#7a5636');
    for (const x of [26, 34]) { if (z % 3 === 0) for (let y = lift + 1; y <= lift + 6; y++) v.set(x, y, z, '#5b4a3a'); v.set(x, lift + 6, z, '#6b4528'); }
  }
  for (const z of [zc - half - 1, zc + half + 1]) v.box(25, 0, z - 1, 36, 2, z + 2, '#9a948a');
  for (const z of [zc - 2, zc + 2]) for (let y = -3; y <= 2; y++) { v.set(27, y, z, '#5a4632'); v.set(33, y, z, '#5a4632'); } // piers in the water
  // The troll's nook under the bridge: bones, a cart wheel, a pot.
  for (const [x, z] of [[22, 31], [23, 33], [38, 30]]) { v.set(x, 1, z, '#e8e0c8'); v.set(x + 1, 1, z, '#e8e0c8'); }
  for (let a = 0; a < 12; a++) v.set(40 + Math.round(Math.cos(a / 12 * 6.28) * 3), 1 + Math.round(Math.sin(a / 12 * 6.28) * 3) + 3, 32, '#6b4528');
  v.box(19, 1, 33, 22, 4, 36, '#3a3a40');
  // Reeds and rocks along the banks, a few trees, a milestone.
  for (let x = 2; x < SIZE - 2; x += 3) for (const s of [-1, 1]) { const z = Math.round(26 + Math.sin(x / 8) * 3 + s * 7); if (!road(x) && hash(x, z, 9) > 0.4) for (let y = 1; y <= 3; y++) v.set(x, y, z, '#6a8a3a'); }
  for (const [x, z] of [[8, 40], [50, 12], [46, 44]]) v.box(x, 1, z, x + 3, 3, z + 2, '#9a948a');
  for (const [x, z, sz] of [[6, 46, 2], [52, 46, 1], [10, 12, 1]]) tree(v, x, 0, z, { size: sz });
  v.box(37, 1, 44, 39, 7, 46, '#cfc6b6');
  return {
    v, standY: 0,
    heroSpots: [[28, 48], [32, 48], [24, 52], [36, 52], [30, 53], [20, 50], [40, 50]],
    npcSpots: [[30, 26], [24, 28], [36, 27], [30, 12], [26, 10], [34, 10], [20, 40], [40, 40], [30, 40]],
    mood: { bg: 'linear-gradient(#8cc6e8, #e8f2e0)', sky: '#fff6e8', ground: '#8aa86a', hemi: 1.5, sun: '#fff0d4', sunPower: 2.5, sunAt: [-40, 70, 50], exposure: 1.05 },
  };
}

// The lighthouse in Siri's Gap: a rocky islet in the sea with the red-and-white tower, its lit
// lamp, the keeper's cottage, a little jetty with a rowing boat, nets drying and gulls.
function lighthouseArea() {
  const v = new Vox(SIZE, { corner: 8 });
  v.waterColour = '#2a5a6e';
  v.mistColour = '#c4c8d0';
  const rock = (x, z) => Math.hypot((x - 30) * 0.9, z - 26) < 21 + noise(x, z, 5, 4) * 6;
  // Black obsidian rock, like the cliffs of Sirivik across the water, with grey stone paths.
  slab(v, (x, z, h) => (h < 0 ? '#2a3a44' : hash(x, z, 7) > 0.75 ? '#3a3644' : '#2a2632'),
    { height: (x, z) => (rock(x, z) ? Math.round(noise(x, z, 6, 2) * 3) : -4), water: -1, bed: () => '#1e2a30', side: (x, z, y) => (hash(x, y, z) > 0.8 ? '#3a3644' : '#24202c') });
  for (let x = 14; x <= 46; x++) for (let z = 8; z <= 40; z++) if (rock(x, z)) { for (let y = 1; y <= 4; y++) v.clear(x, y, z); v.set(x, 0, z, hash(x, z, 8) > 0.7 ? '#4a4652' : '#3a3644'); }
  for (let z = 22; z <= 40; z++) for (let x = 15; x <= 18; x++) v.set(x, 0, z, '#6a665e'); // the path to the jetty
  // The tower: red and white bands, a gallery, the lamp room with a glowing lamp, a dark cap.
  const cx = 36, cz = 14;
  for (let y = 1; y <= 40; y++) {
    const r = 5 - Math.floor(y / 14);
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r + 1) v.set(cx + x, y, cz + z, Math.floor(y / 6) % 2 ? '#b8433a' : '#f1ece2');
  }
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (x * x + z * z <= 17) v.set(cx + x, 41, cz + z, '#2f2a2e');
  for (let y = 42; y <= 45; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (x * x + z * z <= 5) { if (Math.abs(x) === 2 || Math.abs(z) === 2) v.set(cx + x, y, cz + z, '#2f2a2e'); else v.light(cx + x, y, cz + z, '#ffd98a'); }
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (x * x + z * z <= 10) v.set(cx + x, 46, cz + z, '#2f2a2e');
  v.set(cx, 47, cz, '#2f2a2e');
  v.box(cx - 1, 1, cz + 4, cx + 2, 9, cz + 6, '#5a3a22'); // the door
  // The keeper's cottage: whitewashed stone, a dark roof, a chimney and a lit window.
  v.box(16, 1, 12, 28, 10, 22, '#ece6da');
  for (let i = 0; i <= 5; i++) v.box(15 + i, 10 + i, 11, 29 - i, 11 + i, 23, '#3e3a40');
  v.box(25, 10, 14, 27, 19, 16, '#7a746c');
  v.box(19, 1, 22, 22, 8, 23, '#3a5a7a'); v.light(24, 5, 22, '#ffcf70'); v.light(25, 5, 22, '#ffcf70'); v.light(24, 6, 22, '#ffcf70'); v.light(25, 6, 22, '#ffcf70');
  // A jetty to the south-west with a rowing boat, nets drying on poles, barrels.
  for (let z = 40; z <= 56; z++) for (let x = 12; x <= 16; x++) v.set(x, 0, z, (z + x) % 2 ? '#8a6440' : '#7a5636');
  for (const z of [44, 50, 56]) for (const x of [12, 16]) for (let y = -4; y <= 0; y++) v.set(x, y, z, '#5a4632');
  boat(v, 19, 0, 46, { length: 8, hull: '#3f6fa8', axis: 'z', mast: false });
  for (const x of [38, 46]) for (let y = 1; y <= 9; y++) v.set(x, y, 32, '#5b4a3a');
  for (let x = 39; x <= 45; x++) for (let y = 3; y <= 8; y++) if ((x + y) % 2) v.set(x, y, 32, '#9a8a6a');
  barrel(v, 30, 0, 22); barrel(v, 33, 0, 23);
  // Gulls on the rocks, a crow on the cottage roof.
  for (const [x, z] of [[10, 30], [48, 22], [44, 40]]) { v.set(x, 3, z, '#f4f4f4'); v.set(x + 1, 3, z, '#f4f4f4'); v.set(x, 4, z, '#f4f4f4'); }
  v.set(22, 16, 17, '#141216'); v.set(22, 17, 17, '#141216');
  // Fog banks round the islet and drifting over the sea.
  for (let a = 0; a < 6; a++) { const ang = a / 6 * 6.28 + 0.4; v.puff(30 + Math.cos(ang) * 27, 2 + hash(a, 1, 9) * 4, 28 + Math.sin(ang) * 27, 5, 3, 4); }
  v.puff(46, 30, 8, 6, 3, 4);
  return {
    v, standY: 0,
    heroSpots: [[22, 34], [28, 35], [18, 37], [33, 37], [25, 38], [14, 38], [38, 38]],
    npcSpots: [[30, 27], [24, 26], [36, 26], [20, 29], [40, 30], [28, 31], [34, 32], [16, 30], [44, 34]],
    mood: { bg: 'linear-gradient(#5a6070, #9aa0aa)', sky: '#d4d8e0', ground: '#3a3a44', hemi: 1.45, sun: '#dce0ea', sunPower: 1.6, sunAt: [-30, 70, 40], exposure: 1.2 },
  };
}


// The old road past the dark forest of Sortland: a worn, overgrown track; on the left the forest
// turns from green to grey, dense dark pines and bare dead trees under a low mist; on the right
// open grass. An old waystone, a broken fence, a cart track.
function forestRoad() {
  const v = new Vox(SIZE, { corner: 8 });
  v.mistColour = '#7a7488';
  const mid = (z) => 34 + Math.sin(z / 10) * 3;
  const onRoad = (x, z) => Math.abs(x - mid(z)) <= 4;
  const dark = (x, z) => Math.max(0, Math.min(1, (mid(z) - 5 - x + (noise(x, z, 6, 41) - 0.5) * 8) / 12)); // 1 deep in the forest (left)
  slab(v, (x, z) => {
    if (onRoad(x, z)) return hash(x, z, 5) > 0.75 ? '#7a8a4a' : hash(x, z, 6) > 0.5 ? '#8a7656' : '#7a6848'; // grown over in patches
    const d = dark(x, z);
    return d > 0.5 ? (hash(x, z, 7) > 0.7 ? '#4c5244' : '#43473f') : d > 0.1 ? (hash(x, z, 8) < d * 2 ? '#5e6a48' : '#7aa850') : pick(x, z, 22, ['#8cc35c', '#7fb553', '#98cb66']);
  });
  for (let x = 1; x < SIZE - 1; x += 3) for (let z = 1; z < SIZE - 1; z += 3) {
    const jx = x + Math.floor(hash(x, z, 9) * 2), jz = z + Math.floor(hash(z, x, 9) * 2);
    if (!v.inside(jx, jz, 9) || onRoad(jx, jz) || Math.abs(jx - mid(jz)) < 7) continue;
    const d = dark(jx, jz);
    if (d > 0.3 && hash(jx, jz, 10) < 0.45) {
      if (hash(jx, jz, 11) > 0.35) { for (let y = 1; y <= 14; y++) v.set(jx, y, jz, '#6a645c'); v.set(jx + 1, 9, jz, '#6a645c'); v.set(jx + 2, 10, jz, '#6a645c'); v.set(jx, 11, jz - 1, '#5e5852'); v.set(jx, 12, jz - 2, '#5e5852'); }
      else { for (let y = 1; y <= 3; y++) v.set(jx, y, jz, '#3e3630'); for (let i = 0; i < 5; i++) { const r = 3 - Math.floor(i * 0.7); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (Math.abs(dx) + Math.abs(dz) <= r) v.set(jx + dx, 4 + i * 2, jz + dz, i % 2 ? '#3a443d' : '#36403a'); } }
    } else if (d < 0.05 && hash(jx, jz, 12) > 0.93) tree(v, jx, 0, jz, { size: 1 });
  }
  // A waystone, a broken fence, an old cart wheel in the grass.
  { const x = Math.round(mid(20) + 6); v.box(x, 1, 20, x + 2, 9, 22, '#7a746c'); v.box(x, 9, 20, x + 2, 10, 22, '#6a645c'); }
  for (let z = 30; z < 50; z++) if (hash(z, 3, 13) > 0.35) { const x = Math.round(mid(z) + 7); v.set(x, 2, z, '#6b5a44'); if (z % 3 === 0) v.set(x, 1, z, '#5a4a38'); }
  for (let a = 0; a < 12; a++) v.set(50 + Math.round(Math.cos(a / 12 * 6.28) * 3), 1, 40 + Math.round(Math.sin(a / 12 * 6.28) * 3), '#5a4632');
  // Mist lying low in the forest.
  for (let i = 0; i < 8; i++) v.puff(6 + hash(i, 1, 14) * 18, 2, 6 + i * 6, 6, 2, 4);
  return {
    v, heroSpots: [[30, 44], [36, 44], [27, 49], [39, 49], [33, 50], [24, 52], [42, 52]],
    npcSpots: [[33, 26], [28, 24], [38, 24], [26, 30], [40, 30], [33, 18], [22, 22], [44, 20], [33, 34]],
    mood: { bg: 'linear-gradient(#7a8090, #b8bcb0)', sky: '#e0e4dc', ground: '#4a5040', hemi: 1.4, sun: '#e8e8d8', sunPower: 1.9, sunAt: [-40, 70, 40], exposure: 1.1 },
  };
}

// The road to Sirivik: a grey stone road climbing through bleak, foggy heath towards the cliffs;
// boulders, heather, a gallows post with a crow, a weathered signpost, and the dark shapes of the
// town's roofs and the lift tower in the fog at the end of the road.
function sirivikRoad() {
  const v = new Vox(SIZE, { corner: 8 });
  v.mistColour = '#b8bcc4';
  const mid = (z) => 30 + Math.sin(z / 9) * 4;
  const onRoad = (x, z) => Math.abs(x - mid(z)) <= 3.5;
  slab(v, (x, z) => (onRoad(x, z) ? (hash(x, z, 5) > 0.7 ? '#6a6660' : '#7a766e') : hash(x, z, 6) > 0.85 ? '#7a5a6a' : pick(x, z, 31, ['#6a7458', '#5e6850', '#727a5e'])),
    { height: (x, z) => (onRoad(x, z) || z > 14 ? 0 : Math.round(Math.max(0, noise(x, z, 7, 5) * 6 - z * 0.3))) });
  for (const [x, z] of [[8, 22], [14, 40], [48, 18], [52, 36], [44, 48], [10, 50]]) { v.box(x, 1, z, x + 4, 3 + Math.round(hash(x, z) * 2), z + 3, '#5a5660'); v.set(x + 1, 4, z + 1, '#4a4650'); }
  // A gallows post with an empty noose and a crow; a signpost with one arm.
  for (let y = 1; y <= 22; y++) v.set(40, y, 28, '#3e3228');
  for (let x = 40; x <= 46; x++) v.set(x, 22, 28, '#3e3228');
  for (let y = 15; y <= 21; y++) v.set(45, y, 28, '#a8906a');
  v.set(44, 15, 28, '#a8906a'); v.set(46, 15, 28, '#a8906a');
  v.set(41, 23, 28, '#141216'); v.set(42, 23, 28, '#141216');
  { const x = Math.round(mid(40) - 6); for (let y = 1; y <= 16; y++) v.set(x, y, 40, '#5a4632'); for (let i = 1; i <= 6; i++) { v.set(x + i, 14, 40, '#7a6448'); v.set(x + i, 13, 40, '#7a6448'); } }
  // Sirivik's dark roofs and lift tower in the fog at the far end.
  for (const [x, w, h] of [[20, 7, 14], [28, 6, 18], [35, 8, 12]]) v.box(x, 1, 2, x + w, h, 6, '#3a3640');
  for (let y = 1; y <= 24; y++) { v.set(44, y, 4, '#3a2e26'); v.set(48, y, 4, '#3a2e26'); }
  for (let x = 44; x <= 48; x++) v.set(x, 24, 4, '#3a2e26');
  for (let x = 2; x < 58; x += 7) v.puff(x, 6, 6, 8, 6, 5);
  for (const [x, z] of [[12, 30], [48, 44], [24, 52]]) v.puff(x, 2, z, 7, 2, 5);
  return {
    v, heroSpots: [[28, 44], [34, 44], [25, 49], [37, 49], [31, 50], [22, 52], [40, 52]],
    npcSpots: [[31, 26], [26, 24], [36, 24], [24, 30], [38, 31], [31, 18], [20, 26], [44, 22], [31, 34]],
    mood: { bg: 'linear-gradient(#5a5e68, #9a9ea6)', sky: '#d0d4dc', ground: '#4a4a48', hemi: 1.4, sun: '#d8dce4', sunPower: 1.5, sunAt: [-30, 70, 40], exposure: 1.2 },
  };
}

// Sirivik's town centre: a cramped, foggy street of tall, dark stone houses leaning together, with
// Three-Fingered Paul's shop (a lantern in the window), the hostel and Per Hul Øye's bar sign; a
// dry, cracked well in the middle, laundry lines with single gloves and one-legged trousers,
// crows on the gutters, and a lamp that barely lights.
function sirivikCentre() {
  const v = new Vox(SIZE, { corner: 5 });
  v.mistColour = '#a8acb4';
  slab(v, (x, z) => (hash(x, z, 61) > 0.85 ? '#4e4a58' : (x + 2 * z) % 9 === 0 ? '#3a3644' : '#46424e'));
  shack(v, { x: 0, z: 0, w: 15, d: 10, seed: 1, wall: '#8a8070' });
  shack(v, { x: 15, z: 0, w: 14, d: 10, seed: 2, wall: '#7e7464' }); // the hostel
  shack(v, { x: 29, z: 0, w: 16, d: 10, seed: 3, wall: '#928674' }); // the bar
  shack(v, { x: 45, z: 0, w: 15, d: 10, seed: 4, wall: '#867c6c' });
  shack(v, { x: 0, z: 10, w: 14, d: 10, face: 'east', seed: 5, wall: '#7e7464' }); // Paul's shop
  shack(v, { x: 0, z: 24, w: 16, d: 10, face: 'east', seed: 6, wall: '#8a8070' });
  shack(v, { x: 50, z: 12, w: 16, d: 10, face: 'west', seed: 7, wall: '#928674' });
  shack(v, { x: 50, z: 28, w: 14, d: 10, face: 'west', seed: 8, wall: '#7e7464' });
  // Hanging signs: a bed (the hostel), a mug (the bar), a lantern lit in Paul's window.
  for (const [x, c] of [[22, '#c8c0b0'], [37, '#8a6440']]) { for (let z = 10; z <= 13; z++) v.set(x, 18, z, '#2e2a2e'); v.box(x - 2, 13, 13, x + 3, 17, 14, '#4a3020'); v.box(x - 1, 14, 13, x + 2, 16, 14, c); }
  v.light(10, 9, 14, '#ffb347'); v.light(10, 10, 14, '#ffb347');
  // A dry, cracked well in the middle with a broken bucket.
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { const d = Math.hypot(x, z); if (d > 4.4) continue; if (d > 3.2) for (let y = 1; y <= 4; y++) v.set(30 + x, y, 30 + z, hash(x, y, z) > 0.8 ? '#4a4650' : '#5e5a62'); else v.set(30 + x, 0, 30 + z, '#1a161c'); }
  for (const x of [26, 34]) for (let y = 5; y <= 13; y++) v.set(x, y, 30, '#3e3228');
  for (let x = 26; x <= 34; x++) v.set(x, 13, 30, '#3e3228');
  v.box(29, 7, 29, 31, 9, 31, '#5a4632'); v.set(30, 10, 30, '#a8906a'); v.set(30, 11, 30, '#a8906a'); v.set(30, 12, 30, '#a8906a');
  // Laundry lines across the street: single gloves, one-legged trousers, a shirt with one sleeve.
  for (let x = 14; x <= 50; x++) v.set(x, 22, 22, '#8a8478');
  for (const [x, c, h] of [[18, '#8a7a6a', 4], [22, '#6a6a7a', 6], [27, '#a89a8a', 3], [33, '#7a6a5a', 6], [39, '#6a7a6a', 4], [44, '#9a8a7a', 3]]) for (let y = 22 - h; y < 22; y++) v.set(x, y, 22, c);
  // Crows on the gutters, a dim lamp, a barrel, a bench.
  for (const [x, z] of [[8, 9], [40, 9], [53, 13], [5, 30]]) { v.set(x, 34, z, '#141216'); v.set(x + 1, 34, z, '#141216'); }
  for (let y = 1; y <= 14; y++) v.set(44, y, 40, '#2e2a2e'); v.light(44, 15, 40, '#c8a050');
  barrel(v, 16, 0, 40); v.box(36, 1, 44, 42, 3, 46, '#4a3a2e');
  for (let x = 4; x < 56; x += 10) v.puff(x, 3, 50, 6, 3, 4);
  v.puff(30, 12, 20, 10, 3, 4);
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 38], [22, 33], [38, 33], [18, 26], [42, 26], [24, 40], [36, 41], [16, 34], [44, 34]],
    mood: { bg: 'linear-gradient(#4a4e5a, #8a8e96)', sky: '#d4d8e0', ground: '#4a4650', hemi: 1.5, sun: '#d8dce8', sunPower: 1.6, sunAt: [-30, 70, 40], exposure: 1.2 },
  };
}

// Per Hul Øye's bar in Sirivik: low, smoky and grim, nothing like Ytterhavn's. Rough plank walls
// and a sagging beam ceiling, a scarred bar with a few dusty bottles and one keg, crooked tables,
// a single candle each, a dartboard with knives in it, nets and a cracked mirror, a small dim
// fire, and an empty chair with a crow feather left on it.
function sirivikBar() {
  const v = new Vox(SIZE, { corner: 3 });
  // Grey, rotten floorboards with gaps and a broken hole.
  slab(v, (x, z) => (Math.hypot(x - 22, z - 40) < 2.5 ? '#141210' : z % 3 === 0 && hash(x, z, 72) > 0.6 ? '#1e1a18' : hash(x, z, 71) > 0.85 ? '#4a4640' : Math.floor(z / 3) % 2 ? '#5a554e' : '#524d46'));
  for (let x = 20; x <= 24; x++) v.set(x, 1, 42, '#5a554e'); v.set(25, 1, 39, '#524d46');
  const plank = (x, y, z) => (hash(x, y, z) > 0.9 ? '#4a4640' : y % 4 === 0 ? '#5a554e' : hash(x, y, z) > 0.6 ? '#726c62' : '#7c766a');
  for (let x = 0; x < SIZE; x++) for (let z = 0; z <= 2; z++) for (let y = 1; y <= 20; y++) v.set(x, y, z, plank(x, y, z));
  for (const [x0, x1] of [[0, 2], [SIZE - 3, SIZE - 1]]) for (let x = x0; x <= x1; x++) for (let z = 3; z <= 44; z++) for (let y = 1; y <= 13; y++) v.set(x, y, z, plank(x, y, z));
  // Holes in the walls where planks have rotted away, and a broken window boarded up.
  for (const [x, y, z, n] of [[48, 14, 0, 4], [9, 4, 0, 3], [0, 8, 34, 3], [SIZE - 3, 5, 10, 4]]) for (let k = 0; k < n; k++) for (let t = 0; t <= 2; t++) { if (z === 0) v.clear(x + k, y, t); else v.clear(x + t, y + k, z); }
  for (let x = 38; x <= 46; x++) for (let y = 10; y <= 16; y++) v.set(x, y, 2, (y - 10) % 2 ? '#6a5a44' : (hash(x, y, 73) > 0.7 ? '#8a9aa4' : '#141210'));
  // The bar: scarred wood, a few dusty bottles, one keg, a lantern.
  v.box(14, 1, 9, 44, 5, 12, '#45403a'); v.box(13, 5, 9, 45, 6, 12, '#5a554e'); v.clear(20, 5, 11); v.clear(21, 5, 11); // a chunk broken off the bar top
  for (let x = 16; x <= 42; x++) v.set(x, 8, 3, '#2e241c');
  for (const x of [18, 23, 27, 34, 39]) { v.set(x, 9, 3, hash(x, 1, 2) > 0.5 ? '#3a5a3a' : '#5a3a2a'); v.set(x, 10, 3, '#3a5a3a'); }
  v.box(30, 1, 3, 34, 5, 6, '#5a3a22'); v.set(32, 3, 6, '#2a2a2e');
  v.set(20, 6, 10, '#2e2a2e'); v.light(20, 7, 10, '#c8903a');
  // A cracked mirror and a dartboard with knives, a net on the wall.
  for (let x = 22; x <= 28; x++) for (let y = 11; y <= 16; y++) v.set(x, y, 3, x === 22 || x === 28 || y === 11 || y === 16 ? '#2e241c' : (x + y) % 5 === 0 ? '#6a6e74' : '#9aa0a8');
  for (let a = 0; a < 14; a++) for (let r = 0; r <= 3; r++) v.set(3, 9 + Math.round(Math.sin(a / 14 * 6.28) * r), 22 + Math.round(Math.cos(a / 14 * 6.28) * r), r === 3 ? '#2e241c' : r % 2 ? '#a8342a' : '#d8cfbe');
  for (const [y, z] of [[9, 23], [10, 21]]) { v.set(4, y, z, '#c4ccd4'); v.set(5, y, z, '#4a3020'); }
  for (let z = 30; z <= 40; z++) for (let y = 5; y <= 11; y++) if ((y + z) % 2) v.set(56, y, z, '#6a5e4a');
  // A small, dim fire.
  v.box(52, 1, 12, 56, 8, 20, '#4a4650'); v.box(53, 1, 14, 56, 4, 18, '#1a1612');
  v.light(54, 1, 15, '#c8602a'); v.light(54, 1, 16, '#a8502a');
  // Crooked tables with a candle each, stools, one empty chair with a crow feather.
  for (const [x, z] of [[12, 24], [26, 30], [44, 26], [16, 38], [40, 38]]) {
    v.box(x, 1, z, x + 1, 4, z + 1, '#45403a'); v.box(x - 2, 4, z - 1, x + 3, 5, z + 2, '#5a554e');
    v.set(x, 5, z, '#d8cfbe'); v.light(x, 6, z, '#e8a050');
    for (const [dx, dz] of [[-4, 0], [4, 1], [0, 4]]) v.box(x + dx, 1, z + dz, x + dx + 1, 3, z + dz + 1, '#45403a');
  }
  v.box(33, 1, 30, 35, 4, 32, '#3a2c20'); for (let y = 4; y <= 8; y++) v.set(33, y, 30, '#3a2c20'); v.set(34, 4, 31, '#141216');
  return {
    v, heroSpots: HERO_SPOTS,
    npcSpots: [[30, 7], [22, 18], [38, 18], [14, 30], [44, 32], [24, 25], [36, 24], [20, 42], [40, 43]],
    mood: { bg: 'radial-gradient(ellipse at 50% 30%, #2e2c2a, #0c0c0c)', sky: '#c8ccd0', ground: '#3a3836', hemi: 1.4, sun: '#d8d4cc', sunPower: 1.4, sunAt: [-20, 70, 50], exposure: 1.2 },
  };
}

// `town`: where the place belongs, for grouping in the lists (TOWNS gives the order).
export const AREAS = {
  camp: { town: 'Razz of Mataz', name: 'The camp of the Man Who Makes Himself Known', short: 'The camp', build: camp },
  wolf: { town: 'Razz of Mataz', name: 'The Wolf', short: 'The Wolf', build: wolf },
  port: { town: 'Razz of Mataz', name: 'The port of Razz of Mataz', short: 'The port', build: port },
  alley: { town: 'Razz of Mataz', name: 'Hooknose Alley', short: 'Hooknose Alley', build: alley },
  gate: { town: 'Razz of Mataz', name: 'Outside the city gates', short: 'The city gates', build: gate },
  road: { town: 'On the road', name: 'The road from Razz to Ytterhavn', short: 'The road', build: plainRoad },
  ytter: { town: 'Ytterhavn', name: 'Ytterhavn city centre', short: 'Ytterhavn', build: ytterCentre },
  ytterport: { town: 'Ytterhavn', name: 'The port of Ytterhavn', short: 'Ytterhavn port', build: ytterPort },
  tavern: { town: 'Ytterhavn', name: 'A sailors’ bar in Ytterhavn', short: 'The bar', build: tavern },
  cellar: { town: 'Ytterhavn', name: 'The guards’ cellar (the cells)', short: 'The cells', build: cellar },
  inn: { town: 'Ytterhavn', name: 'A room at the inn', short: 'The inn room', build: innRoom },
  shop: { town: 'Ytterhavn', name: 'A street shop in Ytterhavn', short: 'The shop', build: shop },
  sirivikcentre: { town: 'Sirivik', name: 'Sirivik town centre', short: 'Sirivik', build: sirivikCentre },
  sirivikbar: { town: 'Sirivik', name: 'Per Hul Øye’s bar', short: 'The bar', build: sirivikBar },
  sirivik: { town: 'Sirivik', name: 'The cliff edge of Sirivik', short: 'The cliff edge', build: sirivikSquare },
  forestroad: { town: 'On the road', name: 'The road past the dark forest', short: 'The forest road', build: forestRoad },
  sirivikroad: { town: 'On the road', name: 'The road to Sirivik', short: 'The road to Sirivik', build: sirivikRoad },
  bridge: { town: 'On the road', name: 'The bridge east of Ytterhavn', short: 'The bridge', build: bridgeArea },
  lighthouse: { town: 'At sea', name: 'The lighthouse in Siri’s Gap', short: 'The lighthouse', build: lighthouseArea },
  ship: { town: 'At sea', name: 'Aboard a small ship', short: 'The ship', build: ship },
};
export const TOWNS = [...new Set(Object.values(AREAS).map((a) => a.town))];
// <option>s for a place picker, grouped by town.
export const areaOptions = (selected, esc) => TOWNS.map((t) => `<optgroup label="${esc(t)}">${Object.entries(AREAS).filter(([, a]) => a.town === t)
  .map(([k, a]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('');

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

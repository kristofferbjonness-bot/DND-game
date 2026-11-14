// Voxel figures for the world's people (NPCs and named enemies), drawn after the owner's
// character art. Each is a recipe (see buildRecipeFigure in model.js) registered under
// `npc-<id>`, so the portrait maker, the Bestiary and the battle field can build it like any
// monster. The Journal shows them on people's pages: an NPC entry uses `data.figure`, or, when
// that is unset, the figure whose `match` fits the entry's title.
//
// Builds share the hero skeleton (facing +z, standing on y = 0, parts legs/body/head/armR/armL):
//   slim  — like the heroes: legs y 0–10, torso 11–16, head 17–20, arms at x ±2.
//   stout — a round belly: shorter legs, a wider torso, arms at x ±3.
//   huge  — big and muscular: 2×2 legs and arms, a deep chest, about 30 voxels tall.
import { registerRecipe, sanitizeRecipe } from './model.js';

// A small builder: parts by name, boxes as [x0, y0, z0, x1, y1, z1, colour key].
function sculpt(palette) {
  const parts = {};
  const part = (name, pivot, motion = 'none', phase = 0) => (parts[name] = { name, pivot, motion, phase, boxes: [], glow: [] });
  const box = (name, x0, y0, z0, x1, y1, z1, key) => parts[name].boxes.push([x0, y0, z0, x1, y1, z1, key]);
  // The same box on both sides (x and −x).
  const pair = (name, x0, y0, z0, x1, y1, z1, key) => { box(name, x0, y0, z0, x1, y1, z1, key); box(name, -x1, y0, z0, -x0, y1, z1, key); };
  const arm = (side) => (side < 0 ? 'armR' : 'armL');
  const done = () => sanitizeRecipe({ palette, parts: Object.values(parts) });
  return { part, box, pair, arm, parts, done };
}

// --- Builds -------------------------------------------------------------------------------------

function slim(p, c, { skirt = false, sleeves = 'shirt' } = {}) {
  const s = sculpt(p);
  s.part('legs', [0, 0, 0]);
  if (skirt) {
    s.box('legs', -2, 1, -1, 2, 4, 2, c.skirtLow ?? c.legs);
    s.box('legs', -1, 5, -1, 1, 10, 1, c.legs);
    s.box('legs', -2, 5, 0, 2, 7, 1, c.legs);
    s.pair('legs', 1, 0, 0, 1, 0, 1, c.feet);
  } else {
    s.pair('legs', 1, 0, 0, 1, 0, 1, c.feet);
    s.pair('legs', 1, 1, 0, 1, 10, 0, c.legs);
    s.box('legs', -1, 9, 0, 1, 10, 0, c.legs);
  }
  s.part('body', [0, 11, 0], 'breathe');
  s.box('body', -1, 11, -1, 1, 16, 1, c.torso);
  s.box('body', -1, 11, -1, 1, 11, 1, c.belt ?? c.torso);
  s.part('head', [0, 17, 0], 'nod');
  s.box('head', -1, 17, -1, 1, 20, 1, c.skin);
  for (const side of [-1, 1]) {
    const a = s.arm(side), x = side * 2;
    s.part(a, [x, 16, 0], 'swing', side < 0 ? 0 : 1.7);
    s.box(a, x, 12, 0, x, 16, 0, sleeves === 'bare' ? c.skin : c.sleeve ?? c.torso);
    if (sleeves === 'short') s.box(a, x, 12, 0, x, 14, 0, c.skin);
    s.box(a, x, 11, 0, x, 11, 0, c.skin);
  }
  return s;
}

function stout(p, c) {
  const s = sculpt(p);
  s.part('legs', [0, 0, 0]);
  s.pair('legs', 1, 0, 0, 1, 0, 1, c.feet);
  s.pair('legs', 1, 1, 0, 1, 8, 0, c.legs);
  s.box('legs', -1, 7, 0, 1, 8, 0, c.legs);
  s.part('body', [0, 9, 0], 'breathe');
  s.box('body', -2, 9, -1, 2, 15, 1, c.torso);
  s.box('body', -1, 10, 2, 1, 13, 2, c.belly ?? c.torso); // the belly
  s.part('head', [0, 16, 0], 'nod');
  s.box('head', -1, 16, -1, 1, 19, 1, c.skin);
  for (const side of [-1, 1]) {
    const a = s.arm(side), x = side * 3;
    s.part(a, [x, 15, 0], 'swing', side < 0 ? 0 : 1.7);
    s.box(a, x, 11, 0, x, 15, 0, c.sleeve ?? c.torso);
    s.box(a, x, 10, 0, x, 10, 0, c.skin);
  }
  return s;
}

// Big and muscular, stocky like a wrestler: legs y 0–9, belt 10, waist 11–13, a broad chest
// 14–20 (9 wide), neck 21, a small head 22–25, and thick arms hanging at x ±5–6.
function huge(p, c) {
  const s = sculpt(p);
  s.part('legs', [0, 0, 0]);
  s.pair('legs', 1, 0, -1, 3, 0, 2, c.feet);
  s.pair('legs', 1, 1, -1, 3, 9, 1, c.legs);
  s.box('legs', -1, 8, -1, 1, 9, 1, c.legs);
  s.part('body', [0, 10, 0], 'breathe');
  s.box('body', -4, 10, -1, 4, 10, 2, c.belt);
  s.box('body', -3, 11, -1, 3, 13, 1, c.torso);
  s.box('body', -4, 14, -2, 4, 20, 1, c.torso);
  s.box('body', -3, 16, 2, 3, 19, 2, c.chest ?? c.torso); // the chest stands out
  s.box('body', -3, 21, -1, 3, 21, 0, c.shoulder ?? c.torso); // traps
  s.box('body', -1, 21, 0, 1, 21, 1, c.skin); // neck
  s.part('head', [0, 22, 0], 'nod');
  s.box('head', -1, 22, -1, 1, 25, 1, c.skin);
  for (const side of [-1, 1]) {
    const a = s.arm(side), x0 = side * 5, x1 = side * 7;
    s.part(a, [side * 5.5, 20, 0], 'swing', side < 0 ? 0 : 1.7);
    s.box(a, x0, 18, -2, x1, 21, 1, c.shoulder ?? c.upper ?? c.skin); // the shoulder
    s.box(a, x0, 14, -1, side * 6, 17, 1, c.upper ?? c.skin); // upper arm
    s.box(a, x0, 15, 2, side * 6, 17, 2, c.bicep ?? c.upper ?? c.skin); // the bicep
    s.box(a, x0, 9, -1, side * 6, 13, 0, c.fore ?? c.skin); // forearm
    s.box(a, x0, 7, -1, side * 6, 8, 1, c.skin); // fist
  }
  return s;
}

// --- The people ----------------------------------------------------------------------------------

// Lord Wolf: enormous and oiled, spiky blond hair, a tight black polo burst open at the
// collar, gold chains and rings, cream trousers.
function lordWolf() {
  const p = { skin: '#d9956a', skinHi: '#e8aa7c', hair: '#f2d27a', polo: '#1f1d22', poloDark: '#141317', gold: '#e2b545',
    trousers: '#ebe2cf', trouserShade: '#d3c6ab', belt: '#5a3a22', shoe: '#6b4528' };
  const s = huge(p, { skin: 'skin', torso: 'polo', chest: 'polo', legs: 'trousers', feet: 'shoe', belt: 'belt',
    upper: 'skin', bicep: 'skinHi', fore: 'skin', shoulder: 'polo' });
  s.box('body', -4, 14, -2, 4, 20, -2, 'poloDark');
  s.box('body', 0, 17, 2, 0, 20, 2, 'skin'); // the collar burst open
  s.box('body', -1, 20, 2, 1, 20, 2, 'gold'); // gold chains
  s.pair('body', 1, 19, 2, 1, 19, 2, 'gold');
  s.box('body', 0, 16, 3, 0, 16, 3, 'gold');
  s.pair('legs', 1, 1, 1, 3, 1, 1, 'trouserShade');
  s.box('armR', -6, 7, 1, -6, 7, 1, 'gold'); // rings
  s.box('armL', 6, 7, 1, 6, 7, 1, 'gold');
  // Spiky blond hair.
  s.box('head', -1, 25, -1, 1, 25, 1, 'hair');
  s.box('head', -1, 24, -1, 1, 24, -1, 'hair');
  s.box('head', -1, 26, -1, -1, 26, 0, 'hair'); s.box('head', 1, 26, 0, 1, 26, 1, 'hair'); s.box('head', 0, 26, -1, 0, 27, 1, 'hair');
  return s.done();
}

// The Man Who Makes Himself Known: a giant of a man with long black curls, a dark tunic with
// rolled sleeves, a wide belt with a curved dagger, tall boots, prayer beads in his hand.
function theMan() {
  const p = { skin: '#c4865a', hair: '#1f1a1a', tunic: '#3b3634', tunicDark: '#2b2725', belt: '#6b4a2e',
    buckle: '#c9a44a', trousers: '#2e2a28', boot: '#4a3426', steel: '#d4dadf', grip: '#3a2a20', bead: '#6b3f22' };
  const s = huge(p, { skin: 'skin', torso: 'tunic', chest: 'tunic', legs: 'trousers', feet: 'boot', belt: 'belt',
    upper: 'tunic', bicep: 'tunic', fore: 'skin', shoulder: 'tunic' });
  s.box('body', -4, 14, -2, 4, 20, -2, 'tunicDark');
  s.box('body', -1, 19, 2, 1, 20, 2, 'tunicDark'); // the neckline
  s.box('body', 0, 19, 2, 0, 20, 2, 'skin');
  s.box('body', 0, 10, 3, 0, 10, 3, 'buckle');
  s.box('body', 2, 9, 3, 2, 11, 3, 'grip'); // the dagger in his belt
  s.box('body', 2, 8, 3, 2, 8, 3, 'steel'); s.box('body', 3, 7, 3, 3, 7, 3, 'steel');
  s.pair('legs', 1, 1, -1, 3, 4, 1, 'boot'); // tall boots
  for (const side of [-1, 1]) s.box(s.arm(side), side * 5, 13, -1, side * 6, 13, 0, 'tunicDark'); // rolled sleeves
  s.box('armR', -6, 9, -1, -5, 12, 0, 'skin'); s.box('armL', 5, 9, -1, 6, 12, 0, 'skin');
  // Prayer beads hanging from the left fist.
  for (const y of [4, 5, 6]) s.box('armL', 6, y, 0, 6, y, 0, 'bead');
  s.box('armL', 6, 3, 1, 6, 3, 1, 'buckle');
  // Long black curls to the shoulders.
  s.box('head', -1, 26, -1, 1, 26, 1, 'hair');
  s.box('head', -2, 20, -2, 2, 25, -2, 'hair');
  s.pair('head', 2, 21, -1, 2, 25, 1, 'hair');
  s.box('head', -1, 25, 1, 1, 25, 2, 'hair');
  return s.done();
}

// Habibi: a big belly, a thick black beard, an embroidered cap, a blue shirt under an
// embroidered red-and-gold waistcoat, a gold chain, and a kebab wrap in his hand.
function habibi() {
  const p = { skin: '#c78a5f', beard: '#2a211c', cap: '#7a4a2e', capBand: '#d8a845', capRed: '#a8342a', shirt: '#4f6f9a',
    vest: '#9b2f2a', trim: '#d8a845', green: '#3f6b4a', trousers: '#8a6440', shoe: '#4a3426', wrap: '#efe1c0', salad: '#6a9a45' };
  const s = stout(p, { skin: 'skin', torso: 'shirt', belly: 'shirt', legs: 'trousers', feet: 'shoe', sleeve: 'shirt' });
  // The waistcoat on the sides and back, with gold trim down the front.
  s.box('body', -2, 9, -1, 2, 15, -1, 'vest');
  s.pair('body', 2, 9, 0, 2, 15, 1, 'vest');
  s.pair('body', 1, 10, 2, 1, 13, 2, 'trim');
  s.pair('body', 2, 12, 1, 2, 12, 1, 'green');
  s.box('body', -1, 15, 2, 1, 15, 2, 'trim'); // gold chain
  s.box('body', 0, 14, 2, 0, 14, 2, 'trim');
  // A short sleeve, bare forearm.
  for (const side of [-1, 1]) s.box(s.arm(side), side * 3, 11, 0, side * 3, 12, 0, 'skin');
  // Beard and cap.
  s.box('head', -1, 16, 2, 1, 17, 2, 'beard');
  s.pair('head', 1, 16, 1, 1, 18, 1, 'beard');
  s.box('head', 0, 15, 2, 0, 15, 2, 'beard');
  s.box('head', -1, 20, -1, 1, 20, 1, 'capBand');
  s.box('head', -1, 21, -1, 1, 21, 1, 'cap');
  s.box('head', 0, 21, 1, 0, 21, 1, 'capRed');
  // A kebab wrap in his right hand.
  s.box('armR', -3, 9, 1, -3, 10, 1, 'wrap');
  s.box('armR', -3, 11, 1, -3, 11, 1, 'salad');
  return s.done();
}

// One of the Silk Sisters, Lord Wolf's guards: long dark hair, a red silk gown with gold,
// bare arms, and a golden dumbbell.
function silkSister() {
  const p = { skin: '#e3b08c', hair: '#2a1c18', silk: '#b02a2a', silkDark: '#8a1f22', gold: '#e0b44a', shoe: '#5e1a1a' };
  const s = slim(p, { skin: 'skin', torso: 'silk', legs: 'silk', skirtLow: 'silkDark', feet: 'shoe', belt: 'gold' }, { skirt: true, sleeves: 'bare' });
  s.box('legs', -2, 1, 2, 2, 1, 2, 'gold'); // gold hem
  s.box('legs', 1, 2, 2, 1, 4, 2, 'skin'); // a slit up the leg
  s.box('body', -1, 16, 1, 1, 16, 1, 'skin');
  s.box('body', 0, 15, 1, 0, 15, 1, 'gold');
  // Long dark hair down her back.
  s.box('head', -1, 21, -1, 1, 21, 1, 'hair');
  s.box('head', -1, 17, -1, 1, 20, -1, 'hair');
  s.pair('head', 1, 18, 0, 1, 20, 0, 'hair');
  s.box('head', -1, 11, -2, 1, 16, -2, 'hair');
  // A golden dumbbell in her right hand.
  s.box('armR', -2, 10, -1, -2, 10, 1, 'gold');
  s.box('armR', -3, 9, -2, -1, 11, -2, 'gold');
  s.box('armR', -3, 9, 2, -1, 11, 2, 'gold');
  return s.done();
}

// Findus, dockmaster of Bartedalen: a knitted cap, a seaweed-droop moustache with a rusty
// fishhook, a navy jumper under a mustard oilskin coat, keys at the belt.
function findus() {
  const p = { skin: '#d9a888', cap: '#6b5a48', capRib: '#5a4b3c', tache: '#b8b2a6', hook: '#8a5a3a', jumper: '#2f3c55',
    coat: '#a88a45', coatDark: '#8a7038', trousers: '#4a4338', boot: '#3a2e24', keys: '#c4a050' };
  const s = slim(p, { skin: 'skin', torso: 'coat', legs: 'trousers', feet: 'boot', sleeve: 'coat' });
  s.box('body', 0, 12, 1, 0, 16, 1, 'jumper'); // the open coat
  s.box('body', -1, 11, -1, 1, 16, -1, 'coatDark');
  s.box('body', 1, 11, 2, 1, 12, 2, 'keys');
  s.pair('legs', 1, 1, 0, 1, 3, 0, 'boot');
  // Cap, and the drooping moustache with its hook.
  s.box('head', -1, 20, -1, 1, 21, 1, 'cap');
  s.box('head', -1, 20, 1, 1, 20, 1, 'capRib');
  s.box('head', -1, 18, 2, 1, 18, 2, 'tache');
  s.pair('head', 2, 16, 2, 2, 18, 2, 'tache');
  s.box('head', 2, 15, 2, 2, 15, 2, 'hook');
  return s.done();
}

// Lord Eggen, Assembly Speaker of Bartedalen: a colossal wing-shaped moustache held up by
// a wire frame, glasses, thinning brown hair and a plain olive shirt.
function eggen() {
  const p = { skin: '#e0b090', hair: '#7a5a3e', tache: '#6b4a2e', wire: '#9aa0a6', glass: '#3a3a3a', lens: '#cfe3ec',
    shirt: '#6b7048', shirtDark: '#575b3a', trousers: '#4a3e30', shoe: '#3a2e24' };
  const s = slim(p, { skin: 'skin', torso: 'shirt', legs: 'trousers', feet: 'shoe' });
  s.box('body', -1, 11, -1, 1, 16, -1, 'shirtDark');
  s.box('body', -1, 16, 1, 1, 16, 1, 'shirtDark'); // collar
  s.box('head', -1, 21, -1, 1, 21, 0, 'hair');
  s.box('head', -1, 18, -1, 1, 20, -1, 'hair');
  s.box('head', -1, 19, 2, 1, 19, 2, 'glass'); // glasses
  s.pair('head', 1, 19, 2, 1, 19, 2, 'lens');
  // The wing moustache, curling up at the tips.
  s.box('head', -1, 17, 2, 1, 17, 2, 'tache');
  s.pair('head', 2, 17, 2, 3, 17, 2, 'tache');
  s.pair('head', 3, 18, 2, 3, 19, 2, 'tache');
  s.pair('head', 2, 18, 1, 2, 18, 1, 'wire');
  return s.done();
}

// The people of Sirivik: gloomy and grey, each missing a body part.
// Per Hul Øye, the bar owner: a hollow, empty eye socket.
function perHulOye() {
  const p = { skin: '#c9b9a8', hole: '#120e10', hair: '#8f8a84', shirt: '#3a3f3a', apron: '#cfc6b2', apronDark: '#a99f8a',
    trousers: '#2e2f2c', shoe: '#22201e', mug: '#7a5132', foam: '#efe8d8' };
  const s = stout(p, { skin: 'skin', torso: 'shirt', belly: 'apron', legs: 'trousers', feet: 'shoe', sleeve: 'shirt' });
  s.box('body', -1, 9, 2, 1, 9, 2, 'apron');
  s.box('legs', -1, 6, 1, 1, 8, 1, 'apronDark');
  s.box('head', -1, 18, 2, -1, 18, 2, 'hole'); // the hollow eye
  s.pair('head', 1, 17, -1, 1, 19, 0, 'hair');
  s.box('head', -1, 18, -1, 1, 19, -1, 'hair');
  // A mug in his hand.
  s.box('armR', -3, 9, 1, -3, 10, 1, 'mug');
  s.box('armR', -3, 11, 1, -3, 11, 1, 'foam');
  return s.done();
}

// Three-Fingered Paul, the shopkeeper: a wide hat, a long grey-green coat, and a lantern.
function threeFingeredPaul() {
  const p = { skin: '#c4b6a0', hat: '#2e2a26', coat: '#4a5446', coatDark: '#3b4438', trousers: '#2e2f2c', shoe: '#22201e',
    lamp: '#5a4a3a', light: '#ffd27a' };
  const s = slim(p, { skin: 'skin', torso: 'coat', legs: 'trousers', feet: 'shoe' });
  s.pair('legs', 1, 5, 0, 1, 10, 1, 'coat'); // the long coat
  s.box('legs', -1, 6, 1, 1, 10, 1, 'coat');
  s.box('body', -1, 11, -1, 1, 16, -1, 'coatDark');
  s.box('head', -2, 21, -2, 2, 21, 2, 'hat');
  s.box('head', -1, 22, -1, 1, 23, 1, 'hat');
  // A lantern from his left hand (missing two fingers, but it never shakes).
  s.box('armL', 2, 9, 0, 2, 10, 0, 'lamp');
  s.box('armL', 2, 7, 0, 2, 8, 0, 'light');
  s.parts.armL.glow.push('light');
  return s.done();
}

// The hostel owner: no toes at all, so bare stumpy feet; a nightcap, a faded robe, a candle.
function hostelOwner() {
  const p = { skin: '#cbbfae', robe: '#5a4a5e', robeDark: '#483b4c', cap: '#d6cbb6', candle: '#efe8d8', flame: '#ffb347', holder: '#8a7a5a' };
  const s = slim(p, { skin: 'skin', torso: 'robe', legs: 'robe', feet: 'skin' });
  // Bare ankles and feet with no toes (only the heel), under a long robe.
  s.parts.legs.boxes = [];
  s.pair('legs', 1, 0, 0, 1, 2, 0, 'skin');
  s.box('legs', -1, 3, -1, 1, 10, 1, 'robe');
  s.box('legs', -2, 3, -1, 2, 4, 1, 'robeDark');
  s.box('body', -1, 11, -1, 1, 16, -1, 'robeDark');
  s.box('head', -1, 21, -1, 1, 21, 1, 'cap');
  s.box('head', 0, 22, -1, 0, 22, 0, 'cap'); s.box('head', 0, 22, -2, 0, 21, -2, 'cap');
  s.box('armL', 2, 10, 1, 2, 10, 1, 'holder');
  s.box('armL', 2, 11, 1, 2, 12, 1, 'candle');
  s.box('armL', 2, 13, 1, 2, 13, 1, 'flame');
  s.parts.armL.glow.push('flame');
  return s.done();
}

// --- Ytterhavn and Razz -------------------------------------------------------------------------------

// Olemann, a captain of Ytterhavn: short, blond, handsome and muscular, and proud of it. A navy
// captain's coat with gold buttons over an open white shirt, a bicorne hat, tall boots, bare forearms.
function olemann() {
  const p = { skin: '#e4b48c', hair: '#f0d070', coat: '#2a3a5e', coatDark: '#1e2c4a', gold: '#d9a63a', shirt: '#f2ece0', trousers: '#e8dcc0', boot: '#3a2a20', hat: '#1e2238' };
  const s = stout(p, { skin: 'skin', torso: 'coat', belly: 'coat', legs: 'trousers', feet: 'boot', sleeve: 'coat' });
  s.box('body', -2, 9, -1, 2, 15, -1, 'coatDark');
  s.box('body', 0, 12, 2, 0, 15, 2, 'shirt'); s.box('body', -1, 15, 2, 1, 15, 2, 'shirt'); s.box('body', 0, 15, 2, 0, 15, 2, 'skin'); // open shirt
  for (const y of [10, 12, 14]) { s.box('body', -1, y, 2, -1, y, 2, 'gold'); s.box('body', 1, y, 2, 1, y, 2, 'gold'); }
  s.pair('body', 2, 15, -1, 3, 15, 1, 'gold'); // epaulettes
  s.pair('legs', 1, 1, 0, 1, 5, 0, 'boot');
  for (const side of [-1, 1]) s.box(s.arm(side), side * 3, 11, 0, side * 3, 12, 0, 'skin'); // sleeves rolled to show the arms
  s.box('head', -1, 19, -1, 1, 19, 1, 'hair'); s.box('head', -1, 18, -1, 1, 18, -1, 'hair'); s.box('head', 1, 18, 0, 1, 18, 1, 'hair');
  s.box('head', -3, 20, 0, 3, 20, 0, 'hat'); s.box('head', -2, 21, 0, 2, 21, 0, 'hat'); s.box('head', -1, 22, 0, 1, 22, 0, 'hat'); s.box('head', -3, 20, -1, 3, 20, 1, 'hat');
  s.box('head', 0, 21, 1, 0, 21, 1, 'gold');
  return s.done();
}

// Bobby, the barman of Ytterhavn's finest bar: well dressed in a white shirt, black waistcoat and
// a red bow tie, black hair slicked back, a moustache, a towel over one arm and a cocktail in hand
// (its faint glow hints at his secret menu).
function bobby() {
  const p = { skin: '#e0b090', hair: '#1e1a1a', shirt: '#f4f0e8', vest: '#1f1d22', tie: '#b02a2a', trousers: '#2a2a30', shoe: '#141316', towel: '#e8e4dc', glass: '#c9e6ef', drink: '#b98cd9' };
  const s = slim(p, { skin: 'skin', torso: 'shirt', legs: 'trousers', feet: 'shoe', sleeve: 'shirt', belt: 'vest' });
  s.box('body', -1, 11, -1, 1, 15, -1, 'vest'); s.pair('body', 1, 11, 0, 1, 15, 1, 'vest'); // the waistcoat
  s.box('body', 0, 16, 1, 0, 16, 1, 'tie'); s.box('body', -1, 16, 2, 1, 16, 2, 'tie');
  s.box('head', -1, 20, -1, 1, 21, 1, 'hair'); s.box('head', -1, 18, -1, 1, 19, -1, 'hair');
  s.box('head', -1, 17, 2, 1, 17, 2, 'hair'); // the moustache
  s.box('armL', 2, 12, 1, 2, 14, 1, 'towel');
  s.box('armR', -2, 10, 1, -2, 10, 1, 'glass'); s.box('armR', -2, 11, 1, -2, 11, 1, 'drink'); s.box('armR', -2, 12, 1, -2, 12, 1, 'glass');
  s.parts.armR.glow.push('drink');
  return s.done();
}

// Bob, Bobby's younger brother, who keeps a fish shop: messy black hair under a knitted cap, a
// blue-and-white striped shirt, a fishmonger's apron, and a swordfish dagger.
function bob() {
  const p = { skin: '#e4b896', hair: '#1e1a1a', cap: '#3f7a5a', stripe: '#3f6fa8', white: '#f2ece0', apron: '#e8e2d6', apronDark: '#cfc6b6', trousers: '#5a4a38', boot: '#3a3a40', blade: '#a8c4d4', grip: '#5a3a22' };
  const s = slim(p, { skin: 'skin', torso: 'white', legs: 'trousers', feet: 'boot', sleeve: 'stripe' });
  for (let y = 11; y <= 16; y += 2) s.box('body', -1, y, -1, 1, y, 1, 'stripe');
  s.box('body', -1, 11, 2, 1, 15, 2, 'apron'); s.box('legs', -1, 6, 1, 1, 10, 1, 'apron'); s.box('body', 0, 13, 2, 0, 13, 2, 'stripe'); // apron with a little fish
  s.pair('legs', 1, 1, 0, 1, 3, 0, 'boot');
  s.box('head', -1, 20, -1, 1, 21, 1, 'cap'); s.box('head', 0, 22, 0, 0, 22, 0, 'cap');
  s.box('head', -1, 19, 1, -1, 19, 1, 'hair'); s.box('head', 1, 19, -1, 1, 19, -1, 'hair'); // messy hair under the cap
  s.box('armR', -2, 10, 1, -2, 10, 1, 'grip'); s.box('armR', -2, 10, 2, -2, 10, 5, 'blade'); // the swordfish dagger
  return s.done();
}

// The Sand Nug: a Razz bandit disguised as a street seller, wrapped in sandy robes with only his
// eyes showing, a tray of mojitos and warm beer hung from his neck, a knife hidden at his back.
function sandNug() {
  const p = { skin: '#b07a52', robe: '#d8bf8a', robeDark: '#bfa470', wrap: '#e8d8b0', eye: '#1e1a1a', tray: '#8a6440', glass: '#c9e6ef', mint: '#5aa86a', beer: '#d9a03a', strap: '#5a3a22', steel: '#d4dadf' };
  const s = slim(p, { skin: 'skin', torso: 'robe', legs: 'robe', skirtLow: 'robeDark', feet: 'strap', sleeve: 'robe' }, { skirt: true });
  s.box('body', -1, 11, -1, 1, 16, -1, 'robeDark');
  s.box('head', -1, 17, -1, 1, 21, 1, 'wrap'); s.box('head', -1, 19, 2, 1, 19, 2, 'eye'); s.box('head', 0, 19, 2, 0, 19, 2, 'skin');
  s.box('head', -1, 21, -2, 1, 21, -2, 'wrap'); s.box('head', 0, 20, -3, 0, 18, -3, 'wrap'); // the tail of the head wrap
  s.box('body', -1, 13, 2, 1, 16, 2, 'strap'); // the neck strap
  s.box('body', -3, 12, 3, 3, 12, 5, 'tray');
  for (const [x, z, c] of [[-2, 4, 'mint'], [0, 3, 'beer'], [2, 4, 'mint'], [-1, 5, 'beer'], [1, 5, 'mint']]) { s.box('body', x, 13, z, x, 13, z, 'glass'); s.box('body', x, 14, z, x, 14, z, c); }
  s.box('body', 1, 10, -2, 1, 12, -2, 'steel'); // the hidden knife
  return s.done();
}

// --- Sirivik ----------------------------------------------------------------------------------------

// Lasse, the drunk at Per Hul Øye's bar: a nervous, hunched wreck in a stained shirt, clutching his mug.
function lasse() {
  const p = { skin: '#cbb8a4', hair: '#7a6a58', shirt: '#9a9a86', stain: '#7a7a62', trousers: '#4a4640', shoe: '#2a2624', mug: '#7a5132', foam: '#efe8d8', nose: '#c98a7a' };
  const s = slim(p, { skin: 'skin', torso: 'shirt', legs: 'trousers', feet: 'shoe', sleeve: 'shirt' });
  s.box('body', 1, 12, 1, 1, 13, 1, 'stain'); s.box('body', -1, 15, 1, -1, 15, 1, 'stain');
  s.parts.head.pivot = [0, 17, 1];
  for (const b of s.parts.head.boxes) { b[2] += 1; b[5] += 1; b[1] -= 1; b[4] -= 1; } // the head hangs forward, low
  s.box('head', -1, 20, -1 + 1, 1, 20, 1 + 1, 'hair'); s.box('head', 0, 18, 3, 0, 18, 3, 'nose');
  s.parts.head.motion = 'sway'; // swaying, a little drunk
  s.box('armR', -2, 9, 1, -2, 10, 1, 'mug'); s.box('armR', -2, 11, 1, -2, 11, 1, 'foam');
  return s.done();
}

// The Accordion: the mangled thing in the hills that Sirivik worships. A great folded, pleated body
// of grey-pink flesh that heaves like bellows, long spindly arms, and a cluster of eyes.
function accordion() {
  const p = { flesh: '#b89a98', fold: '#8a6a6a', dark: '#4a3438', bone: '#e2d8c8', eye: '#f2e6a0', pupil: '#1a1012', claw: '#2a2024' };
  const s = sculpt(p);
  s.part('legs', [0, 0, 0]);
  for (const [x, z] of [[-4, -2], [4, -2], [-4, 3], [4, 3], [0, -4]]) { s.box('legs', x, 0, z, x, 7, z, 'dark'); s.box('legs', x, 0, z + 1, x, 0, z + 1, 'claw'); }
  s.part('body', [0, 8, 0], 'breathe');
  for (let i = 0; i < 9; i++) { const w = 5 - Math.abs(i - 4) * 0.5 | 0; s.box('body', -w, 8 + i * 2, -3, w, 9 + i * 2, 3, i % 2 ? 'fold' : 'flesh'); } // the pleated body
  s.box('body', -1, 26, -1, 1, 27, 1, 'bone');
  s.part('head', [0, 26, 2], 'nod');
  for (const [x, y] of [[-2, 22], [1, 24], [2, 20], [-1, 19], [0, 26], [-3, 25], [3, 23]]) { s.box('head', x, y, 4, x, y, 4, 'eye'); s.box('head', x, y, 5, x, y, 5, 'pupil'); }
  for (const side of [-1, 1]) {
    const a = s.arm(side), x = side * 6;
    s.part(a, [x, 22, 0], 'swing', side < 0 ? 0 : 2.1);
    s.box(a, x, 14, 0, x, 22, 0, 'flesh'); s.box(a, x + side, 6, 1, x + side, 14, 1, 'fold');
    for (const dz of [0, 1, 2]) s.box(a, x + side, 4, dz, x + side, 5, dz, 'claw');
  }
  return s.done();
}

// The God of Beauty: a tall, serene figure in pale gold and white, its face a perfect golden mask,
// a soft glow and a halo behind its head.
function godOfBeauty() {
  const p = { robe: '#f4eee2', robeShade: '#e2d8c4', gold: '#e8c25a', mask: '#f2d27a', glow: '#fff4c8', hand: '#f2e6d4' };
  const s = slim(p, { skin: 'hand', torso: 'robe', legs: 'robe', skirtLow: 'robeShade', feet: 'robeShade', sleeve: 'robe', belt: 'gold' }, { skirt: true });
  s.box('legs', -3, 1, -2, 3, 2, 3, 'robeShade');
  s.box('head', -1, 17, -1, 1, 20, 1, 'mask'); s.box('head', -1, 21, -1, 1, 21, 1, 'gold');
  for (let a = 0; a < 16; a++) s.box('head', Math.round(Math.cos(a / 16 * 6.28) * 4), 19 + Math.round(Math.sin(a / 16 * 6.28) * 4), -3, Math.round(Math.cos(a / 16 * 6.28) * 4), 19 + Math.round(Math.sin(a / 16 * 6.28) * 4), -3, 'glow');
  s.parts.head.glow.push('glow');
  s.parts.body.motion = 'hover'; s.parts.legs.motion = 'hover'; s.parts.head.motion = 'hover'; s.parts.armL.motion = 'hover'; s.parts.armR.motion = 'hover';
  return s.done();
}

// id → { name, match (for journal titles), recipe }.
export const NPC_FIGURES = {
  'lord-wolf': { name: 'Lord Wolf', match: /lord wolf|toucher of girls/i, build: lordWolf },
  'the-man': { name: 'The Man Who Makes Himself Known', match: /makes himself known/i, build: theMan },
  habibi: { name: 'Habibi', match: /^habibi$/i, build: habibi },
  'silk-sister': { name: 'A Silk Sister', match: /silk sister/i, build: silkSister },
  findus: { name: 'Findus', match: /findus/i, build: findus },
  eggen: { name: 'Lord Eggen', match: /eggen/i, build: eggen },
  'per-hul-oye': { name: 'Per Hul Øye', match: /per hul/i, build: perHulOye },
  paul: { name: 'Three-Fingered Paul', match: /three.fingered paul/i, build: threeFingeredPaul },
  'hostel-owner': { name: 'The hostel owner', match: /hostel owner/i, build: hostelOwner },
  olemann: { name: 'Olemann (captain)', match: /^olemann$/i, build: olemann },
  bobby: { name: 'Bobby (barman)', match: /^bobby$/i, build: bobby },
  bob: { name: 'Bob (fish shop)', match: /^bob$/i, build: bob },
  'sand-nug': { name: 'The Sand Nug', match: /sand nug/i, build: sandNug },
  lasse: { name: 'Lasse (bar drunk)', match: /^lasse$/i, build: lasse },
  accordion: { name: 'The Accordion', match: /accordion/i, build: accordion },
  'god-of-beauty': { name: 'The God of Beauty', match: /god of beauty/i, build: godOfBeauty },
  varg: { name: 'Varg (Edbart’s wolf)', match: /^varg$/i, build: null }, // built in model.js (MONSTER_LOOKS)
};

for (const [id, f] of Object.entries(NPC_FIGURES)) if (f.build) registerRecipe(`npc-${id}`, f.build());

// The figure id for a journal person: their chosen figure, or one matching their name.
export function npcFigureId(data) {
  if (data?.figure === '') return null;
  if (data?.figure === 'hooknose' || NPC_FIGURES[data?.figure]) return data.figure;
  if (/hooknose/i.test(data?.title ?? '')) return 'hooknose';
  return Object.entries(NPC_FIGURES).find(([, f]) => f.match.test(data?.title ?? ''))?.[0] ?? null;
}
// The model name to build it with (buildMonsterFigure / monsterPortrait).
export const npcModel = (id) => (id === 'hooknose' ? 'hooknose' : `npc-${id}`);

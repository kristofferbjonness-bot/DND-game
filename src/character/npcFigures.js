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
import { MONSTERS } from '../data/monsters.js';

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

// Olemann, a captain of Ytterhavn: short (a head shorter than the heroes), blond, handsome and
// muscular, and proud of it. A navy captain's coat with gold buttons and epaulettes over an open
// white shirt, thick bare forearms, tall boots, a bicorne hat.
function olemann() {
  const p = { skin: '#e4b48c', skinHi: '#eec4a0', hair: '#f0d070', coat: '#2a3a5e', coatDark: '#1e2c4a', gold: '#d9a63a', shirt: '#f2ece0', trousers: '#e8dcc0', boot: '#3a2a20', hat: '#1e2238' };
  const s = sculpt(p);
  s.part('legs', [0, 0, 0]);
  s.pair('legs', 1, 0, 0, 2, 0, 1, 'boot');
  s.pair('legs', 1, 1, 0, 2, 3, 0, 'boot');
  s.pair('legs', 1, 4, 0, 2, 5, 0, 'trousers');
  s.part('body', [0, 6, 0], 'breathe');
  s.box('body', -3, 6, -1, 3, 12, 1, 'coat');
  s.box('body', -3, 6, -1, 3, 12, -1, 'coatDark');
  s.box('body', -2, 4, -2, 2, 6, -2, 'coatDark'); // coat tails
  s.box('body', -1, 9, 2, 1, 11, 2, 'shirt'); s.box('body', 0, 10, 2, 0, 12, 2, 'skin'); // open shirt, broad chest
  for (const y of [7, 9, 11]) s.pair('body', 2, y, 2, 2, y, 2, 'gold');
  s.box('body', -3, 6, 2, 3, 6, 2, 'gold'); // a gold belt
  s.pair('body', 3, 12, -1, 4, 12, 1, 'gold'); // epaulettes
  s.part('head', [0, 13, 0], 'nod');
  s.box('head', -1, 13, -1, 1, 16, 1, 'skin');
  s.box('head', -1, 16, -1, 1, 16, 1, 'hair'); s.box('head', -1, 15, -1, 1, 15, -1, 'hair'); s.box('head', 1, 15, 0, 1, 15, 1, 'hair');
  s.box('head', -3, 17, 0, 3, 17, 0, 'hat'); s.box('head', -3, 17, -1, 3, 17, 1, 'hat'); s.box('head', -2, 18, 0, 2, 18, 0, 'hat'); s.box('head', -1, 19, 0, 1, 19, 0, 'hat');
  s.box('head', 0, 18, 1, 0, 18, 1, 'gold');
  for (const side of [-1, 1]) {
    const a = s.arm(side), x = side * 4;
    s.part(a, [x, 12, 0], 'swing', side < 0 ? 0 : 1.7);
    s.box(a, x, 9, -1, x, 12, 1, 'coat'); // a thick sleeve, rolled up
    s.box(a, x, 6, 0, x, 8, 1, 'skinHi'); // strong forearms
    s.box(a, x, 5, 0, x, 5, 1, 'skin');
  }
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

// An Ytterhavn guard: a burly sailor-soldier keeping the peace in the harbour town. A blue-and-white
// striped shirt under a navy coat with brass buttons and a red sash, white trousers, tall boots, a
// tarred black hat with a brass badge, a cutlass in hand and a boarding hook on his back.
function ytterGuard() {
  const p = { skin: '#d9a07a', beard: '#6a4a2e', stripe: '#2f4f8a', white: '#f2ece0', coat: '#22304e', coatDark: '#18233a', brass: '#d9a63a', sash: '#a8342a', trousers: '#e8e2d6', boot: '#2a2420', hat: '#1a1a20', steel: '#d4dadf', grip: '#5a3a22', hook: '#4a4a50' };
  const s = slim(p, { skin: 'skin', torso: 'coat', legs: 'trousers', feet: 'boot', sleeve: 'coat', belt: 'sash' });
  // Broader: shoulders and chest one voxel wider.
  s.pair('body', 2, 13, -1, 2, 16, 1, 'coat');
  s.box('body', -1, 11, -1, 1, 16, -1, 'coatDark');
  s.box('body', 0, 12, 1, 0, 16, 1, 'white'); for (const y of [12, 14, 16]) s.box('body', 0, y, 1, 0, y, 1, 'stripe'); // striped shirt at the open coat
  for (const y of [12, 14]) s.pair('body', 1, y, 2, 1, y, 2, 'brass');
  s.box('body', -2, 11, 1, 2, 11, 1, 'sash'); s.box('body', 2, 9, 1, 2, 10, 1, 'sash');
  s.pair('legs', 1, 1, 0, 1, 4, 0, 'boot');
  for (const side of [-1, 1]) { const a = s.arm(side); for (const b of s.parts[a].boxes) { b[0] += side; b[3] += side; } s.parts[a].pivot[0] += side; }
  // Beard and the tarred hat with its badge.
  s.box('head', -1, 17, 2, 1, 18, 2, 'beard'); s.pair('head', 1, 17, 1, 1, 18, 1, 'beard');
  s.box('head', -2, 21, -2, 2, 21, 2, 'hat'); s.box('head', -1, 22, -1, 1, 22, 1, 'hat'); s.box('head', 0, 21, 3, 0, 21, 3, 'hat');
  s.box('head', 0, 22, 2, 0, 22, 2, 'brass');
  // A cutlass in the right hand, a boarding hook across the back.
  s.box('armR', -3, 10, 1, -3, 10, 1, 'brass'); s.box('armR', -3, 10, 2, -3, 10, 6, 'steel'); s.box('armR', -3, 11, 6, -3, 11, 6, 'steel');
  for (let i = 0; i <= 8; i++) s.box('body', -2 + Math.floor(i / 2), 10 + i, -2, -2 + Math.floor(i / 2), 10 + i, -2, 'grip');
  s.box('body', 2, 18, -2, 3, 18, -2, 'hook'); s.box('body', 3, 17, -2, 3, 17, -2, 'hook');
  return s.done();
}

// The bridge troll who lives under the bridge east of Ytterhavn: huge, hunched and mossy, with a
// long nose, tusks, a mane of weedy hair, a belly, a rag round the waist and a club made of an
// old bridge post with nails in it.
function bridgeTroll() {
  const p = { skin: '#7a8a5a', skinDark: '#5e6e44', moss: '#4a6a3a', hair: '#3e4a2e', tusk: '#e8e0c8', eye: '#f2d24a', rag: '#7a6448', club: '#6b4a2e', nail: '#8a8a90', nose: '#8a9a64' };
  const s = huge(p, { skin: 'skin', torso: 'skin', chest: 'skin', legs: 'skinDark', feet: 'skinDark', belt: 'rag', upper: 'skin', bicep: 'skin', fore: 'skinDark', shoulder: 'moss' });
  s.box('body', -3, 11, 2, 3, 15, 3, 'skin'); // the belly
  s.box('body', -4, 10, -1, 4, 11, 2, 'rag'); s.box('legs', -3, 7, 1, 3, 9, 1, 'rag');
  for (const [x, y] of [[-3, 19], [2, 17], [-1, 20], [3, 15], [-4, 16]]) s.box('body', x, y, -2, x, y, -2, 'moss');
  s.parts.head.pivot = [0, 21, 2];
  for (const b of s.parts.head.boxes) { b[2] += 2; b[5] += 2; b[1] -= 3; b[4] -= 3; } // the head hangs low and forward
  s.box('head', 0, 21, 4, 0, 22, 6, 'nose'); s.box('head', 0, 20, 6, 0, 20, 6, 'nose');
  s.box('head', -1, 22, 4, -1, 22, 4, 'eye'); s.box('head', 1, 22, 4, 1, 22, 4, 'eye');
  s.pair('head', 1, 19, 4, 1, 20, 4, 'tusk');
  s.box('head', -2, 23, 0, 2, 24, 3, 'hair'); s.box('head', -2, 16, 0, 2, 22, 0, 'hair');
  // The club: a bridge post with nails, in the right fist.
  s.box('armR', -6, 3, 1, -5, 9, 2, 'club'); s.box('armR', -6, 1, 1, -5, 2, 2, 'club');
  for (const [y, z] of [[2, 3], [4, 0], [6, 3]]) s.box('armR', -6, y, z, -6, y, z, 'nail');
  return s.done();
}

// The lighthouse keeper in Siri's Gap: an old, weathered man in a yellow oilskin coat and
// sou'wester hat, a grey beard and a pipe, a lantern in one hand and a spyglass at his belt.
function lighthouseKeeper() {
  const p = { skin: '#d9a88a', beard: '#c8c4bc', oil: '#e8b83a', oilDark: '#c8982a', jumper: '#3a4a5a', trousers: '#4a4640', boot: '#2a2624', pipe: '#5a3a22', lamp: '#4a4a50', light: '#ffd27a', brass: '#c9a44a' };
  const s = stout(p, { skin: 'skin', torso: 'oil', belly: 'oil', legs: 'trousers', feet: 'boot', sleeve: 'oil' });
  s.box('body', -2, 9, -1, 2, 15, -1, 'oilDark'); s.box('body', 0, 12, 2, 0, 15, 2, 'jumper');
  s.box('legs', -2, 6, -1, 2, 8, 1, 'oil'); // the long coat
  s.box('body', 2, 9, 2, 2, 10, 2, 'brass'); // spyglass at the belt
  s.box('head', -1, 16, 2, 1, 17, 2, 'beard'); s.pair('head', 1, 16, 1, 1, 17, 1, 'beard'); s.box('head', 0, 15, 2, 0, 15, 2, 'beard');
  s.box('head', 1, 17, 3, 2, 17, 3, 'pipe'); s.box('head', 2, 18, 3, 2, 18, 3, 'pipe');
  s.box('head', -2, 19, -2, 2, 19, 2, 'oil'); s.box('head', -1, 20, -1, 1, 20, 1, 'oil'); s.box('head', -1, 19, -3, 1, 19, -3, 'oilDark'); // sou'wester
  s.box('armL', 3, 8, 1, 3, 9, 1, 'lamp'); s.box('armL', 3, 6, 1, 3, 7, 1, 'light'); s.box('armL', 3, 5, 1, 3, 5, 1, 'lamp');
  s.parts.armL.glow.push('light');
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

// The Accordion: the mangled thing in the hills that Sirivik worships. A person crushed as if in a
// press: the legs stand, then the back breaks flat at a right angle, runs forward, and breaks again
// to rise upright, the body pleated and folded like bellows. Long arms drag; the head hangs.
function accordion() {
  const p = { skin: '#c4aaa2', skinDark: '#9a8078', fold: '#7a5e5a', rag: '#4e4240', ragDark: '#3a302e', bone: '#e8dece', eye: '#140c0c' };
  const s = sculpt(p);
  s.part('legs', [0, 0, 0]);
  s.pair('legs', 1, 0, -1, 1, 0, 0, 'skinDark');
  s.pair('legs', 1, 1, -1, 1, 10, -1, 'rag');
  s.box('legs', -1, 9, -1, 1, 11, -1, 'ragDark');
  s.part('body', [0, 12, 2], 'breathe');
  // Broken flat: the lower back runs forward, creased like a squeezed bellows.
  for (let z = -1; z <= 8; z++) s.box('body', -2, 11, z, 2, 13, z, z % 2 ? 'fold' : 'skin');
  s.box('body', 0, 14, 0, 0, 14, 0, 'bone'); s.box('body', 0, 14, 7, 0, 14, 7, 'bone'); // the snapped spine shows at the bends
  // Broken again: the chest stands upright at the front, pleated.
  for (let y = 14; y <= 23; y++) s.box('body', -2, y, 7, 2, y, 9, y % 2 ? 'fold' : 'skin');
  s.box('body', -2, 15, 7, 2, 17, 7, 'rag');
  s.box('body', -3, 23, 7, 3, 23, 9, 'skinDark'); // hunched shoulders
  s.part('head', [0, 24, 8], 'sway', 1.3);
  s.box('head', -1, 23, 9, 1, 25, 11, 'skin'); // the head hangs forward and low
  s.box('head', -1, 24, 12, -1, 24, 12, 'eye'); s.box('head', 1, 24, 12, 1, 24, 12, 'eye'); s.box('head', 0, 23, 12, 0, 23, 12, 'eye');
  s.box('head', -1, 26, 9, 1, 26, 10, 'ragDark');
  for (const side of [-1, 1]) {
    const a = s.arm(side), x = side * 3;
    s.part(a, [x, 23, 8], 'swing', side < 0 ? 0 : 2.4);
    s.box(a, x, 9, 8, x, 22, 8, 'skin');
    s.box(a, x, 9, 8, x, 12, 8, 'skinDark');
    s.box(a, x, 6, 9, x, 8, 9, 'skinDark'); // long fingers dragging
  }
  return s.done();
}

// The God of Beauty: not of this world. A tall, pale, opal figure with no legs, its robe trailing
// into light; four long arms, two raised; a smooth golden mask with three glowing slits; a crown of
// golden rays; a ring of light behind its head and another round its waist; orbs circling it.
function godOfBeauty() {
  const p = { opal: '#f4eefa', opal2: '#e0d6f4', opal3: '#f8e2ee', gold: '#e8c25a', mask: '#f2d27a', glow: '#fff4c8', light: '#d8f0ff', slit: '#ffffff' };
  const s = sculpt(p);
  s.part('body', [0, 10, 0], 'hover');
  for (let y = 4; y <= 24; y++) { const w = y < 12 ? Math.max(0, Math.floor((y - 4) / 3)) : 2; s.box('body', -w, y, -w, w, y, w, y % 3 === 0 ? 'opal2' : y % 3 === 1 ? 'opal' : 'opal3'); }
  s.box('body', 0, 2, 0, 0, 3, 0, 'light'); // the robe trails into light
  for (let a = 0; a < 20; a++) s.box('body', Math.round(Math.cos(a / 20 * 6.28) * 5), 14, Math.round(Math.sin(a / 20 * 6.28) * 5), Math.round(Math.cos(a / 20 * 6.28) * 5), 14, Math.round(Math.sin(a / 20 * 6.28) * 5), 'light');
  s.parts.body.glow.push('light');
  s.part('head', [0, 26, 0], 'hover', 0.4);
  s.box('head', -1, 25, -1, 1, 30, 1, 'mask'); // a long, smooth mask
  for (const x of [-1, 0, 1]) s.box('head', x, 27 + (x === 0 ? 1 : 0), 2, x, 28 + (x === 0 ? 1 : 0), 2, 'slit');
  for (let a = 0; a < 7; a++) { const ang = Math.PI * (0.15 + a * 0.7 / 6); s.box('head', Math.round(Math.cos(ang) * 3), 30 + Math.round(Math.sin(ang) * 3), 0, Math.round(Math.cos(ang) * 3), 30 + Math.round(Math.sin(ang) * 3), 0, 'gold'); } // a crown of rays
  for (let a = 0; a < 24; a++) s.box('head', Math.round(Math.cos(a / 24 * 6.28) * 6), 28 + Math.round(Math.sin(a / 24 * 6.28) * 6), -3, Math.round(Math.cos(a / 24 * 6.28) * 6), 28 + Math.round(Math.sin(a / 24 * 6.28) * 6), -3, 'glow');
  s.parts.head.glow.push('glow', 'slit');
  // Four long arms: the upper pair raised, the lower pair open.
  for (const side of [-1, 1]) {
    const up = side < 0 ? 'armR' : 'armL', down = side < 0 ? 'armR2' : 'armL2', x = side * 3;
    s.part(up, [x, 23, 0], 'hover', side < 0 ? 0.8 : 1.6);
    s.box(up, x, 23, 0, x, 32, 0, 'opal'); s.box(up, x + side, 32, 0, x + side, 34, 0, 'gold');
    s.part(down, [x, 20, 0], 'hover', side < 0 ? 2.4 : 3.2);
    for (let i = 0; i <= 8; i++) s.box(down, x + side * Math.round(i / 2), 20 - i, 0, x + side * Math.round(i / 2), 20 - i, 0, 'opal2');
    s.box(down, x + side * 4, 11, 0, x + side * 5, 11, 0, 'gold');
  }
  // Orbs of light circling slowly.
  s.part('orbs', [0, 18, 0], 'spin');
  for (let a = 0; a < 5; a++) s.box('orbs', Math.round(Math.cos(a * 1.26) * 8), 18 + (a % 2) * 3, Math.round(Math.sin(a * 1.26) * 8), Math.round(Math.cos(a * 1.26) * 8), 18 + (a % 2) * 3, Math.round(Math.sin(a * 1.26) * 8), 'glow');
  s.parts.orbs.glow.push('glow');
  return s.done();
}

// Ferran, lesser god of heat: a towering giant of black basalt split by glowing lava seams, a molten
// heart in the chest, boulder shoulders, fists like cooling magma, and a crater for a head with fire
// rising out of it. Embers circle it.
function ferran() {
  const p = { rock: '#2b2523', rock2: '#3a312d', rock3: '#4a3f39', ash: '#6b625c', lava: '#ff7a1a', lava2: '#ffb238', core: '#fff0a0', fire: '#ff9a2a', fire2: '#ffd25a', ember: '#ff6a1a' };
  const s = sculpt(p);
  s.part('legs', [0, 0, 0]);
  s.pair('legs', 1, 0, -2, 4, 1, 2, 'rock'); // wide, root-like feet
  s.pair('legs', 1, 2, -1, 4, 11, 1, 'rock2');
  s.pair('legs', 2, 4, 2, 2, 9, 2, 'lava'); // seams down the shins
  s.box('legs', -1, 10, -1, 1, 11, 1, 'rock2');
  s.parts.legs.glow.push('lava');
  s.part('body', [0, 12, 0], 'breathe');
  s.box('body', -4, 12, -2, 4, 14, 2, 'rock');
  s.box('body', -6, 15, -3, 6, 24, 2, 'rock2');
  s.box('body', -5, 18, -4, 5, 23, -4, 'rock3'); // the back
  s.box('body', -2, 18, 3, 2, 22, 3, 'lava'); // the molten heart, glowing through a crack
  s.box('body', -1, 19, 3, 1, 21, 3, 'core');
  for (const [x, y0, y1] of [[-4, 15, 19], [4, 16, 21], [-3, 22, 24], [3, 12, 15], [0, 13, 17]]) s.box('body', x, y0, 3, x, y1, 3, 'lava');
  s.pair('body', 6, 22, -3, 9, 26, 2, 'rock3'); // boulder shoulders
  s.pair('body', 7, 27, -1, 8, 27, 0, 'ash'); // smoking vents
  s.pair('body', 8, 25, 3, 8, 25, 3, 'lava');
  s.parts.body.glow.push('lava', 'core');
  s.part('head', [0, 25, 0], 'nod');
  s.box('head', -3, 25, -2, 3, 29, 2, 'rock');
  s.box('head', -2, 27, 3, 2, 27, 3, 'lava'); // a burning slit for eyes
  s.box('head', -4, 29, -3, 4, 31, 3, 'rock2'); // the crater rim
  s.box('head', -3, 31, -2, 3, 31, 2, 'lava2'); // molten inside
  s.parts.head.glow.push('lava', 'lava2');
  s.part('flame', [0, 32, 0], 'breathe', 0.7);
  s.box('flame', -2, 32, -1, 2, 34, 1, 'fire');
  s.box('flame', -1, 35, -1, 1, 38, 0, 'fire2');
  s.box('flame', 0, 39, 0, 0, 41, 0, 'fire2');
  s.box('flame', -3, 33, 0, -3, 35, 0, 'fire'); s.box('flame', 3, 34, -1, 3, 36, -1, 'fire');
  s.parts.flame.glow.push('fire', 'fire2');
  for (const side of [-1, 1]) {
    const a = s.arm(side), x0 = side * 7, x1 = side * 10;
    s.part(a, [side * 8, 23, 0], 'swing', side < 0 ? 0 : 1.7);
    s.box(a, x0, 15, -2, x1, 21, 1, 'rock2');
    s.box(a, side * 9, 16, 2, side * 9, 20, 2, 'lava');
    s.box(a, x0, 9, -2, x1, 14, 1, 'rock'); // fists of cooling magma
    s.box(a, x0, 9, 2, x1, 11, 2, 'lava2');
    s.parts[a].glow.push('lava', 'lava2');
  }
  s.part('embers', [0, 20, 0], 'spin');
  for (let i = 0; i < 7; i++) { const ang = i * 0.9, r = 11; s.box('embers', Math.round(Math.cos(ang) * r), 14 + (i * 5) % 22, Math.round(Math.sin(ang) * r), Math.round(Math.cos(ang) * r), 14 + (i * 5) % 22, Math.round(Math.sin(ang) * r), 'ember'); }
  s.parts.embers.glow.push('ember');
  return s.done();
}

// Kald hånd, lesser god of cold: a tall, gaunt figure in a tattered frost-white robe that fades into
// mist, a deep hood with two cold blue eyes, a crown of icicles, a thin left arm, and a right arm
// that ends in one huge hand of clear ice with long talon fingers. Snow circles it.
function kaldHand() {
  const p = { robe: '#dfe9f2', robe2: '#b4c9de', robe3: '#7f9bba', hood: '#141a26', eye: '#8ae8ff', ice: '#7cc8f0', ice2: '#4f9fd6', ice3: '#cdf0ff', mist: '#dff4ff', skin: '#a9bccc', snow: '#ffffff' };
  const s = sculpt(p);
  s.part('body', [0, 6, 0], 'hover');
  for (let y = 2; y <= 27; y++) { // a long robe, narrowing to the shoulders, ragged at the hem
    const w = y < 8 ? 3 : y < 20 ? 2 : y < 24 ? 3 : 2;
    s.box('body', -w, y, -w + 1, w, y, w - 1, y % 4 === 0 ? 'robe2' : y > 22 ? 'robe3' : 'robe');
  }
  for (const x of [-3, -1, 2]) s.box('body', x, 0, 1, x, 1, 1, 'robe3'); // tatters
  for (let a = 0; a < 16; a++) s.box('body', Math.round(Math.cos(a / 16 * 6.28) * 5), 1, Math.round(Math.sin(a / 16 * 6.28) * 5), Math.round(Math.cos(a / 16 * 6.28) * 5), 1, Math.round(Math.sin(a / 16 * 6.28) * 5), 'mist');
  s.box('body', -3, 24, -2, 3, 26, 1, 'robe3'); // a frost mantle
  s.parts.body.glow.push('mist');
  s.part('head', [0, 28, 0], 'nod');
  s.box('head', -2, 28, -2, 2, 32, 2, 'robe2'); // the hood
  s.box('head', -1, 28, 2, 1, 31, 2, 'hood'); // darkness inside
  s.box('head', -1, 30, 2, -1, 30, 2, 'eye'); s.box('head', 1, 30, 2, 1, 30, 2, 'eye');
  s.box('head', -1, 33, -1, 1, 33, 1, 'robe2');
  for (const [x, z, h] of [[-2, 0, 3], [0, -1, 5], [2, 0, 3], [-1, 1, 2], [1, 1, 2], [0, 1, 4]]) s.box('head', x, 34, z, x, 33 + h, z, 'ice'); // icicle crown
  s.parts.head.glow.push('eye', 'ice');
  // The left arm: thin, in a long sleeve.
  s.part('armL', [3, 25, 0], 'swing', 1.7);
  s.box('armL', 3, 16, 0, 3, 25, 0, 'robe');
  s.box('armL', 3, 14, 0, 3, 15, 0, 'skin');
  // The right arm: the cold hand, a huge hand of blue ice held out in front at chest height.
  s.part('armR', [-3, 25, 0], 'nod', 0.5);
  s.box('armR', -4, 21, 0, -3, 25, 2, 'robe2'); // the sleeve, reaching forward
  s.box('armR', -5, 20, 3, -3, 22, 5, 'ice2'); // the wrist turns to ice
  s.box('armR', -7, 15, 6, -2, 21, 8, 'ice'); // the palm, facing out
  s.box('armR', -6, 16, 9, -3, 19, 9, 'ice2');
  for (const [x, len] of [[-7, 5], [-5, 6], [-4, 6], [-2, 5]]) s.box('armR', x, 22, 7, x, 21 + len, 7, 'ice3'); // long talon fingers, raised
  s.box('armR', -1, 16, 7, 0, 18, 8, 'ice3'); // the thumb
  s.parts.armR.glow.push('ice3');
  s.part('snow', [0, 18, 0], 'spin');
  for (let i = 0; i < 9; i++) { const ang = i * 0.7, r = 8 + (i % 3); s.box('snow', Math.round(Math.cos(ang) * r), 8 + (i * 7) % 28, Math.round(Math.sin(ang) * r), Math.round(Math.cos(ang) * r), 8 + (i * 7) % 28, Math.round(Math.sin(ang) * r), 'snow'); }
  s.parts.snow.glow.push('snow');
  return s.done();
}

// Maria, lesser god of forgetfulness: a tall, veiled woman of grey-violet mist with no face, only a
// smooth pale veil; long silver hair; her robe thins and breaks apart towards the hem, as if she is
// being forgotten from the feet up. Faded pages (lost memories) drift round her and vanish.
function maria() {
  const p = { robe: '#6c5f96', robe2: '#8577b0', robe3: '#b9b0dc', veil: '#eeeaf6', veil2: '#d8d2ea', hair: '#d4d8e2', hand: '#e6e2ee', page: '#f4efe0', ink: '#b9b0a0', glow: '#d9ccff' };
  const s = sculpt(p);
  s.part('body', [0, 10, 0], 'hover');
  // The robe: whole from the waist up, breaking into gaps towards the hem.
  s.box('body', -2, 13, -2, 2, 20, 2, 'robe');
  for (const y of [14, 17]) s.box('body', -2, y, -2, 2, y, 2, 'robe2');
  s.box('body', -1, 21, -1, 1, 23, 1, 'robe2');
  s.box('body', -3, 10, -3, 3, 12, 3, 'robe');
  for (let y = 4; y <= 9; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    if (Math.abs(x) < 3 && Math.abs(z) < 3) continue; // only the outer shell (the inside cannot be seen)
    if ((x * 7 + z * 13 + y * 5) % (y < 7 ? 2 : 3) === 0) continue; // dissolving
    s.box('body', x, y, z, x, y, z, y < 7 ? 'robe3' : 'robe2');
  }
  for (const [x, y, z] of [[-1, 2, 0], [2, 1, 1], [0, 0, -1], [1, 3, -2]]) s.box('body', x, y, z, x, y, z, 'robe3'); // wisps falling away
  s.box('body', -2, 21, -2, 2, 23, -2, 'hair'); // hair down the back
  s.box('body', -2, 14, -2, 2, 20, -2, 'hair');
  s.parts.body.glow.push('robe3');
  s.part('head', [0, 24, 0], 'nod');
  s.box('head', -1, 24, -1, 1, 27, 1, 'veil'); // a smooth veil, no face
  s.box('head', -2, 26, 1, 2, 26, 1, 'glow'); // a faint band of light where eyes should be
  s.box('head', -2, 25, -2, 2, 28, -1, 'hair');
  s.box('head', -1, 28, -1, 1, 28, 1, 'hair');
  s.box('head', -2, 23, 1, 2, 24, 2, 'veil2'); // the veil falling over the shoulders
  s.parts.head.glow.push('veil', 'glow');
  for (const side of [-1, 1]) {
    const a = s.arm(side), x = side * 3;
    s.part(a, [x, 22, 0], 'hover', side < 0 ? 0.6 : 1.8);
    s.box(a, x, 15, 0, x, 22, 0, 'robe2'); // long hanging sleeves
    s.box(a, x, 13, 0, x, 14, 1, 'robe3');
    s.box(a, x, 12, 1, x, 12, 1, 'hand');
  }
  s.part('pages', [0, 16, 0], 'spin');
  for (let i = 0; i < 6; i++) { const ang = i * 1.05, r = 7 + (i % 2) * 2, y = 10 + (i * 5) % 18, x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r); s.box('pages', x, y, z, x + 1, y + 1, z, i % 3 ? 'page' : 'glow'); s.box('pages', x, y + 1, z, x, y + 1, z, 'ink'); }
  s.parts.pages.glow.push('glow');
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
  'bridge-troll': { name: 'The bridge troll', match: /bridge troll/i, build: bridgeTroll },
  'lighthouse-keeper': { name: 'The lighthouse keeper', match: /lighthouse keeper/i, build: lighthouseKeeper },
  'ytter-guard': { name: 'An Ytterhavn guard', match: /ytterhavn guard|harbour guard/i, build: ytterGuard },
  lasse: { name: 'Lasse (bar drunk)', match: /^lasse$/i, build: lasse },
  accordion: { name: 'The Accordion', match: /accordion/i, build: accordion },
  'god-of-beauty': { name: 'The God of Beauty', match: /god of beauty/i, build: godOfBeauty },
  ferran: { name: 'Ferran (god of heat)', match: /^ferran\b|god of heat/i, build: ferran },
  'kald-hand': { name: 'Kald hånd (god of cold)', match: /kald h[åa]nd|god of cold/i, build: kaldHand },
  maria: { name: 'Maria (god of forgetfulness)', match: /^maria\b|god(dess)? of forgetfulness/i, build: maria },
  varg: { name: 'Varg (Edbart’s wolf)', match: /^varg$/i, build: null }, // built in model.js (MONSTER_LOOKS)
};

for (const [id, f] of Object.entries(NPC_FIGURES)) if (f.build) registerRecipe(`npc-${id}`, f.build());

// Where each figure lives, for grouping in the scene's "Who is here" list.
export const FIGURE_TOWN = {
  'lord-wolf': 'Razz of Mataz', 'the-man': 'Razz of Mataz', habibi: 'Razz of Mataz', 'silk-sister': 'Razz of Mataz', 'sand-nug': 'Razz of Mataz',
  olemann: 'Ytterhavn', bobby: 'Ytterhavn', bob: 'Ytterhavn', 'ytter-guard': 'Ytterhavn',
  'per-hul-oye': 'Sirivik', paul: 'Sirivik', 'hostel-owner': 'Sirivik', lasse: 'Sirivik', accordion: 'Sirivik', 'god-of-beauty': 'Sirivik',
  findus: 'Bartedalen', eggen: 'Bartedalen',
  'bridge-troll': 'On the road', 'lighthouse-keeper': 'At sea', varg: 'With the party',
  ferran: 'The gods', 'kald-hand': 'The gods', maria: 'The gods',
};

// The figure id for a journal person: their chosen figure, or one matching their name.
// A figure can also be any Bestiary creature: 'monster:<id>' (e.g. one Claude made in the Journal).
export function npcFigureId(data) {
  if (data?.figure === '') return null;
  if (data?.figure?.startsWith('monster:') && MONSTERS[data.figure.slice(8)]) return data.figure;
  if (data?.figure === 'hooknose' || NPC_FIGURES[data?.figure]) return data.figure;
  if (/hooknose/i.test(data?.title ?? '')) return 'hooknose';
  return Object.entries(NPC_FIGURES).find(([, f]) => f.match.test(data?.title ?? ''))?.[0] ?? null;
}
// The model name to build it with (buildMonsterFigure / monsterPortrait).
export const npcModel = (id) => (id.startsWith('monster:') ? MONSTERS[id.slice(8)]?.model ?? id.slice(8) : id === 'hooknose' ? 'hooknose' : `npc-${id}`);

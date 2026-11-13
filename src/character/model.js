// Voxel character figures: tall, slender and low in detail, in soft light.
// A figure is made of parts (legs, body, head, arms, …), each a little voxel
// mesh with its own pivot, so the parts can move for the idle animation.
// Units are voxels; a figure stands on y = 0 and faces +z. Every hero shares
// the same build: legs y 0–10, waist at 11, shoulders at 16, head from 17.
//
// Figures are dressed from their gear: the armour they wear changes the torso,
// the weapons in their hands are held, and other weapons hang at the hip or on
// the back.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import { hash } from '../city/vox.js';
import { ITEMS, has } from '../data/items.js';

const solidMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
const glowMat = new THREE.MeshBasicMaterial({ toneMapped: false });
solidMat.userData.shared = glowMat.userData.shared = true; // used by every figure

class Part {
  constructor(pivot = [0, 0, 0]) {
    this.pivot = pivot;
    this.cells = new Map();
  }
  set(x, y, z, c, glow = false) { this.cells.set(`${x},${y},${z}`, { c, glow }); return this; }
  // Inclusive box; `c` may be a function of (x, y, z).
  box(x0, y0, z0, x1, y1, z1, c) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
    return this;
  }
  build() {
    const group = new THREE.Group();
    group.position.set(...this.pivot);
    const geo = bevelBox(1, 1, 1, 0.12);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    for (const glow of [false, true]) {
      const list = [...this.cells].filter(([, v]) => v.glow === glow);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geo, glow ? glowMat : solidMat, list.length);
      list.forEach(([k, v], i) => {
        const [x, y, z] = k.split(',').map(Number);
        m.makeTranslation(x - this.pivot[0], y - this.pivot[1], z - this.pivot[2]);
        mesh.setMatrixAt(i, m);
        col.set(v.c);
        if (!glow) col.multiplyScalar(0.95 + hash(x, y, z) * 0.08);
        mesh.setColorAt(i, col);
      });
      mesh.castShadow = !glow;
      mesh.receiveShadow = !glow;
      group.add(mesh);
    }
    return group;
  }
}

// Speckled colour, for fur and pelts.
const speckle = (a, b, amount = 0.6) => (x, y, z) => (hash(x, y, z) > amount ? b : a);
const STEEL = '#dfe6ee', STEEL_DARK = '#b9c1ca', GOLD = '#d2a53c', RUNE = '#8fe3ff';

// --- Gear looks ---------------------------------------------------------------------------
// How each armour looks on the torso (x −1…1, y 12…15, z −1…1) and the shoulders.
const ARMOUR_LOOKS = {
  lamellar: { torso: (x, y) => (y === 13 ? GOLD : y % 2 ? '#4a5a78' : '#3b4862'), shoulder: '#3b4862' },
  leather: { torso: (x, y, z) => (x === 0 && z === 1 && y % 2 === 0 ? '#5e3d27' : '#8a5a34'), shoulder: '#6b4a2e' },
  hide: { torso: speckle('#7d6650', '#9a8468', 0.55), shoulder: '#c9c3b6' },
  scale: { torso: (x, y) => (y % 2 ? '#a8865a' : '#8f7048'), shoulder: '#7d5f3c' },
  chain: { torso: speckle('#aab3bd', '#8d96a1', 0.5), shoulder: STEEL_DARK },
};

// Weapons drawn from the grip (origin) along +y.
const WOOD = '#7a5132', GRIP = '#3a2a20';
const WEAPON_LOOKS = {
  katana(p) {
    for (let y = -1; y <= 1; y++) p.set(0, y, 0, y % 2 ? '#2b3150' : '#e8e1d0');
    p.set(0, 2, 0, GOLD).set(-1, 2, 0, GOLD).set(1, 2, 0, GOLD);
    for (let y = 3; y <= 11; y++) p.set(0, y, 0, y === 6 || y === 9 ? RUNE : STEEL, y === 6 || y === 9);
  },
  tanto(p) {
    p.set(0, -1, 0, '#2b3150').set(0, 0, 0, '#e8e1d0').set(0, 1, 0, GOLD);
    for (let y = 2; y <= 4; y++) p.set(0, y, 0, STEEL);
  },
  longsword(p, item) {
    if (item.gem) p.set(0, -2, 0, '#ff5a3c', true); else p.set(0, -2, 0, STEEL_DARK);
    for (let y = -1; y <= 1; y++) p.set(0, y, 0, GRIP);
    p.set(-1, 2, 0, STEEL_DARK).set(0, 2, 0, STEEL_DARK).set(1, 2, 0, STEEL_DARK);
    for (let y = 3; y <= 11; y++) p.set(0, y, 0, STEEL);
  },
  dagger(p) {
    p.set(0, -1, 0, '#5e3d27').set(0, 0, 0, '#5e3d27');
    for (let y = 1; y <= 3; y++) p.set(0, y, 0, STEEL);
  },
  handaxe(p) {
    for (let y = -2; y <= 4; y++) p.set(0, y, 0, '#6b4a2e');
    p.set(0, 3, 1, STEEL_DARK).set(0, 4, 1, STEEL_DARK).set(0, 2, 2, STEEL).set(0, 3, 2, STEEL).set(0, 4, 2, STEEL).set(0, 5, 2, STEEL);
  },
  shortsword(p) {
    p.set(0, -1, 0, GRIP).set(0, 0, 0, GRIP);
    p.set(-1, 1, 0, STEEL_DARK).set(0, 1, 0, STEEL_DARK).set(1, 1, 0, STEEL_DARK);
    for (let y = 2; y <= 7; y++) p.set(0, y, 0, STEEL);
  },
  rapier(p) {
    p.set(0, -1, 0, GRIP).set(0, 0, 0, GRIP);
    p.set(0, 1, 1, GOLD).set(0, 0, 1, GOLD).set(-1, 1, 0, GOLD).set(1, 1, 0, GOLD);
    for (let y = 2; y <= 11; y++) p.set(0, y, 0, y > 8 ? STEEL_DARK : STEEL);
  },
  mace(p) {
    for (let y = -1; y <= 3; y++) p.set(0, y, 0, y < 1 ? GRIP : WOOD);
    p.box(-1, 4, -1, 1, 6, 1, (x, y, z) => (Math.abs(x) + Math.abs(z) === 2 ? STEEL_DARK : STEEL));
    p.set(0, 7, 0, STEEL);
  },
  staff(p) {
    for (let y = -6; y <= 10; y++) p.set(0, y, 0, y % 5 === 0 ? '#5e3d27' : WOOD);
    p.set(0, 11, 0, '#5e3d27').set(1, 11, 0, WOOD).set(-1, 12, 0, WOOD);
  },
  spear(p) {
    for (let y = -6; y <= 9; y++) p.set(0, y, 0, WOOD);
    p.set(0, 10, 0, STEEL_DARK).set(-1, 11, 0, STEEL).set(0, 11, 0, STEEL).set(1, 11, 0, STEEL).set(0, 12, 0, STEEL).set(0, 13, 0, STEEL);
  },
  greataxe(p) {
    for (let y = -3; y <= 10; y++) p.set(0, y, 0, y < 0 ? GRIP : WOOD);
    p.box(0, 6, 1, 0, 10, 1, STEEL_DARK);
    p.box(0, 5, 2, 0, 11, 3, STEEL);
    p.box(0, 7, -1, 0, 9, -1, STEEL_DARK).set(0, 8, -2, STEEL);
  },
  crossbow(p) {
    for (let y = -2; y <= 4; y++) p.set(0, y, 0, WOOD);
    for (let x = -3; x <= 3; x++) p.set(x, 4 - Math.round(Math.abs(x) / 2), 0, '#5e3d27');
    p.set(0, 5, 0, STEEL);
  },
  shortbow: (p) => bow(p, 5, '#8a5a34'),
  longbow: (p) => bow(p, 7, WOOD),
};

// A shield strapped to the forearm, facing outwards.
function shieldPart(side) {
  const p = new Part();
  const rim = '#6b4a2e', face = '#8a5a34', boss = STEEL;
  for (let y = -4; y <= 2; y++) for (let z = -2; z <= 2; z++) {
    const edge = Math.abs(z) === 2 || y === -4 || y === 2;
    if ((y === -4 || y === 2) && Math.abs(z) === 2) continue;
    p.set(0, y, z, edge ? rim : face);
  }
  p.set(side, -1, 0, boss);
  const g = p.build();
  g.position.set(side, -3, 0.5);
  return g;
}

// A bow held upright, bowing forward, with its string.
function bow(p, half, wood) {
  for (let y = -half; y <= half; y++) {
    const bend = Math.round(Math.cos((Math.PI * y) / (2 * half + 2)) * 1.6);
    p.set(0, y, bend, wood);
    if (bend > 0 && y !== 0) p.set(0, y, 0, '#efe8d8');
  }
}

// A weapon in a hand. Blades point forward and a little down; bows stand upright.
// Staffs and spears are held upright; crossbows point forward. `hand` is where
// the hand is, relative to the shoulder.
function heldWeapon(item, side, hand = [0, -5, 0]) {
  if (item.kind === 'shield') return shieldPart(side);
  const p = new Part();
  WEAPON_LOOKS[item.model]?.(p, item);
  const g = p.build();
  g.position.set(...hand);
  if (item.model === 'crossbow') g.rotation.x = 1.5;
  else if (has(item, 'ranged')) g.rotation.y = side * 0.3;
  else if (item.model === 'staff' || item.model === 'spear') g.rotation.x = 0.25;
  else g.rotation.x = 1.9;
  return g;
}

const SWORDS = ['katana', 'longsword', 'shortsword', 'rapier'];

// A sheathed sword at the left hip: hilt forward and up, scabbard back and down.
// `drawn` leaves only the empty scabbard.
function hipSword(item, drawn) {
  const p = new Part([3, 11, 0]);
  const katana = item.model === 'katana';
  if (!drawn) {
    if (katana) {
      for (let z = 2; z <= 5; z++) p.set(3, 11, z, z % 2 ? '#2b3150' : '#e8e1d0');
      p.set(3, 11, 1, GOLD).set(3, 12, 1, GOLD).set(3, 10, 1, GOLD);
    } else {
      if (item.gem) p.set(3, 11, 5, '#ff5a3c', true); else p.set(3, 11, 5, STEEL_DARK);
      for (let z = 2; z <= 4; z++) p.set(3, 11, z, GRIP);
      p.set(3, 12, 1, STEEL_DARK).set(3, 11, 1, STEEL_DARK).set(3, 10, 1, STEEL_DARK);
    }
  }
  for (let z = 0; z >= (katana ? -10 : item.model === 'shortsword' ? -6 : -9); z--) {
    const rune = katana && (z === -3 || z === -6 || z === -9);
    p.set(3, 11, z, rune ? RUNE : katana ? '#1e1b24' : '#4a2f22', rune);
  }
  const g = p.build();
  g.rotation.x = katana ? -0.42 : -0.5;
  return g;
}

// A hand axe hanging at the right hip.
function hipAxe() {
  const p = new Part([-3, 11, 0]);
  for (let y = 8; y <= 12; y++) p.set(-3, y, 1, '#6b4a2e');
  p.set(-3, 12, 2, STEEL).set(-3, 11, 2, STEEL).set(-3, 12, 3, STEEL).set(-3, 11, 3, STEEL).set(-3, 10, 3, STEEL);
  return p.build();
}

// Quiver on the back, with the bow beside it unless the bow is in hand.
function backGear(bowItem, bowInHand) {
  const p = new Part([0, 13, -3]);
  if (!bowInHand) {
    const half = bowItem.model === 'longbow' ? 6 : 5;
    for (let y = 13 - half; y <= 13 + half; y++) {
      const bend = Math.round(Math.cos((Math.PI * (y - 13)) / (2 * half + 2)) * 1.4);
      p.set(1 - bend, y, -3, bowItem.model === 'longbow' ? '#7a5132' : '#8a5a34');
      if (bend > 0) p.set(1, y, -3, '#efe8d8');
    }
  }
  const flame = bowItem.arrows === 'flame';
  p.box(-1, 10, -3, -1, 15, -3, '#6b4a2e');
  p.set(-1, 16, -3, '#f1ece2').set(-1, 17, -3, '#f1ece2');
  p.set(-1, 18, -3, flame ? '#ff6a2b' : STEEL_DARK, flame).set(-1, 18, -4, flame ? '#ffb347' : STEEL_DARK, flame);
  return p;
}

// --- Assembly ---------------------------------------------------------------------------------
// An arm hanging from the shoulder at x = ±2: sleeve, cuff/bracer, hand.
function arm(side, { sleeve, sleeveShade, cuff, cuffLine = cuff, skin, shoulder }) {
  const x = side * 2;
  const a = new Part([x, 15, 0]);
  a.box(x, 13, 0, x, 15, 0, sleeve);
  if (shoulder) a.set(x, 15, 0, shoulder).set(x, 15, -1, shoulder).set(x, 15, 1, shoulder);
  a.set(x, 13, -1, sleeveShade ?? sleeve);
  a.set(x, 12, 0, cuff).set(x, 11, 0, cuffLine);
  a.set(x, 10, 0, skin);
  return a;
}

// What a character's gear adds to a figure: what each hand holds, things
// hanging at the hips, and the quiver (and stowed bow) on the back.
function gearOn(gear) {
  const main = ITEMS[gear.equipped.mainHand] ?? null;
  const off = ITEMS[gear.equipped.offHand] ?? null;
  const owned = gear.items.map((i) => ITEMS[i.id]).filter(Boolean);

  // Bows and crossbows are held in the left hand; everything else in the right.
  const hands = { right: null, left: off };
  if (main && has(main, 'ranged')) hands.left = main; else hands.right = main;

  const statics = [];
  const sword = owned.find((i) => SWORDS.includes(i.model));
  if (sword) statics.push(hipSword(sword, sword === main || sword === off));
  if (owned.some((i) => i.model === 'handaxe') && ![main, off].some((i) => i?.model === 'handaxe')) statics.push(hipAxe());
  const bowItem = owned.find((i) => has(i, 'ranged'));
  const back = bowItem ? backGear(bowItem, bowItem === main || bowItem.model === 'crossbow') : null;
  return { hands, statics, back };
}

// Puts the gear on a figure. `look` is the character's own colours and parts;
// `gear` is what they own and have equipped.
function dress(look, gear) {
  const armour = ARMOUR_LOOKS[ITEMS[gear.equipped.armour]?.model] ?? null;
  const body = look.body(armour?.torso ?? look.clothes);
  const arms = [-1, 1].map((side) => arm(side, { ...look.sleeves, shoulder: armour?.shoulder }));
  return assemble({ ...look, body, arms, ...gearOn(gear) });
}

const liftFor = (item) => (!item ? 0 : item.kind === 'shield' || has(item, 'ranged') ? -0.15 : -0.3);

// Assembles parts into a figure with a shared idle animation: breathing, a slow
// look around, arms and cloak swaying. `extras` animate themselves.
function assemble({ legs, body, cloak, head, arms, back, hands = {}, statics = [], extras = [] }) {
  const root = new THREE.Group();
  const meshes = {};
  root.add((meshes.legs = legs.build()));
  root.add((meshes.body = body.build()));
  if (cloak) root.add((meshes.cloak = cloak.build()));
  root.add((meshes.head = head.build()));
  if (back) root.add((meshes.back = back.build()));
  const armMeshes = arms.map((a, i) => {
    const m = a.build();
    const item = i === 0 ? hands.right : hands.left;
    if (item) m.add(heldWeapon(item, i === 0 ? -1 : 1));
    m.userData.lift = liftFor(item); // raise a held weapon
    root.add(m);
    return m;
  });
  const hip = new THREE.Group();
  statics.forEach((g) => hip.add(g));
  root.add(hip);
  for (const e of extras) root.add(e.group);
  const rest = Object.fromEntries(Object.entries(meshes).map(([k, m]) => [k, m.position.y]));
  const armRest = armMeshes[0].position.y;

  function update(t) {
    const breathe = Math.sin(t * 1.8) * 0.1;
    meshes.body.position.y = rest.body + breathe;
    meshes.head.position.y = rest.head + breathe * 1.2;
    if (meshes.cloak) {
      meshes.cloak.position.y = rest.cloak + breathe;
      meshes.cloak.rotation.x = -0.05 - Math.sin(t * 0.9) * 0.04;
    }
    if (meshes.back) meshes.back.position.y = rest.back + breathe;
    hip.position.y = breathe * 0.4;
    meshes.head.rotation.y = Math.sin(t * 0.45) * 0.3;
    meshes.head.rotation.x = Math.sin(t * 0.3 + 1) * 0.05;
    armMeshes.forEach((a, i) => {
      a.position.y = armRest + breathe;
      a.rotation.x = a.userData.lift + Math.sin(t * 1.1 + i * 1.7) * 0.06;
      a.rotation.z = (i ? 1 : -1) * (0.04 + Math.sin(t * 1.8) * 0.015);
    });
    for (const e of extras) e.update(t);
  }
  return { group: root, update };
}

// --- Rikart Hagenstorm --------------------------------------------------------------
// A swordsman from the northern isles, trained in Hrimnir: copper hair in a
// topknot, a white headband, a steel-blue jacket and indigo hakama, a fur mantle
// and a short northern cloak.
function rikart() {
  const C = {
    skin: '#e7b28c', hair: '#b8582c', hairDark: '#8e3f1e', band: '#f1ece2',
    gi: '#7f90ab', giShade: '#6b7b95', collar: '#efeae0', obi: '#a8432f',
    hakama: '#2f3550', pleat: '#252a42', fur: '#ece6da', furShade: '#cfc6b6',
    cloak: '#3d4b7a', cloakLining: '#d9c08a', wrap: '#efe8d8', wrapLine: '#c9b896', sandal: '#5a3d2a',
  };

  // Long thin legs: sandals, wrapped shins, slim hakama with pleated panels.
  const legs = new Part();
  for (const x of [-1, 1]) {
    legs.set(x, 0, 0, C.sandal).set(x, 0, 1, C.sandal);
    legs.set(x, 1, 0, C.wrap).set(x, 2, 0, C.wrapLine).set(x, 3, 0, C.wrap);
    for (let y = 4; y <= 10; y++) legs.set(x, y, 0, y <= 5 ? C.pleat : C.hakama);
    legs.set(x, 4, -1, C.pleat).set(x, 5, -1, C.hakama);
  }
  for (let y = 7; y <= 10; y++) for (const z of [1, -1]) for (let x = -1; x <= 1; x++) legs.set(x, y, z, x === 0 ? C.pleat : C.hakama);
  legs.set(0, 10, 0, C.hakama).set(0, 9, 0, C.hakama);

  const body = (torso) => {
    const b = new Part([0, 11, 0]);
    b.box(-1, 11, -1, 1, 11, 1, C.obi);
    b.set(1, 11, 2, C.obi).set(1, 10, 2, C.obi);
    b.box(-1, 12, -1, 1, 15, 1, torso);
    b.set(0, 15, 1, C.collar).set(1, 15, 1, C.collar);
    b.box(-2, 16, -1, 2, 16, 1, speckle(C.fur, C.furShade));
    return b;
  };

  const cloak = new Part([0, 16, -2]);
  for (let y = 7; y <= 15; y++) for (let x = -1; x <= 1; x++) cloak.set(x, y, -2, y === 7 ? C.cloakLining : C.cloak);

  const head = new Part([0, 17, 0]);
  head.box(-1, 17, -1, 1, 20, 1, C.skin);
  head.set(-1, 17, 1, C.hair).set(0, 17, 1, C.hair).set(1, 17, 1, C.hair).set(0, 16, 1, C.hairDark);
  head.set(-1, 17, 0, C.hairDark).set(1, 17, 0, C.hairDark).set(-1, 18, 0, C.hairDark).set(1, 18, 0, C.hairDark);
  head.box(-1, 17, -1, 1, 20, -1, C.hair);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (Math.abs(x) === 1 || Math.abs(z) === 1) head.set(x, 20, z, C.band);
  head.set(0, 20, -2, C.band).set(0, 19, -2, C.band).set(1, 18, -2, C.band);
  head.box(-1, 21, -1, 1, 21, 1, C.hair);
  head.set(0, 22, 0, C.hairDark).set(0, 23, 0, C.hair).set(0, 23, -1, C.hair);

  return {
    legs, body, cloak, head,
    clothes: (x, y, z) => (z === -1 ? C.giShade : C.gi),
    sleeves: { sleeve: C.gi, sleeveShade: C.giShade, cuff: C.wrap, cuffLine: C.wrapLine, skin: C.skin },
    stage: 6, zoom: 1,
  };
}

// --- Flame Slinger --------------------------------------------------------------------
// An elf from the islands of the far south-west: flame-red hair in a ponytail,
// long ears, a leaf-green tunic with a bandolier of throwing knives and a red cape.
function flameSlinger() {
  const C = {
    skin: '#c98e62', hair: '#de5a28', hairDark: '#a8401f',
    tunic: '#4f7a3e', tunicShade: '#40652f', sash: '#7a4a2a', knife: '#d4dadf',
    belt: '#5e3d27', buckle: '#e0b44a', trousers: '#4a3b2e', boots: '#3a2a20', bracer: '#7a5132',
    cape: '#b8402f', capeLining: '#e8b04a',
  };

  const legs = new Part();
  for (const x of [-1, 1]) {
    legs.set(x, 0, 0, C.boots).set(x, 0, 1, C.boots);
    for (let y = 1; y <= 3; y++) legs.set(x, y, 0, C.boots);
    for (let y = 4; y <= 10; y++) legs.set(x, y, 0, C.trousers);
  }
  legs.box(-1, 9, 0, 1, 10, 0, C.trousers);
  legs.set(-1, 10, 1, C.belt).set(-1, 9, 1, C.belt); // belt pouch

  const body = (torso) => {
    const b = new Part([0, 11, 0]);
    b.box(-1, 11, -1, 1, 11, 1, C.belt).set(0, 11, 1, C.buckle);
    b.box(-1, 12, -1, 1, 15, 1, torso);
    // Bandolier of throwing knives across the chest.
    b.set(1, 15, 1, C.sash).set(0, 14, 1, C.knife).set(-1, 13, 1, C.sash).set(-1, 12, 1, C.knife);
    b.box(-2, 16, -1, 2, 16, 1, C.cape); // the cape gathered at the shoulders
    return b;
  };

  const cloak = new Part([0, 16, -2]);
  for (let y = 9; y <= 15; y++) for (let x = -1; x <= 1; x++) cloak.set(x, y, -2, y === 9 ? C.capeLining : C.cape);

  const head = new Part([0, 17, 0]);
  head.box(-1, 17, -1, 1, 20, 1, C.skin);
  head.box(-1, 17, -1, 1, 20, -1, C.hair);
  head.box(-1, 21, -1, 1, 21, 1, C.hair);
  head.set(-1, 20, 1, C.hair).set(1, 20, 1, C.hair).set(-1, 20, 0, C.hairDark).set(1, 20, 0, C.hairDark);
  for (const x of [-2, 2]) head.set(x, 18, 0, C.skin).set(x, 19, 0, C.skin).set(x, 20, -1, C.skin); // elf ears
  head.set(0, 20, -2, C.hairDark).set(0, 19, -2, C.hair).set(0, 18, -2, C.hair).set(0, 17, -2, C.hair).set(0, 16, -3, C.hairDark);

  return {
    legs, body, cloak, head,
    clothes: (x, y, z) => (z === -1 ? C.tunicShade : C.tunic),
    sleeves: { sleeve: C.tunic, sleeveShade: C.tunicShade, cuff: C.bracer, skin: C.skin },
    stage: 6, zoom: 1,
  };
}

// --- Varg, Edbart's wolf ----------------------------------------------------------------
function buildVarg(x0, z0) {
  const C = { fur: '#8e959d', furLight: '#d6dade', furDark: '#5f666e', nose: '#2a2628', eye: '#f2c94c' };
  const group = new THREE.Group();
  const body = new Part();
  for (const [dx, dz] of [[0, 0], [2, 0], [0, 5], [2, 5]]) body.box(x0 + dx, 0, z0 + dz, x0 + dx, 3, z0 + dz, C.furDark);
  body.box(x0, 4, z0 - 1, x0 + 2, 6, z0 + 6, speckle(C.fur, C.furDark, 0.75));
  body.box(x0, 4, z0 + 5, x0 + 2, 5, z0 + 6, C.furLight); // pale chest
  body.box(x0 + 1, 7, z0 + 3, x0 + 1, 7, z0 + 6, C.fur); // raised scruff
  group.add(body.build());

  const head = new Part([x0 + 1, 7, z0 + 6]);
  head.box(x0, 6, z0 + 7, x0 + 2, 8, z0 + 9, C.fur);
  head.box(x0, 6, z0 + 10, x0 + 2, 6, z0 + 11, C.furLight); // muzzle
  head.box(x0 + 1, 7, z0 + 10, x0 + 1, 7, z0 + 11, C.fur);
  head.set(x0 + 1, 7, z0 + 12, C.nose).set(x0 + 1, 6, z0 + 12, C.nose);
  head.set(x0, 8, z0 + 9, C.eye, true).set(x0 + 2, 8, z0 + 9, C.eye, true);
  head.set(x0, 9, z0 + 7, C.furDark).set(x0 + 2, 9, z0 + 7, C.furDark).set(x0, 10, z0 + 7, C.furDark).set(x0 + 2, 10, z0 + 7, C.furDark);
  const headMesh = head.build();
  group.add(headMesh);

  const tail = new Part([x0 + 1, 6, z0 - 2]);
  tail.set(x0 + 1, 6, z0 - 2, C.fur).set(x0 + 1, 6, z0 - 3, C.fur).set(x0 + 1, 5, z0 - 4, C.fur).set(x0 + 1, 4, z0 - 5, C.furLight);
  const tailMesh = tail.build();
  group.add(tailMesh);

  return {
    group,
    update(t) {
      tailMesh.rotation.y = Math.sin(t * 5) * 0.35;
      headMesh.rotation.y = Math.sin(t * 0.6 + 2) * 0.25;
      headMesh.rotation.x = Math.sin(t * 0.4) * 0.06;
    },
  };
}

// --- Edbart Frostvarg ----------------------------------------------------------------------
// A hunter from the mountains of Fjellene av Ferran: a wolf-pelt hood, a great
// dark beard, a long pelt cloak, and Varg at his side.
function edbart() {
  const C = {
    skin: '#e2a982', beard: '#5a3a24', beardDark: '#43291a',
    pelt: '#9aa3ad', peltLight: '#d7dce0', peltDark: '#6f7882', snout: '#2f2b2c',
    leather: '#7a5236', leatherDark: '#5e3d27', shirt: '#4d5b4a', shirtShade: '#414e3f',
    trousers: '#5b4636', boots: '#3d2c22', belt: '#3d2c22', buckle: '#b9bec4',
  };

  const legs = new Part();
  for (const x of [-1, 1]) {
    legs.set(x, 0, 0, C.boots).set(x, 0, 1, C.boots).set(x, 1, 0, C.boots).set(x, 2, 0, C.boots);
    legs.set(x, 3, 0, C.peltLight); // fur cuff
    for (let y = 4; y <= 10; y++) legs.set(x, y, 0, C.trousers);
  }
  legs.box(-1, 9, 0, 1, 10, 0, C.trousers);

  const body = (torso) => {
    const b = new Part([0, 11, 0]);
    b.box(-1, 11, -1, 1, 11, 1, C.belt).set(0, 11, 1, C.buckle);
    b.box(-1, 12, -1, 1, 15, 1, torso);
    b.box(-2, 16, -1, 2, 16, 1, speckle(C.pelt, C.peltLight));
    b.set(-2, 15, -1, C.pelt).set(2, 15, -1, C.pelt);
    return b;
  };

  // Long pelt cloak with a ragged hem.
  const cloak = new Part([0, 16, -2]);
  for (let y = 5; y <= 15; y++) for (let x = -1; x <= 1; x++) {
    if (y === 5 && x !== 0) continue;
    cloak.set(x, y, -2, speckle(C.pelt, C.peltDark, 0.7)(x, y, -2));
  }

  // Head in a wolf-pelt hood: the wolf's brow and ears sit on top.
  const head = new Part([0, 17, 0]);
  head.box(-1, 17, -1, 1, 20, 1, C.skin);
  head.box(-1, 17, 1, 1, 17, 1, C.beard).set(0, 16, 1, C.beardDark).set(-1, 18, 1, C.beard).set(1, 18, 1, C.beard);
  head.set(-1, 17, 0, C.beardDark).set(1, 17, 0, C.beardDark);
  for (const x of [-2, 2]) head.box(x, 17, -1, x, 20, 0, C.pelt);
  head.box(-1, 17, -2, 1, 20, -2, C.pelt);
  head.box(-2, 21, -2, 2, 21, 1, speckle(C.pelt, C.peltLight));
  head.box(-1, 21, 2, 1, 21, 2, C.peltDark).set(0, 21, 3, C.snout);
  head.set(-1, 22, -1, C.peltDark).set(1, 22, -1, C.peltDark);

  return {
    legs, body, cloak, head,
    clothes: (x, y, z) => (x === 0 && z === 1 ? C.leatherDark : z === -1 ? C.shirtShade : C.shirt),
    sleeves: { sleeve: C.shirt, cuff: C.leather, cuffLine: C.leatherDark, skin: C.skin },
    extras: [buildVarg(5, -3)],
    offsetX: -2.5, // keep Edbart and Varg centred on the stage
    stage: 9, zoom: 1.2,
  };
}

const LOOKS = { rikart, 'flame-slinger': flameSlinger, edbart };

// Builds the figure for a character, dressed in their current gear. Heroes made
// in the character creator carry a recipe Claude designed (`figure`).
export function buildFigure(character) {
  if (character.figure) return buildRecipeHero(character.figure, character);
  const look = LOOKS[character.model]?.();
  if (!look) return null;
  const figure = dress(look, character);
  figure.group.position.x = look.offsetX ?? 0;
  return { ...figure, stage: look.stage, zoom: look.zoom };
}

// --- Enemies ------------------------------------------------------------------------------------

// A Hooknose cutthroat of Razz of Mataz: short and hunched, wrapped in dark
// indigo cloth with only the hooked nose showing, and a knife curved like it.
function buildHooknose() {
  const C = {
    cloth: '#2f3157', clothDark: '#262848', wrap: '#3b3d66', feet: '#1e1b24',
    skin: '#c08a6a', eye: '#ffd27a', blade: STEEL, grip: '#5e3d27',
  };
  const root = new THREE.Group();

  const legs = new Part();
  for (const x of [-1, 1]) {
    legs.set(x, 0, 0, C.feet).set(x, 0, 1, C.feet);
    for (let y = 1; y <= 3; y++) legs.set(x, y, 0, y === 2 ? C.wrap : C.clothDark);
  }
  root.add(legs.build());

  // Hunched body: the robe, with a hump of cloth on the back.
  const body = new Part([0, 4, 0]);
  body.box(-1, 4, -1, 1, 9, 1, (x, y, z) => (y === 4 || z === -1 ? C.clothDark : C.cloth));
  body.box(-1, 8, -2, 1, 10, -2, C.clothDark);
  body.set(0, 4, 2, C.clothDark).set(0, 5, 2, C.cloth); // hanging fold
  const bodyMesh = body.build();
  root.add(bodyMesh);

  // Head pushed forward by the hunch: wrapped cloth, glinting eyes, the hooked nose.
  const head = new Part([0, 10, 1]);
  head.box(-1, 10, 0, 1, 12, 2, C.cloth);
  head.set(0, 13, 1, C.clothDark).set(0, 13, 0, C.clothDark);
  head.set(-1, 11, 2, '#14121c').set(1, 11, 2, '#14121c');
  head.set(-1, 11, 3, C.eye, true).set(1, 11, 3, C.eye, true);
  head.set(0, 11, 3, C.skin).set(0, 11, 4, C.skin).set(0, 10, 4, C.skin);
  const headMesh = head.build();
  root.add(headMesh);

  // Arms; the right hand holds the curved knife.
  const arms = [-1, 1].map((side) => {
    const x = side * 2;
    const a = new Part([x, 9, 0]);
    a.box(x, 5, 0, x, 9, 0, C.cloth);
    a.set(x, 4, 0, C.skin);
    const mesh = a.build();
    if (side === -1) {
      const knife = new Part();
      knife.set(0, 0, 0, C.grip).set(0, 0, 1, C.blade).set(0, 1, 2, C.blade).set(0, 2, 2, C.blade).set(0, 3, 1, C.blade);
      const k = knife.build();
      k.position.set(0, -5, 0.5);
      mesh.add(k);
    }
    root.add(mesh);
    return mesh;
  });

  return {
    group: root,
    // A twitchy crouch: bobbing, peering about, knife at the ready.
    update(t) {
      const bob = Math.abs(Math.sin(t * 2.6)) * 0.25;
      bodyMesh.position.y = 4 + bob;
      headMesh.position.y = 10 + bob;
      headMesh.rotation.y = Math.sin(t * 0.8) * 0.4;
      arms.forEach((a, i) => {
        a.position.y = 9 + bob;
        a.rotation.x = (i ? 0 : -0.5) + Math.sin(t * 2.6 + i) * 0.08;
      });
    },
    stage: 5, zoom: 0.8,
  };
}

const MONSTER_LOOKS = { hooknose: buildHooknose };

// --- Recipe figures (made by the monster generator) ----------------------------------------------
// A recipe describes a figure as parts made of coloured boxes:
//   palette: { key: '#hex' }
//   parts:   [{ name, pivot: [x,y,z], motion, phase, boxes: [[x0,y0,z0, x1,y1,z1, key], …], glow: [key] }]
// Boxes are inclusive voxel ranges; the figure stands on y = 0 and faces +z.
// `motion` animates the part around its pivot (see MOTIONS). Recipes come from
// Claude, so everything is checked and clamped in sanitizeRecipe first.
const MOTIONS = {
  none: () => {},
  breathe: (g, t, p) => { g.position.y = g.userData.y + Math.sin(t * 1.8 + p) * 0.12; },
  bob: (g, t, p) => { g.position.y = g.userData.y + Math.abs(Math.sin(t * 2.6 + p)) * 0.3; },
  sway: (g, t, p) => { g.rotation.y = Math.sin(t * 0.6 + p) * 0.3; },
  swing: (g, t, p) => { g.rotation.x = Math.sin(t * 1.4 + p) * 0.2; },
  wag: (g, t, p) => { g.rotation.y = Math.sin(t * 5 + p) * 0.35; },
  flap: (g, t, p) => { g.rotation.z = Math.sin(t * 4 + p) * 0.45; },
  nod: (g, t, p) => { g.rotation.x = Math.sin(t * 0.9 + p) * 0.08; },
  spin: (g, t, p) => { g.rotation.y = t * 1.2 + p; },
  hover: (g, t, p) => { g.position.y = g.userData.y + Math.sin(t * 1.3 + p) * 0.6; },
};

export function buildRecipeFigure(recipe) {
  const root = new THREE.Group();
  const animated = [];
  const built = []; // index in recipe.parts of each child of root
  for (const [index, part] of recipe.parts.entries()) {
    const p = new Part(part.pivot);
    const glow = new Set(part.glow);
    for (const [x0, y0, z0, x1, y1, z1, key] of part.boxes) {
      const colour = recipe.palette[key];
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) p.set(x, y, z, colour, glow.has(key));
    }
    if (!p.cells.size) continue;
    const g = p.build();
    g.userData.y = g.position.y;
    root.add(g);
    built.push(index);
    if (part.motion !== 'none') animated.push([g, MOTIONS[part.motion], part.phase]);
  }
  const height = Math.max(8, ...recipe.parts.flatMap((pt) => pt.boxes.map((b) => Math.max(b[1], b[4]) + 1)));
  return {
    group: root,
    parts: built,
    // `skip`: groups animated by someone else (a hero's arms).
    update(t, skip) { for (const [g, move, phase] of animated) if (!skip?.has(g)) move(g, t, phase); },
    stage: Math.min(12, Math.max(5, Math.round(recipe.footprint ?? 6))),
    zoom: Math.max(0.8, height / 24, (recipe.footprint ?? 6) / 8), // fit tall and wide creatures
  };
}

// A hero from the creator: a recipe with the shared hero skeleton, where the parts
// named "armR" and "armL" are the arms (the figure's right arm is at −x). The
// gear is added like on the hand-made heroes: weapons in the hands, swords and
// axes at the hips, the quiver on the back, all scaled to the hero's height.
function buildRecipeHero(recipe, gear) {
  const figure = buildRecipeFigure(recipe);
  const { hands, statics, back } = gearOn(gear);
  const arms = [];
  let shoulder = 15;
  for (const [side, name] of [[-1, 'armR'], [1, 'armL']]) {
    const i = recipe.parts.findIndex((pt) => pt.name === name);
    const part = recipe.parts[i];
    const g = figure.group.children[figure.parts.indexOf(i)];
    if (!part || !g) continue;
    shoulder = part.pivot[1];
    // The hand is the lowest voxel of the arm.
    const low = part.boxes.reduce((best, b) => (Math.min(b[1], b[4]) < Math.min(best[1], best[4]) ? b : best));
    const hand = [(low[0] + low[3]) / 2 - part.pivot[0], Math.min(low[1], low[4]) - part.pivot[1], (low[2] + low[5]) / 2 - part.pivot[2]];
    const item = side === -1 ? hands.right : hands.left;
    if (item) g.add(heldWeapon(item, side, hand));
    g.userData.lift = liftFor(item);
    arms.push([g, side]);
  }
  // Hip and back gear were made for a 24-voxel hero with shoulders at 15.
  const scale = Math.min(1.3, Math.max(0.55, shoulder / 15));
  const kit = new THREE.Group();
  statics.forEach((g) => kit.add(g));
  if (back) kit.add(back.build());
  kit.scale.setScalar(scale);
  figure.group.add(kit);

  const update = figure.update;
  figure.update = (t) => {
    update(t, new Set(arms.map(([g]) => g)));
    const breathe = Math.sin(t * 1.8) * 0.1;
    kit.position.y = breathe * 0.4;
    for (const [g, side] of arms) {
      g.rotation.x = g.userData.lift + Math.sin(t * 1.1 + (side + 1) * 0.85) * 0.06;
      g.rotation.z = side * (0.04 + Math.sin(t * 1.8) * 0.015);
    }
  };
  // Keep a hero with a companion animal centred on the stage.
  const box = new THREE.Box3().setFromObject(figure.group);
  figure.group.position.x = -(box.min.x + box.max.x) / 2;
  figure.stage = Math.max(6, figure.stage);
  figure.zoom = Math.max(1, figure.zoom);
  return figure;
}

const clampInt = (v, lo, hi, d = 0) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);
const HEX = /^#[0-9a-f]{6}$/i;
const LIMITS = { x: 12, yMax: 44, z: 12, boxes: 500, cells: 9000 };

// Makes a recipe safe to build: valid colours, coordinates in range, a cap on
// size. Returns null if nothing usable is left.
export function sanitizeRecipe(raw) {
  const palette = {};
  for (const [k, v] of Object.entries(raw?.palette ?? {})) if (HEX.test(String(v))) palette[String(k)] = String(v);
  let boxes = 0, cells = 0, xs = 0;
  const parts = [];
  for (const part of Array.isArray(raw?.parts) ? raw.parts.slice(0, 16) : []) {
    const clean = {
      name: String(part?.name ?? 'part').slice(0, 30),
      pivot: [clampInt(part?.pivot?.[0], -LIMITS.x, LIMITS.x), clampInt(part?.pivot?.[1], 0, LIMITS.yMax), clampInt(part?.pivot?.[2], -LIMITS.z, LIMITS.z)],
      motion: MOTIONS[part?.motion] ? part.motion : 'none',
      phase: Number.isFinite(Number(part?.phase)) ? Number(part.phase) : 0,
      glow: Array.isArray(part?.glow) ? part.glow.map(String) : [],
      boxes: [],
    };
    for (const b of Array.isArray(part?.boxes) ? part.boxes : []) {
      if (!Array.isArray(b) || b.length < 7 || !palette[String(b[6])]) continue;
      const box = [
        clampInt(b[0], -LIMITS.x, LIMITS.x), clampInt(b[1], 0, LIMITS.yMax), clampInt(b[2], -LIMITS.z, LIMITS.z),
        clampInt(b[3], -LIMITS.x, LIMITS.x), clampInt(b[4], 0, LIMITS.yMax), clampInt(b[5], -LIMITS.z, LIMITS.z), String(b[6]),
      ];
      const volume = (Math.abs(box[3] - box[0]) + 1) * (Math.abs(box[4] - box[1]) + 1) * (Math.abs(box[5] - box[2]) + 1);
      if (boxes >= LIMITS.boxes || cells + volume > LIMITS.cells) break;
      boxes += 1; cells += volume;
      xs = Math.max(xs, Math.abs(box[0]), Math.abs(box[3]), Math.abs(box[2]), Math.abs(box[5]));
      clean.boxes.push(box);
    }
    if (clean.boxes.length) parts.push(clean);
  }
  if (!parts.length) return null;
  return { palette, parts, footprint: xs + 2 };
}

const recipes = new Map(); // monster id -> recipe, for generated monsters
export const registerRecipe = (id, recipe) => recipes.set(id, recipe);

// Builds the figure for an enemy type (see data/monsters.js).
export function buildMonsterFigure(model) {
  if (MONSTER_LOOKS[model]) return MONSTER_LOOKS[model]();
  const recipe = recipes.get(model);
  return recipe ? buildRecipeFigure(recipe) : null;
}

// Voxel character figures: tall, slender and low in detail, in soft light.
// A figure is made of parts (legs, body, head, arms, …), each a little voxel
// mesh with its own pivot, so the parts can move for the idle animation.
// Units are voxels; a figure stands on y = 0 and faces +z. Every hero shares
// the same build: legs y 0–10, waist at 11, shoulders at 16, head from 17.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import { hash } from '../city/vox.js';

const solidMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
const glowMat = new THREE.MeshBasicMaterial({ toneMapped: false });

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

// An arm hanging from the shoulder at x = ±2: sleeve, cuff/bracer, hand.
function arm(side, { sleeve, sleeveShade, cuff, cuffLine = cuff, skin }) {
  const x = side * 2;
  const a = new Part([x, 15, 0]);
  a.box(x, 13, 0, x, 15, 0, sleeve);
  a.set(x, 13, -1, sleeveShade ?? sleeve);
  a.set(x, 12, 0, cuff).set(x, 11, 0, cuffLine);
  a.set(x, 10, 0, skin);
  return a;
}

// A bow and quiver worn across the back. `tips` are the arrowheads' colours.
function bowAndQuiver({ wood, string, quiver, fletch, tips, glow = false }) {
  const p = new Part([0, 13, -3]);
  for (let y = 7; y <= 19; y++) {
    const bend = Math.round(Math.sin((Math.PI * (y - 7)) / 12) * 1.4);
    p.set(1 - bend, y, -3, wood);
    if (bend > 0) p.set(1, y, -3, string);
  }
  p.box(-1, 10, -3, -1, 15, -3, quiver);
  p.set(-1, 16, -3, fletch).set(-1, 17, -3, fletch);
  tips.forEach((c, i) => p.set(-1, 18, -3 - i, c, glow));
  return p;
}

// Assembles parts into a figure with a shared idle animation: breathing, a slow
// look around, arms and cloak swaying. `extras` animate themselves.
function assemble({ legs, body, cloak, head, arms, hip, back, extras = [] }) {
  const root = new THREE.Group();
  const meshes = {};
  root.add((meshes.legs = legs.build()));
  root.add((meshes.body = body.build()));
  if (cloak) root.add((meshes.cloak = cloak.build()));
  root.add((meshes.head = head.build()));
  const armMeshes = arms.map((a) => { const m = a.build(); root.add(m); return m; });
  if (hip) root.add((meshes.hip = hip.mesh ?? hip.build()));
  if (back) root.add((meshes.back = back.build()));
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
    if (meshes.hip) meshes.hip.position.y = rest.hip + breathe * 0.4;
    meshes.head.rotation.y = Math.sin(t * 0.45) * 0.3;
    meshes.head.rotation.x = Math.sin(t * 0.3 + 1) * 0.05;
    armMeshes.forEach((a, i) => {
      a.position.y = armRest + breathe;
      a.rotation.x = Math.sin(t * 1.1 + i * 1.7) * 0.06;
      a.rotation.z = (i ? 1 : -1) * (0.04 + Math.sin(t * 1.8) * 0.015);
    });
    for (const e of extras) e.update(t);
  }
  return { group: root, update };
}

// --- Rikart Hagenstorm --------------------------------------------------------------
// A swordsman from the northern isles, trained in Hrimnir: copper hair in a
// topknot, a white headband, a steel-blue jacket and indigo hakama, a fur mantle
// and a short northern cloak, and a katana whose scabbard carries glowing runes.
function buildRikart() {
  const C = {
    skin: '#e7b28c', hair: '#b8582c', hairDark: '#8e3f1e', band: '#f1ece2',
    gi: '#7f90ab', giShade: '#6b7b95', collar: '#efeae0', obi: '#a8432f',
    hakama: '#2f3550', pleat: '#252a42', fur: '#ece6da', furShade: '#cfc6b6',
    cloak: '#3d4b7a', cloakLining: '#d9c08a', wrap: '#efe8d8', wrapLine: '#c9b896', sandal: '#5a3d2a',
    saya: '#1e1b24', tsuba: '#d2a53c', tsuka: '#2b3150', tsukaDiamond: '#e8e1d0', rune: '#8fe3ff',
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

  const body = new Part([0, 11, 0]);
  body.box(-1, 11, -1, 1, 11, 1, C.obi);
  body.set(1, 11, 2, C.obi).set(1, 10, 2, C.obi);
  body.box(-1, 12, -1, 1, 15, 1, (x, y, z) => (z === -1 ? C.giShade : C.gi));
  body.set(0, 15, 1, C.collar).set(1, 15, 1, C.collar).set(0, 14, 1, C.collar);
  body.box(-2, 16, -1, 2, 16, 1, speckle(C.fur, C.furShade));

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

  const arms = [-1, 1].map((s) => arm(s, { sleeve: C.gi, sleeveShade: C.giShade, cuff: C.wrap, cuffLine: C.wrapLine, skin: C.skin }));

  // Katana through the obi on his left hip: hilt forward and up, scabbard back and down.
  const katana = new Part([3, 11, 0]);
  for (let z = 2; z <= 5; z++) katana.set(3, 11, z, z % 2 ? C.tsuka : C.tsukaDiamond);
  katana.set(3, 11, 1, C.tsuba).set(3, 12, 1, C.tsuba).set(3, 10, 1, C.tsuba);
  for (let z = 0; z >= -10; z--) {
    const rune = z === -3 || z === -6 || z === -9;
    katana.set(3, 11, z, rune ? C.rune : C.saya, rune);
  }
  const hip = katana.build();
  hip.rotation.x = -0.42;

  return { ...assemble({ legs, body, cloak, head, arms, hip: { mesh: hip } }), stage: 6, zoom: 1 };
}

// --- Flame Slinger --------------------------------------------------------------------
// An elf from the islands of the far south-west: flame-red hair in a ponytail,
// long ears, a leaf-green tunic with a bandolier of throwing knives, a red cape,
// a bow and a quiver of burning arrows, and the longsword Bane of Fredrikstad.
function buildFlameSlinger() {
  const C = {
    skin: '#c98e62', hair: '#de5a28', hairDark: '#a8401f',
    tunic: '#4f7a3e', tunicShade: '#40652f', sash: '#7a4a2a', knife: '#d4dadf',
    belt: '#5e3d27', buckle: '#e0b44a', trousers: '#4a3b2e', boots: '#3a2a20', bracer: '#7a5132',
    cape: '#b8402f', capeLining: '#e8b04a',
    wood: '#8a5a34', string: '#efe8d8', quiver: '#6b4a2e', fletch: '#f1ece2',
    flame: '#ffb347', flameHot: '#ff6a2b',
    steel: '#c9ccd2', grip: '#3a2a20', gem: '#ff5a3c', scabbard: '#4a2f22',
  };

  const legs = new Part();
  for (const x of [-1, 1]) {
    legs.set(x, 0, 0, C.boots).set(x, 0, 1, C.boots);
    for (let y = 1; y <= 3; y++) legs.set(x, y, 0, C.boots);
    for (let y = 4; y <= 10; y++) legs.set(x, y, 0, C.trousers);
  }
  legs.box(-1, 9, 0, 1, 10, 0, C.trousers);
  legs.set(-1, 10, 1, C.belt).set(-1, 9, 1, C.belt); // belt pouch

  const body = new Part([0, 11, 0]);
  body.box(-1, 11, -1, 1, 11, 1, C.belt).set(0, 11, 1, C.buckle);
  body.box(-1, 12, -1, 1, 15, 1, (x, y, z) => (z === -1 ? C.tunicShade : C.tunic));
  // Bandolier of throwing knives across the chest.
  body.set(1, 15, 1, C.sash).set(0, 14, 1, C.knife).set(-1, 13, 1, C.sash).set(-1, 12, 1, C.knife);
  body.box(-2, 16, -1, 2, 16, 1, C.cape); // the cape gathered at the shoulders

  const cloak = new Part([0, 16, -2]);
  for (let y = 9; y <= 15; y++) for (let x = -1; x <= 1; x++) cloak.set(x, y, -2, y === 9 ? C.capeLining : C.cape);

  const head = new Part([0, 17, 0]);
  head.box(-1, 17, -1, 1, 20, 1, C.skin);
  head.box(-1, 17, -1, 1, 20, -1, C.hair);
  head.box(-1, 21, -1, 1, 21, 1, C.hair);
  head.set(-1, 20, 1, C.hair).set(1, 20, 1, C.hair).set(-1, 20, 0, C.hairDark).set(1, 20, 0, C.hairDark);
  // Long elf ears pointing up and back.
  for (const x of [-2, 2]) head.set(x, 18, 0, C.skin).set(x, 19, 0, C.skin).set(x, 20, -1, C.skin);
  // Ponytail.
  head.set(0, 20, -2, C.hairDark).set(0, 19, -2, C.hair).set(0, 18, -2, C.hair).set(0, 17, -2, C.hair).set(0, 16, -3, C.hairDark);

  const arms = [-1, 1].map((s) => arm(s, { sleeve: C.tunic, sleeveShade: C.tunicShade, cuff: C.bracer, skin: C.skin }));

  const back = bowAndQuiver({ wood: C.wood, string: C.string, quiver: C.quiver, fletch: C.fletch, tips: [C.flameHot, C.flame], glow: true });

  // Bane of Fredrikstad on the left hip: a straight longsword with a red gem.
  const sword = new Part([3, 11, 0]);
  sword.set(3, 11, 5, C.gem, true);
  for (let z = 2; z <= 4; z++) sword.set(3, 11, z, C.grip);
  sword.set(3, 12, 1, C.steel).set(3, 11, 1, C.steel).set(3, 10, 1, C.steel);
  for (let z = 0; z >= -9; z--) sword.set(3, 11, z, z === -9 ? C.steel : C.scabbard);
  const hip = sword.build();
  hip.rotation.x = -0.5;

  return { ...assemble({ legs, body, cloak, head, arms, hip: { mesh: hip }, back }), stage: 6, zoom: 1 };
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
// dark beard, leather and fur, a longbow and a hand axe, and Varg at his side.
function buildEdbart() {
  const C = {
    skin: '#e2a982', beard: '#5a3a24', beardDark: '#43291a',
    pelt: '#9aa3ad', peltLight: '#d7dce0', peltDark: '#6f7882', snout: '#2f2b2c',
    leather: '#7a5236', leatherDark: '#5e3d27', shirt: '#4d5b4a',
    trousers: '#5b4636', boots: '#3d2c22', belt: '#3d2c22', buckle: '#b9bec4',
    wood: '#7a5132', string: '#efe8d8', quiver: '#5e3d27', fletch: '#d7dce0', tip: '#b9bec4',
    axeHead: '#c9ced4', axeHandle: '#6b4a2e',
  };

  const legs = new Part();
  for (const x of [-1, 1]) {
    legs.set(x, 0, 0, C.boots).set(x, 0, 1, C.boots).set(x, 1, 0, C.boots).set(x, 2, 0, C.boots);
    legs.set(x, 3, 0, C.peltLight); // fur cuff
    for (let y = 4; y <= 10; y++) legs.set(x, y, 0, C.trousers);
  }
  legs.box(-1, 9, 0, 1, 10, 0, C.trousers);

  const body = new Part([0, 11, 0]);
  body.box(-1, 11, -1, 1, 11, 1, C.belt).set(0, 11, 1, C.buckle);
  body.box(-1, 12, -1, 1, 15, 1, (x, y, z) => (z === 1 && x === 0 ? C.leatherDark : C.leather));
  body.set(0, 15, 1, C.shirt);
  body.box(-2, 16, -1, 2, 16, 1, speckle(C.pelt, C.peltLight));
  body.set(-2, 15, -1, C.pelt).set(2, 15, -1, C.pelt);

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
  head.box(-1, 21, 2, 1, 21, 2, C.peltDark).set(0, 21, 3, C.snout); // the wolf's brow and nose
  head.set(-1, 22, -1, C.peltDark).set(1, 22, -1, C.peltDark);

  const arms = [-1, 1].map((s) => arm(s, { sleeve: C.shirt, cuff: C.leather, cuffLine: C.leatherDark, skin: C.skin }));

  const back = bowAndQuiver({ wood: C.wood, string: C.string, quiver: C.quiver, fletch: C.fletch, tips: [C.tip, C.tip] });

  // Hand axe on the right hip.
  const axe = new Part([-3, 11, 0]);
  for (let y = 8; y <= 12; y++) axe.set(-3, y, 1, C.axeHandle);
  axe.set(-3, 12, 2, C.axeHead).set(-3, 11, 2, C.axeHead).set(-3, 12, 3, C.axeHead).set(-3, 11, 3, C.axeHead).set(-3, 10, 3, C.axeHead);

  const figure = assemble({ legs, body, cloak, head, arms, hip: axe, back, extras: [buildVarg(5, -3)] });
  figure.group.position.x = -2.5; // keep the pair centred on the stage
  return { ...figure, stage: 9, zoom: 1.2 };
}

export const MODELS = { rikart: buildRikart, 'flame-slinger': buildFlameSlinger, edbart: buildEdbart };

// Voxel character figures: tall, slender and low in detail, in soft light.
// A figure is made of parts (legs, body, head, arms, …), each a little voxel
// mesh with its own pivot, so the parts can move for the idle animation.
// Units are voxels; the figure stands on y = 0 and faces +z.
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
  // Inclusive box.
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

// --- Rikart Hagenstorm --------------------------------------------------------------
// A swordsman from the northern isles, trained in Hrimnir: copper hair in a
// topknot, a white headband, a steel-blue jacket and indigo hakama, a fur mantle
// and a short northern cloak, and a katana whose scabbard carries glowing runes.
const C = {
  skin: '#e7b28c', skinShade: '#d39c78',
  hair: '#b8582c', hairDark: '#8e3f1e',
  band: '#f1ece2',
  gi: '#7f90ab', giShade: '#6b7b95', collar: '#efeae0',
  obi: '#a8432f',
  hakama: '#2f3550', pleat: '#252a42',
  fur: '#ece6da', furShade: '#cfc6b6',
  cloak: '#3d4b7a', cloakLining: '#d9c08a',
  wrap: '#efe8d8', wrapLine: '#c9b896',
  sandal: '#5a3d2a',
  saya: '#1e1b24', tsuba: '#d2a53c', tsuka: '#2b3150', tsukaDiamond: '#e8e1d0',
  rune: '#8fe3ff',
};

export function buildRikart() {
  const root = new THREE.Group();

  // Legs: long and thin, wrapped shins, sandals; slim indigo hakama trousers.
  const legs = new Part();
  for (const x of [-1, 1]) {
    legs.set(x, 0, 0, C.sandal).set(x, 0, 1, C.sandal);
    legs.set(x, 1, 0, C.wrap).set(x, 2, 0, C.wrapLine).set(x, 3, 0, C.wrap);
    for (let y = 4; y <= 10; y++) legs.set(x, y, 0, y <= 5 ? C.pleat : C.hakama);
    legs.set(x, 4, -1, C.pleat).set(x, 5, -1, C.hakama); // the wide hem flares backwards
  }
  // The pleated front and back panels of the hakama.
  for (let y = 7; y <= 10; y++) for (const z of [1, -1]) for (let x = -1; x <= 1; x++) {
    legs.set(x, y, z, x === 0 ? C.pleat : C.hakama);
  }
  legs.set(0, 10, 0, C.hakama).set(0, 9, 0, C.hakama);
  root.add(legs.build());

  // Body: narrow gi with an obi and a fur collar. It breathes, so it pivots at the waist.
  const body = new Part([0, 11, 0]);
  body.box(-1, 11, -1, 1, 11, 1, C.obi);
  body.set(1, 11, 2, C.obi).set(1, 10, 2, C.obi); // obi knot
  body.box(-1, 12, -1, 1, 15, 1, (x, y, z) => (z === -1 ? C.giShade : C.gi));
  // The white undershirt shows where the jacket crosses over.
  body.set(0, 15, 1, C.collar).set(1, 15, 1, C.collar).set(0, 14, 1, C.collar);
  // Fur mantle over the shoulders.
  body.box(-2, 16, -1, 2, 16, 1, (x, y, z) => (hash(x, y, z) > 0.6 ? C.furShade : C.fur));
  root.add(body.build());

  // Cloak: hangs from the shoulders down the back, and sways a little.
  const cloak = new Part([0, 16, -2]);
  for (let y = 7; y <= 15; y++) for (let x = -1; x <= 1; x++) cloak.set(x, y, -2, y === 7 ? C.cloakLining : C.cloak);
  root.add(cloak.build());

  // Head: pivots at the neck so it can look around. No face, just a beard,
  // a headband and a copper topknot.
  const head = new Part([0, 17, 0]);
  head.box(-1, 17, -1, 1, 20, 1, C.skin);
  head.set(-1, 17, 1, C.hair).set(0, 17, 1, C.hair).set(1, 17, 1, C.hair).set(0, 16, 1, C.hairDark);
  head.set(-1, 17, 0, C.hairDark).set(1, 17, 0, C.hairDark).set(-1, 18, 0, C.hairDark).set(1, 18, 0, C.hairDark);
  head.box(-1, 17, -1, 1, 20, -1, C.hair);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
    if (Math.abs(x) === 1 || Math.abs(z) === 1) head.set(x, 20, z, C.band);
  }
  head.set(0, 20, -2, C.band).set(0, 19, -2, C.band).set(1, 18, -2, C.band);
  head.box(-1, 21, -1, 1, 21, 1, C.hair);
  head.set(0, 22, 0, C.hairDark).set(0, 23, 0, C.hair).set(0, 23, -1, C.hair);
  root.add(head.build());

  // Arms: thin, with gi sleeves and wrapped forearms; they swing from the shoulder.
  const arms = [-1, 1].map((side) => {
    const x = side * 2;
    const arm = new Part([x, 15, 0]);
    arm.box(x, 13, 0, x, 15, 0, C.gi);
    arm.set(x, 13, -1, C.giShade); // hanging sleeve
    arm.set(x, 12, 0, C.wrap).set(x, 11, 0, C.wrapLine);
    arm.set(x, 10, 0, C.skin);
    const mesh = arm.build();
    root.add(mesh);
    return mesh;
  });

  // Katana through the obi on his left hip: hilt forward and up, scabbard back and down.
  const katana = new Part([3, 11, 0]);
  for (let z = 2; z <= 5; z++) katana.set(3, 11, z, z % 2 ? C.tsuka : C.tsukaDiamond);
  katana.set(3, 11, 1, C.tsuba).set(3, 12, 1, C.tsuba).set(3, 10, 1, C.tsuba);
  for (let z = 0; z >= -10; z--) {
    const rune = z === -3 || z === -6 || z === -9;
    katana.set(3, 11, z, rune ? C.rune : C.saya, rune);
  }
  const katanaMesh = katana.build();
  katanaMesh.rotation.x = -0.42; // hilt up at the front
  root.add(katanaMesh);

  const [, bodyMesh, cloakMesh, headMesh] = root.children;
  const rest = { body: bodyMesh.position.y, head: headMesh.position.y, cloak: cloakMesh.position.y, arm: arms[0].position.y, katana: katanaMesh.position.y };

  // Idle: breathing, a slow look around, arms and cloak swaying.
  function update(t) {
    const breathe = Math.sin(t * 1.8) * 0.1;
    bodyMesh.position.y = rest.body + breathe;
    headMesh.position.y = rest.head + breathe * 1.2;
    cloakMesh.position.y = rest.cloak + breathe;
    katanaMesh.position.y = rest.katana + breathe * 0.4;
    headMesh.rotation.y = Math.sin(t * 0.45) * 0.3;
    headMesh.rotation.x = Math.sin(t * 0.3 + 1) * 0.05;
    arms.forEach((a, i) => {
      a.position.y = rest.arm + breathe;
      a.rotation.x = Math.sin(t * 1.1 + i * 1.7) * 0.06;
      a.rotation.z = (i ? 1 : -1) * (0.04 + Math.sin(t * 1.8) * 0.015);
    });
    cloakMesh.rotation.x = -0.05 - Math.sin(t * 0.9) * 0.04;
  }

  return { group: root, update, height: 24 };
}

export const MODELS = { rikart: buildRikart };

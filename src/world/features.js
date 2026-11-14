// Extra things on the world map that are not towns: the lighthouse on its rock in Siri's Gap,
// and the shadowy mist that lies over Sortland. Sizes are in world units (one map cell = 1).
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import { hash } from '../city/vox.js';

const solid = (colour) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85 });
function block(g, [w, h, d], [x, y, z], mat) {
  const geo = bevelBox(w, h, d, Math.min(w, h, d) * 0.12).clone();
  geo.translate(0, h / 2, 0); // y is the block's base
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}

// A little lighthouse on a rock in the water: a red-and-white tower, a lit lamp, a keeper's hut.
// Stands on y = 0 at the water's surface. `update(dt)` turns the beam.
export function buildLighthouse() {
  const g = new THREE.Group();
  const rock = solid('#6f6a66'), rockDark = solid('#57524f'), white = solid('#f1ece2'), red = solid('#b8433a');
  const roof = solid('#2f2a2e'), hut = solid('#d8cbb4'), hutRoof = solid('#8a4a36');
  // The rock, a few stones stepping up out of the sea.
  block(g, [2.2, 0.7, 1.9], [0, -0.6, 0], rockDark);
  block(g, [1.7, 0.4, 1.5], [0.1, 0.05, -0.05], rock);
  block(g, [0.7, 0.3, 0.6], [-0.9, -0.3, 0.6], rock);
  block(g, [0.5, 0.35, 0.5], [0.95, -0.25, -0.65], rockDark);
  // The tower: stripes narrowing upwards.
  let y = 0.45, w = 0.62;
  for (let i = 0; i < 5; i++) {
    block(g, [w, 0.34, w], [0.15, y, 0], i % 2 ? red : white);
    y += 0.34; w -= 0.05;
  }
  block(g, [0.6, 0.07, 0.6], [0.15, y, 0], roof); // the gallery
  const lamp = new THREE.Mesh(bevelBox(0.3, 0.28, 0.3, 0.04).clone().translate(0, 0.14, 0), new THREE.MeshBasicMaterial({ color: '#ffd98a', toneMapped: false }));
  lamp.position.set(0.15, y + 0.07, 0);
  g.add(lamp);
  block(g, [0.38, 0.12, 0.38], [0.15, y + 0.35, 0], roof);
  block(g, [0.18, 0.12, 0.18], [0.15, y + 0.47, 0], roof);
  // The keeper's hut.
  block(g, [0.55, 0.32, 0.45], [-0.55, 0.45, 0.25], hut);
  block(g, [0.62, 0.1, 0.52], [-0.55, 0.77, 0.25], hutRoof);
  // A soft beam of light that sweeps round.
  const beamGeo = new THREE.ConeGeometry(0.55, 4.5, 12, 1, true);
  beamGeo.rotateZ(Math.PI / 2);
  beamGeo.translate(2.25, 0, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const pivot = new THREE.Group();
  pivot.position.set(0.15, y + 0.21, 0);
  pivot.add(beam);
  g.add(pivot);
  g.userData.update = (dt) => { pivot.rotation.y += dt * 0.9; };
  return g;
}

// An old, weathered log cabin with a mossy roof, a stone chimney and one dimly lit window.
export function buildCabin() {
  const g = new THREE.Group();
  const log = solid('#8a7058'), logDark = solid('#76604c'), moss = solid('#7a8462'), mossDark = solid('#687254'), stone = solid('#8f8a82'), door = solid('#3a2f27');
  for (let i = 0; i < 4; i++) block(g, [1.1, 0.13, 0.85], [0, i * 0.13, 0], i % 2 ? logDark : log);
  block(g, [1.24, 0.08, 0.98], [0, 0.52, 0], mossDark);
  block(g, [1.16, 0.12, 0.72], [0, 0.6, 0], moss);
  block(g, [1.08, 0.12, 0.42], [0.02, 0.72, 0], mossDark);
  block(g, [1.0, 0.08, 0.14], [0.03, 0.84, 0], moss);
  block(g, [0.2, 0.62, 0.2], [0.38, 0.3, -0.22], stone); // chimney
  block(g, [0.24, 0.32, 0.04], [-0.15, 0, 0.43], door);
  const win = new THREE.Mesh(bevelBox(0.18, 0.14, 0.04, 0.01).clone().translate(0, 0.07, 0), new THREE.MeshBasicMaterial({ color: '#f0b45a', toneMapped: false }));
  win.position.set(0.25, 0.22, 0.43);
  g.add(win);
  block(g, [0.12, 0.25, 0.12], [-0.68, 0, 0.3], logDark); // a woodpile
  block(g, [0.3, 0.12, 0.14], [-0.66, 0, 0.12], log);
  return g;
}

// A little wooden bridge with stone ends, along z, `length` long. y = 0 is the deck.
export function buildBridge(length = 3.4) {
  const g = new THREE.Group();
  const plank = solid('#8a6440'), plankDark = solid('#7a5636'), rail = solid('#5b4a3a'), stone = solid('#9a948a');
  const n = Math.round(length / 0.22);
  for (let i = 0; i < n; i++) {
    const z = -length / 2 + (i + 0.5) * (length / n);
    const lift = Math.cos((z / length) * Math.PI) * 0.18; // a gentle arch
    block(g, [0.62, 0.07, length / n * 0.92], [0, lift - 0.07, z], i % 2 ? plank : plankDark);
    if (i % 3 === 0) for (const x of [-0.3, 0.3]) block(g, [0.06, 0.28, 0.06], [x, lift, z], rail);
  }
  for (const x of [-0.3, 0.3]) for (let i = 0; i < 3; i++) {
    const z0 = -length / 2 + (i + 0.5) * (length / 3);
    block(g, [0.05, 0.05, length / 3], [x, 0.24 + Math.cos((z0 / length) * Math.PI) * 0.18, z0], rail);
  }
  for (const z of [-length / 2, length / 2]) block(g, [0.8, 0.5, 0.45], [0, -0.55, z], stone);
  return g;
}

// A shadowy mist lying low over a land: dark, slow-drifting voxel puffs within `radius`.
// Stands on y = 0 at the ground. `update(dt)` lets it drift and breathe. `grey` makes a pale
// grey fog instead (Sirivik).
export function buildShadowMist(radius = 9, { grey = false } = {}) {
  const g = new THREE.Group();
  const k = radius / 9;
  const layers = grey ? [
    { colour: '#8a8a92', opacity: 0.24, n: Math.round(22 * k), y: [0.6, 1.8], s: [1.8, 3.0] },
    { colour: '#a2a2aa', opacity: 0.16, n: Math.round(16 * k), y: [1.8, 3.2], s: [2.2, 3.6] },
  ] : [
    { colour: '#4a4458', opacity: 0.22, n: 26, y: [0.8, 2.0], s: [2.0, 3.2] },
    { colour: '#5a5468', opacity: 0.16, n: 20, y: [2.2, 3.6], s: [2.4, 4.0] },
  ];
  const meshes = [];
  layers.forEach((L, li) => {
    const mat = new THREE.MeshStandardMaterial({ color: L.colour, roughness: 1, transparent: true, opacity: L.opacity, depthWrite: false });
    const mesh = new THREE.InstancedMesh(bevelBox(1, 1, 1, 0.3), mat, L.n);
    mesh.frustumCulled = false;
    const puffs = [];
    for (let i = 0; i < L.n; i++) {
      const a = hash(i, li, 31) * Math.PI * 2, r = Math.sqrt(hash(i, li, 32)) * radius;
      const s = L.s[0] + hash(i, li, 33) * (L.s[1] - L.s[0]);
      puffs.push({
        x: Math.cos(a) * r, z: Math.sin(a) * r, y: L.y[0] + hash(i, li, 34) * (L.y[1] - L.y[0]),
        sx: s * 1.4, sy: s * 0.45, sz: s, phase: hash(i, li, 35) * 6.28, speed: 0.15 + hash(i, li, 36) * 0.2,
      });
    }
    meshes.push({ mesh, puffs });
    g.add(mesh);
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let t = 0;
  function update(dt) {
    t += dt;
    for (const { mesh, puffs } of meshes) {
      puffs.forEach((p, i) => {
        const drift = t * p.speed + p.phase;
        pos.set(p.x + Math.sin(drift) * 1.2, p.y + Math.sin(drift * 0.7) * 0.25, p.z + Math.cos(drift * 0.8) * 1.2);
        const breathe = 1 + Math.sin(drift * 1.3) * 0.12;
        scl.set(p.sx * breathe, p.sy, p.sz * breathe);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.phase + t * 0.03);
        mesh.setMatrixAt(i, m.compose(pos, q, scl));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  update(0);
  g.userData.update = update;
  return g;
}

// A volcano's crater: a faint glow, and now and then a few tiny orange sparks drifting up, as if
// there were lava somewhere below. Stands at the crater floor (y = 0). `update(dt)` animates.
export function buildVolcanoSparks({ crater = 2 } = {}) {
  const g = new THREE.Group();
  const glow = new THREE.PointLight('#ff7a2e', 1.2, 8, 1.6);
  glow.position.y = 1.2;
  g.add(glow);
  const N = 14;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#ff9a4a', toneMapped: false, transparent: true, opacity: 0.85 }), N);
  mesh.frustumCulled = false;
  g.add(mesh);
  const sparks = Array.from({ length: N }, (_, i) => ({ phase: hash(i, 4, 71), x: (hash(i, 5, 71) - 0.5) * crater, z: (hash(i, 6, 71) - 0.5) * crater, drift: (hash(i, 7, 71) - 0.5) * 1.5, period: 3 + hash(i, 8, 71) * 3 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let t = 0;
  function update(dt) {
    t += dt;
    sparks.forEach((s, i) => {
      const a = (t / s.period + s.phase) % 1;
      pos.set(s.x + a * s.drift, 0.5 + a * 5, s.z + a * s.drift * 0.5);
      scl.setScalar(a < 0.8 ? 1 - a * 0.6 : (1 - a) * 2.6); // shrink away as they cool
      mesh.setMatrixAt(i, m.compose(pos, q, scl));
    });
    mesh.instanceMatrix.needsUpdate = true;
    glow.intensity = 1 + Math.sin(t * 3.1) * 0.25;
  }
  update(0);
  g.userData.update = update;
  return g;
}

// A thick ring of cloud wrapped round a summit, so its top is lost in the clouds.
// y = 0 is the middle of the cloud band. `update(dt)` lets it drift round slowly.
export function buildCloudCap(radius = 7, band = 6, { opacity = 1 } = {}) {
  const g = new THREE.Group();
  const layers = [
    { colour: '#f4f7fa', opacity: 0.75, n: 34, r: [0, radius], y: [-band * 0.15, band * 0.5], s: [3.0, 5.0] },
    { colour: '#e2e8ee', opacity: 0.55, n: 30, r: [radius * 0.4, radius * 1.3], y: [-band * 0.5, band * 0.2], s: [2.6, 4.4] },
  ];
  const meshes = [];
  layers.forEach((L, li) => {
    const mesh = new THREE.InstancedMesh(bevelBox(1, 1, 1, 0.3), new THREE.MeshStandardMaterial({ color: L.colour, roughness: 1, transparent: true, opacity: L.opacity * opacity, depthWrite: false }), L.n);
    mesh.frustumCulled = false;
    const puffs = [];
    for (let i = 0; i < L.n; i++) {
      const s = L.s[0] + hash(i, li, 52) * (L.s[1] - L.s[0]);
      puffs.push({ a: hash(i, li, 50) * Math.PI * 2, r: L.r[0] + Math.sqrt(hash(i, li, 51)) * (L.r[1] - L.r[0]), y: L.y[0] + hash(i, li, 53) * (L.y[1] - L.y[0]), sx: s * 1.5, sy: s * 0.6, sz: s, speed: 0.02 + hash(i, li, 54) * 0.03 });
    }
    meshes.push({ mesh, puffs });
    g.add(mesh);
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let t = 0;
  function update(dt) {
    t += dt;
    for (const { mesh, puffs } of meshes) {
      puffs.forEach((p, i) => {
        const a = p.a + t * p.speed;
        pos.set(Math.cos(a) * p.r, p.y + Math.sin(t * 0.3 + p.a) * 0.3, Math.sin(a) * p.r);
        scl.set(p.sx, p.sy, p.sz);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, a);
        mesh.setMatrixAt(i, m.compose(pos, q, scl));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  update(0);
  g.userData.update = update;
  return g;
}

// A soft haze hanging round the mountain tops: pale puffs at `spots` ([x, y, z] in world units),
// drifting a little. `update(dt)` animates.
export function buildMountainMist(spots) {
  const mesh = new THREE.InstancedMesh(bevelBox(1, 1, 1, 0.3), new THREE.MeshStandardMaterial({ color: '#eef1f4', roughness: 1, transparent: true, opacity: 0.28, depthWrite: false }), spots.length);
  mesh.frustumCulled = false;
  const puffs = spots.map(([x, y, z], i) => {
    const s = 2.4 + hash(i, 3, 61) * 2.6;
    return { x, y, z, sx: s * 1.6, sy: s * 0.5, sz: s * 1.2, phase: hash(i, 3, 62) * 6.28, speed: 0.1 + hash(i, 3, 63) * 0.15 };
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let t = 0;
  function update(dt) {
    t += dt;
    puffs.forEach((p, i) => {
      const a = t * p.speed + p.phase;
      pos.set(p.x + Math.sin(a) * 1.5, p.y + Math.sin(a * 0.6) * 0.3, p.z + Math.cos(a * 0.8) * 1.5);
      scl.set(p.sx, p.sy, p.sz);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.phase + t * 0.02);
      mesh.setMatrixAt(i, m.compose(pos, q, scl));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.update = update;
  return g;
}

// A big mine dug into a mountainside: a timbered tunnel mouth, a wooden headframe with its wheel,
// spoil heaps, a little rail track with an ore cart, a shed and lanterns. Faces +z (the way out).
export function buildMine() {
  const g = new THREE.Group();
  const timber = solid('#6b4a2e'), timberDark = solid('#4e3520'), rock = solid('#7a726a'), spoil = solid('#8a8276'), spoilDark = solid('#6e675e');
  const rail = solid('#4a4a50'), cart = solid('#5a5a62'), ore = solid('#3a3632'), shed = solid('#9a7a54'), roof = solid('#5a4a3e');
  const black = new THREE.MeshBasicMaterial({ color: '#0e0b0a' });
  // The tunnel mouth in a heap of rock.
  block(g, [2.2, 1.3, 1.2], [0, 0, -0.9], rock);
  const hole = new THREE.Mesh(bevelBox(0.8, 0.85, 0.1, 0.02).clone().translate(0, 0.43, 0), black);
  hole.position.set(0, 0, -0.28);
  g.add(hole);
  block(g, [0.12, 0.95, 0.12], [-0.48, 0, -0.25], timber); block(g, [0.12, 0.95, 0.12], [0.48, 0, -0.25], timber);
  block(g, [1.15, 0.13, 0.16], [0, 0.95, -0.25], timberDark);
  // The headframe tower with its wheel.
  for (const [x, z] of [[1.3, -0.5], [1.9, -0.5], [1.3, 0.1], [1.9, 0.1]]) block(g, [0.09, 1.9, 0.09], [x, 0, z], timber);
  block(g, [0.75, 0.09, 0.75], [1.6, 1.9, -0.2], timberDark);
  block(g, [0.75, 0.09, 0.09], [1.6, 1.0, -0.5], timberDark); block(g, [0.75, 0.09, 0.09], [1.6, 1.0, 0.1], timberDark);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), timberDark);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(1.6, 2.3, -0.2);
  g.add(wheel);
  // Spoil heaps.
  block(g, [1.0, 0.45, 0.9], [-1.6, 0, 0.1], spoil); block(g, [0.6, 0.3, 0.55], [-1.6, 0.45, 0.1], spoilDark);
  block(g, [0.7, 0.3, 0.6], [-1.2, 0, 0.9], spoilDark);
  // Rails out of the tunnel with an ore cart.
  for (const x of [-0.18, 0.18]) block(g, [0.04, 0.04, 1.8], [x, 0.02, 0.6], rail);
  for (let i = 0; i < 6; i++) block(g, [0.5, 0.04, 0.08], [0, 0, -0.15 + i * 0.3], timberDark);
  block(g, [0.42, 0.28, 0.5], [0, 0.08, 0.85], cart); block(g, [0.34, 0.08, 0.4], [0, 0.36, 0.85], ore);
  // A shed and lanterns.
  block(g, [0.8, 0.5, 0.6], [1.5, 0, 1.0], shed); block(g, [0.92, 0.1, 0.72], [1.5, 0.5, 1.0], roof); block(g, [0.6, 0.1, 0.5], [1.5, 0.6, 1.0], roof);
  const lamp = new THREE.MeshBasicMaterial({ color: '#ffcf70', toneMapped: false });
  for (const x of [-0.65, 0.65]) {
    block(g, [0.06, 0.7, 0.06], [x, 0, 0.1], timber);
    const l = new THREE.Mesh(bevelBox(0.12, 0.12, 0.12, 0.02).clone().translate(0, 0.06, 0), lamp);
    l.position.set(x, 0.7, 0.1);
    g.add(l);
  }
  g.userData.update = (dt) => { wheel.rotation.y += dt * 0.6; };
  return g;
}

// A camp of horse nomads (Mongolian-style felt tents): round white gers with domed roofs, a red
// roof ring and painted doors, a horse corral, a fire and a pole with blue streamers.
export function buildYurtCamp(n = 5) {
  const g = new THREE.Group();
  const felt = solid('#efe8d8'), feltShade = solid('#ddd4c0'), ring = solid('#b8462a'), doorRed = solid('#b8462a'), doorBlue = solid('#2f6aa8');
  const fence = solid('#7a5636'), blue = solid('#3f7fc8'), pole = solid('#5b4a3a'), stone = solid('#7a7068');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4, r = 1.3 + hash(i, 1, 101) * 0.3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8, s = 0.85 + hash(i, 2, 101) * 0.3;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.32 * s, 10), felt);
    wall.position.set(x, 0.16 * s, z);
    const dome = new THREE.Mesh(new THREE.ConeGeometry(0.46 * s, 0.26 * s, 10), feltShade);
    dome.position.set(x, 0.32 * s + 0.13 * s, z);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.1 * s, 0.06 * s, 8), ring);
    crown.position.set(x, 0.58 * s, z);
    for (const m of [wall, dome, crown]) { m.castShadow = m.receiveShadow = true; g.add(m); }
    // The door faces the middle of the camp.
    const door = block(g, [0.16 * s, 0.22 * s, 0.04], [x - Math.cos(a) * 0.42 * s, 0, z - Math.sin(a) * 0.42 * s * 0.8], i % 2 ? doorRed : doorBlue);
    door.rotation.y = -a + Math.PI / 2;
  }
  // The fire in the middle, a pole with streamers, and a corral to one side.
  for (let i = 0; i < 6; i++) block(g, [0.08, 0.06, 0.08], [Math.cos(i) * 0.18, 0, Math.sin(i) * 0.18], stone);
  const fire = new THREE.Mesh(bevelBox(0.12, 0.14, 0.12, 0.02).clone().translate(0, 0.07, 0), new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }));
  g.add(fire);
  block(g, [0.05, 1.2, 0.05], [0.4, 0, -0.3], pole);
  block(g, [0.04, 0.5, 0.18], [0.4, 0.7, -0.4], blue);
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = 2.9 + Math.cos(a) * 0.8, z = 0.4 + Math.sin(a) * 0.6;
    block(g, [0.05, 0.22, 0.05], [x, 0, z], fence);
  }
  return g;
}

// A desert nomads' camp: long low tents of dark, striped goat-hair cloth, rugs, a fire and a palm.
export function buildDesertCamp(n = 3) {
  const g = new THREE.Group();
  const cloth = [solid('#4a3428'), solid('#6a4a34'), solid('#3a2a22')], stripe = solid('#c9a26a'), pole = solid('#5b4a3a');
  const rugs = [solid('#9b2f2a'), solid('#2f4f7a'), solid('#c9902a')];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 1.4, z = (hash(i, 3, 102) - 0.5) * 1.2, rot = (hash(i, 4, 102) - 0.5) * 0.8;
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.rotation.y = rot;
    block(t, [1.1, 0.06, 0.8], [0, 0.32, 0], cloth[i % 3]); // the flat roof
    block(t, [1.1, 0.04, 0.06], [0, 0.36, 0], stripe);
    block(t, [1.1, 0.32, 0.05], [0, 0, -0.38], cloth[(i + 1) % 3]); // back wall
    for (const [px, pz] of [[-0.5, 0.36], [0.5, 0.36], [-0.5, -0.36], [0.5, -0.36], [0, 0.36]]) block(t, [0.04, 0.34, 0.04], [px, 0, pz], pole);
    block(t, [0.7, 0.02, 0.5], [0, 0, 0.05], rugs[i % 3]);
    g.add(t);
  }
  const fire = new THREE.Mesh(bevelBox(0.12, 0.14, 0.12, 0.02).clone().translate(0, 0.07, 0), new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }));
  fire.position.set(0, 0, 1.0);
  g.add(fire);
  const trunk = solid('#9b7348'), leaf = solid('#4fb35a');
  block(g, [0.12, 1.0, 0.12], [-2.0, 0, 0.6], trunk);
  for (const [dx, dz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) block(g, [Math.abs(dx) ? 0.5 : 0.12, 0.08, Math.abs(dz) ? 0.5 : 0.12], [-2.0 + dx * 0.6, 0.98, 0.6 + dz * 0.6], leaf);
  return g;
}

// Things round Sirivik, for the curious (world-map scale; y = 0 at the ground):
// gibbet cages hanging from posts at the cliff edge with crows on them, standing stones of black
// obsidian carved with glowing blue runes, a weathered statue with an arm and its face broken off,
// a little shrine with candles and an empty cradle, and the town's wooden lift down to the water.
export function buildGibbet() {
  const g = new THREE.Group();
  const wood = solid('#4a3a2e'), iron = solid('#3a3a40'), bone = solid('#d8cfbe'), crow = solid('#141216');
  block(g, [0.1, 1.3, 0.1], [0, 0, 0], wood);
  block(g, [0.55, 0.08, 0.08], [0.22, 1.25, 0], wood);
  for (const [x, z] of [[0.35, -0.1], [0.55, -0.1], [0.35, 0.1], [0.55, 0.1]]) block(g, [0.03, 0.42, 0.03], [x, 0.55, z], iron);
  block(g, [0.26, 0.04, 0.26], [0.45, 0.55, 0], iron); block(g, [0.26, 0.04, 0.26], [0.45, 0.97, 0], iron);
  block(g, [0.12, 0.2, 0.08], [0.45, 0.62, 0], bone);
  block(g, [0.08, 0.06, 0.05], [0.45, 1.01, 0.02], crow); block(g, [0.07, 0.05, 0.05], [0.02, 1.31, 0], crow);
  return g;
}
export function buildRuneStone(h = 0.8) {
  const g = new THREE.Group();
  block(g, [0.28, h, 0.18], [0, 0, 0], solid('#1e1a24'));
  const rune = new THREE.MeshBasicMaterial({ color: '#5ac8ff', toneMapped: false });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(bevelBox(0.12, 0.04, 0.02, 0.005).clone(), rune);
    m.position.set(0, 0.2 + i * (h - 0.3) / 2, 0.1);
    m.rotation.z = i % 2 ? 0.6 : -0.6;
    g.add(m);
  }
  return g;
}
export function buildBrokenStatue() {
  const g = new THREE.Group();
  const stone = solid('#8a857c'), plinth = solid('#6a655e');
  block(g, [0.42, 0.22, 0.42], [0, 0, 0], plinth);
  block(g, [0.12, 0.35, 0.12], [-0.06, 0.22, 0], stone); block(g, [0.12, 0.35, 0.12], [0.08, 0.22, 0], stone);
  block(g, [0.3, 0.38, 0.16], [0, 0.57, 0], stone);
  block(g, [0.08, 0.32, 0.08], [-0.19, 0.6, 0], stone); // one arm left, the other broken off at the shoulder
  block(g, [0.16, 0.12, 0.15], [0, 0.95, 0], stone); // the head, its face sheared away
  block(g, [0.08, 0.08, 0.08], [0.24, 0, 0.14], stone); // the broken arm lies at the foot
  return g;
}
export function buildShrine() {
  const g = new THREE.Group();
  const stone = solid('#5a5560'), wood = solid('#6b4a2e'), cloth = solid('#e8e0d0');
  block(g, [0.6, 0.26, 0.34], [0, 0, 0], stone);
  block(g, [0.32, 0.1, 0.18], [0, 0.26, 0], wood); // an empty cradle on the altar
  block(g, [0.04, 0.08, 0.18], [-0.15, 0.32, 0], wood); block(g, [0.04, 0.08, 0.18], [0.15, 0.32, 0], wood);
  block(g, [0.24, 0.02, 0.12], [0, 0.32, 0], cloth);
  const flame = new THREE.MeshBasicMaterial({ color: '#ffcf70', toneMapped: false });
  for (const x of [-0.25, 0.25]) {
    block(g, [0.04, 0.12, 0.04], [x, 0.26, 0.1], cloth);
    const f = new THREE.Mesh(bevelBox(0.04, 0.05, 0.04, 0.01).clone(), flame);
    f.position.set(x, 0.41, 0.1);
    g.add(f);
  }
  return g;
}
export function buildLift(drop = 2) {
  const g = new THREE.Group();
  const wood = solid('#5a4632'), rope = solid('#b8a07a');
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) block(g, [0.08, 1.2, 0.08], [x, 0, z], wood);
  block(g, [0.7, 0.08, 0.7], [0, 1.2, 0], wood);
  block(g, [0.08, 0.08, 0.5], [0, 1.28, 0], wood); // the winch
  block(g, [0.03, drop + 1.2, 0.03], [0, -drop, 0.42], rope);
  block(g, [0.6, 0.06, 0.4], [0, -drop + 0.2, 0.55], wood); // the platform down by the water
  return g;
}

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

// A shadowy mist lying low over a land: dark, slow-drifting voxel puffs within `radius`.
// Stands on y = 0 at the ground. `update(dt)` lets it drift and breathe.
export function buildShadowMist(radius = 9) {
  const g = new THREE.Group();
  const layers = [
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

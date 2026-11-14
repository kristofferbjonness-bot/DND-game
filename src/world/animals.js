// Animals on the world map: small voxel creatures that wander about where they belong. Horses
// and sheep on the grass, camels in the desert, goats up in the mountains, deer at the forest
// edge, seals on the ice island's shore, and whales in the open sea. They are small (about half
// a map cell), so they show when you zoom in. Each kind is drawn with one instanced mesh per
// body part; `update(dt, distance)` moves them, and hides them when the camera is far away.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import { grid, BIOME, distToSea, cellToWorld, worldToCell, hash, WATER_LEVEL, darkForest, peakAt, iceField, inBounds, idx } from './grid.js';
import { surfaceY } from './terrain.js';

const U = 0.13; // model units: an animal is about two thirds of a map cell long

// Parts: [w, h, d, x, y, z, colour] in model units; 'coat' and 'dark' take the animal's own colours.
// The animal faces +x; y = 0 is the ground.
const MODELS = {
  horse: [
    [5, 2.4, 2, 0, 3.6, 0, 'coat'],
    ...[[-1.8, -0.7], [-1.8, 0.7], [1.8, -0.7], [1.8, 0.7]].map(([x, z]) => [0.7, 3, 0.7, x, 1.5, z, 'coat']),
    [1.3, 2.4, 1.2, 2.6, 5.4, 0, 'coat'], // neck
    [2.2, 1.2, 1.1, 3.4, 6.6, 0, 'coat'], // head
    [0.5, 2.2, 0.5, 2.0, 5.6, 0, 'dark'], // mane
    [0.5, 2.2, 0.5, -2.7, 3.4, 0, 'dark'], // tail
  ],
  camel: [
    [5, 2.2, 2, 0, 4.6, 0, 'coat'],
    [2.4, 1.4, 1.6, -0.3, 6.2, 0, 'coat'], // hump
    ...[[-1.8, -0.7], [-1.8, 0.7], [1.8, -0.7], [1.8, 0.7]].map(([x, z]) => [0.6, 4, 0.6, x, 2, z, 'coat']),
    [1, 2.6, 1, 2.9, 5.4, 0, 'coat'], // neck
    [2, 1, 1, 3.6, 6.6, 0, 'coat'], // head
    [0.4, 1.6, 0.4, -2.6, 4.4, 0, 'dark'],
  ],
  goat: [
    [3, 1.6, 1.4, 0, 2.4, 0, 'coat'],
    ...[[-1.1, -0.45], [-1.1, 0.45], [1.1, -0.45], [1.1, 0.45]].map(([x, z]) => [0.5, 1.8, 0.5, x, 0.9, z, 'coat']),
    [1.3, 1.1, 1, 1.9, 3.5, 0, 'coat'], // head
    [0.3, 1, 0.3, 1.6, 4.4, -0.3, 'dark'], [0.3, 1, 0.3, 1.6, 4.4, 0.3, 'dark'], // horns
    [0.3, 0.6, 0.3, 2.4, 2.8, 0, 'dark'], // beard
  ],
  sheep: [
    [3, 2, 2, 0, 2.4, 0, 'coat'],
    ...[[-1, -0.6], [-1, 0.6], [1, -0.6], [1, 0.6]].map(([x, z]) => [0.5, 1.6, 0.5, x, 0.8, z, 'dark']),
    [1.2, 1.2, 1.1, 1.9, 2.9, 0, 'dark'], // head
  ],
  deer: [
    [4, 1.8, 1.6, 0, 3.4, 0, 'coat'],
    ...[[-1.4, -0.5], [-1.4, 0.5], [1.4, -0.5], [1.4, 0.5]].map(([x, z]) => [0.5, 2.6, 0.5, x, 1.3, z, 'coat']),
    [0.9, 2, 0.9, 2.1, 4.8, 0, 'coat'], // neck
    [1.6, 1, 0.9, 2.7, 5.8, 0, 'coat'], // head
    [0.25, 1.4, 0.25, 2.3, 6.9, -0.4, 'dark'], [0.25, 1.4, 0.25, 2.3, 6.9, 0.4, 'dark'], // antlers
    [0.8, 0.25, 0.25, 2.3, 7.3, -0.6, 'dark'], [0.8, 0.25, 0.25, 2.3, 7.3, 0.6, 'dark'],
    [0.6, 0.6, 0.6, -2.1, 3.9, 0, 'light'], // white tail
  ],
  seal: [
    [3.6, 1.2, 1.4, 0, 0.6, 0, 'coat'],
    [1.3, 1.2, 1.1, 2.1, 1.3, 0, 'coat'], // head up
    [0.6, 0.3, 1.8, -1.9, 0.2, 0, 'dark'], // tail flippers
  ],
  whale: [
    [14, 3.2, 4, 0, 0, 0, 'coat'],
    [10, 0.8, 3.4, 0.6, -1.6, 0, 'light'], // belly
    [3, 2.6, 3.4, 7.8, -0.2, 0, 'coat'], // head
    [2.4, 0.5, 5, -8.4, 0.4, 0, 'coat'], // tail flukes
    [1.6, 1, 0.6, -2, 1.9, 0, 'coat'], // fin
  ],
};

// Where each kind lives, how many herds and how big, and their colours.
const KINDS = {
  horse: { herds: 9, size: [2, 4], coats: ['#8a5a34', '#5e3d27', '#d9cbb4', '#3a3330'], dark: '#2a2420', where: (k, b) => b === BIOME.PLAINS || b === BIOME.MEADOW },
  sheep: { herds: 7, size: [3, 5], coats: ['#f2ede2', '#e8e1d2'], dark: '#3a3330', where: (k, b) => b === BIOME.MEADOW },
  camel: { herds: 7, size: [2, 3], coats: ['#c9a26a', '#b88e58'], dark: '#7a5a3a', where: (k, b) => b === BIOME.DESERT },
  goat: { herds: 10, size: [2, 3], coats: ['#e8e2d8', '#8a7a6a', '#5e5048'], dark: '#3a3330', mountain: true },
  deer: { herds: 7, size: [2, 3], coats: ['#9a6a42', '#8a5a36'], dark: '#d9c8a8', light: '#f4efe6', where: (k, b) => b === BIOME.JUNGLE || b === BIOME.MEADOW },
  seal: { herds: 4, size: [2, 4], coats: ['#7a7c80', '#5e6064'], dark: '#4a4c50', shore: true },
  whale: { herds: 6, size: [1, 2], coats: ['#2c3c4c', '#34465a'], light: '#c9d4dc', sea: true },
};

// Distance (cells) from land, for whales in the open sea.
const distToLand = (() => {
  const d = new Uint16Array(grid.cols * grid.rows).fill(65535), q = [];
  for (let k = 0; k < d.length; k++) if (grid.land[k]) { d[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % grid.cols, z = (k / grid.cols) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!inBounds(nx, nz)) continue;
      const j = idx(nx, nz);
      if (d[j] > d[k] + 1) { d[j] = d[k] + 1; q.push(j); }
    }
  }
  return d;
})();

// Is the land round (x, z) calm enough to wander on: dry, not steep, the same height-ish.
function flat(x, z, r = 1) {
  const h = grid.heights[idx(x, z)];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (!inBounds(x + dx, z + dz)) return false;
    const k = idx(x + dx, z + dz);
    if (!grid.land[k] || grid.river[k] || Math.abs(grid.heights[k] - h) > 1) return false;
  }
  return true;
}

function homes(kind, spec, avoid) {
  const out = [];
  const cells = [];
  const seed = 90 + [...kind].reduce((n, ch) => n * 7 + ch.charCodeAt(0), 0) % 997; // a different spread per kind
  for (let z = 3; z < grid.rows - 3; z++) for (let x = 3; x < grid.cols - 3; x++) {
    const k = idx(x, z), b = grid.biome[k], h = grid.heights[k];
    let ok;
    if (spec.sea) ok = !grid.land[k] && distToLand[k] >= 5;
    else if (!grid.land[k] || avoid(x, z) || darkForest(x, z) > 0.2 || peakAt(x, z)) ok = false;
    else if (spec.shore) ok = iceField(x, z) > 0.2 && distToSea[k] <= 2 && h <= 3 && flat(x, z, 0);
    else if (spec.mountain) ok = h >= 8 && h <= 14 && flat(x, z, 1);
    else ok = h >= 1 && h <= 5 && distToSea[k] >= 3 && iceField(x, z) === 0 && spec.where(k, b) && flat(x, z, 1);
    if (ok) cells.push([x, z, hash(x, z, seed)]);
  }
  cells.sort((a, b) => a[2] - b[2]);
  for (const [x, z] of cells) {
    if (out.length >= spec.herds) break;
    if (out.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 14)) continue;
    out.push([x, z]);
  }
  return out;
}

export function buildAnimals(avoid = () => false) {
  const group = new THREE.Group();
  const kinds = [];
  for (const [name, spec] of Object.entries(KINDS)) {
    const herds = homes(name, spec, avoid);
    const animals = [];
    herds.forEach(([hx, hz], h) => {
      const n = spec.size[0] + Math.floor(hash(hx, hz, 91) * (spec.size[1] - spec.size[0] + 1));
      const [wx, wz] = cellToWorld(hx, hz);
      const coat = new THREE.Color(spec.coats[Math.floor(hash(hx, hz, 92) * spec.coats.length)]);
      for (let i = 0; i < n; i++) {
        const ox = (hash(h, i, 93) - 0.5) * 1.4, oz = (hash(h, i, 94) - 0.5) * 1.4;
        animals.push({
          home: [wx, wz], x: wx + ox, z: wz + oz, tx: wx + ox, tz: wz + oz, rot: hash(h, i, 95) * 6.28,
          wait: hash(h, i, 96) * 4, phase: hash(h, i, 97) * 6.28,
          coat: i && hash(h, i, 98) > 0.7 ? new THREE.Color(spec.coats[Math.floor(hash(h, i, 99) * spec.coats.length)]) : coat,
        });
      }
    });
    if (!animals.length) continue;
    const meshes = MODELS[name].map(([w, hgt, d, x, y, z, c]) => {
      const geo = bevelBox(w * U, hgt * U, d * U, Math.min(w, hgt, d) * U * 0.15).clone().translate(x * U, y * U, z * U);
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), animals.length);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      animals.forEach((a, i) => mesh.setColorAt(i, c === 'coat' ? a.coat : new THREE.Color(c === 'dark' ? spec.dark ?? '#3a3330' : c === 'light' ? spec.light ?? '#ffffff' : c)));
      group.add(mesh);
      return mesh;
    });
    kinds.push({ name, spec, animals, meshes });
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  let t = 0;
  function place(kind) {
    for (const [i, a] of kind.animals.entries()) {
      q.setFromAxisAngle(up, -a.rot);
      m.compose(pos.set(a.x, a.y, a.z), q, one);
      for (const mesh of kind.meshes) mesh.setMatrixAt(i, m);
    }
    for (const mesh of kind.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
  function update(dt, distance = 0) {
    group.visible = distance < 170;
    if (!group.visible) return;
    t += dt;
    for (const kind of kinds) {
      for (const a of kind.animals) {
        if (kind.spec.sea) { // whales swim slow circles and surface now and then
          const ang = t * 0.05 + a.phase;
          a.x = a.home[0] + Math.cos(ang) * 3.5;
          a.z = a.home[1] + Math.sin(ang) * 3.5;
          a.rot = ang + Math.PI / 2; // along the circle
          a.y = WATER_LEVEL - 0.42 + Math.max(0, Math.sin(t * 0.35 + a.phase)) * 0.36; // the back breaks the surface
          continue;
        }
        if (a.wait > 0) a.wait -= dt;
        else {
          const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
          if (d < 0.05) { // arrived: graze a while, then pick somewhere nearby
            a.wait = 2 + hash(a.phase * 100, t | 0, 3) * 6;
            a.tx = a.home[0] + (hash(a.phase * 50, t | 0, 4) - 0.5) * 1.6;
            a.tz = a.home[1] + (hash(a.phase * 70, t | 0, 5) - 0.5) * 1.6;
          } else {
            const step = Math.min(d, dt * 0.18);
            a.x += (dx / d) * step; a.z += (dz / d) * step;
            const want = Math.atan2(dz, dx);
            a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 4);
          }
        }
        const [cx, cz] = worldToCell(a.x, a.z);
        a.y = surfaceY(cx, cz) + (a.wait > 0 ? 0 : Math.abs(Math.sin(t * 9 + a.phase)) * 0.02);
      }
      place(kind);
    }
  }
  update(0);
  group.userData.update = update;
  group.userData.herds = kinds.map((k) => ({ name: k.name, count: k.animals.length, homes: [...new Set(k.animals.map((a) => a.home.join(',')))] }));
  return group;
}

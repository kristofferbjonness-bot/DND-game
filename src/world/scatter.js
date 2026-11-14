// Trees, pines and cacti scattered across the land, and drifting voxel clouds.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import { grid, BIOME, idx, cellToWorld, distToSea, hash, LAYER, inDarkForest } from './grid.js';

// Chance of a plant per cell, by biome.
const DENSITY = {
  [BIOME.SNOW]: 0.04,
  [BIOME.MEADOW]: 0.22,
  [BIOME.PLAINS]: 0.07,
  [BIOME.DESERT]: 0.025,
  [BIOME.JUNGLE]: 0.55,
};

// Each plant kind is a few stacked parts: [width, height, depth, yOffset, colour].
const KINDS = {
  tree: [
    [0.22, 0.5, 0.22, 0.25, '#7a5636'],
    [0.75, 0.6, 0.75, 0.75, '#5fae48'],
  ],
  jungle: [
    [0.22, 0.8, 0.22, 0.4, '#6b4a2e'],
    [0.95, 0.5, 0.95, 1.0, '#2f8a3e'],
    [0.6, 0.35, 0.6, 1.35, '#3b9a47'],
  ],
  pine: [
    [0.2, 0.35, 0.2, 0.17, '#6b4a2e'],
    [0.75, 0.4, 0.75, 0.55, '#2f6f4a'],
    [0.5, 0.4, 0.5, 0.92, '#357a52'],
    [0.26, 0.3, 0.26, 1.24, '#eef4f8'],
  ],
  cactus: [
    [0.22, 0.75, 0.22, 0.37, '#6aa257'],
    [0.42, 0.14, 0.14, 0.45, '#6aa257'],
  ],
  // The dark forest: tall black-green pines and bare dead trees.
  darkpine: [
    [0.2, 0.4, 0.2, 0.2, '#3a2a1e'],
    [0.85, 0.45, 0.85, 0.6, '#1f3326'],
    [0.62, 0.45, 0.62, 1.0, '#223a2a'],
    [0.38, 0.45, 0.38, 1.4, '#1b2e22'],
    [0.16, 0.3, 0.16, 1.75, '#1b2e22'],
  ],
  deadtree: [
    [0.2, 1.3, 0.2, 0.65, '#4a3e36'],
    [0.5, 0.1, 0.1, 0.95, '#4a3e36'],
    [0.1, 0.1, 0.42, 1.2, '#433832'],
    [0.32, 0.08, 0.08, 1.4, '#433832'],
  ],
};

function pickKind(biome, h) {
  if (biome === BIOME.SNOW || h >= 5) return 'pine';
  if (biome === BIOME.JUNGLE) return 'jungle';
  if (biome === BIOME.DESERT) return 'cactus';
  return 'tree';
}

export function buildPlants(avoid) {
  const { cols, rows } = grid;
  const spots = { tree: [], jungle: [], pine: [], cactus: [], darkpine: [], deadtree: [] };

  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    const k = idx(x, z);
    const h = grid.heights[k];
    if (!grid.land[k] || grid.river[k] || h < 1 || h >= 7) continue;
    if (distToSea[k] <= 1) continue;
    if (avoid(x, z)) continue;
    const b = grid.biome[k];
    const dark = inDarkForest(x, z);
    if (hash(x, z, 1) > (dark ? 0.8 : DENSITY[b])) continue;
    const kind = dark ? (hash(x, z, 6) > 0.82 ? 'deadtree' : 'darkpine') : pickKind(b, h);
    const [wx, wz] = cellToWorld(x, z);
    spots[kind].push({
      x: wx + (hash(x, z, 2) - 0.5) * 0.5,
      y: h * LAYER,
      z: wz + (hash(x, z, 3) - 0.5) * 0.5,
      s: 0.8 + hash(x, z, 4) * 0.45,
      r: hash(x, z, 5) * Math.PI,
    });
  }

  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const lods = []; // [mesh, rounded shape, plain shape]
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  for (const [kind, parts] of Object.entries(KINDS)) {
    const list = spots[kind];
    if (!list.length) continue;
    for (const [w, h, d, y, colour] of parts) {
      const geo = bevelBox(w, h, d, Math.min(w, h, d) * 0.18, { open: true }).clone();
      geo.translate(0, y, 0);
      const plain = new THREE.BoxGeometry(w, h, d).translate(0, y, 0);
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      lods.push([mesh, geo, plain]);
      const c = new THREE.Color(colour);
      const tint = new THREE.Color();
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.r);
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, tint.copy(c).multiplyScalar(0.92 + (i % 7) * 0.025));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  // Zoomed out, the trees' rounded edges are too small to see: use plain boxes.
  let rounded = true;
  group.userData.lod = (distance) => {
    const want = distance < 110;
    if (want === rounded) return;
    rounded = want;
    for (const [mesh, geo, plain] of lods) mesh.geometry = want ? geo : plain;
  };
  return group;
}

// Drifting clouds. Each cloud is a few flattened puffs; all puffs are drawn as
// one instanced mesh, moved along each frame.
export function buildClouds() {
  const { cols, rows } = grid;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92,
  });
  const clouds = [];
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Object3D();
    const n = 3 + Math.floor(hash(i, 0, 7) * 4);
    for (let p = 0; p < n; p++) {
      const puff = new THREE.Object3D();
      const s = 2.5 + hash(i, p, 8) * 3;
      puff.scale.set(s * 1.4, s * 0.55, s);
      puff.position.set(p * 2.6 - n * 1.3, hash(i, p, 9) * 0.8, (hash(i, p, 10) - 0.5) * 2.5);
      cloud.add(puff);
      puffs.push(puff);
    }
    cloud.position.set(
      (hash(i, 1, 11) - 0.5) * cols * 1.2,
      17 + hash(i, 1, 12) * 5,
      (hash(i, 1, 13) - 0.5) * rows * 1.1,
    );
    cloud.userData.speed = 0.6 + hash(i, 1, 14) * 0.8;
    clouds.push(cloud);
  }
  const mesh = new THREE.InstancedMesh(bevelBox(1, 1, 1, 0.2), mat, puffs.length);
  mesh.castShadow = true;
  mesh.frustumCulled = false; // the puffs move about
  group.add(mesh);
  const place = () => {
    clouds.forEach((c) => c.updateMatrixWorld(true));
    puffs.forEach((p, i) => mesh.setMatrixAt(i, p.matrixWorld));
    mesh.instanceMatrix.needsUpdate = true;
  };
  place();

  const span = cols * 1.3;
  let windSpeed = 1;
  group.userData.update = (dt) => {
    for (const c of clouds) {
      c.position.x += c.userData.speed * windSpeed * dt;
      if (c.position.x > span / 2) c.position.x -= span;
    }
    place();
  };
  // The weather changes the clouds: bigger and greyer in rain and storms,
  // dark at night, and faster in the wind (see world/atmosphere.js).
  const white = new THREE.Color('#ffffff'), grey = new THREE.Color('#6f7580'), dark = new THREE.Color('#3a4060');
  group.userData.setLook = ({ scale = 1, grey: g = 0, night = 0, wind = 1 }) => {
    windSpeed = wind;
    mat.color.copy(white).lerp(grey, g).lerp(dark, night * 0.7);
    mat.opacity = Math.min(0.97, 0.88 + g * 0.1);
    if (clouds[0].scale.x !== scale) { for (const c of clouds) c.scale.setScalar(scale); place(); }
  };
  return group;
}

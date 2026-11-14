// Builds the voxel terrain: one rounded block per visible layer of each land
// column, one flat block per sea cell, a water surface and a distant ocean floor.
// Blocks are grouped in chunks so the parts off-screen are not drawn at all.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import {
  grid, LAYER, WATER_LEVEL, BIOME, idx, heightAt, cellToWorld, distToSea, hash, darkForest,
} from './grid.js';

const C = (hex) => new THREE.Color(hex);

// Top colour and side (soil/rock) colour for each biome.
const PALETTE = {
  [BIOME.SNOW]: { top: C('#eef4f8'), side: C('#c7d4de') },
  [BIOME.MEADOW]: { top: C('#86c95c'), side: C('#9a7650') },
  [BIOME.PLAINS]: { top: C('#bcc66c'), side: C('#a5875a') },
  [BIOME.DESERT]: { top: C('#efd28c'), side: C('#d4a86a') },
  [BIOME.JUNGLE]: { top: C('#47a552'), side: C('#7a5838') },
};
const SAND = C('#f2dfa6');
const RIVERBED = C('#6f9fae');
const ROCK = C('#a59c90');
const RED_ROCK = C('#bf8f66');
const SNOWCAP = C('#f7f9fb');
const DARK_FLOOR = C('#43473f'), DARK_MOSS = C('#4c5244'), DARK_SOIL = C('#4d463d'); // dark forests: grey
const SEA = [C('#8fd8d6'), C('#5cbcc9'), C('#3c9bbd'), C('#2d7fa8')];

const MOUNTAIN_FROM = 7; // layers; above this a column is bare rock
const CHUNK = 32;          // cells per side of a chunk; off-screen chunks are skipped
const LOD_DISTANCE = 80;   // beyond this, chunks use plain blocks (a bevel is under a pixel there)

// A second instanced mesh drawing the same blocks with another shape.
function twin(mesh, geometry) {
  const t = new THREE.InstancedMesh(geometry, mesh.material, mesh.count);
  t.instanceMatrix = mesh.instanceMatrix;
  t.instanceColor = mesh.instanceColor;
  mesh.computeBoundingSphere();
  t.boundingSphere = mesh.boundingSphere;
  return t;
}
const SNOWCAP_FROM = 14;

function cubeColor(k, x, z, layer, top, out) {
  const b = grid.biome[k];
  const pal = PALETTE[b];
  const isTop = layer === top;

  if (grid.river[k]) out.copy(RIVERBED);
  else if (isTop) {
    if (top >= SNOWCAP_FROM || (b === BIOME.SNOW && top >= MOUNTAIN_FROM)) out.copy(SNOWCAP);
    else if (top >= MOUNTAIN_FROM) out.copy(b === BIOME.DESERT ? RED_ROCK : ROCK);
    else if (distToSea[k] <= 1 && top <= 2 && b !== BIOME.SNOW) out.copy(SAND);
    else out.copy(pal.top).lerp(hash(x, z, 78) > 0.7 ? DARK_MOSS : DARK_FLOOR, darkForest(x, z));
  } else {
    if (layer >= MOUNTAIN_FROM - 2) out.copy(b === BIOME.DESERT ? RED_ROCK : ROCK);
    else out.copy(pal.side).lerp(DARK_SOIL, darkForest(x, z));
    out.multiplyScalar(0.82 + 0.03 * Math.min(layer, 6));
  }
  // A little per-block variation keeps big areas from looking flat.
  const j = 0.94 + hash(x, z, layer) * 0.1;
  out.multiplyScalar(j);
  return out;
}

export function buildTerrain() {
  const { cols, rows } = grid;
  const group = new THREE.Group();

  // Count blocks first so the instanced meshes can be sized exactly.
  const landBlocks = [];
  const seaCells = [];
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const k = idx(x, z);
      const h = grid.heights[k];
      if (h < 0) { seaCells.push(k); continue; }
      // Only layers that can be seen from the side need a block.
      const lowestNeighbour = Math.min(
        heightAt(x + 1, z), heightAt(x - 1, z), heightAt(x, z + 1), heightAt(x, z - 1),
      );
      const from = Math.max(Math.min(lowestNeighbour, h), -2);
      for (let layer = Math.min(from, h); layer <= h; layer++) landBlocks.push([k, x, z, layer, h]);
    }
  }

  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const chunkOf = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
  const chunks = []; // { centre, near: [meshes], far: [meshes] }

  // Land: softly rounded blocks near the camera, plain blocks further away
  // (the bevels are too small to see from there). Both share one set of
  // positions and colours per chunk, and each casts the shadows while shown.
  const byChunk = new Map();
  for (const b of landBlocks) {
    const key = chunkOf(b[1], b[2]);
    if (!byChunk.has(key)) byChunk.set(key, []);
    byChunk.get(key).push(b);
  }
  const landNear = bevelBox(1, LAYER, 1, 0.05, { open: true });
  const landFar = new THREE.BoxGeometry(1, LAYER, 1);
  const landMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  for (const list of byChunk.values()) {
    const near = new THREE.InstancedMesh(landNear, landMat, list.length);
    list.forEach(([k, x, z, layer, h], i) => {
      const [wx, wz] = cellToWorld(x, z);
      near.setMatrixAt(i, m.makeTranslation(wx, (layer - 0.5) * LAYER, wz));
      near.setColorAt(i, cubeColor(k, x, z, layer, h, col));
    });
    near.castShadow = near.receiveShadow = true;
    const far = twin(near, landFar);
    far.castShadow = far.receiveShadow = true;
    group.add(near, far);
    chunks.push({ centre: near.boundingSphere.center, near, far });
  }

  // Sea floor, coloured by depth, seen through the water. Only the tops can be
  // seen, so each cell is a flat tile at the height of its top.
  const seaGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  {
    const sea = new THREE.InstancedMesh(seaGeo, seaMat, seaCells.length);
    seaCells.forEach((k, i) => {
      const x = k % cols, z = (k / cols) | 0, h = grid.heights[k];
      const [wx, wz] = cellToWorld(x, z);
      sea.setMatrixAt(i, m.makeTranslation(wx, h * LAYER, wz));
      col.copy(SEA[Math.min(-h - 1, 3)]).multiplyScalar(0.97 + hash(x, z, 9) * 0.06);
      sea.setColorAt(i, col);
    });
    sea.computeBoundingSphere();
    sea.receiveShadow = true;
    group.add(sea);
  }

  // Each frame: rounded blocks for chunks near the camera, plain ones further off.
  group.userData.lod = (camera) => {
    for (const c of chunks) {
      const isNear = camera.position.distanceTo(c.centre) < LOD_DISTANCE;
      c.near.visible = isNear;
      c.far.visible = !isNear;
    }
  };

  // Deep ocean beyond the edges of the drawn map.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(cols * 6, rows * 6),
    new THREE.MeshStandardMaterial({ color: SEA[3], roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4 * LAYER;
  floor.receiveShadow = true;
  group.add(floor);

  // Water surface.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(cols * 6, rows * 6),
    new THREE.MeshStandardMaterial({
      color: '#4fb4d6', transparent: true, opacity: 0.62, roughness: 0.25, metalness: 0,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  group.add(water);

  return group;
}

// World-space height of the ground surface at a cell (top of its top block).
export const surfaceY = (x, z) => Math.max(heightAt(x, z), 0) * LAYER;

// Builds the voxel terrain: one rounded block per visible layer of each land
// column, one flat block per sea cell, a water surface and a distant ocean floor.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import {
  grid, LAYER, WATER_LEVEL, BIOME, idx, heightAt, cellToWorld, distToSea, hash,
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
const SEA = [C('#8fd8d6'), C('#5cbcc9'), C('#3c9bbd'), C('#2d7fa8')];

const MOUNTAIN_FROM = 7; // layers; above this a column is bare rock
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
    else out.copy(pal.top);
  } else {
    out.copy(layer >= MOUNTAIN_FROM - 2 ? (b === BIOME.DESERT ? RED_ROCK : ROCK) : pal.side);
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

  // Land: softly rounded blocks.
  const landGeo = bevelBox(1, LAYER, 1, 0.05);
  const landMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const land = new THREE.InstancedMesh(landGeo, landMat, landBlocks.length);
  landBlocks.forEach(([k, x, z, layer, h], i) => {
    const [wx, wz] = cellToWorld(x, z);
    m.makeTranslation(wx, (layer - 0.5) * LAYER, wz);
    land.setMatrixAt(i, m);
    land.setColorAt(i, cubeColor(k, x, z, layer, h, col));
  });
  land.castShadow = true;
  land.receiveShadow = true;
  group.add(land);

  // Sea floor: plain blocks, coloured by depth, seen through the water.
  const seaGeo = new THREE.BoxGeometry(1, LAYER, 1);
  const seaMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const sea = new THREE.InstancedMesh(seaGeo, seaMat, seaCells.length);
  seaCells.forEach((k, i) => {
    const x = k % cols, z = (k / cols) | 0, h = grid.heights[k];
    const [wx, wz] = cellToWorld(x, z);
    m.makeTranslation(wx, (h - 0.5) * LAYER, wz);
    sea.setMatrixAt(i, m);
    col.copy(SEA[Math.min(-h - 1, 3)]).multiplyScalar(0.97 + hash(x, z, 9) * 0.06);
    sea.setColorAt(i, col);
  });
  sea.receiveShadow = true;
  group.add(sea);

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

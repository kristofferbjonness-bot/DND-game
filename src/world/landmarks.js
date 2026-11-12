// Small voxel towns that mark each location on the map. Each style is a
// recipe of blocks; sizes are in world units (one map cell = 1 unit).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const geoCache = new Map();
const matCache = new Map();

function block(group, [w, h, d], [x, y, z], colour, rotY = 0) {
  const key = `${w}|${h}|${d}`;
  if (!geoCache.has(key)) {
    const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.12);
    g.translate(0, h / 2, 0); // y is the block's base
    geoCache.set(key, g);
  }
  if (!matCache.has(colour)) matCache.set(colour, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85 }));
  const mesh = new THREE.Mesh(geoCache.get(key), matCache.get(colour));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

// A house: walls plus a stepped roof.
function house(g, x, z, { w = 0.6, d = 0.6, h = 0.5, wall, roof, rot = 0, flat = false }) {
  block(g, [w, h, d], [x, 0, z], wall, rot);
  if (flat) {
    block(g, [w * 1.04, 0.06, d * 1.04], [x, h, z], roof, rot);
  } else {
    block(g, [w * 1.1, 0.14, d * 1.1], [x, h, z], roof, rot);
    block(g, [w * 0.72, 0.13, d * 0.95], [x, h + 0.14, z], roof, rot);
    block(g, [w * 0.36, 0.12, d * 0.8], [x, h + 0.27, z], roof, rot);
  }
}

function tower(g, x, z, { r = 0.35, h = 1.2, wall, roof }) {
  block(g, [r, h, r], [x, 0, z], wall);
  block(g, [r * 1.25, 0.1, r * 1.25], [x, h, z], wall);
  block(g, [r * 0.8, 0.2, r * 0.8], [x, h + 0.1, z], roof);
  block(g, [r * 0.4, 0.2, r * 0.4], [x, h + 0.3, z], roof);
}

function flag(g, x, y, z, colour) {
  block(g, [0.04, 0.6, 0.04], [x, y, z], '#5b4a3a');
  block(g, [0.3, 0.18, 0.03], [x + 0.16, y + 0.4, z], colour);
}

const STYLES = {
  razz(g) {
    // Maze of sandstone blocks around a big square building on a plateau.
    block(g, [1.6, 0.25, 1.6], [0, 0, 0], '#c9a674');
    block(g, [0.9, 0.85, 0.9], [0, 0.25, 0], '#d8b583');
    block(g, [1.0, 0.08, 1.0], [0, 1.1, 0], '#c39a63');
    const ring = [[-1.2, -0.9], [-0.4, -1.3], [0.6, -1.25], [1.3, -0.5], [1.25, 0.5],
      [0.7, 1.25], [-0.2, 1.3], [-1.1, 0.8], [-1.4, -0.05]];
    ring.forEach(([x, z], i) => {
      const h = 0.35 + ((i * 37) % 5) * 0.08;
      block(g, [0.5, h, 0.5], [x, 0, z], i % 2 ? '#e2c597' : '#d6b27c');
      if (i % 3 === 0) block(g, [0.3, 0.04, 0.2], [x, h * 0.6, z + 0.27], ['#b9473b', '#3a7d8c', '#d9a23a'][i % 3]);
    });
    flag(g, 0.35, 1.18, 0.35, '#7b3f8f');
  },
  castle(g) {
    const wall = '#b9bcc2', roof = '#9a3b3b';
    block(g, [2.2, 0.35, 0.22], [0, 0, -1.0], wall);
    block(g, [2.2, 0.35, 0.22], [0, 0, 1.0], wall);
    block(g, [0.22, 0.35, 2.2], [-1.0, 0, 0], wall);
    block(g, [0.22, 0.35, 2.2], [1.0, 0, 0], wall);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower(g, x, z, { r: 0.38, h: 0.7, wall, roof });
    tower(g, 0, 0, { r: 0.8, h: 1.4, wall: '#c9ccd2', roof });
    house(g, -0.45, 0.45, { w: 0.4, d: 0.4, h: 0.3, wall: '#e3d9c6', roof });
    house(g, 0.5, -0.45, { w: 0.4, d: 0.4, h: 0.3, wall: '#e3d9c6', roof });
    flag(g, 0, 2.0, 0, '#d9a23a');
  },
  'castle-small'(g) {
    const wall = '#b9bcc2', roof = '#4b5d8a';
    tower(g, 0, 0, { r: 0.6, h: 0.95, wall, roof });
    house(g, 0.7, 0.3, { w: 0.5, d: 0.45, h: 0.35, wall: '#e3d9c6', roof });
    house(g, -0.6, 0.45, { w: 0.45, d: 0.45, h: 0.3, wall: '#e3d9c6', roof });
    flag(g, 0, 1.45, 0, '#4b5d8a');
  },
  nordic(g) {
    const wall = '#9a6a45', roof = '#3e4b5c';
    house(g, -0.6, -0.3, { w: 0.7, d: 0.5, h: 0.42, wall, roof });
    house(g, 0.4, -0.6, { w: 0.55, d: 0.55, h: 0.36, wall: '#b07c50', roof });
    house(g, 0.55, 0.45, { w: 0.6, d: 0.5, h: 0.4, wall, roof: '#7a3a32' });
    house(g, -0.4, 0.65, { w: 0.5, d: 0.5, h: 0.34, wall: '#b07c50', roof });
    // Wind-forge tower with sails: Bartedalen runs its forges on the wind.
    block(g, [0.32, 1.25, 0.32], [0, 0, 0], '#d8d2c6');
    const sails = new THREE.Group();
    sails.position.set(0, 1.15, 0.2);
    block(sails, [0.08, 0.95, 0.03], [0, -0.47, 0], '#efe8da');
    block(sails, [0.95, 0.08, 0.03], [0, -0.04, 0], '#efe8da');
    g.add(sails);
    g.userData.spin = sails;
  },
  village(g) {
    const wall = '#c69c6d', roof = '#d9bf6a';
    house(g, -0.45, -0.2, { w: 0.5, d: 0.5, h: 0.3, wall, roof });
    house(g, 0.45, -0.35, { w: 0.45, d: 0.45, h: 0.28, wall, roof });
    house(g, 0.05, 0.5, { w: 0.55, d: 0.45, h: 0.32, wall, roof });
  },
  pagoda(g) {
    const wall = '#b8463c', roof = '#2f3640';
    let w = 1.0, y = 0;
    for (let i = 0; i < 4; i++) {
      block(g, [w * 0.7, 0.3, w * 0.7], [0, y, 0], wall);
      block(g, [w, 0.08, w], [0, y + 0.3, 0], roof);
      y += 0.38; w *= 0.78;
    }
    block(g, [0.06, 0.3, 0.06], [0, y, 0], '#d9a23a');
    house(g, -0.9, 0.5, { w: 0.45, d: 0.45, h: 0.3, wall: '#e8dcc8', roof });
    house(g, 0.85, 0.6, { w: 0.45, d: 0.45, h: 0.3, wall: '#e8dcc8', roof });
  },
  harbour(g) {
    const wall = '#e4d6bd', roof = '#b8584a';
    house(g, -0.3, -0.4, { w: 0.6, d: 0.5, h: 0.4, wall, roof });
    house(g, 0.5, -0.1, { w: 0.5, d: 0.5, h: 0.5, wall, roof: '#4f6d8f' });
    house(g, -0.5, 0.45, { w: 0.5, d: 0.45, h: 0.35, wall, roof });
    // A pier pointing out to sea (to the west) with a little boat.
    block(g, [1.6, 0.06, 0.25], [-1.4, -0.12, 0.1], '#8a6440');
    block(g, [0.7, 0.16, 0.28], [-1.6, -0.3, 0.5], '#7a4f30');
    block(g, [0.04, 0.6, 0.04], [-1.6, -0.15, 0.5], '#5b4a3a');
    block(g, [0.03, 0.4, 0.3], [-1.6, 0.0, 0.5], '#f2ecdf');
  },
  sirivik(g) {
    const wall = '#3a3640', roof = '#1f1d24';
    house(g, -0.2, -0.35, { w: 0.55, d: 0.5, h: 0.45, wall, roof });
    house(g, 0.5, 0.25, { w: 0.5, d: 0.5, h: 0.4, wall: '#45404d', roof });
    house(g, -0.5, 0.5, { w: 0.45, d: 0.45, h: 0.35, wall, roof });
    // Lighthouse on the cliff edge.
    block(g, [0.3, 1.1, 0.3], [-1.1, 0, -0.3], '#e8e4dc');
    block(g, [0.32, 0.18, 0.32], [-1.1, 0.4, -0.3], '#a8433a');
    block(g, [0.24, 0.18, 0.24], [-1.1, 1.1, -0.3], '#ffd98a');
  },
};

export function buildLandmark(style) {
  const g = new THREE.Group();
  (STYLES[style] || STYLES.village)(g);
  return g;
}

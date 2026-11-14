// Small voxel towns that mark each location on the map. Each style is a
// recipe of blocks; sizes are in world units (one map cell = 1 unit).
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';

const geoCache = new Map();
const matCache = new Map();

function block(group, [w, h, d], [x, y, z], colour, rotY = 0) {
  const key = `${w}|${h}|${d}`;
  if (!geoCache.has(key)) {
    const g = bevelBox(w, h, d, Math.min(w, h, d) * 0.12).clone();
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
  // The Empire of Tine: a great walled city. An outer wall with towers and a gate, streets of houses
  // with red roofs, an inner wall and a tall keep with four towers, and a cathedral.
  empire(g) {
    const wall = '#b9bcc2', wallDark = '#a3a6ad', roof = '#9a3b3b', roofs = ['#9a3b3b', '#a8503a', '#8a3a44', '#4b5d8a'];
    const R = 2.4;
    for (const s of [-1, 1]) {
      block(g, [R * 2, 0.4, 0.24], [0, 0, s * R], wall);
      block(g, [0.24, 0.4, R * 2], [s * R, 0, 0], wall);
    }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower(g, x * R, z * R, { r: 0.45, h: 0.85, wall, roof });
    for (const [x, z] of [[0, -1], [-1, 0], [1, 0]]) tower(g, x * R, z * R, { r: 0.34, h: 0.65, wall: wallDark, roof });
    // The gate on the south side.
    block(g, [0.7, 0.62, 0.36], [0, 0, R], wallDark);
    block(g, [0.32, 0.36, 0.38], [0, 0, R + 0.01], '#4a3a2e');
    // Houses filling the streets between the walls.
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const x = i * 0.5, z = j * 0.5;
      if (Math.max(Math.abs(i), Math.abs(j)) < 2 || Math.abs(i) === 0 && j > 1) continue; // the inner ward and the main street
      const n = (i * 31 + j * 17 + 100) % 7;
      if (n === 0) continue;
      house(g, x, z, { w: 0.36, d: 0.36, h: 0.22 + (n % 3) * 0.08, wall: n % 2 ? '#e3d9c6' : '#d8ccb6', roof: roofs[n % roofs.length] });
    }
    // The inner ward: a wall, the keep and its towers, and a cathedral.
    for (const s of [-1, 1]) { block(g, [1.9, 0.5, 0.18], [0, 0, s * 0.9], wallDark); block(g, [0.18, 0.5, 1.9], [s * 0.9, 0, 0], wallDark); }
    tower(g, 0, -0.15, { r: 0.85, h: 1.9, wall: '#c9ccd2', roof });
    for (const [x, z] of [[-0.5, -0.65], [0.5, -0.65], [-0.5, 0.35], [0.5, 0.35]]) tower(g, x, z, { r: 0.3, h: 2.2, wall: '#c9ccd2', roof });
    block(g, [0.5, 0.7, 1.0], [-1.6, 0, -1.4], '#e3d9c6');
    block(g, [0.58, 0.2, 1.08], [-1.6, 0.7, -1.4], roof);
    tower(g, -1.6, -2.0, { r: 0.3, h: 1.4, wall: '#e3d9c6', roof });
    flag(g, 0, 2.7, -0.15, '#d9a23a');
  },
  // Fiskesund: a little fishing village. Weathered huts, a pier with boats, racks of drying fish.
  fishing(g) {
    const wall = '#a88a64', wallGrey = '#9a948a', roof = '#5a6a7a', roofRed = '#9a4a3a';
    house(g, -0.4, -0.3, { w: 0.45, d: 0.4, h: 0.28, wall, roof });
    house(g, 0.35, -0.45, { w: 0.4, d: 0.4, h: 0.26, wall: wallGrey, roof: roofRed });
    house(g, -0.15, 0.4, { w: 0.42, d: 0.38, h: 0.25, wall, roof: roofRed });
    house(g, 0.6, 0.2, { w: 0.36, d: 0.36, h: 0.24, wall: wallGrey, roof });
    // Drying racks with fish.
    for (const z of [-0.9, -1.15]) {
      for (const x of [-0.55, 0.05]) block(g, [0.04, 0.32, 0.04], [x, 0, z], '#5b4a3a');
      block(g, [0.64, 0.04, 0.04], [-0.25, 0.3, z], '#5b4a3a');
      for (let i = 0; i < 5; i++) block(g, [0.05, 0.14, 0.03], [-0.5 + i * 0.12, 0.15, z], '#b8c4c8');
    }
    // A pier out to sea (south) with two little boats.
    block(g, [0.24, 0.06, 1.5], [0.15, -0.12, 1.3], '#8a6440');
    for (const z of [0.8, 1.4, 2.0]) block(g, [0.06, 0.3, 0.06], [0.3, -0.4, z], '#5b4a3a');
    block(g, [0.24, 0.12, 0.6], [-0.2, -0.28, 1.6], '#7a4f30');
    block(g, [0.22, 0.12, 0.5], [0.55, -0.28, 1.9], '#4f6d8f');
    block(g, [0.03, 0.4, 0.03], [-0.2, -0.16, 1.6], '#5b4a3a');
    block(g, [0.02, 0.26, 0.24], [-0.2, -0.05, 1.6], '#f2ecdf');
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

// The Empire of Tine, built to fit its land: houses on every dry, fairly flat cell round the
// middle (on both banks of the Strait of Skinder), walls and towers round the edge where there is
// land, the keep and the cathedral on firm ground, and stone bridges joining the banks.
//   at(x, z) → { dry, water, y }  for a map cell; toWorld(x, z) → [wx, wz].
export function buildTine({ cx, cz, r, keep, cathedral, bridges, at, toWorld, skip = () => false }) {
  const g = new THREE.Group();
  const wall = '#b9bcc2', wallDark = '#a3a6ad', roofs = ['#9a3b3b', '#a8503a', '#8a3a44', '#4b5d8a'];
  const put = (x, z, fn) => { const c = at(x, z); const [wx, wz] = toWorld(x, z); const s = new THREE.Group(); s.position.set(wx, c.y, wz); fn(s); g.add(s); };
  const n = (x, z, k) => { let h = (x * 374761393 + z * 668265263 + k * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const near = (x, z, [px, pz], d) => Math.hypot(x - px, z - pz) < d;
  for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d > r + 0.4 || !at(x, z).dry || skip(x, z)) continue;
    if (d > r - 0.8) { // the wall, with a tower now and then
      put(x, z, (s) => (n(x, z, 1) > 0.72 ? tower(s, 0, 0, { r: 0.42, h: 0.85, wall, roof: roofs[0] }) : block(s, [1, 0.42, 1], [0, 0, 0], wallDark)));
      continue;
    }
    if (near(x, z, keep, 1.6) || near(x, z, cathedral, 1.2)) continue;
    put(x, z, (s) => {
      const k = Math.floor(n(x, z, 2) * 4);
      house(s, (n(x, z, 3) - 0.5) * 0.3, (n(x, z, 4) - 0.5) * 0.3, { w: 0.5 + n(x, z, 5) * 0.2, d: 0.5 + n(x, z, 6) * 0.2, h: 0.24 + n(x, z, 7) * 0.22, wall: k % 2 ? '#e3d9c6' : '#d8ccb6', roof: roofs[k], rot: n(x, z, 8) > 0.5 ? Math.PI / 2 : 0 });
      if (n(x, z, 9) > 0.7) house(s, 0.25, 0.25, { w: 0.3, d: 0.3, h: 0.2, wall: '#e3d9c6', roof: roofs[(k + 1) % 4] });
    });
  }
  // The keep with four towers, and the cathedral with its spire.
  put(keep[0], keep[1], (s) => {
    for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) block(s, [0.3, 0.55, 0.3], [x, 0, z], wallDark);
    for (const t of [-1, 1]) { block(s, [1.8, 0.5, 0.16], [0, 0, t * 0.75], wallDark); block(s, [0.16, 0.5, 1.8], [t * 0.75, 0, 0], wallDark); }
    tower(s, 0, 0, { r: 0.9, h: 2.0, wall: '#c9ccd2', roof: roofs[0] });
    for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) tower(s, x, z, { r: 0.3, h: 2.3, wall: '#c9ccd2', roof: roofs[0] });
    flag(s, 0, 2.8, 0, '#d9a23a');
  });
  put(cathedral[0], cathedral[1], (s) => {
    block(s, [0.6, 0.75, 1.2], [0, 0, 0], '#e3d9c6');
    block(s, [0.68, 0.18, 1.28], [0, 0.75, 0], roofs[0]);
    block(s, [0.4, 0.14, 1.1], [0, 0.93, 0], roofs[0]);
    tower(s, 0, -0.75, { r: 0.34, h: 1.5, wall: '#e3d9c6', roof: roofs[0] });
  });
  // Stone bridges across the strait: [z, x from, x to] along x at row z.
  for (const [bz, x0, x1] of bridges) {
    const [wx0, wz] = toWorld(x0, bz), [wx1] = toWorld(x1, bz);
    const y = Math.max(at(x0, bz).y, at(x1, bz).y) + 0.08;
    const len = wx1 - wx0 + 0.8;
    block(g, [len, 0.16, 0.7], [(wx0 + wx1) / 2, y - 0.16, wz], '#a3a6ad');
    for (const t of [-1, 1]) block(g, [len, 0.12, 0.08], [(wx0 + wx1) / 2, y, wz + t * 0.31], '#8f9299');
    for (let x = x0 + 1; x < x1; x++) { const [px] = toWorld(x, bz); block(g, [0.3, y - 0.1, 0.6], [px, -0.1, wz], '#8f9299'); }
  }
  return g;
}

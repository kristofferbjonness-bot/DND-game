// A tiny voxel "diorama" builder, used for the city maps and the location
// postcards (tools/postcards).
// Scenes paint coloured voxels into a grid; render() turns them into
// instanced rounded blocks with the same look as the world map.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';

export function hash(x, y, z = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise in [0, 1).
export function noise(x, z, scale = 8, seed = 0) {
  const fx = x / scale, fz = z / scale;
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = fx - x0, tz = fz - z0;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(x0, z0, seed), b = hash(x0 + 1, z0, seed);
  const c = hash(x0, z0 + 1, seed), d = hash(x0 + 1, z0 + 1, seed);
  return a + (b - a) * s(tx) + (c - a) * s(tz) + (a - b - c + d) * s(tx) * s(tz);
}

export class Vox {
  constructor(size = 48, { corner = 7 } = {}) {
    this.size = size;
    this.corner = corner;
    this.solid = new Map();  // "x,y,z" -> colour
    this.glow = new Map();   // light-emitting voxels (windows, lanterns, runes)
    this.water = new Map();
    this.mist = new Map();
    this.half = size / 2;
  }

  key(x, y, z) { return `${x},${y},${z}`; }

  // Rounded-square footprint of the diorama slab.
  inside(x, z, r = this.corner) {
    const n = this.size;
    if (x < 0 || z < 0 || x >= n || z >= n) return false;
    const cx = Math.min(x, n - 1 - x), cz = Math.min(z, n - 1 - z);
    if (cx >= r || cz >= r) return true;
    return Math.hypot(r - cx - 0.5, r - cz - 0.5) <= r;
  }

  set(x, y, z, c) { this.water.delete(this.key(x, y, z)); this.solid.set(this.key(x, y, z), c); }
  light(x, y, z, c) { this.solid.delete(this.key(x, y, z)); this.glow.set(this.key(x, y, z), c); }
  clear(x, y, z) { const k = this.key(x, y, z); this.solid.delete(k); this.glow.delete(k); }
  has(x, y, z) { const k = this.key(x, y, z); return this.solid.has(k) || this.glow.has(k); }
  fog(x, y, z) { if (!this.has(x, y, z)) this.mist.set(this.key(x, y, z), 1); }

  // A soft cloud of mist: an ellipsoid of fog voxels with a ragged edge.
  puff(cx, cy, cz, rx, ry, rz) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
      if (d <= 1 - hash(x, y, z) * 0.25 && this.inside(x, z)) this.fog(x, y, z);
    }
  }

  box(x0, y0, z0, x1, y1, z1, c) {
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
  }

  // Ground: heightAt(x,z) -> top y, top(x,z,h) -> colour, side(x,z,y,h) -> colour.
  // Below waterLevel the gap is filled with water voxels.
  ground({ heightAt, top, side, bottom = -6, waterLevel = null, bed }) {
    this.waterLevel = waterLevel;
    for (let x = 0; x < this.size; x++) for (let z = 0; z < this.size; z++) {
      if (!this.inside(x, z)) continue;
      const h = Math.round(heightAt(x, z));
      for (let y = bottom; y <= h; y++) {
        const under = waterLevel !== null && h < waterLevel;
        let c;
        if (y === h) c = under && bed ? bed(x, z, h) : top(x, z, h);
        else c = side(x, z, y, h);
        this.set(x, y, z, c);
      }
      if (waterLevel !== null) for (let y = h + 1; y <= waterLevel; y++) this.water.set(this.key(x, y, z), 1);
      this.heights ??= new Map();
      this.heights.set(`${x},${z}`, h);
    }
  }

  groundY(x, z) { return this.heights?.get(`${x},${z}`) ?? 0; }

  render(scene) {
    const off = this.half;
    const solidGeo = bevelBox(1, 1, 1, 0.1);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const exposed = (map, x, y, z) =>
      [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(
        ([dx, dy, dz]) => !this.has(x + dx, y + dy, z + dz) || map === this.water,
      );

    const build = (map, geo, mat, colourOf, shadows = true) => {
      const list = [];
      for (const [k, c] of map) {
        const [x, y, z] = k.split(',').map(Number);
        if (map === this.water) {
          // Only water voxels on the surface or at the slab edge are drawn.
          const surface = !this.water.has(this.key(x, y + 1, z));
          const edge = !this.inside(x + 1, z) || !this.inside(x - 1, z) || !this.inside(x, z + 1) || !this.inside(x, z - 1);
          if (!surface && !edge) continue;
        } else if (map === this.mist) {
          // Only the outer shell of a mist cloud is drawn, so it stays soft.
          const inner = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
            .every(([dx, dy, dz]) => this.mist.has(this.key(x + dx, y + dy, z + dz)));
          if (inner) continue;
        } else if (!exposed(map, x, y, z)) continue;
        list.push([x, y, z, c]);
      }
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(list.length, 1));
      mesh.count = list.length;
      list.forEach(([x, y, z, c], i) => {
        m.makeTranslation(x - off + 0.5, y + 0.5, z - off + 0.5);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, colourOf(col, c, x, y, z));
      });
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      scene.add(mesh);
      return mesh;
    };

    const jitter = (target, c, x, y, z) =>
      target.set(c).multiplyScalar(0.93 + hash(x, y, z) * 0.12);

    build(this.solid, solidGeo, new THREE.MeshStandardMaterial({ roughness: 0.88 }), jitter);
    build(this.glow, solidGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), (t, c) => t.set(c), false);
    if (this.water.size) {
      build(this.water, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
        color: '#ffffff', transparent: true, opacity: 0.6, roughness: 0.2, depthWrite: false,
      }), (t, c, x, y, z) => t.set(this.waterColour ?? '#45b4d6').multiplyScalar(0.96 + hash(x, y, z) * 0.06), false);
    }
    if (this.mist.size) {
      const mistMat = new THREE.MeshStandardMaterial({
        color: '#ffffff', transparent: true, opacity: 0.3, roughness: 1, depthWrite: false,
      });
      build(this.mist, bevelBox(1, 1, 1, 0.3), mistMat,
        (t, c, x, y, z) => t.set(this.mistColour ?? '#eef1f4').multiplyScalar(0.95 + hash(x, y, z) * 0.05), false);
    }
  }
}

// ---------------------------------------------------------------------------
// Prefabs. Coordinates are voxel positions; y is the ground the thing stands on.

export function house(v, x, y, z, { w = 5, d = 5, h = 4, wall, roof, trim, roofType = 'gable', windows = '#2e2a33', door = '#6b4a2e', lit = false }) {
  v.box(x, y, z, x + w, y + h, z + d, wall);
  if (trim) {
    v.box(x, y, z, x + 1, y + h, z + 1, trim); v.box(x + w - 1, y, z, x + w, y + h, z + 1, trim);
    v.box(x, y, z + d - 1, x + 1, y + h, z + d, trim); v.box(x + w - 1, y, z + d - 1, x + w, y + h, z + d, trim);
  }
  // Windows on the two faces the camera sees (+x and +z), door on +z.
  const win = (wx, wy, wz) => (lit ? v.light(wx, wy, wz, '#ffd27a') : v.set(wx, wy, wz, windows));
  for (let i = 1; i < w - 1; i += 2) if (h > 2) win(x + i, y + h - 2, z + d - 1);
  for (let i = 1; i < d - 1; i += 2) if (h > 2) win(x + w - 1, y + h - 2, z + i);
  v.box(x + Math.floor(w / 2), y, z + d - 1, x + Math.floor(w / 2) + 1, y + 2, z + d, door);

  if (roofType === 'flat') {
    v.box(x, y + h, z, x + w, y + h + 1, z + d, roof);
    v.box(x + 1, y + h, z + 1, x + w - 1, y + h + 1, z + d - 1, wall);
  } else if (roofType === 'gable') {
    // Ridge runs along x; roof steps in from both z sides.
    for (let i = 0; i <= Math.ceil(d / 2); i++) {
      const z0 = z - 1 + i, z1 = z + d + 1 - i;
      if (z1 <= z0) break;
      v.box(x - 1, y + h + i, z0, x + w + 1, y + h + i + 1, z1, roof);
    }
  } else if (roofType === 'pyramid') {
    for (let i = 0; ; i++) {
      const x0 = x - 1 + i, x1 = x + w + 1 - i, z0 = z - 1 + i, z1 = z + d + 1 - i;
      if (x1 <= x0 || z1 <= z0) break;
      v.box(x0, y + h + i, z0, x1, y + h + i + 1, z1, roof);
    }
  }
}

export function tree(v, x, y, z, { leaf = '#5fae48', trunk = '#7a5636', size = 1 } = {}) {
  const t = 2 + size;
  v.box(x, y + 1, z, x + 1, y + 1 + t, z + 1, trunk);
  const r = 1 + size;
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = 0; dy <= r; dy++) {
    if (dx * dx + dz * dz + (dy - r / 2) ** 2 * 1.6 > r * r + 1) continue;
    v.set(x + dx, y + t + dy, z + dz, hash(x + dx, dy, z + dz) > 0.75 ? shade(leaf, 1.12) : leaf);
  }
}

export function pine(v, x, y, z, { leaf = '#2f6f4a', snow = false, height = 7 } = {}) {
  v.box(x, y + 1, z, x + 1, y + 3, z + 1, '#6b4a2e');
  for (let i = 0; i < height - 2; i++) {
    const r = Math.max(0, Math.floor((height - 2 - i) / 2));
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
      const top = snow && (i === height - 3 || (Math.abs(dx) + Math.abs(dz) === 0 && i > height - 5));
      v.set(x + dx, y + 3 + i, z + dz, top ? '#f4f7fa' : leaf);
    }
  }
}

export function palm(v, x, y, z, { lean = 1 } = {}) {
  for (let i = 1; i <= 7; i++) v.set(x + (i > 4 ? lean : 0), y + i, z, i % 2 ? '#9b7348' : '#87623b');
  const tx = x + lean, ty = y + 8, tz = z;
  v.set(tx, ty, tz, '#3f9d4c');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 1; i <= 3; i++) v.set(tx + dx * i, ty - (i > 2 ? 1 : 0), tz + dz * i, '#4fb35a');
  }
  v.set(tx, ty - 1, tz + 1, '#7a5a2a');
}

export function person(v, x, y, z, shirt = '#c9473d', { hat = null, skin = '#e9b98f' } = {}) {
  v.set(x, y + 1, z, '#3a3340');
  v.set(x, y + 2, z, shirt);
  v.set(x, y + 3, z, skin);
  if (hat) v.set(x, y + 4, z, hat);
}

export function boat(v, x, y, z, { length = 7, hull = '#8a5a34', sail = '#f4ecdc', axis = 'x', mast = true }) {
  const along = (i, j, k, c) => (axis === 'x' ? v.set(x + i, y + j, z + k, c) : v.set(x + k, y + j, z + i, c));
  for (let i = 0; i < length; i++) {
    const end = i === 0 || i === length - 1;
    for (let k = -1; k <= 1; k++) if (!(end && k !== 0)) along(i, 0, k, hull);
    if (!end) { along(i, 1, -1, hull); along(i, 1, 1, hull); }
  }
  along(0, 1, 0, hull); along(length - 1, 1, 0, hull);
  if (mast) {
    const mi = Math.floor(length / 2);
    for (let j = 1; j <= 7; j++) along(mi, j, 0, '#6b4a2e');
    for (let j = 3; j <= 7; j++) for (let k = -2; k <= 2; k++) if (!(j === 7 && Math.abs(k) === 2)) along(mi + 1, j, k, sail);
  }
}

export function flag(v, x, y, z, colour, { height = 4, width = 3 } = {}) {
  for (let j = 1; j <= height; j++) v.set(x, y + j, z, '#5b4a3a');
  for (let i = 1; i <= width; i++) for (let j = 0; j < 2; j++) v.set(x + i, y + height - j, z, colour);
}

export function shade(hex, f) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

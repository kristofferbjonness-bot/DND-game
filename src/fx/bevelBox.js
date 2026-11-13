import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

// A box with flat bevelled edges: 44 triangles, against 300 for a smoothly
// rounded box. It keeps the soft "toy block" highlight on every edge while
// being cheap enough to draw tens of thousands of times on a phone.
const cache = new Map();

// `open`: leave out the underside (for things the camera never sees from below).
export function bevelBox(w = 1, h = 1, d = 1, bevel = 0.08, { open = false } = {}) {
  const key = `${w},${h},${d},${bevel},${open}`;
  if (cache.has(key)) return cache.get(key);
  const b = Math.min(bevel, w / 2, h / 2, d / 2) * 0.999;
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(
      new THREE.Vector3(sx * hx, sy * (hy - b), sz * (hz - b)),
      new THREE.Vector3(sx * (hx - b), sy * hy, sz * (hz - b)),
      new THREE.Vector3(sx * (hx - b), sy * (hy - b), sz * hz),
    );
  }
  let geo = new ConvexGeometry(pts);
  geo.deleteAttribute('uv');
  if (open) geo = withoutUnderside(geo);
  geo.userData.shared = true; // cached: never dispose
  cache.set(key, geo);
  return geo;
}

// Drops the triangles that face downwards.
function withoutUnderside(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const keepP = [], keepN = [];
  for (let i = 0; i < pos.count; i += 3) {
    if ((nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3 < -0.1) continue;
    for (let j = i; j < i + 3; j++) {
      keepP.push(pos.getX(j), pos.getY(j), pos.getZ(j));
      keepN.push(nor.getX(j), nor.getY(j), nor.getZ(j));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
  return out;
}

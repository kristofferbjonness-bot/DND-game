import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

// A box with flat bevelled edges: 44 triangles, against 300 for a smoothly
// rounded box. It keeps the soft "toy block" highlight on every edge while
// being cheap enough to draw tens of thousands of times on a phone.
const cache = new Map();

export function bevelBox(w = 1, h = 1, d = 1, bevel = 0.08) {
  const key = `${w},${h},${d},${bevel}`;
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
  const geo = new ConvexGeometry(pts);
  geo.deleteAttribute('uv');
  cache.set(key, geo);
  return geo;
}

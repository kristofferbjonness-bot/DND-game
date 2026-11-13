// Merges every plain mesh under `root` that never moves into a single mesh
// coloured per vertex, so a whole set of small models costs one draw call
// instead of hundreds. Groups in `keep` (things that animate) are left as they are.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(root, { keep = [], roughness = 0.85 } = {}) {
  root.updateMatrixWorld(true);
  const kept = new Set(keep);
  const inKept = (o) => { for (let p = o; p; p = p.parent) if (kept.has(p)) return true; return false; };
  const parts = [], meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || inKept(o)) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(o.matrixWorld);
    const c = o.material.color;
    const n = g.attributes.position.count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colours.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    parts.push(g);
    meshes.push(o);
  });
  if (!parts.length) return null;
  for (const o of meshes) o.removeFromParent();
  const merged = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness }));
  merged.castShadow = true;
  merged.receiveShadow = true;
  for (const g of parts) g.dispose();
  return merged;
}

// Frees the GPU memory held by a finished 3D object: instance buffers, and
// geometries and materials that belong to it alone. Shared ones (the cached
// bevel boxes, the figures' common materials) are passed in `keep`.
export function disposeTree(root, keep = new Set()) {
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    if (o.geometry && !keep.has(o.geometry) && !o.geometry.userData.shared) o.geometry.dispose();
    for (const m of [].concat(o.material ?? [])) if (!keep.has(m) && !m.userData.shared) m.dispose();
  });
}

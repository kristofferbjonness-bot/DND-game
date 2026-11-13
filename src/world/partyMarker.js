// The party on the world map: small figures of the heroes standing together,
// with a name tag. The Dungeon Master moves them (see main.js).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildFigure } from '../character/model.js';
import { worldToCell, inBounds, WATER_LEVEL } from './grid.js';
import { surfaceY } from './terrain.js';
import { disposeTree } from '../fx/dispose.js';

const SCALE = 0.12; // a 24-voxel hero becomes about 3 map units tall

// Ground height at a map position (the sea surface over water).
export function groundAt(x, z) {
  const [cx, cz] = worldToCell(x, z);
  return inBounds(cx, cz) ? Math.max(surfaceY(cx, cz), WATER_LEVEL) : WATER_LEVEL;
}

export function createPartyMarker(scene, { onTap } = {}) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const crowd = new THREE.Group();
  group.add(crowd);

  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'label label--party';
  tag.textContent = 'The Party';
  tag.addEventListener('click', (e) => { e.stopPropagation(); onTap?.(); });
  tag.addEventListener('pointerdown', (e) => e.stopPropagation());
  const label = new CSS2DObject(tag);
  label.position.set(0, 0, 0); // drawn just below the party (see .label--party), clear of town names
  group.add(label);

  let figures = [], cast = '';

  return {
    // Rebuilds the little figures when the party or their gear changes.
    setHeroes(heroes) {
      const key = JSON.stringify(heroes.map((c) => [c.id, c.equipped, Boolean(c.figure)]));
      if (key === cast) return;
      cast = key;
      for (const old of [...crowd.children]) disposeTree(old);
      crowd.clear();
      figures = [];
      heroes.forEach((c, i) => {
        const f = buildFigure(c);
        if (!f) return;
        const holder = new THREE.Group();
        holder.add(f.group);
        holder.scale.setScalar(SCALE * (f.zoom > 1.1 ? 0.85 : 1));
        // A loose huddle facing the camera's usual direction.
        const a = (i / Math.max(1, heroes.length)) * Math.PI * 2 + 0.6;
        const r = heroes.length > 1 ? 1.1 : 0;
        holder.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.7);
        holder.rotation.y = 0.3 - a * 0.15;
        crowd.add(holder);
        figures.push(f);
      });
    },
    place(x, z) { group.position.set(x, groundAt(x, z), z); },
    show(on) { group.visible = on; tag.hidden = !on; },
    get position() { return group.position; },
    update(t) { if (group.visible) for (const f of figures) f.update(t); },
  };
}

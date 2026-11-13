// Small portraits of heroes and monsters, made from their 3D figures: a little
// offscreen render of head and shoulders. One shared renderer, made on first
// use; each picture is cached until the figure changes (new gear, a new look).
import * as THREE from 'three';
import { buildFigure, buildMonsterFigure } from '../character/model.js';
import { disposeTree } from '../fx/dispose.js';

const SIZE = 128;
let renderer = null, scene = null, camera = null, failed = false;
const cache = new Map();

function setup() {
  if (renderer || failed) return Boolean(renderer);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  } catch {
    failed = true;
    return false;
  }
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff3e2', '#6b5f72', 1.7));
  const key = new THREE.DirectionalLight('#ffe7c8', 2.6);
  key.position.set(-30, 40, 60);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9fc2ff', 1.4);
  rim.position.set(40, 20, -40);
  scene.add(rim);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  return true;
}

// Takes a picture of `object` and returns it as a data: URL ('' without 3D).
// `half`: half the height of the view; `center`: what to aim at; `dir`: where the camera is.
export function snapshot(object, { half, center, dir = [0.38, 0.22, 1], size = SIZE }) {
  if (!setup()) return '';
  if (renderer.domElement.width !== size) renderer.setSize(size, size, false);
  scene.add(object);
  Object.assign(camera, { left: -half, right: half, top: half, bottom: -half });
  camera.updateProjectionMatrix();
  camera.position.copy(center).addScaledVector(new THREE.Vector3(...dir).normalize(), 200);
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(object);
  return url;
}

// `crop`: how much of the figure, from the top, fills the picture (0.42 = head and shoulders).
function draw(figure, crop) {
  if (!figure || !setup()) return '';
  figure.update?.(0.4);
  const box = new THREE.Box3().setFromObject(figure.group);
  const size = box.getSize(new THREE.Vector3());
  const h = Math.max(size.y * crop, size.x * 0.75, 4);
  const center = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - h / 2 + h * 0.04, 0);
  const url = snapshot(figure.group, { half: h / 2, center });
  disposeTree(figure.group);
  return url;
}

// A hero's portrait (a data: URL), or '' if 3D is not available.
export function heroPortrait(c) {
  if (!c) return '';
  const key = `h|${c.id}|${c.colour}|${JSON.stringify(c.equipped ?? {})}|${c.figure ? JSON.stringify(c.figure).length : 0}`;
  if (!cache.has(key)) cache.set(key, draw(buildFigure(c), 0.42));
  return cache.get(key);
}

// A monster's portrait. `model` is its figure id (MONSTERS[id].model ?? id).
export function monsterPortrait(model, version = '') {
  const key = `m|${model}|${version}`;
  if (!cache.has(key)) cache.set(key, draw(buildMonsterFigure(model), 0.55));
  return cache.get(key);
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// An <img> for a portrait, falling back to the first letter on a coloured tile.
export function portraitImg(url, { name = '', colour = '#3a3145', cls = '' } = {}) {
  return url
    ? `<img class="portrait${cls ? ` ${cls}` : ''}" src="${url}" alt="" draggable="false" />`
    : `<span class="portrait portrait--letter${cls ? ` ${cls}` : ''}" style="background:${esc(colour)}">${esc(name[0] ?? '?')}</span>`;
}

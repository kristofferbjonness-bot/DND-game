// A small 3D stage that shows one character figure: soft light, a round voxel
// plinth, a gentle idle animation, and drag to turn the figure around.
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import { hash } from '../city/vox.js';
import { MODELS } from '../character/model.js';

const TOUCH = window.matchMedia('(pointer: coarse)').matches;

function plinth() {
  const group = new THREE.Group();
  const cells = [];
  const r = 6;
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
    const d = Math.hypot(x, z);
    if (d > r + 0.3) continue;
    cells.push([x, -1, z, d > r - 1.2 ? '#cdb592' : hash(x, z, 3) > 0.85 ? '#e2cfae' : '#e9dabb']);
    if (d > r - 1.2) cells.push([x, -2, z, '#b89d78']);
  }
  const mesh = new THREE.InstancedMesh(bevelBox(1, 1, 1, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.95 }), cells.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  cells.forEach(([x, y, z, col], i) => {
    mesh.setMatrixAt(i, m.makeTranslation(x, y + 0.5, z));
    mesh.setColorAt(i, c.set(col).multiplyScalar(0.96 + hash(x, y, z) * 0.06));
  });
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function createCharacterViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 400);
  scene.add(new THREE.HemisphereLight('#fff6ea', '#a99a8c', 1.6));
  const sun = new THREE.DirectionalLight('#ffe9cf', 2.4);
  sun.position.set(-18, 40, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 30, bottom: -6, near: 1, far: 120 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#c9d8ff', 0.8);
  rim.position.set(20, 18, -24);
  scene.add(rim);

  scene.add(plinth());
  const turntable = new THREE.Group();
  scene.add(turntable);
  let figure = null;

  function show(modelId) {
    if (figure) turntable.remove(figure.group);
    figure = MODELS[modelId]?.() ?? null;
    if (figure) turntable.add(figure.group);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Keep the whole figure in frame whatever the shape of the stage.
    const fit = Math.max(1, 0.75 / camera.aspect);
    camera.position.set(0, 30, 60 * fit);
    camera.lookAt(0, 10, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  // Drag to turn the figure; when left alone it sways back and forth.
  let base = -0.6, dragging = null, swayT = 0;
  container.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, base }; container.setPointerCapture(e.pointerId); });
  container.addEventListener('pointermove', (e) => { if (dragging) base = dragging.base + (e.clientX - dragging.x) * 0.012; });
  const release = () => { dragging = null; };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  const clock = new THREE.Clock();
  let running = false;
  const portraitPhone = window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 640px)');
  function frame() {
    if (portraitPhone.matches) return; // hidden behind the "turn sideways" screen
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!dragging) swayT += dt;
    turntable.rotation.y = base + Math.sin(swayT * 0.35) * 0.3;
    figure?.update(clock.elapsedTime);
    renderer.render(scene, camera);
  }

  return {
    show,
    start() { if (running) return; running = true; clock.getDelta(); resize(); renderer.setAnimationLoop(frame); },
    stop() { running = false; renderer.setAnimationLoop(null); },
  };
}

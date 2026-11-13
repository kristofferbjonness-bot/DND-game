// The 3D battlefield, seen from a little way off like a Pokémon battle: the
// heroes stand on the left, the enemies on the right, each on a round pad.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bevelBox } from '../fx/bevelBox.js';
import { hash } from '../city/vox.js';
import { buildFigure, buildMonsterFigure } from '../character/model.js';

const TOUCH = window.matchMedia('(pointer: coarse)').matches;

// Where fighters stand. Heroes are nearer the camera on the left, enemies
// further back on the right.
const HERO_SPOTS = [[-16, 12], [-30, 6], [-23, 20], [-37, 15]];
const ENEMY_SPOTS = [[18, -10], [32, -14], [25, -22], [39, -24], [12, -22], [44, -12]];

function arena() {
  const cells = [];
  const r = 50;
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
    const d = Math.hypot(x * 0.85, z);
    if (d > r) continue;
    const edge = d > r - 2;
    const h = edge ? -1 : 0;
    const n = hash(x, z, 11);
    const c = edge ? '#c9ae86' : n > 0.93 ? '#d7c19a' : n > 0.86 ? '#ecdcbc' : '#e4d0ab';
    cells.push([x, h - 1, z, c]);
    if (!edge && n > 0.985) cells.push([x, h, z, '#b8a383']); // a pebble
  }
  return voxels(cells);
}

// A round, slightly raised pad under each fighter.
function pad(r, colour) {
  const cells = [];
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
    if (Math.hypot(x, z) <= r + 0.3) cells.push([x, -1, z, Math.hypot(x, z) > r - 1 ? colour : '#f3e6cc']);
  }
  const g = voxels(cells);
  g.position.y = 0.35;
  g.scale.y = 0.4;
  return g;
}

function voxels(cells) {
  const mesh = new THREE.InstancedMesh(bevelBox(1, 1, 1, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.95 }), cells.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  cells.forEach(([x, y, z, c], i) => {
    mesh.setMatrixAt(i, m.makeTranslation(x, y + 0.5, z));
    mesh.setColorAt(i, col.set(c).multiplyScalar(0.96 + hash(x, y, z) * 0.06));
  });
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

export function createBattleScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
  scene.add(new THREE.HemisphereLight('#fff6ea', '#a99a8c', 1.5));
  const sun = new THREE.DirectionalLight('#ffe9cf', 2.4);
  sun.position.set(-30, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 55, bottom: -55, near: 1, far: 250 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 4;
  scene.add(sun);
  scene.add(arena());

  const fighters = new THREE.Group();
  scene.add(fighters);
  let actors = []; // { key, group, figure, down, flash }

  function place(figure, [x, z], facing, padColour, key) {
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.add(pad(4, padColour));
    const body = new THREE.Group();
    body.add(figure.group);
    body.rotation.y = Math.atan2(facing.x - x, facing.z - z);
    holder.add(body);
    fighters.add(holder);
    const height = new THREE.Box3().setFromObject(figure.group).max.y;
    actors.push({ key, holder, body, figure, height, down: 0, isDown: false, shake: 0 });
  }

  // heroes: character objects; enemies: [{ uid, type }].
  function setFighters(heroes, enemies) {
    fighters.clear();
    actors = [];
    setActive(null);
    if (camera.userData.sized) resetView();
    const heroCentre = { x: -25, z: 12 }, enemyCentre = { x: 28, z: -16 };
    heroes.forEach((c, i) => {
      const figure = buildFigure(c);
      if (figure) place(figure, HERO_SPOTS[i % HERO_SPOTS.length], enemyCentre, '#9fb6d6', `hero:${c.id}`);
    });
    enemies.forEach((e, i) => {
      const figure = buildMonsterFigure(e.model);
      if (figure) place(figure, ENEMY_SPOTS[i % ENEMY_SPOTS.length], heroCentre, '#d6a49f', `enemy:${e.uid}`);
    });
  }

  // Knocked out (0 HP) fighters fall over; a hit makes them shake.
  function setDown(key, isDown) {
    const a = actors.find((x) => x.key === key);
    if (a) a.isDown = isDown;
  }
  // A gold diamond bobbing above whoever's turn it is.
  const marker = new THREE.Group();
  {
    const cells = [];
    for (let y = -2; y <= 2; y++) {
      const r = 2 - Math.abs(y);
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (Math.abs(x) + Math.abs(z) <= r) cells.push([x, y, z, '#f2c94c']);
    }
    const mesh = new THREE.InstancedMesh(bevelBox(1, 1, 1, 0.15), new THREE.MeshBasicMaterial({ toneMapped: false }), cells.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    cells.forEach(([x, y, z, c], i) => { mesh.setMatrixAt(i, m.makeTranslation(x, y, z)); mesh.setColorAt(i, col.set(c)); });
    marker.add(mesh);
    marker.scale.setScalar(0.7);
    marker.visible = false;
    scene.add(marker);
  }
  let active = null;
  function setActive(key) {
    active = actors.find((x) => x.key === key) ?? null;
    marker.visible = Boolean(active);
  }

  function hit(key) {
    const a = actors.find((x) => x.key === key);
    if (a) a.shake = 0.35;
  }

  // Look around: drag (one finger) to turn, pinch or scroll to zoom,
  // right-drag (two fingers) to move. The view resets for each new encounter.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 40;
  controls.maxDistance = 260;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.35;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  function resetView() {
    const fit = Math.max(1, 2 / (camera.aspect || 1));
    controls.target.set(2, 2, -2);
    camera.position.set(-6 * fit, 62 * fit, 128 * fit);
    controls.update();
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const first = !camera.userData.sized;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (first) { camera.userData.sized = true; resetView(); }
  }
  new ResizeObserver(resize).observe(container);

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    controls.update();
    const t = clock.elapsedTime;
    for (const a of actors) {
      if (!a.isDown) a.figure.update(t);
      a.down += ((a.isDown ? 1 : 0) - a.down) * Math.min(1, dt * 6);
      a.body.rotation.z = a.down * 1.45;
      a.body.position.y = a.down * 1.5;
      a.shake = Math.max(0, a.shake - dt);
      a.body.position.x = Math.sin(t * 60) * a.shake * 1.5;
    }
    if (active) {
      marker.position.set(active.holder.position.x, active.height + 5 + Math.sin(t * 3) * 0.8, active.holder.position.z);
      marker.rotation.y = t * 1.5;
    }
    renderer.render(scene, camera);
  }

  return {
    setFighters, setDown, hit, setActive,
    start() { clock.getDelta(); resize(); renderer.setAnimationLoop(frame); },
    stop() { renderer.setAnimationLoop(null); },
  };
}

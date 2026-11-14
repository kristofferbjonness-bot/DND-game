// The 3D scene: one of the areas (areas.js) with the heroes standing in a row at the front and
// the people of the scene further in, facing them. Name tags float over every figure; tapping a
// figure calls `onPick(key)`. Drag to look around, pinch or scroll to zoom.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFigure, buildMonsterFigure } from '../character/model.js';
import { disposeTree } from '../fx/dispose.js';
import { AREAS, SCALE, SIZE } from './areas.js';

const TOUCH = window.matchMedia('(pointer: coarse)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const world = ([x, z]) => [(x - SIZE / 2 + 0.5) * SCALE, (z - SIZE / 2 + 0.5) * SCALE];
const GROUND = SCALE; // figures stand on the top of the ground voxels

export function createSceneView(container, { onPick } = {}) {
  const tags = document.createElement('div');
  tags.className = 'scene-tags';
  container.appendChild(tags);

  let renderer = null, controls = null, touching = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 900);
  const hemi = new THREE.HemisphereLight('#fff6ea', '#a99a8c', 1.4);
  const sun = new THREE.DirectionalLight('#ffe9cf', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 400 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(hemi, sun, sun.target);

  let areaId = null, areaGroup = null;
  const people = new THREE.Group();
  scene.add(people);
  let actors = []; // { key, name, group, figure, height, tag }

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.insertBefore(renderer.domElement, tags);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 50;
    controls.maxDistance = 320;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = 1.38;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    let down = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { touching = true; down = [e.clientX, e.clientY]; });
    window.addEventListener('pointerup', (e) => {
      touching = false;
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6 && e.target === renderer.domElement) pick(e);
      down = null;
    });
  }

  function setArea(id) {
    if (id === areaId) return;
    areaId = id;
    if (areaGroup) { disposeTree(areaGroup); scene.remove(areaGroup); }
    const area = (AREAS[id] ?? AREAS.port).build();
    areaGroup = new THREE.Group();
    area.v.render(areaGroup);
    areaGroup.scale.setScalar(SCALE);
    scene.add(areaGroup);
    const m = area.mood;
    container.style.background = m.bg;
    hemi.color.set(m.sky); hemi.groundColor.set(m.ground); hemi.intensity = m.hemi;
    sun.color.set(m.sun); sun.intensity = m.sunPower; sun.position.set(...m.sunAt).multiplyScalar(2);
    if (renderer) renderer.toneMappingExposure = m.exposure;
    current = area;
  }
  let current = null;

  function place(figure, spot, face, key, name, kind) {
    const [x, z] = world(spot);
    const holder = new THREE.Group();
    holder.position.set(x, GROUND, z);
    holder.add(figure.group);
    holder.rotation.y = Math.atan2(face[0] - x, face[1] - z);
    holder.userData.key = key;
    people.add(holder);
    const height = new THREE.Box3().setFromObject(figure.group).max.y;
    const tag = document.createElement('span');
    tag.className = `scene-tag scene-tag--${kind}`;
    tag.innerHTML = esc(name);
    tag.dataset.key = key;
    tags.appendChild(tag);
    actors.push({ key, group: holder, figure, height, tag });
  }

  // heroes: character objects; npcs: [{ key, name, model }].
  function setPeople(heroes, npcs) {
    for (const old of [...people.children]) disposeTree(old);
    people.clear();
    tags.innerHTML = '';
    actors = [];
    if (!current) return;
    const heroSpots = current.heroSpots, npcSpots = current.npcSpots;
    const centre = (spots, n) => {
      const pts = spots.slice(0, Math.max(1, n)).map(world);
      return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    };
    const heroMid = centre(heroSpots, heroes.length), npcMid = centre(npcSpots, npcs.length);
    heroes.forEach((c, i) => {
      const f = buildFigure(c);
      if (f) place(f, heroSpots[i % heroSpots.length], npcs.length ? npcMid : [heroMid[0], heroMid[1] - 40], `hero:${c.id}`, c.name, 'hero');
    });
    npcs.forEach((n, i) => {
      const f = buildMonsterFigure(n.model);
      if (f) place(f, npcSpots[i % npcSpots.length], heroes.length ? heroMid : [npcMid[0], npcMid[1] + 40], n.key, n.name, 'npc');
    });
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(people.children, true)[0];
    let o = hit?.object;
    while (o && !o.userData.key) o = o.parent;
    if (o) onPick?.(o.userData.key);
  }
  tags.addEventListener('click', (e) => { const t = e.target.closest('.scene-tag'); if (t) onPick?.(t.dataset.key); });

  function resetView() {
    const wide = camera.aspect >= 0.8;
    controls.target.set(0, 12, 4);
    const d = wide ? (container.clientHeight < 500 ? 150 : 225) : 225 * Math.min(1.5, 0.75 / camera.aspect);
    camera.position.set(0, d * 0.55, 4 + d * 0.84);
    controls.update();
  }
  // Keeps the middle of the picture clear of a panel `inset` px wide on the right.
  let inset = 0;
  function applyInset() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    if (inset) camera.setViewOffset(w, h, inset / 2, 0, w, h); else camera.clearViewOffset();
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h || !renderer) return;
    renderer.setSize(w, h);
    const turned = camera.userData.sized && (camera.aspect >= 0.8) !== (w / h >= 0.8);
    camera.aspect = w / h;
    applyInset();
    camera.updateProjectionMatrix();
    if (!camera.userData.sized || turned) { camera.userData.sized = true; resetView(); }
  }
  new ResizeObserver(resize).observe(container);

  const clock = new THREE.Clock(), v = new THREE.Vector3();
  let lastDraw = 0;
  function frame(now) {
    if (!touching && now - lastDraw < 31) return; // 30 frames a second unless moving the view
    lastDraw = now;
    controls.update();
    const t = clock.getElapsedTime();
    const w = container.clientWidth, h = container.clientHeight;
    for (const a of actors) {
      a.figure.update?.(t);
      v.set(a.group.position.x, a.group.position.y + a.height + 3, a.group.position.z).project(camera);
      const hidden = v.z > 1;
      a.tag.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      a.tag.hidden = hidden;
    }
    renderer.render(scene, camera);
  }

  return {
    // { area, heroes, npcs }: shows a scene (rebuilding only what changed).
    show({ area, heroes, npcs }) { setArea(area); setPeople(heroes, npcs); },
    clear() { for (const old of [...people.children]) disposeTree(old); people.clear(); tags.innerHTML = ''; actors = []; },
    resetView() { if (controls) resetView(); },
    // The DM's panel covers `px` on the right: centre the picture in what is left.
    setInset(px) { if (px === inset) return; inset = px; applyInset(); camera.updateProjectionMatrix(); },
    start() {
      ensureRenderer();
      if (current) renderer.toneMappingExposure = current.mood.exposure;
      clock.getDelta(); resize(); renderer.setAnimationLoop(frame);
    },
    stop() { renderer?.setAnimationLoop(null); },
  };
}

import * as THREE from 'three';
import './character/npcFigures.js'; // registers the NPC figures before anything builds them
import { MapControls } from 'three/addons/controls/MapControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { grid, WATER_LEVEL, pixelToCell, nearestLand, cellToWorld, PEAKS, hash as cellHash } from './world/grid.js';
import { buildTerrain, surfaceY } from './world/terrain.js';
import { buildPlants, buildClouds } from './world/scatter.js';
import { buildLandmark, buildTine } from './world/landmarks.js';
import { buildAnimals } from './world/animals.js';
import { MINE, BRIDGE, crossings, road } from './world/roads.js';
import { buildLighthouse, buildShadowMist, buildCabin, buildBridge, buildVolcanoSparks, buildCloudCap, buildMountainMist, buildMine, buildYurtCamp, buildDesertCamp, buildGibbet, buildBrokenStatue, buildShrine, buildLift } from './world/features.js';
import { LOCATIONS } from './world/locations.js';
import { CITIES } from './city/cities.js';
import { createTiltShiftPasses } from './fx/tiltShift.js';
import { mergeStatic } from './fx/mergeStatic.js';
import { createAtmosphere, DEFAULT_SKY } from './world/atmosphere.js';
import { createSkyPanel } from './world/skyPanel.js';
import { createPartyMarker, groundAt } from './world/partyMarker.js';
import { attachTouchGestures } from './fx/touchGestures.js';
import { createStatusScreen } from './status/statusScreen.js';
import { renderParty } from './status/partyScreen.js';
import { createCombatScreen } from './combat/combatScreen.js';
import { createCombatView } from './combat/combatView.js';
import { MONSTERS, addMonster, removeMonster } from './data/monsters.js';
import { registerRecipe } from './character/model.js';
import { CHARACTERS as STARTING_HEROES } from './data/characters.js';
import { createStartScreen } from './start/startScreen.js';
import { createCreatorScreen } from './creator/creatorScreen.js';
import { createRulebook } from './rulebook/rulebook.js';
import { createJournalScreen } from './journal/journalScreen.js';
import { createSceneScreen } from './scene/sceneScreen.js';
import { registerArea, unregisterArea } from './scene/areas.js';
import { createDiceTray } from './dice/diceTray.js';
import { createHeroManager } from './status/heroManager.js';
import { shortRest, longRest, readyToLevel } from './character/progress.js';
import { icon } from './ui/icons.js';
import { heroPortrait, portraitImg } from './ui/portraits.js';
import { loadRevealed, setRevealed, watchRevealed, loadWorld, saveWorld, watchWorld, loadEncounter, saveEncounter, loadRolls, addRoll, clearRolls, watchRolls, loadQuests, saveQuest, deleteQuest, watchQuests } from './net/backend.js';
import { supabase, myProfile, loadCharacters, seedCharacters, saveCharacter, deleteCharacter, watchCharacters, signOut, explain, encounterChannel, presenceChannel, loadMonsters, watchMonsters } from './net/backend.js';
import './style.css';

// The app shows one "view" at a time: the world map, or a city map. Each view
// has its own scene, camera, controls and named places; the renderer, labels
// layer, info panel and keyboard handling are shared.

// --- Shared renderer -----------------------------------------------------------
const app = document.getElementById('app');
// Phones and tablets get a lighter setup so the map stays smooth.
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('is-touch', TOUCH);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// The land never moves, so shadows are only recalculated when something does
// (see `shadowEvery` on a view) instead of every frame.
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

let labelScale = '', labelKey = ''; // see updateLabels
let lastActive = 0; // when the map last moved or was touched (see the loop)
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
app.appendChild(labelRenderer.domElement);

// Returns the lights, so the weather and time of day can change them.
function addSun(scene, { color = '#fff0d4', intensity = 2.3, position = [-70, 110, 50], extent = 130, hemi = 1.5 }) {
  const hemiLight = new THREE.HemisphereLight('#fff7e8', '#8d7c62', hemi);
  scene.add(hemiLight);
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.set(...position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(TOUCH ? 2048 : 4096, TOUCH ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent * 0.8, bottom: -extent * 0.8, near: 10, far: 450 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);
  return { sun, hemi: hemiLight };
}

function makeControls(camera, { min, max }) {
  const c = new MapControls(camera, labelRenderer.domElement);
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.screenSpacePanning = false;
  c.minDistance = min;
  c.maxDistance = max;
  c.minPolarAngle = 0.35;
  c.maxPolarAngle = 1.15;
  c.zoomToCursor = true;
  c.touches.TWO = null; // two-finger twist/pinch/tilt is handled in touchGestures.js
  c.enabled = false;
  c.addEventListener('start', () => { flight = null; });
  return c;
}

// Labels for a view's places. `labelHeight` says how far above the ground.
function addLabels(view, labelHeight) {
  for (const p of view.places) {
    const el = document.createElement('button');
    el.className = `label label--${p.tier}`;
    el.type = 'button';
    el.textContent = p.name;
    el.style.display = 'none';
    if (p.tier === 'unnamed') el.title = 'Unnamed place on your map';
    el.addEventListener('click', (e) => { e.stopPropagation(); select(p); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const obj = new CSS2DObject(el);
    obj.position.set(p.x, p.ground + labelHeight(p), p.z);
    view.scene.add(obj);
    p.label = el;
  }
}

// --- World view ------------------------------------------------------------------
function buildWorldView() {
  const scene = new THREE.Scene();
  const lights = addSun(scene, { extent: grid.cols * 0.62 });
  const terrain = buildTerrain();
  scene.add(terrain);

  const places = LOCATIONS.map((loc) => {
    let [cx, cz] = pixelToCell(loc.px);
    const hasTown = loc.tier === 'city' || loc.tier === 'local' || loc.tier === 'unnamed';
    if (hasTown) [cx, cz] = nearestLand(cx, cz);
    const [x, z] = cellToWorld(cx, cz);
    const ground = loc.tier === 'water' ? WATER_LEVEL : surfaceY(cx, cz);
    return { ...loc, cx, cz, x, z, ground, hasTown };
  });
  const towns = places.filter((p) => p.hasTown);
  // Where the extra features stand (cells): the old cabin deep in Sortland's dark forest, and a
  // bridge over the river that runs out of the mountains east of Ytterhavn.
  const sortCell = places.find((p) => p.id === 'sortland') ? nearestLand(...pixelToCell(places.find((p) => p.id === 'sortland').px)) : null;
  // Horse nomads on Lama's east side by the Strait of Skinder; desert nomads in Rama's desert.
  const NOMADS = [[90, 90], [86, 80]].map(([x, z]) => nearestLand(x, z));
  const DESERT = (() => {
    const out = [];
    for (let z = 90; z < grid.rows - 4 && out.length < 3; z += 3) for (let x = 115; x < grid.cols - 4 && out.length < 3; x += 3) {
      const k = z * grid.cols + x;
      if (!grid.land[k] || grid.biome[k] !== 3 || grid.heights[k] < 1 || grid.heights[k] > 5 || cellHash(x, z, 103) < 0.75) continue;
      let flatHere = true;
      for (let dz = -2; dz <= 2 && flatHere; dz++) for (let dx = -2; dx <= 2; dx++) { const j = (z + dz) * grid.cols + x + dx; if (!grid.land[j] || Math.abs(grid.heights[j] - grid.heights[k]) > 1) { flatHere = false; break; } }
      if (!flatHere || towns.some((p) => Math.hypot(p.cx - x, p.cz - z) < 12) || out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 22)) continue;
      out.push([x, z]);
    }
    return out;
  })();
  const clear = [...(sortCell ? [[sortCell[0], sortCell[1], 2]] : []), [BRIDGE.cx, BRIDGE.from, 0], [BRIDGE.cx, BRIDGE.to, 0],
    [MINE.cx, MINE.cz, 2], ...NOMADS.map(([x, z]) => [x, z, 3]), ...DESERT.map(([x, z]) => [x, z, 3])];
  const reach = (p) => (p.style === 'empire' ? 7 : 3); // how far a town keeps trees away
  const plants = buildPlants((x, z) => towns.some((p) => Math.abs(p.cx - x) <= reach(p) && Math.abs(p.cz - z) <= reach(p))
    || clear.some(([cx, cz, r]) => Math.abs(cx - x) <= r && Math.abs(cz - z) <= r));
  scene.add(plants);
  const animals = buildAnimals((x, z) => towns.some((p) => Math.abs(p.cx - x) <= 4 && Math.abs(p.cz - z) <= 4) || clear.some(([cx, cz, r]) => Math.abs(cx - x) <= r + 1 && Math.abs(cz - z) <= r + 1),
    [...NOMADS.map(([x, z]) => ({ kind: 'horse', cell: [x + 4, z + 1] })), ...DESERT.map(([x, z]) => ({ kind: 'camel', cell: [x + 3, z + 2] }))]);
  scene.add(animals);
  const clouds = buildClouds();
  scene.add(clouds);
  const atmosphere = createAtmosphere(scene, { lights, daySky: '#cfe9f0', fog: [160, 620], clouds, touch: TOUCH });

  // All the little towns become one mesh (windmill sails keep turning on their own).
  const spinners = [];
  const townGroup = new THREE.Group();
  for (const p of towns) {
    if (p.style === 'empire') { // Tine is built to fit its land, round the Strait of Skinder
      townGroup.add(buildTine({
        cx: 110, cz: 73, r: 6.5, keep: [114, 75], cathedral: [104, 72], bridges: [[73, 107, 110], [70, 109, 114]],
        at: (x, z) => { const k = z * grid.cols + x; return { dry: Boolean(grid.land[k]) && !grid.river[k] && grid.heights[k] <= 6, y: surfaceY(x, z) }; },
        toWorld: cellToWorld,
        skip: (x, z) => road[z * grid.cols + x] > 0 && Math.hypot(x - 112, z - 73) > 2,
      }));
      continue;
    }
    const town = buildLandmark(p.style);
    town.scale.setScalar(p.style === 'empire' ? 1.6 : p.tier === 'city' ? 1.5 : 1.2);
    town.position.set(p.x, p.ground, p.z);
    townGroup.add(town);
    if (town.userData.spin) spinners.push(town.userData.spin);
  }
  const mergedTowns = mergeStatic(townGroup, { keep: spinners });
  if (mergedTowns) scene.add(mergedTowns);
  scene.add(townGroup); // what is left: the turning sails

  // A lighthouse on a rock in Siri's Gap, and the shadowy mist over Sortland.
  const features = [];
  const gap = places.find((p) => p.id === 'siris-gap');
  if (gap) { const lh = buildLighthouse(); lh.position.set(gap.x, WATER_LEVEL, gap.z); lh.scale.setScalar(1.2); scene.add(lh); features.push(lh); }
  const sortland = places.find((p) => p.id === 'sortland');
  if (sortland) { const mist = buildShadowMist(9); mist.position.set(sortland.x, sortland.ground, sortland.z); scene.add(mist); features.push(mist); }
  if (sortCell) {
    const cabin = buildCabin();
    const [x, z] = cellToWorld(...sortCell);
    cabin.position.set(x, surfaceY(...sortCell), z);
    cabin.rotation.y = 0.5;
    cabin.scale.setScalar(1.7);
    scene.add(cabin);
  }
  // The mine, facing Bartedalen; the nomads' camps; plank bridges where a road fords a river.
  {
    const mine = buildMine();
    const [x, z] = cellToWorld(MINE.cx, MINE.cz);
    mine.position.set(x, surfaceY(MINE.cx, MINE.cz), z);
    mine.rotation.y = Math.atan2(MINE.face[0], MINE.face[1]);
    mine.scale.setScalar(1.7);
    scene.add(mine); features.push(mine);
  }
  for (const [cx, cz] of NOMADS) { const camp = buildYurtCamp(5); const [x, z] = cellToWorld(cx, cz); camp.position.set(x, surfaceY(cx, cz), z); camp.scale.setScalar(1.7); scene.add(camp); }
  for (const [cx, cz] of DESERT) { const camp = buildDesertCamp(3); const [x, z] = cellToWorld(cx, cz); camp.position.set(x, surfaceY(cx, cz), z); camp.rotation.y = cellHash(cx, cz, 104) * 6; camp.scale.setScalar(1.5); scene.add(camp); }
  for (const [cx, cz, alongX] of crossings) {
    const b = buildBridge(1.6);
    const [x, z] = cellToWorld(cx, cz);
    b.position.set(x, surfaceY(cx, cz) + 0.35, z);
    if (alongX) b.rotation.y = Math.PI / 2;
    scene.add(b);
  }
  // The volcano smokes from its lava crater; the ice mountain's summit is lost in cloud.
  for (const p of PEAKS) {
    const [x, z] = cellToWorld(p.cx, p.cz);
    if (p.kind === 'volcano') {
      const sparks = buildVolcanoSparks({ crater: p.crater * 0.8 });
      sparks.position.set(x, surfaceY(p.cx, p.cz), z);
      scene.add(sparks); features.push(sparks);
      const haze = buildCloudCap(5, 4, { opacity: 0.55 }); // smoke and haze hanging round the top
      haze.position.set(x, surfaceY(p.cx, p.cz) + 1, z);
      haze.children.forEach((c) => c.material.color.set('#b8b2ac'));
      scene.add(haze); features.push(haze);
    } else {
      const cap = buildCloudCap(8, 8);
      cap.position.set(x, surfaceY(p.cx, p.cz) - 3, z);
      scene.add(cap); features.push(cap);
    }
  }
  // Haze only over the densest mountain ranges: a puff (about one per 8×8 cells) where a 7×7 patch is almost all high peaks.
  {
    const spots = [];
    for (let cz = 2; cz < grid.rows; cz += 8) for (let cx = 2; cx < grid.cols; cx += 8) {
      const jx = cx + Math.floor(cellHash(cx, cz, 64) * 4) - 2, jz = cz + Math.floor(cellHash(cx, cz, 65) * 4) - 2;
      const k = jz * grid.cols + jx;
      if (jx < 3 || jz < 3 || jx >= grid.cols - 3 || jz >= grid.rows - 3 || !grid.land[k] || grid.heights[k] < 13) continue;
      let high = 0;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (grid.heights[(jz + dz) * grid.cols + jx + dx] >= 12) high++;
      if (high < 40) continue;
      const [x, z] = cellToWorld(jx, jz);
      spots.push([x, surfaceY(jx, jz) + 0.8 + cellHash(cx, cz, 66) * 1.5, z]);
    }
    if (spots.length) { const mist = buildMountainMist(spots); scene.add(mist); features.push(mist); }
  }
  const sirivik = places.find((p) => p.id === 'sirivik');
  // Round Sirivik: cages at the cliff edge, rune stones, a broken statue, a shrine, the lift.
  if (sirivik) {
    const put = (obj, dx, dz, rot = 0, scale = 1.3) => {
      const [cx, cz] = nearestLand(sirivik.cx + dx, sirivik.cz + dz, 3);
      const [x, z] = cellToWorld(cx, cz);
      obj.position.set(x, surfaceY(cx, cz), z); obj.rotation.y = rot; obj.scale.setScalar(scale);
      scene.add(obj);
    };
    // The cliff edge: the land cells next to the water nearest the town.
    const edge = [];
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const x = sirivik.cx + dx, z = sirivik.cz + dz, k = z * grid.cols + x;
      if (!grid.land[k] || grid.river[k]) continue;
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([ax, az]) => !grid.land[(z + az) * grid.cols + x + ax] || grid.river[(z + az) * grid.cols + x + ax]);
      if (wet) edge.push([dx, dz, Math.atan2(wet[0], wet[1]), Math.hypot(dx, dz)]);
    }
    edge.sort((a, b) => a[3] - b[3]);
    edge.slice(0, 2).forEach(([dx, dz, rot]) => put(buildGibbet(), dx, dz, rot - Math.PI / 2));
    if (edge[3]) { const [dx, dz, rot] = edge[3]; put(buildLift(1.6), dx, dz, rot); }
    put(buildBrokenStatue(), -1, -3, 0.5);
    put(buildShrine(), 1, 3, -0.3);
  }
  if (sirivik) { const fog = buildShadowMist(5, { grey: true }); fog.position.set(sirivik.x, sirivik.ground, sirivik.z); scene.add(fog); features.push(fog); }
  {
    const [x, z0] = cellToWorld(BRIDGE.cx, BRIDGE.from), [, z1] = cellToWorld(BRIDGE.cx, BRIDGE.to);
    const bridge = buildBridge(z1 - z0 + 1.2);
    bridge.position.set(x, Math.max(surfaceY(BRIDGE.cx, BRIDGE.from), surfaceY(BRIDGE.cx, BRIDGE.to)) + 0.08, (z0 + z1) / 2);
    scene.add(bridge);
  }

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1200);
  const view = {
    id: 'world',
    title: 'World Map',
    scene, camera, places, atmosphere, animals,
    controls: makeControls(camera, { min: 18, max: 420 }),
    start: { target: new THREE.Vector3(0, 0, 8), offset: new THREE.Vector3(0, 175, 120) },
    bounds: [grid.cols / 2, grid.rows / 2],
    focusDistance: (p) => ({ continent: 200, region: 70, water: 60 }[p.tier] ?? 38),
    listTiers: ['city', 'local', 'region', 'water', 'continent'],
    shadowEvery: TOUCH ? 8 : 4, // drifting clouds cast shadows
    update(dt) {
      terrain.userData.lod(camera);
      plants.userData.lod(camera.position.distanceTo(view.controls.target));
      clouds.userData.update(dt);
      for (const s of spinners) s.rotation.z += dt * 1.6;
      for (const f of features) f.userData.update(dt);
      animals.userData.update(dt, camera.position.distanceTo(view.controls.target));
    },
    // Zoomed out you see the continents and main cities; smaller places,
    // mountains and seas appear as you zoom in on an area.
    labelVisible(p, dist) {
      switch (p.tier) {
        case 'continent': return dist > 120;
        case 'city': return true;
        case 'region': return dist < 140;
        case 'water': return dist < 100;
        case 'unnamed': return dist < 70;
        default: return dist < 110;
      }
    },
  };
  addLabels(view, (p) => ({ continent: 14, city: 4.2, local: 3.4, unnamed: 2.6, region: 4, water: 0.6 }[p.tier]));
  return view;
}

// --- City views (built the first time they are opened) --------------------------------
function buildCityView(id) {
  const def = CITIES[id];
  const { vox, places: raw, size } = def.build();
  const scene = new THREE.Scene();
  const lights = addSun(scene, { ...def.sun, extent: size * 0.75 });
  const atmosphere = createAtmosphere(scene, { lights, daySky: def.sky, fog: [160, 560], touch: TOUCH });
  const lod = vox.render(scene);

  // Voxel positions -> world positions (the slab is centred on the origin).
  const half = size / 2;
  const places = raw.map((p) => ({
    ...p, x: p.pos[0] - half + 0.5, ground: p.pos[1], z: p.pos[2] - half + 0.5,
  }));

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1200);
  const view = {
    id,
    title: def.name,
    scene, camera, places, atmosphere,
    controls: makeControls(camera, { min: 14, max: 360 }),
    start: { target: new THREE.Vector3(4, 6, 4), offset: new THREE.Vector3(70, 105, 95) },
    bounds: [half, half],
    focusDistance: (p) => (p.tier === 'district' ? 60 : 46),
    listTiers: ['district', 'spot'],
    update() { lod(camera.position.distanceTo(view.controls.target)); },
    labelVisible: (p, dist) => p.tier === 'district' || dist < 170,
  };
  addLabels(view, () => 2.5);
  return view;
}

// --- Switching views ------------------------------------------------------------------
const views = { world: buildWorldView() };
let view = null;

function show(next, { at } = {}) {
  if (view) {
    view.controls.enabled = false;
    for (const p of view.places) p.label.style.display = 'none';
  }
  select(null);
  flight = null;
  renderer.shadowMap.needsUpdate = true;
  view = next;
  view.controls.enabled = true;
  renderPass.scene = view.scene;
  renderPass.camera = view.camera;
  viewTitle.textContent = view.title;
  backButton.hidden = view.id === 'world';
  openPlaces(false);
  buildPlacesList();
  resize();
  if (at) {
    view.controls.target.copy(at.target);
    view.camera.position.copy(at.target).add(at.offset);
  } else if (!view.visited) {
    view.controls.target.copy(view.start.target);
    view.camera.position.copy(view.start.target).add(startOffset(view));
  }
  view.visited = true;
}

// Tall phone screens see less from side to side, so the opening view steps
// back further to keep the whole map in frame.
function fitScale(v) {
  return v.id === 'world'
    ? THREE.MathUtils.clamp(0.8 / v.camera.aspect, 1, 1.9)
    : THREE.MathUtils.clamp(1 / v.camera.aspect, 1, 1.8);
}
function startOffset(v) {
  return v.start.offset.clone().multiplyScalar(fitScale(v));
}

function openCity(id) {
  views[id] ??= buildCityView(id);
  show(views[id]);
}

function backToWorld() {
  const fromCity = view.id;
  show(views.world);
  const city = views.world.places.find((p) => p.cityMap === fromCity);
  if (city) select(city);
}

// --- Keyboard: WASD / arrows pan, Q/E turn, +/- zoom ------------------------------------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  keys.add(e.key.toLowerCase());
  if (e.key === 'Escape') select(null);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function applyKeys(dt) {
  if (!keys.size) return;
  const { camera, controls } = view;
  const dist = camera.position.distanceTo(controls.target);
  const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const move = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) move.add(fwd);
  if (keys.has('s') || keys.has('arrowdown')) move.sub(fwd);
  if (keys.has('d') || keys.has('arrowright')) move.add(right);
  if (keys.has('a') || keys.has('arrowleft')) move.sub(right);
  if (move.lengthSq()) {
    move.normalize().multiplyScalar(dist * 0.9 * dt);
    controls.target.add(move);
    camera.position.add(move);
    flight = null;
  }
  const turn = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
  const zoom = (keys.has('-') || keys.has('_') ? 1 : 0) - (keys.has('=') || keys.has('+') ? 1 : 0);
  if (turn || zoom) {
    const off = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (turn) off.applyAxisAngle(camera.up, -turn * 1.4 * dt);
    if (zoom) off.multiplyScalar(1 + zoom * 1.2 * dt);
    off.clampLength(controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(off);
    flight = null;
  }
}

function clampTarget() {
  const { controls, camera, bounds: [hw, hh] } = view;
  const t = controls.target;
  const dx = THREE.MathUtils.clamp(t.x, -hw, hw) - t.x;
  const dz = THREE.MathUtils.clamp(t.z, -hh, hh) - t.z;
  if (dx || dz) { t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
}

// --- Flying the camera ---------------------------------------------------------------------
let flight = null;
function flyTo(target, distance) {
  const { camera, controls } = view;
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  const flat = Math.hypot(dir.x, dir.z) || 1;
  const pitch = 0.62;
  const endOffset = new THREE.Vector3(dir.x / flat * Math.sin(pitch), Math.cos(pitch), dir.z / flat * Math.sin(pitch))
    .multiplyScalar(distance);
  flyBetween(target, target.clone().add(endOffset));
}
function flyBetween(toTarget, toPos) {
  flight = {
    t: 0,
    fromTarget: view.controls.target.clone(), fromPos: view.camera.position.clone(),
    toTarget, toPos,
  };
}
function updateFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / 1.1);
  const e = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - (-2 * flight.t + 2) ** 3 / 2;
  view.controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
  view.camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
  if (flight.t === 1) flight = null;
}

// --- Info panel -----------------------------------------------------------------------------
const panel = document.getElementById('panel');
const panelTitle = panel.querySelector('.panel__title');
const panelSub = panel.querySelector('.panel__subtitle');
const panelText = panel.querySelector('.panel__text');
const panelImg = panel.querySelector('.panel__image');
const panelAction = panel.querySelector('.panel__action');
panel.querySelector('.panel__close').addEventListener('click', () => select(null));

const panelReveal = panel.querySelector('.panel__reveal');
const panelParty = panel.querySelector('.panel__party');
const panelJournal = panel.querySelector('.panel__journal');
panelJournal.addEventListener('click', () => {
  const p = selected;
  if (!p) return;
  showScreen('journal');
  journalScreen.openPlace(p.id);
});

let selected = null;
function select(p, { fly = true } = {}) {
  if (selected) selected.label.classList.remove('is-selected');
  selected = p;
  if (!p) { panel.hidden = true; return; }
  p.label.classList.add('is-selected');
  const known = knows(p);
  panelTitle.textContent = !known ? 'Unknown place' : p.tier === 'unnamed' ? 'Unnamed place' : p.name;
  const quest = views.world.places.includes(p) && questFor(p);
  panelSub.textContent = `${quest ? `📜 Quest: ${quest.data.title} · ` : ''}${!known ? 'Not discovered yet' : p.subtitle || 'Marked on your world map'}`;
  panelText.textContent = !known ? 'Nobody in the party knows what lies here yet.' : p.text || 'No lore written yet.';
  panelText.classList.toggle('is-empty', !known || !p.text);
  if (known && p.image) { panelImg.src = p.image; panelImg.alt = p.name; panelImg.hidden = false; }
  else panelImg.hidden = true;
  panelAction.hidden = !known || !p.cityMap;
  panelAction.onclick = p.cityMap ? () => openCity(p.cityMap) : null;
  // The Dungeon Master reveals places to the players, or hides them again.
  const hideable = seesAll() && isSecretable(p);
  panelReveal.hidden = !hideable;
  if (hideable) panelReveal.textContent = revealed.has(p.id) ? 'Hide from players' : 'Reveal to players';
  panelParty.hidden = !(seesAll() && views.world.places.includes(p));
  panelJournal.hidden = !(known && views.world.places.includes(p) && p.tier !== 'unnamed');
  panel.hidden = false;
  if (fly) flyTo(new THREE.Vector3(p.x, p.ground, p.z), view.focusDistance(p) * fitScale(view));
}

// --- What the players know of the world map ---------------------------------------------------
// Places the players have not discovered show as "?" and are left out of the
// places list. The Dungeon Master sees every name; hidden ones are marked
// faintly. Previewing as a player shows exactly what that player sees.
// City maps (Razz) are not hidden: a city's map only opens once it is known.
const FIRST_KNOWN = ['razz', 'tine', 'bartedalen'];
const quests = []; // the journal's entries ({ id, data }: quests, people, places), loaded after logging in
const revealed = new Set();
const seesAll = () => document.body.dataset.role === 'dm';
const isSecretable = (p) => views.world.places.includes(p) && p.tier !== 'unnamed';
const knows = (p) => !isSecretable(p) || seesAll() || revealed.has(p.id);

// Places an active quest leads to (that this viewer can see) get a scroll on the map.
const questFor = (p) => quests.find((q) => (q.data.kind ?? 'quest') === 'quest' && q.data.place === p.id && (q.data.status ?? 'active') === 'active' && (seesAll() || q.data.shown !== false));

function applyFog() {
  labelKey = ''; // names changed: re-check which ones overlap
  for (const p of views.world.places) p.label.classList.toggle('is-quest', Boolean(questFor(p)));
  for (const p of views.world.places) {
    if (!isSecretable(p)) continue;
    const known = knows(p);
    p.label.textContent = known ? p.name : '?';
    p.label.classList.toggle('is-unknown', !known);
    p.label.classList.toggle('is-secret', seesAll() && !revealed.has(p.id));
    p.label.title = known ? '' : 'Not discovered yet';
  }
  buildPlacesList();
  if (selected) select(selected, { fly: false });
  skyPanel?.render();
}

panelReveal.addEventListener('click', async () => {
  const p = selected;
  if (!p) return;
  const on = !revealed.has(p.id);
  try {
    await setRevealed([p.id], on);
    if (on) revealed.add(p.id); else revealed.delete(p.id);
    applyFog();
    toast(on ? `The players now know ${p.name}.` : `${p.name} is hidden from the players.`);
  } catch (err) { toast(`Could not change it: ${explain(err)}`); }
});

// --- Weather, time of day and the party on the world map ------------------------------------
// Kept in the Supabase table `world` (supabase/world.sql). The Dungeon Master
// changes it from the weather button; every device draws the same sky.
let sky = { ...DEFAULT_SKY };
const razz = views.world.places.find((p) => p.id === 'razz');
let partyAt = { x: razz.x + 2, z: razz.z + 2, shown: true };
let liveScene = null; // the id of the scene the players see (Scene tab), shared like the sky
let sceneSeen = false; // the world row has been read once
const party3d = createPartyMarker(views.world.scene, { onTap: () => showScreen('party') });

function applyParty() {
  party3d.setHeroes(party);
  party3d.place(partyAt.x, partyAt.z);
  party3d.show(partyAt.shown !== false && party.length > 0);
}

let lastLocalChange = 0, saveTimer = null;
function saveWorldSoon() {
  lastLocalChange = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveWorld({ sky, party: partyAt, scene: liveScene }).catch((err) => toast(explain(err))), 400);
}

const skyPanel = createSkyPanel({
  button: document.getElementById('sky-toggle'),
  panel: document.getElementById('sky'),
  world: () => ({ sky, party: partyAt }),
  canEdit: () => seesAll(),
  onSky(changes) { sky = { ...sky, ...changes }; saveWorldSoon(); },
  onParty(changes) { partyAt = { ...partyAt, ...changes }; applyParty(); saveWorldSoon(); },
  onMoveParty: startPlacingParty,
});

// Someone (the DM, on another device) changed the world. Our own recent
// changes win for a moment, so a slider being dragged does not jump back.
function useWorld(data) {
  if (Date.now() - lastLocalChange < 2500) return;
  if (data.sky) sky = { ...DEFAULT_SKY, ...data.sky };
  if (data.party) partyAt = { ...partyAt, ...data.party };
  if ('scene' in data && data.scene !== liveScene) {
    liveScene = data.scene ?? null;
    // A player is taken to a new scene when the DM puts it live (not for the one already live at login).
    if (liveScene && sceneSeen && me && !seesAll() && screen !== 'combat' && screen !== 'fight') { toast('📍 A new scene: see where you are'); showScreen('scene'); }
    sceneScreen?.refresh();
  }
  applyParty();
  skyPanel.render();
}
let watchingWorld = null;
async function loadWorldState() {
  try { useWorld(await loadWorld()); } catch (err) { console.warn('World state not available yet:', err.message); }
  sceneSeen = true;
  watchingWorld ??= watchWorld(useWorld);
}

// Moving the party: the DM taps the world map where they are.
let placingParty = false, tapStart = null;
const raycaster = new THREE.Raycaster();
function startPlacingParty() {
  if (view.id !== 'world') backToWorld();
  select(null);
  placingParty = true;
  document.body.classList.add('is-placing');
  toast('Tap the map where the party is.');
}
function mapPoint(clientX, clientY) {
  const r = labelRenderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), views.world.camera);
  const hit = new THREE.Vector3();
  let y = 1;
  for (let i = 0; i < 3; i++) { // step onto the ground under the finger
    if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit)) return null;
    y = groundAt(hit.x, hit.z);
  }
  return Math.abs(hit.x) < grid.cols / 2 && Math.abs(hit.z) < grid.rows / 2 ? hit : null;
}
labelRenderer.domElement.addEventListener('pointerdown', (e) => { if (placingParty) tapStart = { x: e.clientX, y: e.clientY }; });
labelRenderer.domElement.addEventListener('pointerup', (e) => {
  if (!placingParty || !tapStart || Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 10) return;
  tapStart = null;
  const hit = mapPoint(e.clientX, e.clientY);
  if (!hit) return;
  placingParty = false;
  document.body.classList.remove('is-placing');
  partyAt = { ...partyAt, x: hit.x, z: hit.z, shown: true };
  applyParty();
  saveWorldSoon();
  toast('The party is here now.');
});
panelParty.addEventListener('click', () => {
  const p = selected;
  if (!p) return;
  partyAt = { ...partyAt, x: p.x + 1.5, z: p.z + 1.5, shown: true };
  applyParty();
  saveWorldSoon();
  toast(`The party is at ${p.name}.`);
});

let watchingPlaces = null;
async function loadFog(dm) {
  try {
    const ids = await loadRevealed();
    // The very first time, the party knows the places they started with.
    if (!ids.length && dm) { await setRevealed(FIRST_KNOWN, true); ids.push(...FIRST_KNOWN); }
    revealed.clear();
    ids.forEach((id) => revealed.add(id));
  } catch (err) {
    console.warn('Revealed places not available:', err.message);
  }
  watchingPlaces ??= watchRevealed((id, on) => {
    if (on) revealed.add(id); else revealed.delete(id);
    applyFog();
    journalScreen.refresh();
  });
  applyFog();
}

// --- HUD ---------------------------------------------------------------------------------------
const list = document.getElementById('places');
const homeButton = document.getElementById('home');
const backButton = document.getElementById('back');
const viewTitle = document.getElementById('view-title');
const placesMenu = document.getElementById('places-menu');
const mapTab = document.querySelector('.topnav__tab--map');
// The Map tab doubles as the places menu: tapping it while on the map opens the list.
function openPlaces(open) {
  placesMenu.hidden = !open;
  mapTab.classList.toggle('is-open', open);
  if (!open) return;
  const r = mapTab.getBoundingClientRect();
  const bottomDock = r.top > window.innerHeight / 2;
  placesMenu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - placesMenu.offsetWidth - 8))}px`;
  placesMenu.style.top = bottomDock ? '' : `${r.bottom + 10}px`;
  placesMenu.style.bottom = bottomDock ? `${window.innerHeight - document.getElementById('bar').getBoundingClientRect().top + 8}px` : '';
}
document.addEventListener('click', (e) => {
  if (!placesMenu.hidden && !e.composedPath().some((el) => el === placesMenu || el === mapTab)) openPlaces(false);
});
function buildPlacesList() {
  list.replaceChildren();
  for (const tier of view.listTiers) {
    for (const p of view.places.filter((q) => q.tier === tier)) {
      if (!knows(p)) continue;
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.name;
      if (seesAll() && isSecretable(p) && !revealed.has(p.id)) b.classList.add('is-secret');
      b.className = `places__item places__item--${tier}`;
      b.addEventListener('click', () => { openPlaces(false); showScreen('map'); select(p); });
      li.appendChild(b);
      list.appendChild(li);
    }
  }
}
backButton.addEventListener('click', () => backToWorld());
homeButton.addEventListener('click', () => {
  select(null);
  flyBetween(view.start.target.clone(), view.start.target.clone().add(startOffset(view)));
});

// --- Touch gestures & compass -------------------------------------------------------------------
attachTouchGestures(labelRenderer.domElement, () => view, () => { flight = null; spin = null; });

// The compass needle points north; tapping it turns the map back to north-up.
// The place-names button hides or shows every name label on the maps (remembered on this device).
const labelsToggle = document.getElementById('labels-toggle');
const tagsToggle = document.getElementById('tags-toggle'); // the same switch in scenes and fights
function setLabelsHidden(hidden) {
  document.body.classList.toggle('no-labels', hidden);
  labelsToggle.setAttribute('aria-pressed', String(hidden));
  labelsToggle.title = labelsToggle.ariaLabel = hidden ? 'Show place names' : 'Hide place names';
  tagsToggle.setAttribute('aria-pressed', String(hidden));
  tagsToggle.title = tagsToggle.ariaLabel = hidden ? 'Show names and health boxes' : 'Hide names and health boxes';
  try { localStorage.setItem('dnd.noLabels', hidden ? '1' : ''); } catch { /* private mode */ }
}
labelsToggle.addEventListener('click', () => setLabelsHidden(!document.body.classList.contains('no-labels')));
tagsToggle.addEventListener('click', () => setLabelsHidden(!document.body.classList.contains('no-labels')));
try { setLabelsHidden(localStorage.getItem('dnd.noLabels') === '1'); } catch { /* private mode */ }

const compass = document.getElementById('compass');
const compassNeedle = compass.querySelector('.compass__needle');
const azimuth = () => Math.atan2(view.camera.position.x - view.controls.target.x, view.camera.position.z - view.controls.target.z);
let spin = null;
compass.addEventListener('click', () => {
  flight = null;
  spin = { from: azimuth(), t: 0 };
});
function updateSpin(dt) {
  if (!spin) return;
  spin.t = Math.min(1, spin.t + dt / 0.6);
  const e = 1 - (1 - spin.t) ** 3;
  const offset = view.camera.position.clone().sub(view.controls.target);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), spin.from * (1 - e) - azimuth());
  view.camera.position.copy(view.controls.target).add(offset);
  if (spin.t === 1) spin = null;
}

// --- Post-processing ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(views.world.scene, views.world.camera);
composer.addPass(renderPass);
const tilt = createTiltShiftPasses();
tilt.passes.forEach((p) => composer.addPass(p));
composer.addPass(new OutputPass());

const helpToggle = document.getElementById('help-toggle');
const help = document.getElementById('help');
helpToggle.addEventListener('click', () => {
  help.hidden = !help.hidden;
  helpToggle.setAttribute('aria-expanded', String(!help.hidden));
});

const tiltToggle = document.getElementById('tilt');
if (TOUCH) tiltToggle.checked = false;
tilt.enabled = tiltToggle.checked;
tiltToggle.addEventListener('change', () => { tilt.enabled = tiltToggle.checked; });

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  for (const v of Object.values(views)) {
    v.camera.aspect = w / h;
    v.camera.updateProjectionMatrix();
  }
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  const pr = renderer.getPixelRatio();
  tilt.setSize(w * pr, h * pr);
}
window.addEventListener('resize', resize);

show(views.world);
applyFog(); // nothing is known until someone logs in

// --- Labels: show by zoom, shrink with distance, hide ones that overlap -------------------------
// Earlier tiers win when two names collide; the selected place always shows.
const LABEL_PRIORITY = ['city', 'district', 'continent', 'local', 'spot', 'region', 'water', 'unnamed'];
const labelOrder = (p) => (p.label.classList.contains('is-selected') ? -1 : LABEL_PRIORITY.indexOf(p.tier));

// Measuring labels makes the browser lay out the page, so this only runs when
// the view has changed, not on every frame.
function updateLabels(dist, force = false) {
  const cam = view.camera.position, t = view.controls.target;
  const key = `${view.id}|${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(1)}|${t.x.toFixed(1)},${t.z.toFixed(1)}|${selected?.id ?? ''}`;
  if (key === labelKey && !force) return;
  labelKey = key;
  lastActive = performance.now(); // the view moved: keep the frame rate up
  // Names grow a little as you zoom in and shrink when far away (phones shrink more).
  const scale = THREE.MathUtils.clamp((TOUCH ? 95 : 130) / dist, TOUCH ? 0.7 : 0.8, 1.1).toFixed(2);
  if (scale !== labelScale) {
    labelScale = scale;
    labelRenderer.domElement.style.setProperty('--label-scale', scale);
  }

  const wanted = view.places
    .filter((p) => p.label.classList.contains('is-selected') || view.labelVisible(p, dist))
    .sort((a, b) => labelOrder(a) - labelOrder(b));
  const placed = [];
  const shown = new Set();
  for (const p of wanted) {
    const r = p.label.getBoundingClientRect();
    if (r.width === 0) continue;
    const pad = 3;
    const hit = placed.some((q) => r.left - pad < q.right && r.right + pad > q.left && r.top - pad < q.bottom && r.bottom + pad > q.top);
    if (hit) continue;
    placed.push(r);
    shown.add(p);
  }
  for (const p of view.places) p.label.classList.toggle('is-hidden', !shown.has(p));
}

// --- Screens: Map · Status · Party -------------------------------------------------------------
// The map only renders while its screen is showing; the others are plain pages
// (Status has its own small 3D stage for the character figure).
let screen = 'map';
let statusScreen = null;
// The party's characters, loaded from the database after logging in. Updated
// in place when anyone changes a character, so every screen sees the same objects.
const everyone = []; // every hero in the database
const party = [];    // the heroes of the party being shown (see currentParty)
// Heroes belong to a named party (`party` on the sheet; none = the first party). Players see only
// their own hero's party; the DM picks which party to look at (remembered on this device).
const FIRST_PARTY = 'The party';
const partyOf = (c) => String(c?.party ?? '').trim() || FIRST_PARTY;
const partyNames = () => [...new Set([FIRST_PARTY, ...everyone.map(partyOf), dmParty])];
let dmParty = (() => { try { return localStorage.getItem('dnd.party') || FIRST_PARTY; } catch { return FIRST_PARTY; } })();
function currentParty() {
  const heroId = me && !me.dm ? me.heroId : viewAs;
  if (heroId) return partyOf(everyone.find((c) => c.id === heroId));
  return partyNames().includes(dmParty) ? dmParty : FIRST_PARTY;
}
function refilterParty() {
  const name = currentParty();
  party.splice(0, party.length, ...everyone.filter((c) => partyOf(c) === name));
}
function switchParty(name) {
  dmParty = name;
  try { localStorage.setItem('dnd.party', name); } catch { /* private mode */ }
  refilterParty();
  heroChanged(null);
  sceneScreen?.refresh();
}
const owners = new Map(); // character id -> profile id of the player
const screens = {
  status: document.getElementById('status'), party: document.getElementById('party'),
  combat: document.getElementById('combat'), fight: document.getElementById('fight'),
  journal: document.getElementById('journal'),
  scene: document.getElementById('scene'),
};
let sceneScreen = null; // made below, once the journal's entries exist
let combatScreen = null; // the DM's controls
let combatView = null;   // the players' view of a fight

// The scene stays on show behind the DM's fight setup and initiative (not behind the battle).
function showSceneBehind() {
  const on = screen === 'scene' || (screen === 'combat' && combatScreen && !combatScreen.inBattle());
  if (!sceneScreen) return;
  screens.scene.hidden = !on;
  if (on) sceneScreen.start(); else sceneScreen.stop();
}
function showScreen(id) {
  // Fights happen in the Scene tab: the DM's fight controls while a fight is set up or on,
  // the player's view of the fight while one is on.
  const role = document.body.dataset.role;
  if (id === 'scene' && role === 'dm' && combatScreen?.busy()) id = 'combat';
  if ((id === 'scene' || id === 'combat') && role === 'player' && combatView?.active) id = 'fight';
  if (id === 'combat' && role !== 'dm') id = 'scene';
  if (id === screen) return;
  screen = id;
  const tab = id === 'fight' || id === 'combat' ? 'scene' : id;
  document.querySelectorAll('.topnav__tab').forEach((b) => b.classList.toggle('is-active', b.dataset.screen === tab));
  document.body.dataset.screen = id;
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== id;
  if (id === 'status') {
    statusScreen.start();
  } else {
    statusScreen?.stop();
  }
  if (id === 'party') drawParty(); // re-rendered each time, so AC and HP follow gear changes
  if (id === 'journal') journalScreen.render();
  showSceneBehind();
  if (id === 'combat') combatScreen.start(); else combatScreen?.stop();
  if (id === 'fight') combatView.start(); else combatView?.stop();
  if (id === 'map') clock.getDelta(); // no time jump after being away
}
for (const b of document.querySelectorAll('.topnav__tab')) b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon));
document.querySelector('.topnav').addEventListener('click', (e) => {
  const btn = e.target.closest('.topnav__tab');
  if (!btn) return;
  if (btn === mapTab && screen === 'map') { openPlaces(placesMenu.hidden); return; }
  openPlaces(false);
  showScreen(btn.dataset.screen);
});
document.body.dataset.screen = 'map';

// --- Start: log in, load the party, and go in as the DM or a player ---------------------------
const bar = document.getElementById('bar');
const roleChip = document.getElementById('role');
const barParty = document.getElementById('bar-party');
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const hpTone = (c) => (c.hp.current <= 0 ? ' is-down' : c.hp.current / c.hp.max <= 0.3 ? ' is-low' : '');

// The bar's "you" button (your hero, or the Dungeon Master) and, on wide
// screens, the rest of the party with their health.
function drawBar() {
  if (!me) return;
  const heroId = me.dm ? viewAs : me.heroId;
  const hero = party.find((c) => c.id === heroId);
  roleChip.classList.toggle('is-previewing', Boolean(viewAs));
  // A dot on the Hero tab while attribute points wait to be spent (any hero, for the DM).
  const waiting = hero ? hero.abilityPoints > 0 : party.some((c) => c.abilityPoints > 0);
  document.querySelector('.topnav__tab[data-screen=status]').classList.toggle('has-points', Boolean(waiting));
  roleChip.innerHTML = hero ? `
    <span class="bar__face" style="--hero:${escHtml(hero.colour)}">${portraitImg(heroPortrait(hero), { name: hero.name, colour: hero.colour })}</span>
    <span class="bar__me-text">
      <small>${viewAs ? 'Viewing as' : `Level ${hero.level} ${escHtml(hero.class)}`}</small>
      <b>${escHtml(hero.name)}</b>
      <span class="bar__hp${hpTone(hero)}"><i style="width:${Math.round(Math.max(0, hero.hp.current / hero.hp.max) * 100)}%"></i><em>${hero.hp.current}/${hero.hp.max}</em></span>
    </span>`
    : `<span class="bar__face bar__face--dm">${icon('crown')}</span><span class="bar__me-text"><b title="Dungeon Master">DM</b></span>`;
  barParty.innerHTML = party.filter((c) => c.id !== heroId).map((c) => `
    <button type="button" class="bar__mate${hpTone(c)}${me?.dm && online.has(c.id) ? ' is-online' : ''}" data-hero="${escHtml(c.id)}" title="${escHtml(c.name)}: ${c.hp.current} of ${c.hp.max} HP${me?.dm ? ` · ${onlineText(c.id)}` : ''}" style="--hero:${escHtml(c.colour)}">
      <span class="bar__face">${portraitImg(heroPortrait(c), { name: c.name, colour: c.colour })}</span>
      <em>${c.hp.current}</em>
    </button>`).join('');
}
// Who has the app open right now (heroes' ids), and when the ones who left were last seen.
const online = new Set(), lastSeen = new Map();
let presence = null;
function watchOnline() {
  if (presence) return;
  presence = presenceChannel({ uid: me.uid, hero: me.dm ? null : me.heroId, dm: me.dm }, (ids) => {
    for (const id of online) if (!ids.has(id)) lastSeen.set(id, new Date());
    online.clear();
    ids.forEach((id) => online.add(id));
    drawBar();
    if (screen === 'party') drawParty();
  });
}
const onlineText = (id) => (online.has(id) ? 'Online now' : lastSeen.has(id) ? `Last seen ${lastSeen.get(id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not online');

barParty.addEventListener('click', (e) => {
  const b = e.target.closest('[data-hero]');
  if (!b) return;
  // Players only open their own hero; the rest of the party is on the Party screen.
  if (document.body.dataset.role === 'player') { showScreen('party'); return; }
  showScreen('status');
  statusScreen.showCharacter(b.dataset.hero);
});
let watching = null;

// The character creator: players make their own hero when they first log in;
// the Dungeon Master can add heroes from the Party screen for anyone to claim.
const creator = createCreatorScreen(document.getElementById('creator'), {
  async onCreated(c) {
    if (!me?.dm) { await enter(); return; } // the player's new hero is theirs: go in
    if (currentParty() !== FIRST_PARTY) { c.party = currentParty(); saveHero(c); } // joins the party on show
    applyRow({ id: c.id, owner: null, data: c });
    showScreen('status');
    statusScreen.showCharacter(c.id);
    toast(`${c.name} joined ${currentParty()}. A player can now pick them.`);
  },
});
const startScreen = createStartScreen(document.getElementById('start'), { onLoggedIn: enter, onCreateHero: () => creator.open() });

function drawParty() {
  const open = (id) => { showScreen('status'); statusScreen.showCharacter(id); };
  const dm = me?.dm && !viewAs;
  renderParty(screens.party, party, open, dm ? {
    onNew: () => creator.open(), onManage: (id) => manager.open(id), onEveryone: everyoneDoes,
    parties: partyNames(), current: currentParty(), onSwitch: switchParty,
    online: (id) => ({ on: online.has(id), text: onlineText(id), claimed: Boolean(owners.get(id)) }),
  } : { title: partyNames().length > 1 ? currentParty() : null });
}

// The Dungeon Master's tools for heroes (Party → Manage).
const manager = createHeroManager(document.getElementById('manage'), {
  party: everyone,
  parties: () => partyNames(),
  partyOf,
  onSave(c) { saveHero(c); refilterParty(); heroChanged(c.id); },
  // The Journal's items (lore books, letters, maps): giving one shows it to the players, held by the hero.
  loreItems: () => quests.filter((q) => q.data.kind === 'item').map((q) => ({
    id: q.id, title: q.data.title, type: q.data.type, given: q.data.shown !== false,
    holderName: q.data.shown === false ? '' : everyone.find((c) => c.id === q.data.holder)?.name ?? 'the party',
  })).sort((a, b) => Number(a.given) - Number(b.given) || a.title.localeCompare(b.title)),
  async onGiveLore(id, heroId) {
    const q = quests.find((x) => x.id === id);
    const saved = await saveQuest({ id, data: { ...q.data, shown: true, holder: heroId } });
    const i = quests.findIndex((x) => x.id === id);
    if (i >= 0) quests[i] = saved;
    journalScreen.refresh();
  },
});
function everyoneDoes(what, amount) {
  for (const c of party) {
    if (what === 'short') shortRest(c);
    else if (what === 'long') longRest(c);
    else c.xp += amount;
    saveHero(c);
    heroChanged(c.id);
  }
  const ready = party.filter(readyToLevel).map((c) => c.name);
  toast(what === 'xp' ? `Everyone gained ${amount} XP.${ready.length ? ` Ready to level up: ${ready.join(', ')}.` : ''}`
    : `The party took a ${what} rest.`);
}
// Redraws whatever shows a hero after a change made here.
function heroChanged(id) {
  applyParty();
  drawBar();
  statusScreen.refresh(id);
  combatScreen.refresh();
  combatView.refresh();
  if (screen === 'party') drawParty();
  sceneScreen?.refresh();
}

const saveHero = (c) => saveCharacter(c).catch((err) => toast(`Could not save: ${explain(err)}`));
async function removeHero(c) {
  try {
    await deleteCharacter(c.id);
    applyRow({ id: c.id, deleted: true });
    toast(`${c.name} was deleted.`);
  } catch (err) { toast(`Could not delete: ${explain(err)}`); }
}
statusScreen = createStatusScreen(screens.status, party, { onChange(c) { saveHero(c); drawBar(); applyParty(); }, onDelete: removeHero });
combatScreen = createCombatScreen(screens.combat, {
  party, onHeroChange: saveHero, onPublic: publishFight, onSave: saveFightSoon,
  liveArea: () => quests.find((q) => q.id === liveScene)?.data.area ?? null,
  onLeave: () => showScreen('scene'),
  onStep: () => showSceneBehind(),
  // The party has now met these creatures: they go into everyone's journal.
});

// The running fight is saved online (DM only, supabase/session.sql), so a reload
// or a closed app picks it up again where it was.
let fightTimer = null, fightWarned = false;
function saveFightSoon(encounter) {
  clearTimeout(fightTimer);
  const copy = encounter ? JSON.parse(JSON.stringify(encounter)) : null;
  fightTimer = setTimeout(() => saveEncounter(copy).catch((err) => {
    if (!fightWarned) toast(`The fight is not being saved: ${/encounters/.test(err.message) ? 'run supabase/session.sql in Supabase.' : explain(err)}`);
    fightWarned = true;
  }), 600);
}
async function restoreFight() {
  try {
    if (combatScreen.restore(await loadEncounter())) {
      publishFight(combatScreen.publicState());
      toast('Your fight is back where you left it.');
    }
  } catch (err) { console.warn('No saved fight:', err.message); }
}
combatView = createCombatView(screens.fight, { party });

// Generated monsters live in the database; everyone loads them so fights can show them.
function useMonster(row) {
  registerRecipe(row.id, row.data.figure);
  addMonster(row.id, row.data);
}
let watchingMonsters = null;
async function loadBestiary() {
  try {
    (await loadMonsters()).forEach(useMonster);
  } catch (err) {
    console.warn('Bestiary not available yet:', err.message); // e.g. before supabase/monsters.sql has been run
    return;
  }
  watchingMonsters ??= watchMonsters((event, row) => {
    if (event === 'DELETE') removeMonster(row.id); else useMonster(row);
    combatScreen?.refresh(); sceneScreen?.refresh();
    combatScreen.refresh();
    journalScreen.refresh();
  });
  combatScreen?.refresh(); sceneScreen?.refresh();
  combatScreen.refresh();
}

// --- Sharing fights with the players ----------------------------------------------------------
// The DM's app broadcasts what players may see; players' apps show it read-only.
let fightChannel = null;

function publishFight(state) {
  fightChannel?.publish(state);
  receiveFight(state); // the DM's own "view as player" preview
}

function receiveFight(state) {
  const wasActive = combatView.active;
  combatView.show(state);
  document.body.dataset.fight = state.active ? 'on' : '';
  const player = document.body.dataset.role === 'player';
  if (player && state.active && !wasActive && me && !me.dm) {
    toast('A fight has begun!');
    showScreen('scene');
  }
  if (player && !state.active && screen === 'fight') showScreen('scene');
}

function openFightChannel() {
  if (fightChannel) return;
  fightChannel = me.dm
    ? encounterChannel({ onHello: () => fightChannel.publish(combatScreen.publicState()) })
    : encounterChannel({ onState: receiveFight });
}

// Fills `party` from database rows, keeping the starting heroes' order.
function setParty(rows) {
  const order = (id) => { const i = STARTING_HEROES.findIndex((h) => h.id === id); return i < 0 ? 999 : i; };
  rows.sort((a, b) => order(a.id) - order(b.id));
  everyone.splice(0, everyone.length, ...rows.map((r) => r.data));
  refilterParty();
  owners.clear();
  for (const r of rows) owners.set(r.id, r.owner);
}

// A character changed (or was deleted) somewhere: update it here and redraw what shows it.
function applyRow(row) {
  const i = everyone.findIndex((c) => c.id === row.id);
  if (row.deleted) {
    if (i < 0) return;
    everyone.splice(i, 1);
    owners.delete(row.id);
    // A player whose hero was deleted goes back to pick or make a new one.
    if (me && !me.dm && me.heroId === row.id) { location.reload(); return; }
    if (viewAs === row.id) previewAs(null);
  } else {
    owners.set(row.id, row.owner);
    if (me && !me.dm && me.heroId === row.id && i >= 0) tellPlayer(everyone[i], row.data);
    if (i >= 0) everyone[i] = row.data; else everyone.push(row.data);
  }
  refilterParty();
  sceneScreen?.refresh();
  manager.refresh(row.id);
  heroChanged(row.id);
}

// Tells a player what the Dungeon Master just did to their hero.
function tellPlayer(before, after) {
  const news = [];
  if (after.level > before.level) news.push(`You reached level ${after.level}!`);
  if ((after.abilityPoints ?? 0) > (before.abilityPoints ?? 0)) news.push('You have an attribute point to spend on your Hero page.');
  else if (after.xp > before.xp) news.push(`You gained ${after.xp - before.xp} XP.`);
  const hp = after.hp.current - before.hp.current;
  if (hp > 0 && after.level === before.level) news.push(`You regained ${hp} HP.`);
  if (hp < 0) news.push(`You took ${-hp} damage.`);
  const count = (c) => c.items.reduce((n, i) => n + (i.qty ?? 1), 0);
  if (count(after) > count(before)) news.push('You received an item. Check your Gear.');
  const gold = (c) => (c.coins.pp ?? 0) * 10 + (c.coins.gp ?? 0) + (c.coins.sp ?? 0) / 10 + (c.coins.cp ?? 0) / 100;
  if (gold(after) > gold(before)) news.push('You received coins.');
  if (news.length) toast(news.join(' '));
}

// Decides where a logged-in person goes. Called on start-up and after logging in.
async function enter() {
  let profile, rows;
  try {
    profile = await myProfile();
    if (!profile) { startScreen.show(); return; }
    rows = await loadCharacters();
    if (!rows.length && profile.role === 'dm') {
      await seedCharacters(STARTING_HEROES); // first time: put the heroes online
      rows = await loadCharacters();
    }
  } catch (err) {
    toast(explain(err));
    startScreen.show();
    return;
  }
  setParty(rows);
  await loadBestiary();

  const mine = rows.find((r) => r.owner === profile.id);
  if (profile.role !== 'dm' && !mine) { startScreen.showClaim(rows); return; }

  watching ??= watchCharacters(applyRow);
  startScreen.hide();
  me = { dm: profile.role === 'dm', heroId: mine?.id ?? null, uid: profile.id };
  viewAs = null;
  applyView();
  await loadFog(me.dm);
  applyParty();
  await loadWorldState();
  openFightChannel();
  watchOnline();
  if (me.dm) await restoreFight();
  loadDiceLog();
  loadJournal();
  showScreen(me.dm ? 'map' : combatView.active ? 'scene' : 'status');
}

// --- Who the app is showing things for -------------------------------------------------------
// A player always sees the app as their own hero. The Dungeon Master sees
// everything, but can preview the app exactly as one of the players sees it.
let me = null;      // { dm, heroId } for the logged-in person
let viewAs = null;  // hero id the DM is previewing as, or null
const roleMenu = document.getElementById('role-menu');

function applyView() {
  const heroId = me.dm ? viewAs : me.heroId;
  refilterParty();
  document.body.dataset.role = heroId ? 'player' : 'dm';
  // The bar shows whose view this is; for the DM, its "you" button is also the view switcher.
  bar.hidden = false;
  drawBar();
  statusScreen.setDm(me.dm);
  statusScreen.setPlayer(heroId);
  applyFog();
  journalScreen.refresh();
  if (screen === 'party') drawParty();
  sceneScreen?.refresh();
}

function previewAs(heroId) {
  viewAs = heroId;
  applyView();
  showScreen(heroId ? (combatView.active ? 'scene' : 'status') : 'map');
}

roleChip.addEventListener('click', (e) => {
  e.stopPropagation();
  roleMenu.innerHTML = `
    ${me.dm ? `
      <p class="role-menu__h">View the app as</p>
      <button type="button" data-view=""${viewAs ? '' : ' class="is-on"'}><i style="background:#3b2f22"></i>Dungeon Master</button>
      ${everyone.map((c) => `<button type="button" data-view="${c.id}"${c.id === viewAs ? ' class="is-on"' : ''}><i style="background:${c.colour}"></i>${c.name}${partyNames().length > 1 ? ` <small>${escHtml(partyOf(c))}</small>` : ''}</button>`).join('')}
      <hr />` : ''}
    <button type="button" data-action="logout">Log out</button>
    <p class="role-menu__version">Version ${new Date(__BUILD_TIME__).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>`;
  roleMenu.hidden = !roleMenu.hidden;
});
roleMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  roleMenu.hidden = true;
  if (btn.dataset.view !== undefined) { previewAs(btn.dataset.view || null); return; }
  if (btn.dataset.action !== 'logout') return;
  await signOut();
  supabase.removeAllChannels();
  watching = null;
  fightChannel = null;
  watchingMonsters = null;
  watchingPlaces = null;
  watchingWorld = null;
  watchingRolls = null;
  watchingQuests = null;
  quests.length = 0;
  combatView.show({ active: false });
  document.body.dataset.fight = '';
  me = null;
  viewAs = null;
  bar.hidden = true;
  delete document.body.dataset.role;
  revealed.clear();
  applyFog();
  showScreen('map');
  startScreen.show();
});
document.addEventListener('click', (e) => {
  if (!roleMenu.hidden && !roleMenu.contains(e.target)) roleMenu.hidden = true;
});

// --- Journal ----------------------------------------------------------------------------------------
const journalScreen = createJournalScreen(screens.journal, {
  entries: quests,
  canEdit: () => seesAll(),
  // The world-map places this viewer may read about (the DM sees all, hidden ones marked).
  heroes: () => party.map((c) => ({ id: c.id, name: c.name })),
  monsters: () => Object.entries(MONSTERS).map(([id, m]) => ({ id, name: m.name, kind: m.kind, note: m.note, model: m.model, generated: m.generated })),
  onMonstersChanged() { sceneScreen?.refresh(); },
  mapPlaces: () => views.world.places
    .filter((p) => p.tier !== 'unnamed' && knows(p))
    .map((p) => ({ id: p.id, name: p.name, subtitle: p.subtitle, text: p.text, tier: p.tier, secret: seesAll() && isSecretable(p) && !revealed.has(p.id) })),
  onSave: (q) => saveQuest(q).catch((err) => {
    throw new Error(/quests/.test(err.message) ? 'Run supabase/session.sql in Supabase first.' : explain(err));
  }).finally(() => applyFog()),
  onDelete: (id) => deleteQuest(id).finally(() => applyFog()),
  onShowPlace(id) {
    const p = views.world.places.find((x) => x.id === id);
    if (!p) return;
    showScreen('map');
    if (view.id !== 'world') backToWorld();
    select(p);
  },
});
sceneScreen = createSceneScreen(screens.scene, {
  entries: quests,
  heroes: () => party,
  monsters: () => MONSTERS,
  canEdit: () => seesAll(),
  liveId: () => liveScene,
  onSave: (row) => saveQuest(row).then((saved) => {
    const i = quests.findIndex((q) => q.id === saved.id);
    if (i >= 0) quests[i] = saved; else quests.push(saved);
    return saved;
  }).catch((err) => { throw new Error(explain(err)); }),
  onDelete: (id) => deleteQuest(id).then(() => { const i = quests.findIndex((q) => q.id === id); if (i >= 0) quests.splice(i, 1); }),
  async onLive(id, { quiet = false } = {}) {
    // A scene going live is shown to the players (scenes are journal rows: RLS sends only shown ones).
    const row = quests.find((q) => q.id === id);
    if (row && row.data.shown === false) await saveQuest({ id, data: { ...row.data, shown: true } });
    liveScene = id;
    saveWorldSoon();
    if (!quiet) toast(id ? 'The scene is live for the players.' : 'The scene has ended.');
  },
  onOpenJournal(type, id) { showScreen('journal'); journalScreen.openEntry(type, id); },
  onFight(setup) { combatScreen.prepare(setup); showScreen('combat'); },
});
let watchingQuests = null;
async function loadJournal() {
  try {
    quests.splice(0, quests.length, ...(await loadQuests()));
    for (const q of quests) if (q.data.kind === 'area') registerArea(q.id, q.data); // places Claude made
  } catch (err) { console.warn('Journal not available yet:', err.message); return; }
  watchingQuests ??= watchQuests((event, row) => {
    const i = quests.findIndex((q) => q.id === row.id);
    if (event === 'DELETE') { if (i >= 0) quests.splice(i, 1); unregisterArea(row.id); } else if (i >= 0) quests[i] = row; else quests.push(row);
    if (event !== 'DELETE' && row.data?.kind === 'area') registerArea(row.id, row.data);
    // Something new for a player: added, or revealed by the DM (it was not in their list before).
    if (event !== 'DELETE' && i < 0 && me && !seesAll() && row.data.shown !== false && row.data.kind !== 'scene' && row.data.kind !== 'area') {
      const what = { npc: 'Someone new in your journal', place: 'A new place in your journal', placenote: 'New notes in your journal', item: '📖 You found', creature: 'A new creature in your journal' }[row.data.kind] ?? '📜 New quest';
      const name = row.data.title ?? MONSTERS[row.data.monster]?.name;
      toast(name ? `${what}: ${name}` : what);
    }
    journalScreen.refresh();
    sceneScreen.refresh();
    applyFog();
    dumpJournal();
  });
  journalScreen.refresh();
  sceneScreen.refresh();
  applyFog();
  dumpJournal();
}
// On the dev server, the DM's journal is saved to the game folder for Claude (see vite.config.js),
// when it loads and after every change.
let dumpTimer = null;
function dumpJournal() {
  if (!import.meta.env.DEV || !me?.dm) return;
  clearTimeout(dumpTimer);
  dumpTimer = setTimeout(() => fetch('/__journal-dump', { method: 'POST', body: JSON.stringify(quests, null, 1) }).catch(() => {}), 1500);
}

// The little rulebook, always one tap away. Its weapons page shows the player's
// own hero, or for the Dungeon Master the hero last opened on Status.
createRulebook({
  button: document.getElementById('rulebook-toggle'),
  root: document.getElementById('rulebook'),
  getHero: () => party.find((c) => c.id === (me && !me.dm ? me.heroId : viewAs ?? statusScreen.current())) ?? null,
});

// The dice tray and the table's roll log (supabase/session.sql).
let diceWarned = false;
const diceTray = createDiceTray({
  button: document.getElementById('dice-toggle'),
  root: document.getElementById('dice'),
  who() {
    const hero = party.find((c) => c.id === (me && !me.dm ? me.heroId : viewAs)) ?? null;
    if (me?.dm) return { name: 'Dungeon Master', colour: '#3b2f22', hero, dm: true };
    return { name: hero?.name ?? 'Someone', colour: hero?.colour, hero, dm: false };
  },
  save: (row) => addRoll(row).catch((err) => {
    if (!diceWarned) toast(`Rolls are not shared yet: ${/rolls/.test(err.message) ? 'run supabase/session.sql in Supabase.' : explain(err)}`);
    diceWarned = true;
    throw err;
  }),
  clear: clearRolls,
});
let watchingRolls = null;
async function loadDiceLog() {
  try { diceTray.setLog(await loadRolls()); } catch (err) { console.warn('Dice log not available yet:', err.message); return; }
  watchingRolls ??= watchRolls((event, row) => {
    if (event === 'DELETE') { diceTray.remove(row.id); return; }
    diceTray.add(row);
    if (row.user_id !== me?.uid && document.getElementById('dice').hidden) rollPop(row);
  });
}
// Someone else rolled while the tray is closed: a small note by the dice tab.
function rollPop(row) {
  const clean = (t) => String(t ?? '').replace(/[<>&"]/g, '');
  const el = document.createElement('div');
  el.className = 'roll-pop';
  el.innerHTML = `<i style="background:${clean(row.colour) || '#3b2f22'}"></i><span>${clean(row.who)}${row.label ? ` · ${clean(row.label)}` : ''}</span><b>${Number(row.total)}</b>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// A short message at the bottom of the screen.
function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

enter();

// --- Loop ------------------------------------------------------------------------------------------
const clock = new THREE.Clock();
let frame = 0;

// At most 60 frames a second while the map moves (newer iPhones would otherwise
// draw 120), and 30 while it stands still: drifting clouds and rain look the
// same, and the phone stays cool.
let lastDraw = 0, lastCompass = '';
const wakeUp = () => { lastActive = performance.now(); };
for (const type of ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'keydown']) window.addEventListener(type, wakeUp, { passive: true });

renderer.setAnimationLoop((now) => {
  if (screen !== 'map') { clock.getDelta(); return; }
  const idle = now - lastActive > 700 && !flight && !spin;
  if (now - lastDraw < (idle ? 31 : 14)) return;
  lastDraw = now;
  const dt = Math.min(clock.getDelta(), 0.05);
  applyKeys(dt);
  updateFlight(dt);
  updateSpin(dt);
  view.controls.update();
  clampTarget();
  view.update(dt);
  frame++;
  if (view.shadowEvery && frame % view.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
  const dist = view.camera.position.distanceTo(view.controls.target);
  // Weather and time of day, as the Dungeon Master set them.
  const air = view.atmosphere.update(sky, dt, { target: view.controls.target, distance: dist });
  renderer.toneMappingExposure = air.exposure;
  if (air.moved) renderer.shadowMap.needsUpdate = true;
  party3d.update(clock.elapsedTime);
  composer.render();
  labelRenderer.render(view.scene, view.camera);
  updateLabels(dist);
  const needle = `rotate(${azimuth().toFixed(3)}rad)`;
  if (needle !== lastCompass) { lastCompass = needle; compassNeedle.style.transform = needle; }
});

if (import.meta.env.DEV) window.__debug = { renderer, get view() { return view; }, get world() { return views.world; } };
document.body.classList.add('is-ready');

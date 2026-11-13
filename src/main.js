import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { grid, WATER_LEVEL, pixelToCell, nearestLand, cellToWorld } from './world/grid.js';
import { buildTerrain, surfaceY } from './world/terrain.js';
import { buildPlants, buildClouds } from './world/scatter.js';
import { buildLandmark } from './world/landmarks.js';
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
import { createBestiaryScreen } from './bestiary/bestiaryScreen.js';
import { addMonster, removeMonster } from './data/monsters.js';
import { registerRecipe } from './character/model.js';
import { CHARACTERS as STARTING_HEROES } from './data/characters.js';
import { createStartScreen } from './start/startScreen.js';
import { createCreatorScreen } from './creator/creatorScreen.js';
import { createRulebook } from './rulebook/rulebook.js';
import { createJournalScreen } from './journal/journalScreen.js';
import { createDiceTray } from './dice/diceTray.js';
import { createHeroManager } from './status/heroManager.js';
import { shortRest, longRest, readyToLevel } from './character/progress.js';
import { icon } from './ui/icons.js';
import { heroPortrait, portraitImg } from './ui/portraits.js';
import { loadRevealed, setRevealed, watchRevealed, loadWorld, saveWorld, watchWorld, loadEncounter, saveEncounter, loadRolls, addRoll, clearRolls, watchRolls, loadQuests, saveQuest, deleteQuest, watchQuests } from './net/backend.js';
import { supabase, myProfile, loadCharacters, seedCharacters, saveCharacter, deleteCharacter, watchCharacters, signOut, explain, encounterChannel, loadMonsters, watchMonsters } from './net/backend.js';
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
  const plants = buildPlants((x, z) => towns.some((p) => Math.abs(p.cx - x) <= 3 && Math.abs(p.cz - z) <= 3));
  scene.add(plants);
  const clouds = buildClouds();
  scene.add(clouds);
  const atmosphere = createAtmosphere(scene, { lights, daySky: '#cfe9f0', fog: [160, 620], clouds, touch: TOUCH });

  // All the little towns become one mesh (windmill sails keep turning on their own).
  const spinners = [];
  const townGroup = new THREE.Group();
  for (const p of towns) {
    const town = buildLandmark(p.style);
    town.scale.setScalar(p.tier === 'city' ? 1.5 : 1.2);
    town.position.set(p.x, p.ground, p.z);
    townGroup.add(town);
    if (town.userData.spin) spinners.push(town.userData.spin);
  }
  const mergedTowns = mergeStatic(townGroup, { keep: spinners });
  if (mergedTowns) scene.add(mergedTowns);
  scene.add(townGroup); // what is left: the turning sails

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1200);
  const view = {
    id: 'world',
    title: 'World Map',
    scene, camera, places, atmosphere,
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
  panel.hidden = false;
  if (fly) flyTo(new THREE.Vector3(p.x, p.ground, p.z), view.focusDistance(p) * fitScale(view));
}

// --- What the players know of the world map ---------------------------------------------------
// Places the players have not discovered show as "?" and are left out of the
// places list. The Dungeon Master sees every name; hidden ones are marked
// faintly. Previewing as a player shows exactly what that player sees.
// City maps (Razz) are not hidden: a city's map only opens once it is known.
const FIRST_KNOWN = ['razz', 'tine', 'bartedalen'];
const quests = []; // the journal's quests ({ id, data }), loaded after logging in
const revealed = new Set();
const seesAll = () => document.body.dataset.role === 'dm';
const isSecretable = (p) => views.world.places.includes(p) && p.tier !== 'unnamed';
const knows = (p) => !isSecretable(p) || seesAll() || revealed.has(p.id);

// Places an active quest leads to (that this viewer can see) get a scroll on the map.
const questFor = (p) => quests.find((q) => q.data.place === p.id && (q.data.status ?? 'active') === 'active' && (seesAll() || q.data.shown !== false));

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
  saveTimer = setTimeout(() => saveWorld({ sky, party: partyAt }).catch((err) => toast(explain(err))), 400);
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
  applyParty();
  skyPanel.render();
}
let watchingWorld = null;
async function loadWorldState() {
  try { useWorld(await loadWorld()); } catch (err) { console.warn('World state not available yet:', err.message); }
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
const party = [];
const owners = new Map(); // character id -> profile id of the player
const screens = {
  status: document.getElementById('status'), party: document.getElementById('party'),
  combat: document.getElementById('combat'), fight: document.getElementById('fight'),
  bestiary: document.getElementById('bestiary'),
  journal: document.getElementById('journal'),
};
let bestiaryScreen = null;
let combatScreen = null; // the DM's controls
let combatView = null;   // the players' view of a fight

function showScreen(id) {
  // The Combat tab opens the DM's controls, or the player's view of the fight.
  if (id === 'combat' && document.body.dataset.role !== 'dm') id = 'fight';
  if (id === screen) return;
  screen = id;
  const tab = id === 'fight' ? 'combat' : id;
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
  if (id === 'combat') combatScreen.start(); else combatScreen?.stop();
  if (id === 'fight') combatView.start(); else combatView?.stop();
  if (id === 'bestiary') bestiaryScreen.start(); else bestiaryScreen?.stop();
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
  roleChip.innerHTML = hero ? `
    <span class="bar__face" style="--hero:${escHtml(hero.colour)}">${portraitImg(heroPortrait(hero), { name: hero.name, colour: hero.colour })}</span>
    <span class="bar__me-text">
      <small>${viewAs ? 'Viewing as' : `Level ${hero.level} ${escHtml(hero.class)}`}</small>
      <b>${escHtml(hero.name)}</b>
      <span class="bar__hp${hpTone(hero)}"><i style="width:${Math.round(Math.max(0, hero.hp.current / hero.hp.max) * 100)}%"></i><em>${hero.hp.current}/${hero.hp.max}</em></span>
    </span>`
    : `<span class="bar__face bar__face--dm">${icon('crown')}</span><span class="bar__me-text"><b title="Dungeon Master">DM</b></span>`;
  barParty.innerHTML = party.filter((c) => c.id !== heroId).map((c) => `
    <button type="button" class="bar__mate${hpTone(c)}" data-hero="${escHtml(c.id)}" title="${escHtml(c.name)}: ${c.hp.current} of ${c.hp.max} HP" style="--hero:${escHtml(c.colour)}">
      <span class="bar__face">${portraitImg(heroPortrait(c), { name: c.name, colour: c.colour })}</span>
      <em>${c.hp.current}</em>
    </button>`).join('');
}
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
    applyRow({ id: c.id, owner: null, data: c });
    showScreen('status');
    statusScreen.showCharacter(c.id);
    toast(`${c.name} joined the party. A player can now pick them.`);
  },
});
const startScreen = createStartScreen(document.getElementById('start'), { onLoggedIn: enter, onCreateHero: () => creator.open() });

function drawParty() {
  const open = (id) => { showScreen('status'); statusScreen.showCharacter(id); };
  const dm = me?.dm && !viewAs;
  renderParty(screens.party, party, open, dm ? { onNew: () => creator.open(), onManage: (id) => manager.open(id), onEveryone: everyone } : {});
}

// The Dungeon Master's tools for heroes (Party → Manage).
const manager = createHeroManager(document.getElementById('manage'), {
  party,
  onSave(c) { saveHero(c); heroChanged(c.id); },
});
function everyone(what, amount) {
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
}

const saveHero = (c) => saveCharacter(c).catch((err) => toast(`Could not save: ${explain(err)}`));
async function removeHero(c) {
  try {
    await deleteCharacter(c.id);
    applyRow({ id: c.id, deleted: true });
    toast(`${c.name} was deleted.`);
  } catch (err) { toast(`Could not delete: ${explain(err)}`); }
}
statusScreen = createStatusScreen(screens.status, party, { onChange: saveHero, onDelete: removeHero });
combatScreen = createCombatScreen(screens.combat, { party, onHeroChange: saveHero, onPublic: publishFight, onSave: saveFightSoon });

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
bestiaryScreen = createBestiaryScreen(screens.bestiary, { onChanged: () => combatScreen.refresh() });

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
    bestiaryScreen.refresh();
    combatScreen.refresh();
  });
  bestiaryScreen.refresh();
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
    showScreen('fight');
  }
  if (player && !state.active && screen === 'fight') showScreen('status');
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
  party.splice(0, party.length, ...rows.map((r) => r.data));
  owners.clear();
  for (const r of rows) owners.set(r.id, r.owner);
}

// A character changed (or was deleted) somewhere: update it here and redraw what shows it.
function applyRow(row) {
  const i = party.findIndex((c) => c.id === row.id);
  if (row.deleted) {
    if (i < 0) return;
    party.splice(i, 1);
    owners.delete(row.id);
    // A player whose hero was deleted goes back to pick or make a new one.
    if (me && !me.dm && me.heroId === row.id) { location.reload(); return; }
    if (viewAs === row.id) previewAs(null);
  } else {
    owners.set(row.id, row.owner);
    if (me && !me.dm && me.heroId === row.id && i >= 0) tellPlayer(party[i], row.data);
    if (i >= 0) party[i] = row.data; else party.push(row.data);
  }
  manager.refresh(row.id);
  heroChanged(row.id);
}

// Tells a player what the Dungeon Master just did to their hero.
function tellPlayer(before, after) {
  const news = [];
  if (after.level > before.level) news.push(`You reached level ${after.level}!`);
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
  if (me.dm) await restoreFight();
  loadDiceLog();
  loadJournal();
  showScreen(me.dm ? 'map' : combatView.active ? 'fight' : 'status');
}

// --- Who the app is showing things for -------------------------------------------------------
// A player always sees the app as their own hero. The Dungeon Master sees
// everything, but can preview the app exactly as one of the players sees it.
let me = null;      // { dm, heroId } for the logged-in person
let viewAs = null;  // hero id the DM is previewing as, or null
const roleMenu = document.getElementById('role-menu');

function applyView() {
  const heroId = me.dm ? viewAs : me.heroId;
  document.body.dataset.role = heroId ? 'player' : 'dm';
  // The bar shows whose view this is; for the DM, its "you" button is also the view switcher.
  bar.hidden = false;
  drawBar();
  statusScreen.setDm(me.dm);
  statusScreen.setPlayer(heroId);
  applyFog();
  journalScreen.refresh();
  if (screen === 'party') drawParty();
}

function previewAs(heroId) {
  viewAs = heroId;
  applyView();
  showScreen(heroId ? (combatView.active ? 'fight' : 'status') : 'map');
}

roleChip.addEventListener('click', (e) => {
  e.stopPropagation();
  roleMenu.innerHTML = `
    ${me.dm ? `
      <p class="role-menu__h">View the app as</p>
      <button type="button" data-view=""${viewAs ? '' : ' class="is-on"'}><i style="background:#3b2f22"></i>Dungeon Master</button>
      ${party.map((c) => `<button type="button" data-view="${c.id}"${c.id === viewAs ? ' class="is-on"' : ''}><i style="background:${c.colour}"></i>${c.name}</button>`).join('')}
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
  quests,
  canEdit: () => seesAll(),
  places: () => views.world.places.filter((p) => p.tier !== 'unnamed').map((p) => ({ id: p.id, name: p.name })),
  placeName(id) {
    const p = views.world.places.find((x) => x.id === id);
    return p ? (knows(p) ? p.name : 'An unknown place') : null;
  },
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
let watchingQuests = null;
async function loadJournal() {
  try {
    quests.splice(0, quests.length, ...(await loadQuests()));
  } catch (err) { console.warn('Journal not available yet:', err.message); return; }
  watchingQuests ??= watchQuests((event, row) => {
    const i = quests.findIndex((q) => q.id === row.id);
    if (event === 'DELETE') { if (i >= 0) quests.splice(i, 1); } else if (i >= 0) quests[i] = row; else quests.push(row);
    if (event === 'INSERT' && me && !seesAll() && row.data.shown !== false) toast(`📜 New quest: ${row.data.title}`);
    journalScreen.refresh();
    applyFog();
  });
  journalScreen.refresh();
  applyFog();
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

if (import.meta.env.DEV) window.__debug = { renderer, get view() { return view; } };
document.body.classList.add('is-ready');

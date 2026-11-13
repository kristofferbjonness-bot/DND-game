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
import { attachTouchGestures } from './fx/touchGestures.js';
import { createStatusScreen } from './status/statusScreen.js';
import { renderParty } from './status/partyScreen.js';
import { createCombatScreen } from './combat/combatScreen.js';
import { createCombatView } from './combat/combatView.js';
import { CHARACTERS as STARTING_HEROES } from './data/characters.js';
import { createStartScreen } from './start/startScreen.js';
import { supabase, myProfile, loadCharacters, seedCharacters, saveCharacter, watchCharacters, signOut, explain, encounterChannel } from './net/backend.js';
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

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
app.appendChild(labelRenderer.domElement);

function addSun(scene, { color = '#fff0d4', intensity = 2.3, position = [-70, 110, 50], extent = 130, hemi = 1.5 }) {
  scene.add(new THREE.HemisphereLight('#fff7e8', '#8d7c62', hemi));
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.set(...position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(TOUCH ? 2048 : 4096, TOUCH ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent * 0.8, bottom: -extent * 0.8, near: 10, far: 450 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun);
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
  const sky = new THREE.Color('#cfe9f0');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 260, 520);
  addSun(scene, { extent: grid.cols * 0.62 });
  scene.add(buildTerrain());

  const places = LOCATIONS.map((loc) => {
    let [cx, cz] = pixelToCell(loc.px);
    const hasTown = loc.tier === 'city' || loc.tier === 'local' || loc.tier === 'unnamed';
    if (hasTown) [cx, cz] = nearestLand(cx, cz);
    const [x, z] = cellToWorld(cx, cz);
    const ground = loc.tier === 'water' ? WATER_LEVEL : surfaceY(cx, cz);
    return { ...loc, cx, cz, x, z, ground, hasTown };
  });
  const towns = places.filter((p) => p.hasTown);
  scene.add(buildPlants((x, z) => towns.some((p) => Math.abs(p.cx - x) <= 3 && Math.abs(p.cz - z) <= 3)));
  const clouds = buildClouds();
  scene.add(clouds);

  const spinners = [];
  for (const p of towns) {
    const town = buildLandmark(p.style);
    town.scale.setScalar(p.tier === 'city' ? 1.5 : 1.2);
    town.position.set(p.x, p.ground, p.z);
    scene.add(town);
    if (town.userData.spin) spinners.push(town.userData.spin);
  }

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1200);
  const view = {
    id: 'world',
    title: 'World Map',
    scene, camera, places,
    controls: makeControls(camera, { min: 18, max: 240 }),
    start: { target: new THREE.Vector3(0, 0, 8), offset: new THREE.Vector3(0, 175, 120) },
    bounds: [grid.cols / 2, grid.rows / 2],
    focusDistance: (p) => ({ continent: 200, region: 70, water: 60 }[p.tier] ?? 38),
    listTiers: ['city', 'local', 'region', 'water', 'continent'],
    shadowEvery: 4, // drifting clouds cast shadows
    update(dt) {
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
  scene.background = new THREE.Color(def.sky);
  scene.fog = new THREE.Fog(def.sky, 240, 480);
  addSun(scene, { ...def.sun, extent: size * 0.75 });
  vox.render(scene);

  // Voxel positions -> world positions (the slab is centred on the origin).
  const half = size / 2;
  const places = raw.map((p) => ({
    ...p, x: p.pos[0] - half + 0.5, ground: p.pos[1], z: p.pos[2] - half + 0.5,
  }));

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1200);
  const view = {
    id,
    title: def.name,
    scene, camera, places,
    controls: makeControls(camera, { min: 14, max: 240 }),
    start: { target: new THREE.Vector3(4, 6, 4), offset: new THREE.Vector3(70, 105, 95) },
    bounds: [half, half],
    focusDistance: (p) => (p.tier === 'district' ? 60 : 46),
    listTiers: ['district', 'spot'],
    update() {},
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
  placesMenu.open = false;
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

// Tall phone screens see less from side to side, so a city's opening view
// steps back a little further to keep the whole city in frame.
function fitScale(v) {
  return v.id === 'world' ? 1 : THREE.MathUtils.clamp(1 / v.camera.aspect, 1, 1.5);
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

let selected = null;
function select(p) {
  if (selected) selected.label.classList.remove('is-selected');
  selected = p;
  if (!p) { panel.hidden = true; return; }
  p.label.classList.add('is-selected');
  panelTitle.textContent = p.tier === 'unnamed' ? 'Unnamed place' : p.name;
  panelSub.textContent = p.subtitle || 'Marked on your world map';
  panelText.textContent = p.text || 'No lore written yet.';
  panelText.classList.toggle('is-empty', !p.text);
  if (p.image) { panelImg.src = p.image; panelImg.alt = p.name; panelImg.hidden = false; }
  else panelImg.hidden = true;
  panelAction.hidden = !p.cityMap;
  panelAction.onclick = p.cityMap ? () => openCity(p.cityMap) : null;
  panel.hidden = false;
  flyTo(new THREE.Vector3(p.x, p.ground, p.z), view.focusDistance(p) * fitScale(view));
}

// --- HUD ---------------------------------------------------------------------------------------
const list = document.getElementById('places');
const homeButton = document.getElementById('home');
const backButton = document.getElementById('back');
const viewTitle = document.getElementById('view-title');
const placesMenu = document.querySelector('.hud--places details');
function buildPlacesList() {
  list.replaceChildren();
  for (const tier of view.listTiers) {
    for (const p of view.places.filter((q) => q.tier === tier)) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.name;
      b.className = `places__item places__item--${tier}`;
      b.addEventListener('click', () => { placesMenu.open = false; select(p); });
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

// --- Labels: show by zoom, shrink with distance, hide ones that overlap -------------------------
// Earlier tiers win when two names collide; the selected place always shows.
const LABEL_PRIORITY = ['city', 'district', 'continent', 'local', 'spot', 'region', 'water', 'unnamed'];
const labelOrder = (p) => (p.label.classList.contains('is-selected') ? -1 : LABEL_PRIORITY.indexOf(p.tier));

function updateLabels(dist) {
  // Names grow a little as you zoom in and shrink when far away (phones shrink more).
  const scale = THREE.MathUtils.clamp((TOUCH ? 95 : 130) / dist, TOUCH ? 0.7 : 0.8, 1.1);
  document.documentElement.style.setProperty('--label-scale', scale.toFixed(3));

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
};
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
  if (id === 'party') { // re-rendered each time, so AC and HP follow gear changes
    renderParty(screens.party, party, (characterId) => {
      showScreen('status');
      statusScreen.showCharacter(characterId);
    });
  }
  if (id === 'combat') combatScreen.start(); else combatScreen?.stop();
  if (id === 'fight') combatView.start(); else combatView?.stop();
  if (id === 'map') clock.getDelta(); // no time jump after being away
}
document.querySelector('.topnav').addEventListener('click', (e) => {
  const btn = e.target.closest('.topnav__tab');
  if (btn) showScreen(btn.dataset.screen);
});
document.body.dataset.screen = 'map';

// --- Start: log in, load the party, and go in as the DM or a player ---------------------------
const roleChip = document.getElementById('role');
const startScreen = createStartScreen(document.getElementById('start'), { onLoggedIn: enter });
let watching = null;

const saveHero = (c) => saveCharacter(c).catch((err) => toast(`Could not save: ${explain(err)}`));
statusScreen = createStatusScreen(screens.status, party, { onChange: saveHero });
combatScreen = createCombatScreen(screens.combat, { party, onHeroChange: saveHero, onPublic: publishFight });
combatView = createCombatView(screens.fight, { party });

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

// A character changed somewhere: update it here and redraw what shows it.
function applyRow(row) {
  owners.set(row.id, row.owner);
  const i = party.findIndex((c) => c.id === row.id);
  if (i >= 0) party[i] = row.data; else party.push(row.data);
  statusScreen.refresh(row.id);
  combatScreen.refresh();
  combatView.refresh();
  if (screen === 'party') {
    renderParty(screens.party, party, (id) => { showScreen('status'); statusScreen.showCharacter(id); });
  }
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

  const mine = rows.find((r) => r.owner === profile.id);
  if (profile.role !== 'dm' && !mine) { startScreen.showClaim(rows); return; }

  watching ??= watchCharacters(applyRow);
  startScreen.hide();
  me = { dm: profile.role === 'dm', heroId: mine?.id ?? null };
  viewAs = null;
  applyView();
  openFightChannel();
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
  const hero = party.find((c) => c.id === heroId);
  document.body.dataset.role = heroId ? 'player' : 'dm';
  // The badge shows whose view this is; for the DM it is also the view switcher.
  roleChip.textContent = !me.dm ? hero.name : viewAs ? `Viewing as ${hero.name}` : 'Dungeon Master';
  roleChip.style.setProperty('--badge', heroId ? hero.colour : '#3b2f22');
  roleChip.classList.toggle('is-previewing', Boolean(viewAs));
  roleChip.hidden = false;
  statusScreen.setPlayer(heroId);
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
  combatView.show({ active: false });
  document.body.dataset.fight = '';
  me = null;
  viewAs = null;
  roleChip.hidden = true;
  delete document.body.dataset.role;
  showScreen('map');
  startScreen.show();
});
document.addEventListener('click', (e) => {
  if (!roleMenu.hidden && !roleMenu.contains(e.target)) roleMenu.hidden = true;
});

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
// Phones held upright show the "turn sideways" screen; nothing is drawn meanwhile.
const portraitPhone = window.matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 640px)');

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (portraitPhone.matches || screen !== 'map') return;
  applyKeys(dt);
  updateFlight(dt);
  updateSpin(dt);
  view.controls.update();
  clampTarget();
  view.update(dt);
  frame++;
  if (view.shadowEvery && frame % view.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
  const dist = view.camera.position.distanceTo(view.controls.target);
  composer.render();
  labelRenderer.render(view.scene, view.camera);
  updateLabels(dist);
  compassNeedle.style.transform = `rotate(${azimuth()}rad)`;
});

if (import.meta.env.DEV) window.__debug = { renderer, get view() { return view; } };
document.body.classList.add('is-ready');

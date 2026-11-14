// The 3D battlefield, seen from a little way off like a Pokémon battle: the
// heroes stand on the left, the enemies on the right, each on a round pad.
// On a phone held upright the camera looks from behind the heroes instead, so
// the heroes are at the bottom of the screen and the enemies at the top.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bevelBox } from '../fx/bevelBox.js';
import { hash } from '../city/vox.js';
import { buildFigure, buildMonsterFigure } from '../character/model.js';
import { disposeTree } from '../fx/dispose.js';
import { AREAS, SCALE, toWorld } from '../scene/areas.js';

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
  // The renderer and camera controls are made the first time a fight is shown.
  let renderer = null, controls = null, touching = false;
  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = (area?.mood ?? PLAIN).exposure;
    container.appendChild(renderer.domElement);
    makeControls();
    container.addEventListener('pointerdown', () => { touching = true; });
    window.addEventListener('pointerup', () => { touching = false; });
  }

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
  const hemi = scene.children.find((o) => o.isHemisphereLight);
  // The ground: the plain round arena, or one of the scene areas (areas.js).
  let ground = arena(), areaId = null, area = null, standY = 0;
  scene.add(ground);
  const PLAIN = { bg: '', sky: '#fff6ea', ground: '#a99a8c', hemi: 1.5, sun: '#ffe9cf', sunPower: 2.4, sunAt: [-30, 60, 40], exposure: 1.05 };
  function setArena(id) {
    id = AREAS[id] ? id : null;
    if (id === areaId && ground) return;
    const changed = Boolean(camera.userData.sized);
    areaId = id;
    disposeTree(ground); scene.remove(ground);
    area = id ? AREAS[id].build() : null;
    if (area) { ground = new THREE.Group(); area.v.render(ground); ground.scale.setScalar(SCALE); standY = SCALE; } else { ground = arena(); standY = 0; }
    scene.add(ground);
    const m = area?.mood ?? PLAIN;
    container.style.background = m.bg;
    hemi.color.set(m.sky); hemi.groundColor.set(m.ground); hemi.intensity = m.hemi;
    sun.color.set(m.sun); sun.intensity = m.sunPower; sun.position.set(...m.sunAt);
    if (area) sun.position.multiplyScalar(2);
    if (renderer) renderer.toneMappingExposure = m.exposure;
    Object.assign(sun.shadow.camera, area ? { left: -75, right: 75, top: 75, bottom: -75, far: 400 } : { left: -60, right: 60, top: 55, bottom: -55, far: 250 });
    sun.shadow.camera.updateProjectionMatrix();
    if (changed && controls) resetView();
  }
  // Where fighters stand: in an area, where people stand in its scenes (heroes at the front,
  // enemies further in), so a fight starts where the scene was.
  const centre = (pts) => ({ x: pts.reduce((a, p) => a + p[0], 0) / pts.length, z: pts.reduce((a, p) => a + p[1], 0) / pts.length });

  const fighters = new THREE.Group();
  scene.add(fighters);
  let actors = []; // { key, group, figure, down, flash }

  function place(figure, [x, z], facing, padColour, key) {
    // holder (the spot and its pad) > mover (dashes and dodges) > body (faces
    // the enemy, falls over) > lean (leans into a swing) > the figure.
    const holder = new THREE.Group();
    holder.position.set(x, standY, z);
    holder.add(pad(4, padColour));
    const mover = new THREE.Group();
    const body = new THREE.Group();
    const lean = new THREE.Group();
    lean.add(figure.group);
    body.add(lean);
    body.rotation.y = Math.atan2(facing.x - x, facing.z - z);
    mover.add(body);
    holder.add(mover);
    fighters.add(holder);
    const height = new THREE.Box3().setFromObject(figure.group).max.y;
    actors.push({ key, holder, mover, body, lean, figure, height, down: 0, isDown: false, shake: 0, incoming: 0, downAfter: null });
  }

  // heroes: character objects; enemies: [{ uid, type }].
  function setFighters(heroes, enemies) {
    for (const old of [...fighters.children, ...fx.children]) disposeTree(old);
    fighters.clear();
    actors = [];
    effects.length = 0;
    fx.clear();
    setActive(null);
    if (camera.userData.sized) resetView();
    const heroSpots = area ? area.heroSpots.map(toWorld) : HERO_SPOTS;
    const enemySpots = area ? area.npcSpots.map(toWorld) : ENEMY_SPOTS;
    const heroCentre = area ? centre(heroSpots.slice(0, Math.max(1, heroes.length))) : { x: -25, z: 12 };
    const enemyCentre = area ? centre(enemySpots.slice(0, Math.max(1, enemies.length))) : { x: 28, z: -16 };
    heroes.forEach((c, i) => {
      const figure = buildFigure(c);
      if (figure) place(figure, heroSpots[i % heroSpots.length], enemyCentre, '#9fb6d6', `hero:${c.id}`);
    });
    enemies.forEach((e, i) => {
      const figure = buildMonsterFigure(e.model);
      if (figure) place(figure, enemySpots[i % enemySpots.length], heroCentre, '#d6a49f', `enemy:${e.uid}`);
    });
  }

  // Knocked out (0 HP) fighters fall over; a hit makes them shake. While an
  // attack is still on its way, falling waits until it lands.
  function setDown(key, isDown) {
    const a = actors.find((x) => x.key === key);
    if (!a) return;
    if (a.incoming > 0) a.downAfter = isDown; else a.isDown = isDown;
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

  // --- Attack animations ------------------------------------------------------------------------
  // attack({ from, to, style: 'melee' | 'arrow' | 'thrown' | 'magic', hit, crit, colour })
  const effects = []; // { age, dur, step(t 0–1, dt), end() }
  const fx = new THREE.Group();
  scene.add(fx);
  const glow = (colour, opacity = 1) => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, toneMapped: false, depthWrite: false });
  const ease = (t) => t * t * (3 - 2 * t);
  const SPARK = new THREE.IcosahedronGeometry(0.5, 0);
  SPARK.userData.shared = true;
  const worldPos = (a, up = 0.55) => a.holder.position.clone().add(a.mover.position).setY(standY + a.height * up);

  function play(dur, step, end) { effects.push({ age: 0, dur, step, end }); }

  // What happens to the target when the blow lands (or misses).
  function impact(target, { hit: hits, crit, colour }, at) {
    target.incoming = Math.max(0, target.incoming - 1);
    if (target.downAfter !== null && target.incoming === 0) { target.isDown = target.downAfter; target.downAfter = null; }
    if (!hits) { // a quick sidestep
      const side = new THREE.Vector3(Math.random() < 0.5 ? -1 : 1, 0, 0.4).normalize().multiplyScalar(3);
      play(0.45, (t) => target.mover.position.copy(side).multiplyScalar(Math.sin(Math.PI * t)));
      return;
    }
    target.shake = crit ? 0.6 : 0.35;
    const burst = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), glow(colour ?? '#fff3c4', 0.85));
    burst.position.copy(at);
    fx.add(burst);
    const size = crit ? 9 : 5;
    play(crit ? 0.5 : 0.35, (t) => { burst.scale.setScalar(1 + size * ease(t)); burst.material.opacity = 0.85 * (1 - t); },
      () => { fx.remove(burst); disposeTree(burst); });
  }

  function slash(attacker, dir, crit) {
    const arc = new THREE.Mesh(new THREE.RingGeometry(2.6, 5.6, 28, 1, 0, Math.PI * 0.9), glow('#fffbea', 0.95));
    arc.material.side = THREE.DoubleSide;
    const holder = new THREE.Group();
    holder.position.copy(worldPos(attacker, 0.5)).addScaledVector(dir, 2.5);
    holder.rotation.y = Math.atan2(dir.x, dir.z);
    arc.rotation.set(-Math.PI / 2 + 0.5, 0, 0);
    holder.add(arc);
    if (crit) holder.scale.setScalar(1.5);
    fx.add(holder);
    play(0.36, (t) => { arc.rotation.z = -1.6 + 2.6 * ease(t); arc.material.opacity = 0.95 * (1 - t * t); },
      () => { fx.remove(holder); disposeTree(holder); });
  }

  function projectile(style, colour) {
    const g = new THREE.Group();
    if (style === 'arrow') {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 3.4), new THREE.MeshStandardMaterial({ color: '#8a5a34' }));
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.7), new THREE.MeshStandardMaterial({ color: '#dfe6ee' }));
      tip.position.z = 1.9;
      const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.6), new THREE.MeshStandardMaterial({ color: '#f1ece2' }));
      fletch.position.z = -1.5;
      g.add(shaft, tip, fletch);
      g.scale.setScalar(1.5);
    } else if (style === 'thrown') {
      const spin = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.5), new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.4 }));
      blade.position.y = 0.6;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.45), new THREE.MeshStandardMaterial({ color: '#3a2a20' }));
      grip.position.y = -0.8;
      spin.add(blade, grip);
      g.add(spin);
      g.userData.spin = spin;
      g.scale.setScalar(1.8);
    } else {
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), glow('#ffffff')));
      const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), glow(colour ?? '#b98cff', 0.6));
      g.add(halo);
      g.userData.halo = halo;
    }
    return g;
  }

  function attack(evt) {
    const from = actors.find((x) => x.key === evt.from), to = actors.find((x) => x.key === evt.to);
    if (!to) return;
    if (!from || from === to) { hit(to.key); return; }
    to.incoming += 1;
    const start = worldPos(from), target = worldPos(to, 0.5);
    const dir = target.clone().sub(start).setY(0).normalize();

    if (evt.style === 'melee') {
      // Dash in, swing, and step back.
      const reach = to.holder.position.clone().sub(from.holder.position).setY(0);
      const stop = reach.clone().multiplyScalar(Math.max(0, (reach.length() - 7) / reach.length()));
      let struck = false;
      play(1.05, (t) => {
        const go = t < 0.35 ? ease(t / 0.35) : t < 0.62 ? 1 : 1 - ease((t - 0.62) / 0.38);
        from.mover.position.copy(stop).multiplyScalar(go);
        from.mover.position.y = Math.sin(Math.PI * Math.min(1, t / 0.35)) * 1.2 * (t < 0.35 ? 1 : 0);
        from.lean.rotation.x = t < 0.33 ? 0.15 : t < 0.6 ? 0.15 + 0.45 * Math.sin(Math.PI * (t - 0.33) / 0.27) : 0;
        if (!struck && t >= 0.42) { struck = true; slash(from, dir, evt.crit); impact(to, evt, target); }
      }, () => { from.mover.position.set(0, 0, 0); from.lean.rotation.x = 0; });
      return;
    }

    // Shoot, throw or cast: a little wind-up, then the missile flies in an arc.
    play(0.3, (t) => { from.lean.rotation.x = -0.25 * Math.sin(Math.PI * t); }, () => { from.lean.rotation.x = 0; });
    const end = evt.hit ? target : target.clone()
      .add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.random() < 0.5 ? -5 : 5))
      .addScaledVector(dir, 12).setY(1);
    const speed = { arrow: 75, thrown: 50, magic: 42 }[evt.style] ?? 60;
    const lift = { arrow: 7, thrown: 4, magic: 2.5 }[evt.style] ?? 4;
    const m = projectile(evt.style, evt.colour);
    m.visible = false;
    fx.add(m);
    const trail = [];
    let landed = false;
    const point = (t) => start.clone().lerp(end, t).setY(start.y + (end.y - start.y) * t + Math.sin(Math.PI * t) * lift);
    setTimeout(() => {
      m.visible = true;
      play(start.distanceTo(end) / speed, (t) => {
        const p = point(t);
        m.position.copy(p);
        m.lookAt(point(Math.min(1, t + 0.02)));
        if (m.userData.spin) m.userData.spin.rotation.x = t * 22;
        if (m.userData.halo) {
          m.userData.halo.scale.setScalar(1 + Math.sin(t * 40) * 0.15);
          if (Math.random() < 0.7) { // sparkling trail
            const s = new THREE.Mesh(SPARK, glow(evt.colour ?? '#b98cff', 0.8));
            s.position.copy(p);
            fx.add(s);
            trail.push({ s, life: 1 });
          }
        }
        if (!landed && evt.hit && t >= 1) { landed = true; impact(to, evt, target); }
      }, () => {
        fx.remove(m);
        disposeTree(m);
        if (!landed) impact(to, evt, target);
      });
    }, 180);
    play(3, (t, dt) => { // fade the trail
      for (const p of trail) {
        p.life -= dt * 2.5;
        p.s.scale.setScalar(Math.max(0.01, p.life));
        p.s.material.opacity = Math.max(0, p.life) * 0.8;
      }
    }, () => { for (const p of trail) { fx.remove(p.s); p.s.material.dispose(); } });
  }

  // Look around: drag (one finger) to turn, pinch or scroll to zoom,
  // right-drag (two fingers) to move. The view resets for each new encounter.
  function makeControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 40;
    controls.maxDistance = 260;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.35;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }

  let upright = false;
  function resetView() {
    upright = camera.aspect < 0.8;
    if (area) { // from the front, like the Scene
      const d = upright ? 225 * Math.min(1.5, 0.75 / camera.aspect) : container.clientHeight < 500 ? 150 : 225;
      controls.target.set(0, 12, 4);
      camera.position.set(0, d * 0.55, 4 + d * 0.84);
      controls.update();
      return;
    }
    controls.target.set(2, 2, -2);
    if (upright) {
      // Along the line from the heroes to the enemies, from behind the heroes.
      const d = 150 * Math.max(1, 0.6 / camera.aspect);
      camera.position.set(2 - 0.86 * d, 0.62 * d, -2 + 0.5 * d);
    } else {
      const fit = Math.max(1, 2 / (camera.aspect || 1));
      camera.position.set(-6 * fit, 62 * fit, 128 * fit);
    }
    controls?.update();
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const first = !camera.userData.sized;
    if (!renderer) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Turning the phone resets the view for the new shape.
    if (first || upright !== camera.aspect < 0.8) { camera.userData.sized = true; resetView(); }
  }
  new ResizeObserver(resize).observe(container);

  const clock = new THREE.Clock();
  let lastDraw = 0;
  function frame(now) {
    // 60 frames a second during attacks or while the camera is moved, 30 otherwise.
    if (!effects.length && !touching && now - lastDraw < 31) return;
    lastDraw = now;
    const dt = Math.min(clock.getDelta(), 0.05);
    controls.update();
    const t = clock.elapsedTime;
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.age += dt;
      const k = Math.min(1, e.age / e.dur);
      e.step(k, dt);
      if (k >= 1) { effects.splice(i, 1); e.end?.(); }
    }
    for (const a of actors) {
      if (!a.isDown) a.figure.update(t);
      a.down += ((a.isDown ? 1 : 0) - a.down) * Math.min(1, dt * 6);
      a.body.rotation.z = a.down * 1.45;
      a.body.position.y = a.down * 1.5;
      a.shake = Math.max(0, a.shake - dt);
      a.body.position.x = Math.sin(t * 60) * a.shake * 1.5;
      a.body.position.z = 0;
    }
    if (active) {
      marker.position.set(active.holder.position.x, standY + active.height + 5 + Math.sin(t * 3) * 0.8, active.holder.position.z);
      marker.rotation.y = t * 1.5;
    }
    renderer.render(scene, camera);
  }

  return {
    setFighters, setDown, hit, attack, setActive, setArena,
    start() { ensureRenderer(); clock.getDelta(); resize(); renderer.setAnimationLoop(frame); },
    stop() { renderer?.setAnimationLoop(null); },
  };
}

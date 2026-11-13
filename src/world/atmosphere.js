// Weather and time of day on the maps. The Dungeon Master sets the sky (see
// skyPanel.js); every device draws the same thing from that state:
//   { weather: 'sunny' | 'cloudy' | 'rain' | 'windy' | 'storm' | 'snow',
//     hour: 0–24, running: bool, setAt: ms, speed: game hours per real minute }
// While `running`, the hour moves on by itself from when it was set, so all
// devices agree without talking to each other.
import * as THREE from 'three';

export const WEATHER = {
  sunny: { name: 'Sunny', icon: '☀️' },
  cloudy: { name: 'Cloudy', icon: '⛅' },
  rain: { name: 'Rain', icon: '🌧️' },
  windy: { name: 'Windy', icon: '💨' },
  storm: { name: 'Storm', icon: '⛈️' },
  snow: { name: 'Snow', icon: '❄️' },
};

export const DEFAULT_SKY = { weather: 'sunny', hour: 13, running: false, setAt: 0, speed: 1 };

// The hour right now, 0–24.
export function currentHour(sky, now = Date.now()) {
  const h = sky.running ? sky.hour + ((now - sky.setAt) / 60000) * sky.speed : sky.hour;
  return ((h % 24) + 24) % 24;
}

export function partOfDay(h) {
  if (h < 5) return 'Night';
  if (h < 7) return 'Dawn';
  if (h < 11) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 17.5) return 'Afternoon';
  if (h < 20) return 'Dusk';
  return 'Night';
}
export const clockText = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

// Light through the day. `day` is the view's own sky colour at noon.
const KEYS = [
  { h: 0, sky: '#232842', sun: '#b9c4e6', sunI: 0.5, hemiSky: '#5d6684', hemiGround: '#2e2a32', hemiI: 0.6, exp: 0.95, night: 1 },
  { h: 4.5, sky: '#262b46', sun: '#b9c4e6', sunI: 0.5, hemiSky: '#5d6684', hemiGround: '#2e2a32', hemiI: 0.6, exp: 0.95, night: 1 },
  { h: 6.2, sky: '#efbfa4', sun: '#ffab73', sunI: 1.2, hemiSky: '#f6dccb', hemiGround: '#6f5a54', hemiI: 1.0, exp: 1.0, night: 0 },
  { h: 9, sky: 'day', sun: '#fff0d4', sunI: 2.2, hemiSky: '#fff7e8', hemiGround: '#8d7c62', hemiI: 1.45, exp: 1.05, night: 0 },
  { h: 16, sky: 'day', sun: '#fff0d4', sunI: 2.3, hemiSky: '#fff7e8', hemiGround: '#8d7c62', hemiI: 1.5, exp: 1.05, night: 0 },
  { h: 18.6, sky: '#eeb48e', sun: '#ffb27e', sunI: 1.3, hemiSky: '#f5d6c0', hemiGround: '#6f5a54', hemiI: 1.05, exp: 1.0, night: 0 },
  { h: 20.3, sky: '#33304f', sun: '#b9c4e6', sunI: 0.5, hemiSky: '#625f86', hemiGround: '#2e2a32', hemiI: 0.62, exp: 0.95, night: 1 },
  { h: 24, sky: '#232842', sun: '#b9c4e6', sunI: 0.5, hemiSky: '#5d6684', hemiGround: '#2e2a32', hemiI: 0.6, exp: 0.95, night: 1 },
];

// How each kind of weather changes the light. `grey` mixes the sky towards grey.
const MOODS = {
  sunny: { grey: 0, dim: 1, fog: 1, clouds: 1, cloudGrey: 0, wind: 1 },
  cloudy: { grey: 0.4, dim: 0.6, fog: 0.9, clouds: 1.6, cloudGrey: 0.25, wind: 1.3 },
  windy: { grey: 0.15, dim: 0.9, fog: 1, clouds: 1.2, cloudGrey: 0.1, wind: 5 },
  rain: { grey: 0.6, dim: 0.45, fog: 0.55, clouds: 1.9, cloudGrey: 0.5, wind: 1.8, rain: 1 },
  storm: { grey: 0.8, dim: 0.28, fog: 0.45, clouds: 2.2, cloudGrey: 0.72, wind: 4, rain: 1.7, lightning: true },
  snow: { grey: 0.45, dim: 0.6, fog: 0.6, clouds: 1.7, cloudGrey: 0.2, wind: 0.8, snow: 1 },
};

const c1 = new THREE.Color(), c2 = new THREE.Color(), GREY = new THREE.Color('#9aa1a8');
function mixKeys(h, day) {
  let i = 0;
  while (KEYS[i + 1].h < h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  const col = (ka, kb) => c1.set(ka === 'day' ? day : ka).lerp(c2.set(kb === 'day' ? day : kb), t).clone();
  const num = (k) => a[k] + (b[k] - a[k]) * t;
  return {
    sky: col(a.sky, b.sky), sun: col(a.sun, b.sun), hemiSky: col(a.hemiSky, b.hemiSky), hemiGround: col(a.hemiGround, b.hemiGround),
    sunI: num('sunI'), hemiI: num('hemiI'), exp: num('exp'), night: num('night'),
  };
}

// Falling rain or snow, and wind streaks: a box of particles that follows the
// camera's target. Sized to the view so it reads at any zoom.
function particles(count, kind) {
  const geo = new THREE.BufferGeometry();
  const perDrop = kind === 'snow' ? 1 : 2;
  const pos = new Float32Array(count * perDrop * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const seeds = Float32Array.from({ length: count * 3 }, () => Math.random());
  const mat = kind === 'snow'
    ? new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false })
    : new THREE.LineBasicMaterial({ color: kind === 'wind' ? '#ffffff' : '#d4e6f7', transparent: true, opacity: kind === 'wind' ? 0.22 : 0.6, depthWrite: false });
  const obj = kind === 'snow' ? new THREE.Points(geo, mat) : new THREE.LineSegments(geo, mat);
  obj.frustumCulled = false;
  obj.renderOrder = 5;
  return { obj, pos, seeds, count, kind, perDrop, t: 0 };
}

function moveParticles(p, dt, size, wind, amount) {
  p.t += dt;
  const n = Math.floor(p.count * Math.min(1, amount));
  const h = size * 0.7;
  for (let i = 0; i < p.count; i++) {
    const sx = p.seeds[i * 3], sy = p.seeds[i * 3 + 1], sz = p.seeds[i * 3 + 2];
    const o = i * p.perDrop * 3;
    if (i >= n) { p.pos.fill(0, o, o + p.perDrop * 3); continue; }
    let x, y, z, len = 0, dx = 0;
    if (p.kind === 'wind') {
      const speed = 0.9 + sy * 0.6;
      x = (((sx + p.t * speed * 0.25) % 1) - 0.5) * size * 2;
      y = 2 + sy * h * 0.5;
      z = (sz - 0.5) * size * 2;
      dx = size * (0.03 + sx * 0.03);
    } else {
      const fall = p.kind === 'snow' ? 0.06 + sx * 0.04 : 0.9 + sx * 0.5;
      y = (1 - ((sy + p.t * fall * (60 / h)) % 1)) * h;
      x = (sx - 0.5) * size * 2 + (p.kind === 'snow' ? Math.sin(p.t + sz * 20) * 1.5 : -wind * (h - y) * 0.05);
      z = (sz - 0.5) * size * 2;
      len = size * 0.035;
      dx = wind * len * 0.3;
    }
    p.pos[o] = x; p.pos[o + 1] = y; p.pos[o + 2] = z;
    if (p.perDrop === 2) { p.pos[o + 3] = x + dx; p.pos[o + 4] = y + len; p.pos[o + 5] = z; }
  }
  p.obj.geometry.attributes.position.needsUpdate = true;
}

// One per view. `lights` = { sun, hemi }; `daySky` the view's noon sky colour;
// `fog` = [near, far] added to the camera distance (so zooming out stays clear);
// `clouds` the drifting clouds, if the view has them; `touch` for lighter phones.
export function createAtmosphere(scene, { lights, daySky, fog = [140, 560], clouds = null, touch = false }) {
  const day = new THREE.Color(daySky);
  scene.background = new THREE.Color(daySky);
  scene.fog = new THREE.Fog(day, 200, 700);
  const sunHome = lights.sun.position.clone();
  const sunDist = sunHome.length();

  const holder = new THREE.Group();
  scene.add(holder);
  const rain = particles(touch ? 1400 : 3200, 'rain');
  const snow = particles(touch ? 900 : 2000, 'snow');
  const wind = particles(touch ? 90 : 180, 'wind');
  holder.add(rain.obj, snow.obj, wind.obj);

  let flash = 0, nextFlash = 3, lastSunKey = '';

  // Sets everything for this frame. Returns true when shadows should be redrawn.
  function update(sky, dt, { target, distance }) {
    const h = currentHour(sky);
    const mood = MOODS[sky.weather] ?? MOODS.sunny;
    const k = mixKeys(h, day);

    // Lightning in a storm: a quick double flash every few seconds.
    if (mood.lightning) {
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 1; nextFlash = 3 + Math.random() * 7; }
      if (flash > 0.55 && Math.random() < dt * 4) flash = 0.9;
    }
    flash = Math.max(0, flash - dt * 3.5);

    const skyCol = k.sky.clone().lerp(GREY.clone().multiplyScalar(0.55 + 0.45 * (1 - k.night)), mood.grey);
    skyCol.lerp(new THREE.Color('#e8ecff'), flash * 0.6);
    scene.background.copy(skyCol);
    scene.fog.color.copy(skyCol);
    scene.fog.near = distance * 0.5 + fog[0] * mood.fog;
    scene.fog.far = distance + fog[1] * mood.fog;

    // The sun (or the moon at night) crosses the sky from east to west.
    const night = k.night > 0.5;
    const a = night ? ((h + 12) % 24 - 6) / 12 * Math.PI : (h - 6) / 12 * Math.PI;
    const elev = Math.max(0.25, Math.sin(Math.min(Math.PI, Math.max(0, a))));
    lights.sun.position.set(-Math.cos(a) * sunDist * 0.8, elev * sunDist, sunHome.z);
    lights.sun.color.copy(k.sun);
    lights.sun.intensity = k.sunI * mood.dim;
    lights.hemi.color.copy(k.hemiSky).lerp(GREY, mood.grey * 0.5);
    lights.hemi.groundColor.copy(k.hemiGround);
    lights.hemi.intensity = k.hemiI * (0.75 + 0.25 * mood.dim) + flash * 2.5;

    if (clouds) clouds.userData.setLook?.({ scale: mood.clouds, grey: mood.cloudGrey, night: k.night, wind: mood.wind });

    const size = THREE.MathUtils.clamp(distance * 0.75, 25, 220);
    holder.position.set(target.x, target.y, target.z);
    rain.obj.visible = Boolean(mood.rain);
    if (mood.rain) moveParticles(rain, dt, size, mood.wind, mood.rain);
    snow.obj.visible = Boolean(mood.snow);
    if (mood.snow) moveParticles(snow, dt, size, mood.wind, 1);
    wind.obj.visible = mood.wind >= 4;
    if (wind.obj.visible) {
      wind.obj.material.opacity = 0.22 * (1 - k.night * 0.7);
      moveParticles(wind, dt, size, mood.wind, 1);
    }

    // Shadows only need redrawing when the sun has moved a little.
    const key = `${Math.round(h * 20)}:${sky.weather}`;
    const moved = key !== lastSunKey;
    lastSunKey = key;
    return { exposure: k.exp, moved };
  }
  return { update };
}

// The weather button on the map. Everyone sees the weather and the time; the
// Dungeon Master also gets the controls: weather, time of day, letting time
// pass, and moving the party.
import { WEATHER, currentHour, partOfDay, clockText } from './atmosphere.js';
import { icon } from '../ui/icons.js';

const WEATHER_ICON = { sunny: 'sun', cloudy: 'cloud', rain: 'rain', windy: 'windy', storm: 'storm', snow: 'snow' };
// Sky colours for the little dial in the bar (top, bottom).
const DIAL = {
  Night: ['#141a36', '#2d3366'], Dawn: ['#7d6aa6', '#f0a77c'], Morning: ['#79bde3', '#d9eedc'],
  Midday: ['#5aa9de', '#b9e0f2'], Afternoon: ['#74b3dc', '#efd9a8'], Dusk: ['#55457f', '#e98f5d'],
};

// The round sky in the bar: the sun (or moon) climbs and sets with the hour.
function dial(sky) {
  const h = currentHour(sky);
  const day = h >= 6 && h < 18;
  const t = day ? (h - 6) / 12 : ((h + 6) % 24) / 12;
  const x = 50 - Math.cos(Math.PI * t) * 30, y = 64 - Math.sin(Math.PI * t) * 36;
  const [a, b] = DIAL[partOfDay(h)];
  const grey = { cloudy: 0.25, rain: 0.45, storm: 0.6, snow: 0.3 }[sky.weather] ?? 0;
  return `<span class="dial" style="--sky-a:${a};--sky-b:${b};--grey:${grey}">
      <span class="dial__body" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">${icon(day ? 'sun' : 'moon')}</span>
      <span class="dial__ground"></span>
      ${sky.weather !== 'sunny' ? `<span class="dial__weather">${icon(WEATHER_ICON[sky.weather] ?? 'cloud')}</span>` : ''}
    </span>`;
}

const SPEEDS = [
  { v: 0.1, label: '1 hour every 10 minutes' },
  { v: 1, label: '1 hour every minute' },
  { v: 6, label: '1 hour every 10 seconds' },
];

// `world()` returns { sky, party }; `canEdit()` is true for the Dungeon Master.
// `onSky(changes)` and `onParty(changes)` apply a change; `onMoveParty()` starts
// placing the party on the map.
export function createSkyPanel({ button, panel, world, canEdit, onSky, onParty, onMoveParty }) {
  function head() {
    const { sky } = world();
    const h = currentHour(sky);
    const w = WEATHER[sky.weather] ?? WEATHER.sunny;
    return { icon: icon(WEATHER_ICON[sky.weather] ?? 'sun'), text: `${w.name}`, clock: clockText(h), time: `${clockText(h)} · ${partOfDay(h)}${sky.running ? '' : ' · time stopped'}` };
  }

  let lastButton = '';
  function drawButton(now, sky) {
    const html = `${dial(sky)}<span class="bar__sky-text"><b>${now.clock}</b><small>${now.text}</small></span>`;
    if (html === lastButton) return;
    lastButton = html;
    button.innerHTML = html;
    button.title = `${now.text}, ${now.time}`;
  }

  function render() {
    const { sky, party } = world();
    const now = head();
    drawButton(now, sky);
    if (panel.hidden) return;
    const edit = canEdit();
    const h = currentHour(sky);
    panel.innerHTML = `
      <div class="sky__head"><span class="sky__icon">${now.icon}</span><div><b>${now.text}</b><small>${now.time}</small></div></div>
      ${edit ? `
        <div class="sky__weather">
          ${Object.entries(WEATHER).map(([id, w]) => `<button type="button" data-weather="${id}"${id === sky.weather ? ' class="is-on"' : ''}>${icon(WEATHER_ICON[id])}${w.name}</button>`).join('')}
        </div>
        <label class="sky__label">Time of day <b class="sky__clock">${clockText(h)}</b></label>
        <input class="sky__time" type="range" min="0" max="23.75" step="0.25" value="${h.toFixed(2)}" aria-label="Time of day" />
        <div class="sky__row">
          <label class="toggle"><input type="checkbox" class="sky__run"${sky.running ? ' checked' : ''} /> Time passes</label>
          <select class="sky__speed" aria-label="How fast time passes">
            ${SPEEDS.map((s) => `<option value="${s.v}"${s.v === sky.speed ? ' selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="sky__row sky__party">
          <button type="button" class="sky__move">Move the party</button>
          <label class="toggle"><input type="checkbox" class="sky__shown"${party.shown !== false ? ' checked' : ''} /> Show on map</label>
        </div>` : ''}`;
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    render();
  });
  document.addEventListener('click', (e) => {
    // (the path still holds buttons that a re-render just replaced)
    if (!panel.hidden && !e.composedPath().some((el) => el === panel || el === button)) panel.hidden = true;
  });

  panel.addEventListener('click', (e) => {
    const w = e.target.closest('[data-weather]');
    if (w) { onSky({ weather: w.dataset.weather }); render(); return; }
    if (e.target.closest('.sky__move')) { panel.hidden = true; onMoveParty(); }
  });
  panel.addEventListener('input', (e) => {
    if (e.target.classList.contains('sky__time')) {
      const hour = Number(e.target.value);
      onSky({ hour, setAt: Date.now() });
      panel.querySelector('.sky__clock').textContent = clockText(hour);
      const now = head();
      panel.querySelector('.sky__head small').textContent = now.time;
      drawButton(now, world().sky);
    }
  });
  panel.addEventListener('change', (e) => {
    const { sky } = world();
    if (e.target.classList.contains('sky__run')) {
      onSky({ running: e.target.checked, hour: currentHour(sky), setAt: Date.now() });
    } else if (e.target.classList.contains('sky__speed')) {
      onSky({ speed: Number(e.target.value), hour: currentHour(sky), setAt: Date.now() });
    } else if (e.target.classList.contains('sky__shown')) {
      onParty({ shown: e.target.checked });
    } else return;
    render();
  });

  // Keep the clock on the button and in the panel moving.
  setInterval(() => {
    if (!world().sky.running) return;
    if (panel.hidden || !canEdit()) { render(); return; }
    if (document.activeElement?.classList.contains('sky__time')) return;
    const h = currentHour(world().sky);
    panel.querySelector('.sky__time').value = h.toFixed(2);
    panel.querySelector('.sky__clock').textContent = clockText(h);
    panel.querySelector('.sky__head small').textContent = head().time;
  }, 1000);

  return { render, close() { panel.hidden = true; } };
}

// The weather button on the map. Everyone sees the weather and the time; the
// Dungeon Master also gets the controls: weather, time of day, letting time
// pass, and moving the party.
import { WEATHER, currentHour, partOfDay, clockText } from './atmosphere.js';

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
    return { icon: w.icon, text: `${w.name}`, time: `${clockText(h)} · ${partOfDay(h)}${sky.running ? '' : ' · time stopped'}` };
  }

  function render() {
    const { sky, party } = world();
    const now = head();
    button.textContent = now.icon;
    button.title = `${now.text}, ${now.time}`;
    if (panel.hidden) return;
    const edit = canEdit();
    const h = currentHour(sky);
    panel.innerHTML = `
      <div class="sky__head"><span class="sky__icon">${now.icon}</span><div><b>${now.text}</b><small>${now.time}</small></div></div>
      ${edit ? `
        <div class="sky__weather">
          ${Object.entries(WEATHER).map(([id, w]) => `<button type="button" data-weather="${id}"${id === sky.weather ? ' class="is-on"' : ''}><i>${w.icon}</i>${w.name}</button>`).join('')}
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
    if (!panel.hidden && !panel.contains(e.target) && e.target !== button) panel.hidden = true;
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
      button.textContent = now.icon;
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

// Combat (Dungeon Master only): pick the heroes and enemies, then run the
// encounter on a Pokémon-style battlefield with a health box per fighter.
import { MONSTERS } from '../data/monsters.js';
import { derive } from '../character/rules.js';
import { createBattleScene } from './battleScene.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const MAX_ENEMIES = 6;

// `party` is the live list of characters; `onHeroChange(character)` saves a hero
// whose HP changed, so the player sees it on their own sheet.
export function createCombatScreen(root, { party, onHeroChange }) {
  root.innerHTML = `
    <div class="combat__setup">
      <div class="combat__col">
        <h2 class="combat__h"><span>1</span> Who is fighting?</h2>
        <ul class="combat__heroes-pick"></ul>
      </div>
      <div class="combat__col">
        <h2 class="combat__h"><span>2</span> Enemies</h2>
        <ul class="combat__enemies-pick"></ul>
      </div>
      <div class="combat__go">
        <p class="combat__summary"></p>
        <button type="button" class="combat__start">Start encounter</button>
      </div>
    </div>
    <div class="combat__battle" hidden>
      <div class="combat__stage"></div>
      <div class="combat__boxes combat__boxes--enemies"></div>
      <div class="combat__boxes combat__boxes--heroes"></div>
      <button type="button" class="combat__end">End encounter</button>
    </div>`;

  const setupEl = root.querySelector('.combat__setup');
  const battleEl = root.querySelector('.combat__battle');
  const heroPick = root.querySelector('.combat__heroes-pick');
  const enemyPick = root.querySelector('.combat__enemies-pick');
  const summary = root.querySelector('.combat__summary');
  const startBtn = root.querySelector('.combat__start');
  const enemyBoxes = root.querySelector('.combat__boxes--enemies');
  const heroBoxes = root.querySelector('.combat__boxes--heroes');
  const scene = createBattleScene(root.querySelector('.combat__stage'));

  const chosen = new Set();                    // hero ids
  const counts = Object.fromEntries(Object.keys(MONSTERS).map((k) => [k, 0]));
  let encounter = null;                         // { heroes: [id], enemies: [{ uid, type, name, hp, max, ac, model }] }
  let visible = false;

  // --- Setup ---------------------------------------------------------------------------
  function renderSetup() {
    heroPick.innerHTML = party.map((c) => `
      <li><button type="button" class="pick${chosen.has(c.id) ? ' is-on' : ''}" data-hero="${esc(c.id)}">
        <span class="pick__badge" style="background:${esc(c.colour)}">${esc(c.name[0])}</span>
        <span class="pick__who"><b>${esc(c.name)}</b><small>Level ${c.level} ${esc(c.class)} · ${c.hp.current}/${c.hp.max} HP</small></span>
        <span class="pick__check" aria-hidden="true"></span>
      </button></li>`).join('');
    enemyPick.innerHTML = Object.entries(MONSTERS).map(([type, m]) => `
      <li class="pick pick--static${counts[type] ? ' is-on' : ''}">
        <span class="pick__badge pick__badge--enemy">${esc(m.name[0])}</span>
        <span class="pick__who"><b>${esc(m.name)}</b><small>AC ${m.ac} · ${m.hp} HP · ${esc(m.kind)}</small></span>
        <span class="stepper">
          <button type="button" data-type="${type}" data-step="-1" aria-label="One fewer">−</button>
          <b>${counts[type]}</b>
          <button type="button" data-type="${type}" data-step="1" aria-label="One more">+</button>
        </span>
      </li>`).join('');
    const n = Object.values(counts).reduce((a, b) => a + b, 0);
    summary.textContent = `${chosen.size} hero${chosen.size === 1 ? '' : 'es'} against ${n} enem${n === 1 ? 'y' : 'ies'}`;
    startBtn.disabled = !chosen.size || !n;
  }

  heroPick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hero]');
    if (!b) return;
    if (chosen.has(b.dataset.hero)) chosen.delete(b.dataset.hero); else chosen.add(b.dataset.hero);
    renderSetup();
  });
  enemyPick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const total = Object.values(counts).reduce((a, c) => a + c, 0);
    const step = Number(b.dataset.step);
    if (step > 0 && total >= MAX_ENEMIES) return;
    counts[b.dataset.type] = Math.max(0, counts[b.dataset.type] + step);
    renderSetup();
  });

  startBtn.addEventListener('click', () => {
    const enemies = [];
    for (const [type, n] of Object.entries(counts)) {
      const m = MONSTERS[type];
      for (let i = 1; i <= n; i++) {
        enemies.push({ uid: `${type}-${i}`, type, name: n > 1 ? `${m.short ?? m.name} ${i}` : m.short ?? m.name, hp: m.hp, max: m.hp, ac: m.ac, model: m.model });
      }
    }
    encounter = { heroes: party.filter((c) => chosen.has(c.id)).map((c) => c.id), enemies };
    showBattle();
  });

  // --- Battle --------------------------------------------------------------------------
  const heroesInFight = () => encounter.heroes.map((id) => party.find((c) => c.id === id)).filter(Boolean);

  function box({ key, name, hp, max, ac }) {
    const pct = Math.max(0, Math.round((hp / max) * 100));
    const tone = pct > 50 ? 'ok' : pct > 20 ? 'low' : 'crit';
    return `
      <div class="hpbox${hp <= 0 ? ' is-down' : ''}" data-key="${esc(key)}">
        <div class="hpbox__top"><b>${esc(name)}</b><small>AC ${ac}</small></div>
        <div class="hpbox__row">
          <button type="button" class="hpbox__btn" data-key="${esc(key)}" data-step="-1" aria-label="Damage">−</button>
          <span class="hpbox__track"><span class="is-${tone}" style="width:${pct}%"></span></span>
          <button type="button" class="hpbox__btn" data-key="${esc(key)}" data-step="1" aria-label="Heal">+</button>
          <span class="hpbox__nums">${Math.max(0, hp)}/${max}</span>
        </div>
      </div>`;
  }

  function renderBoxes() {
    enemyBoxes.innerHTML = encounter.enemies.map((e) => box({ key: `enemy:${e.uid}`, name: e.name, hp: e.hp, max: e.max, ac: e.ac })).join('');
    heroBoxes.innerHTML = heroesInFight().map((c) => box({
      key: `hero:${c.id}`, name: c.name, hp: c.hp.current, max: c.hp.max, ac: derive(c).ac,
    })).join('');
    for (const e of encounter.enemies) scene.setDown(`enemy:${e.uid}`, e.hp <= 0);
    for (const c of heroesInFight()) scene.setDown(`hero:${c.id}`, c.hp.current <= 0);
  }

  root.querySelector('.combat__boxes--enemies').parentElement.addEventListener('click', (e) => {
    const b = e.target.closest('.hpbox [data-step]');
    if (!b) return;
    const [kind, id] = b.dataset.key.split(':');
    const step = Number(b.dataset.step);
    if (kind === 'enemy') {
      const enemy = encounter.enemies.find((x) => x.uid === id);
      enemy.hp = Math.min(enemy.max, Math.max(0, enemy.hp + step));
    } else {
      const c = party.find((x) => x.id === id);
      c.hp.current = Math.min(c.hp.max, Math.max(0, c.hp.current + step));
      onHeroChange?.(c);
    }
    if (step < 0) scene.hit(b.dataset.key);
    renderBoxes();
  });

  root.querySelector('.combat__end').addEventListener('click', () => {
    if (!confirm('End this encounter?')) return;
    encounter = null;
    showSetup();
  });

  function showBattle() {
    setupEl.hidden = true;
    battleEl.hidden = false;
    root.classList.add('is-battle');
    scene.setFighters(heroesInFight(), encounter.enemies);
    renderBoxes();
    if (visible) scene.start();
  }

  function showSetup() {
    scene.stop();
    battleEl.hidden = true;
    setupEl.hidden = false;
    root.classList.remove('is-battle');
    renderSetup();
  }

  return {
    start() {
      visible = true;
      if (encounter) { renderBoxes(); scene.start(); } else renderSetup();
    },
    stop() { visible = false; scene.stop(); },
    // A hero changed elsewhere (another device): update the health boxes.
    refresh() {
      if (!visible) return;
      if (encounter) renderBoxes(); else renderSetup();
    },
  };
}

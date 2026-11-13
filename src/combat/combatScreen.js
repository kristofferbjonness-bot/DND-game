// Combat (Dungeon Master only), in three steps:
//   1. Setup      pick the heroes and the enemies
//   2. Initiative type each d20 roll; the app adds the bonuses and sorts the turn order
//   3. Battle     a Pokémon-style field, turn by turn; the attack calculator turns
//                 the dice the table rolled into hits and damage using real stats
import { MONSTERS } from '../data/monsters.js';
import { derive, signed, parseDice, sneakAttackDice } from '../character/rules.js';
import { createBattleScene } from './battleScene.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const MAX_ENEMIES = 6;
const d20 = () => 1 + Math.floor(Math.random() * 20);
const plus = (n) => (n ? ` ${n > 0 ? '+' : '−'} ${Math.abs(n)}` : '');

// `party` is the live list of characters; `onHeroChange(character)` saves a hero
// whose HP changed, so the player sees it on their own sheet.
// `onPublic(state)` receives what players may see, after every change (see publicState).
export function createCombatScreen(root, { party, onHeroChange, onPublic }) {
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
        <label class="combat__toggle"><input type="checkbox" class="combat__show-hp" checked /> Players can see enemy health</label>
        <p class="combat__summary"></p>
        <button type="button" class="combat__start">Next: initiative</button>
      </div>
    </div>

    <div class="combat__init" hidden>
      <div class="combat__init-head">
        <h2 class="combat__h"><span>3</span> Roll initiative</h2>
        <button type="button" class="combat__roll-enemies">🎲 Roll for enemies</button>
      </div>
      <p class="combat__hint">Type each d20 roll. The bonus from the character sheet is added for you.</p>
      <ul class="init-list"></ul>
      <div class="combat__go">
        <button type="button" class="combat__back">‹ Back</button>
        <button type="button" class="combat__begin">Begin the fight</button>
      </div>
    </div>

    <div class="combat__battle" hidden>
      <div class="combat__stage"></div>
      <ol class="turns"></ol>
      <div class="combat__boxes combat__boxes--enemies"></div>
      <div class="combat__boxes combat__boxes--heroes"></div>
      <div class="turnbar">
        <span class="turnbar__who"></span>
        <button type="button" class="turnbar__attack">Attack</button>
        <button type="button" class="turnbar__next">Next turn ›</button>
      </div>
      <button type="button" class="combat__end">End</button>
      <div class="attack" hidden><div class="attack__card"></div></div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const setupEl = $('.combat__setup'), initEl = $('.combat__init'), battleEl = $('.combat__battle');
  const heroPick = $('.combat__heroes-pick'), enemyPick = $('.combat__enemies-pick');
  const summary = $('.combat__summary'), startBtn = $('.combat__start');
  const initList = $('.init-list'), beginBtn = $('.combat__begin');
  const turnsEl = $('.turns'), whoEl = $('.turnbar__who');
  const enemyBoxes = $('.combat__boxes--enemies'), heroBoxes = $('.combat__boxes--heroes');
  const attackEl = $('.attack'), attackCard = $('.attack__card');
  const scene = createBattleScene($('.combat__stage'));

  const chosen = new Set();
  const counts = Object.fromEntries(Object.keys(MONSTERS).map((k) => [k, 0]));
  let encounter = null; // { heroes: [id], enemies: [...], rolls: {key: n}, order: [key], turn, round }
  let visible = false;

  // --- Fighters: heroes and enemies seen the same way --------------------------------------
  const heroesInFight = () => encounter.heroes.map((id) => party.find((c) => c.id === id)).filter(Boolean);

  function fighter(key) {
    const [side, id] = key.split(':');
    if (side === 'hero') {
      const c = party.find((x) => x.id === id);
      if (!c) return null;
      const d = derive(c);
      return {
        key, side, name: c.name, short: c.name.split(' ')[0], colour: c.colour,
        hp: c.hp.current, max: c.hp.max, ac: d.ac, initBonus: d.initiative,
        attacks: d.attacks, sneak: sneakAttackDice(c), hero: c,
      };
    }
    const e = encounter.enemies.find((x) => x.uid === id);
    if (!e) return null;
    const m = MONSTERS[e.type];
    return {
      key, side, name: e.name, short: e.name, colour: '#2f3157',
      hp: e.hp, max: e.max, ac: e.ac, initBonus: m.initiative ?? 0,
      attacks: m.attacks.map((a) => ({ ...a, damage: `${a.dice}${plus(a.bonus)}`, style: monsterStyle(a) })), sneak: 0, enemy: e,
    };
  }

  // How a monster's attack looks, guessed from its name and damage type.
  function monsterStyle(a) {
    const words = `${a.name} ${a.type}`.toLowerCase();
    if (/bow|arrow|crossbow|sling|dart|spine|quill/.test(words)) return 'arrow';
    if (/throw|javelin|hurl|rock|boulder|spit/.test(words)) return 'thrown';
    if (/bolt|blast|ray|beam|spell|breath|orb|curse|fire|cold|lightning|force|radiant|necrotic|psychic|thunder|acid/.test(a.name.toLowerCase())) return 'magic';
    return 'melee';
  }
  // Magic glows in the colour of its damage.
  const MAGIC = { fire: '#ff8a3c', cold: '#8fd8ff', lightning: '#fff27a', thunder: '#cfe0ff', force: '#b98cff', radiant: '#ffe08a', necrotic: '#86e39b', poison: '#a4e36b', acid: '#c4f05a', psychic: '#ff8ad8' };
  const magicColour = (type) => Object.entries(MAGIC).find(([k]) => String(type).toLowerCase().includes(k))?.[1] ?? '#b98cff';

  // The animation for the open attack, for this screen and the players'.
  function attackAnimation(o) {
    const a = fighter(atk.attacker).attacks[atk.attack];
    const style = a.canThrow && atk.thrown ? 'thrown' : a.style ?? 'melee';
    return { from: atk.attacker, to: atk.target, style, hit: Boolean(o?.hit), crit: Boolean(o?.crit), colour: style === 'magic' ? magicColour(a.type) : null, id: Date.now() };
  }

  const allKeys = () => [...encounter.heroes.map((id) => `hero:${id}`), ...encounter.enemies.map((e) => `enemy:${e.uid}`)];

  function setHp(f, hp) {
    const value = Math.min(f.max, Math.max(0, hp));
    if (f.hero) { f.hero.hp.current = value; onHeroChange?.(f.hero); } else f.enemy.hp = value;
  }

  // --- 1. Setup ---------------------------------------------------------------------------------
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
          <b>${counts[type] ?? 0}</b>
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
    counts[b.dataset.type] = Math.max(0, (counts[b.dataset.type] ?? 0) + step);
    renderSetup();
  });

  startBtn.addEventListener('click', () => {
    const enemies = [];
    for (const [type, n] of Object.entries(counts)) {
      const m = MONSTERS[type];
      if (!m) continue;
      for (let i = 1; i <= n; i++) {
        const name = n > 1 ? `${m.short ?? m.name} ${i}` : m.short ?? m.name;
        enemies.push({ uid: `${type}-${i}`, type, name, hp: m.hp, max: m.hp, ac: m.ac, model: m.model });
      }
    }
    encounter = {
      heroes: party.filter((c) => chosen.has(c.id)).map((c) => c.id), enemies, rolls: {}, order: [], turn: 0, round: 1,
      showEnemyHp: $('.combat__show-hp').checked,
    };
    showStep('init');
    renderInit();
  });

  // --- 2. Initiative ------------------------------------------------------------------------------
  function renderInit() {
    initList.innerHTML = allKeys().map((key) => {
      const f = fighter(key);
      const roll = encounter.rolls[key] ?? '';
      return `
        <li class="init-row">
          <span class="pick__badge" style="background:${esc(f.colour)}">${esc(f.name[0])}</span>
          <span class="init-row__name">${esc(f.name)}</span>
          <label class="init-row__roll">d20 <input type="number" inputmode="numeric" min="1" max="20" data-key="${esc(key)}" value="${roll}" placeholder="–" /></label>
          <span class="init-row__bonus">${signed(f.initBonus)}</span>
          <span class="init-row__total" data-total="${esc(key)}">${roll ? `= ${Number(roll) + f.initBonus}` : ''}</span>
        </li>`;
    }).join('');
    updateBegin();
  }

  function updateBegin() {
    beginBtn.disabled = !allKeys().every((k) => encounter.rolls[k] >= 1 && encounter.rolls[k] <= 20);
  }

  initList.addEventListener('input', (e) => {
    const input = e.target.closest('input[data-key]');
    if (!input) return;
    const key = input.dataset.key;
    const n = Math.round(Number(input.value));
    if (input.value && n >= 1 && n <= 20) encounter.rolls[key] = n; else delete encounter.rolls[key];
    const total = root.querySelector(`[data-total="${CSS.escape(key)}"]`);
    total.textContent = encounter.rolls[key] ? `= ${encounter.rolls[key] + fighter(key).initBonus}` : '';
    input.classList.toggle('is-bad', Boolean(input.value) && !encounter.rolls[key]);
    updateBegin();
  });

  $('.combat__roll-enemies').addEventListener('click', () => {
    for (const e of encounter.enemies) encounter.rolls[`enemy:${e.uid}`] = d20();
    renderInit();
  });
  $('.combat__back').addEventListener('click', () => { encounter = null; showStep('setup'); renderSetup(); });

  beginBtn.addEventListener('click', () => {
    // Highest total first; ties go to the higher bonus, then the higher roll.
    const score = (k) => { const f = fighter(k); return [encounter.rolls[k] + f.initBonus, f.initBonus, encounter.rolls[k]]; };
    encounter.order = allKeys().sort((a, b) => {
      const [x, y] = [score(a), score(b)];
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
    });
    encounter.turn = 0;
    encounter.round = 1;
    showStep('battle');
    scene.setFighters(heroesInFight(), encounter.enemies);
    skipDowned();
    renderBattle();
    if (visible) scene.start();
  });

  // --- 3. Battle -----------------------------------------------------------------------------------
  const current = () => fighter(encounter.order[encounter.turn]);

  function box(f) {
    const pct = Math.max(0, Math.round((f.hp / f.max) * 100));
    const tone = pct > 50 ? 'ok' : pct > 20 ? 'low' : 'crit';
    const isTurn = encounter.order[encounter.turn] === f.key;
    return `
      <div class="hpbox${f.hp <= 0 ? ' is-down' : ''}${isTurn ? ' is-turn' : ''}" data-key="${esc(f.key)}">
        <div class="hpbox__top"><b>${esc(f.name)}</b><small>AC ${f.ac}</small></div>
        <div class="hpbox__row">
          <button type="button" class="hpbox__btn" data-key="${esc(f.key)}" data-step="-1" aria-label="Damage">−</button>
          <span class="hpbox__track"><span class="is-${tone}" style="width:${pct}%"></span></span>
          <button type="button" class="hpbox__btn" data-key="${esc(f.key)}" data-step="1" aria-label="Heal">+</button>
          <span class="hpbox__nums">${Math.max(0, f.hp)}/${f.max}</span>
        </div>
      </div>`;
  }

  function renderBattle() {
    const fs = encounter.order.map(fighter).filter(Boolean);
    enemyBoxes.innerHTML = fs.filter((f) => f.side === 'enemy').map(box).join('');
    heroBoxes.innerHTML = fs.filter((f) => f.side === 'hero').map(box).join('');
    turnsEl.innerHTML = `<li class="turns__round">Round ${encounter.round}</li>` + fs.map((f, i) => `
      <li class="turns__chip${i === encounter.turn ? ' is-now' : ''}${f.hp <= 0 ? ' is-down' : ''}" title="${esc(f.name)}">
        <i style="background:${esc(f.colour)}">${esc(f.short[0])}${f.side === 'enemy' && /\d+$/.test(f.short) ? f.short.match(/\d+$/)[0] : ''}</i>
        <small>${encounter.rolls[f.key] + f.initBonus}</small>
      </li>`).join('');
    const now = current();
    whoEl.innerHTML = now ? `<b>${esc(now.name)}</b>'s turn` : '';
    for (const f of fs) scene.setDown(f.key, f.hp <= 0);
    scene.setActive(now?.key ?? null);
    turnsEl.querySelector('.is-now')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    publish();
  }

  // What players may see: names, turn order and who is down, but no rolls, no
  // stats, and enemy health only if the DM allowed it.
  function publicState(hit = null, anim = null) {
    if (!encounter?.order.length) return { active: false };
    return {
      active: true,
      round: encounter.round,
      turn: encounter.turn,
      heroes: encounter.heroes,
      hit,
      anim,
      fighters: encounter.order.map(fighter).filter(Boolean).map((f) => ({
        key: f.key, side: f.side, name: f.name, colour: f.colour, down: f.hp <= 0,
        chip: f.side === 'enemy' ? `${f.short[0]}${f.short.match(/\d+$/)?.[0] ?? ''}` : f.short[0],
        model: f.enemy?.model,
        ...(f.side === 'enemy' && encounter.showEnemyHp ? { hp: f.hp, max: f.max } : {}),
      })),
    };
  }
  const publish = (hit, anim) => onPublic?.(publicState(hit, anim));

  // Fighters at 0 HP are skipped. Returns false when nobody can act.
  function skipDowned() {
    for (let i = 0; i < encounter.order.length; i++) {
      if (fighter(encounter.order[encounter.turn])?.hp > 0) return true;
      advance();
    }
    return false;
  }
  function advance() {
    encounter.turn += 1;
    if (encounter.turn >= encounter.order.length) { encounter.turn = 0; encounter.round += 1; }
  }

  $('.turnbar__next').addEventListener('click', () => {
    advance();
    skipDowned();
    renderBattle();
  });

  battleEl.addEventListener('click', (e) => {
    const b = e.target.closest('.hpbox [data-step]');
    if (!b) return;
    const f = fighter(b.dataset.key);
    const step = Number(b.dataset.step);
    setHp(f, f.hp + step);
    if (step < 0) scene.hit(f.key);
    renderBattle();
    if (step < 0) publish(f.key);
  });

  $('.combat__end').addEventListener('click', () => {
    if (!confirm('End this encounter?')) return;
    encounter = null;
    attackEl.hidden = true;
    showStep('setup');
    renderSetup();
    publish();
  });

  // --- Attack calculator ---------------------------------------------------------------------------
  // State for the open attack: which attack, which target, the d20, the damage dice.
  let atk = null;

  $('.turnbar__attack').addEventListener('click', () => {
    const now = current();
    if (!now) return;
    atk = { attacker: now.key, attack: 0, target: null, roll: null, sneak: false };
    atk.thrown = Boolean(now.attacks[0]?.throwFirst);
    const foes = targets();
    if (foes.length === 1) atk.target = foes[0].key;
    renderAttack();
    attackEl.hidden = false;
  });

  const targets = () => encounter.order.map(fighter).filter((f) => f && f.hp > 0 && f.side !== fighter(atk.attacker).side);

  // The result of the d20, against the target's armour.
  function outcome() {
    const a = fighter(atk.attacker).attacks[atk.attack];
    const target = atk.target && fighter(atk.target);
    if (!atk.roll || !target) return null;
    const total = atk.roll + a.toHit;
    if (atk.roll === 20) return { total, hit: true, crit: true, text: 'Critical hit!' };
    if (atk.roll === 1) return { total, hit: false, text: 'Natural 1: a miss' };
    return total >= target.ac ? { total, hit: true, text: 'Hit!' } : { total, hit: false, text: 'Miss' };
  }

  // The dice to roll for damage: weapon dice (doubled on a crit) and any Sneak Attack.
  function damageDice() {
    const f = fighter(atk.attacker);
    const a = f.attacks[atk.attack];
    const o = outcome();
    const groups = [];
    const w = parseDice(a.dice);
    if (w) groups.push({ label: a.name, count: w.count * (o?.crit ? 2 : 1), sides: w.sides });
    if (atk.sneak && f.sneak) groups.push({ label: 'Sneak Attack', count: f.sneak * (o?.crit ? 2 : 1), sides: 6 });
    return { groups, bonus: a.bonus ?? 0 };
  }

  function renderAttack() {
    const f = fighter(atk.attacker);
    const a = f.attacks[atk.attack];
    const target = atk.target && fighter(atk.target);
    const canSneak = f.sneak && a.sneakable;
    attackCard.innerHTML = `
      <header class="attack__head">
        <b>${esc(f.name)} attacks</b>
        <button type="button" class="attack__close" aria-label="Close">×</button>
      </header>
      <p class="attack__label">Weapon</p>
      <div class="attack__options">
        ${f.attacks.map((x, i) => `<button type="button" class="opt${i === atk.attack ? ' is-on' : ''}" data-attack="${i}"><b>${esc(x.name)}</b><small>${signed(x.toHit)} to hit · ${esc(x.damage)}</small></button>`).join('')}
      </div>
      <p class="attack__label">Target</p>
      <div class="attack__options">
        ${targets().map((t) => `<button type="button" class="opt${t.key === atk.target ? ' is-on' : ''}" data-target="${esc(t.key)}"><b>${esc(t.name)}</b><small>AC ${t.ac} · ${t.hp}/${t.max} HP</small></button>`).join('')}
      </div>
      ${target ? `
        <p class="attack__label">Attack roll</p>
        <div class="attack__roll">
          <label>d20 <input class="attack__d20" type="number" inputmode="numeric" min="1" max="20" value="${atk.roll ?? ''}" placeholder="–" /></label>
          <span>${signed(a.toHit)}</span>
          <span class="attack__result"></span>
        </div>
        ${a.canThrow ? `<label class="attack__sneak"><input type="checkbox" class="attack__thrown"${atk.thrown ? ' checked' : ''} /> Thrown${a.note.includes('Range') ? ` (${esc(a.note.match(/Range [^·]+/)[0].trim())})` : ''}</label>` : ''}
        ${canSneak ? `<label class="attack__sneak"><input type="checkbox"${atk.sneak ? ' checked' : ''} /> Sneak Attack (+${f.sneak}d6): advantage, or an ally next to the target</label>` : ''}
        <div class="attack__damage"></div>` : ''}`;
    renderResult();
  }

  function renderResult() {
    const resultEl = attackCard.querySelector('.attack__result');
    const dmgEl = attackCard.querySelector('.attack__damage');
    if (!resultEl) return;
    const o = outcome();
    const target = fighter(atk.target);
    resultEl.className = `attack__result${o ? (o.hit ? ' is-hit' : ' is-miss') : ''}`;
    resultEl.innerHTML = o ? `= <b>${o.total}</b> vs AC ${target.ac} · ${o.text}` : '';
    if (!o) { dmgEl.innerHTML = ''; return; }
    if (!o.hit) {
      dmgEl.innerHTML = '<button type="button" class="attack__apply" data-action="miss">Miss · close</button>';
      return;
    }
    const { groups, bonus } = damageDice();
    dmgEl.innerHTML = `
      <p class="attack__label">Damage roll${o.crit ? ' (critical: dice doubled)' : ''}</p>
      <div class="attack__dice">
        ${groups.map((g, gi) => Array.from({ length: g.count }, () => `
          <label class="die"><small>d${g.sides}${gi ? ' sneak' : ''}</small><input type="number" inputmode="numeric" min="1" max="${g.sides}" data-sides="${g.sides}" placeholder="–" /></label>`).join('')).join('')}
        ${bonus ? `<span class="die die--bonus"><small>bonus</small><b>${signed(bonus)}</b></span>` : ''}
      </div>
      <button type="button" class="attack__apply" data-action="apply" disabled>Enter the dice</button>`;
    updateDamage();
  }

  function updateDamage() {
    const inputs = [...attackCard.querySelectorAll('.attack__dice input')];
    const btn = attackCard.querySelector('[data-action="apply"]');
    if (!btn) return;
    let ok = true, sum = 0;
    for (const i of inputs) {
      const n = Math.round(Number(i.value));
      const valid = i.value !== '' && n >= 1 && n <= Number(i.dataset.sides);
      i.classList.toggle('is-bad', i.value !== '' && !valid);
      if (valid) sum += n; else ok = false;
    }
    // A hit always deals at least 1 damage.
    const total = Math.max(1, sum + damageDice().bonus);
    btn.disabled = !ok;
    btn.dataset.amount = total;
    btn.textContent = ok ? `Deal ${total} damage to ${fighter(atk.target).short}` : 'Enter the dice';
  }

  attackCard.addEventListener('click', (e) => {
    if (e.target.closest('.attack__close')) { attackEl.hidden = true; return; }
    const opt = e.target.closest('[data-attack], [data-target]');
    if (opt) {
      if (opt.dataset.attack) {
        atk.attack = Number(opt.dataset.attack);
        atk.sneak = false;
        atk.thrown = Boolean(fighter(atk.attacker).attacks[atk.attack].throwFirst);
      }
      if (opt.dataset.target) atk.target = opt.dataset.target;
      renderAttack();
      return;
    }
    const apply = e.target.closest('.attack__apply');
    if (!apply) return;
    const anim = attackAnimation(outcome());
    if (apply.dataset.action === 'apply') {
      const target = fighter(atk.target);
      setHp(target, target.hp - Number(apply.dataset.amount));
    }
    scene.attack(anim); // before the redraw, so a knocked-out target falls when the blow lands
    attackEl.hidden = true;
    renderBattle();
    publish(anim.to, anim);
  });

  attackCard.addEventListener('input', (e) => {
    if (e.target.matches('.attack__d20')) {
      const n = Math.round(Number(e.target.value));
      atk.roll = e.target.value && n >= 1 && n <= 20 ? n : null;
      e.target.classList.toggle('is-bad', Boolean(e.target.value) && !atk.roll);
      renderResult();
    } else if (e.target.matches('.attack__dice input')) {
      updateDamage();
    }
  });
  attackCard.addEventListener('change', (e) => {
    if (e.target.matches('.attack__thrown')) { atk.thrown = e.target.checked; return; }
    if (e.target.matches('.attack__sneak input')) { atk.sneak = e.target.checked; renderResult(); }
  });

  // --- Switching steps ------------------------------------------------------------------------------
  function showStep(step) {
    setupEl.hidden = step !== 'setup';
    initEl.hidden = step !== 'init';
    battleEl.hidden = step !== 'battle';
    root.classList.toggle('is-battle', step === 'battle');
    if (step !== 'battle') scene.stop();
  }

  return {
    start() {
      visible = true;
      if (encounter?.order.length) { renderBattle(); scene.start(); } else if (!encounter) renderSetup();
    },
    stop() { visible = false; scene.stop(); },
    publicState: () => publicState(),
    // A hero changed elsewhere (another device): update what shows them.
    refresh() {
      if (!visible) return;
      if (encounter?.order.length) renderBattle(); else if (!encounter) renderSetup();
    },
  };
}

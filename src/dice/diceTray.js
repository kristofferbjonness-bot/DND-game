// The dice tray: a d20 tab on the left edge (under the rulebook, showing the latest roll) opens a
// small tray. Tap dice to build a roll, or tap a ready-made roll for your hero
// (initiative, attacks, damage). Every roll goes into a log the whole table
// sees live. The Dungeon Master can roll hidden and clear the log.
import { derive, signed } from '../character/rules.js';
import { die } from '../rulebook/rulebook.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const SIDES = [4, 6, 8, 10, 12, 20];

// A fair roll of one die.
function rollDie(sides) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides; // no bias
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return (buf[0] % sides) + 1;
}

// Rolls a pool like [{ sides: 6, count: 2 }]. A single d20 with advantage or
// disadvantage rolls twice and keeps the higher or lower.
export function rollPool(pool, bonus, mode = 'normal') {
  const dice = [];
  const lone20 = pool.length === 1 && pool[0].sides === 20 && pool[0].count === 1;
  if (lone20 && mode !== 'normal') {
    const a = rollDie(20), b = rollDie(20);
    const keepA = mode === 'adv' ? a >= b : a <= b;
    dice.push({ sides: 20, value: a, kept: keepA }, { sides: 20, value: b, kept: !keepA });
  } else {
    for (const g of pool) for (let i = 0; i < g.count; i++) dice.push({ sides: g.sides, value: rollDie(g.sides), kept: true });
  }
  const total = dice.filter((d) => d.kept).reduce((s, d) => s + d.value, 0) + bonus;
  return { dice, bonus, total };
}

const describe = (pool) => pool.map((g) => `${g.count}d${g.sides}`).join(' + ');
const parse = (dice) => { const m = /^(\d+)d(\d+)$/.exec(dice ?? ''); return m ? { count: Number(m[1]), sides: Number(m[2]) } : null; };

// `who()` → { name, colour, hero, dm }; `save(roll)` stores it and resolves with the saved row;
// `clear()` empties the log (DM). `onRolled(row)` is called for every new roll.
export function createDiceTray({ button, root, who, save, clear }) {
  let pool = [], bonus = 0, mode = 'normal', secret = false, log = [], last = null, unread = false;

  function quickRolls() {
    const { hero } = who();
    if (!hero) return [];
    const d = derive(hero);
    const list = [{ label: 'Initiative', pool: [{ sides: 20, count: 1 }], bonus: d.initiative, d20: true }];
    for (const a of d.attacks) {
      list.push({ label: `${a.name} · attack`, pool: [{ sides: 20, count: 1 }], bonus: a.toHit, d20: true });
      const p = parse(a.dice);
      if (p) list.push({ label: `${a.name} · damage`, pool: [p], bonus: a.bonus ?? 0 });
    }
    return list;
  }

  const diceChips = (row) => row.dice.map((d) => {
    const nat = d.sides === 20 && d.kept ? (d.value === 20 ? ' is-nat20' : d.value === 1 ? ' is-nat1' : '') : '';
    return `<span class="dt-die${d.kept ? '' : ' is-dropped'}${nat}" title="d${d.sides}">${d.value}</span>`;
  }).join('');

  function logItem(r) {
    return `
      <li class="dt-entry${r.secret ? ' is-secret' : ''}">
        <i style="background:${esc(r.colour ?? '#3b2f22')}"></i>
        <div class="dt-entry__main">
          <span><b>${esc(r.who)}</b>${r.label ? ` · ${esc(r.label)}` : ''}${r.secret ? ' · 🔒 hidden' : ''}</span>
          <span class="dt-entry__dice">${diceChips(r)}${r.bonus ? `<em>${signed(r.bonus)}</em>` : ''}</span>
        </div>
        <b class="dt-entry__total">${r.total}</b>
      </li>`;
  }

  // The tab shows a d20 with the table's latest roll on it.
  let lastButton = '';
  function drawButton() {
    const top = log[0];
    const nat = top?.dice.find((d) => d.kept && d.sides === 20)?.value;
    const html = die(20, top ? top.total : '20');
    if (html !== lastButton) { lastButton = html; button.innerHTML = html; }
    button.classList.toggle('is-nat20', nat === 20);
    button.classList.toggle('is-nat1', nat === 1);
  }

  function render() {
    button.classList.toggle('has-news', unread);
    drawButton();
    if (root.hidden) return;
    const me = who();
    const quick = quickRolls();
    const counts = Object.fromEntries(pool.map((g) => [g.sides, g.count]));
    const d20only = pool.length === 1 && pool[0].sides === 20 && pool[0].count === 1;
    root.innerHTML = `
      <div class="dt-card">
        <header class="dt-head"><b>🎲 Dice</b><small>rolling as ${esc(me.name)}</small><button type="button" class="dt-close" aria-label="Close">×</button></header>
        <div class="dt-last">${last ? `
          <span class="dt-last__total${last.dice.some((d) => d.kept && d.sides === 20 && d.value === 20) ? ' is-nat20' : last.dice.some((d) => d.kept && d.sides === 20 && d.value === 1) ? ' is-nat1' : ''}">${last.total}</span>
          <span class="dt-last__info">${esc(last.label ?? '')}<span class="dt-entry__dice">${diceChips(last)}${last.bonus ? `<em>${signed(last.bonus)}</em>` : ''}</span></span>` : '<span class="dt-last__hint">Tap dice, then Roll</span>'}
        </div>
        <div class="dt-dice">
          ${SIDES.map((s) => `<button type="button" data-die="${s}" aria-label="Add a d${s}">${die(s, `d${s}`)}${counts[s] ? `<span class="dt-count">${counts[s]}</span>` : ''}</button>`).join('')}
        </div>
        <div class="dt-row">
          <span class="dt-pool">${pool.length ? describe(pool) : 'No dice yet'}</span>
          <span class="stepper dt-bonus">
            <button type="button" data-bonus="-1" aria-label="Lower the bonus">−</button>
            <b>${signed(bonus)}</b>
            <button type="button" data-bonus="1" aria-label="Raise the bonus">+</button>
          </span>
        </div>
        <div class="dt-row">
          <div class="seg dt-mode${d20only ? '' : ' is-off'}" title="Advantage only works on a single d20">
            ${[['dis', '⬇️'], ['normal', 'Normal'], ['adv', '⬆️']].map(([m, l]) => `<button type="button" data-mode="${m}"${m === mode ? ' class="is-on"' : ''}>${l}</button>`).join('')}
          </div>
          <button type="button" class="dt-clear-pool"${pool.length || bonus ? '' : ' disabled'}>Reset</button>
          <button type="button" class="dt-roll"${pool.length ? '' : ' disabled'}>Roll</button>
        </div>
        ${me.dm ? `<label class="toggle dt-secret"><input type="checkbox"${secret ? ' checked' : ''} /> Hidden roll (only you see it)</label>` : ''}
        ${quick.length ? `
          <p class="dt-h">Quick rolls · ${esc(me.hero.name)}</p>
          <div class="dt-quick">${quick.map((q, i) => `<button type="button" data-quick="${i}"><b>${esc(q.label)}</b><small>${describe(q.pool)}${q.bonus ? ` ${signed(q.bonus)}` : ''}</small></button>`).join('')}</div>` : ''}
        <div class="dt-h dt-h--log"><span>Table log</span>${me.dm ? '<button type="button" class="dt-clear-log">Clear log</button>' : ''}</div>
        <ul class="dt-log">${log.length ? log.map(logItem).join('') : '<li class="dt-empty">No rolls yet.</li>'}</ul>
      </div>`;
  }

  async function doRoll(p, b, label, useMode) {
    const me = who();
    const r = rollPool(p, b, useMode ? mode : 'normal');
    const row = { who: me.name, colour: me.colour, label: label ?? describe(p), dice: r.dice, bonus: b, total: r.total, secret: me.dm && secret };
    last = row;
    render();
    root.querySelector('.dt-last__total')?.classList.add('is-new');
    try {
      const saved = await save(row);
      add(saved ?? row);
    } catch {
      add({ ...row, id: `local-${Date.now()}` }); // not shared, but still shown here
    }
  }

  // A roll arrived (ours or someone else's).
  function add(row) {
    if (row.id && log.some((r) => r.id === row.id)) return;
    log.unshift(row);
    log = log.slice(0, 40);
    if (root.hidden) unread = true;
    render();
  }

  button.addEventListener('click', () => {
    root.hidden = !root.hidden;
    button.classList.toggle('is-open', !root.hidden);
    if (!root.hidden) unread = false;
    render();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('dt-close')) { root.hidden = true; button.classList.remove('is-open'); return; }
    if (b.dataset.die) {
      const s = Number(b.dataset.die);
      const g = pool.find((x) => x.sides === s);
      if (g) g.count = Math.min(20, g.count + 1); else pool.push({ sides: s, count: 1 });
      pool.sort((x, y) => y.sides - x.sides);
    } else if (b.dataset.bonus) bonus = Math.max(-20, Math.min(30, bonus + Number(b.dataset.bonus)));
    else if (b.dataset.mode) mode = b.dataset.mode;
    else if (b.classList.contains('dt-clear-pool')) { pool = []; bonus = 0; mode = 'normal'; }
    else if (b.classList.contains('dt-roll')) { doRoll(pool, bonus, null, true); return; }
    else if (b.dataset.quick) {
      const q = quickRolls()[Number(b.dataset.quick)];
      if (q) doRoll(q.pool, q.bonus, q.label, q.d20);
      return;
    } else if (b.classList.contains('dt-clear-log')) {
      if (!confirm('Clear the dice log for everyone?')) return;
      clear().then(() => { log = []; render(); }).catch(() => {});
      return;
    }
    render();
  });
  root.addEventListener('change', (e) => { if (e.target.closest('.dt-secret')) secret = e.target.checked; });
  // A tap anywhere else closes the tray (the path still holds buttons a re-render removed).
  document.addEventListener('click', (e) => {
    if (root.hidden || e.composedPath().some((el) => el === root || el === button)) return;
    root.hidden = true;
    button.classList.remove('is-open');
  });

  return {
    // The log as loaded from the database (newest first).
    setLog(rows) { log = rows; render(); },
    add,
    remove(id) { log = log.filter((r) => r.id !== id); render(); },
    refresh: render,
  };
}

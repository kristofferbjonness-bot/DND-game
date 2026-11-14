// The Party screen: a plate per hero with their portrait, health and key
// numbers. Tapping a plate opens that hero on the Hero screen. For the Dungeon Master:
//   onNew        a "New hero" button that opens the character creator;
//   onManage     a "Manage" button on each plate (health, XP, items);
//   onEveryone   party-wide actions: ('short' | 'long' | 'xp', amount);
//   parties, current, onSwitch   the party names, the one shown, and switching to another.
// Players get `title`: their party's name when there is more than one party.
import { derive, signed } from '../character/rules.js';
import { icon } from '../ui/icons.js';
import { heroPortrait, portraitImg } from '../ui/portraits.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// `online(id)` (DM): { on, text, claimed } for a hero's player.
export function renderParty(root, characters, onOpen, { onNew, onManage, onEveryone, parties, current, onSwitch, title, online } = {}) {
  root.innerHTML = `
    <div class="party__inner">
      <header class="screen-head">
        ${parties ? `
          <label class="party__switch" title="Which party to show">
            <select class="party__select" aria-label="Party">
              ${parties.map((p) => `<option value="${esc(p)}"${p === current ? ' selected' : ''}>${esc(p)}</option>`).join('')}
              <option value="+">＋ New party…</option>
            </select>
          </label>` : `<h2 class="screen-title">${esc(title ?? 'The Party')}</h2>`}
        ${onNew ? `<button type="button" class="btn btn--gold party__new">${icon('plus')}New hero</button>` : ''}
      </header>
      ${onEveryone ? `
        <div class="party__all">
          <span class="party__all-label">Everyone</span>
          <button type="button" class="btn btn--small" data-all="short">Short rest</button>
          <button type="button" class="btn btn--small" data-all="long">Long rest</button>
          <span class="party__xp">
            <input type="number" inputmode="numeric" min="0" placeholder="XP" aria-label="XP for everyone" />
            <button type="button" class="btn btn--small" data-all="xp">${icon('xp')}Give XP each</button>
          </span>
        </div>` : ''}
      <ul class="party__list">
        ${characters.length ? '' : `<li class="party__empty">No heroes in this party yet.${parties ? ' Move heroes here with Manage, or make a new hero.' : ''}</li>`}
        ${characters.map((c) => {
          const d = derive(c);
          const hp = Math.max(0, c.hp.current / c.hp.max);
          return `
          <li class="party__item">
            <button type="button" class="party__card${c.hp.current <= 0 ? ' is-down' : hp <= 0.3 ? ' is-low' : ''}" data-id="${esc(c.id)}" style="--hero:${esc(c.colour)}">
              <span class="party__face">${portraitImg(heroPortrait(c), { name: c.name, colour: c.colour })}<span class="lvl lvl--small" title="Level ${c.level}"><b>${c.level}</b></span></span>
              <span class="party__who">
                <b>${esc(c.name)}</b>
                <small>${esc(c.class)} · ${esc(c.race)}</small>
                ${online ? (() => { const o = online(c.id); return `<span class="party__online${o.on ? ' is-on' : ''}">${o.claimed ? esc(o.text) : 'No player yet'}</span>`; })() : ''}
              </span>
              <span class="party__hp">
                <span class="hpbar">
                  <span class="hpbar__icon">${icon('hp')}</span>
                  <span class="hpbar__track"><i style="width:${Math.round(hp * 100)}%"></i></span>
                  <b class="hpbar__num">${c.hp.current}<small>/${c.hp.max}</small></b>
                </span>
              </span>
              <span class="party__stats">
                <span title="Armour class">${icon('ac')}<b>${d.ac}</b></span>
                <span title="Initiative">${icon('init')}<b>${signed(d.initiative)}</b></span>
                <span title="Passive perception">${icon('wis')}<b>${d.passivePerception}</b></span>
              </span>
            </button>
            ${onManage ? `<button type="button" class="btn btn--small party__manage" data-manage="${esc(c.id)}">${icon('pen')}Manage</button>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </div>`;
  root.querySelector('.party__new')?.addEventListener('click', onNew);
  root.querySelector('.party__select')?.addEventListener('change', (e) => {
    let name = e.target.value;
    if (name === '+') {
      name = (prompt('Name of the new party (move heroes into it with Manage):') ?? '').trim().slice(0, 40);
      if (!name) { e.target.value = current; return; }
    }
    onSwitch(name);
  });
  root.querySelector('.party__all')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-all]');
    if (!b) return;
    const amount = Math.max(0, Math.round(Number(root.querySelector('.party__all input').value) || 0));
    if (b.dataset.all === 'xp' && !amount) { root.querySelector('.party__all input').focus(); return; }
    onEveryone(b.dataset.all, amount);
  });
  root.querySelector('.party__list').addEventListener('click', (e) => {
    const m = e.target.closest('.party__manage');
    if (m) { onManage(m.dataset.manage); return; }
    const card = e.target.closest('.party__card');
    if (card) onOpen(card.dataset.id);
  });
}

// The Party screen: one card per hero with their key numbers. Tapping a card
// opens that hero on the Status screen. For the Dungeon Master:
//   onNew        a "New hero" button that opens the character creator;
//   onManage     a "Manage" button on each card (health, XP, items);
//   onEveryone   party-wide actions: ('short' | 'long' | 'xp', amount).
import { derive, signed } from '../character/rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function renderParty(root, characters, onOpen, { onNew, onManage, onEveryone } = {}) {
  root.innerHTML = `
    <div class="party__inner">
      <div class="party__head">
        <h2 class="party__title">The Party</h2>
        ${onNew ? '<button type="button" class="party__new">＋ New hero</button>' : ''}
      </div>
      ${onEveryone ? `
        <div class="party__all">
          <span>Everyone:</span>
          <button type="button" data-all="short">Short rest</button>
          <button type="button" data-all="long">Long rest</button>
          <input type="number" inputmode="numeric" min="0" placeholder="XP" aria-label="XP for everyone" />
          <button type="button" data-all="xp">Give XP each</button>
        </div>` : ''}
      <ul class="party__list">
        ${characters.map((c) => {
          const d = derive(c);
          return `
          <li class="party__item">
            <button type="button" class="party__card" data-id="${esc(c.id)}">
              <span class="party__who">
                <b>${esc(c.name)}</b>
                <small>Level ${c.level} ${esc(c.class)} · ${esc(c.race)}</small>
              </span>
              <span class="party__hp">
                <span class="hp"><span style="width:${Math.round((c.hp.current / c.hp.max) * 100)}%"></span></span>
                <small>${c.hp.current} / ${c.hp.max} HP</small>
              </span>
              <span class="party__stats">
                <span><b>${d.ac}</b>AC</span>
                <span><b>${signed(d.initiative)}</b>Init</span>
                <span><b>${d.passivePerception}</b>Perc</span>
              </span>
            </button>
            ${onManage ? `<button type="button" class="party__manage" data-manage="${esc(c.id)}">Manage</button>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </div>`;
  root.querySelector('.party__new')?.addEventListener('click', onNew);
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

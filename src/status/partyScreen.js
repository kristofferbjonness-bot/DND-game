// The Party screen: one card per hero with their key numbers. Tapping a card
// opens that hero on the Status screen.
import { derive, signed } from '../character/rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function renderParty(root, characters, onOpen) {
  root.innerHTML = `
    <div class="party__inner">
      <h2 class="party__title">The Party</h2>
      <ul class="party__list">
        ${characters.map((c) => {
          const d = derive(c);
          return `
          <li>
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
                <span><b>${c.ac}</b>AC</span>
                <span><b>${signed(d.initiative)}</b>Init</span>
                <span><b>${d.passivePerception}</b>Perc</span>
              </span>
            </button>
          </li>`;
        }).join('')}
      </ul>
    </div>`;
  root.querySelector('.party__list').addEventListener('click', (e) => {
    const card = e.target.closest('.party__card');
    if (card) onOpen(card.dataset.id);
  });
}

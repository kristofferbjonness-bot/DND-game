// The Dungeon Master's panel for one hero, opened from the Party screen:
// damage and healing, rests, experience and levelling up, loot and coins.
// Every change is saved straight away, so the player sees it live.
import { XP_FOR_LEVEL, derive } from '../character/rules.js';
import { damage, heal, shortRest, longRest, readyToLevel, levelUp, giveItem, takeItem, itemInfo, giveAbilityPoint } from '../character/progress.js';
import { ITEMS } from '../data/items.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const GROUPS = [
  ['Weapons', (it) => it.kind === 'weapon'],
  ['Armour and shields', (it) => it.kind === 'armour' || it.kind === 'shield'],
  ['Gear', (it) => it.kind === 'gear'],
];
const COINS = { pp: 'Platinum', gp: 'Gold', sp: 'Silver', cp: 'Copper' };

// `onSave(character)` saves a changed hero.
export function createHeroManager(root, { party, onSave }) {
  let id = null, said = '';
  const hero = () => party.find((c) => c.id === id);
  const num = (name) => Math.max(0, Math.round(Number(root.querySelector(`[name=${name}]`)?.value) || 0));

  function render() {
    const c = hero();
    if (!c) { close(); return; }
    const d = derive(c);
    const next = XP_FOR_LEVEL[c.level];
    const hpPct = Math.round((c.hp.current / c.hp.max) * 100);
    root.innerHTML = `
      <div class="manage__card" role="dialog" aria-label="Manage ${esc(c.name)}">
        <header class="manage__head">
          <span class="hero-pick__badge" style="background:${esc(c.colour)}">${esc(c.name[0])}</span>
          <div><h2>${esc(c.name)}</h2><small>Level ${c.level} ${esc(c.class)} · AC ${d.ac}</small></div>
          <button type="button" class="manage__close" aria-label="Close">×</button>
        </header>
        <p class="manage__said" role="status">${esc(said)}</p>

        <section class="manage__sec">
          <h3>Health <small>${c.hp.current} / ${c.hp.max} HP${c.hp.temp ? ` · ${c.hp.temp} temp` : ''}</small></h3>
          <div class="hp"><span style="width:${hpPct}%"></span></div>
          <div class="manage__row">
            <input class="manage__num" name="hp" type="number" inputmode="numeric" min="0" placeholder="HP" />
            <button type="button" data-do="heal" class="manage__btn manage__btn--good">Heal</button>
            <button type="button" data-do="damage" class="manage__btn manage__btn--bad">Damage</button>
            <button type="button" data-do="temp" class="manage__btn">Temp HP</button>
          </div>
          <div class="manage__row">
            <button type="button" data-do="short" class="manage__btn">Short rest</button>
            <button type="button" data-do="long" class="manage__btn">Long rest</button>
          </div>
        </section>

        <section class="manage__sec">
          <h3>Experience <small>${c.xp}${next ? ` / ${next}` : ''} XP</small></h3>
          <div class="xp__bar"><span style="width:${Math.round(d.xp.progress * 100)}%"></span></div>
          <div class="manage__row">
            <input class="manage__num" name="xp" type="number" inputmode="numeric" min="0" placeholder="XP" />
            <button type="button" data-do="xp" class="manage__btn">Give XP</button>
            <button type="button" data-do="level" class="manage__btn${readyToLevel(c) ? ' manage__btn--ready' : ''}">Level up to ${c.level + 1}</button>
          </div>
          ${readyToLevel(c) ? `<p class="manage__note">${esc(c.name)} has enough XP for level ${c.level + 1}!</p>` : ''}
        </section>

        <section class="manage__sec">
          <h3>Attribute points <small>${c.abilityPoints ? `${c.abilityPoints} not spent yet` : 'all spent'}</small></h3>
          <div class="manage__row">
            <button type="button" data-do="point" class="manage__btn manage__btn--good">Give an attribute point</button>
            ${c.abilityPoints ? '<button type="button" data-do="unpoint" class="manage__btn">Take one back</button>' : ''}
          </div>
          <p class="manage__hint">They spend points on their Hero page. Every level up gives one.</p>
        </section>

        <section class="manage__sec">
          <h3>Give an item</h3>
          <div class="manage__row">
            <select class="manage__select" name="item">
              ${GROUPS.map(([label, test]) => `<optgroup label="${label}">${Object.entries(ITEMS).filter(([, it]) => test(it))
                .map(([key, it]) => `<option value="${key}">${esc(it.name)}</option>`).join('')}</optgroup>`).join('')}
              <option value="new">Something new…</option>
            </select>
            <input class="manage__num" name="qty" type="number" inputmode="numeric" min="1" value="1" aria-label="How many" />
          </div>
          <input class="manage__text" name="newname" maxlength="40" placeholder="Name of the new item" hidden />
          <div class="manage__row">
            <input class="manage__text" name="note" maxlength="80" placeholder="Note, e.g. Found in the Hooknose den" />
            <button type="button" data-do="give" class="manage__btn manage__btn--good">Give</button>
          </div>
        </section>

        <section class="manage__sec">
          <h3>Coins <small>${['pp', 'gp', 'sp', 'cp'].map((k) => `${c.coins[k] ?? 0} ${k}`).join(' · ')}</small></h3>
          <div class="manage__row">
            <input class="manage__num" name="coins" type="number" inputmode="numeric" min="0" placeholder="Amount" />
            <select class="manage__select manage__select--coin" name="coin">
              ${Object.entries(COINS).map(([k, label]) => `<option value="${k}"${k === 'gp' ? ' selected' : ''}>${label}</option>`).join('')}
            </select>
            <button type="button" data-do="pay" class="manage__btn manage__btn--good">Give</button>
            <button type="button" data-do="charge" class="manage__btn">Take</button>
          </div>
        </section>

        <section class="manage__sec">
          <h3>Inventory <small>tap − to take one away</small></h3>
          <ul class="manage__items">
            ${c.items.map((i, n) => `
              <li><span>${esc(itemInfo(i).name)}${(i.qty ?? 1) > 1 ? ` ×${i.qty}` : ''}${i.note ? `<small>${esc(i.note)}</small>` : ''}</span>
              <button type="button" data-take="${n}" aria-label="Take away">−</button></li>`).join('')}
          </ul>
        </section>
      </div>`;
  }

  // Applies a change, saves it and says what happened.
  function change(message, fn) {
    const c = hero();
    if (!c) return;
    const result = fn(c);
    if (result === false) return;
    said = typeof message === 'function' ? message(result) : message;
    onSave(c);
    render();
  }

  root.addEventListener('change', (e) => {
    if (e.target.name === 'item') root.querySelector('[name=newname]').hidden = e.target.value !== 'new';
  });

  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('.manage__close')) { close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    const c = hero();
    if (b.dataset.take) {
      const name = itemInfo(c.items[b.dataset.take]).name;
      change(`Took one ${name} from ${c.name}.`, (h) => takeItem(h, Number(b.dataset.take)));
      return;
    }
    const n = c.name;
    switch (b.dataset.do) {
      case 'heal': { const v = num('hp'); if (v) change(`${n} healed ${v} HP.`, (h) => heal(h, v)); break; }
      case 'damage': { const v = num('hp'); if (v) change(`${n} took ${v} damage.`, (h) => damage(h, v)); break; }
      case 'temp': { const v = num('hp'); change(`${n} has ${v} temporary HP.`, (h) => { h.hp.temp = v; }); break; }
      case 'short': change(`${n} took a short rest.`, shortRest); break;
      case 'long': change(`${n} took a long rest: full HP and everything ready again.`, longRest); break;
      case 'xp': { const v = num('xp'); if (v) change(`${n} gained ${v} XP.`, (h) => { h.xp += v; }); break; }
      case 'level':
        change((r) => `${n} is now level ${hero().level}: +${r.gain} max HP, 1 attribute point${r.features.length ? `, new: ${r.features.join(', ')}` : ''}.`, (h) => levelUp(h) ?? false);
        break;
      case 'point': change(`${n} got an attribute point to spend.`, (h) => giveAbilityPoint(h, 1)); break;
      case 'unpoint': change(`Took an attribute point back from ${n}.`, (h) => giveAbilityPoint(h, -1)); break;
      case 'give': {
        const key = root.querySelector('[name=item]').value;
        const name = root.querySelector('[name=newname]').value.trim();
        const note = root.querySelector('[name=note]').value.trim();
        const qty = Math.max(1, num('qty'));
        if (key === 'new' && !name) { root.querySelector('[name=newname]').focus(); return; }
        change((given) => `Gave ${n} ${qty > 1 ? `${qty} × ` : ''}${given}.`, (h) => giveItem(h, key === 'new' ? { name, note, qty } : { id: key, note, qty }));
        break;
      }
      case 'pay': case 'charge': {
        const v = num('coins'), k = root.querySelector('[name=coin]').value;
        if (!v) break;
        const sign = b.dataset.do === 'pay' ? 1 : -1;
        change(`${sign > 0 ? 'Gave' : 'Took'} ${v} ${COINS[k].toLowerCase()} ${sign > 0 ? 'to' : 'from'} ${n}.`, (h) => {
          h.coins[k] = Math.max(0, (h.coins[k] ?? 0) + sign * v);
        });
        break;
      }
      default:
    }
  });

  function close() { root.hidden = true; id = null; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  return {
    open(heroId) { id = heroId; said = ''; root.hidden = false; render(); },
    // A hero changed (maybe on another device): redraw if it is the one open.
    refresh(heroId) { if (!root.hidden && heroId === id && !root.contains(document.activeElement?.closest('input, select'))) render(); },
    close,
  };
}

// The Dungeon Master's panel for one hero, opened from the Party screen:
// damage and healing, rests, experience and levelling up, loot and coins.
// Every change is saved straight away, so the player sees it live.
import { XP_FOR_LEVEL, derive } from '../character/rules.js';
import { damage, heal, shortRest, longRest, readyToLevel, levelUp, giveItem, takeItem, itemInfo, giveAbilityPoint } from '../character/progress.js';
import { ITEMS } from '../data/items.js';
import { icon, itemIcon } from '../ui/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
// The item picker's shelves. Every catalogue item is on one of them (and on "From the towns" too
// when it comes from a town); lore books and letters from the Journal have their own shelf.
const SHELVES = [
  { id: 'all', label: 'All' },
  { id: 'weapons', label: 'Weapons', test: (it) => it.kind === 'weapon' },
  { id: 'armour', label: 'Armour', test: (it) => it.kind === 'armour' || it.kind === 'shield' },
  { id: 'potions', label: 'Potions & food', test: (it) => it.group === 'potions' || it.group === 'food' || /potion/i.test(it.name) },
  { id: 'tools', label: 'Gear & tools', test: (it) => it.kind === 'gear' && (!it.group || it.group === 'tools') && !/potion/i.test(it.name) },
  { id: 'treasure', label: 'Treasure & curios', test: (it) => it.group === 'treasure' || it.group === 'curio' },
  { id: 'towns', label: 'From the towns', test: (it) => Boolean(it.from) },
  { id: 'lore', label: 'Lore & letters' },
];
const LORE_TYPE = { book: 'Book', note: 'Note', letter: 'Letter', map: 'Map', object: 'Object' };
const COINS = { pp: 'Platinum', gp: 'Gold', sp: 'Silver', cp: 'Copper' };

// `onSave(character)` saves a changed hero.
// `loreItems()`: the Journal's items [{ id, title, type, given, holder }]; `onGiveLore(id, heroId)` gives one.
export function createHeroManager(root, { party, onSave, parties = () => [], partyOf = (c) => c.party, loreItems = () => [], onGiveLore }) {
  let shelf = 'all', query = '', picked = null; // the item picker's state (picked: an item key, 'lore:<id>' or 'new')
  let id = null, said = '';
  const hero = () => party.find((c) => c.id === id);
  const num = (name) => Math.max(0, Math.round(Number(root.querySelector(`[name=${name}]`)?.value) || 0));

  function render() {
    const c = hero();
    if (!c) { close(); return; }
    const d = derive(c);
    const next = XP_FOR_LEVEL[c.level];
    const hpPct = Math.round((c.hp.current / c.hp.max) * 100);
    root.innerHTML = /* the hero card */ `
      <div class="manage__card" role="dialog" aria-label="Manage ${esc(c.name)}">
        <header class="manage__head">
          <span class="hero-pick__badge" style="background:${esc(c.colour)}">${esc(c.name[0])}</span>
          <div><h2>${esc(c.name)}</h2><small>Level ${c.level} ${esc(c.class)} · AC ${d.ac}</small></div>
          <button type="button" class="manage__close" aria-label="Close">×</button>
        </header>
        <p class="manage__said" role="status">${esc(said)}</p>

        <section class="manage__sec">
          <h3>Party <small>who ${esc(c.name.split(' ')[0])} plays with</small></h3>
          <div class="manage__row">
            <select class="manage__select manage__party" aria-label="Party">
              ${[...new Set([...parties(), partyOf(c)])].map((p) => `<option value="${esc(p)}"${p === partyOf(c) ? ' selected' : ''}>${esc(p)}</option>`).join('')}
              <option value="+">＋ New party…</option>
            </select>
          </div>
        </section>

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

        <section class="manage__sec give">
          <h3>Give an item</h3>
          <label class="give__search">${icon('wis', 'inline')}<input type="search" name="itemsearch" placeholder="Search every item…" value="${esc(query)}" autocomplete="off" /></label>
          <div class="give__shelves">${SHELVES.map((sh) => `<button type="button" data-shelf="${sh.id}"${sh.id === shelf ? ' class="is-on"' : ''}>${sh.label}</button>`).join('')}</div>
          <ul class="give__list"></ul>
          <div class="give__chosen"></div>
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
    drawPicker();
  }

  // --- The item picker: search, shelves, a list, and the chosen item with how many and a note ---
  const pickerItems = () => {
    const q = query.trim().toLowerCase();
    const sh = SHELVES.find((x) => x.id === shelf);
    const out = [];
    if (shelf === 'all' || shelf === 'lore') {
      for (const l of loreItems()) {
        if (q && !`${l.title} ${LORE_TYPE[l.type] ?? ''}`.toLowerCase().includes(q)) continue;
        out.push({ key: `lore:${l.id}`, name: l.title, sub: `${LORE_TYPE[l.type] ?? 'Item'} · ${l.given ? `given${l.holderName ? ` to ${l.holderName}` : ''}` : 'not given yet'}`, ic: l.type === 'map' ? 'chart' : l.type === 'book' ? 'journal' : 'scroll', group: 'Lore & letters', given: l.given });
      }
    }
    if (shelf !== 'lore') {
      for (const [key, it] of Object.entries(ITEMS)) {
        if (it.kind === 'passenger' || (sh.test && !sh.test(it))) continue;
        const sub = [it.dice ? `${it.dice} ${it.type}` : it.ac ? `AC ${it.kind === 'shield' ? '+' : ''}${it.ac}` : '', it.from, it.note].filter(Boolean).join(' · ');
        if (q && !`${it.name} ${sub}`.toLowerCase().includes(q)) continue;
        const group = shelf === 'towns' ? it.from : (SHELVES.slice(1, 6).find((x) => x.test(it))?.label ?? 'Gear & tools');
        out.push({ key, name: it.name, sub, ic: itemIcon(it), group });
      }
    }
    return out;
  };
  function drawPicker() {
    const list = root.querySelector('.give__list'), chosen = root.querySelector('.give__chosen');
    if (!list) return;
    const items = pickerItems();
    let last = '';
    list.innerHTML = items.length ? items.map((i) => {
      const head = i.group !== last ? `<li class="give__group">${esc(i.group)}</li>` : '';
      last = i.group;
      return `${head}<li><button type="button" class="give__item${i.key === picked ? ' is-on' : ''}${i.given ? ' is-given' : ''}" data-pick="${esc(i.key)}">${icon(i.ic)}<span><b>${esc(i.name)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span></button></li>`;
    }).join('') : '<li class="give__none">Nothing found.</li>';
    list.insertAdjacentHTML('beforeend', `<li><button type="button" class="give__item give__item--new${picked === 'new' ? ' is-on' : ''}" data-pick="new">${icon('plus')}<span><b>Something new…</b><small>An item of your own</small></span></button></li>`);
    if (!picked) { chosen.innerHTML = '<p class="give__hint">Pick an item above.</p>'; return; }
    const lore = picked.startsWith('lore:');
    const name = picked === 'new' ? '' : lore ? loreItems().find((l) => `lore:${l.id}` === picked)?.title : ITEMS[picked]?.name;
    chosen.innerHTML = `
      <div class="give__pick">
        ${picked === 'new' ? '<input class="manage__text" name="newname" maxlength="40" placeholder="Name of the new item" />' : `<b>${esc(name)}</b>`}
        ${lore ? '' : '<input class="manage__num" name="qty" type="number" inputmode="numeric" min="1" value="1" aria-label="How many" />'}
      </div>
      <div class="manage__row">
        ${lore ? `<p class="give__hint">It goes into ${esc(hero()?.name ?? '')}'s Journal, and the players can read it.</p>` : '<input class="manage__text" name="note" maxlength="80" placeholder="Note, e.g. Found in the Hooknose den" />'}
        <button type="button" data-do="give" class="manage__btn manage__btn--good">Give</button>
      </div>`;
  }
  root.addEventListener('input', (e) => {
    if (e.target.name !== 'itemsearch') return;
    query = e.target.value;
    drawPicker();
  });

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
    const sel = e.target.closest('.manage__party');
    if (!sel) return;
    const c = hero();
    let name = sel.value;
    if (name === '+') {
      name = (prompt('Name of the new party:') ?? '').trim().slice(0, 40);
      if (!name) { render(); return; }
    }
    change(`${c.name} is now in ${name}.`, (h) => { h.party = name; });
  });
  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('.manage__close')) { close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    const c = hero();
    if (b.dataset.shelf) { shelf = b.dataset.shelf; root.querySelectorAll('[data-shelf]').forEach((x) => x.classList.toggle('is-on', x === b)); drawPicker(); return; }
    if (b.dataset.pick) { picked = b.dataset.pick; drawPicker(); root.querySelector('.give__chosen')?.scrollIntoView({ block: 'nearest' }); return; }
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
        const key = picked;
        if (!key) return;
        if (key.startsWith('lore:')) {
          const l = loreItems().find((x) => `lore:${x.id}` === key);
          if (!l) return;
          Promise.resolve(onGiveLore?.(l.id, c.id)).then(() => { said = `Gave ${n} “${l.title}”. It is in the Journal now.`; render(); }).catch((err) => { said = err.message; render(); });
          return;
        }
        const name = root.querySelector('[name=newname]')?.value.trim() ?? '';
        const note = root.querySelector('[name=note]')?.value.trim() ?? '';
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
    open(heroId) { id = heroId; said = ''; picked = null; root.hidden = false; render(); },
    // A hero changed (maybe on another device): redraw if it is the one open.
    refresh(heroId) { if (!root.hidden && heroId === id && !root.contains(document.activeElement?.closest('input, select'))) render(); },
    close,
  };
}

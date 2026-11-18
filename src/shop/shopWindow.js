// The shop window: the shop's wares with prices, the buyer's purse, and Buy. Players buy for their
// own hero; the DM picks which hero buys, and can edit the stock (prices, add, remove, closed).
import { ITEMS } from '../data/items.js';
import { icon, itemIcon } from '../ui/icons.js';
import { priceText, purseText, totalCp, sellPrice } from './shops.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// root: an empty element (it becomes the overlay). heroes(): who can buy (the heroes in the scene);
// me(): { dm, heroId }; onBuy(heroId, itemId, price) → Promise; onSell(heroId, index, price) → Promise;
// onSaveShop(shop, data) → Promise.
export function createShopWindow(root, { heroes, me, onBuy, onSell, onSaveShop }) {
  root.className = 'shop';
  root.hidden = true;
  let shop = null, buyer = null, editing = false, said = '', query = '', tab = 'buy';

  function draw() {
    if (!shop) return;
    const m = me(), list = heroes();
    if (!m.dm) buyer = m.heroId;
    else if (!list.some((c) => c.id === buyer)) buyer = list[0]?.id ?? null;
    const hero = list.find((c) => c.id === buyer);
    const money = totalCp(hero?.coins);
    const wares = shop.stock.filter((w) => ITEMS[w.id]);
    root.innerHTML = `
      <div class="shop__card" role="dialog" aria-label="${esc(shop.name)}">
        <header class="shop__head">
          <span class="shop__sign">${icon('coin')}</span>
          <div><h2>${esc(shop.name)}</h2>${shop.keeper ? `<small>${esc(shop.keeper)}${shop.greeting ? `: “${esc(shop.greeting)}”` : ''}</small>` : ''}</div>
          <button type="button" class="shop__close" aria-label="Close">×</button>
        </header>
        ${!shop.open && !m.dm ? '<p class="shop__closed">The shop is closed.</p>' : ''}
        <div class="shop__purse">
          ${m.dm ? `<label>Buying for <select class="shop__buyer">${list.map((c) => `<option value="${esc(c.id)}"${c.id === buyer ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : `<b>${esc(hero?.name ?? '')}</b>`}
          <span>${icon('coin', 'inline')} ${hero ? esc(purseText(hero.coins)) : '—'}</span>
          ${m.dm ? `<button type="button" class="shop__edit${editing ? ' is-on' : ''}">${icon('pen', 'inline')} ${editing ? 'Done' : 'Edit stock'}</button>` : ''}
        </div>
        ${editing ? '' : `<nav class="shop__tabs"><button type="button" data-tab="buy"${tab === 'buy' ? ' class="is-on"' : ''}>Buy</button><button type="button" data-tab="sell"${tab === 'sell' ? ' class="is-on"' : ''}>Sell</button></nav>`}
        <p class="shop__said" role="status">${esc(said)}</p>
        ${editing ? editor(wares) : tab === 'sell' ? seller(hero) : `
        <ul class="shop__wares">
          ${(shop.open || m.dm) && wares.length ? wares.map((w) => {
            const it = ITEMS[w.id], afford = money >= w.price;
            const sub = [it.dice ? `${it.dice} ${it.type}` : it.ac ? `AC ${it.kind === 'shield' ? '+' : ''}${it.ac}` : '', it.note].filter(Boolean).join(' · ');
            return `<li class="shop__ware${afford ? '' : ' is-dear'}">
              ${icon(itemIcon(it))}
              <span class="shop__what"><b>${esc(it.name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
              <span class="shop__price">${esc(priceText(w.price))}</span>
              <button type="button" class="shop__buy" data-buy="${esc(w.id)}"${afford && hero ? '' : ' disabled'}>Buy</button>
            </li>`;
          }).join('') : `<li class="shop__none">${shop.open ? 'Nothing for sale right now.' : 'Closed.'}</li>`}
        </ul>`}
      </div>`;
  }

  // Selling: the buyer's things (not what they hold or wear) at 75% of what they are worth.
  function seller(hero) {
    if (!hero) return '<ul class="shop__wares"><li class="shop__none">No hero to sell for.</li></ul>';
    const worn = new Set(Object.values(hero.equipped ?? {}));
    const rows = hero.items.map((i, index) => ({ i, index, it: ITEMS[i.id], price: ITEMS[i.id] ? sellPrice(i.id, shop) : null }))
      .filter((r) => r.it && r.price !== null && !(worn.has(r.i.id) && hero.items.filter((x) => x.id === r.i.id).reduce((n, x) => n + (x.qty ?? 1), 0) <= 1));
    return `<p class="shop__hint">${esc(shop.keeper || 'The shop')} pays 75% of what things are worth. What you hold or wear is not for sale.</p>
      <ul class="shop__wares">${rows.length ? rows.map((r) => `<li class="shop__ware">
        ${icon(itemIcon(r.it))}
        <span class="shop__what"><b>${esc(r.it.name)}${(r.i.qty ?? 1) > 1 ? ` ×${r.i.qty}` : ''}</b>${r.i.note ? `<small>${esc(r.i.note)}</small>` : ''}</span>
        <span class="shop__price">${esc(priceText(r.price))}</span>
        <button type="button" class="shop__buy shop__sell" data-sell="${r.index}">Sell</button>
      </li>`).join('') : '<li class="shop__none">Nothing to sell.</li>'}</ul>`;
  }

  // The DM's stock editor: price per ware (in gp, sp or cp as typed), remove, add any item, open/closed.
  function editor(wares) {
    const q = query.trim().toLowerCase();
    const extra = q ? Object.entries(ITEMS).filter(([id, it]) => it.kind !== 'passenger' && !wares.some((w) => w.id === id) && it.name.toLowerCase().includes(q)).slice(0, 8) : [];
    return `
      <label class="toggle shop__open"><input type="checkbox" class="shop__open-box"${shop.open ? ' checked' : ''} /> Open: the players can buy here</label>
      <ul class="shop__wares shop__wares--edit">
        ${wares.map((w) => `<li class="shop__ware">${icon(itemIcon(ITEMS[w.id]))}<span class="shop__what"><b>${esc(ITEMS[w.id].name)}</b></span>
          <input class="shop__price-in" data-price="${esc(w.id)}" value="${esc(priceText(w.price))}" aria-label="Price" />
          <button type="button" class="shop__remove" data-remove="${esc(w.id)}" aria-label="Remove">×</button></li>`).join('')}
      </ul>
      <input class="shop__search" type="search" placeholder="Add an item: type its name…" value="${esc(query)}" />
      <ul class="shop__add">${extra.map(([id, it]) => `<li><button type="button" data-add="${esc(id)}">${icon(itemIcon(it))}${esc(it.name)}</button></li>`).join('')}</ul>
      <p class="shop__hint">Prices like “5 gp”, “3 sp” or “2 gp 5 sp”. Changes are saved at once.</p>`;
  }

  // "2 gp 5 sp" → 250 (cp). A bare number counts as gold.
  function parsePrice(text) {
    let cp = 0, found = false;
    for (const [, n, unit] of String(text).toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(pp|gp|sp|cp)?/g)) {
      found = true;
      cp += Math.round(Number(n) * { pp: 1000, gp: 100, sp: 10, cp: 1 }[unit ?? 'gp']);
    }
    return found ? Math.max(0, cp) : null;
  }

  async function saveStock(stock, more = {}) {
    try {
      await onSaveShop(shop, { stock: stock.map((w) => [w.id, w.price]), open: shop.open, ...more });
      shop.stock = stock;
    } catch (err) { said = err.message; }
    draw();
  }

  root.addEventListener('click', async (e) => {
    if (e.target === root || e.target.closest('.shop__close')) { close(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; said = ''; draw(); return; }
    if (b.dataset.sell) {
      const hero = heroes().find((c) => c.id === buyer), i = hero?.items[Number(b.dataset.sell)];
      const price = i && sellPrice(i.id, shop);
      if (!i || price === null) return;
      b.disabled = true;
      try { await onSell(buyer, Number(b.dataset.sell), price); said = `Sold ${ITEMS[i.id].name} for ${priceText(price)}.`; } catch (err) { said = err.message; }
      draw();
      return;
    }
    if (b.classList.contains('shop__edit')) { editing = !editing; query = ''; said = ''; draw(); return; }
    if (b.dataset.remove) { saveStock(shop.stock.filter((w) => w.id !== b.dataset.remove)); return; }
    if (b.dataset.add) { query = ''; saveStock([...shop.stock, { id: b.dataset.add, price: 100 }]); return; }
    if (b.dataset.buy) {
      const w = shop.stock.find((x) => x.id === b.dataset.buy);
      if (!w || !buyer) return;
      b.disabled = true;
      try {
        await onBuy(buyer, w.id, w.price);
        said = `Bought ${ITEMS[w.id].name} for ${priceText(w.price)}.`;
      } catch (err) { said = err.message; }
      draw();
    }
  });
  root.addEventListener('change', (e) => {
    if (e.target.classList.contains('shop__buyer')) { buyer = e.target.value; said = ''; draw(); return; }
    if (e.target.classList.contains('shop__open-box')) { shop.open = e.target.checked; saveStock(shop.stock); return; }
    if (e.target.dataset.price) {
      const cp = parsePrice(e.target.value);
      if (cp === null) { draw(); return; }
      saveStock(shop.stock.map((w) => (w.id === e.target.dataset.price ? { ...w, price: cp } : w)));
    }
  });
  root.addEventListener('input', (e) => {
    if (!e.target.classList.contains('shop__search')) return;
    query = e.target.value;
    draw();
    const i = root.querySelector('.shop__search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  });
  function close() { root.hidden = true; shop = null; editing = false; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  return {
    open(s) { shop = { ...s, stock: [...s.stock] }; said = ''; editing = false; query = ''; tab = 'buy'; root.hidden = false; draw(); },
    // Someone's purse or the shop changed elsewhere: redraw if open (not while the DM is typing a price).
    refresh(s) {
      if (root.hidden) return;
      if (s && !editing) shop = { ...s, stock: [...s.stock] };
      if (!root.contains(document.activeElement?.closest('input, select'))) draw();
    },
    get area() { return shop?.area ?? null; },
  };
}

// Shops: scene places where the players can buy things. Each shop belongs to a scene area; while
// the party is there, a "Shop" button opens a small window with the wares, their prices and the
// hero's purse. The DM can change the stock and prices (saved as a journal row, kind 'shop').
//
// Prices are in copper pieces (cp): 1 gp = 10 sp = 100 cp, 1 pp = 10 gp.
import { ITEMS } from '../data/items.js';

// The shops and what they sell to start with: [item id, price in cp].
export const SHOPS = {
  kvini: {
    name: 'Kvini', keeper: 'The shopkeeper of Kvini', greeting: 'Potions, rope, lamps. Haggle if you dare.',
    stock: [['health-potion', 5000], ['greater-health-potion', 15000], ['antidote', 5000], ['potion-of-courage', 7500], ['rope', 100], ['torch', 1], ['lantern', 500], ['rations', 50], ['waterskin', 20], ['bedroll', 100], ['healers-kit', 500], ['curved-knife', 200]],
  },
  'habibi-hands': {
    name: 'Habibi Hands: Grill & Guide', keeper: 'Habibi', greeting: 'Bror! Best kebab in Razz, I promise you.',
    stock: [['kebab', 30], ['warm-beer', 10], ['mojito', 200], ['rations', 60], ['waterskin', 25]],
  },
  shop: {
    name: 'Bob’s shop', keeper: 'Bob', greeting: 'Everything’s fresh. Well, fresh-ish. It’s fish.',
    stock: [['fish-and-chips', 40], ['smoked-eel', 30], ['swordfish-dagger', 300], ['cutlass', 1200], ['darts', 50], ['throwing-knives', 300], ['health-potion', 6000], ['spyglass', 10000], ['compass', 2500], ['fishing-rod', 100], ['sea-chart', 1500]],
  },
  tavern: {
    name: 'The bar in Ytterhavn', keeper: 'Bobby', greeting: 'Welcome, friends. Prices are… Ytterhavn prices.',
    stock: [['warm-beer', 40], ['mojito', 400], ['smoked-eel', 60]],
  },
  sirivikcentre: {
    name: 'Three-Fingered Paul’s shop', keeper: 'Three-Fingered Paul', greeting: 'Take what you need. Leave before the fog thickens.',
    stock: [['obsidian-knife', 400], ['health-potion', 5000], ['iron-helmet', 1000], ['rope', 100], ['torch', 2], ['lantern', 600], ['rations', 50], ['crow-feather', 5]],
  },
  sirivikbar: {
    name: 'Per Hul Øye’s bar', keeper: 'Per Hul Øye', greeting: 'Drink. Don’t talk too much about yourself.',
    stock: [['warm-beer', 5], ['rations', 40]],
  },
};

// A shop as it is now: the DM's saved changes (a journal row) over the defaults.
export function shopFor(area, entries) {
  const base = SHOPS[area];
  const row = entries.find((e) => e.data.kind === 'shop' && e.data.area === area);
  if (!base && !row) return null;
  return {
    area, row,
    name: row?.data.name ?? base?.name ?? 'A shop',
    keeper: row?.data.keeper ?? base?.keeper ?? '',
    greeting: row?.data.greeting ?? base?.greeting ?? '',
    open: row?.data.open ?? true,
    stock: (row?.data.stock ?? base?.stock ?? []).map(([id, price]) => ({ id, price })),
  };
}

// --- What things are worth (for selling back) --------------------------------------------------
export const SELL_SHARE = 0.75; // shops buy at 75% of an item's value

const DEFAULT_GP = { '1d4': 2, '1d6': 10, '1d8': 15, '1d10': 20, '1d12': 30, '2d6': 50 };
// An item's value in cp: what this shop asks for it, else the lowest any shop asks, else a 5e-ish
// default by kind. null for things that cannot be sold (unknown, the young Hooknose…).
export function valueOf(id, shop) {
  const here = shop?.stock.find((w) => w.id === id);
  if (here) return here.price;
  const asks = Object.values(SHOPS).flatMap((sh) => sh.stock).filter(([sid]) => sid === id).map(([, p]) => p);
  if (asks.length) return Math.min(...asks);
  const it = ITEMS[id];
  if (!it || it.kind === 'passenger') return null;
  if (it.kind === 'weapon') return (DEFAULT_GP[it.dice] ?? 10) * 100 * (it.gem ? 10 : 1);
  if (it.kind === 'armour') return ({ Light: 10, Medium: 50, Heavy: 75 }[it.category] ?? 10) * 100;
  if (it.kind === 'shield') return 1000;
  const worth = /worth about (\d+) gp/i.exec(it.note ?? '');
  if (worth) return Number(worth[1]) * 100;
  return ({ potions: 5000, food: 20, tools: 500, treasure: 2500, curio: 10 }[it.group] ?? 50);
}
export const sellPrice = (id, shop) => { const v = valueOf(id, shop); return v === null ? null : Math.max(1, Math.floor(v * SELL_SHARE)); };

// Adds `cp` to a purse as change (gp, sp, cp).
export function receive(coins, cp) {
  coins.gp = (coins.gp ?? 0) + Math.floor(cp / 100);
  coins.sp = (coins.sp ?? 0) + Math.floor((cp % 100) / 10);
  coins.cp = (coins.cp ?? 0) + (cp % 10);
}

// --- Money ---------------------------------------------------------------------------------------
export const totalCp = (coins = {}) => (coins.pp ?? 0) * 1000 + (coins.gp ?? 0) * 100 + (coins.sp ?? 0) * 10 + (coins.cp ?? 0);
export function priceText(cp) {
  if (cp >= 100 && cp % 100 === 0) return `${cp / 100} gp`;
  if (cp >= 100) return `${Math.floor(cp / 100)} gp ${cp % 100 >= 10 ? `${Math.floor((cp % 100) / 10)} sp` : ''}${cp % 10 ? ` ${cp % 10} cp` : ''}`.replace(/\s+/g, ' ').trim();
  if (cp >= 10) return `${Math.floor(cp / 10)} sp${cp % 10 ? ` ${cp % 10} cp` : ''}`;
  return `${cp} cp`;
}
export const purseText = (coins = {}) => ['pp', 'gp', 'sp', 'cp'].filter((k) => coins[k]).map((k) => `${coins[k]} ${k}`).join(' · ') || 'no money';

// Pays `cp` from a purse: the coins are given as change the way a shopkeeper would (platinum kept
// while it can be). Returns false if there is not enough.
export function pay(coins, cp) {
  const total = totalCp(coins);
  if (cp > total) return false;
  let left = total - cp;
  const pp = Math.min(coins.pp ?? 0, Math.floor(left / 1000));
  left -= pp * 1000;
  const gp = Math.floor(left / 100); left -= gp * 100;
  const sp = Math.floor(left / 10); left -= sp * 10;
  Object.assign(coins, { pp, gp, sp, cp: left });
  return true;
}

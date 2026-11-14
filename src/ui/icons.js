// Icons. `icon(name)` gives a painted icon (public/art/icons/<name>.webp, built by
// tools/paint-icons.mjs from the owner's painted pack plus drawings in the same style);
// a name without a painted icon falls back to the flat drawings below.
const PAINTED = new Set(['ac', 'armour', 'bag', 'bestiary', 'bow', 'cha', 'chart', 'check', 'cloud', 'coin', 'combat', 'con',
  'crown', 'dagger', 'dex', 'gem', 'hero', 'hp', 'init', 'int', 'journal', 'lock', 'longsword', 'magic', 'map', 'moon', 'party',
  'pen', 'pin', 'plus', 'potion', 'prof', 'protection', 'rain', 'scene', 'katana', 'tanto', 'bane', 'longblade', 'rapier', 'handaxe', 'greataxe', 'mace', 'staff', 'spear', 'longbow', 'flamebow', 'crossbow', 'scroll', 'snow', 'speed', 'storm', 'str', 'sun', 'sword',
  'windy', 'wis', 'xp']);
const BASE = `${import.meta.env.BASE_URL}art/icons/`;

const INK = '#2a1f2a';

// Draws `d` as a thick ink line under a coloured line, for swords, arrows and the like.
const line = (d, colour, width = 2) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width + 2}"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}"/>`;

const ART = {
  // --- Vitals ---
  hp: '<path d="M12 20.5s-7.8-4.7-7.8-10.3A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.8 2.6c0 5.6-7.8 10.3-7.8 10.3z" fill="#d9503f"/><path d="M7.3 9.3a2.3 2.3 0 0 1 2.2-1.6" fill="none" stroke="#f7b8aa" stroke-width="1.3"/>',
  ac: '<path d="M12 2.8l7.5 2.7v5.6c0 4.7-3.1 8.2-7.5 10.2-4.4-2-7.5-5.5-7.5-10.2V5.5z" fill="#5f9fc7"/><path d="M12 4.6v15.2M6.3 10.6h11.4" fill="none" stroke="#f0c95a" stroke-width="2.2"/><path d="M12 2.8l7.5 2.7v5.6c0 4.7-3.1 8.2-7.5 10.2-4.4-2-7.5-5.5-7.5-10.2V5.5z" fill="none"/>',
  init: '<path d="M13.8 2.3L5.3 13.6h5.6l-1.6 8.1 9.1-11.9h-5.8z" fill="#f0c95a"/>',
  speed: '<path d="M9 3h5.5v8.6l4.7 2.1c1.2.5 1.8 1.5 1.8 2.8V20H8.5z" fill="#a8693f"/><path d="M8.5 17.5H21" fill="none"/><path d="M9.5 6.5c-2.5-.5-4.5.5-6 2.2 2.2-.3 3.8.3 6 1.2" fill="#efe5d2"/><path d="M2 13h4M3 16h3.5" fill="none" stroke="#efe5d2" stroke-width="1.6"/>',
  prof: '<path d="M12 2.6l2.9 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.3l-5.8 3 1.1-6.4-4.6-4.5 6.4-.9z" fill="#f0c95a"/>',
  xp: '<path d="M12 2.6l7.2 9.4-7.2 9.4-7.2-9.4z" fill="#f0c95a"/><path d="M4.8 12h14.4M12 2.6v18.8" fill="none" stroke="#a87a2a" stroke-width="1"/><path d="M12 2.6l7.2 9.4-7.2 9.4-7.2-9.4z" fill="none"/>',
  // --- The six abilities ---
  str: '<path d="M4 20.5c-.8-3.2.4-6.4 2.6-8.5l2.3-4.4c.6-1.4 2.2-2 3.4-1.3l1.1.6-1.3 3.7 2.4-.4c2.8-.4 5.4 1.6 5.4 4.8 0 3.6-3.2 5.5-6.4 5.5z" fill="#e8b98c"/><path d="M11 13.5c1.5-.8 3.5-.8 5 .2" fill="none" stroke="#b07d55" stroke-width="1.2"/>',
  dex: `${line('M4 20L18 6', '#c79a63', 1.6)}<path d="M18 6l-1-3.5L21.5 2 21 6.5z" fill="#cfd6de"/><path d="M4 20l-1.5-3L5 15.5 7.5 17zM6 18l-1-3 2.5-1.5 2.5 1.5" fill="#d9503f"/>`,
  con: '<path d="M14.5 3.4a6.2 6.2 0 0 1 6.1 7c-.4 3-3.1 5.4-6.1 5.4l-3.6 3.6a2.1 2.1 0 1 1-3-3 2.1 2.1 0 1 1-3-3l3.6-3.6c0-3.2 2.8-6.3 6-6.4z" fill="#c0703f"/><path d="M10.9 19.4a2.1 2.1 0 1 1-3-3 2.1 2.1 0 1 1-3-3l1.6-1.6 6 6z" fill="#efe5d2"/><path d="M13 6.5c1.5-1 3.5-1 4.5.3" fill="none" stroke="#e8a679" stroke-width="1.3"/>',
  int: '<path d="M2.5 5.5c3.2-1 6.4-1 9.5 1 3.1-2 6.3-2 9.5-1v13.3c-3.2-1-6.4-1-9.5 1-3.1-2-6.3-2-9.5-1z" fill="#f4ead8"/><path d="M12 6.5v13.3" fill="none"/><path d="M5 9.3c1.6-.3 3.2-.2 4.6.4M5 12.3c1.6-.3 3.2-.2 4.6.4M14.4 9.7c1.4-.6 3-.7 4.6-.4M14.4 12.7c1.4-.6 3-.7 4.6-.4" fill="none" stroke="#5f9fc7" stroke-width="1.3"/>',
  wis: '<path d="M1.8 12S5.4 5.8 12 5.8 22.2 12 22.2 12 18.6 18.2 12 18.2 1.8 12 1.8 12z" fill="#f4ead8"/><circle cx="12" cy="12" r="3.6" fill="#8f6fd0"/><circle cx="12" cy="12" r="1.4" fill="#2a1f2a" stroke="none"/><circle cx="13.2" cy="10.8" r=".7" fill="#fff" stroke="none"/>',
  cha: '<path d="M4.2 3.8h15.6a1.7 1.7 0 0 1 1.7 1.7v9a1.7 1.7 0 0 1-1.7 1.7h-8.6l-5 4.1v-4.1h-2a1.7 1.7 0 0 1-1.7-1.7v-9a1.7 1.7 0 0 1 1.7-1.7z" fill="#f4ead8"/><path d="M8 10.3c.3-1.3 2-1.3 2.2 0 .3-1.3 2-1.3 2.2 0 0 1.3-2.2 2.6-2.2 2.6S8 11.6 8 10.3z" fill="#d9503f" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="#8f6fd0" stroke="none"/>',
  // --- Screens ---
  map: '<path d="M2.5 5.6l6.2-2.2 6.6 2.2 6.2-2.2v15l-6.2 2.2-6.6-2.2-6.2 2.2z" fill="#eedcb6"/><path d="M4.5 8.5c1.5-.7 3-.4 3.5 1s-1 3-3.5 2.6M17 15.5c1-1.5 2.8-1.7 3-.5" fill="#86c25c" stroke="none"/><path d="M8.7 3.4v15M15.3 5.6v15" fill="none"/><path d="M10.6 9.4l2.8 2.8M13.4 9.4l-2.8 2.8" fill="none" stroke="#d9503f" stroke-width="1.7"/>',
  hero: '<path d="M12 5.8c-3.9 0-7 3.1-7 7v7.4h14v-7.4c0-3.9-3.1-7-7-7z" fill="#c4bdb4"/><path d="M12 5.8v14.4" fill="none"/><path d="M7 13.3h3.5M13.5 13.3H17" fill="none" stroke="#2a1f2a" stroke-width="1.8"/><path d="M12 5.8c0-2.1 1.8-3.6 4.6-3.4-.6 1.6-1.9 2.9-4.6 3.4z" fill="#d9503f"/>',
  party: line('M5 2.5v19.2', '#a8693f', 1.8) + '<path d="M6.2 4h13.3l-3.1 4.6 3.1 4.6H6.2z" fill="#d9503f"/><path d="M11.8 6.3l.8 1.6 1.7.3-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.3z" fill="#f0c95a" stroke="none"/>',
  journal: '<path d="M5 3.3h12.8a1.4 1.4 0 0 1 1.4 1.4v16H6.5A1.5 1.5 0 0 1 5 19.2z" fill="#9a3b30"/><path d="M8 3.3v17.4" fill="none"/><path d="M14 3.3v6.3l1.6-1.3 1.6 1.3V3.3" fill="#f0c95a"/><path d="M10 13h6.5M10 15.5h5" fill="none" stroke="#e8b98c" stroke-width="1.2"/>',
  combat: `${line('M4 4l11.5 11.5M20 4L8.5 15.5', '#dfe6ee', 2)}${line('M12.8 17.8l5-5M6.2 12.8l5 5', '#f0c95a', 2)}${line('M16.5 16.5l3.6 3.6M7.5 16.5l-3.6 3.6', '#a8693f', 2.2)}`,
  bestiary: '<path d="M6 8C3.3 7 2.6 4.4 3.1 2.6c1.1 1.7 2.7 2.6 4.4 2.8M18 8c2.7-1 3.4-3.6 2.9-5.4-1.1 1.7-2.7 2.6-4.4 2.8" fill="#c4bdb4"/><path d="M12 4c-4.4 0-7.6 3-7.6 7 0 2.5 1.2 4.3 3 5.3v3.4h9.2v-3.4c1.8-1 3-2.8 3-5.3 0-4-3.2-7-7.6-7z" fill="#f4ead8"/><path d="M7.4 10.6l3.4.8-.5 2.6-2.9-.6zM16.6 10.6l-3.4.8.5 2.6 2.9-.6z" fill="#d9503f"/><path d="M10.4 19.7v-2.2M13.6 19.7v-2.2" fill="none"/>',
  crown: '<path d="M3 7.6l4.6 4.1L12 4.6l4.4 7.1L21 7.6l-2 11.6H5z" fill="#f0c95a"/><path d="M5.5 16h13" fill="none" stroke="#a87a2a" stroke-width="1.2"/><circle cx="12" cy="12.8" r="1.5" fill="#d9503f"/>',
  // --- Attacks and gear ---
  sword: `<path d="M20.8 3.2l-.9 4.2-9.7 9.7-3.3-3.3 9.7-9.7z" fill="#e6ecf2"/><path d="M19.5 4.5l-9.6 9.6" fill="none" stroke="#a9b4c0" stroke-width="1"/>${line('M5 12.6l6.4 6.4', '#f0c95a', 2.2)}${line('M8.2 15.8L3.6 20.4', '#a8693f', 2.2)}`,
  bow: `${line('M5 3.2c8.6 0 15.8 7.2 15.8 15.8', '#b8793f', 2.2)}<path d="M5 3.2L20.8 19" fill="none" stroke="#efe5d2" stroke-width=".9"/>${line('M3.5 20.5l13-13', '#c79a63', 1.4)}<path d="M17.8 6.2l-4.3.6 3.7 3.7z" fill="#cfd6de"/>`,
  dagger: `<path d="M19.5 4.5l-.7 3.4-6.4 6.4-2.7-2.7 6.4-6.4z" fill="#e6ecf2"/>${line('M8.2 11.4l4.4 4.4', '#f0c95a', 2)}${line('M10.4 13.6l-4.6 4.6', '#a8693f', 2.2)}`,
  magic: '<path d="M12 2.5l2.1 7.4 7.4 2.1-7.4 2.1-2.1 7.4-2.1-7.4L2.5 12l7.4-2.1z" fill="#8fd3ea"/><path d="M12 7.5l1 3.5 3.5 1-3.5 1-1 3.5-1-3.5-3.5-1 3.5-1z" fill="#ffffff" stroke="none"/><path d="M19 2.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#c4a8ff"/>',
  armour: '<path d="M7.2 3.3l2.9 2h3.8l2.9-2 3.7 2.6-1.6 4.6v9.8H5.1v-9.8L3.5 5.9z" fill="#c4bdb4"/><path d="M12 5.3v15.2" fill="none"/><path d="M8 12.8h8" fill="none" stroke="#8a8191" stroke-width="1.3"/>',
  bag: `<path d="M8.4 7.6c-3 2-4.6 5.6-4.6 8.6 0 3 2.6 4.4 8.2 4.4s8.2-1.4 8.2-4.4c0-3-1.6-6.6-4.6-8.6z" fill="#a8693f"/><path d="M8.4 7.6L7 3.4h10l-1.4 4.2z" fill="#c0844f"/>${line('M8.6 7.6h6.8', '#f0c95a', 1.6)}`,
  coin: '<circle cx="12" cy="12" r="8.6" fill="#f0c95a"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#a87a2a" stroke-width="1.2"/><path d="M8.3 8.3a5 5 0 0 1 3-1.6" fill="none" stroke="#fff3c4" stroke-width="1.3"/>',
  gem: '<path d="M7 4h10l4.3 5.2L12 20.4 2.7 9.2z" fill="#62b9d0"/><path d="M2.7 9.2h18.6M9 4L7.6 9.2 12 20.4M15 4l1.4 5.2L12 20.4" fill="none" stroke-width="1"/><path d="M8.6 5.5l-1 2.6" fill="none" stroke="#d6f3fb" stroke-width="1.2"/>',
  potion: '<path d="M10 2.8h4v5.6c3 1 5 3.6 5 6.6a7 7 0 0 1-14 0c0-3 2-5.6 5-6.6z" fill="#f4ead8"/><path d="M5.2 14.2h13.6a6.8 6.8 0 0 1-13.6 0z" fill="#d9503f" stroke="none"/><path d="M10 2.8h4v5.6c3 1 5 3.6 5 6.6a7 7 0 0 1-14 0c0-3 2-5.6 5-6.6z" fill="none"/><path d="M9.5 2.8h5" fill="none" stroke-width="2.2"/>',
  // --- Sky ---
  sun: '<path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" fill="none" stroke="#f0c95a" stroke-width="2.2"/><circle cx="12" cy="12" r="5.2" fill="#f7cf55"/><path d="M9.4 10.4a3 3 0 0 1 2-1.9" fill="none" stroke="#fff3c4" stroke-width="1.3"/>',
  moon: '<path d="M15.5 2.8a8.8 8.8 0 1 0 5.8 14.4 7.2 7.2 0 0 1-5.8-14.4z" fill="#f4ead8"/><circle cx="9" cy="10" r="1.2" fill="#d6cbb6" stroke="none"/><circle cx="11.5" cy="15.5" r=".9" fill="#d6cbb6" stroke="none"/>',
  cloud: '<path d="M7 18.6a4.2 4.2 0 0 1-.6-8.3 5.7 5.7 0 0 1 11-1.3 4.8 4.8 0 0 1 .2 9.6z" fill="#f4ead8"/>',
  rain: '<path d="M7 13.6a4.1 4.1 0 0 1-.6-8.1 5.6 5.6 0 0 1 10.8-1.3 4.7 4.7 0 0 1 .2 9.4z" fill="#c4c9d2"/><path d="M8 16.5l-1.2 3.5M12.5 16.5l-1.2 3.5M17 16.5l-1.2 3.5" fill="none" stroke="#62b9d0" stroke-width="1.8"/>',
  storm: '<path d="M7 13.4a4.1 4.1 0 0 1-.6-8.1 5.6 5.6 0 0 1 10.8-1.3 4.7 4.7 0 0 1 .2 9.4z" fill="#7d7488"/><path d="M12.8 11.5l-3.6 5.3h2.6l-1 5 4.4-6.4h-2.7l1.4-3.9z" fill="#f0c95a"/>',
  snow: line('M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 3.8L12 6.2l2.5-2.4M9.5 20.2L12 17.8l2.5 2.4', '#ffffff', 1.6),
  windy: line('M2.5 9h12a3 3 0 1 0-3-3M2.5 14h16a3 3 0 1 1-3 3M4.5 11.5h6', '#efe5d2', 1.8),
  // --- Quests ---
  scroll: '<path d="M6.5 4.2h12v13.6a2.6 2.6 0 0 1-2.6 2.6H5.3" fill="#f0e2c0"/><path d="M5.3 20.4a2.6 2.6 0 0 0 2.6-2.6V5.6a1.4 1.4 0 0 0-2.8 0v2.6h2.8" fill="#e2cfa4"/><path d="M10.5 8.5h5.5M10.5 11.5h5.5M10.5 14.5h4" fill="none" stroke="#a87a2a" stroke-width="1.2"/>',
  check: line('M4 12.5l5 5L20.5 6', '#86c25c', 2.6),
  lock: '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="#2a1f2a" stroke-width="3.4"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="#c4bdb4" stroke-width="1.6"/><rect x="4.8" y="10.3" width="14.4" height="10.4" rx="1.6" fill="#f0c95a"/><path d="M12 14v3" fill="none" stroke-width="2"/>',
  pin: '<path d="M12 21.5s-6.3-6.4-6.3-11.2a6.3 6.3 0 0 1 12.6 0c0 4.8-6.3 11.2-6.3 11.2z" fill="#d9503f"/><circle cx="12" cy="10.2" r="2.4" fill="#f4ead8"/>',
  pen: `<path d="M20.5 3c-6.5.7-11.4 5.6-12.8 11.6l1.7 1.7C15.4 14.9 20.2 10 20.5 3z" fill="#f4ead8"/><path d="M20.5 3L8.6 15.5" fill="none" stroke-width="1"/>${line('M8.4 15.6L4 20', '#a8693f', 1.6)}`,
  plus: line('M12 4.5v15M4.5 12h15', '#f4ead8', 2.6),
};

export const ICON_NAMES = Object.keys(ART);

export function icon(name, cls = '') {
  const url = PAINTED.has(name) ? `${BASE}${name}.webp` : null;
  if (url) return `<img class="ic${cls ? ` ${cls}` : ''}" src="${url}" alt="" draggable="false" />`;
  return `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ART[name] ?? ''}</svg>`;
}

// The icon for a weapon (an item from data/items.js), by its look.
const WEAPON_ICON = {
  katana: 'katana', tanto: 'tanto', longsword: 'longsword', shortsword: 'sword', rapier: 'rapier', dagger: 'dagger',
  handaxe: 'handaxe', greataxe: 'greataxe', mace: 'mace', staff: 'staff', spear: 'spear',
  shortbow: 'bow', longbow: 'longbow', crossbow: 'crossbow',
};
export function weaponIcon(w) {
  if (!w) return 'sword';
  if (w.gem) return 'bane';
  if (w.arrows === 'flame') return 'flamebow';
  if (/throwing knives/i.test(w.name ?? '')) return 'dagger';
  return WEAPON_ICON[w.model] ?? 'sword';
}
// The icon for an attack known only by its name (monsters, spells).
export function attackNameIcon(name = '', type = '') {
  const n = `${name} ${type}`.toLowerCase();
  if (/crossbow/.test(n)) return 'crossbow';
  if (/longbow/.test(n)) return 'longbow';
  if (/bow|arrow|shot|sling/.test(n)) return 'bow';
  if (/bolt|ray|breath|spell|curse|magic|blast|flaming|fire/.test(n)) return 'magic';
  if (/cocktail|bottle|beer|mojito|potion/.test(n)) return 'potion';
  if (/katana/.test(n)) return 'katana';
  if (/rapier/.test(n)) return 'rapier';
  if (/greataxe/.test(n)) return 'greataxe';
  if (/axe/.test(n)) return 'handaxe';
  if (/knife|dagger|tant|throw/.test(n)) return 'dagger';
  if (/mace|club|hammer|dumbbell/.test(n)) return 'mace';
  if (/spear|javelin|trident/.test(n)) return 'spear';
  if (/staff/.test(n)) return 'staff';
  if (/fist|punch|slam|shove|headbutt|unarmed|grapple|wrestl/.test(n)) return 'str';
  if (/longsword/.test(n)) return 'longsword';
  return 'sword';
}

// The icon for any item from data/items.js.
export function itemIcon(it) {
  if (!it) return 'bag';
  if (it.kind === 'weapon') return weaponIcon(it);
  if (it.kind === 'armour') return 'armour';
  if (it.kind === 'shield') return 'ac';
  if (it.gem || /gem|pearl/i.test(it.name ?? '')) return 'gem';
  if (/potion|elixir|flask|antidote|cocktail/i.test(it.name ?? '')) return 'potion';
  if (/\bmap\b|chart/i.test(it.name ?? '')) return 'chart';
  if (/condom/i.test(it.name ?? '')) return 'protection';
  if (/ring|locket|coin|gold/i.test(it.name ?? '')) return 'coin';
  if (/book|letter|note|scroll/i.test(it.name ?? '')) return 'scroll';
  if (/lantern|torch/i.test(it.name ?? '')) return 'sun';
  return 'bag';
}

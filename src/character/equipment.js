// Equipping and unequipping gear, following the 5e rules for hands:
//   - two-handed weapons (bows) need both hands, so the off hand is emptied;
//   - an off-hand weapon must be light, and so must the one in the main hand.
// Choices are remembered on this device until characters are saved online.
import { ITEMS, has } from '../data/items.js';

export const SLOTS = [
  { id: 'mainHand', label: 'Main hand' },
  { id: 'offHand', label: 'Off hand' },
  { id: 'armour', label: 'Armour' },
];

const owned = (c) => c.items.map((i) => i.id).filter((id) => ITEMS[id]);

// What may go in a slot right now, and why a slot is unavailable.
export function optionsFor(c, slot) {
  const ids = owned(c);
  if (slot === 'armour') return { ids: ids.filter((id) => ITEMS[id].kind === 'armour') };
  const weapons = ids.filter((id) => ITEMS[id].kind === 'weapon');
  if (slot === 'mainHand') return { ids: weapons };
  const main = ITEMS[c.equipped.mainHand];
  if (main && has(main, 'two-handed')) return { ids: [], reason: `${main.name} needs both hands` };
  if (main && !has(main, 'light')) return { ids: [], reason: 'Needs a light weapon in the main hand' };
  return { ids: weapons.filter((id) => has(ITEMS[id], 'light') && id !== c.equipped.mainHand) };
}

export function equip(c, slot, id) {
  const e = c.equipped;
  e[slot] = id || null;
  if (slot === 'mainHand') {
    const main = ITEMS[e.mainHand];
    if (e.offHand === e.mainHand) e.offHand = null;
    if (main && (has(main, 'two-handed') || !has(main, 'light'))) e.offHand = null;
  }
  save(c);
}

const key = (c) => `dnd.equipped.${c.id}`;

function save(c) {
  try { localStorage.setItem(key(c), JSON.stringify(c.equipped)); } catch { /* storage unavailable */ }
}

// Restores saved choices, ignoring anything the character no longer owns.
export function restoreEquipment(characters) {
  for (const c of characters) {
    try {
      const saved = JSON.parse(localStorage.getItem(key(c)) ?? 'null');
      if (!saved) continue;
      const mine = new Set(owned(c));
      for (const slot of SLOTS) {
        if (slot.id in saved && (saved[slot.id] === null || mine.has(saved[slot.id]))) c.equipped[slot.id] = saved[slot.id];
      }
    } catch { /* storage unavailable or corrupt: keep the defaults */ }
  }
}

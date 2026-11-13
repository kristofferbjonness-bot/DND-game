// Equipping and unequipping gear, following the 5e rules for hands:
//   - two-handed weapons (bows) need both hands, so the off hand is emptied;
//   - an off-hand weapon must be light, and so must the one in the main hand;
//   - a shield fits in the off hand beside any one-handed weapon.
// Saving the change online is up to the caller.
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
  const shields = ids.filter((id) => ITEMS[id].kind === 'shield');
  const offWeapons = !main || has(main, 'light') ? weapons.filter((id) => has(ITEMS[id], 'light') && id !== c.equipped.mainHand) : [];
  const options = [...shields, ...offWeapons];
  return options.length ? { ids: options } : { ids: [], reason: 'Needs a light weapon in the main hand' };
}

export function equip(c, slot, id) {
  const e = c.equipped;
  e[slot] = id || null;
  if (slot === 'mainHand') {
    const main = ITEMS[e.mainHand], off = ITEMS[e.offHand];
    if (e.offHand === e.mainHand) e.offHand = null;
    if (main && has(main, 'two-handed')) e.offHand = null;
    else if (main && off?.kind === 'weapon' && !has(main, 'light')) e.offHand = null;
  }
}

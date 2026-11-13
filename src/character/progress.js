// What the Dungeon Master does to heroes between and during adventures:
// damage and healing, rests, experience, levelling up, and handing out loot.
// Each function changes the character in place; saving is up to the caller.
import { XP_FOR_LEVEL, modifier } from './rules.js';
import { CLASSES, featureFor } from './creator.js';
import { ITEMS } from '../data/items.js';

// Damage uses up temporary HP first; HP stays between 0 and the maximum.
export function damage(c, amount) {
  const fromTemp = Math.min(c.hp.temp ?? 0, amount);
  c.hp.temp = (c.hp.temp ?? 0) - fromTemp;
  c.hp.current = Math.max(0, c.hp.current - (amount - fromTemp));
}
export function heal(c, amount) {
  c.hp.current = Math.min(c.hp.max, c.hp.current + amount);
}

// Short rest: features that come back on a short rest are ready again.
export function shortRest(c) {
  for (const f of c.features) if (f.uses?.per === 'short rest') f.uses.used = 0;
}
// Long rest: full HP, every feature ready, and half the hit dice back.
export function longRest(c) {
  c.hp.current = c.hp.max;
  c.hp.temp = 0;
  for (const f of c.features) if (f.uses) f.uses.used = 0;
  c.hitDice.used = Math.max(0, c.hitDice.used - Math.max(1, Math.floor(c.hitDice.total / 2)));
}

export const MAX_LEVEL = 20;
export const readyToLevel = (c) => c.level < MAX_LEVEL && c.xp >= XP_FOR_LEVEL[c.level];

// One level up: average hit die + Con more HP, one more hit die, one attribute
// point to spend, and the class's new features when the app knows them (levels
// 1–2 for now). Returns what changed.
export function levelUp(c) {
  if (c.level >= MAX_LEVEL) return null;
  const die = Number(String(c.hitDice.die).replace('d', '')) || 8;
  const gain = Math.max(1, die / 2 + 1 + modifier(c.abilities.con) + (c.race === 'Hill Dwarf' ? 1 : 0));
  c.level += 1;
  c.xp = Math.max(c.xp, XP_FOR_LEVEL[c.level - 1]);
  c.hp.max += gain;
  c.hp.current += gain;
  c.hitDice.total += 1;
  c.abilityPoints = (c.abilityPoints ?? 0) + 1;
  const added = (CLASSES[c.class]?.features[c.level - 1] ?? [])
    .filter((f) => !c.features.some((have) => have.name === f.name))
    .map((f) => featureFor(f, c.abilities));
  c.features.push(...added);
  return { gain, features: added.map((f) => f.name) };
}

// Gives an item from the catalogue, or something new by name (`{ name, note }`).
// --- Attribute points: earned on level up, spent on the Hero screen ---------------------------
export const MAX_SCORE = 20; // the most an attribute can reach

export function giveAbilityPoint(c, n = 1) {
  c.abilityPoints = Math.max(0, (c.abilityPoints ?? 0) + n);
}

// Spends points: `adds` is { str: 1, con: 1, ... }. Raising Constitution also
// raises max HP by the change in its modifier for every level, as in D&D.
// Returns the extra HP.
export function spendAbilityPoints(c, adds) {
  const total = Object.values(adds).reduce((n, v) => n + v, 0);
  if (total <= 0) return 0;
  if (total > (c.abilityPoints ?? 0)) throw new Error('Not enough points.');
  for (const [k, v] of Object.entries(adds)) {
    if (v < 0 || c.abilities[k] === undefined || c.abilities[k] + v > MAX_SCORE) throw new Error(`An attribute can go up to ${MAX_SCORE}.`);
  }
  const conBefore = modifier(c.abilities.con);
  for (const [k, v] of Object.entries(adds)) c.abilities[k] += v;
  const hp = (modifier(c.abilities.con) - conBefore) * c.level;
  c.hp.max += hp;
  c.hp.current += hp;
  c.abilityPoints -= total;
  return hp;
}

export function giveItem(c, { id, name, note, qty = 1 }) {
  if (id && ITEMS[id]) {
    const have = c.items.find((i) => i.id === id && !i.note && !note);
    if (have) have.qty = (have.qty ?? 1) + qty;
    else c.items.push({ id, qty, ...(note ? { note } : {}) });
    return ITEMS[id].name;
  }
  c.items.push({ id: `custom-${Date.now().toString(36)}`, name, qty, ...(note ? { note } : {}) });
  return name;
}

// Takes one away (or the whole stack); anything no longer owned is unequipped.
export function takeItem(c, index) {
  const it = c.items[index];
  if (!it) return;
  if ((it.qty ?? 1) > 1) { it.qty -= 1; return; }
  c.items.splice(index, 1);
  if (!c.items.some((i) => i.id === it.id)) {
    for (const slot of Object.keys(c.equipped)) if (c.equipped[slot] === it.id) c.equipped[slot] = null;
  }
}

// What an inventory row is: a catalogue item, or a custom one the DM named.
export const itemInfo = (i) => ITEMS[i.id] ?? { name: i.name ?? 'Unknown item', kind: 'gear' };

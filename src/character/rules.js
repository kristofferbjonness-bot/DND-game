import { ITEMS, has } from '../data/items.js';

// D&D 5e rules needed for a character sheet. Characters only store the basics
// (scores, level, proficiencies); everything else is worked out here.

export const ABILITIES = [
  { id: 'str', name: 'Strength', short: 'STR' },
  { id: 'dex', name: 'Dexterity', short: 'DEX' },
  { id: 'con', name: 'Constitution', short: 'CON' },
  { id: 'int', name: 'Intelligence', short: 'INT' },
  { id: 'wis', name: 'Wisdom', short: 'WIS' },
  { id: 'cha', name: 'Charisma', short: 'CHA' },
];

export const SKILLS = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { id: 'animal-handling', name: 'Animal Handling', ability: 'wis' },
  { id: 'arcana', name: 'Arcana', ability: 'int' },
  { id: 'athletics', name: 'Athletics', ability: 'str' },
  { id: 'deception', name: 'Deception', ability: 'cha' },
  { id: 'history', name: 'History', ability: 'int' },
  { id: 'insight', name: 'Insight', ability: 'wis' },
  { id: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { id: 'investigation', name: 'Investigation', ability: 'int' },
  { id: 'medicine', name: 'Medicine', ability: 'wis' },
  { id: 'nature', name: 'Nature', ability: 'int' },
  { id: 'perception', name: 'Perception', ability: 'wis' },
  { id: 'performance', name: 'Performance', ability: 'cha' },
  { id: 'persuasion', name: 'Persuasion', ability: 'cha' },
  { id: 'religion', name: 'Religion', ability: 'int' },
  { id: 'sleight-of-hand', name: 'Sleight of Hand', ability: 'dex' },
  { id: 'stealth', name: 'Stealth', ability: 'dex' },
  { id: 'survival', name: 'Survival', ability: 'wis' },
];

// Experience needed to reach each level (index 0 = level 1).
export const XP_FOR_LEVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

export const modifier = (score) => Math.floor((score - 10) / 2);
export const signed = (n) => (n >= 0 ? `+${n}` : `−${-n}`);
export const proficiencyBonus = (level) => 2 + Math.floor((level - 1) / 4);

// Everything the sheet shows that follows from the stored basics.
export function derive(c) {
  const prof = proficiencyBonus(c.level);
  const mod = (ability) => modifier(c.abilities[ability]);
  const skill = (id) => {
    const s = SKILLS.find((k) => k.id === id);
    // Expertise doubles the proficiency bonus.
    return mod(s.ability) + (c.skills.includes(id) ? prof : 0) + (c.expertise?.includes(id) ? prof : 0);
  };
  const main = ITEMS[c.equipped?.mainHand] ?? null;
  const off = ITEMS[c.equipped?.offHand] ?? null;
  const armour = ITEMS[c.equipped?.armour] ?? null;

  // AC: worn armour plus Dex (capped for medium armour, none for heavy); without
  // armour 10 + Dex, or a class's Unarmoured Defence (Barbarian + Con, Monk + Wis).
  const shield = off?.kind === 'shield' ? off : null;
  const offWeapon = off?.kind === 'weapon' ? off : null;
  const ac = (armour
    ? armour.ac + (armour.category === 'Heavy' ? 0 : Math.min(mod('dex'), armour.dexCap ?? Infinity))
    : 10 + mod('dex') + (c.unarmoured && !(c.unarmoured === 'wis' && shield) ? mod(c.unarmoured) : 0))
    + (shield?.ac ?? 0)
    + (c.style === 'defense' && armour ? 1 : 0);

  // One attack per weapon in hand.
  const plus = (n) => (n ? ` ${n > 0 ? '+' : '−'} ${Math.abs(n)}` : '');
  const attack = (w, hand) => {
    const ranged = has(w, 'ranged');
    const m = ranged ? mod('dex') : has(w, 'finesse') ? Math.max(mod('str'), mod('dex')) : mod('str');
    const archery = c.style === 'archery' && ranged ? 2 : 0;
    const dueling = c.style === 'dueling' && !ranged && hand === 'main' && !offWeapon && !has(w, 'two-handed') ? 2 : 0;
    // The off-hand attack only adds the modifier when it is negative.
    const dmg = (hand === 'off' ? Math.min(m, 0) : m) + dueling;
    const twoHands = hand === 'main' && !off && w.versatile;
    const notes = [
      archery && 'Archery +2', dueling && 'Dueling +2', hand === 'off' && 'Off hand · bonus action',
      w.range && `Range ${w.range}`, twoHands && `Two hands: ${w.versatile}${plus(m)}`,
    ].filter(Boolean);
    return {
      name: w.name, type: w.type,
      toHit: m + prof + archery,
      damage: `${w.dice}${plus(dmg)}`,
      dice: w.dice, bonus: dmg, // for the combat damage calculator
      sneakable: has(w, 'finesse') || ranged,
      note: notes.join(' · '),
      // For the combat animation: a swing, an arrow, or (if thrown) a spinning blade.
      style: ranged ? 'arrow' : 'melee',
      canThrow: has(w, 'thrown') && !ranged,
      throwFirst: /throw/i.test(w.name),
    };
  };
  const attacks = [main && attack(main, 'main'), offWeapon && attack(offWeapon, 'off')].filter(Boolean);
  // Attacks that need no weapon: attack cantrips (Fire Bolt, Eldritch Blast, …) and a
  // Monk's martial arts. `addMod` adds the ability modifier to the damage.
  for (const a of c.extraAttacks ?? []) {
    const bonus = a.addMod ? mod(a.ability) : 0;
    attacks.push({
      name: a.name, type: a.type, toHit: mod(a.ability) + prof,
      damage: `${a.dice}${plus(bonus)}`, dice: a.dice, bonus, sneakable: false, note: a.note ?? '',
      style: a.style ?? (/cantrip|spell/i.test(a.note ?? '') ? 'magic' : 'melee'),
    });
  }
  if (!attacks.length) {
    const fist = Math.max(1, 1 + mod('str'));
    attacks.push({ name: 'Unarmed strike', type: 'bludgeoning', toHit: mod('str') + prof, damage: `${fist}`, dice: null, bonus: fist, note: 'No weapon in hand' });
  }

  const next = XP_FOR_LEVEL[c.level] ?? null;
  const prev = XP_FOR_LEVEL[c.level - 1];
  return {
    prof,
    mod,
    save: (ability) => mod(ability) + (c.saves.includes(ability) ? prof : 0),
    skill,
    ac,
    attacks,
    initiative: mod('dex'),
    passivePerception: 10 + skill('perception'),
    xp: { current: c.xp, next, progress: next ? (c.xp - prev) / (next - prev) : 1 },
  };
}

// "2d6" -> { count: 2, sides: 6 }; null for no dice.
export function parseDice(dice) {
  const m = /^(\d+)d(\d+)$/.exec(String(dice ?? '').trim());
  return m ? { count: Number(m[1]), sides: Number(m[2]) } : null;
}

// Rogues add Sneak Attack dice: 1d6 at level 1–2, 2d6 at 3–4, and so on.
export const sneakAttackDice = (c) => (c.class === 'Rogue' ? Math.ceil(c.level / 2) : 0);

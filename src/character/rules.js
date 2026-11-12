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
    return mod(s.ability) + (c.skills.includes(id) ? prof : 0);
  };
  const attack = (a) => {
    const m = a.finesse ? Math.max(mod('str'), mod('dex')) : mod(a.ability);
    return {
      toHit: m + prof,
      damage: `${a.dice}${m + (a.damageBonus ?? 0) ? ` ${signed(m + (a.damageBonus ?? 0)).replace(/^([+−])/, '$1 ')}` : ''}`,
    };
  };
  const next = XP_FOR_LEVEL[c.level] ?? null;
  const prev = XP_FOR_LEVEL[c.level - 1];
  return {
    prof,
    mod,
    save: (ability) => mod(ability) + (c.saves.includes(ability) ? prof : 0),
    skill,
    attack,
    initiative: mod('dex'),
    passivePerception: 10 + skill('perception'),
    xp: { current: c.xp, next, progress: next ? (c.xp - prev) / (next - prev) : 1 },
  };
}

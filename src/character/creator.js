// The rules behind the character creator: races, classes, point-buy ability
// scores, and turning the player's choices into a full character sheet (the
// same shape as src/data/characters.js). Follows D&D 5e, trimmed to what the
// app uses; spells are listed as features, attack cantrips become attacks.
import { ABILITIES, XP_FOR_LEVEL, modifier } from './rules.js';

// --- Ability scores: point buy ----------------------------------------------------------------
// Every score starts at 8; raising it costs points, 27 in all, up to 15.
export const POINTS = 27;
export const COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const pointsSpent = (base) => ABILITIES.reduce((sum, a) => sum + COST[base[a.id]], 0);
// The standard array (15, 14, 13, 12, 10, 8) placed in the class's best order.
export const suggestedScores = (cls) => Object.fromEntries(CLASSES[cls].order.map((id, i) => [id, [15, 14, 13, 12, 10, 8][i]]));

// --- Races -----------------------------------------------------------------------------------------
// `bonus` raises ability scores; `skills` are given for free; `anySkills` are extra picks.
export const RACES = {
  human: { name: 'Human', bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, anySkills: 0,
    languages: 'Common · one more of your choice', features: [] },
  'hill-dwarf': { name: 'Hill Dwarf', bonus: { con: 2, wis: 1 }, speed: 25, hpPerLevel: 1, languages: 'Common · Dwarvish', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Dwarven Resilience', text: 'Advantage on saves against poison, and resistance to poison damage.' },
    { name: 'Dwarven Toughness', text: '+1 HP for every level.' }] },
  'mountain-dwarf': { name: 'Mountain Dwarf', bonus: { str: 2, con: 2 }, speed: 25, armour: 'Light and medium armour', languages: 'Common · Dwarvish', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Dwarven Resilience', text: 'Advantage on saves against poison, and resistance to poison damage.' }] },
  'high-elf': { name: 'High Elf', bonus: { dex: 2, int: 1 }, speed: 30, skills: ['perception'], languages: 'Common · Elvish', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Fey Ancestry', text: 'Advantage against being charmed; magic cannot put you to sleep.' },
    { name: 'Cantrip', text: 'You know one wizard cantrip.' }] },
  'wood-elf': { name: 'Wood Elf', bonus: { dex: 2, wis: 1 }, speed: 35, skills: ['perception'], languages: 'Common · Elvish', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Fey Ancestry', text: 'Advantage against being charmed; magic cannot put you to sleep.' },
    { name: 'Mask of the Wild', text: 'You can try to hide when only lightly hidden by rain, mist or leaves.' }] },
  'dark-elf': { name: 'Dark Elf', bonus: { dex: 2, cha: 1 }, speed: 30, skills: ['perception'], languages: 'Common · Elvish', features: [
    { name: 'Superior Darkvision', text: 'See in dim light within 120 ft as if it were bright.' },
    { name: 'Sunlight Sensitivity', text: 'Disadvantage on attacks and sight-based Perception in direct sunlight.' },
    { name: 'Fey Ancestry', text: 'Advantage against being charmed; magic cannot put you to sleep.' }] },
  halfling: { name: 'Halfling', bonus: { dex: 2, cha: 1 }, speed: 25, languages: 'Common · Halfling', features: [
    { name: 'Lucky', text: 'Reroll a natural 1 on an attack, check or save.' },
    { name: 'Brave', text: 'Advantage on saves against being frightened.' },
    { name: 'Halfling Nimbleness', text: 'Move through the space of any creature bigger than you.' }] },
  gnome: { name: 'Gnome', bonus: { int: 2, con: 1 }, speed: 25, languages: 'Common · Gnomish', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Gnome Cunning', text: 'Advantage on Int, Wis and Cha saves against magic.' }] },
  'half-elf': { name: 'Half-Elf', bonus: { cha: 2, dex: 1, con: 1 }, speed: 30, anySkills: 2, languages: 'Common · Elvish · one more', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Fey Ancestry', text: 'Advantage against being charmed; magic cannot put you to sleep.' }] },
  'half-orc': { name: 'Half-Orc', bonus: { str: 2, con: 1 }, speed: 30, skills: ['intimidation'], languages: 'Common · Orc', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Relentless Endurance', text: 'Once per long rest, drop to 1 HP instead of 0.', uses: { max: 1, used: 0, per: 'long rest' } },
    { name: 'Savage Attacks', text: 'On a melee crit, roll one weapon damage die one extra time.' }] },
  dragonborn: { name: 'Dragonborn', bonus: { str: 2, cha: 1 }, speed: 30, languages: 'Common · Draconic', features: [
    { name: 'Breath Weapon', text: '2d6 damage in a cone or line; Dex or Con save (DC 8 + Con + proficiency) for half.', uses: { max: 1, used: 0, per: 'short rest' } },
    { name: 'Damage Resistance', text: 'Resistance to the damage type of your draconic ancestry.' }] },
  tiefling: { name: 'Tiefling', bonus: { cha: 2, int: 1 }, speed: 30, languages: 'Common · Infernal', features: [
    { name: 'Darkvision', text: 'See in dim light within 60 ft as if it were bright.' },
    { name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { name: 'Infernal Legacy', text: 'You know the Thaumaturgy cantrip.' }] },
};

// --- Classes -------------------------------------------------------------------------------------------
// `order` is the best order for the standard array; `style` the level a
// fighting style is chosen; `gear` the starting equipment.
const spells = (ability, list) => ({ name: 'Spellcasting', text: `${ability} · ${list}` });

export const CLASSES = {
  Barbarian: {
    die: 12, saves: ['str', 'con'], order: ['str', 'con', 'dex', 'wis', 'cha', 'int'], colour: '#a0522d',
    skills: { count: 2, from: ['animal-handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
    proficiencies: 'Light and medium armour, shields · Simple and martial weapons',
    gear: { items: [{ id: 'greataxe' }, { id: 'handaxe', qty: 2 }], equipped: { mainHand: 'greataxe' } },
    unarmoured: 'con',
    features: [
      [{ name: 'Rage', text: 'Bonus action: advantage on Strength checks and saves, +2 melee damage, resistance to physical damage, for 1 minute.', uses: { max: 2, used: 0, per: 'long rest' } },
        { name: 'Unarmoured Defence', text: 'Without armour, AC is 10 + Dex + Con.' }],
      [{ name: 'Reckless Attack', text: 'Attack with advantage this turn; attacks against you have advantage until your next turn.' },
        { name: 'Danger Sense', text: 'Advantage on Dex saves against effects you can see.' }],
    ],
  },
  Bard: {
    die: 8, saves: ['dex', 'cha'], order: ['cha', 'dex', 'con', 'wis', 'int', 'str'], colour: '#8a5cc7',
    skills: { count: 3, from: 'any' },
    proficiencies: 'Light armour · Simple weapons, hand crossbows, longswords, rapiers, shortswords · Three instruments',
    gear: { items: [{ id: 'rapier' }, { id: 'dagger' }, { id: 'leather' }, { id: 'lute' }], equipped: { mainHand: 'rapier', armour: 'leather' } },
    features: [
      [spells('Charisma', 'Vicious Mockery, Minor Illusion · Healing Word, Charm Person, Thunderwave, Faerie Fire'),
        { name: 'Bardic Inspiration', text: 'Bonus action: give an ally a d6 to add to one roll.', uses: { max: 'cha', used: 0, per: 'long rest' } }],
      [{ name: 'Jack of All Trades', text: 'Add half your proficiency to checks you are not proficient in.' },
        { name: 'Song of Rest', text: 'Allies who spend hit dice on a short rest regain an extra 1d6 HP.' }],
    ],
  },
  Cleric: {
    die: 8, saves: ['wis', 'cha'], order: ['wis', 'con', 'str', 'dex', 'cha', 'int'], colour: '#c9a227',
    skills: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    proficiencies: 'Light and medium armour, shields · Simple weapons',
    gear: { items: [{ id: 'mace' }, { id: 'scale-mail' }, { id: 'shield' }, { id: 'light-crossbow' }, { id: 'bolts', qty: 20 }, { id: 'holy-symbol' }], equipped: { mainHand: 'mace', offHand: 'shield', armour: 'scale-mail' } },
    features: [
      [spells('Wisdom', 'Sacred Flame, Guidance, Spare the Dying · Cure Wounds, Bless, Healing Word, Guiding Bolt'),
        { name: 'Divine Domain', text: 'Your god and domain; talk to the Dungeon Master.' }],
      [{ name: 'Channel Divinity', text: 'Turn Undead, or your domain\'s power.', uses: { max: 1, used: 0, per: 'short rest' } }],
    ],
  },
  Druid: {
    die: 8, saves: ['int', 'wis'], order: ['wis', 'con', 'dex', 'int', 'str', 'cha'], colour: '#5f8a4a',
    skills: { count: 2, from: ['arcana', 'animal-handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    proficiencies: 'Light and medium armour, shields (not metal) · Clubs, daggers, quarterstaffs, scimitars, sickles, slings, spears',
    gear: { items: [{ id: 'quarterstaff' }, { id: 'leather' }, { id: 'druidic-focus' }], equipped: { mainHand: 'quarterstaff', armour: 'leather' } },
    extraAttacks: [{ name: 'Produce Flame', ability: 'wis', dice: '1d8', type: 'fire', note: 'Cantrip · range 30 ft' }],
    features: [
      [{ name: 'Druidic', text: 'You know the secret language of druids.' },
        spells('Wisdom', 'Produce Flame, Druidcraft · Entangle, Goodberry, Healing Word, Thunderwave')],
      [{ name: 'Wild Shape', text: 'Turn into a beast you have seen (up to CR 1/4, no flying or swimming).', uses: { max: 2, used: 0, per: 'short rest' } }],
    ],
  },
  Fighter: {
    die: 10, saves: ['str', 'con'], order: ['str', 'con', 'dex', 'wis', 'int', 'cha'], colour: '#3d4b7a', style: 1,
    skills: { count: 2, from: ['acrobatics', 'animal-handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
    proficiencies: 'All armour and shields · Simple and martial weapons',
    gear: { items: [{ id: 'longsword' }, { id: 'shield' }, { id: 'chain-mail' }, { id: 'light-crossbow' }, { id: 'bolts', qty: 20 }, { id: 'handaxe', qty: 2 }], equipped: { mainHand: 'longsword', offHand: 'shield', armour: 'chain-mail' } },
    features: [
      [{ name: 'Second Wind', text: 'Bonus action: regain 1d10 + your level in HP.', uses: { max: 1, used: 0, per: 'short rest' } }],
      [{ name: 'Action Surge', text: 'Take one extra action on your turn.', uses: { max: 1, used: 0, per: 'short rest' } }],
    ],
  },
  Monk: {
    die: 8, saves: ['str', 'dex'], order: ['dex', 'wis', 'con', 'str', 'int', 'cha'], colour: '#c7743a',
    skills: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    proficiencies: 'Simple weapons, shortswords',
    gear: { items: [{ id: 'shortsword' }, { id: 'dagger', qty: 5 }], equipped: { mainHand: 'shortsword' } },
    unarmoured: 'wis',
    extraAttacks: [{ name: 'Martial arts', ability: 'dex', dice: '1d4', type: 'bludgeoning', addMod: true, note: 'Unarmed · one extra strike as a bonus action' }],
    features: [
      [{ name: 'Unarmoured Defence', text: 'Without armour or shield, AC is 10 + Dex + Wis.' },
        { name: 'Martial Arts', text: 'Unarmed strikes use Dex and a d4; strike again as a bonus action.' }],
      [{ name: 'Ki', text: 'Flurry of Blows, Patient Defence or Step of the Wind.', uses: { max: 2, used: 0, per: 'short rest' } },
        { name: 'Unarmoured Movement', text: '+10 ft speed without armour.' }],
    ],
  },
  Paladin: {
    die: 10, saves: ['wis', 'cha'], order: ['str', 'cha', 'con', 'wis', 'dex', 'int'], colour: '#d2a53c', style: 2,
    skills: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    proficiencies: 'All armour and shields · Simple and martial weapons',
    gear: { items: [{ id: 'longsword' }, { id: 'shield' }, { id: 'chain-mail' }, { id: 'holy-symbol' }], equipped: { mainHand: 'longsword', offHand: 'shield', armour: 'chain-mail' } },
    features: [
      [{ name: 'Divine Sense', text: 'Sense celestials, fiends and undead within 60 ft.', uses: { max: 'cha+1', used: 0, per: 'long rest' } },
        { name: 'Lay on Hands', text: 'Heal from a pool of 5 × your level HP per long rest.' }],
      [spells('Charisma', 'Bless, Cure Wounds, Shield of Faith, Wrathful Smite'),
        { name: 'Divine Smite', text: 'Spend a spell slot on a hit: +2d8 radiant damage.' }],
    ],
  },
  Ranger: {
    die: 10, saves: ['str', 'dex'], order: ['dex', 'wis', 'con', 'str', 'int', 'cha'], colour: '#4f7a3e', style: 2,
    skills: { count: 3, from: ['animal-handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    proficiencies: 'Light and medium armour, shields · Simple and martial weapons',
    gear: { items: [{ id: 'longbow' }, { id: 'arrows', qty: 20 }, { id: 'shortsword', qty: 2 }, { id: 'scale-mail' }], equipped: { mainHand: 'longbow', armour: 'scale-mail' } },
    features: [
      [{ name: 'Favoured Enemy', text: 'Advantage on Survival to track them and on checks to recall facts about them.' },
        { name: 'Natural Explorer', text: 'Your favoured terrain: never lost there, and you travel and track well.' }],
      [spells('Wisdom', "Hunter's Mark, Cure Wounds")],
    ],
  },
  Rogue: {
    die: 8, saves: ['dex', 'int'], order: ['dex', 'con', 'cha', 'wis', 'int', 'str'], colour: '#2f3550', expertise: 2,
    skills: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight-of-hand', 'stealth'] },
    proficiencies: "Light armour · Simple weapons, hand crossbows, longswords, rapiers, shortswords · Thieves' tools",
    gear: { items: [{ id: 'rapier' }, { id: 'shortbow' }, { id: 'arrows', qty: 20 }, { id: 'dagger', qty: 2 }, { id: 'leather' }, { id: 'thieves-tools' }], equipped: { mainHand: 'rapier', armour: 'leather' } },
    features: [
      [{ name: 'Sneak Attack', text: 'Once per turn, +1d6 damage when you have advantage, or an ally is next to the target.' },
        { name: "Thieves' Cant", text: 'The secret language and signs of thieves.' }],
      [{ name: 'Cunning Action', text: 'Bonus action: Dash, Disengage or Hide.' }],
    ],
  },
  Sorcerer: {
    die: 6, saves: ['con', 'cha'], order: ['cha', 'con', 'dex', 'wis', 'int', 'str'], colour: '#b8402f',
    skills: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    proficiencies: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    gear: { items: [{ id: 'light-crossbow' }, { id: 'bolts', qty: 20 }, { id: 'dagger', qty: 2 }, { id: 'arcane-focus' }], equipped: { mainHand: 'dagger' } },
    extraAttacks: [{ name: 'Fire Bolt', ability: 'cha', dice: '1d10', type: 'fire', note: 'Cantrip · range 120 ft' }],
    features: [
      [spells('Charisma', 'Fire Bolt, Light, Prestidigitation, Shocking Grasp · Magic Missile, Shield'),
        { name: 'Sorcerous Origin', text: 'Where your magic comes from; talk to the Dungeon Master.' }],
      [{ name: 'Font of Magic', text: 'Sorcery points to turn into spell slots and back.', uses: { max: 2, used: 0, per: 'long rest' } }],
    ],
  },
  Warlock: {
    die: 8, saves: ['wis', 'cha'], order: ['cha', 'con', 'dex', 'wis', 'int', 'str'], colour: '#5b3a6e',
    skills: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    proficiencies: 'Light armour · Simple weapons',
    gear: { items: [{ id: 'light-crossbow' }, { id: 'bolts', qty: 20 }, { id: 'dagger', qty: 2 }, { id: 'leather' }, { id: 'arcane-focus' }], equipped: { mainHand: 'dagger', armour: 'leather' } },
    extraAttacks: [{ name: 'Eldritch Blast', ability: 'cha', dice: '1d10', type: 'force', note: 'Cantrip · range 120 ft' }],
    features: [
      [{ name: 'Otherworldly Patron', text: 'The being who gave you power; talk to the Dungeon Master.' },
        spells('Charisma', 'Eldritch Blast, Minor Illusion · Hex, Armour of Agathys · slots return on a short rest')],
      [{ name: 'Eldritch Invocations', text: 'Two magical secrets, e.g. Agonising Blast or Devil\'s Sight.' }],
    ],
  },
  Wizard: {
    die: 6, saves: ['int', 'wis'], order: ['int', 'con', 'dex', 'wis', 'cha', 'str'], colour: '#3f6ea8',
    skills: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
    proficiencies: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    gear: { items: [{ id: 'quarterstaff' }, { id: 'dagger' }, { id: 'spellbook' }, { id: 'arcane-focus' }], equipped: { mainHand: 'quarterstaff' } },
    extraAttacks: [{ name: 'Fire Bolt', ability: 'int', dice: '1d10', type: 'fire', note: 'Cantrip · range 120 ft' }],
    features: [
      [spells('Intelligence', 'Fire Bolt, Mage Hand, Light · Magic Missile, Shield, Sleep, Mage Armour, Detect Magic'),
        { name: 'Arcane Recovery', text: 'Once a day on a short rest, recover spell slots.', uses: { max: 1, used: 0, per: 'long rest' } }],
      [{ name: 'Arcane Tradition', text: 'Your school of magic; talk to the Dungeon Master.' }],
    ],
  },
};

export const STYLES = {
  dueling: { name: 'Dueling', text: '+2 damage with a melee weapon held in one hand, when holding no other weapon.' },
  archery: { name: 'Archery', text: '+2 to attack rolls with ranged weapons.' },
  defense: { name: 'Defence', text: '+1 AC while wearing armour.' },
};

export const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];

// Final scores: point buy plus the race's bonus.
export const finalScores = (base, race) => Object.fromEntries(ABILITIES.map((a) => [a.id, base[a.id] + (RACES[race].bonus[a.id] ?? 0)]));

// Max HP: the full hit die at level 1, then the average (rounded up) per level, plus Con each level.
export function maxHp(cls, race, level, con) {
  const die = CLASSES[cls].die;
  const perLevel = (n) => Math.max(1, n + modifier(con) + (RACES[race].hpPerLevel ?? 0));
  return perLevel(die) + (level - 1) * perLevel(die / 2 + 1);
}

// A feature ready for a sheet: uses that depend on Charisma are worked out.
export function featureFor(f, abilities) {
  const cha = modifier(abilities.cha);
  const resolve = (max) => (max === 'cha' ? cha : max === 'cha+1' ? 1 + cha : max);
  return { ...f, ...(f.uses ? { uses: { ...f.uses, max: Math.max(1, resolve(f.uses.max)) } } : {}) };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'hero';

// Turns the creator's choices into a character sheet.
// `c`: { name, race, cls, level, background, alignment, base, skills, style, design, backstory }
// `look`: what Claude made: { figure, tagline, colour, goal }
export function buildCharacter(c, look) {
  const cls = CLASSES[c.cls], race = RACES[c.race];
  const abilities = finalScores(c.base, c.race);
  const mod = (id) => modifier(abilities[id]);
  const features = [...cls.features.slice(0, c.level).flat(), ...race.features].map((f) => featureFor(f, abilities));
  if (c.style) features.unshift({ name: `Fighting Style: ${STYLES[c.style].name}`, text: STYLES[c.style].text });
  if (cls.expertise) features.push({ name: 'Expertise', text: `Double proficiency in ${c.expertise.map((id) => id.replace(/-/g, ' ')).join(' and ')}.` });
  const hp = maxHp(c.cls, c.race, c.level, abilities.con);
  return {
    id: `${slug(c.name)}-${Date.now().toString(36)}`,
    name: c.name,
    tagline: look.tagline || `${race.name} ${c.cls}`,
    player: '',
    race: race.name,
    class: c.cls,
    level: c.level,
    xp: XP_FOR_LEVEL[c.level - 1],
    background: c.background || 'Adventurer',
    alignment: c.alignment,
    colour: look.colour || cls.colour,
    abilities,
    saves: [...cls.saves],
    skills: [...c.skills],
    ...(cls.expertise ? { expertise: [...c.expertise] } : {}),
    hp: { current: hp, max: hp, temp: 0 },
    hitDice: { die: `d${cls.die}`, total: c.level, used: 0 },
    speed: race.speed + (c.cls === 'Monk' && c.level >= 2 ? 10 : 0),
    ...(c.style ? { style: c.style } : {}),
    ...(cls.unarmoured ? { unarmoured: cls.unarmoured } : {}),
    ...(cls.extraAttacks ? { extraAttacks: cls.extraAttacks.map((a) => ({ ...a })) } : {}),
    items: [...cls.gear.items.map((i) => ({ ...i })), { id: 'rations', qty: 3 }, { id: 'waterskin' }, { id: 'bedroll' }, { id: 'torch', qty: 2 }],
    equipped: { mainHand: null, offHand: null, armour: null, ...cls.gear.equipped },
    coins: { pp: 0, gp: 10, sp: 0, cp: 0 },
    features,
    proficiencies: race.armour && !/armour/.test(cls.proficiencies) ? `${race.armour} · ${cls.proficiencies}` : cls.proficiencies,
    languages: race.languages,
    story: { origin: c.backstory, goal: look.goal || '', design: c.design },
    figure: look.figure,
  };
}

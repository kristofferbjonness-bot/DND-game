// Player characters. Only the basics are stored here; modifiers, attack bonuses,
// skill totals and so on are worked out by src/character/rules.js.
//
// Lore comes from the campaign notes. Numbers marked PLACEHOLDER are sensible
// level-2 values chosen until the real character sheets are filled in.

export const CHARACTERS = [
  {
    id: 'rikart',
    name: 'Rikart Hagenstorm',
    player: '',
    race: 'Human',
    class: 'Fighter',
    level: 2,
    xp: 300,
    background: 'Disciple of Hrimnir',
    alignment: 'Lawful Neutral', // PLACEHOLDER
    model: 'rikart',

    // PLACEHOLDER scores (standard array + human bonus).
    abilities: { str: 16, dex: 15, con: 15, int: 11, wis: 13, cha: 9 },
    saves: ['str', 'con'],
    skills: ['athletics', 'perception', 'insight', 'history'],

    hp: { current: 20, max: 20, temp: 0 },
    hitDice: { die: 'd10', total: 2, used: 0 },
    ac: 16,
    speed: 30,

    attacks: [
      { name: 'Rune-marked katana', ability: 'str', dice: '1d8', damageBonus: 2, type: 'slashing', note: 'Dueling +2 · Versatile 1d10' },
      { name: 'Tantō', ability: 'str', finesse: true, dice: '1d4', type: 'piercing', note: 'Light · Thrown 20/60 ft' },
    ],

    equipped: [
      { slot: 'Main hand', name: 'Rune-marked katana', note: 'Northern runes and Hrimnir markings on the blade' },
      { slot: 'Belt', name: 'Tantō' },
      { slot: 'Armour', name: 'Lamellar armour', note: 'AC 14 + Dex (max 2)' },
      { slot: 'Cloak', name: 'Fur mantle of the northern isles' },
    ],
    inventory: [
      { name: 'Health potion', qty: 1, note: 'Regain 2d4 + 2 HP' },
      { name: 'Rations', qty: 5 },
      { name: 'Whetstone', qty: 1 },
      { name: 'Bedroll', qty: 1 },
      { name: 'Waterskin', qty: 1 },
    ],
    coins: { pp: 0, gp: 12, sp: 4, cp: 0 },

    features: [
      { name: 'Fighting Style: Dueling', text: '+2 damage with a melee weapon held in one hand, when holding no other weapon.' },
      { name: 'Second Wind', text: 'Bonus action: regain 1d10 + your level in HP.', uses: { max: 1, used: 0, per: 'short rest' } },
      { name: 'Action Surge', text: 'Take one extra action on your turn.', uses: { max: 1, used: 0, per: 'short rest' } },
    ],
    proficiencies: 'All armour and shields · Simple and martial weapons',
    languages: 'Common · Northern tongue',

    story: {
      origin: 'From the north-eastern northern islands. Trained in the city of Hrimnir under his master, Levi Itadori.',
      goal: 'Hunt down Sukuna Matamoto and the Grey Hand, who killed his master.',
    },
  },
];

// The rest of the party, until their sheets are made.
export const PARTY = [
  { id: 'rikart', name: 'Rikart Hagenstorm', line: 'Swordsman of Hrimnir' },
  { id: 'flame-slinger', name: 'Flame Slinger', line: 'Elf from the islands of the far south-west' },
  { id: 'edbart', name: 'Edbart Frostvarg', line: 'Hunter of Fjellene av Ferran, with Varg the wolf' },
];

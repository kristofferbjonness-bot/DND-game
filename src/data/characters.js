// Player characters. Only the basics are stored here; modifiers, attack bonuses,
// AC, skill totals and so on are worked out by src/character/rules.js.
// `items` are ids from src/data/items.js; `equipped` says what is held and worn.
// `style` is a fighting style the rules apply (dueling, archery).
//
// Lore comes from the campaign notes. Numbers marked PLACEHOLDER are sensible
// level-2 values chosen until the real character sheets are filled in.

export const CHARACTERS = [
  {
    id: 'rikart',
    name: 'Rikart Hagenstorm',
    tagline: 'Swordsman of Hrimnir',
    player: '',
    race: 'Human',
    class: 'Fighter',
    level: 2,
    xp: 300,
    background: 'Disciple of Hrimnir',
    alignment: 'Lawful Neutral', // PLACEHOLDER
    model: 'rikart',
    colour: '#3d4b7a', // badge colour on the start screen

    // PLACEHOLDER scores (standard array + human bonus).
    abilities: { str: 16, dex: 15, con: 15, int: 11, wis: 13, cha: 9 },
    saves: ['str', 'con'],
    skills: ['athletics', 'perception', 'insight', 'history'],

    hp: { current: 20, max: 20, temp: 0 },
    hitDice: { die: 'd10', total: 2, used: 0 },
    speed: 30,
    style: 'dueling',

    items: [
      { id: 'rune-katana' }, { id: 'tanto' }, { id: 'lamellar' },
      { id: 'health-potion', qty: 1 }, { id: 'rations', qty: 5 }, { id: 'whetstone' }, { id: 'bedroll' }, { id: 'waterskin' },
    ],
    equipped: { mainHand: 'rune-katana', offHand: null, armour: 'lamellar' },
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
  {
    id: 'flame-slinger',
    name: 'Flame Slinger',
    tagline: 'Elf of the south-western isles',
    player: '',
    race: 'Wood Elf',
    class: 'Rogue', // PLACEHOLDER: fits the knives, flame arrows and daring stunts
    level: 2,
    xp: 300,
    background: 'Wanderer of the southern isles',
    alignment: 'Chaotic Good', // PLACEHOLDER
    model: 'flame-slinger',
    colour: '#b8402f', // badge colour on the start screen

    abilities: { str: 10, dex: 17, con: 13, int: 8, wis: 13, cha: 14 }, // PLACEHOLDER
    saves: ['dex', 'int'],
    skills: ['acrobatics', 'stealth', 'sleight-of-hand', 'persuasion', 'perception'],
    expertise: ['acrobatics', 'stealth'],

    hp: { current: 15, max: 15, temp: 0 },
    hitDice: { die: 'd8', total: 2, used: 0 },
    speed: 35,

    items: [
      { id: 'bane-of-fredrikstad' }, { id: 'flame-shortbow' }, { id: 'throwing-knives' }, { id: 'leather' },
      { id: 'health-potion', qty: 1, note: 'Looted from a Hooknose' }, { id: 'hooknose-map' }, { id: 'magnum-condoms', qty: 2 }, { id: 'thieves-tools' },
    ],
    equipped: { mainHand: 'flame-shortbow', offHand: null, armour: 'leather' },
    coins: { pp: 0, gp: 9, sp: 6, cp: 0 },

    features: [
      { name: 'Sneak Attack', text: 'Once per turn, +1d6 damage when you have advantage, or an ally is next to the target.' },
      { name: 'Cunning Action', text: 'Bonus action: Dash, Disengage or Hide.' },
      { name: 'Expertise', text: 'Double proficiency in Acrobatics and Stealth.' },
      { name: 'Fey Ancestry', text: 'Advantage against being charmed; magic cannot put you to sleep.' },
    ],
    proficiencies: 'Light armour · Simple weapons, longswords, rapiers, shortswords, hand crossbows · Thieves\' tools',
    languages: 'Common · Elvish · Thieves\' Cant',

    story: {
      origin: 'An elf from the islands of the far south-west, out for adventure. As a young man he saved a lord from a city near the Empire of Tine.',
      goal: 'Cleanse the world of discrimination against dark elves.',
      notes: 'Varg the wolf is very fond of him.',
    },
  },
  {
    id: 'edbart',
    name: 'Edbart Frostvarg',
    tagline: 'Hunter of Fjellene av Ferran',
    player: '',
    race: 'Human',
    class: 'Ranger', // PLACEHOLDER: a hunter with a wolf companion
    level: 2,
    xp: 300,
    background: 'Outlander',
    alignment: 'Neutral Good', // PLACEHOLDER
    model: 'edbart',
    colour: '#6f7882', // badge colour on the start screen

    abilities: { str: 13, dex: 16, con: 14, int: 11, wis: 15, cha: 9 }, // PLACEHOLDER
    saves: ['str', 'dex'],
    skills: ['stealth', 'survival', 'animal-handling', 'perception', 'athletics'],

    hp: { current: 20, max: 20, temp: 0 },
    hitDice: { die: 'd10', total: 2, used: 0 },
    speed: 30,
    style: 'archery',

    items: [
      { id: 'longbow' }, { id: 'handaxe' }, { id: 'hide' },
      { id: 'arrows', qty: 20 }, { id: 'hunting-trap' }, { id: 'rope' }, { id: 'rations', qty: 4 },
    ],
    equipped: { mainHand: 'longbow', offHand: null, armour: 'hide' },
    coins: { pp: 0, gp: 7, sp: 3, cp: 5 },

    features: [
      { name: 'Favoured Enemy: Poachers', text: 'Advantage on Survival to track them, and on Intelligence checks to recall facts about them.' },
      { name: 'Natural Explorer: Mountains', text: 'Never lost in the mountains; double proficiency on Wisdom and Intelligence checks about them.' },
      { name: 'Fighting Style: Archery', text: '+2 to attack rolls with ranged weapons.' },
      { name: 'Spells', text: "Hunter's Mark · Cure Wounds", uses: { max: 2, used: 0, per: 'long rest' } },
      { name: 'Companion: Varg', text: 'The wolf he rescued from poachers. Now also fond of Flame Slinger.' },
    ],
    proficiencies: 'Light and medium armour, shields · Simple and martial weapons',
    languages: 'Common · Mountain tongue',

    story: {
      origin: 'From the mountains of Fjellene av Ferran. He rescued the wolf Varg from poachers.',
      goal: 'Hunt down the poachers, together with Varg.',
    },
  },
];

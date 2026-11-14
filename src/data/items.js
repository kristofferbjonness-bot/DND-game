// Every item a character can own. Characters list item ids in `items` and
// choose what to hold and wear in `equipped`.
//
// Weapons
//   dice, type      damage
//   props           finesse · light · thrown · versatile · two-handed · ranged
//   versatile       damage when held in two hands
//   model           which voxel model the figure holds (see character/model.js)
// Armour
//   ac, dexCap      AC = ac + Dex modifier (at most dexCap; null = no limit;
//                   heavy armour ignores Dex)
//   model           how the armour looks on the figure
// Shields go in the off hand and add `ac` to the Armour Class.

export const ITEMS = {
  // --- Weapons ---------------------------------------------------------------
  'rune-katana': {
    name: 'Rune-marked katana', kind: 'weapon', dice: '1d8', versatile: '1d10', type: 'slashing',
    props: ['versatile'], model: 'katana', note: 'Northern runes and Hrimnir markings on the blade',
  },
  tanto: {
    name: 'Tantō', kind: 'weapon', dice: '1d4', type: 'piercing',
    props: ['finesse', 'light', 'thrown'], range: '20/60 ft', model: 'tanto',
  },
  'bane-of-fredrikstad': {
    name: 'Bane of Fredrikstad', kind: 'weapon', dice: '1d8', versatile: '1d10', type: 'slashing',
    props: ['versatile'], model: 'longsword', gem: true, note: 'Longsword with a red gem · gift of the Man Who Makes Himself Known',
  },
  'flame-shortbow': {
    name: 'Shortbow, flame arrows', kind: 'weapon', dice: '1d6', type: 'piercing + fire',
    props: ['ranged', 'two-handed'], range: '80/320 ft', model: 'shortbow', arrows: 'flame',
  },
  'throwing-knives': {
    name: 'Throwing knives', kind: 'weapon', dice: '1d4', type: 'piercing',
    props: ['finesse', 'light', 'thrown'], range: '20/60 ft', model: 'dagger',
  },
  longbow: {
    name: 'Longbow', kind: 'weapon', dice: '1d8', type: 'piercing',
    props: ['ranged', 'two-handed'], range: '150/600 ft', model: 'longbow',
  },
  handaxe: {
    name: 'Hand axe', kind: 'weapon', dice: '1d6', type: 'slashing',
    props: ['light', 'thrown'], range: '20/60 ft', model: 'handaxe',
  },

  // Standard weapons, used by heroes made in the character creator.
  longsword: { name: 'Longsword', kind: 'weapon', dice: '1d8', versatile: '1d10', type: 'slashing', props: ['versatile'], model: 'longsword' },
  shortsword: { name: 'Shortsword', kind: 'weapon', dice: '1d6', type: 'piercing', props: ['finesse', 'light'], model: 'shortsword' },
  rapier: { name: 'Rapier', kind: 'weapon', dice: '1d8', type: 'piercing', props: ['finesse'], model: 'rapier' },
  dagger: { name: 'Dagger', kind: 'weapon', dice: '1d4', type: 'piercing', props: ['finesse', 'light', 'thrown'], range: '20/60 ft', model: 'dagger' },
  mace: { name: 'Mace', kind: 'weapon', dice: '1d6', type: 'bludgeoning', props: [], model: 'mace' },
  quarterstaff: { name: 'Quarterstaff', kind: 'weapon', dice: '1d6', versatile: '1d8', type: 'bludgeoning', props: ['versatile'], model: 'staff' },
  spear: { name: 'Spear', kind: 'weapon', dice: '1d6', versatile: '1d8', type: 'piercing', props: ['thrown', 'versatile'], range: '20/60 ft', model: 'spear' },
  greataxe: { name: 'Greataxe', kind: 'weapon', dice: '1d12', type: 'slashing', props: ['heavy', 'two-handed'], model: 'greataxe' },
  shortbow: { name: 'Shortbow', kind: 'weapon', dice: '1d6', type: 'piercing', props: ['ranged', 'two-handed'], range: '80/320 ft', model: 'shortbow' },
  'light-crossbow': { name: 'Light crossbow', kind: 'weapon', dice: '1d8', type: 'piercing', props: ['ranged', 'two-handed'], range: '80/320 ft', model: 'crossbow' },

  // --- Armour ------------------------------------------------------------------
  lamellar: { name: 'Lamellar armour', kind: 'armour', ac: 14, dexCap: 2, category: 'Medium', model: 'lamellar' },
  leather: { name: 'Leather armour', kind: 'armour', ac: 11, dexCap: null, category: 'Light', model: 'leather' },
  hide: { name: 'Hide armour', kind: 'armour', ac: 12, dexCap: 2, category: 'Medium', model: 'hide' },
  'scale-mail': { name: 'Scale mail', kind: 'armour', ac: 14, dexCap: 2, category: 'Medium', model: 'scale' },
  'chain-mail': { name: 'Chain mail', kind: 'armour', ac: 16, dexCap: 0, category: 'Heavy', model: 'chain' },
  shield: { name: 'Shield', kind: 'shield', ac: 2, model: 'shield' },

  // --- Other gear ---------------------------------------------------------------
  'health-potion': { name: 'Health potion', kind: 'gear', note: 'Regain 2d4 + 2 HP' },
  rations: { name: 'Rations', kind: 'gear' },
  whetstone: { name: 'Whetstone', kind: 'gear' },
  bedroll: { name: 'Bedroll', kind: 'gear' },
  waterskin: { name: 'Waterskin', kind: 'gear' },
  // Not an item to carry: the young Hooknose riding on Varg (Varg's load, see the 'companion' slot).
  'young-hooknose': { name: 'The young Hooknose (tied up)', kind: 'passenger' },
  'hooknose-map': { name: 'Map', kind: 'gear', note: 'Taken from a dead Hooknose' },
  'magnum-condoms': { name: 'Magnum condoms', kind: 'gear', note: 'From the corpse of the Toucher of Girls' },
  'thieves-tools': { name: "Thieves' tools", kind: 'gear' },
  arrows: { name: 'Arrows', kind: 'gear' },
  'hunting-trap': { name: 'Hunting trap', kind: 'gear' },
  rope: { name: 'Rope, 50 ft', kind: 'gear' },
  bolts: { name: 'Crossbow bolts', kind: 'gear' },
  'holy-symbol': { name: 'Holy symbol', kind: 'gear' },
  'arcane-focus': { name: 'Arcane focus', kind: 'gear', note: 'A crystal, orb or wand for casting spells' },
  'druidic-focus': { name: 'Druidic focus', kind: 'gear', note: 'A sprig of mistletoe or a yew wand' },
  spellbook: { name: 'Spellbook', kind: 'gear' },
  lute: { name: 'Lute', kind: 'gear' },
  torch: { name: 'Torch', kind: 'gear' },
};

export const has = (item, prop) => item?.props?.includes(prop) ?? false;

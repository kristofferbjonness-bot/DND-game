// Enemies the Dungeon Master can put into a combat encounter.
// `model` picks the voxel figure (see character/model.js).

export const MONSTERS = {
  hooknose: {
    name: 'Hooknose cutthroat',
    short: 'Hooknose', // name in the battle boxes
    kind: 'Humanoid · Kessit',
    ac: 13,
    hp: 11,
    initiative: 2, // Dex modifier
    speed: 30,
    attacks: [{ name: 'Curved knife', toHit: 4, dice: '1d6', bonus: 2, type: 'slashing' }],
    note: 'Maze-born robbers of Razz of Mataz, wrapped in indigo cloth. They rob rather than kill.',
    model: 'hooknose',
  },
  'lord-wolf': {
    name: 'Lord Wolf',
    short: 'Lord Wolf',
    kind: 'Humanoid · crime lord',
    ac: 14,
    hp: 60,
    initiative: 1,
    speed: 30,
    attacks: [{ name: 'Wrestling slam', toHit: 5, dice: '1d8', bonus: 3, type: 'bludgeoning' }],
    note: 'The enormous, oiled master of The Wolf in Razz of Mataz: half gym, half palace of silk.',
    model: 'npc-lord-wolf',
  },
  'silk-sister': {
    name: 'Silk Sister',
    short: 'Silk Sister',
    kind: 'Humanoid · guard',
    ac: 13,
    hp: 13,
    initiative: 2,
    speed: 30,
    attacks: [{ name: 'Golden dumbbell', toHit: 3, dice: '1d6', bonus: 1, type: 'bludgeoning' }],
    note: "Lord Wolf's inner guard, in red and gold silk. They treat a fight like a party.",
    model: 'npc-silk-sister',
  },
  // The people of Razz of Mataz and Ytterhavn, so any of them can be fought. Stats the lore gives
  // are used (Habibi); the rest are the DM's to adjust.
  habibi: {
    name: 'Habibi', short: 'Habibi', kind: 'Humanoid · guide', ac: 10, hp: 6, initiative: 2, speed: 30,
    attacks: [{ name: 'Panicked shove', toHit: 0, dice: '1d2', bonus: 0, type: 'bludgeoning' }],
    note: 'A fast-talking guide of Razz with a kebab stall. He would rather run than fight.', model: 'npc-habibi',
  },
  'hooknose-young': {
    name: 'Young Hooknose', short: 'Young Hooknose', kind: 'Humanoid · Kessit', ac: 12, hp: 7, initiative: 2, speed: 30,
    attacks: [{ name: 'Curved knife', toHit: 3, dice: '1d4', bonus: 1, type: 'slashing' }],
    note: 'The youngest of the Hooknose robbers.', model: 'hooknose',
  },
  'the-man': {
    name: 'The Man Who Makes Himself Known', short: 'The Man', kind: 'Humanoid · lord of the underground', ac: 16, hp: 110, initiative: 1, speed: 30,
    attacks: [{ name: 'Crushing fist', toHit: 8, dice: '2d8', bonus: 5, type: 'bludgeoning' }, { name: 'Curved dagger', toHit: 8, dice: '1d8', bonus: 5, type: 'piercing' }],
    note: 'You feel him before you see him.', model: 'npc-the-man',
  },
  'sand-nug': {
    name: 'The Sand Nug', short: 'Sand Nug', kind: 'Humanoid · bandit', ac: 13, hp: 16, initiative: 3, speed: 30,
    attacks: [{ name: 'Hidden knife', toHit: 4, dice: '1d6', bonus: 2, type: 'piercing' }, { name: 'Bottle of warm beer (thrown)', toHit: 4, dice: '1d4', bonus: 2, type: 'bludgeoning' }],
    note: 'A pushy street seller of Razz, hawking overpriced mojitos and warm beer.', model: 'npc-sand-nug',
  },
  olemann: {
    name: 'Olemann', short: 'Olemann', kind: 'Humanoid · sea captain', ac: 14, hp: 32, initiative: 2, speed: 30,
    attacks: [{ name: 'Cutlass', toHit: 5, dice: '1d8', bonus: 3, type: 'slashing' }, { name: 'Headbutt', toHit: 5, dice: '1d4', bonus: 3, type: 'bludgeoning' }],
    note: 'A proud captain of Ytterhavn, short, blond and strong.', model: 'npc-olemann',
  },
  bobby: {
    name: 'Bobby', short: 'Bobby', kind: 'Humanoid · barman', ac: 12, hp: 22, initiative: 3, speed: 30,
    attacks: [{ name: 'Flaming cocktail', toHit: 5, dice: '1d10', bonus: 2, type: 'fire' }, { name: 'Bottle smash', toHit: 3, dice: '1d4', bonus: 1, type: 'bludgeoning' }],
    note: 'The well-dressed barman of Ytterhavn’s finest bar.', model: 'npc-bobby',
  },
  bob: {
    name: 'Bob', short: 'Bob', kind: 'Humanoid · shopkeeper', ac: 11, hp: 12, initiative: 1, speed: 30,
    attacks: [{ name: 'Swordfish dagger', toHit: 3, dice: '1d4', bonus: 1, type: 'piercing' }],
    note: 'Bobby’s cheerful younger brother, who sells fish of every kind.', model: 'npc-bob',
  },
  'bridge-troll': {
    name: 'Bridge troll', short: 'Troll', kind: 'Giant · troll', ac: 15, hp: 84, initiative: 1, speed: 30,
    attacks: [{ name: 'Nail-studded club', toHit: 7, dice: '2d6', bonus: 4, type: 'bludgeoning' }, { name: 'Bite', toHit: 7, dice: '1d6', bonus: 4, type: 'piercing' }],
    note: 'Lives under the bridge east of Ytterhavn and wants a toll from everyone who crosses. Heals fast unless burned.', model: 'npc-bridge-troll',
  },
  'lighthouse-keeper': {
    name: 'The lighthouse keeper', short: 'Keeper', kind: 'Humanoid · lighthouse keeper', ac: 11, hp: 18, initiative: 0, speed: 25,
    attacks: [{ name: 'Swinging lantern', toHit: 3, dice: '1d4', bonus: 1, type: 'fire' }, { name: 'Boat hook', toHit: 3, dice: '1d6', bonus: 1, type: 'piercing' }],
    note: 'Keeps the light on the rock in Siri’s Gap. Old, weathered, and sees everything that sails past.', model: 'npc-lighthouse-keeper',
  },
  'ytter-guard': {
    name: 'Ytterhavn guard', short: 'Guard', kind: 'Humanoid · town guard', ac: 15, hp: 26, initiative: 1, speed: 30,
    attacks: [{ name: 'Cutlass', toHit: 5, dice: '1d6', bonus: 3, type: 'slashing' }, { name: 'Boarding hook', toHit: 5, dice: '1d8', bonus: 3, type: 'piercing' }],
    note: 'Sailors who keep the peace in Ytterhavn. Make trouble in the town and they come running, several at a time.', model: 'npc-ytter-guard',
  },
  // Bartedalen.
  findus: {
    name: 'Findus', short: 'Findus', kind: 'Humanoid · dockmaster', ac: 12, hp: 20, initiative: 0, speed: 30,
    attacks: [{ name: 'Gaff hook', toHit: 4, dice: '1d6', bonus: 2, type: 'piercing' }, { name: 'Ring of keys', toHit: 4, dice: '1d4', bonus: 2, type: 'bludgeoning' }],
    note: 'The grumpy dockmaster of Bartedalen, who knows every boat, tide and smuggler.', model: 'npc-findus',
  },
  eggen: {
    name: 'Lord Eggen', short: 'Eggen', kind: 'Humanoid · Assembly Speaker', ac: 10, hp: 15, initiative: -1, speed: 30,
    attacks: [{ name: 'Speaker’s cane', toHit: 2, dice: '1d4', bonus: 0, type: 'bludgeoning' }],
    note: 'The elected leader of Bartedalen, with a colossal wing-shaped moustache.', model: 'npc-eggen',
  },
  // With the party.
  varg: {
    name: 'Varg', short: 'Varg', kind: 'Beast · wolf', ac: 13, hp: 11, initiative: 2, speed: 40,
    attacks: [{ name: 'Bite', toHit: 4, dice: '2d4', bonus: 2, type: 'piercing' }],
    note: 'Edbart’s wolf, rescued from poachers. Loyal, and very fond of Flame Slinger.', model: 'npc-varg',
  },
  // Sirivik.
  'per-hul-oye': {
    name: 'Per Hul Øye', short: 'Per', kind: 'Humanoid · bar owner', ac: 11, hp: 14, initiative: 0, speed: 30,
    attacks: [{ name: 'Heavy mug', toHit: 3, dice: '1d6', bonus: 1, type: 'bludgeoning' }],
    note: 'The bar owner of Sirivik, with a hollow where one eye should be.', model: 'npc-per-hul-oye',
  },
  paul: {
    name: 'Three-Fingered Paul', short: 'Paul', kind: 'Humanoid · shopkeeper', ac: 12, hp: 13, initiative: 1, speed: 30,
    attacks: [{ name: 'Obsidian knife', toHit: 4, dice: '1d4', bonus: 2, type: 'slashing' }],
    note: 'The shopkeeper of Sirivik. His lantern never shakes.', model: 'npc-paul',
  },
  'hostel-owner': {
    name: 'The hostel owner', short: 'Hostel owner', kind: 'Humanoid · innkeeper', ac: 10, hp: 9, initiative: -1, speed: 25,
    attacks: [{ name: 'Candlestick', toHit: 2, dice: '1d4', bonus: 0, type: 'bludgeoning' }],
    note: 'Runs the hostel in Sirivik. Has no toes at all.', model: 'npc-hostel-owner',
  },
  lasse: {
    name: 'Lasse', short: 'Lasse', kind: 'Humanoid · drunk', ac: 9, hp: 8, initiative: -1, speed: 30,
    attacks: [{ name: 'Wild swing of the mug', toHit: 1, dice: '1d4', bonus: 0, type: 'bludgeoning' }],
    note: 'A nervous regular at Per Hul Øye’s bar in Sirivik.', model: 'npc-lasse',
  },
  'god-of-beauty': {
    name: 'The God of Beauty', short: 'God', kind: 'Celestial · lesser god', ac: 19, hp: 250, initiative: 5, speed: 40,
    attacks: [{ name: 'Radiant touch', toHit: 12, dice: '4d10', bonus: 6, type: 'radiant' }, { name: 'Unbearable gaze', toHit: 12, dice: '3d8', bonus: 6, type: 'psychic' }],
    note: 'One of the lesser gods. Fighting it is unwise.', model: 'npc-god-of-beauty',
  },
  ferran: {
    name: 'Ferran', short: 'Ferran', kind: 'Elemental · lesser god of heat', ac: 20, hp: 280, initiative: 2, speed: 30,
    attacks: [{ name: 'Magma fist', toHit: 13, dice: '4d10', bonus: 7, type: 'fire' }, { name: 'Eruption', toHit: 13, dice: '6d6', bonus: 0, type: 'fire' }],
    note: 'The lesser god of heat. The ground grows hot and the air shimmers long before it arrives. Fighting it is unwise.', model: 'npc-ferran',
  },
  'kald-hand': {
    name: 'Kald hånd', short: 'Kald hånd', kind: 'Elemental · lesser god of cold', ac: 19, hp: 240, initiative: 6, speed: 40,
    attacks: [{ name: 'The cold hand', toHit: 13, dice: '4d10', bonus: 6, type: 'cold' }, { name: 'Breath of winter', toHit: 13, dice: '5d8', bonus: 0, type: 'cold' }],
    note: 'The lesser god of cold. Frost creeps over everything it passes, and its touch stops a heart. Fighting it is unwise.', model: 'npc-kald-hand',
  },
  accordion: {
    name: 'The Accordion', short: 'Accordion', kind: 'Monstrosity', ac: 14, hp: 85, initiative: 2, speed: 40,
    attacks: [{ name: 'Crushing fold', toHit: 7, dice: '2d8', bonus: 4, type: 'bludgeoning' }, { name: 'Grasping claws', toHit: 7, dice: '1d10', bonus: 4, type: 'slashing' }],
    note: 'A mangled thing from the foggy hills round Sirivik. Most say it is only a legend.', model: 'npc-accordion',
  },
};

// Generated monsters from the bestiary (database) join the built-in ones here.
// Their figure recipe is registered with the model builder under the same id.
export function addMonster(id, data) {
  MONSTERS[id] = { ...data, model: id, generated: true };
}
export function removeMonster(id) {
  if (MONSTERS[id]?.generated) delete MONSTERS[id];
}

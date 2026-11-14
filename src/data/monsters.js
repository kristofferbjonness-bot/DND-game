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
};

// Generated monsters from the bestiary (database) join the built-in ones here.
// Their figure recipe is registered with the model builder under the same id.
export function addMonster(id, data) {
  MONSTERS[id] = { ...data, model: id, generated: true };
}
export function removeMonster(id) {
  if (MONSTERS[id]?.generated) delete MONSTERS[id];
}

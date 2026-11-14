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
};

// Generated monsters from the bestiary (database) join the built-in ones here.
// Their figure recipe is registered with the model builder under the same id.
export function addMonster(id, data) {
  MONSTERS[id] = { ...data, model: id, generated: true };
}
export function removeMonster(id) {
  if (MONSTERS[id]?.generated) delete MONSTERS[id];
}

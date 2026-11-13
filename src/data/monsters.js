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
};

// Generated monsters from the bestiary (database) join the built-in ones here.
// Their figure recipe is registered with the model builder under the same id.
export function addMonster(id, data) {
  MONSTERS[id] = { ...data, model: id, generated: true };
}
export function removeMonster(id) {
  if (MONSTERS[id]?.generated) delete MONSTERS[id];
}

// Voxel icons: each icon is a little object built from the game's own rounded
// cubes (12 × 12 blocks, one or two deep), lit like the heroes and photographed
// once. `voxelIcon(name)` gives a data: URL, or '' when 3D is not available.
// In the grids, `k` is dark iron (a thin backing that outlines the shape).
import * as THREE from 'three';
import { bevelBox } from '../fx/bevelBox.js';
import { snapshot } from './portraits.js';

const PALETTE = {
  k: '#2b2430', w: '#f1e7d4', g: '#b9b3ac', d: '#77707c', r: '#c94a3a', R: '#8a2e27',
  o: '#e2913d', y: '#e9bf4f', Y: '#a87a2a', b: '#5aa8c8', B: '#2f6a8a', G: '#7fb653', D: '#3f7a34',
  p: '#9b7fd1', P: '#5b4590', n: '#9a6440', N: '#5e3b25', s: '#e3b088', S: '#b07d55',
};
// Blocks that stand out further (blades, gems, gold) get a second layer.
const DEEP = new Set(['w', 'g', 'y', 'r', 'b', 'G', 'p', 'n', 's', 'o']);

export const VOXEL_ART = {
  hp: ['............', '.kkk....kkk.', 'krrrk..krrrk', 'krwrrkkrrrRk', 'krrrrrrrrrRk', 'krrrrrrrrrRk', '.krrrrrrrRk.', '..krrrrrRk..', '...krrrRk...', '....krRk....', '.....kk.....', '............'],
  ac: ['............', '.kkkkkkkkkk.', '.kwgggggggk.', '.kgbbbybbdk.', '.kgbbbybbdk.', '.kgyyyyyydk.', '.kgbbbybbdk.', '..kgbbybdk..', '..kgbbybdk..', '...kgbydk...', '....kgdk....', '.....kk.....'],
  init: ['............', '......kkkk..', '.....kyyyk..', '....kyyyk...', '...kyyyk....', '..kyyyyyykk.', '..kkkkyyyk..', '.....kyyk...', '....kyyk....', '...kyyk.....', '...kkk......', '............'],
  speed: ['............', '....kkkkk...', '....knnnk...', '.ww.knnnk...', '....knnnk...', 'www.knnnk...', '....knnnnkk.', '.ww.knnnnnnk', '...knnnnnnnk', '...kNNNNNNNk', '...kkkkkkkkk', '............'],
  prof: ['............', '.....kk.....', '....kyyk....', '....kyyk....', 'kkkkkyykkkkk', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kyyyyk...', '..kyyYYyyk..', '..kyYkkYyk..', '..kkk..kkk..', '............'],
  xp: ['............', '.....kk.....', '....kyyk....', '...kyywyk...', '..kyywyyyk..', '.kyywyyyyYk.', '.kyyyyyyyYk.', '..kyyyyyYk..', '...kyyyYk...', '....kyYk....', '.....kk.....', '............'],
  str: ['............', '..kkkkkkkk..', '.kssksskssk.', '.kssksskssk.', '.kSSkSSkSSk.', 'kkkkkkkkkssk', 'ksssssssksSk', 'kssssssskSk.', 'kSssssssskk.', '.kSSSSSSSk..', '..kkkkkkkk..', '............'],
  dex: ['.......kkkkk', '........kggk', '.......kgggk', '......knkkgk', '.....knk..kk', '....knk.....', '...knk......', 'kkknk.......', 'krrkk.......', 'krrk........', 'kkrk........', '.kk.........'],
  con: ['............', '.......kkk..', '......kwwwk.', '.....kwwkwk.', '....kkkkwk..', '...knnnnkk..', '..knoonnnk..', '.knoonnnNk..', '.knonnnnNk..', '.knnnnnNk...', '..kNNNNk....', '...kkkk.....'],
  int: ['............', '............', '.kkkkk.kkkkk', 'kwwwwwkwwwwk', 'kwbbbwkwbbwk', 'kwwwwwkwwwwk', 'kwbbwwkwbbbk', 'kwwwwwkwwwwk', 'kwbbbwkwbbwk', 'kBBBBBkBBBBk', '.kkkkkkkkkk.', '............'],
  wis: ['............', '............', '...kkkkkk...', '..kwwwwwwk..', '.kwwkkkkwwk.', 'kwwkppPPkwwk', 'kwwkpkkPkwwk', '.kwwkPPkwwk.', '..kwwkkwwk..', '...kkkkkk...', '............', '............'],
  cha: ['............', '.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwrwwrwwrwk', 'kwwwwwwwwwwk', 'kgwwwwwwwwgk', '.kkkkgwkkkk.', '.....kwk....', '......kk....', '............', '............'],
  map: ['............', 'kkkkkkkkkkkk', 'kwwgkwwgkwwk', 'kwwgkwrgkwwk', 'kGwgkrwrkwbk', 'kGGgkwrgkbbk', 'kwGgkwwgkbwk', 'kwwgkwwgkwwk', 'kwbgkGwgkwGk', 'kbbgkGGgkGGk', 'kkkkkkkkkkkk', '............'],
  hero: ['............', '....kkkk....', '...kggwgk...', '..kgggwggk..', '..kgggwggk..', '..kkkkkkkk..', '..kgkgkkdk..', '..kgggggdk..', '..kgkgkgdk..', '...kgkgdk...', '....kkkk....', '............'],
  party: ['............', '.nk.........', '.nkkkkkkkk..', '.nkrrrrrrrk.', '.nkrryyrrrk.', '.nkryyyyrrk.', '.nkrryyrrk..', '.nkrrrrrrrk.', '.nkRRRRRRRk.', '.nkkkkkkkk..', '.nk.........', '.nk.........'],
  journal: ['............', '.kkkkkkkkk..', 'kwwkwwwwwwk.', 'kkkkwwwwwwk.', '...kwddddwk.', '...kwwwwwwk.', '...kwddddwk.', '...kwwwwwwk.', '...kwdddwkkk', '...kwwwwkwwk', '...kkkkkkkk.', '............'],
  combat: ['kk........kk', 'kgk......kgk', '.kgk....kgk.', '..kgk..kgk..', '...kgkkgk...', '....kggk....', '....kggk....', '...kgkkgk...', '.kkykk.kkyk.', '.kyk.....kyk', 'knk.......kn', 'kk.........k'],
  bestiary: ['............', 'g..........g', 'gg..kkkk..gg', '.ggkwwwwkgg.', '..kwwwwwwk..', '..kwkkwkkwk.', '..kwkrwkrwk.', '..kwwwkwwwk.', '...kwwwwwk..', '...kwkwkwk..', '....kkkkk...', '............'],
  crown: ['............', '............', 'k....kk....k', 'kk..kyyk..kk', 'kyk.kyyk.kyk', 'kyykkyykkyyk', 'kyyyyyyyyyyk', 'kyryybyyryyk', 'kyyyyyyyyyyk', 'kYYYYYYYYYYk', 'kkkkkkkkkkkk', '............'],
  sword: ['.........kkk', '........kwgk', '.......kwgk.', '......kwgk..', '.....kwgk...', '..k.kwgk....', '..kkwgk.....', '...kgk......', '..kykkk.....', '.kyk..k.....', 'kNk.........', 'kk..........'],
  bow: ['..kk........', '.knnk.......', '.knkgk......', 'knk.gk......', 'knk.gk...gk.', 'rwwwwwwwwggk', 'knk.gk...gk.', 'knk.gk......', '.knkgk......', '.knnk.......', '..kk........', '............'],
  dagger: ['............', '.........kk.', '........kwk.', '.......kwgk.', '......kwgk..', '.....kwgk...', '...kkwgk....', '...kygk.....', '..kNkyk.....', '.kNk.k......', '.kk.........', '............'],
  magic: ['.....k......', '....kpk.....', '.k..kpk..k..', 'kpk.kkk.kpk.', '.k.kwwwk.k..', '..kwwbbwk...', 'kkkwbbbbwkkk', '..kwwbbwk...', '.k.kwwwk.k..', 'kpk.kkk.kpk.', '.k..kpk..k..', '.....k......'],
  armour: ['............', '.kkk....kkk.', 'kgggkkkkgggk', 'kgwgggggggdk', 'kgwgkkkkggdk', '.kwgggggggk.', '.kwgkkkkgdk.', '.kwgggggggk.', '.kggkkkkgdk.', '.kgggggggdk.', '..kkkkkkkk..', '............'],
  bag: ['............', '....kkkk....', '...knNNnk...', '....kyyk....', '...knnnnk...', '..knnnnnnk..', '.knnwnnnnnk.', '.knwnnnnnNk.', '.knnnnnnnNk.', '.kNnnnnnNNk.', '..kkkkkkkk..', '............'],
  coin: ['............', '....kkkk....', '..kkyyyykk..', '.kyywyyyyYk.', '.kywyyYyyYk.', 'kyyyyYYyyyYk', 'kyyyyYYyyyYk', '.kyyyyYyyYk.', '.kYyyyyyYYk.', '..kkYYYYkk..', '....kkkk....', '............'],
  gem: ['............', '............', '...kkkkkk...', '..kbwbbbBk..', '.kbwbbbbbBk.', 'kkkkkkkkkkkk', '.kbbbbbbbBk.', '..kbbbbbBk..', '...kbbbBk...', '....kbBk....', '.....kk.....', '............'],
  potion: ['............', '....kkkk....', '....kNNk....', '....kwgk....', '...kwwggk...', '..kwrrrrdk..', '.kwrwrrrrRk.', '.krwrrrrrRk.', '.krrrrrrrRk.', '..kRRRRRRk..', '...kkkkkk...', '............'],
  sun: ['.....yy.....', '.y...yy...y.', '..y......y..', '....kkkk....', '...kyyyyk...', 'yy.kyyyoko.y', 'yy.kyyyoko.y', '...kyoook...', '....kkkk....', '..y......y..', '.y...yy...y.', '.....yy.....'],
  moon: ['............', '....kkkk....', '...kwwwk....', '..kwwgk.....', '..kwwk......', '.kwwgk......', '.kwwgk....k.', '.kwwwgk..kwk', '..kwwwgkkwk.', '..kgwwwwwgk.', '...kkggggk..', '.....kkkk...'],
  cloud: ['............', '............', '....kkkk....', '...kwwwwk...', '..kwwwwwwkk.', '.kkwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwwwwwwwwgk', 'kgwwwwwwwggk', '.kggggggggk.', '..kkkkkkkk..', '............'],
  rain: ['....kkkk....', '...kggggk...', '..kggggggkk.', '.kggggggggdk', 'kggggggggggk', 'kdggggggggdk', '.kddddddddk.', '..kkkkkkkk..', '..b...b...b.', '.b...b...b..', '....b...b...', '...b...b....'],
  storm: ['....kkkk....', '...kddddk...', '..kddddddkk.', '.kddddddddPk', 'kddddddddddk', 'kPddddddddPk', '.kPPPPkyPPk.', '..kkkkyykk..', '.....kyyk...', '....kyyk....', '....kyk.....', '....kk......'],
  snow: ['.....w......', '...w.w.w....', '....www.....', '.w..www..w..', '..wwwwwww...', 'wwwwwbwwwww.', '..wwwwwww...', '.w..www..w..', '....www.....', '...w.w.w....', '.....w......', '............'],
  windy: ['............', '.......www..', '.......w..w.', 'wwwwwwwwww..', '............', 'wwwwwwwwwwww', '..........w.', '.wwwwwww.w..', '.......w....', '....www.....', '............', '............'],
  scroll: ['............', '..kkkkkkkk..', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '..kwwwwwwk..', '..kwddddwk..', '..kwwwwwwk..', '..kwdddwwk..', '..kwwwwwwk..', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '..kkkkkkkk..'],
  check: ['............', '..........GG', '.........GGG', '........GGG.', '.......GGG..', 'GG....GGG...', 'GGG..GGG....', '.GGGGGG.....', '..GGGG......', '...GG.......', '............', '............'],
  lock: ['............', '....kkkk....', '...kgddgk...', '..kgk..kgk..', '..kgk..kgk..', '.kkkkkkkkkk.', '.kyyyyyyyYk.', '.kyyykkyyYk.', '.kyyykkyyYk.', '.kyyyyyyyYk.', '.kYYYYYYYYk.', '..kkkkkkkk..'],
  pin: ['............', '....kkkk....', '...krrrrk...', '..krwrrrRk..', '..krrwwrRk..', '..krrwwrRk..', '...krrrRk...', '...krrrRk...', '....krRk....', '....krRk....', '.....kk.....', '............'],
  pen: ['............', '.........kk.', '........kwwk', '.......kwwk.', '......kgwk..', '.....kgwk...', '....kgwk....', '...kgwk.....', '..kyyk......', '..kNk.......', '..kk........', '............'],
  plus: ['............', '....kkkk....', '....kyyk....', '....kyyk....', '.kkkkyykkkk.', '.kyyyyyyyyk.', '.kyyyyyyyyk.', '.kkkkyykkkk.', '....kyyk....', '....kyyk....', '....kkkk....', '............'],
};

const cache = new Map();
let cube = null, material = null;

function build(rows) {
  cube ??= bevelBox(1, 1, 1, 0.16);
  material ??= new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
  const cells = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PALETTE[ch]) cells.push([x, y, ch]); }));
  const mesh = new THREE.InstancedMesh(cube, material, cells.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  cells.forEach(([x, y, ch], i) => {
    // Iron sits a little behind and thinner; bright parts stand a block proud.
    const depth = ch === 'k' ? 0.7 : DEEP.has(ch) ? 1.6 : 1.2;
    const z = ch === 'k' ? -0.35 : depth / 2 - 0.5;
    m.makeScale(1, 1, depth).setPosition(x - 5.5, 5.5 - y, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(PALETTE[ch]));
  });
  return mesh;
}

export function voxelIcon(name) {
  if (cache.has(name)) return cache.get(name);
  const rows = VOXEL_ART[name];
  let url = '';
  if (rows) {
    const mesh = build(rows);
    url = snapshot(mesh, { half: 7.4, center: new THREE.Vector3(0, -0.2, 0), dir: [0.34, 0.32, 1], size: 72 });
    mesh.dispose();
  }
  cache.set(name, url);
  return url;
}

// One voxel diorama per location, built from its description in the lore.
// Each scene paints into a 48x48 slab. +x and +z face the camera.
import { hash, noise, house, tree, pine, palm, person, boat, flag, shade } from '../../src/city/vox.js';

const N = 48;
const GRASS = ['#86c95c', '#7cc054', '#90cf66'];
const pick = (arr, x, z, s = 0) => arr[Math.floor(hash(x, z, s) * arr.length)];
const dirt = (x, z, y, h) => (y > h - 3 ? '#9a7650' : '#7f6246');
const rock = (x, z, y) => (hash(x, y, z) > 0.5 ? '#8e8679' : '#a0978a');
const SHIRTS = ['#c9473d', '#3a7d8c', '#d9a23a', '#7b3f8f', '#4f8a3a', '#e07b39', '#2f5d9e'];

// Sea bed colour by depth.
const bed = (x, z, h) => (h >= -1 ? '#e8d6a0' : h >= -3 ? '#8fd0c9' : '#5fb2c0');

export const SCENES = {
  // -------------------------------------------------------------------------
  razz: {
    sky: ['#ffc78f', '#fff1d8'],
    sun: { color: '#ffe0b0', intensity: 2.6, position: [-50, 60, 30] },
    build(v) {
      const plateau = (x, z) => Math.hypot(x - 19, z - 19) < 9.5;
      const shore = (x, z) => x + z * 0.25 + noise(x, z, 6, 2) * 3 > 46;
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => (shore(x, z) ? -2 - Math.floor(noise(x, z, 5, 3) * 2) : plateau(x, z) ? 6 : 2),
        top: (x, z, h) => (h === 6 ? (((x + z) % 2) ? '#e4c592' : '#dcb983') : '#e6cfa1'),
        side: (x, z, y, h) => (h === 6 && y > 2 ? (hash(x, y, z) > 0.5 ? '#cba371' : '#c19663') : '#bf9a6a'),
        bed,
      });
      // The maze: blocks of bowed sandstone houses separated by one-voxel alleys.
      const walls = ['#e3c08f', '#d9b07a', '#ecd3a6', '#cfa46d', '#e8c99a'];
      const awnings = ['#c9473d', '#3a7d8c', '#d9a23a', '#7b3f8f', '#4f8a3a'];
      for (let bx = 1; bx < N - 4; bx += 4) for (let bz = 1; bz < N - 4; bz += 4) {
        const cx = bx + 1.5, cz = bz + 1.5;
        if (Math.hypot(cx - 19, cz - 19) < 11.5) continue;
        if (!v.inside(bx, bz) || !v.inside(bx + 3, bz + 3)) continue;
        if (v.groundY(bx, bz) < 2 || v.groundY(bx + 2, bz + 2) < 2 || v.groundY(bx + 3, bz + 3) < 2) continue;
        if (hash(bx, bz, 7) < 0.12) continue; // a small square in the maze
        const h = 3 + Math.floor(hash(bx, bz, 1) * 5);
        const w = 3 + (hash(bx, bz, 2) > 0.7 ? 1 : 0);
        const wall = pick(walls, bx, bz);
        v.box(bx, 3, bz, bx + w, 3 + h, bz + 3, wall);
        // Bowed top edge: a lighter rim with a rounded middle.
        v.box(bx, 3 + h, bz, bx + w, 4 + h, bz + 3, shade(wall, 1.06));
        v.clear(bx, 3 + h, bz); v.clear(bx + w - 1, 3 + h, bz + 2);
        // Dark arched windows and the odd lit one.
        if (h > 3) {
          (hash(bx, bz, 3) > 0.6 ? v.light.bind(v) : v.set.bind(v))(bx + 1, 3 + h - 2, bz + 2, hash(bx, bz, 3) > 0.6 ? '#ffd27a' : '#5a4632');
        }
        if (hash(bx, bz, 4) > 0.78) {
          const c = pick(awnings, bx, bz, 5);
          for (let i = 0; i < w; i++) v.set(bx + i, 5, bz + 3, c);
        }
        if (hash(bx, bz, 6) > 0.7) v.light(bx + w - 1, 3 + h + 1, bz + 1, '#ffb54d');
      }
      // Central square building on the plateau.
      v.box(14, 7, 14, 25, 17, 25, '#d8b583');
      v.box(13, 17, 13, 26, 18, 26, '#c9a674');
      for (let i = 13; i < 26; i += 2) { v.set(i, 18, 13, '#c9a674'); v.set(i, 18, 25, '#c9a674'); v.set(13, 18, i, '#c9a674'); v.set(25, 18, i, '#c9a674'); }
      for (let i = 15; i < 24; i += 2) for (const y of [10, 14]) { v.light(i, y, 24, '#ffcf73'); v.light(24, y, i, '#ffcf73'); }
      v.box(18, 7, 24, 21, 11, 25, '#5a4632');
      for (let y = 9; y < 14; y++) for (let i = 16; i < 23; i++) v.set(i, y, 25, i % 2 ? '#7b3f8f' : '#8d4fa1');
      flag(v, 19, 18, 19, '#7b3f8f', { height: 5 });
      // Market stalls and people on the plaza.
      for (const [x, z, c] of [[27, 15, '#c9473d'], [12, 27, '#3a7d8c'], [27, 23, '#d9a23a'], [22, 28, '#4f8a3a']]) {
        v.box(x, 7, z, x + 2, 9, z + 2, '#8a6440');
        v.box(x - 1, 9, z - 1, x + 3, 10, z + 3, c);
      }
      for (let i = 0; i < 18; i++) {
        const a = hash(i, 1, 9) * Math.PI * 2, r = 7 + hash(i, 2, 9) * 2;
        const x = Math.round(19 + Math.cos(a) * r), z = Math.round(19 + Math.sin(a) * r);
        if (!v.has(x, 7, z)) person(v, x, 6, z, SHIRTS[i % SHIRTS.length]);
      }
      // Lantern posts around the plateau rim.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = Math.round(19 + Math.cos(a) * 9), z = Math.round(19 + Math.sin(a) * 9);
        v.set(x, 7, z, '#5b4a3a'); v.set(x, 8, z, '#5b4a3a'); v.light(x, 9, z, '#ffb54d');
      }
      // Harbour: a pier and boats.
      v.box(38, 1, 40, 47, 2, 42, '#8a6440');
      boat(v, 40, 0, 36, { length: 7, sail: '#f4e6c8' });
      boat(v, 33, 0, 45, { length: 5, mast: false, hull: '#3a7d8c' });
    },
  },

  // -------------------------------------------------------------------------
  tine: {
    sky: ['#9fd3ee', '#f3f8ef'],
    build(v) {
      const river = (x, z) => Math.abs(z - (36 + Math.sin(x / 6) * 3)) < 2.2;
      v.ground({
        waterLevel: 2,
        heightAt: (x, z) => (river(x, z) ? 0 : 3 + Math.floor(noise(x, z, 10, 4) * 2.2)),
        top: (x, z, h) => {
          if (x > 33 && z < 30 && Math.floor(z / 3) % 2) return '#e2c55a'; // wheat
          if (x > 33 && z < 30) return '#c9b04a';
          if (Math.abs(x - 23) <= 1 && z > 24) return '#c9b48a'; // road
          return pick(GRASS, x, z);
        },
        side: dirt,
        bed: () => '#7cb7c4',
      });
      const stone = (x, y, z) => (hash(x, y, z) > 0.5 ? '#c3c6cc' : '#b4b8bf');
      const y0 = 5;
      // Curtain walls with crenellations.
      for (const [x0, z0, x1, z1] of [[10, 8, 34, 9], [10, 29, 34, 30], [10, 8, 11, 30], [33, 8, 34, 30]]) {
        v.box(x0, y0 - 2, z0, x1, y0 + 4, z1, stone);
        for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) if ((x + z) % 2 === 0) v.set(x, y0 + 4, z, '#b4b8bf');
      }
      v.box(20, y0, 29, 24, y0 + 3, 30, '#4a3a2c'); // gate
      // Corner towers with red pointed roofs.
      for (const [x, z] of [[9, 7], [32, 7], [9, 28], [32, 28]]) {
        v.box(x, y0 - 2, z, x + 3, y0 + 8, z + 3, stone);
        for (let i = 0; i < 3; i++) v.box(x + (i ? 0 : -1) + Math.floor(i / 2), y0 + 8 + i, z + (i ? 0 : -1) + Math.floor(i / 2), x + 3 + (i ? 0 : 1) - Math.floor(i / 2), y0 + 9 + i, z + 3 + (i ? 0 : 1) - Math.floor(i / 2), '#a83c3c');
        v.set(x + 1, y0 + 11, z + 1, '#a83c3c');
      }
      // The keep.
      v.box(17, y0, 13, 27, y0 + 14, 22, stone);
      for (const y of [y0 + 5, y0 + 9]) for (let i = 18; i < 26; i += 2) { v.set(i, y, 21, '#3a3640'); v.set(26, y, i - 3, '#3a3640'); }
      house(v, 17, y0 + 14, 13, { w: 10, d: 9, h: 0, wall: '#c9ccd2', roof: '#a83c3c', roofType: 'pyramid' });
      for (const [x, z] of [[16, 12], [26, 21]]) {
        v.box(x, y0 + 10, z, x + 2, y0 + 19, z + 2, stone);
        house(v, x, y0 + 19, z, { w: 2, d: 2, h: 0, wall: stone, roof: '#a83c3c', roofType: 'pyramid' });
      }
      flag(v, 22, y0 + 20, 17, '#d9a23a', { height: 6, width: 4 });
      // Banners hanging from the keep.
      for (let y = y0 + 4; y < y0 + 10; y++) { v.set(19, y, 22, '#d9a23a'); v.set(24, y, 22, '#d9a23a'); }
      // Courtyard houses.
      house(v, 12, y0, 22, { w: 4, d: 4, h: 3, wall: '#efe5d2', roof: '#a83c3c' });
      house(v, 28, y0, 12, { w: 4, d: 4, h: 3, wall: '#efe5d2', roof: '#a83c3c' });
      // Town and fields outside the walls.
      for (const [x, z, w] of [[3, 33, 5], [10, 40, 4], [28, 40, 5], [36, 33, 4], [2, 15, 4]]) {
        if (v.inside(x, z)) house(v, x, v.groundY(x, z) + 1, z, { w, d: 4, h: 3, wall: '#efe5d2', roof: pick(['#a83c3c', '#4b5d8a', '#b8584a'], x, z), trim: '#8a6440' });
      }
      for (const [x, z] of [[4, 4], [40, 40], [44, 32], [6, 26], [16, 42], [38, 4]]) if (v.inside(x, z)) tree(v, x, v.groundY(x, z), z);
      for (let i = 0; i < 10; i++) person(v, 23 + (i % 2), v.groundY(23, 31 + i * 1.5 | 0), 31 + Math.floor(i * 1.5), SHIRTS[i % 7]);
      boat(v, 6, 2, 36, { length: 6, sail: '#d9a23a', mast: true });
    },
  },

  // -------------------------------------------------------------------------
  bartedalen: {
    sky: ['#9fc9e6', '#eef4f6'],
    sun: { color: '#fff4e0', intensity: 2.2, position: [-40, 70, 20] },
    build(v) {
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => {
          const back = Math.max(0, 20 - x - z * 0.6);
          const mountain = Math.max(0, (24 - z) * 0.9 + (18 - x) * 0.5) * (0.6 + noise(x, z, 6, 8) * 0.8);
          if (z > 36 + noise(x, z, 6, 9) * 4) return -2;
          return 2 + Math.floor(back * 0.3 + mountain);
        },
        top: (x, z, h) => (h > 18 ? '#f4f7fa' : h > 10 ? rock(x, z, h) : h <= 2 ? '#c9c2a8' : pick(['#8cbf62', '#7cb35a', '#94c46c'], x, z)),
        side: (x, z, y, h) => (h > 8 ? rock(x, z, y) : dirt(x, z, y, h)),
        bed: () => '#6fb3c4',
      });
      v.waterColour = '#4aa7cc';
      const wall = ['#9a6a45', '#b07c50', '#8a5d3c'];
      const homes = [[22, 22], [30, 18], [34, 27], [26, 30], [16, 30], [38, 20]];
      homes.forEach(([x, z], i) => house(v, x, v.groundY(x, z) + 1, z, {
        w: 5, d: 4, h: 4, wall: pick(wall, x, z), roof: i % 3 ? '#3e4b5c' : '#7a3a32', trim: '#e8e0d0',
      }));
      // Wind-forges: tall towers with big cross sails.
      for (const [x, z] of [[12, 34], [42, 12]]) {
        const y = v.groundY(x, z) + 1;
        v.box(x, y, z, x + 3, y + 9, z + 3, '#d8d2c6');
        house(v, x, y + 9, z, { w: 3, d: 3, h: 0, wall: '#d8d2c6', roof: '#3e4b5c', roofType: 'pyramid' });
        v.light(x + 1, y + 1, z + 2, '#ff9a3c'); // forge glow
        v.set(x + 1, y + 7, z + 3, '#6b4a2e');
        for (let i = 1; i <= 5; i++) for (const w of [0, 1]) {
          v.set(x + 1 + i, y + 7 + w, z + 3, '#efe8da'); v.set(x + 1 - i, y + 6 + w, z + 3, '#efe8da');
          v.set(x + 1 + w, y + 7 + i, z + 3, '#efe8da'); v.set(x + w, y + 7 - i, z + 3, '#efe8da');
        }
      }
      // The Great Tusked One: a walrus statue in the square.
      const sx = 40, sz = 30, sy = v.groundY(sx, sz) + 1;
      v.box(sx - 1, sy, sz - 1, sx + 5, sy + 1, sz + 3, '#b9b2a6');
      v.box(sx, sy + 1, sz, sx + 4, sy + 4, sz + 2, '#8a6a52');
      v.box(sx + 1, sy + 4, sz, sx + 4, sy + 6, sz + 2, '#8a6a52');
      v.set(sx + 3, sy + 5, sz + 2, '#3a2a20');
      for (const dx of [1, 3]) { v.set(sx + dx, sy + 3, sz + 2, '#fbf6ea'); v.set(sx + dx, sy + 2, sz + 2, '#fbf6ea'); v.set(sx + dx, sy + 1, sz + 3, '#fbf6ea'); }
      // Salt pans by the water.
      for (let x = 2; x < 20; x += 3) for (let z = 38; z < 44; z += 3) if (v.inside(x, z) && v.groundY(x, z) >= 0) v.box(x, v.groundY(x, z), z, x + 2, v.groundY(x, z) + 1, z + 2, '#fbfbf7');
      // Fish drying racks.
      for (const [x, z] of [[20, 37], [36, 35]]) {
        const y = v.groundY(x, z) + 1;
        v.box(x, y, z, x + 1, y + 3, z + 1, '#6b4a2e'); v.box(x + 5, y, z, x + 6, y + 3, z + 1, '#6b4a2e');
        v.box(x, y + 3, z, x + 6, y + 4, z + 1, '#6b4a2e');
        for (let i = 1; i < 5; i++) v.set(x + i, y + 2, z, '#c3ccd2');
      }
      // Kites riding the wind.
      for (const [x, y, z, c] of [[30, 19, 34, '#c9473d'], [20, 21, 36, '#d9a23a'], [42, 17, 38, '#2f5d9e']]) {
        v.set(x, y, z, c); v.set(x - 1, y - 1, z, c); v.set(x + 1, y - 1, z, c); v.set(x, y - 2, z, c);
        v.set(x, y - 3, z, '#f2ecdf'); v.set(x, y - 4, z + 1, c);
      }
      boat(v, 6, 0, 44, { length: 8, sail: '#c9473d' });
      boat(v, 34, 0, 43, { length: 6, sail: '#f4ecdc' });
      for (let i = 0; i < 8; i++) { const x = 20 + i * 2, z = 32 + (i % 3); if (v.inside(x, z) && !v.has(x, v.groundY(x, z) + 1, z)) person(v, x, v.groundY(x, z), z, SHIRTS[i % 7], { hat: '#3e4b5c' }); }
      for (const [x, z] of [[6, 10], [10, 4], [4, 18], [40, 6], [44, 26]]) if (v.inside(x, z) && v.groundY(x, z) < 12) pine(v, x, v.groundY(x, z), z, { snow: true });
    },
  },

  // -------------------------------------------------------------------------
  kolaveri: {
    sky: ['#8fd7ee', '#fdf6e3'],
    build(v) {
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => {
          const d = x * 0.55 + z * 0.75 + noise(x, z, 7, 11) * 6;
          return d > 44 ? -1 - Math.floor((d - 44) / 4) : d > 38 ? 1 : 2 + Math.floor(noise(x, z, 8, 12) * 2);
        },
        top: (x, z, h) => (h <= 1 ? '#f2dfa6' : pick(['#47a552', '#3f9d4c', '#55b35e'], x, z)),
        side: (x, z, y, h) => (h <= 1 ? '#e3c98c' : dirt(x, z, y, h)),
        bed,
      });
      v.waterColour = '#3cc4d0';
      for (const [x, z, s] of [[14, 18, 0], [24, 12, 1], [10, 30, 2], [26, 26, 3], [34, 14, 4]]) {
        const y = v.groundY(x, z) + 1;
        house(v, x, y + 1, z, { w: 5, d: 5, h: 3, wall: '#c69c6d', roof: '#d9bf6a', trim: '#8a6440' });
        for (const [dx, dz] of [[0, 0], [4, 0], [0, 4], [4, 4]]) v.set(x + dx, y, z + dz, '#7a5636');
        v.box(x - 1, y, z + 5, x + 6, y + 1, z + 7, '#8a6440');
      }
      for (const [x, z, l] of [[36, 30, 1], [30, 36, -1], [20, 36, 1], [42, 22, 1], [8, 40, 1], [4, 12, 1], [40, 6, -1]]) if (v.inside(x, z)) palm(v, x, v.groundY(x, z), z, { lean: l });
      for (const [x, z] of [[6, 6], [18, 4], [4, 22]]) if (v.inside(x, z)) tree(v, x, v.groundY(x, z), z, { leaf: '#3f9d4c', size: 2 });
      boat(v, 38, 0, 40, { length: 6, mast: false, hull: '#c9473d' });
      boat(v, 26, 0, 44, { length: 5, mast: false, hull: '#3a7d8c' });
      for (let i = 0; i < 6; i++) person(v, 22 + i * 3, v.groundY(22 + i * 3, 32), 32, SHIRTS[(i + 2) % 7]);
    },
  },

  // -------------------------------------------------------------------------
  hrimnir: {
    sky: ['#a6d8ec', '#fbf3e4'],
    build(v) {
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => {
          if (x + z > 70 + noise(x, z, 6, 13) * 6) return -2;
          return 2 + Math.floor(Math.max(0, 14 - x * 0.5 - z * 0.4) * noise(x, z, 9, 14));
        },
        top: (x, z, h) => (Math.abs(x - z) < 2 && x > 20 ? '#d8c39a' : x > 14 && x < 30 && z > 14 && z < 30 ? '#e8dcc0' : pick(['#55b35e', '#4fa856', '#62bd68'], x, z)),
        side: dirt,
        bed,
      });
      // Pagoda: four tiers, dark eaves that flick up at the corners.
      const cx = 18, cz = 18;
      let y = v.groundY(cx, cz) + 1, r = 6;
      v.box(cx - 7, y - 1, cz - 7, cx + 8, y, cz + 8, '#c9c2b3');
      for (let tier = 0; tier < 4; tier++) {
        const h = tier ? 3 : 4;
        v.box(cx - r + 2, y, cz - r + 2, cx + r - 1, y + h, cz + r - 1, '#b8463c');
        for (let i = cx - r + 3; i < cx + r - 2; i += 2) v.light(i, y + 1, cz + r - 2, '#ffd27a');
        v.box(cx - r, y + h, cz - r, cx + r + 1, y + h + 1, cz + r + 1, '#2f3640');
        for (const [ex, ez] of [[cx - r, cz - r], [cx + r, cz - r], [cx - r, cz + r], [cx + r, cz + r]]) v.set(ex, y + h + 1, ez, '#2f3640');
        y += h + 1; r -= 1;
      }
      for (let i = 0; i < 4; i++) v.set(cx, y + i, cz, '#d9a23a');
      // Red gate in front of the training yard.
      const gx = 30, gz = 30, gy = v.groundY(gx, gz) + 1;
      v.box(gx, gy, gz, gx + 1, gy + 7, gz + 1, '#c9473d'); v.box(gx + 6, gy, gz - 6, gx + 7, gy + 7, gz - 5, '#c9473d');
      for (let i = -1; i <= 7; i++) { v.set(gx + i, gy + 7, gz - i, '#2f3640'); v.set(gx + i, gy + 5, gz - i, '#c9473d'); }
      // Students training with blades in the yard.
      for (let i = 0; i < 6; i++) {
        const x = 18 + (i % 3) * 4, z = 30 + Math.floor(i / 3) * 4;
        person(v, x, v.groundY(x, z), z, '#f2ecdf', { hat: '#2f3640' });
        v.set(x + 1, v.groundY(x, z) + 3, z, '#d8dde3');
        v.set(x + 2, v.groundY(x, z) + 4, z, '#d8dde3');
      }
      person(v, 24, v.groundY(24, 27), 27, '#2f3640', { hat: '#e8e2d4' });
      for (const [x, z] of [[4, 34], [6, 6], [36, 6], [42, 18], [4, 20], [34, 38]]) if (v.inside(x, z) && v.groundY(x, z) > 0) pine(v, x, v.groundY(x, z), z, { leaf: '#2f6f4a', height: 8 });
      for (const [x, z] of [[10, 40], [40, 28]]) if (v.inside(x, z) && v.groundY(x, z) > 0) tree(v, x, v.groundY(x, z), z, { leaf: '#f2a7c3', size: 1 });
      boat(v, 40, 0, 40, { length: 6, sail: '#c9473d', axis: 'z' });
    },
  },

  // -------------------------------------------------------------------------
  ferran: {
    sky: ['#b7d7ee', '#f4f6f6'],
    sun: { color: '#fff8ee', intensity: 2.0, position: [-60, 70, 30] },
    build(v) {
      const stream = (x, z) => Math.abs(x - (26 + Math.sin(z / 5) * 3)) < 1.5;
      v.ground({
        waterLevel: 3,
        heightAt: (x, z) => {
          if (stream(x, z) && z > 18) return 2;
          const back = Math.max(0, 22 - z) * 0.75 + Math.max(0, 14 - x) * 0.3;
          return 4 + Math.floor(back * (0.55 + noise(x, z, 6, 16) * 0.7) + noise(x, z, 4, 15) * 2);
        },
        top: (x, z, h) => (h > 8 || hash(x, z, 1) > 0.6 ? '#f4f7fa' : '#e6eef3'),
        side: (x, z, y, h) => (y > h - 1 ? '#e6eef3' : rock(x, z, y)),
        bed: () => '#a9d4e6',
      });
      v.waterColour = '#9fd8ef';
      for (let i = 0; i < 30; i++) {
        const x = Math.floor(hash(i, 3, 17) * N), z = 12 + Math.floor(hash(i, 4, 17) * 36);
        if (!v.inside(x, z) || stream(x, z) || Math.abs(x - 36) < 6 && Math.abs(z - 36) < 6) continue;
        if (Math.abs(x - 14) < 6 && Math.abs(z - 34) < 5) continue;
        pine(v, x, v.groundY(x, z), z, { snow: true, height: 6 + Math.floor(hash(i, 5, 17) * 4) });
      }
      // Edbart's cabin with a smoking chimney.
      const hx = 11, hz = 32, hy = v.groundY(hx, hz) + 1;
      house(v, hx, hy, hz, { w: 6, d: 5, h: 4, wall: '#8a5d3c', roof: '#f4f7fa', trim: '#6b4a2e', lit: true });
      v.box(hx + 4, hy + 4, hz + 1, hx + 5, hy + 8, hz + 2, '#8e8679');
      v.puff(hx + 6, hy + 11, hz, 2.5, 1.6, 2);
      v.puff(hx + 9, hy + 13, hz - 1, 3, 1.8, 2.2);
      // Varg the wolf on a rock.
      const wx = 35, wz = 36, wy = v.groundY(wx, wz) + 1;
      v.box(wx - 2, wy, wz - 2, wx + 5, wy + 2, wz + 3, rock);
      const fur = '#8f939b', dark = '#5e636b', y = wy + 2;
      v.box(wx, y, wz, wx + 4, y + 1, wz + 1, dark);
      v.clear(wx + 1, y, wz); v.clear(wx + 2, y, wz);
      v.box(wx, y + 1, wz, wx + 4, y + 3, wz + 1, fur);
      v.box(wx + 3, y + 3, wz, wx + 5, y + 5, wz + 1, fur);
      v.set(wx + 5, y + 3, wz, '#c9ccd2'); v.set(wx + 6, y + 3, wz, '#22252a');
      v.set(wx + 3, y + 5, wz, dark); v.set(wx + 4, y + 5, wz, dark);
      v.set(wx + 4, y + 4, wz + 1, '#22252a');
      v.set(wx - 1, y + 2, wz, fur); v.set(wx - 2, y + 3, wz, '#c9ccd2');
      person(v, wx - 5, v.groundY(wx - 5, wz + 3), wz + 3, '#4f6d8f', { hat: '#8a5d3c' });
    },
  },

  // -------------------------------------------------------------------------
  ytterhavn: {
    sky: ['#9fd3ee', '#fbf3e4'],
    build(v) {
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => (z > 26 ? -3 : 2 + Math.floor(Math.max(0, 14 - z) * 0.25)),
        top: (x, z, h) => (z > 21 ? '#b9b2a6' : pick(['#d8cbb4', '#cfc2a9'], x, z)),
        side: (x, z, y) => (hash(x, y, z) > 0.5 ? '#a8a194' : '#9c9589'),
        bed,
      });
      // Quay with bollards, crates and barrels.
      for (let x = 2; x < 46; x += 4) v.set(x, 3, 25, '#5b4a3a');
      for (const [x, z, c] of [[6, 22, '#a8743e'], [7, 22, '#a8743e'], [6, 22, '#a8743e'], [20, 23, '#4f6d8f'], [21, 23, '#c9473d'], [34, 22, '#a8743e'], [35, 22, '#d9a23a']]) v.set(x, 3, z, c);
      v.box(28, 3, 21, 30, 5, 23, '#a8743e');
      // Colourful warehouses and merchant houses.
      const fronts = ['#c9473d', '#d9a23a', '#3a7d8c', '#e4d6bd', '#7b9a4a', '#b8584a'];
      for (let i = 0; i < 7; i++) {
        const x = 2 + i * 6, z = 8 + (i % 2) * 2;
        if (!v.inside(x, z)) continue;
        house(v, x, v.groundY(x, z) + 1, z, { w: 5, d: 6, h: 5 + (i % 3), wall: fronts[i % fronts.length], roof: '#4a4f5a', trim: '#f2ecdf' });
      }
      // Harbour crane.
      v.box(40, 3, 20, 42, 14, 22, '#7a5636');
      for (let x = 34; x < 44; x++) v.set(x, 14, 21, '#7a5636');
      for (let y = 9; y < 14; y++) v.set(35, y, 21, '#c9c2b3');
      v.box(34, 7, 20, 37, 9, 23, '#a8743e');
      // Piers and ships.
      for (const px of [10, 24, 38]) v.box(px, 1, 26, px + 2, 2, 40, '#8a6440');
      boat(v, 4, -1, 33, { length: 12, sail: '#f4ecdc', axis: 'z' });
      boat(v, 15, -1, 30, { length: 10, sail: '#c9473d', axis: 'z' });
      boat(v, 29, -1, 31, { length: 11, sail: '#f4ecdc', axis: 'z' });
      boat(v, 42, -1, 36, { length: 7, sail: '#3a7d8c', axis: 'x' });
      for (let i = 0; i < 12; i++) person(v, 3 + i * 3.6 | 0, 2, 23 + (i % 2), SHIRTS[i % 7]);
      for (const [x, z] of [[4, 2], [44, 8], [26, 2]]) if (v.inside(x, z)) tree(v, x, v.groundY(x, z), z);
    },
  },

  // -------------------------------------------------------------------------
  sirivik: {
    sky: ['#7d8794', '#c9cfd4'],
    sun: { color: '#dfe6ee', intensity: 1.3, position: [-40, 60, 20] },
    hemi: 1.1,
    fog: ['#b8c0c8', 90, 190],
    targetY: 9,
    distance: 100,
    build(v) {
      const C = 14; // clifftop height
      const cliff = (x, z) => z < 24 + noise(x, z, 5, 18) * 4;
      const obsidian = (x, y, z) => (hash(x, y, z) > 0.55 ? '#2b2833' : hash(x, y, z) > 0.2 ? '#35313e' : '#423d4d');
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => (cliff(x, z) ? C : -3),
        top: (x, z) => (hash(x, z, 2) > 0.5 ? '#4d5248' : '#585e52'),
        side: (x, z, y) => obsidian(x, y, z),
        bed: () => '#3d5866',
      });
      v.waterColour = '#3f6f80';
      v.mistColour = '#e4e8ec';
      // Glowing runes etched into the cliff face.
      for (let i = 0; i < 34; i++) {
        const x = Math.floor(hash(i, 1, 19) * N), y = 2 + Math.floor(hash(i, 2, 19) * (C - 3));
        for (let z = N - 1; z >= 0; z--) if (v.has(x, y, z)) { if (v.groundY(x, z) === C) v.light(x, y, z, '#5fe0d0'); break; }
      }
      // Crooked dark houses on the clifftop.
      const homes = [[4, 5, 5], [13, 11, 4], [22, 4, 5], [29, 12, 4], [37, 4, 5], [6, 15, 4], [20, 16, 4]];
      homes.forEach(([x, z, w], i) => {
        if (!v.inside(x, z)) return;
        house(v, x, C + 1, z, { w, d: 4, h: 4 + (i % 2), wall: i % 2 ? '#3a3640' : '#45404d', roof: '#1f1d24', lit: i % 3 === 0 });
      });
      // Lighthouse at the cliff edge.
      const lx = 41, lz = 17;
      for (let y = C + 1; y < C + 11; y++) v.box(lx, y, lz, lx + 3, y + 1, lz + 3, y % 4 < 2 ? '#e8e4dc' : '#a8433a');
      v.box(lx, C + 11, lz, lx + 3, C + 13, lz + 3, '#ffd98a');
      v.light(lx + 1, C + 12, lz + 3, '#fff1b8'); v.light(lx + 3, C + 12, lz + 1, '#fff1b8');
      house(v, lx, C + 13, lz, { w: 3, d: 3, h: 0, wall: '#2b2833', roof: '#2b2833', roofType: 'pyramid' });
      // The lift: a frame on the edge, ropes down to a platform and a ship.
      const fx = 17, fz = 26;
      v.box(fx, C + 1, fz - 3, fx + 1, C + 7, fz - 2, '#5b4a3a'); v.box(fx + 6, C + 1, fz - 3, fx + 7, C + 7, fz - 2, '#5b4a3a');
      for (let x = fx; x <= fx + 6; x++) v.set(x, C + 7, fz - 2, '#5b4a3a');
      for (let y = 3; y < C + 7; y++) { v.set(fx + 1, y, fz - 1, '#8a7a5c'); v.set(fx + 5, y, fz - 1, '#8a7a5c'); }
      v.box(fx, 2, fz - 1, fx + 7, 3, fz + 3, '#6b4a2e');
      boat(v, fx - 1, 0, fz + 7, { length: 9, sail: '#6d6776', axis: 'x' });
      // Cages hanging from the cliff, and crows.
      for (const x of [8, 31, 36]) {
        let z = 0; while (z < N - 1 && v.groundY(x, z + 1) === C) z++;
        for (let y = 8; y <= C; y++) v.set(x, y, z + 1, '#4a4450');
        v.box(x - 1, 5, z + 1, x + 2, 8, z + 3, '#5b5560');
        v.set(x, 6, z + 2, '#8a8075');
      }
      for (const [x, y, z] of [[10, 18, 29], [12, 20, 31], [28, 19, 30], [33, 22, 28], [6, 17, 27]]) { v.set(x, y, z, '#15131a'); v.set(x - 1, y + 1, z, '#15131a'); v.set(x + 1, y + 1, z, '#15131a'); }
      // Fog banks rolling over the water and through the town.
      for (const [x, y, z, rx, ry, rz] of [[8, 6, 38, 7, 3, 5], [34, 5, 42, 8, 3, 4], [44, 8, 30, 4, 3, 6], [26, C + 5, 8, 6, 2.5, 4], [6, C + 6, 22, 4, 2, 3]]) v.puff(x, y, z, rx, ry, rz);
      for (let i = 0; i < 5; i++) person(v, 9 + i * 6, C, 20 + (i % 2), '#4a4450', { skin: '#cbb7a5' });
    },
  },

  // -------------------------------------------------------------------------
  ikeheim: {
    sky: ['#a6d8ec', '#f9f4e6'],
    build(v) {
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => (x < 8 + noise(x, z, 6, 22) * 5 ? -3 : 2 + Math.floor(noise(x, z, 12, 23) * 2)),
        top: (x, z) => {
          if (x > 28 && z > 24) return Math.floor((x + z) / 3) % 2 ? '#e2c55a' : '#c9b04a';
          if (x > 30 && z < 18) return Math.floor(z / 2) % 2 ? '#7ba64a' : '#94bd5c';
          return pick(GRASS, x, z);
        },
        side: dirt,
        bed,
      });
      const stone = (x, y, z) => (hash(x, y, z) > 0.5 ? '#c3c6cc' : '#b4b8bf');
      const y0 = 3;
      for (const [x0, z0, x1, z1] of [[12, 10, 28, 11], [12, 27, 28, 28], [12, 10, 13, 28], [27, 10, 28, 28]]) v.box(x0, y0, z0, x1, y0 + 4, z1, stone);
      for (const [x, z] of [[11, 9], [26, 9], [11, 26], [26, 26]]) {
        v.box(x, y0, z, x + 3, y0 + 7, z + 3, stone);
        house(v, x, y0 + 7, z, { w: 3, d: 3, h: 0, wall: stone, roof: '#4b5d8a', roofType: 'pyramid' });
      }
      v.box(18, y0, 27, 22, y0 + 3, 28, '#4a3a2c');
      house(v, 16, y0, 14, { w: 7, d: 6, h: 6, wall: '#d8d2c6', roof: '#4b5d8a', trim: '#8a6440' });
      house(v, 14, y0, 21, { w: 4, d: 4, h: 3, wall: '#efe5d2', roof: '#b8584a' });
      house(v, 22, y0, 21, { w: 4, d: 4, h: 3, wall: '#efe5d2', roof: '#b8584a' });
      flag(v, 19, y0 + 11, 16, '#4b5d8a', { height: 4 });
      // Red barns among the fields, as on the regional map.
      for (const [x, z] of [[34, 30], [38, 8]]) {
        const y = v.groundY(x, z) + 1;
        house(v, x, y, z, { w: 6, d: 5, h: 4, wall: '#a83c3c', roof: '#5a4a3e', trim: '#f2ecdf', door: '#f2ecdf' });
      }
      for (const [x, z] of [[40, 40], [32, 20], [44, 22], [10, 40], [24, 40]]) if (v.inside(x, z)) tree(v, x, v.groundY(x, z), z);
      v.box(9, 1, 18, 13, 2, 21, '#8a6440');
      boat(v, 2, 0, 22, { length: 6, axis: 'z', sail: '#4b5d8a' });
      for (let i = 0; i < 5; i++) person(v, 30 + i * 2, v.groundY(30 + i * 2, 36), 36, SHIRTS[i % 7], { hat: '#d9bf6a' });
    },
  },

  // -------------------------------------------------------------------------
  sortland: {
    sky: ['#8794a3', '#d8dde0'],
    sun: { color: '#e8ecf0', intensity: 1.5, position: [-40, 70, 30] },
    hemi: 1.15,
    fog: ['#c3c9cf', 100, 210],
    targetY: 8,
    distance: 100,
    build(v) {
      const riverX = (z) => 24 + Math.sin(z / 6) * 4;
      const isRiver = (x, z) => Math.abs(x - riverX(z)) < 1.8;
      v.ground({
        waterLevel: null,
        heightAt: (x, z) => {
          const up = Math.max(0, 44 - z) * 0.33;
          if (isRiver(x, z)) return 1 + Math.floor(up * 0.85);
          return 2 + Math.floor(up + Math.abs(x - riverX(z)) * 0.32 * (0.6 + noise(x, z, 6, 24)) + noise(x, z, 4, 25) * 3);
        },
        top: (x, z, h) => (h > 17 ? '#5a5862' : h > 11 ? '#46444d' : pick(['#5d7a4a', '#4f6b40'], x, z)),
        side: (x, z, y) => (hash(x, y, z) > 0.5 ? '#3b3942' : '#46444d'),
      });
      // The river darkens the higher up it goes.
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        if (!isRiver(x, z) || !v.inside(x, z)) continue;
        const t = Math.min(1, z / 44);
        const c = [[0x10, 0x0d, 0x16], [0x4a, 0xa6, 0xc9]].reduce((a, b) => a.map((ai, i) => Math.round(ai + (b[i] - ai) * t)));
        v.set(x, v.groundY(x, z), z, '#' + c.map((n) => n.toString(16).padStart(2, '0')).join(''));
      }
      for (let i = 0; i < 22; i++) {
        const x = Math.floor(hash(i, 1, 26) * N), z = 26 + Math.floor(hash(i, 2, 26) * 22);
        if (v.inside(x, z) && Math.abs(x - riverX(z)) > 3) pine(v, x, v.groundY(x, z), z, { leaf: '#24402f', height: 6 });
      }
      v.mistColour = '#d5dade';
      for (const [x, z, rx, rz] of [[10, 8, 7, 4], [36, 6, 7, 4], [24, 16, 5, 3]]) v.puff(x, v.groundY(x, z) + 5, z, rx, 3, rz);
    },
  },

  // -------------------------------------------------------------------------
  skinder: {
    sky: ['#9fd3ee', '#fbf0dc'],
    targetY: 5,
    distance: 100,
    build(v) {
      // The channel runs toward the camera, between two walls of obsidian.
      const mid = (z) => 25 + Math.sin(z / 9) * 2;
      const channel = (x, z) => Math.abs(x - mid(z)) < 8;
      const obsidian = (x, y, z) => (hash(x, y, z) > 0.55 ? '#2b2833' : hash(x, y, z) > 0.2 ? '#35313e' : '#4a4456');
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => (channel(x, z) ? -3 : x < 25 ? 15 : 11),
        top: (x, z) => (x < 25 ? pick(['#bcc66c', '#c7cf78'], x, z) : pick(['#efd28c', '#e6c77f'], x, z)),
        side: (x, z, y, h) => (y > h - 2 ? '#7a6a4a' : obsidian(x, y, z)),
        bed: () => '#3c8fae',
      });
      v.waterColour = '#3aa3cc';
      // Toll towers on both cliffs and a chain boom across the water.
      const tower = (x, z, y) => {
        v.box(x, y, z, x + 4, y + 9, z + 4, '#c3c6cc');
        for (let i = 0; i < 4; i += 2) { v.set(x, y + 9, z + i, '#c3c6cc'); v.set(x + 3, y + 9, z + i, '#c3c6cc'); }
        v.light(x + 1, y + 6, z + 3, '#ffd27a'); v.light(x + 3, y + 6, z + 1, '#ffd27a');
        flag(v, x + 2, y + 9, z + 2, '#9a3b3b', { height: 4 });
      };
      tower(12, 20, 16); tower(34, 20, 12);
      for (let x = 16; x < 34; x++) v.set(x, 1, 22, x % 2 ? '#5b5560' : '#7a7480');
      // Spice ships queueing at the toll.
      const spice = ['#e07b39', '#c9473d', '#d9a23a', '#a84a2a'];
      boat(v, 23, -1, 28, { length: 11, sail: '#f4ecdc', axis: 'z' });
      for (let i = 0; i < 6; i++) v.set(22 + (i % 3), 1, 30 + i, spice[i % 4]);
      boat(v, 27, -1, 4, { length: 9, sail: '#c9473d', axis: 'z' });
      for (let i = 0; i < 4; i++) v.set(26 + (i % 3), 1, 6 + i, spice[(i + 1) % 4]);
      boat(v, 20, -1, 17, { length: 5, mast: false, hull: '#4f6d8f', axis: 'z' });
      person(v, 20, 0, 19, '#9a3b3b', { hat: '#c3c6cc' });
      for (const [x, z] of [[4, 8], [6, 30], [10, 40]]) if (v.inside(x, z)) tree(v, x, v.groundY(x, z), z);
      for (const [x, z] of [[40, 34], [44, 14]]) if (v.inside(x, z)) palm(v, x, v.groundY(x, z), z);
    },
  },

  // -------------------------------------------------------------------------
  'siris-gap': {
    sky: ['#97a9b8', '#e3e7e9'],
    sun: { color: '#eef2f6', intensity: 1.6, position: [-40, 70, 30] },
    hemi: 1.2,
    fog: ['#cfd6dc', 100, 210],
    build(v) {
      const obsidian = (x, y, z) => (hash(x, y, z) > 0.55 ? '#2b2833' : '#3a3644');
      v.ground({
        waterLevel: 0,
        heightAt: (x, z) => {
          if (z < 6 + noise(x, z, 4, 29) * 3) return 13;
          const isle = Math.hypot(x - 28, z - 26);
          if (isle < 6 + noise(x, z, 3, 30) * 2) return 3 + Math.floor((6 - isle) * 0.6);
          return -2 - Math.floor(noise(x, z, 8, 31) * 3);
        },
        top: (x, z, h) => (h >= 13 ? '#4d5248' : hash(x, z, 3) > 0.5 ? '#6b6775' : '#5a5664'),
        side: (x, z, y) => obsidian(x, y, z),
        bed: () => '#3d6f80',
      });
      v.waterColour = '#4b8ea6';
      v.mistColour = '#eef1f4';
      const lx = 28, lz = 26, ly = v.groundY(lx, lz) + 1;
      for (let y = ly; y < ly + 12; y++) v.box(lx - 1, y, lz - 1, lx + 2, y + 1, lz + 2, (y - ly) % 4 < 2 ? '#e8e4dc' : '#a8433a');
      v.box(lx - 1, ly + 12, lz - 1, lx + 2, ly + 14, lz + 2, '#ffd98a');
      v.light(lx, ly + 13, lz + 1, '#fff1b8'); v.light(lx + 1, ly + 13, lz, '#fff1b8');
      house(v, lx - 1, ly + 14, lz - 1, { w: 3, d: 3, h: 0, wall: '#2b2833', roof: '#2b2833', roofType: 'pyramid' });
      boat(v, 10, 0, 36, { length: 8, sail: '#6d6776' });
      for (const [x, y, z, rx, ry, rz] of [[12, 6, 18, 8, 3, 5], [40, 5, 38, 7, 3, 6], [38, 8, 12, 6, 3, 4], [20, 5, 44, 6, 2.5, 3]]) v.puff(x, y, z, rx, ry, rz);
      for (const [x, y, z] of [[22, 14, 22], [36, 16, 32]]) { v.set(x, y, z, '#15131a'); v.set(x - 1, y + 1, z, '#15131a'); v.set(x + 1, y + 1, z, '#15131a'); }
    },
  },

  // ---------------------------------------------------------------------------
};

// Lama and Rama are shown as views of the real world map instead.
export const WORLD_VIEWS = {
  lama: { px: [380, 450], distance: 150 },
  rama: { px: [800, 480], distance: 200 },
};

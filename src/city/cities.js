// City maps that can be opened from the world map. A location in
// world/locations.js opens one by setting `cityMap` to its key here.
import { buildRazz } from './razz.js';

export const CITIES = {
  razz: {
    name: 'Razz of Mataz',
    build: buildRazz,
    sky: '#f3dcc0',
    sun: { color: '#ffe2b8', intensity: 2.5, position: [-60, 100, 40] },
  },
};

// Renders one location postcard: /tools/postcards/?id=razz
// Used by tools/postcards/capture.mjs to save the images in public/art/.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createTiltShiftPasses } from '../../src/fx/tiltShift.js';
import { Vox } from '../../src/city/vox.js';
import { SCENES, WORLD_VIEWS } from './scenes.js';

const W = 1200, H = 750;
const id = new URLSearchParams(location.search).get('id') || 'razz';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 1, 2000);

function skyTexture([top, bottom]) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function build() {
  if (WORLD_VIEWS[id]) {
    // A view of the real world map, for the continents.
    const { grid, pixelToCell, cellToWorld } = await import('../../src/world/grid.js');
    const { buildTerrain } = await import('../../src/world/terrain.js');
    const { buildPlants, buildClouds } = await import('../../src/world/scatter.js');
    scene.add(buildTerrain(), buildPlants(() => false), buildClouds());
    scene.background = new THREE.Color('#cfe9f0');
    const [x, z] = cellToWorld(...pixelToCell(WORLD_VIEWS[id].px));
    const target = new THREE.Vector3(x, 0, z);
    camera.position.copy(target).add(new THREE.Vector3(0, 0.8, 0.62).normalize().multiplyScalar(WORLD_VIEWS[id].distance));
    camera.lookAt(target);
    lights({ position: [-70, 110, 50] }, 1.5, grid.cols * 0.7);
    return;
  }
  const def = SCENES[id];
  const v = new Vox(48);
  def.build(v);
  v.render(scene);
  scene.background = skyTexture(def.sky);
  if (def.fog) scene.fog = new THREE.Fog(...def.fog);
  const target = new THREE.Vector3(0, def.targetY ?? 6, 0);
  camera.position.copy(target).add(new THREE.Vector3(0.78, 0.72, 1).normalize().multiplyScalar(def.distance ?? 90));
  camera.lookAt(target);
  lights(def.sun ?? {}, def.hemi ?? 1.5, 40);
}

function lights({ color = '#fff0d4', intensity = 2.4, position = [-45, 70, 35] }, hemi, extent) {
  scene.add(new THREE.HemisphereLight('#fff7e8', '#8d7c62', hemi));
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.set(...position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 400 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
}

await build();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const tilt = createTiltShiftPasses();
tilt.passes.forEach((p) => {
  p.uniforms.amount.value = 1.8;
  p.uniforms.band.value = 0.2;
  composer.addPass(p);
});
composer.addPass(new OutputPass());
composer.setSize(W, H);
tilt.setSize(W, H);
composer.render();
window.__ready = true;

// Tilt-shift blur: sharp band through the middle of the screen, blurring
// toward the top and bottom. This is what gives the "toy diorama" look of
// Link's Awakening (Switch). Two passes, horizontal then vertical.
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    direction: { value: [1, 0] },
    texel: { value: [1 / 1024, 1 / 1024] },
    focus: { value: 0.5 },      // screen height (0 bottom, 1 top) that is sharp
    band: { value: 0.16 },      // half-height of the fully sharp band
    amount: { value: 2.4 },     // blur strength in pixels at the edges
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 direction, texel;
    uniform float focus, band, amount;
    varying vec2 vUv;
    void main() {
      float d = max(abs(vUv.y - focus) - band, 0.0);
      float r = amount * smoothstep(0.0, 0.35, d);
      vec2 step = direction * texel * r;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
      sum += texture2D(tDiffuse, vUv + step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv - step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv + step * 3.2307692308) * 0.0702702703;
      sum += texture2D(tDiffuse, vUv - step * 3.2307692308) * 0.0702702703;
      gl_FragColor = sum;
    }
  `,
};

export function createTiltShiftPasses() {
  const h = new ShaderPass(TiltShiftShader);
  const v = new ShaderPass(TiltShiftShader);
  v.uniforms.direction.value = [0, 1];
  return {
    passes: [h, v],
    setSize(w, hgt) {
      for (const p of [h, v]) p.uniforms.texel.value = [1 / w, 1 / hgt];
    },
    set enabled(on) { h.enabled = v.enabled = on; },
    get enabled() { return h.enabled; },
  };
}

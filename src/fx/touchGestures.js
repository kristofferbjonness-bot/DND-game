import * as THREE from 'three';

// Two-finger gestures for phones, working like a maps app:
//   twist        → the map turns with your fingers
//   pinch        → zoom
//   slide up/down → tilt
// One-finger panning is left to MapControls (its two-finger handling is switched off).
export function attachTouchGestures(element, getView, onStart) {
  let last = null;
  let twisted = 0; // how far the fingers have turned this gesture
  let rotating = false;
  const offset = new THREE.Vector3();
  const sph = new THREE.Spherical();

  // Uses the browser's own list of fingers on the screen, so a lost "finger up"
  // can never leave the gesture stuck.
  const measure = (touches) => {
    const [a, b] = touches;
    return {
      angle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
      dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
      midY: (a.clientY + b.clientY) / 2,
    };
  };
  const reset = (e) => {
    last = e.touches.length === 2 ? measure(e.touches) : null;
    twisted = 0;
    rotating = false;
  };

  element.addEventListener('touchstart', (e) => {
    reset(e);
    if (last) onStart();
  }, { passive: true });
  element.addEventListener('touchend', reset, { passive: true });
  element.addEventListener('touchcancel', reset, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !last) return;
    const now = measure(e.touches);
    let dAngle = now.angle - last.angle;
    if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
    if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
    // Like a maps app, small twists while pinching are ignored; once the fingers
    // have clearly turned (about 10°), the map follows them.
    twisted += dAngle;
    if (!rotating && Math.abs(twisted) > 0.17) { rotating = true; dAngle = twisted; }
    if (!rotating) dAngle = 0;

    const { camera, controls } = getView();
    offset.subVectors(camera.position, controls.target);
    sph.setFromVector3(offset);
    sph.theta += dAngle;
    sph.radius = THREE.MathUtils.clamp(sph.radius * (last.dist / now.dist), controls.minDistance, controls.maxDistance);
    sph.phi = THREE.MathUtils.clamp(sph.phi - (now.midY - last.midY) * 0.006, controls.minPolarAngle, controls.maxPolarAngle);
    offset.setFromSpherical(sph);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    last = now;
  }, { passive: true });
}

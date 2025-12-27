// src/utils/motion.js
// Robust motion/orientation listener for iOS Safari + other browsers.
// IMPORTANT: iOS requires requestPermission() to be called from a user gesture (tap).

export async function requestMotionPermission() {
  // iOS 13+ requires explicit permission for motion/orientation
  try {
    const DME = window.DeviceMotionEvent;
    const DOE = window.DeviceOrientationEvent;

    const needsMotion = DME && typeof DME.requestPermission === "function";
    const needsOrientation = DOE && typeof DOE.requestPermission === "function";

    // If neither requires permission, we're good.
    if (!needsMotion && !needsOrientation) return true;

    // Request whichever is available/required. Some iOS versions gate one or both.
    let ok = true;

    if (needsMotion) {
      const res = await DME.requestPermission();
      ok = ok && res === "granted";
    }

    if (needsOrientation) {
      const res = await DOE.requestPermission();
      ok = ok && res === "granted";
    }

    return ok;
  } catch (e) {
    // If the call throws, treat as not granted.
    return false;
  }
}

/**
 * Starts listening for tilt gestures.
 * Calls onDown() when user tilts DOWN (Correct).
 * Calls onUp() when user tilts UP (Pass).
 *
 * Returns a stop() function.
 */
export function startTiltListener({
  onDown,
  onUp,
  enabled = true,
  cooldownMs = 900,
  downThreshold = 18,
  upThreshold = -18,
}) {
  if (!enabled) return () => {};

  let lastFire = 0;

  // Use deviceorientation beta (front/back tilt). Works well for "forehead" orientation.
  const handler = (e) => {
    const now = Date.now();
    if (now - lastFire < cooldownMs) return;

    const beta = typeof e.beta === "number" ? e.beta : null; // -180..180
    if (beta === null) return;

    // When phone is held to forehead, beta movement tends to be stable enough for thresholds.
    if (beta >= downThreshold) {
      lastFire = now;
      onDown?.();
    } else if (beta <= upThreshold) {
      lastFire = now;
      onUp?.();
    }
  };

  window.addEventListener("deviceorientation", handler, { passive: true });

  return () => {
    window.removeEventListener("deviceorientation", handler);
  };
}

// src/utils/motion.js
export async function requestMotionPermission() {
  try {
    const DME = window.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === "function") {
      const res = await DME.requestPermission();
      return res === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Uses deviceorientation beta (pitch). Calibrates baseline at start.
 * Requires returning to neutral before firing again + cooldown.
 */
export function startTiltListener({
  onCorrect,
  onPass,
  correctDelta = 26,
  passDelta = 26,
  deadZone = 14,
  cooldownMs = 900
} = {}) {
  let baseline = null;
  let armed = true;
  let lastFire = 0;

  function inNeutral(delta) {
    return Math.abs(delta) <= deadZone;
  }

  function handleOrientation(e) {
    const beta = typeof e.beta === "number" ? e.beta : null;
    if (beta == null) return;

    if (baseline === null) {
      baseline = beta; // calibrate on first reading after enable
      return;
    }

    const now = Date.now();
    if (now - lastFire < cooldownMs) return;

    const delta = beta - baseline;

    // Must return to neutral before next trigger
    if (!armed) {
      if (inNeutral(delta)) armed = true;
      return;
    }

    // Down tilt -> Correct (delta positive on most iPhones in portrait)
    if (delta >= correctDelta) {
      armed = false;
      lastFire = now;
      onCorrect?.();
      return;
    }

    // Up tilt -> Pass
    if (delta <= -passDelta) {
      armed = false;
      lastFire = now;
      onPass?.();
      return;
    }
  }

  window.addEventListener("deviceorientation", handleOrientation, true);

  return () => {
    window.removeEventListener("deviceorientation", handleOrientation, true);
  };
}

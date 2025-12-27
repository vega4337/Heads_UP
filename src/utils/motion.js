// src/utils/motion.js
// Robust tilt detection for iOS Safari in both portrait + landscape.
//
// Actions emitted:
// - "correct" (tilt DOWN / forward)
// - "pass" (tilt UP / backward)
//
// Uses a deadzone + hysteresis so it's not ultra-sensitive.

const DEFAULTS = {
  thresholdDeg: 26,     // higher = less sensitive
  neutralDeg: 10,       // must return near neutral to "re-arm"
  minIntervalMs: 650,   // debounce between actions
  smoothing: 0.22,      // EMA smoothing (0..1), higher = less smoothing
};

export async function requestMotionPermission() {
  // iOS Safari requires permission request from a user gesture.
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const res = await DeviceOrientationEvent.requestPermission();
      return res === "granted";
    }
    // Other browsers: no permission prompt needed
    return true;
  } catch {
    return false;
  }
}

function getScreenAngle() {
  // Normalize to {0,90,180,270}
  const raw =
    (screen?.orientation?.angle ??
      window.orientation ??
      0);

  const a = ((raw % 360) + 360) % 360;
  if (a === 90 || a === 180 || a === 270) return a;
  return 0;
}

function computePitchDeg(beta, gamma) {
  // beta: front-back tilt in portrait
  // gamma: left-right tilt in portrait
  //
  // When rotating to landscape, the "forward/back" axis roughly maps to gamma.
  // We also flip sign depending on which landscape direction.
  const angle = getScreenAngle();
  const isLandscape = angle === 90 || angle === 270;

  if (!isLandscape) {
    // Portrait: beta is pitch (front/back)
    return beta ?? 0;
  }

  // Landscape:
  // angle 90 vs 270 flips sign for what "forward" means.
  const g = gamma ?? 0;
  if (angle === 90) return -g;
  return g; // angle 270
}

export function startTiltListener(onAction, options = {}) {
  const cfg = { ...DEFAULTS, ...options };

  let enabled = true;
  let armed = true;
  let lastActionAt = 0;

  // Exponential moving average to reduce jitter
  let emaPitch = 0;
  let emaInit = false;

  function handle(e) {
    if (!enabled) return;

    const beta = typeof e.beta === "number" ? e.beta : 0;
    const gamma = typeof e.gamma === "number" ? e.gamma : 0;

    const pitch = computePitchDeg(beta, gamma);

    if (!emaInit) {
      emaPitch = pitch;
      emaInit = true;
    } else {
      emaPitch = emaPitch + cfg.smoothing * (pitch - emaPitch);
    }

    const now = Date.now();

    // Re-arm once back in neutral zone
    if (!armed) {
      if (Math.abs(emaPitch) <= cfg.neutralDeg) {
        armed = true;
      }
      return;
    }

    // Debounce
    if (now - lastActionAt < cfg.minIntervalMs) return;

    // Decide action
    if (emaPitch >= cfg.thresholdDeg) {
      // Tilt DOWN/forward
      armed = false;
      lastActionAt = now;
      onAction("correct");
      return;
    }

    if (emaPitch <= -cfg.thresholdDeg) {
      // Tilt UP/backward
      armed = false;
      lastActionAt = now;
      onAction("pass");
      return;
    }
  }

  window.addEventListener("deviceorientation", handle, true);

  return function stop() {
    enabled = false;
    window.removeEventListener("deviceorientation", handle, true);
  };
}

// src/utils/motion.js

// iOS requires permission for motion/orientation sensors when in Safari / PWA.
export async function requestMotionPermission() {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const res = await DeviceOrientationEvent.requestPermission();
      return res === "granted";
    }
    // Non-iOS or older iOS: no prompt needed
    return true;
  } catch {
    return false;
  }
}

function getScreenAngle() {
  // iOS Safari often supports window.orientation; modern browsers support screen.orientation.angle
  let a =
    (typeof screen !== "undefined" &&
      screen.orientation &&
      typeof screen.orientation.angle === "number" &&
      screen.orientation.angle) ??
    (typeof window !== "undefined" && typeof window.orientation === "number"
      ? window.orientation
      : 0);

  // normalize -90 to 270
  if (a === -90) a = 270;
  // normalize into 0/90/180/270 where possible
  if (a !== 0 && a !== 90 && a !== 180 && a !== 270) a = 0;
  return a;
}

function pickAxis(beta, gamma, angle) {
  // Goal: produce a "forward/back" axis that stays consistent across rotation.
  // Portrait (0): beta is forward/back
  // Portrait upside down (180): invert beta
  // Landscape (90): gamma behaves like forward/back
  // Landscape (270): invert gamma
  switch (angle) {
    case 0:
      return beta;
    case 180:
      return -beta;
    case 90:
      return gamma;
    case 270:
      return -gamma;
    default:
      return beta;
  }
}

function clampNumber(n) {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Start listening for tilt actions.
 *
 * onAction(direction) => direction is "down" or "up"
 * onReady() => called once after baseline calibration
 *
 * Options:
 *  thresholdDeg: how far from baseline to count a tilt (larger = less sensitive)
 *  neutralDeg: how close to baseline to "re-arm" after a tilt
 *  cooldownMs: minimum time between actions
 *  smoothing: 0..1 (higher = smoother, less jitter)
 *  invert: flips up/down interpretation (rarely needed, but available)
 */
export function startTiltListener({
  onAction,
  onReady,
  thresholdDeg = 28,
  neutralDeg = 12,
  cooldownMs = 700,
  smoothing = 0.35,
  invert = false,
} = {}) {
  let baseline = null;
  let lastActionAt = 0;
  let waitingForNeutral = false;

  // simple low-pass filter on delta
  let smoothedDelta = 0;

  function handler(e) {
    const beta = clampNumber(e.beta);
    const gamma = clampNumber(e.gamma);
    if (beta == null || gamma == null) return;

    const angle = getScreenAngle();
    const axis = pickAxis(beta, gamma, angle);

    // Calibrate baseline on first good sample after starting
    if (baseline == null) {
      baseline = axis;
      smoothedDelta = 0;
      waitingForNeutral = true; // require neutral once baseline is set
      if (typeof onReady === "function") onReady();
      return;
    }

    const rawDelta = axis - baseline;

    // smooth jitter
    smoothedDelta = smoothedDelta * (1 - smoothing) + rawDelta * smoothing;

    const now = Date.now();

    // Must return close to baseline before another action counts
    if (waitingForNeutral) {
      if (Math.abs(smoothedDelta) <= neutralDeg) {
        waitingForNeutral = false;
      }
      return;
    }

    if (now - lastActionAt < cooldownMs) return;

    // Apply invert if requested
    const d = invert ? -smoothedDelta : smoothedDelta;

    // Direction: positive = "down", negative = "up"
    if (d >= thresholdDeg) {
      lastActionAt = now;
      waitingForNeutral = true;
      onAction?.("down");
      return;
    }
    if (d <= -thresholdDeg) {
      lastActionAt = now;
      waitingForNeutral = true;
      onAction?.("up");
      return;
    }
  }

  window.addEventListener("deviceorientation", handler, true);

  return {
    stop() {
      window.removeEventListener("deviceorientation", handler, true);
    },
  };
}

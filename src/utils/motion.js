// src/utils/motion.js

export async function requestMotionPermission() {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const res = await DeviceOrientationEvent.requestPermission();
      return res === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

function validNum(n) {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Calibrates tilt based on the user's actual device + how they hold it.
 *
 * It chooses the axis (beta vs gamma) with the largest delta from baseline,
 * and records which SIGN corresponds to "tilt down".
 *
 * onCalibrated({ axis: "beta"|"gamma", downSign: 1|-1 })
 *
 * Returns { stop() }
 */
export function startTiltCalibration({
  thresholdDeg = 28,
  neutralDeg = 14,
  cooldownMs = 700,
  smoothing = 0.35,
  onStatus,
  onCalibrated,
} = {}) {
  let baseBeta = null;
  let baseGamma = null;

  let smBeta = 0;
  let smGamma = 0;

  let lastActionAt = 0;
  let waitingForNeutral = true; // after baseline set, require neutral before accepting a tilt

  function handler(e) {
    const beta = validNum(e.beta);
    const gamma = validNum(e.gamma);
    if (beta == null || gamma == null) return;

    // Baseline on first good sample
    if (baseBeta == null || baseGamma == null) {
      baseBeta = beta;
      baseGamma = gamma;
      smBeta = 0;
      smGamma = 0;
      waitingForNeutral = true;
      onStatus?.("Calibrating… hold steady, then tilt DOWN once.");
      return;
    }

    const dBeta = beta - baseBeta;
    const dGamma = gamma - baseGamma;

    // smooth
    smBeta = smBeta * (1 - smoothing) + dBeta * smoothing;
    smGamma = smGamma * (1 - smoothing) + dGamma * smoothing;

    // must return to neutral before any action
    if (waitingForNeutral) {
      if (Math.abs(smBeta) <= neutralDeg && Math.abs(smGamma) <= neutralDeg) {
        waitingForNeutral = false;
        onStatus?.("Ready. Tilt DOWN once to calibrate.");
      }
      return;
    }

    const now = Date.now();
    if (now - lastActionAt < cooldownMs) return;

    // Determine dominant axis (the one actually changing)
    const absB = Math.abs(smBeta);
    const absG = Math.abs(smGamma);
    const axis = absB >= absG ? "beta" : "gamma";
    const delta = axis === "beta" ? smBeta : smGamma;

    if (Math.abs(delta) < thresholdDeg) return;

    // We treat the FIRST strong tilt the user does as "DOWN" per instruction.
    const downSign = delta >= 0 ? 1 : -1;

    lastActionAt = now;
    waitingForNeutral = true;

    onCalibrated?.({ axis, downSign });

    // stop after calibration
    window.removeEventListener("deviceorientation", handler, true);
  }

  window.addEventListener("deviceorientation", handler, true);
  onStatus?.("Waiting for sensor…");

  return {
    stop() {
      window.removeEventListener("deviceorientation", handler, true);
    },
  };
}

/**
 * Starts tilt listener using a calibrated axis/sign.
 *
 * onAction("down"|"up")
 *
 * Returns { stop() }
 */
export function startTiltListener({
  axis = "beta", // "beta" | "gamma"
  downSign = 1, // 1 means +delta = DOWN, -delta = UP. -1 means opposite
  thresholdDeg = 28,
  neutralDeg = 14,
  cooldownMs = 700,
  smoothing = 0.35,
  onAction,
  onStatus,
} = {}) {
  let baseline = null;
  let smDelta = 0;
  let lastActionAt = 0;
  let waitingForNeutral = true;

  function handler(e) {
    const beta = validNum(e.beta);
    const gamma = validNum(e.gamma);
    if (beta == null || gamma == null) return;

    const raw = axis === "gamma" ? gamma : beta;

    if (baseline == null) {
      baseline = raw;
      smDelta = 0;
      waitingForNeutral = true;
      onStatus?.("Tilt enabled. Return to neutral, then tilt.");
      return;
    }

    const delta = raw - baseline;
    smDelta = smDelta * (1 - smoothing) + delta * smoothing;

    // must return to neutral before another action
    if (waitingForNeutral) {
      if (Math.abs(smDelta) <= neutralDeg) waitingForNeutral = false;
      return;
    }

    const now = Date.now();
    if (now - lastActionAt < cooldownMs) return;

    // apply calibrated sign
    const d = smDelta * downSign;

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

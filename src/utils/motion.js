// iOS Safari requires an explicit permission request for motion/orientation in many cases.
export async function requestMotionPermissionIfNeeded() {
  const DeviceOrientationEventRef = window.DeviceOrientationEvent;

  // Older browsers: no permission API.
  if (!DeviceOrientationEventRef || !DeviceOrientationEventRef.requestPermission) return true;

  try {
    const res = await DeviceOrientationEventRef.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

/**
 * Tilt detector for "Heads Up" play:
 * - Calibrate baseline beta at start.
 * - If beta increases beyond threshold => "down" (Correct)
 * - If beta decreases beyond threshold => "up" (Pass)
 */
export function createTiltDetector({
  onDown,
  onUp,
  thresholdDeg = 35,
  cooldownMs = 900
}) {
  let baselineBeta = null;
  let lastFire = 0;

  const handler = (e) => {
    const now = Date.now();
    if (now - lastFire < cooldownMs) return;

    // beta: front-to-back tilt in degrees (-180..180)
    const beta = typeof e.beta === "number" ? e.beta : null;
    if (beta === null) return;

    if (baselineBeta === null) {
      baselineBeta = beta;
      return;
    }

    const delta = beta - baselineBeta;

    if (delta > thresholdDeg) {
      lastFire = now;
      onDown?.();
      return;
    }

    if (delta < -thresholdDeg) {
      lastFire = now;
      onUp?.();
      return;
    }
  };

  return {
    start() {
      baselineBeta = null; // re-calibrate on start
      window.addEventListener("deviceorientation", handler, true);
    },
    stop() {
      window.removeEventListener("deviceorientation", handler, true);
    }
  };
}

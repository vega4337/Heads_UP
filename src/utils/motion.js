// src/utils/motion.js

export async function requestMotionPermission() {
  // iOS Safari requires a user gesture to request permission
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    const res = await DeviceOrientationEvent.requestPermission();
    return res; // "granted" | "denied"
  }
  // Android / desktop typically don't require explicit permission
  return "granted";
}

export function getScreenAngle() {
  // Prefer modern Screen Orientation API
  if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === "number") {
    return window.screen.orientation.angle; // 0, 90, 180, 270
  }

  // Fallback (older iOS)
  const w = window.orientation;
  if (typeof w === "number") {
    // can be 0, 90, -90, 180
    return ((w % 360) + 360) % 360;
  }

  return 0;
}

/**
 * Convert DeviceOrientationEvent (beta/gamma) into a single "pitch" value
 * that represents tilting "up vs down" relative to the CURRENT screen orientation.
 *
 * - In portrait (0): pitch ~= beta
 * - In landscape (90): pitch ~= -gamma
 * - In portrait upside-down (180): pitch ~= -beta
 * - In landscape other side (270): pitch ~= gamma
 */
export function toPitch(beta, gamma, angle) {
  // beta: front/back tilt (range ~[-180,180])
  // gamma: left/right tilt (range ~[-90,90])

  if (typeof beta !== "number" || typeof gamma !== "number") return 0;

  switch (angle) {
    case 0:
      return beta;
    case 180:
      return -beta;
    case 90:
      return -gamma;
    case 270:
      return gamma;
    default:
      return beta;
  }
}

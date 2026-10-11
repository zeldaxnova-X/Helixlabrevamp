/**
 * Phones: tilting the device moves the camera a little (the same parallax the
 * mouse gives on desktop). iOS only delivers orientation after the visitor
 * grants it from a tap, so the gate's buttons call this.
 */
export async function requestTilt() {
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    try {
      await D.requestPermission();
    } catch {}
  }
}

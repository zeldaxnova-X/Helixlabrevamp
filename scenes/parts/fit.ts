import * as THREE from 'three';

/**
 * Normalise a model: returns the scale and offset that centre it (or one named
 * node of it) and make its bounding *radius* equal `radius`.
 */
export function fit(root: THREE.Object3D, radius: number, nodeName?: string) {
  root.updateMatrixWorld(true);
  const target = nodeName ? root.getObjectByName(nodeName) ?? root : root;
  const box = new THREE.Box3().setFromObject(target);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const scale = radius / Math.max(1e-6, sphere.radius);
  return { scale, offset: sphere.center.clone().multiplyScalar(-1).toArray() as [number, number, number] };
}

/**
 * Robust variant for models with stray far vertices (antenna booms, debris):
 * centre on the vertex centroid and size by the 85th-percentile distance.
 */
export function fitRobust(root: THREE.Object3D, radius: number) {
  root.updateMatrixWorld(true);
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const pos = m.isMesh ? (m.geometry.attributes.position as THREE.BufferAttribute) : null;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
  });
  if (!pts.length) return fit(root, radius);
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
  const d = pts.map((p) => p.distanceTo(c)).sort((a, b) => a - b);
  const r = d[Math.floor(d.length * 0.85)] ?? 1;
  return { scale: radius / Math.max(1e-6, r), offset: c.multiplyScalar(-1).toArray() as [number, number, number] };
}

/**
 * For a ball (planet, moon, star): centre it and make its true radius `radius`.
 * Uses half the box's largest side, which is the radius of a sphere; the box's own
 * bounding sphere would be √3 too large and leave the ball ~0.58 of its size.
 */
export function fitBall(target: THREE.Object3D, radius: number) {
  target.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(target);
  const size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) / 2;
  return { scale: radius / Math.max(1e-6, r), offset: box.getCenter(new THREE.Vector3()).multiplyScalar(-1).toArray() as [number, number, number] };
}

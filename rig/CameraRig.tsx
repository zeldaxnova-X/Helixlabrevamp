'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { beatAt } from './beats';
import { sampleCamera, type CameraSample } from './cameraPath';
import { readExperience } from '@/store/useExperience';

/**
 * The only thing in the app that moves the camera.
 *
 * Reads the scroll clock, samples the authored spline, then follows it with a
 * critically-damped lag so moves feel like they have mass. Mouse parallax is
 * added in camera space, scaled per-beat. Beats never touch the camera — they
 * only provide keyframes in rig/beats.ts.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  // portrait framing state (smoothed): where the subject sits, and how much to lift it
  const subject = useRef(0);
  const lift = useRef(0);
  const sample = useRef<CameraSample>({ pos: [0, 0, 0], look: [0, 0, 0], fov: 40, roll: 0 });
  const roll = useRef(0);
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const mouse = useRef(new THREE.Vector2());
  const mouseSmoothed = useRef(new THREE.Vector2());
  const parallax = useRef(0.3);
  const first = useRef(true);
  const tmp = useRef({ right: new THREE.Vector3(), up: new THREE.Vector3(), target: new THREE.Vector3() });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const { progress, reducedMotion } = readExperience();
    const s = sampleCamera(progress, sample.current);
    const beat = beatAt(progress);

    if (first.current) {
      pos.current.fromArray(s.pos);
      look.current.fromArray(s.look);
      first.current = false;
    }

    // Lag: k≈5 gives ~200ms of weight on top of Lenis' own smoothing.
    const k = 1 - Math.exp(-dt * 5);
    tmp.current.target.fromArray(s.pos);
    if (pos.current.distanceTo(tmp.current.target) > 8000) {
      pos.current.copy(tmp.current.target);
      look.current.fromArray(s.look);
    }
    pos.current.lerp(tmp.current.target.fromArray(s.pos), k);
    look.current.lerp(tmp.current.target.fromArray(s.look), k);

    parallax.current += ((reducedMotion ? 0 : beat.parallax ?? 0.2) - parallax.current) * k;
    mouseSmoothed.current.lerp(mouse.current, 1 - Math.exp(-dt * 2.5));

    camera.position.copy(pos.current);
    camera.lookAt(look.current);
    camera.updateMatrixWorld();
    // Parallax in camera space (right / up), so it reads the same from any heading.
    const { right, up } = tmp.current;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(right, mouseSmoothed.current.x * parallax.current);
    camera.position.addScaledVector(up, -mouseSmoothed.current.y * parallax.current * 0.6);
    camera.lookAt(look.current);
    // bank (used to line the galaxy up with the flight footage)
    roll.current += (s.roll - roll.current) * k;
    if (Math.abs(roll.current) > 1e-4) camera.rotateZ(roll.current);

    let dirty = false;
    // Portrait (phones): desktop frames put the subject right of a text panel. A
    // portrait frame is too narrow for that, so widen a little, bring the subject to
    // the centre and lift it into the upper part of the screen, above the text.
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 0.95;
    const fovTarget = portrait ? s.fov * Math.min(1.55, 1 + (1 / aspect - 1) * 0.45) : s.fov;
    if (Math.abs(camera.fov - fovTarget) > 0.01) {
      camera.fov += (fovTarget - camera.fov) * k;
      dirty = true;
    }
    subject.current += ((portrait ? beat.subjectAngle ?? 0 : 0) - subject.current) * k;
    lift.current += ((portrait && beat.subjectAngle !== undefined ? 1 : 0) - lift.current) * k;
    if (portrait) {
      const W = size.width;
      const H = size.height;
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect);
      const x = (Math.tan(THREE.MathUtils.degToRad(subject.current)) / Math.tan(half)) * (W / 2);
      const y = lift.current * H * 0.18;
      const v = camera.view;
      if (!v || !v.enabled || Math.abs(v.offsetX - x) > 0.5 || Math.abs(v.offsetY - y) > 0.5 || v.fullWidth !== W || v.fullHeight !== H) {
        camera.setViewOffset(W, H, x, y, W, H);
      }
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
    // near plane ~1% of the distance to what we're looking at: tight enough for
    // close-ups, loose enough that Earth's clouds never z-fight its surface
    const near = Math.min(1.5, Math.max(0.004, camera.position.distanceTo(look.current) * 0.01));
    if (Math.abs(near - camera.near) > camera.near * 0.05) {
      camera.near = near;
      dirty = true;
    }
    if (dirty) camera.updateProjectionMatrix();
  });

  return null;
}

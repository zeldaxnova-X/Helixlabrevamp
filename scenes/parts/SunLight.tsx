'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WORLD, local, smooth } from '@/rig/beats';
import { readExperience } from '@/store/useExperience';

/**
 * One Sun for the whole journey. Its direction is a function of progress:
 *  - origin:   from the upper-left front, so the hero Earth is ¾ lit with city
 *              lights along the right-hand night side
 *  - voyage:   a cool key from above-left for Voyager and the dust
 *  - home:     the real direction from the Sun station to Earth, so Saturn, the
 *              Moon, the satellite and Earth are all lit by the Sun you just saw
 */

// from the upper-left, slightly behind: Earth is ¾ lit with city lights on the right
const HERO = new THREE.Vector3(-0.92, 0.3, 0.12).normalize();
const DEEP = new THREE.Vector3(-0.5, 0.65, 0.55).normalize();
const SUN = new THREE.Vector3(...WORLD.sun);
const HOME = SUN.clone().sub(new THREE.Vector3(...WORLD.earthB)).normalize();
const dir = new THREE.Vector3();
const toSun = new THREE.Vector3();
let camPos: THREE.Vector3 | null = null;

export function sunDirection(p = readExperience().progress) {
  const a = smooth(local(p, 0.3, 0.4));
  dir.copy(HERO).lerp(DEEP, a);
  // in the solar system (after the flight footage) light comes from the real Sun,
  // as seen from wherever the camera is: Saturn, the Moon and Earth all agree
  if (p > 0.555 && camPos) {
    toSun.copy(SUN).sub(camPos).normalize();
    if (camPos.distanceTo(SUN) < 40) toSun.copy(HOME);
    dir.lerp(toSun, smooth(local(p, 0.555, 0.565)));
  }
  return dir.normalize();
}

export function SunLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const { gl, scene } = useThree();

  // A dim neutral environment: metals and solar panels need something to reflect.
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.28;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useFrame((s) => {
    const l = light.current;
    if (!l) return;
    camPos = s.camera.position;
    const d = sunDirection();
    // keep the light parked relative to the camera so it covers whatever station we're at
    l.target.position.copy(s.camera.position);
    l.position.copy(s.camera.position).addScaledVector(d, 100);
    l.target.updateMatrixWorld();
  });

  return (
    <>
      <directionalLight ref={light} intensity={3.2} color="#fff4e6" />
      <ambientLight intensity={0.035} color="#8fa8ff" />
    </>
  );
}

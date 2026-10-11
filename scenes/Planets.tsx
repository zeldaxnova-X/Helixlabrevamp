'use client';

import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { WORLD } from '@/rig/beats';
import { dotTexture } from '@/rig/gpu';
import { useModel, type ModelKey } from '@/rig/models';
import { Callout, byDistance } from './parts/Callout';

/**
 * The planets we pass on the way in from the edge of the solar system. Ring particles were baked from
 * the original models into point clouds (tools/build-planets.mjs), like Saturn's.
 */

const v3 = (a: readonly number[]) => a as unknown as [number, number, number];

interface Rings {
  url: string;
  /** Overall brightness of the ring particles. */
  alpha: number;
}

/** Baked ring particles: full strength within ~6 planet radii, gone by ~11. */
function useRingCloud(rings: Rings | undefined, radius: number) {
  const [data, setData] = useState<{ geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial } | null>(null);
  useEffect(() => {
    if (!rings) return;
    let dead = false;
    let made: { geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial } | null = null;
    fetch(rings.url)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (dead) return;
        const dv = new DataView(buf);
        const n = dv.getUint32(0, true);
        const min = [dv.getFloat32(4, true), dv.getFloat32(8, true), dv.getFloat32(12, true)];
        const max = [dv.getFloat32(16, true), dv.getFloat32(20, true), dv.getFloat32(24, true)];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Uint16Array(buf, 28, n * 3), 3, true));
        geo.setAttribute('aCol', new THREE.BufferAttribute(new Uint8Array(buf, 28 + n * 6, n * 3), 3, true));
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uMin: { value: new THREE.Vector3(...min) },
            uSize: { value: new THREE.Vector3(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!) },
            uDot: { value: dotTexture() },
            uPixel: { value: 1 },
            uR: { value: radius },
            uAlpha: { value: rings.alpha },
          },
          vertexShader: /* glsl */ `
            attribute vec3 aCol; uniform vec3 uMin; uniform vec3 uSize; uniform float uPixel; uniform float uR; uniform float uAlpha;
            varying vec3 vC; varying float vA;
            void main(){
              vec3 p = uMin + position * uSize;
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              vC = aCol;
              float d = -mv.z;
              vA = uAlpha * clamp((11.0 * uR - d) / (5.0 * uR), 0.0, 1.0);
              gl_PointSize = clamp(uPixel * 6.5 * uR / d, 1.0, 2.2 * uPixel);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            uniform sampler2D uDot; varying vec3 vC; varying float vA;
            void main(){ gl_FragColor = vec4(vC * vec3(0.95, 0.9, 0.85), texture2D(uDot, gl_PointCoord).a * vA); }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        made = { geo, mat };
        setData(made);
      })
      .catch(() => {});
    return () => {
      dead = true;
      made?.geo.dispose();
      made?.mat.dispose();
    };
  }, [rings, radius]);
  return data;
}

interface PlanetProps {
  model: ModelKey;
  /** Material name of the planet sphere: sizes the planet by its body, not its rings or moons. */
  body: string;
  radius: number;
  position: readonly number[];
  /** Axial tilt, as Euler angles. */
  tilt: [number, number, number];
  spin?: number;
  rings?: Rings;
  /** Brightness of the solid ring meshes: the real rings of Jupiter, Uranus and Neptune are faint and dark. */
  ringMeshes?: { names: string[]; dim: number };
  /** A pinned label: name and distance from the Sun. */
  callout?: { title: string; line: string };
}

function Planet({ model, body, radius, position, tilt, spin = 0.02, rings, ringMeshes, callout }: PlanetProps) {
  const { scene, animations } = useModel(model);
  const { actions } = useAnimations(animations, scene);
  const { scale, offset } = useMemo(() => {
    let planet: THREE.Object3D | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m?.name === body) planet = o;
    });
    planet?.updateWorldMatrix(true, false);
    const s = new THREE.Box3().setFromObject(planet ?? scene).getBoundingSphere(new THREE.Sphere());
    return { scale: radius / s.radius, offset: s.center.multiplyScalar(-1).toArray() as [number, number, number] };
  }, [scene, body, radius]);
  useEffect(() => {
    // planets are matte: the studio reflections would make them look like plastic
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (!m || !('envMapIntensity' in m)) return;
      m.envMapIntensity = 0.12;
      if ('clearcoat' in m) m.clearcoat = 0;
      if (ringMeshes?.names.includes(m.name)) {
        // materials are shared between clones: scale from the authored values, never compound
        m.userData.base ??= { c: m.color.clone(), o: m.opacity };
        m.color.copy(m.userData.base.c).multiplyScalar(ringMeshes.dim);
        m.opacity = m.userData.base.o * ringMeshes.dim;
        m.envMapIntensity = 0;
      }
    });
  }, [scene, ringMeshes]);
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.play());
  }, [actions]);
  // the shader works in view space (world units), so the fade uses the world radius
  const ring = useRingCloud(rings, radius);
  const ref = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (ref.current) ref.current.rotation.y += dt * spin;
  });
  const tag = useMemo(() => [position[0]! + radius * 0.8, position[1]! + radius * 0.85, position[2]!] as const, [position, radius]);
  const show = useMemo(() => byDistance(30 * radius, 16 * radius), [radius]);
  return (
    <>
      <group position={v3(position)} rotation={tilt}>
        <group ref={ref} scale={scale}>
          <primitive object={scene} position={offset} />
          {ring && <points geometry={ring.geo} material={ring.mat} position={offset} frustumCulled={false} />}
        </group>
      </group>
      {callout && <Callout at={tag} title={callout.title} line={callout.line} visible={show} />}
    </>
  );
}

const NEPTUNE_RINGS = { url: '/assets/models/neptune-rings.bin', alpha: 0.03 };
const URANUS_RINGS = { url: '/assets/models/uranus-rings.bin', alpha: 0.035 };
const JUPITER_RINGS = { url: '/assets/models/jupiter-rings.bin', alpha: 0.004 };
const NEPTUNE_RING_MESH = { names: ['neptune2_B'], dim: 0.3 };
const URANUS_RING_MESH = { names: ['uranus2_B'], dim: 0.22 };
const JUPITER_RING_MESH = { names: ['jupiter2_B'], dim: 0.12 };

// Jupiter's real rings are almost invisible, hence the very low alpha.
// axial tilts: Neptune 28°, Uranus 98° (it rolls on its side), Jupiter 3°, Mars 25°
export function Neptune() {
  return <Planet model="neptune" body="neptune1_A" radius={WORLD.neptuneRadius} position={WORLD.neptune} tilt={[0.2, 0.4, 0.49]} rings={NEPTUNE_RINGS} ringMeshes={NEPTUNE_RING_MESH} callout={{ title: 'Neptune', line: '4.5 billion km from the Sun' }} />;
}
export function Uranus() {
  return <Planet model="uranus" body="uranus1_A" radius={WORLD.uranusRadius} position={WORLD.uranus} tilt={[0.15, 0.3, 1.71]} spin={0.03} rings={URANUS_RINGS} ringMeshes={URANUS_RING_MESH} callout={{ title: 'Uranus', line: '2.9 billion km from the Sun' }} />;
}
export function Jupiter() {
  return <Planet model="jupiter" body="jupiter1_A" radius={WORLD.jupiterRadius} position={WORLD.jupiter} tilt={[0.05, 0.6, 0.05]} spin={0.04} rings={JUPITER_RINGS} ringMeshes={JUPITER_RING_MESH} callout={{ title: 'Jupiter', line: '778 million km from the Sun' }} />;
}
export function Mars() {
  return <Planet model="mars" body="mars" radius={WORLD.marsRadius} position={WORLD.mars} tilt={[0.1, 0.8, 0.44]} spin={0.03} callout={{ title: 'Mars', line: '228 million km from the Sun' }} />;
}

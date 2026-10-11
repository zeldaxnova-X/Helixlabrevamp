'use client';

import { Html, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WORLD, envelope, local, smooth } from '@/rig/beats';
import { dotTexture, useDisposable } from '@/rig/gpu';
import { useModel } from '@/rig/models';
import { readExperience } from '@/store/useExperience';
import { EarthModel } from './parts/EarthModel';
import { fit } from './parts/fit';

/**
 * HOME and THE RULES — Earth, and the four sciences around it.
 * Physics and chemistry live in scenes/Life.tsx. No wireframes or guide lines:
 * every visual is a physical thing.
 */

const E = WORLD.earthB;
const R = WORLD.earthBRadius;
const v3 = (a: readonly number[]) => a as unknown as [number, number, number];

/** Earth in the solar system: a dot from Saturn, home by the end. */
export function EarthB() {
  const mark = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (mark.current) mark.current.style.opacity = String(envelope(readExperience().progress, 0.683, 0.687, 0.698, 0.703));
  });
  return (
    <>
      <group position={v3(E)}>
        <Html center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div ref={mark} className="yah" style={{ opacity: 0 }}>
            <span className="yah__ring yah__ring--blue" />
            <span className="yah__text">Earth</span>
          </div>
        </Html>
      </group>
    <EarthModel
      position={E}
      radius={R}
      rotation={[0.41, 0.9, 0]}
      opacity={() => smooth(local(readExperience().progress, 0.556, 0.575))}
      glow={() => envelope(readExperience().progress, 0.93, 0.94, 0.965, 0.985) * 0.8}
    />
    </>
  );
}

// ───────────────────────── MATHS — the golden angle in a sunflower ─────────────────────────
/**
 * Seeds placed one by one, each turned 137.5° (360°/φ²) from the last, at
 * radius ∝ √n. Scroll grows the head from the centre out; the Fibonacci spirals
 * appear by themselves — no lines drawn, just seeds.
 */
export function Sunflower() {
  const N = 1400;
  const ref = useRef<THREE.Points>(null);
  const geo = useDisposable(() => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pos = new Float32Array(N * 3);
    const idx = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(i / N) * 1.55;
      const a = i * golden;
      // a very gentle dome, like a real seed head
      pos.set([Math.cos(a) * r, Math.sin(a) * r, -0.08 * r * r], i * 3);
      idx[i] = i / N;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aI', new THREE.BufferAttribute(idx, 1));
    return g;
  }, []);
  const mat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uDot: { value: dotTexture() }, uGrow: { value: 0 }, uPixel: { value: 1 }, uOpacity: { value: 0 }, uF34: { value: 0 }, uF55: { value: 0 }, uN: { value: N } },
        vertexShader: /* glsl */ `
          attribute float aI; uniform float uGrow; uniform float uPixel; uniform float uOpacity;
          uniform float uF34; uniform float uF55; uniform float uN;
          varying vec3 vC; varying float vA;
          void main(){
            float on = smoothstep(aI, aI + 0.03, uGrow);
            vec4 mv = modelViewMatrix * vec4(position * (0.7 + 0.3 * on), 1.0);
            vC = mix(vec3(1.0, 0.86, 0.55), vec3(1.0, 0.62, 0.25), aI);
            // seed n sits on spiral (n mod 34) of one family and (n mod 55) of the other:
            // light every other spiral so the families appear on their own
            float n = floor(aI * uN + 0.5);
            float s34 = mod(mod(n, 34.0), 2.0);
            float s55 = mod(mod(n, 55.0), 2.0);
            vec3 c34 = mix(vec3(0.35, 0.22, 0.1), vec3(1.0, 0.8, 0.45), s34);
            vec3 c55 = mix(vec3(0.12, 0.2, 0.35), vec3(0.65, 0.85, 1.0), s55);
            vC = mix(vC, c34 * 1.2, uF34);
            vC = mix(vC, c55 * 1.2, uF55);
            vA = on * uOpacity;
            gl_PointSize = clamp((1.0 + 1.6 * sqrt(aI)) * uPixel * 22.0 / -mv.z, 1.0, 10.0 * uPixel);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDot; varying vec3 vC; varying float vA;
          void main(){ float a = texture2D(uDot, gl_PointCoord).a; gl_FragColor = vec4(vC * 1.25, smoothstep(0.15, 0.7, a) * vA); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useFrame((s) => {
    const p = readExperience().progress;
    const o = envelope(p, 0.864, 0.882, 0.908, 0.922);
    mat.uniforms.uOpacity!.value = o;
    mat.uniforms.uGrow!.value = Math.min(1.05, smooth(local(p, 0.866, 0.888)) * 1.05);
    // then reveal the 34 clockwise spirals, then the 55 the other way
    mat.uniforms.uF34!.value = smooth(local(p, 0.889, 0.894)) * (1 - smooth(local(p, 0.898, 0.902)));
    mat.uniforms.uF55!.value = smooth(local(p, 0.899, 0.903));
    mat.uniforms.uPixel!.value = s.gl.getPixelRatio();
    if (ref.current) {
      ref.current.visible = o > 0.003;
      ref.current.rotation.z = s.clock.elapsedTime * 0.03;
    }
  });
  return (
    <group position={v3(WORLD.maths)} rotation={[-0.2, 0.3, 0]}>
      <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
    </group>
  );
}

// ───────────────────────── BIOLOGY — the DNA model, in its own colours ─────────────────────────
/**
 * The provided atomic-detail DNA model, with its authored element colours
 * (carbon, nitrogen, oxygen, phosphorus). Only the lighting is ours.
 */
export function Dna() {
  const { scene, animations } = useModel('dna');
  const { actions } = useAnimations(animations, scene);
  const { scale, offset } = useMemo(() => fit(scene, 2.6), [scene]);
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.play());
  }, [actions]);
  useMemo(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'roughness' in m) {
        m.roughness = 0.35;
        m.metalness = 0.05;
        m.envMapIntensity = 1.4;
      }
    });
  }, [scene]);
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const p = readExperience().progress;
    const o = envelope(p, 0.898, 0.916, 0.937, 0.948);
    const g = ref.current;
    if (!g) return;
    g.visible = o > 0.003;
    g.scale.setScalar(0.85 + 0.15 * o);
    g.rotation.y = s.clock.elapsedTime * 0.18;
  });
  return (
    <group position={v3(WORLD.dna)} rotation={[0.1, 0, 0.35]}>
      <group ref={ref}>
        <group scale={scale}>
          <primitive object={scene} position={offset} />
        </group>
      </group>
      <pointLight position={[2, 2, 4]} intensity={60} distance={14} decay={2} color="#ffffff" />
      <pointLight position={[-3, -1, -2]} intensity={25} distance={14} decay={2} color="#7cc4ff" />
    </group>
  );
}

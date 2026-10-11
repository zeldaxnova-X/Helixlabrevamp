'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { NOISE } from './shaders/noise';
import { local } from '@/rig/beats';
import { dotTexture, useDisposable } from '@/rig/gpu';
import { readExperience, useExperience } from '@/store/useExperience';

/**
 * THE BIG BANG — the signature moment.
 *
 * Three layers, all scrubbed by scroll (so it's reversible and never "missed"):
 *  1. Core     — a blinding point that swells to fill the frame in ~0.5% of
 *                scroll; pushed far past 1.0 so bloom turns it into pure light.
 *  2. Burst    — 60–160k particles. Radial expansion with an exponential
 *                ease-out, a bright shock front, and an fbm displacement field
 *                that grows over time so the cloud curdles into filaments —
 *                the first hint of the cosmic web. Colour is a cooling curve:
 *                white-hot → gold → ember → newborn violet-blue matter.
 *  3. Shockwave — screen-space ring distortion + chromatic split, in
 *                scenes/Effects.tsx (it reads the same progress).
 *
 * The camera rig flies *into* the expanding cloud, so matter streams past.
 */

import { BANG_START, BANG_END, BURST_START } from '@/rig/beats';
export { BANG_START, BANG_END };

export default function BigBang() {
  const tier = useExperience((s) => s.tier);
  const count = tier === 'high' ? 160000 : tier === 'mid' ? 100000 : 60000;
  const core = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Sprite>(null);

  const geo = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    const dir = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const seed = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.randomDirection();
      dir.set([v.x, v.y, v.z], i * 3);
      // Mostly a thick shell, some interior fill, a sprinkle of fast outliers.
      const r = Math.random();
      spd[i] = r < 0.55 ? 0.75 + Math.random() * 0.25 : r < 0.97 ? 0.35 + Math.pow(Math.random(), 0.7) * 0.5 : 1.0 + Math.random() * 0.6; // nothing lingers at the centre
      seed[i] = Math.random();
    }
    // position is unused by the shader but three needs it for bounds/draw count
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const mat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          ${NOISE}
          attribute vec3 aDir; attribute float aSpeed; attribute float aSeed;
          uniform float uT; uniform float uTime; uniform float uPixel; uniform float uRadius;
          varying vec3 vC; varying float vA;

          vec3 heat(float k){
            // k: 1 = white-hot, 0 = cooled matter
            vec3 white = vec3(1.0, 0.97, 0.9);
            vec3 gold  = vec3(1.0, 0.72, 0.28);
            vec3 ember = vec3(0.95, 0.28, 0.1);
            vec3 cool  = vec3(0.42, 0.5, 1.0);
            vec3 violet= vec3(0.62, 0.42, 1.0);
            vec3 c = mix(ember, gold, smoothstep(0.35, 0.6, k));
            c = mix(c, white, smoothstep(0.7, 0.95, k));
            vec3 matter = mix(cool, violet, step(0.6, aSeed));
            return mix(matter, c, smoothstep(0.12, 0.36, k));
          }

          void main(){
            float t = uT;
            // ease-out expansion: violent first, then a slow drift
            float E = (1.0 - exp(-5.5*t)) / (1.0 - exp(-5.5)) + t*0.12;
            float d = aSpeed * E * uRadius;

            // filaments: displacement field that grows with time and distance
            vec3 q = aDir * 2.3 + aSeed * 0.15;
            vec3 disp = vec3(snoise(q + 1.7), snoise(q + 9.2), snoise(q + 4.1));
            float web = smoothstep(0.05, 0.6, t);
            vec3 p = aDir * d + disp * d * 0.28 * web;
            // a slow living swirl once it has cooled
            p += vec3(snoise(p*0.05 + uTime*0.05), snoise(p*0.05 + 3.0 + uTime*0.05), snoise(p*0.05+7.0)) * web * 1.2;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float depth = max(-mv.z, 0.05);

            float k = clamp(1.0 - t*2.3 + (aSpeed - 0.8)*0.35, 0.0, 1.0);
            vC = heat(k);
            float hot = 1.0 + 7.0 * pow(k, 2.0);
            // shock front glows
            float front = smoothstep(0.88, 1.0, aSpeed) * (1.0 - smoothstep(0.0, 0.35, t));
            vC *= hot + front * 6.0;
            // flicker of newborn stars
            vC *= 0.85 + 0.3 * step(0.985, fract(aSeed * 91.7 + floor(uTime*3.0)*0.013));

            vA = smoothstep(0.0, 0.006, t) * smoothstep(0.2, 2.5, depth) * (1.0 - smoothstep(0.55, 0.95, t));
            // Fill-rate guard: while everything is bunched at the centre the core
            // sprite carries the light, so keep points tiny until they spread out.
            float spread = smoothstep(0.0, 0.035, t);
            float size = mix(0.09, 0.32, k) * (0.5 + aSeed*0.9) * spread;
            gl_PointSize = vA < 0.01 ? 0.0 : clamp(size * uPixel * 420.0 / depth, 0.0, 12.0 * uPixel);
            // big near-camera motes would read as blobs: dim them as they swell
            vA *= 1.0 - smoothstep(7.0*uPixel, 12.0*uPixel, gl_PointSize) * 0.6;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDot; varying vec3 vC; varying float vA;
          void main(){
            float a = texture2D(uDot, gl_PointCoord).a;
            gl_FragColor = vec4(vC, a * vA);
          }`,
        uniforms: {
          uT: { value: 0 },
          uTime: { value: 0 },
          uPixel: { value: 1 },
          uRadius: { value: 70 },
          uDot: { value: dotTexture() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  const coreMat = useDisposable(
    () =>
      new THREE.SpriteMaterial({
        map: dotTexture(),
        color: new THREE.Color(1, 0.93, 0.8),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );
  const haloMat = useDisposable(
    () =>
      new THREE.SpriteMaterial({
        map: dotTexture(),
        color: new THREE.Color(1, 0.6, 0.25),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useFrame((s) => {
    const p = readExperience().progress;
    const t = local(p, BURST_START, BANG_END);
    mat.uniforms.uT!.value = t;
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
    mat.uniforms.uPixel!.value = s.gl.getPixelRatio();

    // Core: instant swell → long decay. Values ≫1 so bloom saturates to white.
    const ignite = local(p, BANG_START - 0.0008, BANG_START + 0.002);
    // the core is the flash itself: gone within the first instants, nothing left at the centre
    const decay = Math.exp(-local(p, BURST_START + 0.001, BURST_START + 0.011) * 7);
    const k = ignite * decay;
    if (core.current) {
      core.current.visible = k > 0.01;
      core.current.scale.setScalar(k * 9.4);
      coreMat.color.setRGB(1, 0.93, 0.8).multiplyScalar(1 + k * 10);
    }
    if (halo.current) {
      const h = ignite * Math.exp(-local(p, BURST_START, BURST_START + 0.02) * 6);
      halo.current.visible = h > 0.01;
      halo.current.scale.setScalar(4 + h * 30);
      haloMat.opacity = h * 0.55;
      haloMat.color.setRGB(1, 0.6, 0.25).multiplyScalar(1 + h * 6);
    }
  });

  return (
    <group>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
      <sprite ref={halo} material={haloMat} renderOrder={6} />
      <sprite ref={core} material={coreMat} renderOrder={7} />
    </group>
  );
}

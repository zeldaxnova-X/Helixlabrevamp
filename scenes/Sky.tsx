'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { local, smooth } from '@/rig/beats';
import { dotTexture, useDisposable, useSharedTexture, useTexTier } from '@/rig/gpu';
import { readExperience, useExperience } from '@/store/useExperience';

/**
 * Persistent sky — the only scenes that never unmount, because they are the
 * "world" the camera is always inside:
 *
 *  Starfield  instanced points on a shell that travels with the camera (so it's
 *             infinitely far), with temperature colours and twinkle.
 *  Dust       a near-field box of motes wrapped around the camera — gives motion
 *             parallax and streaks when you scroll fast.
 */

const starOpacity = (p: number) =>
  Math.min(1, Math.max(0, 1 - smooth(local(p, 0.115, 0.15)) + smooth(local(p, 0.27, 0.31))));

export function Starfield() {
  const tier = useExperience((s) => s.tier);
  const count = tier === 'high' ? 9000 : 5000;
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  const geo = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([r * Math.cos(th) * 900, u * 900, r * Math.sin(th) * 900], i * 3);
      // Mostly white-blue, some warm, a few bright.
      const t = Math.random();
      c.setHSL(t < 0.7 ? 0.6 + Math.random() * 0.05 : 0.08 + Math.random() * 0.05, t < 0.7 ? 0.35 : 0.6, 0.75 + Math.random() * 0.25);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = Math.pow(Math.random(), 7) * 5 + 0.7;
      phase[i] = Math.random() * 100;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    return g;
  }, [count]);

  const mat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aSize; attribute float aPhase; varying vec3 vC; varying float vA;
          uniform float uTime; uniform float uPixel; uniform float uOpacity;
          void main(){
            vC = color;
            float tw = 0.75 + 0.25*sin(uTime*(0.6+fract(aPhase)*1.7) + aPhase);
            vA = tw * uOpacity;
            vec4 mv = modelViewMatrix*vec4(position,1.0);
            gl_PointSize = aSize * uPixel * (0.85 + 0.3*tw);
            gl_Position = projectionMatrix*mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDot; varying vec3 vC; varying float vA;
          void main(){ float a = texture2D(uDot, gl_PointCoord).a; gl_FragColor = vec4(vC*1.4, a*vA); }`,
        uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uOpacity: { value: 1 }, uDot: { value: dotTexture() } },
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useFrame((s) => {
    const p = readExperience().progress;
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
    mat.uniforms.uPixel!.value = s.gl.getPixelRatio();
    mat.uniforms.uOpacity!.value = starOpacity(p);
    group.current?.position.copy(camera.position);
    if (group.current) group.current.visible = starOpacity(p) > 0.002;
  });

  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-10} />
    </group>
  );
}

export function Dust() {
  const tier = useExperience((s) => s.tier);
  const count = tier === 'high' ? 2600 : 1200;
  const L = 60;
  const geo = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = Math.random() * L;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  const mat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          uniform vec3 uCam; uniform float uL; uniform float uPixel; uniform float uSpeed; uniform float uOpacity;
          varying float vA;
          void main(){
            vec3 p = mod(position - uCam, uL) - uL*0.5 + uCam;   // wrap the box around the camera
            vec4 mv = viewMatrix * vec4(p,1.0);
            float d = -mv.z;
            vA = smoothstep(uL*0.5, uL*0.2, d) * smoothstep(0.5, 3.0, d) * uOpacity;
            gl_PointSize = clamp((1.4 + uSpeed*6.0) * uPixel * 18.0 / d, 0.0, 24.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDot; varying float vA;
          void main(){ gl_FragColor = vec4(vec3(0.75,0.82,1.0), texture2D(uDot, gl_PointCoord).a * vA * 0.55); }`,
        uniforms: { uCam: { value: new THREE.Vector3() }, uL: { value: L }, uPixel: { value: 1 }, uSpeed: { value: 0 }, uOpacity: { value: 1 }, uDot: { value: dotTexture() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const speed = useRef(0);
  useFrame((s, dt) => {
    const { progress, velocity } = readExperience();
    speed.current += (Math.min(1, Math.abs(velocity) * 8) - speed.current) * (1 - Math.exp(-dt * 4));
    mat.uniforms.uCam!.value.copy(s.camera.position);
    mat.uniforms.uPixel!.value = s.gl.getPixelRatio();
    mat.uniforms.uSpeed!.value = speed.current;
    // Dust belongs to the "material" universe: absent in the void and the bang flash.
    // motes only in deep space (motion parallax); in close-ups they read as grit
    mat.uniforms.uOpacity!.value = starOpacity(progress) * (progress > 0.236 && progress < 0.29 ? 0.3 : 1) * (1 - smooth(local(progress, 0.528, 0.542)));
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/**
 * The real sky: the provided 8K Milky Way star map on an inverted sphere that
 * travels with the camera. It gives every frame of the voyage a true Milky Way
 * band behind it; the procedural starfield above adds twinkle and parallax.
 * Faded out for "almost nothing" and the Big Bang, back once space exists.
 */
const DEFAULT_SKY = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 2.4, 0.42));

const skyOpacity = (p: number) =>
  Math.min(1, Math.max(0, 0.75 * (1 - smooth(local(p, 0.11, 0.145))) + smooth(local(p, 0.285, 0.34))));

export function SkyDome() {
  const tier = useTexTier();
  const map = useSharedTexture(`/assets/textures/milkyway-sky-${tier}.webp`);
  const camera = useThree((s) => s.camera);
  const ref = useRef<THREE.Mesh>(null);
  const geo = useDisposable(() => new THREE.SphereGeometry(4000, 64, 32), []);
  const mat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: map }, uOpacity: { value: 0 }, uExposure: { value: 1.35 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uOpacity; uniform float uExposure; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(uMap, vec2(1.0 - vUv.x, vUv.y)).rgb;
            c = pow(c, vec3(1.15)) * uExposure;              // deepen blacks, lift the band
            gl_FragColor = vec4(c * uOpacity, 1.0);
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [map],
  );
  useFrame(() => {
    const p = readExperience().progress;
    const o = skyOpacity(p);
    mat.uniforms.uOpacity!.value = o;
    const m = ref.current;
    if (!m) return;
    m.visible = o > 0.003;
    m.position.copy(camera.position);
    m.quaternion.copy(DEFAULT_SKY);
  });
  // tilt the band so it crosses the frame diagonally behind Earth
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={-20} frustumCulled={false} />;
}

'use client';

import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { BlendFunction, Effect, EffectAttribute, ToneMappingMode, type BloomEffect } from 'postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { local } from '@/rig/beats';
import { readExperience, useExperience } from '@/store/useExperience';
import { BANG_START, BURST_START } from '@/rig/beats';

/**
 * Cinema, with restraint: bloom on emissive things only (threshold), a custom
 * effect for the Big Bang shockwave and speed-linked edge aberration, ACES
 * tone mapping, a soft vignette and faint film grain.
 */

const fragment = /* glsl */ `
uniform vec2 uCenter; uniform float uRing; uniform float uStrength; uniform float uCA; uniform float uAspect; uniform float uFlash;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 d = uv - uCenter; d.x *= uAspect;
  float r = length(d);
  vec2 dir = r > 1e-4 ? d / r : vec2(0.0);
  dir.x /= uAspect;
  // shockwave: a refracting ring rolling outward from the bang's screen position
  float w = (r - uRing) / 0.055;
  float ring = exp(-w*w) * uStrength;
  vec2 suv = uv - dir * ring * 0.045;
  // chromatic split: at the ring, and at the screen edges during fast moves
  vec2 e = uv - 0.5;
  vec2 ca = e * (uCA * dot(e,e) * 0.05) + dir * ring * 0.01;
  vec3 col = vec3(texture2D(inputBuffer, suv + ca).r, texture2D(inputBuffer, suv).g, texture2D(inputBuffer, suv - ca).b);
  col += vec3(1.0, 0.82, 0.55) * ring * 0.5;
  col += vec3(1.0, 0.95, 0.86) * uFlash * 6.0;
  outputColor = vec4(col, inputColor.a);
}`;

class BangEffect extends Effect {
  constructor() {
    super('BangEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['uCenter', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ['uRing', new THREE.Uniform(0)],
        ['uStrength', new THREE.Uniform(0)],
        ['uCA', new THREE.Uniform(0)],
        ['uAspect', new THREE.Uniform(1)],
        ['uFlash', new THREE.Uniform(0)],
      ]),
    });
  }
}

const ORIGIN = new THREE.Vector3();

export function Effects() {
  const tier = useExperience((s) => s.tier);
  const bang = useMemo(() => new BangEffect(), []);
  const bloom = useRef<BloomEffect>(null);
  const ca = useRef(0);
  const ndc = useMemo(() => new THREE.Vector3(), []);

  useFrame((s, dt) => {
    const { progress: p, velocity } = readExperience();
    const u = bang.uniforms;
    ndc.copy(ORIGIN).project(s.camera);
    u.get('uCenter')!.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
    u.get('uAspect')!.value = s.size.width / s.size.height;

    // Shockwave: rolls from the centre to past the corners over ~2.5% of scroll.
    const sw = local(p, BURST_START + 0.0005, BURST_START + 0.026);
    u.get('uRing')!.value = Math.pow(sw, 0.7) * 1.6;
    u.get('uStrength')!.value = sw > 0 && sw < 1 ? (1 - sw) * 1.2 : 0;
    // Flash: a white-out that holds, then clears as the burst of matter emerges from it.
    const fl = local(p, BANG_START - 0.0006, BANG_START + 0.0008) * Math.pow(1 - local(p, BURST_START, BURST_START + 0.0065), 2);
    u.get('uFlash')!.value = fl;

    const target = Math.min(1.4, Math.abs(velocity) * 9);
    ca.current += (target - ca.current) * (1 - Math.exp(-dt * 4));
    u.get('uCA')!.value = ca.current;

    if (bloom.current) {
      const spike = Math.exp(-Math.max(0, p - BURST_START) * 160) * (p > BANG_START - 0.001 ? 1 : 0);
      bloom.current.intensity = 0.9 + spike * 2.2;
    }
  });

  return (
    // MSAA on capable GPUs: without it planet limbs and cloud edges shimmer as Earth turns
    <EffectComposer multisampling={tier === 'high' ? 4 : 0} enableNormalPass={false}>
      <Bloom ref={bloom} mipmapBlur intensity={0.9} luminanceThreshold={0.62} luminanceSmoothing={0.25} radius={0.78} levels={tier === 'high' ? 8 : 6} />
      <primitive object={bang} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.72} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />
    </EffectComposer>
  );
}

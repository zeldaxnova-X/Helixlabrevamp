'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { local, smooth } from '@/rig/beats';
import { dotTexture, useDisposable } from '@/rig/gpu';
import { readExperience } from '@/store/useExperience';

/**
 * Matter (warm) and antimatter (cold) spiralling together.
 *
 * Orbit radius is a function of scroll; orbital phase is integrated over time
 * with Kepler-ish speed (faster as they close in) so the pair is alive while
 * idle. In the last stretch of the collision beat angular speed drops to zero —
 * the frozen moment before contact. Trails are *analytic*: sampled from the
 * same function of (progress, phase) the bodies follow, so they look right
 * whether you scroll fast, slow or not at all.
 */

const TRAIL = 140;

/** Separation from the barycentre at global progress p. */
function radius(p: number) {
  const a = smooth(local(p, 0.15, 0.205)); // matter beat: approach
  const b = smooth(local(p, 0.205, 0.226)); // collision beat: final spiral
  return 5.2 * (1 - a) + 1.0 * a - 0.78 * b; // freezes 0.22 apart: almost touching
}

/** Visible presence: fades in from nothing, gone the instant of the bang. */
const presence = (p: number) => smooth(local(p, 0.157, 0.178)) * (1 - smooth(local(p, 0.234, 0.2375)));

export default function MatterAntimatter() {
  const phase = useRef(0);
  const bodies = useRef<THREE.Group>(null);

  const geo = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    const n = (TRAIL + 1) * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const k = new Float32Array(n);
    const side = new Float32Array(n);
    for (let s = 0; s < 2; s++)
      for (let i = 0; i <= TRAIL; i++) {
        k[s * (TRAIL + 1) + i] = i / TRAIL; // 0 = head, 1 = tail end
        side[s * (TRAIL + 1) + i] = s;
      }
    g.setAttribute('aK', new THREE.BufferAttribute(k, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    return g;
  }, []);

  const mat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aK; attribute float aSide; uniform float uPixel; uniform float uOpacity;
          varying float vA; varying vec3 vC;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            float head = 1.0 - aK;
            vA = pow(head, 1.6) * uOpacity;
            vC = mix(vec3(1.0,0.7,0.32), vec3(0.45,0.7,1.0), aSide) * (1.0 + 3.0*pow(head, 8.0));
            gl_PointSize = (2.0 + 26.0*pow(head, 3.0)) * uPixel * 6.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDot; varying float vA; varying vec3 vC;
          void main(){ gl_FragColor = vec4(vC*2.2, texture2D(uDot, gl_PointCoord).a * vA); }`,
        uniforms: { uPixel: { value: 1 }, uOpacity: { value: 0 }, uDot: { value: dotTexture() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  const glow = useDisposable(() => {
    const mats = [new THREE.Color(1.0, 0.72, 0.35), new THREE.Color(0.5, 0.72, 1.0)].map(
      (c) =>
        new THREE.SpriteMaterial({
          map: dotTexture(),
          color: c.multiplyScalar(4),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
    );
    return { mats, dispose: () => mats.forEach((m) => m.dispose()) };
  }, []);

  useFrame((s, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const { progress: p } = readExperience();
    const r = radius(p);
    // Kepler-ish: ω ∝ r^-1.5, then frozen in the stillness window before contact.
    const freeze = 1 - smooth(local(p, 0.224, 0.229));
    phase.current += dt * 0.55 * Math.pow(Math.max(r, 0.12), -1.5) * freeze;

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i <= TRAIL; i++) {
        // walk back along scroll-time *and* phase to draw the spiral the body came from
        const back = i / TRAIL;
        const pp = p - back * 0.03;
        const rr = radius(pp);
        const th = phase.current - back * (3.2 + 2.0 / Math.max(rr, 0.3)) + side * Math.PI;
        const o = (side * (TRAIL + 1) + i) * 3;
        arr[o] = Math.cos(th) * rr;
        arr[o + 1] = Math.sin(th * 1.0) * rr * 0.18;
        arr[o + 2] = Math.sin(th) * rr;
      }
    }
    pos.needsUpdate = true;

    const o = presence(p);
    mat.uniforms.uOpacity!.value = o;
    mat.uniforms.uPixel!.value = s.gl.getPixelRatio();
    const g = bodies.current;
    if (g) {
      g.visible = o > 0.002;
      for (let side = 0; side < 2; side++) {
        const sp = g.children[side] as THREE.Sprite;
        const off = side * (TRAIL + 1) * 3;
        sp.position.set(arr[off]!, arr[off + 1]!, arr[off + 2]!);
        // brighten as they close; a faint tremor in the frozen moment
        const close = 1 - Math.min(1, r / 5);
        sp.scale.setScalar((0.9 - close * 0.55) * (1 + (1 - freeze) * 0.06 * Math.sin(s.clock.elapsedTime * 40)));
        (sp.material as THREE.SpriteMaterial).opacity = o;
      }
    }
  });

  return (
    <group rotation={[0.35, 0, -0.12]}>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <group ref={bodies}>
        <sprite material={glow.mats[0]} />
        <sprite material={glow.mats[1]} />
      </group>
    </group>
  );
}

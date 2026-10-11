'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WORLD, envelope } from '@/rig/beats';
import { dotTexture, useDisposable } from '@/rig/gpu';
import { readExperience } from '@/store/useExperience';

/**
 * Physics and chemistry stops of the rules chapter: the parts of the world
 * that keep life going, drawn as physically as possible.
 */

const v3 = (a: readonly number[]) => a as unknown as [number, number, number];
const E = new THREE.Vector3(...WORLD.earthB);
const RE = WORLD.earthBRadius;
/** Direction from Earth to the Sun (the solar wind blows the other way). */
const SUN = new THREE.Vector3(...WORLD.sun).sub(E).normalize();

// ───────────────────────── PHYSICS — the magnetosphere ─────────────────────────
/**
 * Earth's magnetic field and the solar wind, as moving particles (no drawn lines).
 *
 *  Field: charged particles drift along dipole field lines, r = L·R·sin²θ for
 *  L = 2…9 Earth radii, about an axis tilted ~11° from the spin axis. The Sun
 *  side is squashed (to ~10 R at the nose), the night side stretched into a
 *  long tail, as spacecraft have measured.
 *  Wind: particles stream away from the Sun and are turned aside around the
 *  magnetopause instead of reaching the atmosphere.
 */
export function Magnetosphere() {
  const group = useRef<THREE.Group>(null);
  const FIELD = 14000;
  const WIND = 7000;

  // frame: x toward the Sun, y along the (tilted) dipole axis
  const basis = useMemo(() => {
    const x = SUN.clone();
    const axis = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.19); // ~11°
    const y = axis.sub(x.clone().multiplyScalar(axis.dot(x))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Matrix4().makeBasis(x, y, z);
  }, []);

  const fieldGeo = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    const L = new Float32Array(FIELD);
    const phi = new Float32Array(FIELD);
    const ph = new Float32Array(FIELD);
    for (let i = 0; i < FIELD; i++) {
      // particles ride a set of distinct field lines so the loops read clearly
      const shells = [2.2, 3, 4, 5.2, 6.6, 8.4];
      L[i] = shells[Math.floor(Math.random() * shells.length)]! + (Math.random() - 0.5) * 0.08;
      phi[i] = (Math.floor(Math.random() * 16) / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.015;
      ph[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FIELD * 3), 3));
    g.setAttribute('aL', new THREE.BufferAttribute(L, 1));
    g.setAttribute('aPhi', new THREE.BufferAttribute(phi, 1));
    g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    return g;
  }, []);

  const windGeo = useDisposable(() => {
    const g = new THREE.BufferGeometry();
    const b = new Float32Array(WIND * 2);
    const ph = new Float32Array(WIND);
    for (let i = 0; i < WIND; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 18;
      b[i * 2] = Math.cos(a) * r;
      b[i * 2 + 1] = Math.sin(a) * r;
      ph[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WIND * 3), 3));
    g.setAttribute('aB', new THREE.BufferAttribute(b, 2));
    g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    return g;
  }, []);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 }, uPixel: { value: 1 }, uDot: { value: dotTexture() } }), []);

  const fieldMat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          attribute float aL; attribute float aPhi; attribute float aPh;
          uniform float uTime; uniform float uOpacity; uniform float uPixel;
          varying float vA; varying vec3 vC;
          void main(){
            // travel along the field line, footpoint to footpoint
            float s0 = asin(sqrt(1.0 / aL));                    // where the line meets the surface
            float u = fract(aPh + uTime * (0.025 + 0.02 / aL));
            float th = mix(s0, 3.14159265 - s0, u);
            float r = aL * sin(th) * sin(th);
            vec3 eq = vec3(cos(aPhi), 0.0, sin(aPhi));          // x = sunward
            // squash the day side, stretch the night side into a tail
            float day = max(eq.x, 0.0);
            float night = max(-eq.x, 0.0);
            float squash = 1.0 - 0.32 * day * smoothstep(3.0, 9.0, r);
            float tail = 1.0 + 1.6 * night * smoothstep(3.0, 9.0, r);
            vec3 p = vec3(eq.x * r * sin(th) * (eq.x > 0.0 ? squash : tail), r * cos(th) * 0.92, eq.z * r * sin(th));
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            // brightest high up; fades near the surface and far out
            // streaks: brighter at the head of each moving group, so motion along the line reads
            float pulse = 0.35 + 0.65 * pow(fract(aPh * 7.0 + uTime * 0.4), 3.0);
            vA = uOpacity * smoothstep(1.05, 1.6, length(p)) * (0.45 + 0.55 * smoothstep(9.0, 3.0, aL)) * 1.6 * pulse;
            vC = mix(vec3(0.45, 0.75, 1.0), vec3(0.6, 0.55, 1.0), smoothstep(3.0, 9.0, aL));
            gl_PointSize = clamp(uPixel * 70.0 / -mv.z, 1.2, 3.2 * uPixel);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDot; varying float vA; varying vec3 vC;
          void main(){ gl_FragColor = vec4(vC * 1.4, texture2D(uDot, gl_PointCoord).a * vA); }`,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uniforms],
  );

  const windMat = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          attribute vec2 aB; attribute float aPh;
          uniform float uTime; uniform float uOpacity; uniform float uPixel;
          varying float vA;
          void main(){
            // stream from x = +40 (sunward) to x = -40, in Earth radii
            float x = 40.0 - fract(aPh + uTime * 0.05) * 80.0;
            vec2 b = aB;
            float rb = length(b);
            // magnetopause: paraboloid with its nose ~10 R toward the Sun
            float mp = x > 10.0 ? 0.0 : sqrt(max(0.0, (10.0 - x) * 20.0)) * 0.95;
            // flow is pushed out to just beyond the boundary, then carries on
            float r = rb < mp ? mp + rb * 0.12 : rb;
            vec2 dir = rb > 1e-3 ? b / rb : vec2(1.0, 0.0);
            vec3 p = vec3(x, dir.x * r, dir.y * r);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vA = uOpacity * 0.7 * smoothstep(40.0, 30.0, x) * smoothstep(-40.0, -26.0, x) * (rb < mp ? 1.25 : 0.7);
            gl_PointSize = clamp(uPixel * 60.0 / -mv.z, 1.2, 3.0 * uPixel);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDot; varying float vA;
          void main(){ gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * 1.3, texture2D(uDot, gl_PointCoord).a * vA); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uniforms],
  );

  useFrame((s) => {
    const p = readExperience().progress;
    const o = envelope(p, 0.788, 0.804, 0.826, 0.838);
    uniforms.uOpacity.value = o;
    uniforms.uTime.value = s.clock.elapsedTime;
    uniforms.uPixel.value = s.gl.getPixelRatio();
    if (group.current) group.current.visible = o > 0.003;
  });

  return (
    <group position={v3(WORLD.earthB)}>
      <group ref={group} matrixAutoUpdate={false} matrix={basis.clone().scale(new THREE.Vector3(RE, RE, RE))}>
        <points geometry={fieldGeo} material={fieldMat} frustumCulled={false} />
        <points geometry={windGeo} material={windMat} frustumCulled={false} />
      </group>
    </group>
  );
}

// ───────────────────────── CHEMISTRY — inside a drop of ocean ─────────────────────────
/**
 * Liquid water at true geometry: O–H bonds 0.96 Å, H–O–H angle 104.5°, atoms in
 * CPK colours (oxygen red, hydrogen white). Molecules tumble with thermal
 * motion; where a hydrogen faces a neighbour's oxygen (~1.9 Å away) a faint
 * glow marks the hydrogen bond that holds liquid water together.
 * A deep-water backdrop surrounds the scene: we are inside a drop.
 */
export function WaterDrop() {
  const root = useRef<THREE.Group>(null);
  const COUNT = 54;
  const A = 0.3; // world units per ångström
  const BOND = 0.96 * A;
  const HALF = (104.5 / 2) * (Math.PI / 180);

  const mol = useMemo(() => {
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out: { p: THREE.Vector3; q: THREE.Quaternion; spin: THREE.Vector3; ph: number }[] = [];
    // liquid density: roughly one molecule per 3.1 Å cube
    while (out.length < COUNT) {
      const p = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(4.4);
      if (p.length() > 2.2) continue;
      if (out.some((m) => m.p.distanceTo(p) < 2.7 * A)) continue;
      out.push({ p, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3)), spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.5), ph: rnd() * 10 });
    }
    return out;
  }, []);

  const geo = useDisposable(() => {
    const o = new THREE.SphereGeometry(0.66 * A, 28, 20); // ~covalent radius scale, slightly enlarged to read
    const h = new THREE.SphereGeometry(0.42 * A, 22, 16);
    const bond = new THREE.CylinderGeometry(0.1 * A, 0.1 * A, BOND, 12);
    return { o, h, bond, dispose: () => (o.dispose(), h.dispose(), bond.dispose()) };
  }, []);
  const mats = useDisposable(() => {
    const o = new THREE.MeshPhysicalMaterial({ color: '#ff3b2f', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 1.2 });
    const h = new THREE.MeshPhysicalMaterial({ color: '#f4f6ff', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 1.2 });
    const bond = new THREE.MeshStandardMaterial({ color: '#d9dde8', roughness: 0.4 });
    const hb = new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(0.55, 0.85, 1).multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 });
    return { o, h, bond, hb, dispose: () => [o, h, bond, hb].forEach((m) => m.dispose()) };
  }, []);

  const backdrop = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity; uniform float uTime; varying vec3 vP;
          void main(){
            vec3 d = normalize(vP);
            // light from above, falling off into the deep
            float up = d.y * 0.5 + 0.5;
            vec3 col = mix(vec3(0.0, 0.03, 0.08), vec3(0.02, 0.22, 0.42), pow(up, 2.2));
            // slow caustic shimmer
            float c = sin(d.x * 18.0 + uTime * 0.6) * sin(d.z * 16.0 - uTime * 0.5) * sin(d.y * 12.0 + uTime * 0.3);
            col += vec3(0.05, 0.16, 0.24) * smoothstep(0.55, 1.0, c) * up;
            gl_FragColor = vec4(col, uOpacity);
          }`,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  // placement of each molecule's atoms, updated with thermal tumbling
  const groups = useRef<THREE.Group[]>([]);
  const hbonds = useRef<THREE.Sprite[]>([]);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const hWorld = useMemo(() => Array.from({ length: COUNT * 2 }, () => new THREE.Vector3()), []);

  useFrame((s, dt) => {
    const p = readExperience().progress;
    const o = envelope(p, 0.834, 0.846, 0.87, 0.886);
    backdrop.uniforms.uOpacity!.value = o;
    backdrop.uniforms.uTime!.value = s.clock.elapsedTime;
    const g = root.current;
    if (!g) return;
    g.visible = o > 0.003;
    if (!g.visible) return;
    const t = s.clock.elapsedTime;
    mol.forEach((m, i) => {
      const grp = groups.current[i];
      if (!grp) return;
      tmpQ.setFromEuler(new THREE.Euler(m.spin.x * dt, m.spin.y * dt, m.spin.z * dt));
      m.q.multiply(tmpQ);
      grp.quaternion.copy(m.q);
      grp.position.set(m.p.x + Math.sin(t * 0.7 + m.ph) * 0.05, m.p.y + Math.cos(t * 0.6 + m.ph) * 0.05, m.p.z + Math.sin(t * 0.5 + m.ph * 2) * 0.05);
      grp.updateMatrixWorld();
      grp.children[1]!.getWorldPosition(hWorld[i * 2]!);
      grp.children[2]!.getWorldPosition(hWorld[i * 2 + 1]!);
    });
    // hydrogen bonds: H of one molecule within ~2.2 Å of another's O
    let k = 0;
    const oW = new THREE.Vector3();
    for (let i = 0; i < mol.length && k < hbonds.current.length; i++) {
      groups.current[i]?.children[0]!.getWorldPosition(oW);
      for (let j = 0; j < mol.length * 2 && k < hbonds.current.length; j++) {
        if (Math.floor(j / 2) === i) continue;
        const h = hWorld[j]!;
        const d = h.distanceTo(oW);
        if (d < 2.2 * A * g.scale.x) {
          const sp = hbonds.current[k++]!;
          sp.position.copy(h).lerp(oW, 0.5);
          g.worldToLocal(sp.position);
          sp.visible = true;
        }
      }
    }
    for (; k < hbonds.current.length; k++) hbonds.current[k]!.visible = false;
    mats.hb.opacity = o * 0.7;
    g.rotation.y = t * 0.05;
  });

  const hx = Math.sin(HALF) * BOND;
  const hy = Math.cos(HALF) * BOND;

  return (
    <group position={v3(WORLD.atom)}>
      <group ref={root}>
        {mol.map((m, i) => (
          <group key={i} ref={(el) => void (el && (groups.current[i] = el))}>
            <mesh geometry={geo.o} material={mats.o} />
            <mesh geometry={geo.h} material={mats.h} position={[hx, -hy, 0]} />
            <mesh geometry={geo.h} material={mats.h} position={[-hx, -hy, 0]} />
            <mesh geometry={geo.bond} material={mats.bond} position={[hx / 2, -hy / 2, 0]} rotation={[0, 0, HALF]} />
            <mesh geometry={geo.bond} material={mats.bond} position={[-hx / 2, -hy / 2, 0]} rotation={[0, 0, -HALF]} />
          </group>
        ))}
        {Array.from({ length: 70 }, (_, i) => (
          <sprite key={i} ref={(el) => void (el && (hbonds.current[i] = el))} material={mats.hb} scale={0.1} visible={false} />
        ))}
        <pointLight position={[0, 6, 4]} intensity={60} distance={20} decay={2} color="#cfeaff" />
        <pointLight position={[-4, -2, 3]} intensity={18} distance={20} decay={2} color="#3aa0ff" />
      </group>
    </group>
  );
}

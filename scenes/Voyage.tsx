'use client';

import { Html, useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState as useStateSafe } from 'react';
import * as THREE from 'three';
import { WORLD, envelope, local, smooth } from '@/rig/beats';
import { dotTexture, useDisposable } from '@/rig/gpu';
import { useModel } from '@/rig/models';
import { readExperience, useExperience } from '@/store/useExperience';
import { fit, fitRobust } from './parts/fit';
import { Callout, byDistance } from './parts/Callout';

const SATURN_TAG = [WORLD.saturn[0] + WORLD.saturnRadius * 0.8, WORLD.saturn[1] + WORLD.saturnRadius * 0.85, WORLD.saturn[2]] as const;
const SATURN_RING = [WORLD.saturn[0] + WORLD.saturnRadius * 0.45, WORLD.saturn[1] + WORLD.saturnRadius * 0.62, WORLD.saturn[2]] as const;
const saturnTag = byDistance(30 * WORLD.saturnRadius, 16 * WORLD.saturnRadius);

/**
 * THE VOYAGE and the way HOME — every station between the Big Bang and Earth.
 * Each export is its own lazily-mounted scene (see rig/SceneSwitch.tsx).
 */

const v3 = (a: readonly number[]) => a as unknown as [number, number, number];

// ───────────────────────── newborn universe: nebulae ─────────────────────────
/** A soft, irregular gas texture, generated once (no file). */
let gasTex: THREE.CanvasTexture | null = null;
function gasTexture() {
  if (gasTex) return gasTex;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.globalCompositeOperation = 'lighter';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // many overlapping soft blobs, denser toward the middle → wispy cloud
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 0.7) * N * 0.34;
    const x = N / 2 + Math.cos(a) * d;
    const y = N / 2 + Math.sin(a) * d * 0.8;
    const r = N * (0.04 + rnd() * 0.12);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const k = 0.035 + rnd() * 0.05;
    grd.addColorStop(0, `rgba(255,255,255,${k})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, N, N);
  }
  // fade the square's edges to nothing
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(N / 2, N / 2, N * 0.15, N / 2, N / 2, N / 2);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, N, N);
  gasTex = new THREE.CanvasTexture(c);
  return gasTex;
}

/**
 * After the flash, the light cools into gas: large, slow nebulae drifting past
 * as the camera moves on. Real stars come from the 8K sky (scenes/Sky SkyDome).
 */
export function Nebula() {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const palette = ['#6a4cff', '#ff4f9e', '#33c9ff', '#ffb35c', '#8f6bff', '#3f7bff'];
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 28 }, (_, i) => {
      const z = -40 - i * 27 - rnd() * 20;
      const a = rnd() * Math.PI * 2;
      const r = 90 + rnd() * 220;
      return {
        pos: [Math.cos(a) * r, Math.sin(a) * r * 0.6, z] as [number, number, number],
        scale: 140 + rnd() * 260,
        color: new THREE.Color(palette[i % palette.length]!),
        rot: rnd() * Math.PI * 2,
        spin: (rnd() - 0.5) * 0.02,
        opacity: 0.035 + rnd() * 0.07,
      };
    });
  }, []);
  const mats = useDisposable(() => {
    const ms = clouds.map(
      (c) =>
        new THREE.SpriteMaterial({ map: gasTexture(), color: c.color.clone().multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, rotation: c.rot, toneMapped: false }),
    );
    return { ms, dispose: () => ms.forEach((m) => m.dispose()) };
  }, [clouds]);

  useFrame((_, dt) => {
    const p = readExperience().progress;
    const o = envelope(p, 0.262, 0.295, 0.33, 0.352);
    if (group.current) group.current.visible = o > 0.003;
    mats.ms.forEach((m, i) => {
      m.opacity = o * clouds[i]!.opacity;
      m.rotation += clouds[i]!.spin * dt;
    });
  });

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} material={mats.ms[i]} position={c.pos} scale={c.scale} />
      ))}
    </group>
  );
}

// ───────────────────────── Voyager ─────────────────────────
/** Centred, slowly turning, so it can be read while the panel explains why it matters. */
export function Voyager() {
  const { scene } = useModel('voyager');
  const ref = useRef<THREE.Group>(null);
  const { scale, offset } = useMemo(() => fitRobust(scene, 2.2), [scene]);
  useMemo(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'metalness' in m) {
        // palette-baked materials come out fully metallic (black with nothing to
        // reflect): read them as painted aluminium + gold foil
        // matte enough to read as a real, sun-lit spacecraft rather than chrome
        m.envMapIntensity = 0.3;
        m.metalness = 0.12;
        m.roughness = 0.8;
        m.emissive?.set('#000000');
      }
    });
  }, [scene]);
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    // turntable: a slow, constant spin with a gentle nod — never tumbling
    g.rotation.set(0.18 + Math.sin(t * 0.15) * 0.04, t * 0.16, 0.08);
  });
  return (
    <group position={v3(WORLD.voyager)}>
      <group ref={ref}>
        <group scale={scale}>
          <primitive object={scene} position={offset} />
        </group>
      </group>
      {/* one warm key (distant Sun) and a faint cool fill: deep space is dark */}
      <pointLight position={[6, 3, 5]} intensity={120} color="#fff0dc" distance={40} decay={2} />
      <pointLight position={[-5, 2, -5]} intensity={40} color="#9fb4ff" distance={40} decay={2} />
    </group>
  );
}

// ───────────────────────── the Milky Way (need_some_space.glb) ─────────────────────────
const galaxyOpacity = (p: number) => smooth(local(p, 0.36, 0.4)) * (1 - smooth(local(p, 0.527, 0.543)));

/**
 * The provided spiral-galaxy point cloud as our Milky Way. Two passes over the
 * same points: sharp stars, and a glow pass of large, faint sprites that turns
 * the arms into luminous, nebulous structure. Colour is graded by distance from
 * the core (warm bulge → white-blue arms → violet rim). A gold "You are here"
 * marker sits 55% of the way out, where the camera dives in.
 */
export function MilkyWay() {
  const { scene } = useModel('space');
  const tier = useExperience((s) => s.tier);
  const R = WORLD.galaxyRadius;
  const { scale, offset } = useMemo(() => fit(scene, 1), [scene]);

  const shared = useMemo(
    () => ({
      uCentre: { value: new THREE.Vector3(...WORLD.galaxy) },
      uR: { value: R },
      uPixel: { value: 1 },
      uProj: { value: 800 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uDot: { value: dotTexture() },
    }),
    [R],
  );

  const mats = useDisposable(() => {
    const vert = (glow: boolean) => /* glsl */ `
      uniform vec3 uCentre; uniform float uR; uniform float uPixel; uniform float uProj; uniform float uOpacity; uniform float uTime;
      varying vec3 vC; varying float vA;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * w;
        float d = max(-mv.z, 0.01);
        float r = clamp(length(w.xyz - uCentre) / uR, 0.0, 1.2);
        float rnd = h(position);
        vec3 core = vec3(1.0, 0.82, 0.55);
        vec3 arm = vec3(0.78, 0.86, 1.0);
        vec3 rim = vec3(0.55, 0.5, 1.0);
        vec3 grade = mix(core, arm, smoothstep(0.05, 0.38, r));
        grade = mix(grade, rim, smoothstep(0.55, 1.0, r));
        ${glow ? '' : 'grade = mix(grade, vec3(1.0, 0.55, 0.75), step(0.985, rnd) * smoothstep(0.2, 0.4, r)); // young pink stars'}
        vC = color.rgb * grade;
        ${
          glow
            ? `vA = uOpacity * 0.012 * smoothstep(2.0, 40.0, d) * clamp(d / 900.0, 0.12, 1.0); // dimmer from inside the disc
               gl_PointSize = clamp(uR * 0.028 * uProj * uPixel / d, 2.0, 90.0 * uPixel);`
            : `vA = uOpacity * smoothstep(1.0, 20.0, d) * (0.65 + 0.35 * sin(uTime * (0.6 + rnd) + rnd * 50.0)) * clamp(d / 500.0, 0.4, 1.0);
               float ps = (0.5 + rnd * rnd * 1.6) * uR * 0.0011 * uProj * uPixel / d;
               vA *= clamp(ps / (1.2 * uPixel), 0.25, 1.0);
               gl_PointSize = clamp(ps, 1.2 * uPixel, 10.0 * uPixel);`
        }
        gl_Position = projectionMatrix * mv;
      }`;
    const frag = /* glsl */ `
      uniform sampler2D uDot; varying vec3 vC; varying float vA;
      void main(){ gl_FragColor = vec4(vC * 0.75, texture2D(uDot, gl_PointCoord).a * vA); }`;
    const opts = { vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fragmentShader: frag, uniforms: shared };
    const stars = new THREE.ShaderMaterial({ ...opts, vertexShader: vert(false) });
    const glow = new THREE.ShaderMaterial({ ...opts, vertexShader: vert(true) });
    return { stars, glow, dispose: () => (stars.dispose(), glow.dispose()) };
  }, [shared]);

  // swap materials + add the glow pass (in an effect: memos must stay pure)
  useEffect(() => {
    const added: THREE.Points[] = [];
    const pts: THREE.Points[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Points).isPoints && !o.userData.glowPass) pts.push(o as THREE.Points);
    });
    for (const p of pts) {
      p.userData.srcMat ??= p.material;
      p.material = mats.stars;
      p.frustumCulled = false;
      if (tier !== 'low') {
        const g = new THREE.Points(p.geometry, mats.glow);
        g.userData.glowPass = true;
        g.frustumCulled = false;
        g.renderOrder = -1;
        p.parent?.add(g);
        g.position.copy(p.position);
        g.quaternion.copy(p.quaternion);
        g.scale.copy(p.scale);
        added.push(g);
      }
    }
    return () => {
      for (const g of added) g.removeFromParent();
      for (const p of pts) p.material = p.userData.srcMat as THREE.Material;
    };
  }, [scene, mats, tier]);

  const coreMat = useDisposable(
    () => new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1, 0.78, 0.5).multiplyScalar(0.7), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }),
    [],
  );
  const markMat = useDisposable(
    () => new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1, 0.8, 0.45).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }),
    [],
  );
  // our star, at the marker: drawn exactly like the Sun's glare (scenes Sun) so the
  // switch into the solar system keeps the same star in the same place and size
  const homeStar = useDisposable(() => {
    const mats = [
      new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }),
      new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1, 0.62, 0.3).multiplyScalar(1.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }),
    ];
    return { mats, dispose: () => mats.forEach((m) => m.dispose()) };
  }, []);
  const h0 = useRef<THREE.Sprite>(null);
  const h1 = useRef<THREE.Sprite>(null);
  const yah = useMemo(() => new THREE.Vector3(...WORLD.youAreHere), []);
  const group = useRef<THREE.Group>(null);
  const mark = useRef<THREE.Sprite>(null);
  const label = useRef<HTMLDivElement>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((s) => {
    const p = readExperience().progress;
    const o = galaxyOpacity(p);
    shared.uOpacity.value = o;
    shared.uPixel.value = s.gl.getPixelRatio();
    shared.uTime.value = s.clock.elapsedTime;
    const cam = s.camera as THREE.PerspectiveCamera;
    shared.uProj.value = s.size.height / 2 / Math.tan((cam.fov * Math.PI) / 360);
    coreMat.opacity = o * 0.35;
    if (group.current) group.current.visible = o > 0.003;
    // the marker: a steady gold star that grows into the Sun as we dive
    markMat.opacity = envelope(p, 0.488, 0.505, 0.518, 0.53);
    if (mark.current) {
      const d = mark.current.getWorldPosition(tmp).distanceTo(cam.position);
      mark.current.scale.setScalar(Math.max(4, d * 0.018) / R);
    }
    if (label.current) label.current.style.opacity = String(envelope(p, 0.5, 0.51, 0.52, 0.527));
    // the marker hands over to our star, which we zoom toward as the galaxy streams past
    // after the cut into the solar system this star would be a second Sun in the sky
    const ho = p > 0.5453 ? 0 : smooth(local(p, 0.512, 0.528));
    const grow = 0.35 + 0.65 * smooth(local(p, 0.515, 0.545));
    const dy = yah.distanceTo(cam.position);
    homeStar.mats[0]!.opacity = ho;
    homeStar.mats[1]!.opacity = ho * 0.3;
    h0.current?.scale.setScalar(dy * 0.05 * grow);
    h1.current?.scale.setScalar(dy * 0.16 * grow);
    if (h0.current) h0.current.visible = ho > 0.003;
    if (h1.current) h1.current.visible = ho > 0.003;
  });

  return (
    <>
    <sprite ref={h1} material={homeStar.mats[1]} position={v3(WORLD.youAreHere)} renderOrder={8} />
    <sprite ref={h0} material={homeStar.mats[0]} position={v3(WORLD.youAreHere)} renderOrder={9} />
    <group ref={group} position={v3(WORLD.galaxy)} rotation={v3(WORLD.galaxyRotation)} scale={R}>
      <group scale={scale}>
        <primitive object={scene} position={offset} />
      </group>
      <sprite material={coreMat} scale={0.55} />
      <group position={[0.55, 0, 0]}>
        <sprite ref={mark} material={markMat} />
        <Html center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div ref={label} className="yah" style={{ opacity: 0 }}>
            <span className="yah__ring" />
            <span className="yah__text">You are here</span>
          </div>
        </Html>
      </group>
    </group>
    </>
  );
}

// ───────────────────────── the Sun ─────────────────────────
/** The Sun from afar: the provided star model, plus glare that keeps a constant on-screen size. */
export function Sun() {
  const { scene, animations } = useModel('sun');
  const { actions } = useAnimations(animations, scene);
  const { scale, offset } = useMemo(() => fit(scene, WORLD.sunRadius), [scene]);
  useMemo(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'emissiveIntensity' in m) {
        m.emissiveIntensity = 5; // HDR → bloom
        m.toneMapped = false;
      }
    });
  }, [scene]);
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.play());
  }, [actions]);

  const glow = useDisposable(() => {
    const mats = [
      new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1, 0.62, 0.3).multiplyScalar(1.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    ];
    return { mats, dispose: () => mats.forEach((m) => m.dispose()) };
  }, []);
  const g0 = useRef<THREE.Sprite>(null);
  const g1 = useRef<THREE.Sprite>(null);
  const camera = useThree((s) => s.camera);
  const sunPos = useMemo(() => new THREE.Vector3(...WORLD.sun), []);
  useFrame(() => {
    const p = readExperience().progress;
    const o = smooth(local(p, 0.53, 0.54));
    const d = camera.position.distanceTo(sunPos);
    // glare scales with distance so it reads as a bright star from far away
    g0.current?.scale.setScalar(Math.max(WORLD.sunRadius * 1.6, d * 0.05));
    g1.current?.scale.setScalar(Math.max(WORLD.sunRadius * 3, d * 0.16));
    glow.mats[0]!.opacity = o;
    glow.mats[1]!.opacity = o * 0.3;
  });
  return (
    <group position={v3(WORLD.sun)}>
      <group scale={scale}>
        <primitive object={scene} position={offset} />
      </group>
      <sprite ref={g0} material={glow.mats[0]} />
      <sprite ref={g1} material={glow.mats[1]} />
    </group>
  );
}

// ───────────────────────── Saturn ─────────────────────────
export function Saturn() {
  const { scene } = useModel('saturn');
  const { scale, offset } = useMemo(() => {
    let planet: THREE.Object3D | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m?.name === 'saturn1_A') planet = o;
    });
    planet?.updateWorldMatrix(true, false);
    const s = new THREE.Box3().setFromObject(planet ?? scene).getBoundingSphere(new THREE.Sphere());
    return { scale: WORLD.saturnRadius / s.radius, offset: s.center.multiplyScalar(-1).toArray() as [number, number, number] };
  }, [scene]);
  useMemo(() => {
    // the solid ring disc is just the base layer under the particles: keep it dim
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.name === 'saturn2_B') {
        m.color.setScalar(0.3);
        m.opacity = 0.6;
        m.envMapIntensity = 0;
      }
    });
  }, [scene]);
  const ref = useRef<THREE.Group>(null);
  const rings = useSaturnRings();
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.01;
  });
  return (
    <>
    {/* tilted so its rings open toward us on the way in */}
    <group position={v3(WORLD.saturn)} rotation={[-0.5, 0.5, 0.466]}>
      <group ref={ref} scale={scale}>
        <primitive object={scene} position={offset} />
        {rings && <points geometry={rings.geo} material={rings.mat} position={offset} frustumCulled={false} />}
      </group>
    </group>
    <Callout at={SATURN_TAG} portraitAt={SATURN_RING} title="Saturn" line="1.4 billion km from the Sun" visible={saturnTag} />
    </>
  );
}

/**
 * The ring particles from the original saturn.glb (≈1M textured chips), baked by
 * tools/bake-saturn-rings.mjs into one point per chip with its texture colour.
 */
function useSaturnRings() {
  const [data, setData] = useStateSafe<{ geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial } | null>(null);
  useEffect(() => {
    let dead = false;
    let made: { geo: THREE.BufferGeometry; mat: THREE.ShaderMaterial } | null = null;
    fetch('/assets/models/saturn-rings.bin')
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (dead) return;
        const dv = new DataView(buf);
        const n = dv.getUint32(0, true);
        const min = [dv.getFloat32(4, true), dv.getFloat32(8, true), dv.getFloat32(12, true)];
        const max = [dv.getFloat32(16, true), dv.getFloat32(20, true), dv.getFloat32(24, true)];
        const pos = new Uint16Array(buf, 28, n * 3);
        const col = new Uint8Array(buf, 28 + n * 6, n * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3, true));
        geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3, true));
        // phones draw a random 40% of the chips (they are shuffled at bake time)
        if (useExperience.getState().tier === 'low') geo.setDrawRange(0, Math.floor(n * 0.4));
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uMin: { value: new THREE.Vector3(...min) },
            uSize: { value: new THREE.Vector3(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!) },
            uDot: { value: dotTexture() },
            uPixel: { value: 1 },
          },
          vertexShader: /* glsl */ `
            attribute vec3 aCol; uniform vec3 uMin; uniform vec3 uSize; uniform float uPixel;
            varying vec3 vC; varying float vA;
            void main(){
              vec3 p = uMin + position * uSize;
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              vC = aCol;
              float ps = uPixel * ${(1.6 * 60 * WORLD.saturnRadius / 14).toFixed(1)} / -mv.z;
              // below a pixel, dim instead of shrinking (keeps total brightness right from afar)
              // thin edge-on rings stack thousands of points per pixel from afar: fade with distance
              vA = 0.3 * clamp((${((82 * WORLD.saturnRadius) / 14).toFixed(1)} + mv.z) / ${((30 * WORLD.saturnRadius) / 14).toFixed(1)}, 0.0, 1.0); // mv.z = -distance: particles only up close
              gl_PointSize = clamp(ps, 1.0, 2.2 * uPixel);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            uniform sampler2D uDot; varying vec3 vC; varying float vA;
            void main(){ gl_FragColor = vec4(vC * vec3(0.95, 0.88, 0.78), texture2D(uDot, gl_PointCoord).a * vA); }`,
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
  }, [setData]);
  return data;
}

// ───────────────────────── the Moon ─────────────────────────
export function MoonModel({ radius = 0.82, position }: { radius?: number; position?: readonly [number, number, number] }) {
  const { scene, animations } = useModel('moon');
  const { actions } = useAnimations(animations, scene);
  // size by the sphere itself: the model carries other nodes that would make the Moon too small
  const { scale, offset } = useMemo(() => {
    let body: THREE.Object3D | undefined;
    scene.traverse((o) => {
      if (!body && (o as THREE.Mesh).isMesh) body = o;
    });
    scene.updateMatrixWorld(true);
    const sph = new THREE.Box3().setFromObject(body ?? scene).getBoundingSphere(new THREE.Sphere());
    return { scale: radius / sph.radius, offset: sph.center.multiplyScalar(-1).toArray() as [number, number, number] };
  }, [scene, radius]);
  useMemo(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'envMapIntensity' in m) {
        m.envMapIntensity = 0.05;
        m.roughness = 0.95;
      }
    });
  }, [scene]);
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.play());
  }, [actions]);
  return (
    <group position={position as [number, number, number] | undefined} scale={scale}>
      <primitive object={scene} position={offset} />
    </group>
  );
}

export function MoonFlyby() {
  return <MoonModel position={WORLD.moon} radius={0.82} />;
}

// ───────────────────────── a satellite, Earth behind ─────────────────────────
export function SatelliteModel({ size = 0.6 }: { size?: number }) {
  const { scene } = useModel('satellite');
  const { scale, offset } = useMemo(() => fit(scene, size), [scene, size]);
  useMemo(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'envMapIntensity' in m) {
        m.envMapIntensity = 1.6;
        m.transparent = false;
        m.alphaTest = 0.4;
      }
    });
  }, [scene]);
  return (
    <group scale={scale}>
      <primitive object={scene} position={offset} />
    </group>
  );
}

export function Satellite() {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    g.rotation.set(0.35 + Math.sin(t * 0.07) * 0.05, -0.9 + t * 0.03, 0.12);
  });
  return (
    <group ref={ref} position={v3(WORLD.satellite)}>
      {/* ~40 m across at this scale (Earth radius 3 = 6,371 km rounds to tiny; kept just visible) */}
      <SatelliteModel size={0.02} />
    </group>
  );
}

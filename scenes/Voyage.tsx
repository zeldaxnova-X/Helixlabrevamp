'use client';

import { Html, useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState as useStateSafe } from 'react';
import * as THREE from 'three';
import { WORLD, envelope, local, passDistance, smooth } from '@/rig/beats';
import { dotTexture, useDisposable } from '@/rig/gpu';
import { useModel } from '@/rig/models';
import { readExperience, useExperience } from '@/store/useExperience';
import { fit, fitBall, fitRobust } from './parts/fit';
import { Callout, byDistance } from './parts/Callout';
import { STATS } from './Planets';

const PASS_SATURN = passDistance(WORLD.saturnRadius, 1.55);
const SATURN_AROUND = { center: WORLD.saturn, radius: WORLD.saturnRadius };
const saturnTag = byDistance(7 * passDistance(WORLD.saturnRadius, 1.55), 3 * passDistance(WORLD.saturnRadius, 1.55));

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
 * Per-star colour and random value as plain floats, read the same way on every GPU.
 * Colour keeps a hint of the model's own (mostly real star tones).
 */
function bakeStars(g: THREE.BufferGeometry) {
  if (g.getAttribute('aRnd')) return;
  const n = g.getAttribute('position').count;
  const src = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  const col = new Float32Array(n * 3);
  const rnd = new Float32Array(n);
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    const r = src ? src.getX(i) : 1;
    const gg = src ? src.getY(i) : 1;
    const b = src ? src.getZ(i) : 1;
    const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    col[i * 3] = l + (r - l) * 0.35;
    col[i * 3 + 1] = l + (gg - l) * 0.35;
    col[i * 3 + 2] = l + (b - l) * 0.35;
    rnd[i] = (seed = (seed * 16807) % 2147483647) / 2147483647;
  }
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
}

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
      // baked on the CPU (see below): some phone GPUs misread the model's 8-bit colours
      // and break the usual sin() hash, which drew the stars as coloured and dark blobs
      attribute vec3 aCol; attribute float aRnd;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * w;
        float d = max(-mv.z, 0.01);
        float r = clamp(length(w.xyz - uCentre) / uR, 0.0, 1.2);
        float rnd = aRnd;
        vec3 core = vec3(1.0, 0.82, 0.55);
        vec3 arm = vec3(0.78, 0.86, 1.0);
        vec3 rim = vec3(0.55, 0.5, 1.0);
        vec3 grade = mix(core, arm, smoothstep(0.05, 0.38, r));
        grade = mix(grade, rim, smoothstep(0.55, 1.0, r));
        ${glow ? '' : 'grade = mix(grade, vec3(1.0, 0.55, 0.75), step(0.985, rnd) * smoothstep(0.2, 0.4, r)); // young pink stars'}
        // the model's vertex colours are vivid RGB: keep a hint of them, mostly real star tones
        vC = clamp(aCol, 0.0, 1.0) * grade;
        ${
          glow
            ? `vA = uOpacity * 0.012 * smoothstep(2.0, 40.0, d) * clamp(d / 900.0, 0.12, 1.0); // dimmer from inside the disc
               gl_PointSize = clamp(uR * 0.028 * uProj * uPixel / d, 2.0, 90.0 * uPixel);`
            : `vA = uOpacity * smoothstep(1.0, 20.0, d) * (0.65 + 0.35 * sin(uTime * (0.6 + rnd) + rnd * 50.0)) * clamp(d / 500.0, 0.4, 1.0);
               float ps = (0.5 + rnd * rnd * 1.6) * uR * 0.0011 * uProj * uPixel / d;
               vA *= clamp(ps / (1.2 * uPixel), 0.25, 1.0);
               // stars right beside the camera would swell into discs: let them slip past instead
               vA *= smoothstep(30.0, 160.0, d);
               gl_PointSize = clamp(ps, 1.2 * uPixel, 6.0 * uPixel);`
        }
        gl_Position = projectionMatrix * mv;
      }`;
    const frag = /* glsl */ `
      uniform sampler2D uDot; varying vec3 vC; varying float vA;
      void main(){ gl_FragColor = vec4(vC * 0.75, texture2D(uDot, gl_PointCoord).a * vA); }`;
    const opts = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fragmentShader: frag, uniforms: shared };
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
      bakeStars(p.geometry);
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
    // glare scales with distance so it reads as a bright star from far away; once it has
    // been introduced it settles to what it is out here, the brightest star, not a big glare
    const k = 1 - 0.72 * smooth(local(p, 0.553, 0.564));
    g0.current?.scale.setScalar(Math.max(WORLD.sunRadius * 1.6, d * 0.05 * k));
    g1.current?.scale.setScalar(Math.max(WORLD.sunRadius * 3, d * 0.16 * k));
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
    return fitBall(planet ?? scene, WORLD.saturnRadius);
  }, [scene]);
  const ringMat = useDisposable(() => saturnRingMaterial(), []);
  const { disc, body } = useMemo(() => {
    // the ring disc: drawn by its real structure (saturnRingMaterial), under the particles
    let disc: THREE.Mesh | undefined;
    let body: THREE.Object3D | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m?.name === 'saturn2_B') disc = o as THREE.Mesh;
      if (m?.name === 'saturn1_A') body = o;
    });
    return { disc, body };
  }, [scene]);
  useEffect(() => {
    if (!disc) return;
    const src = disc.material;
    disc.material = ringMat;
    disc.renderOrder = 2;
    return () => {
      disc.material = src;
    };
  }, [disc, ringMat]);
  const ref = useRef<THREE.Group>(null);
  const rings = useSaturnRings();
  const orbit = useRef<THREE.Group>(null);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const sunW = useMemo(() => new THREE.Vector3(...WORLD.sun), []);
  const tmpL = useMemo(() => new THREE.Vector3(), []);
  useFrame((s, dt) => {
    // a Saturn day is 10.7 hours, the fastest spin after Jupiter's: turn the globe on its
    // own pole (the model's local z), never the group, which would tumble the rings
    body?.rotateZ(dt * 0.23);
    // and the ring particles orbit the planet, in the ring plane (its normal is the disc's local z)
    if (orbit.current && disc) {
      if (axis.lengthSq() === 0) {
        scene.updateWorldMatrix(true, true);
        const q = new THREE.Quaternion().copy(scene.getWorldQuaternion(new THREE.Quaternion())).invert().multiply(disc.getWorldQuaternion(new THREE.Quaternion()));
        axis.set(0, 0, 1).applyQuaternion(q).normalize();
      }
      orbit.current.quaternion.setFromAxisAngle(axis, s.clock.elapsedTime * 0.04);
    }
    if (disc) {
      disc.updateWorldMatrix(true, false);
      ringMat.uniforms.uSun!.value.copy(disc.worldToLocal(tmpL.copy(sunW))).normalize();
      ringMat.uniforms.uCam!.value.copy(disc.worldToLocal(tmpL.copy(s.camera.position)));
    }
  });
  return (
    <>
    {/* seen a little from above and to the left: rings open, north pole in view */}
    <group position={v3(WORLD.saturn)} rotation={[-0.3, 0.5, 0.6]}>
      <group ref={ref} scale={scale}>
        <primitive object={scene} position={offset} />
        {rings && (
          <group ref={orbit}>
            <points geometry={rings.geo} material={rings.mat} position={offset} frustumCulled={false} />
          </group>
        )}
      </group>
    </group>
    <Callout around={SATURN_AROUND} {...STATS.saturn} visible={saturnTag} />
    </>
  );
}

/**
 * Saturn's rings by their real structure, in planet radii (Rs = 60,268 km): the faint
 * C ring (1.24 to 1.53), the bright B ring (to 1.95), the Cassini Division (to 2.03),
 * the A ring (to 2.27) with the Encke (2.214) and Keeler (2.261) gaps, and the thin
 * F ring (2.33). Thousands of ringlets show as fine striations. Lit by the Sun: Saturn's
 * shadow falls across them, and from the unlit side they glow faintly through.
 * The model's disc is the unit circle in its own xy plane, 2.376 Rs across its radius.
 */
function saturnRingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(0, 0, 1) }, uCam: { value: new THREE.Vector3(0, 0, 1) } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main(){ vP = position.xy * 2.376; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform vec3 uCam; varying vec2 vP;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      float noise(float x){ float i = floor(x); float f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      float band(float r, float a, float b, float soft){ return smoothstep(a - soft, a + soft, r) * (1.0 - smoothstep(b - soft, b + soft, r)); }
      void main(){
        float r = length(vP);
        // optical depth by region
        float d = 0.0;
        d += band(r, 1.11, 1.235, 0.01) * 0.04;                       // D ring
        d += band(r, 1.235, 1.525, 0.004) * (0.13 + 0.08 * smoothstep(1.4, 1.52, r)); // C ring
        d += band(r, 1.525, 1.95, 0.004) * (0.78 + 0.17 * smoothstep(1.55, 1.75, r)); // B ring
        d += band(r, 1.95, 2.025, 0.004) * 0.06;                      // Cassini Division
        d += band(r, 2.025, 2.27, 0.003) * (0.55 - 0.12 * smoothstep(2.1, 2.27, r)); // A ring
        d *= 1.0 - band(r, 2.211, 2.217, 0.0015) * 0.9;              // Encke gap
        d *= 1.0 - band(r, 2.259, 2.262, 0.001) * 0.8;               // Keeler gap
        d += band(r, 2.322, 2.33, 0.002) * 0.25;                      // F ring
        // ringlets: fine radial striations at several scales
        float s = 0.42 + 0.36 * noise(r * 380.0) + 0.22 * noise(r * 1400.0 + 7.0);
        s *= 0.7 + 0.3 * noise(r * 70.0 + 3.0);
        float alpha = clamp(d * s * 1.25, 0.0, 0.95);
        if (alpha < 0.004) discard;
        // colour: icy cream in the B ring, warmer tan in A, grey-brown in C
        vec3 cC = vec3(0.50, 0.45, 0.40);
        vec3 cB = vec3(0.80, 0.69, 0.53);
        vec3 cA = vec3(0.70, 0.62, 0.51);
        vec3 col = mix(cC, cB, smoothstep(1.48, 1.6, r));
        col = mix(col, cA, smoothstep(1.97, 2.06, r));
        col *= 0.88 + 0.24 * noise(r * 260.0 + 11.0);
        // Saturn's shadow: does the ray toward the Sun hit the globe (unit sphere)?
        vec3 P = vec3(vP, 0.0);
        float b = dot(P, uSun);
        float disc = b * b - (dot(P, P) - 1.0);
        float lit = 1.0 - smoothstep(-0.02, 0.06, disc) * step(b, 0.0);
        // seen from the side the Sun shines on: reflected light; from the far side: light through
        float sameSide = step(0.0, uSun.z * uCam.z);
        float tilt = abs(uSun.z) * 0.7 + 0.3;
        float light = mix(0.28 * (1.0 - alpha * 0.6), 1.0, sameSide) * tilt * (0.12 + 0.88 * lit);
        gl_FragColor = vec4(col * light * (0.75 + 0.35 * s), alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
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
              // sparkle over the ring disc at the pass (full to 1.4 pass distances, gone by 2.4)
              vA = ${(useExperience.getState().tier === 'low' ? 0.13 : 0.055).toFixed(3)} * clamp((${(2.4 * PASS_SATURN).toFixed(1)} + mv.z) / ${PASS_SATURN.toFixed(1)}, 0.0, 1.0); // mv.z = -distance
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
    return fitBall(body ?? scene, radius);
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

'use client';

import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { WORLD, envelope, local, smooth } from '@/rig/beats';
import { readExperience } from '@/store/useExperience';
import { dotTexture, useDisposable } from '@/rig/gpu';
import { useModel, type ModelKey } from '@/rig/models';
import { fit } from './parts/fit';
import { Callout, byDistance } from './parts/Callout';

/**
 * The planets we pass on the way in from the edge of the solar system, and the
 * black hole between the nebulae and Voyager. Ring particles were baked from
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

// ───────────────────────── a black hole ─────────────────────────
/**
 * The model is built for self-lit rendering: the disc and the lensed arcs glow,
 * the horizon is pure black. Lit by our Sun they read flat and half in shadow,
 * so each part gets the material it was made for.
 */
export function BlackHole() {
  const { scene } = useModel('blackhole');
  const { scale, offset } = useMemo(() => fit(scene, WORLD.blackholeRadius), [scene]);
  const ref = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const assign: [THREE.Mesh, THREE.Material][] = [];
    const hide: THREE.Mesh[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = (mesh.userData.srcMat ?? mesh.material) as THREE.MeshStandardMaterial;
      const n = src.name;
      if (n === 'black_hole_distortion') return void hide.push(mesh); // a refraction shell: nothing to draw without it
      if (n === 'black_hole_blackoutside' || n === 'black_hole_center') {
        // the shadow of the event horizon: black, and it hides what is behind it
        assign.push([mesh, new THREE.MeshBasicMaterial({ name: n, color: 0x000000, map: src.map, alphaTest: n === 'black_hole_blackoutside' ? src.alphaTest : 0, transparent: n === 'black_hole_center', opacity: src.opacity })]);
        mesh.renderOrder = 0;
      } else if (n.startsWith('black_hole_light')) {
        // the hot inner disc layers (alpha-masked bands, as authored)
        const glow = src.emissive.clone().multiplyScalar(Math.max(1, src.emissiveIntensity) * 0.9);
        assign.push([mesh, new THREE.MeshBasicMaterial({ name: n, map: src.map, color: glow, alphaTest: src.alphaTest, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })]);
        mesh.renderOrder = 2;
      } else if (n === 'ring' || n === 'ring2') {
        // the accretion disc: hot gas, glowing on its own
        assign.push([mesh, new THREE.MeshBasicMaterial({ name: n, map: src.map, color: new THREE.Color(1, 1, 1).multiplyScalar(n === 'ring' ? 0.7 : 0.8), transparent: true, opacity: src.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })]);
        mesh.renderOrder = 1;
      }
    });
    return { assign, hide };
  }, [scene]);
  const lens = useLensing(WORLD.blackholeRadius * 0.17);
  const base = useMemo(() => [...parts.assign.map(([, m]) => m), ...lens.mats].map((m) => ({ m, o: m.opacity, t: m.transparent })), [parts, lens]);
  useEffect(() => {
    for (const [mesh, m] of parts.assign) {
      mesh.userData.srcMat ??= mesh.material;
      mesh.material = m;
    }
    for (const mesh of parts.hide) mesh.visible = false;
    return () => {
      for (const [mesh, m] of parts.assign) {
        mesh.material = mesh.userData.srcMat;
        m.dispose();
      }
      for (const mesh of parts.hide) mesh.visible = true;
    };
  }, [parts]);
  useFrame((s, dt) => {
    // the disc turns slowly: matter falling in
    if (ref.current) ref.current.rotation.y += dt * 0.05;
    // gone completely before Voyager appears
    const k = 1 - smooth(local(readExperience().progress, 0.346, 0.354));
    if (ref.current) ref.current.visible = k > 0.01;
    for (const x of base) {
      x.m.opacity = x.o * k;
      const t = x.t || k < 0.999;
      if (x.m.transparent !== t) {
        x.m.transparent = t;
        x.m.needsUpdate = true;
      }
    }
  });
  return (
    // seen almost edge-on, the classic lensed view: the disc crosses the shadow, its far side bends over it
    <>
    <group position={v3(WORLD.blackhole)} rotation={[-0.28, 0, -0.08]}>
      <group ref={ref} scale={scale}>
        <primitive object={scene} position={offset} />
      </group>
      {/* what the model's refraction shell did on Sketchfab: the horizon's shadow, the
          photon ring, and the far side of the disc bent up over (and under) the hole */}
      <group>
        <mesh geometry={lens.sphere} material={lens.horizon} renderOrder={0} />
        <sprite material={lens.arc} scale={[lens.r * 6, lens.r * 3, 1]} renderOrder={3} />
        <sprite material={lens.ring} scale={lens.r * 3.2} renderOrder={4} />
      </group>
      </group>
      <Callout at={BH_TAGS.horizon} title="Event horizon" line="Nothing that crosses it comes back" visible={bhTags} />
      <Callout at={BH_TAGS.ring} title="Photon ring" line="Light bent into orbit" visible={bhTags} side="left" />
      <Callout at={BH_TAGS.disc} title="Accretion disc" line="Gas heated as it falls in" visible={bhTags} />
    </>
  );
}

const BH_TAGS = {
  horizon: [WORLD.blackhole[0] + 1.9, WORLD.blackhole[1] + 1.5, WORLD.blackhole[2]] as const,
  ring: [WORLD.blackhole[0] - 2.1, WORLD.blackhole[1] + 1.6, WORLD.blackhole[2]] as const,
  disc: [WORLD.blackhole[0] + 5.2, WORLD.blackhole[1] - 0.9, WORLD.blackhole[2] + 1.5] as const,
};
const bhTags = (p: number) => envelope(p, 0.322, 0.327, 0.341, 0.345);

/**
 * Gravitational lensing, painted: a black horizon sphere (radius r), a thin photon
 * ring just outside it (brighter on the side whose gas moves toward us: Doppler
 * beaming), and the lensed image of the far side of the disc arcing over the top.
 */
function useLensing(r: number) {
  return useDisposable(() => {
    const sphere = new THREE.SphereGeometry(r, 48, 24);
    const horizon = new THREE.MeshBasicMaterial({ color: 0x000000 });
    // photon ring: shadow radius r ↔ 0.625 of the sprite half-size (scale 3.2 r)
    const rc = document.createElement('canvas');
    rc.width = rc.height = 512;
    const g = rc.getContext('2d')!;
    const R = (1.04 / 1.6) * 256;
    for (let i = 0; i < 360; i++) {
      const a0 = (i / 360) * Math.PI * 2;
      const a1 = ((i + 1.5) / 360) * Math.PI * 2;
      const beam = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(a0 - Math.PI)); // left side brighter
      g.strokeStyle = `rgba(255, 236, 200, ${0.9 * beam})`;
      g.lineWidth = 5;
      g.shadowColor = 'rgba(255, 190, 120, 0.9)';
      g.shadowBlur = 14;
      g.beginPath();
      g.arc(256, 256, R, a0, a1);
      g.stroke();
    }
    const ringTex = new THREE.CanvasTexture(rc);
    ringTex.colorSpace = THREE.SRGBColorSpace;
    // lensed far disc: a broad arc over the top, a thin one beneath (sprite 6r × 3r on 1024 × 512)
    const ac = document.createElement('canvas');
    ac.width = 1024;
    ac.height = 512;
    const h = ac.getContext('2d')!;
    const px = 1024 / 6; // pixels per r
    const band = (rx: number, ry: number, w: number, from: number, to: number, alpha: number) => {
      for (let k = 0; k < 14; k++) {
        const t = k / 13;
        h.strokeStyle = `rgba(255, ${Math.round(200 + 40 * t)}, ${Math.round(140 + 90 * t)}, ${alpha * (0.25 + 0.75 * Math.sin(Math.PI * t))})`;
        h.lineWidth = (w * px) / 14 + 1;
        h.beginPath();
        h.ellipse(512, 256, (rx + w * (t - 0.5)) * px, (ry + w * (t - 0.5)) * px, 0, from, to);
        h.stroke();
      }
    };
    h.filter = 'blur(3px)';
    band(1.45, 1.32, 0.42, Math.PI * 1.04, Math.PI * 1.96, 0.75);
    band(1.3, 1.18, 0.14, Math.PI * 0.08, Math.PI * 0.92, 0.45);
    const arcTex = new THREE.CanvasTexture(ac);
    arcTex.colorSpace = THREE.SRGBColorSpace;
    const sprite = (map: THREE.Texture, k: number) =>
      new THREE.SpriteMaterial({ map, color: new THREE.Color(1, 1, 1).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
    const ring = sprite(ringTex, 2.2);
    const arc = sprite(arcTex, 1.6);
    return {
      r,
      sphere,
      horizon,
      ring,
      arc,
      mats: [horizon, ring, arc] as THREE.Material[],
      dispose: () => {
        sphere.dispose();
        horizon.dispose();
        ring.dispose();
        arc.dispose();
        ringTex.dispose();
        arcTex.dispose();
      },
    };
  }, [r]);
}

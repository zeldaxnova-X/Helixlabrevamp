'use client';

import { useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useModel } from '@/rig/models';
import { useDisposable } from '@/rig/gpu';
import { sunDirection } from './SunLight';

/**
 * The provided Earth model: its surface (day map + city lights), cloud shell
 * and its own rotation animation, re-lit for space:
 *
 *  - surface: lit by the scene's Sun; city lights only on the night side; a
 *    thin blue haze along the lit limb (that's what real orbital photos show)
 *  - clouds:  lit by the Sun
 *  - atmosphere: ONE smooth scattering glow just outside the limb.
 *
 * The model's six stacked atmosphere shells stay in the file but aren't drawn:
 * rendered as rims they read as concentric "halo lines", which looks fake.
 *
 * The compressed surface mesh carries quantised normals, a few of which
 * collapse to zero — normalising those produces NaN pixels that bloom smears
 * into a flickering black block. Normals are rebuilt once from the geometry.
 */

const tmp = new THREE.Vector3();

const atmoVert = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const atmoFrag = /* glsl */ `
uniform vec3 uSun; uniform float uOpacity; uniform float uBoost;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  // back faces of a sphere 4.5% larger than the planet. t = 0 at its outer rim,
  // ~0.29 where it meets the planet's limb (sqrt(1 - 1/1.045²)); everything
  // further in is hidden behind the planet. Peak at the limb, fade to space.
  float t = clamp(-dot(N, V), 0.0, 1.0);
  float glow = pow(smoothstep(0.0, 0.29, t), 2.4);
  float ndl = dot(N, uSun);
  float lit = smoothstep(-0.25, 0.4, ndl);
  vec3 col = mix(vec3(0.28, 0.52, 1.0), vec3(0.5, 0.74, 1.0), lit);
  col = mix(col, vec3(1.0, 0.55, 0.3), (1.0 - smoothstep(0.0, 0.22, abs(ndl))) * 0.45);
  float a = glow * (0.04 + 0.96 * lit) * uOpacity * (1.0 + uBoost);
  gl_FragColor = vec4(col * a * 1.25, a);
}`;

interface Props {
  position?: readonly [number, number, number];
  radius?: number;
  opacity?: () => number;
  /** Extra brightness on the atmosphere (used for "why Earth is special"). */
  glow?: () => number;
  rotation?: [number, number, number];
}

export function EarthModel({ position = [0, 0, 0], radius = 2, opacity, glow, rotation = [0.25, -1.2, 0.05] }: Props) {
  const { scene, animations } = useModel('earth');
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, scene);

  const mats = useMemo(() => {
    const surfaces: THREE.MeshStandardMaterial[] = [];
    const clouds: THREE.MeshStandardMaterial[] = [];
    const assign: [THREE.Mesh, THREE.Material][] = [];
    const hide: THREE.Mesh[] = [];
    const sunView = { value: new THREE.Vector3(1, 0, 0) };
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // read the authored material; assignment happens in an effect (this memo must stay pure)
      const src = (mesh.userData.srcMat ?? mesh.material) as THREE.MeshStandardMaterial;
      if (src.name === 'TERRE') {
        const m = new THREE.MeshStandardMaterial({
          map: src.map,
          emissiveMap: src.emissiveMap,
          emissive: new THREE.Color(1.0, 0.72, 0.42),
          emissiveIntensity: 2.0,
          roughness: 0.85,
          metalness: 0,
          envMapIntensity: 0.04,
        });
        for (const t of [m.map, m.emissiveMap]) if (t) t.anisotropy = 8;
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uSunView = sunView;
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 uSunView;')
            .replace(
              '#include <emissivemap_fragment>',
              `#include <emissivemap_fragment>
               float ndlS = dot(normal, uSunView);
               // city lights only on the night side, fading through the terminator
               float nightK = 1.0 - smoothstep(-0.12, 0.22, ndlS);
               totalEmissiveRadiance *= nightK * nightK;
               // thin atmospheric haze along the lit limb
               float limb = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
               totalEmissiveRadiance += vec3(0.32, 0.55, 1.0) * limb * smoothstep(-0.2, 0.5, ndlS) * 0.55;`,
            );
        };
        assign.push([mesh, m]);
        surfaces.push(m);
        mesh.renderOrder = 1;
      } else if (src.name === 'NUAGES') {
        const m = new THREE.MeshStandardMaterial({ map: src.map, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, roughness: 1, metalness: 0, envMapIntensity: 0 });
        assign.push([mesh, m]);
        clouds.push(m);
        mesh.renderOrder = 2;
      } else {
        hide.push(mesh);
      }
    });
    // the model carries an internal scale (its surface is ~1.144 in scene units):
    // normalise so the *surface* is exactly `radius`
    let surfaceR = 1;
    scene.updateMatrixWorld(true);
    for (const [mesh] of assign) {
      if ((mesh.userData.srcMat ?? mesh.material).name !== 'TERRE') continue;
      mesh.geometry.computeBoundingSphere();
      surfaceR = (mesh.geometry.boundingSphere?.radius ?? 1) * mesh.getWorldScale(new THREE.Vector3()).x;
    }
    return { surfaces, clouds, sunView, assign, hide, norm: 1 / surfaceR };
  }, [scene]);

  useLayoutEffect(() => {
    for (const [mesh, m] of mats.assign) {
      mesh.userData.srcMat ??= mesh.material;
      mesh.material = m;
      // rebuild normals once per shared geometry (see note above)
      const g = mesh.geometry;
      if (!g.userData.normalsFixed) {
        g.deleteAttribute('normal');
        g.computeVertexNormals();
        g.userData.normalsFixed = true;
      }
    }
    for (const m of mats.hide) m.visible = false;
    return () => {
      for (const [mesh] of mats.assign) mesh.material = mesh.userData.srcMat as THREE.Material;
      for (const m of mats.hide) m.visible = true;
    };
  }, [mats]);

  useEffect(() => {
    Object.values(actions).forEach((a) => a?.play());
    return () => {
      mats.surfaces.forEach((m) => m.dispose());
      mats.clouds.forEach((m) => m.dispose());
    };
  }, [actions, mats]);

  const atmoGeo = useDisposable(() => new THREE.SphereGeometry(1, 96, 48), []);
  const atmo = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) }, uOpacity: { value: 1 }, uBoost: { value: 0 } },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((s) => {
    const o = opacity ? opacity() : 1;
    const g = group.current;
    if (!g) return;
    g.visible = o > 0.003;
    if (!g.visible) return;
    const sun = sunDirection();
    tmp.copy(sun).transformDirection(s.camera.matrixWorldInverse);
    mats.sunView.value.copy(tmp);
    const fading = o < 0.999;
    for (const m of mats.surfaces) {
      m.transparent = fading;
      m.opacity = o;
    }
    for (const m of mats.clouds) m.opacity = 0.9 * o;
    atmo.uniforms.uSun!.value.copy(sun);
    atmo.uniforms.uOpacity!.value = o;
    atmo.uniforms.uBoost!.value = glow ? glow() : 0;
  });

  return (
    <group ref={group} position={position as [number, number, number]} scale={radius} rotation={rotation}>
      <group scale={mats.norm}>
        <primitive object={scene} />
      </group>
      {/* surface is radius 1 here (normalised above); the glow sits just outside it */}
      <mesh geometry={atmoGeo} material={atmo} scale={1.045} renderOrder={3} />
    </group>
  );
}

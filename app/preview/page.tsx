'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** Dev-only: every model normalised to a 2-unit box, side by side. */
const ALL = ['earth', 'moon', 'sun', 'saturn', 'satellite', 'voyager', 'space', 'dna', 'jupiter', 'uranus', 'neptune', 'mars'];
const q = typeof window !== 'undefined' ? new URLSearchParams(location.search) : null;
const MODELS = q?.get('only') ? [q.get('only')!] : ALL;
const CAM = (q?.get('cam') ?? '0,0.4,16').split(',').map(Number) as [number, number, number];

function Model({ name, x }: { name: string; x: number }) {
  const g = useGLTF(`/assets/models/${name}.glb`, false, true);
  const { actions } = useAnimations(g.animations, g.scene);
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.play());
  }, [actions]);
  const { s, c } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(g.scene);
    return { s: 2 / box.getSize(new THREE.Vector3()).length(), c: box.getCenter(new THREE.Vector3()).multiplyScalar(-1) };
  }, [g]);
  return (
    <group position={[x, 0, 0]} scale={s}>
      <primitive object={g.scene} position={c.toArray()} />
    </group>
  );
}

export default function Preview() {
  // dev-only inspector; never shipped as a page
  if (process.env.NODE_ENV === 'production') return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ fov: 30, near: 0.01, far: 1000, position: CAM }}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[-5, 2, 6]} intensity={3} />
        {MODELS.map((m, i) => (
          <Suspense key={m} fallback={null}>
            <Model name={m} x={MODELS.length === 1 ? 0 : (i - (MODELS.length - 1) / 2) * 2.1} />
          </Suspense>
        ))}
        <OrbitControls />
      </Canvas>
    </div>
  );
}

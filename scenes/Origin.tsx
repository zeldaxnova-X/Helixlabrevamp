'use client';

import { EarthModel } from './parts/EarthModel';
import { WORLD, local, smooth } from '@/rig/beats';
import { readExperience } from '@/store/useExperience';

/** Hero Earth: rises out of the night-sky video, turns in space, then recedes into the void. */
export default function EarthA() {
  return (
    <EarthModel
      position={WORLD.earthA}
      radius={WORLD.earthARadius}
      rotation={[0.3, -1.9, 0.08]}
      opacity={() => {
        const p = readExperience().progress;
        return smooth(local(p, 0.004, 0.03)) * (1 - smooth(local(p, 0.125, 0.152)));
      }}
    />
  );
}

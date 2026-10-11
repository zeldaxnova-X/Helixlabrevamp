'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { JourneySpacer, ScrollDriver } from './ScrollDriver';
import { SceneSwitch } from './SceneSwitch';
import { DebugHud } from './DebugHud';
import { modelUrl, preloadModel } from './models';
import { BEATS, CUE_POINTS, scienceOf } from './beats';
import { Dust, SkyDome, Starfield } from '@/scenes/Sky';
import { SunLight } from '@/scenes/parts/SunLight';
import { Effects } from '@/scenes/Effects';
import { CinematicOverlay } from '@/ui/CinematicOverlay';
import { Loader } from '@/ui/Loader';
import { useExperience, readExperience } from '@/store/useExperience';
import { audio } from '@/audio/engine';
import { track } from '@/analytics/track';
import { saveOverride } from '@/fallback/capability';

/**
 * The full voyage: one persistent <Canvas>, one camera rig, one scroll clock.
 * Code-split from the page so phones and the flat path never download three.js.
 */
export default function Cinematic() {
  const tier = useExperience((s) => s.tier);
  const reduced = useExperience((s) => s.reducedMotion);
  const debug = typeof window !== 'undefined' && new URLSearchParams(location.search).has('debug');

  return (
    <>
      <ScrollDriver smooth={!reduced} />
      <div className="stage" aria-hidden>
        <Canvas
          // render close to the screen's own resolution: crisp on retina and phones
          dpr={tier === 'high' ? [1, 2] : tier === 'mid' ? [1, 1.75] : [1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, toneMapping: THREE.NoToneMapping }}
          camera={{ fov: 42, near: 0.004, far: 40000, position: [1.3, 0.75, 2.75] }}
          onCreated={({ gl }) => gl.setClearColor('#020309')}
        >
          <Preload />
          <CameraRig />
          <SkyDome />
          <Starfield />
          <Dust />
          <SunLight />
          <SceneSwitch />
          <Effects />
          <PerfWatch />
          {debug && <DebugHud />}
        </Canvas>
      </div>
      <JourneySpacer />
      <CinematicOverlay />
      <Loader />
      <AudioDirector />
    </>
  );
}

/**
 * Streams the opening behind the loader: fonts, the night-sky footage and the
 * Earth model. Everything else is prefetched by SceneSwitch ahead of the camera.
 * Nothing here can block past the loader's hard cap.
 */
function Preload() {
  useEffect(() => {
    const videoReady = new Promise<void>((resolve) => {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'auto';
      v.src = '/assets/video/nightsky-wide.mp4';
      v.oncanplaythrough = v.onerror = () => resolve();
      v.load();
    });
    const jobs: Promise<unknown>[] = [document.fonts?.ready ?? Promise.resolve(), videoReady, fetch(modelUrl('earth')).then((r) => r.arrayBuffer())];
    preloadModel('earth');
    audio.preloadActOne();
    let done = 0;
    const total = jobs.length;
    const set = (k: number) => {
      (window as unknown as { __helixLoad?: number }).__helixLoad = k; // for a listener that mounts late
      window.dispatchEvent(new CustomEvent('helix:load', { detail: k }));
    };
    jobs.forEach((j) => j.catch(() => {}).finally(() => set(++done / total)));
    const later = window.setTimeout(() => void audio.preloadActTwo(), 6000);
    return () => window.clearTimeout(later);
  }, []);
  return null;
}

/**
 * Live performance check: after warm-up, if frames are consistently slow,
 * first drop resolution, then hand off to the mobile experience (with a note
 * and a way back). The visitor is never asked up front.
 */
function PerfWatch() {
  const setDpr = useThree((s) => s.setDpr);
  const samples = useRef<number[]>([]);
  const stage = useRef<'warm' | 'measure' | 'reduced' | 'done'>('warm');
  const start = useRef(0);
  useFrame((state, dt) => {
    const { loaded } = readExperience();
    if (!loaded || stage.current === 'done') return;
    const t = state.clock.elapsedTime;
    if (stage.current === 'warm') {
      if (!start.current) start.current = t;
      if (t - start.current > 1.2) stage.current = 'measure';
      return;
    }
    samples.current.push(dt);
    if (samples.current.length < 90) return;
    const sorted = [...samples.current].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    samples.current = [];
    if (median > 1 / 24) {
      if (stage.current === 'measure') {
        stage.current = 'reduced';
        setDpr(1);
        track('perf_downgrade', { step: 'dpr', median: Math.round(median * 1000) });
      } else {
        stage.current = 'done';
        track('perf_downgrade', { step: 'mobile', median: Math.round(median * 1000) });
        saveOverride(null);
        useExperience.getState().setMode('mobile', 'low');
      }
    } else stage.current = 'done';
  });
  return null;
}

/** Fires the beat cues and per-lab beds as the scroll clock moves (direction-aware). */
function AudioDirector() {
  useEffect(() => {
    let lastP = useExperience.getState().progress;
    let lastBeat = useExperience.getState().activeBeat;
    return useExperience.subscribe((s) => {
      const p = s.progress;
      const forward = p > lastP;
      if (s.activeBeat !== lastBeat) {
        const b = BEATS.find((x) => x.id === s.activeBeat);
        const prevIdx = BEATS.findIndex((x) => x.id === lastBeat);
        const idx = BEATS.findIndex((x) => x.id === s.activeBeat);
        if (b?.cue && idx > prevIdx) audio.cue(b.cue);
        audio.lab(b ? scienceOf(b) : null);
        lastBeat = s.activeBeat;
      }
      if (forward) for (const c of CUE_POINTS) if (lastP < c.at && p >= c.at) audio.cue(c.cue);
      // scrolling back out of the silence restores the bed
      if (!forward && lastP >= 0.229 && p < 0.229) audio.duck(0.42, 800);
      lastP = p;
    });
  }, []);
  return null;
}

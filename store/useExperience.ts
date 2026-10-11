'use client';

import { create } from 'zustand';
import type { LabId } from '@/content/site';

/**
 * - cinematic: the full WebGL voyage (desktop, capable GPU)
 * - mobile:    the deliberately-designed scene sequence (phones, weak GPUs)
 * - calm:      the mobile sequence with motion stripped out (prefers-reduced-motion)
 * - flat:      the SSR HTML page only (no WebGL, keyboard / screen-reader choice)
 */
export type Mode = 'pending' | 'cinematic' | 'mobile' | 'calm' | 'flat';
export type Tier = 'high' | 'mid' | 'low';

interface ExperienceState {
  mode: Mode;
  tier: Tier;
  reducedMotion: boolean;
  /** Smoothed 0..1 journey progress. The only clock the rig reads. */
  progress: number;
  /** Scroll velocity in progress-units / second (drives streaks + aberration). */
  velocity: number;
  activeBeat: string;
  activeLab: LabId | null;
  muted: boolean;
  loaded: boolean;
  /** Element symbol highlighted by the chemistry mini-lab (the 3D field echoes it). */
  chemFocus: string | null;
  /** Hands-free: the page scrolls itself until you touch it. */
  autoplay: boolean;

  setMode: (mode: Mode, tier?: Tier) => void;
  setReducedMotion: (v: boolean) => void;
  setScroll: (progress: number, velocity: number) => void;
  setActiveBeat: (id: string, lab: LabId | null) => void;
  setMuted: (muted: boolean) => void;
  setLoaded: () => void;
  setChemFocus: (s: string | null) => void;
  setAutoplay: (on: boolean) => void;
}

export const useExperience = create<ExperienceState>((set) => ({
  mode: 'pending',
  tier: 'high',
  reducedMotion: false,
  progress: 0,
  velocity: 0,
  activeBeat: 'loader',
  activeLab: null,
  muted: true,
  loaded: false,
  chemFocus: null,
  autoplay: false,

  setMode: (mode, tier) => set((s) => ({ mode, tier: tier ?? s.tier })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setScroll: (progress, velocity) => set({ progress, velocity }),
  setActiveBeat: (activeBeat, activeLab) => set({ activeBeat, activeLab }),
  setMuted: (muted) => set({ muted }),
  setLoaded: () => set({ loaded: true }),
  setChemFocus: (chemFocus) => set({ chemFocus }),
  setAutoplay: (autoplay) => set({ autoplay }),
}));

/**
 * Per-frame readers (inside useFrame) should use this instead of the hook, so a
 * scroll tick never re-renders React trees.
 */
export const readExperience = () => useExperience.getState();

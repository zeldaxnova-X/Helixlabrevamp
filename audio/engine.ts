'use client';

import { Howl, Howler } from 'howler';
import type { LabId } from '@/content/site';
import type { CueId } from '@/rig/beats';

/**
 * Sound as a layer, never a blast.
 *
 *  - Muted by default. Nothing plays until the visitor presses the sound toggle
 *    (which is also the user gesture that unlocks Web Audio).
 *  - Act I loads with the experience: ambient bed + Big Bang impact (+ riser,
 *    whoosh — tiny). Act II lab tones + the UI sprite stream in later.
 *  - The bed ducks for the silence before the collision, swells after.
 */

const src = (name: string) => [`/assets/audio/${name}.webm`, `/assets/audio/${name}.mp3`];

type Sounds = {
  bed?: Howl;
  impact?: Howl;
  riser?: Howl;
  whoosh?: Howl;
  resolve?: Howl;
  labs: Partial<Record<LabId, Howl>>;
  ui?: Howl;
};

const S: Sounds = { labs: {} };
let enabled = false;
let bedTarget = 0.42;
let currentLab: LabId | null = null;

export const audio = {
  /** Act I set — call once the experience mounts (fetches, doesn't play). */
  preloadActOne() {
    S.bed ??= new Howl({ src: src('ambient-bed'), loop: true, volume: 0, html5: false });
    S.impact ??= new Howl({ src: src('bigbang-impact'), volume: 0.9 });
    S.riser ??= new Howl({ src: src('riser'), volume: 0.55 });
    S.whoosh ??= new Howl({ src: src('whoosh'), volume: 0.35 });
    S.resolve ??= new Howl({ src: src('earth-resolve'), volume: 0.5 });
  },
  /** Act II set — lab beds + UI sprite. */
  async preloadActTwo() {
    if (S.ui) return;
    const sprite = (await fetch('/assets/audio/ui-sprite.json').then((r) => r.json())) as Record<string, [number, number]>;
    S.ui = new Howl({ src: src('ui-sprite'), sprite, volume: 0.45 });
    for (const lab of ['physics', 'chemistry', 'biology', 'maths'] as const) {
      S.labs[lab] = new Howl({ src: src(`lab-${lab}`), loop: true, volume: 0 });
    }
  },

  get enabled() {
    return enabled;
  },

  setEnabled(on: boolean) {
    enabled = on;
    Howler.mute(!on);
    if (on) {
      this.preloadActOne();
      const bed = S.bed!;
      if (!bed.playing()) bed.play();
      bed.fade(bed.volume(), bedTarget, 2500);
      if (currentLab) this.lab(currentLab);
    } else {
      S.bed?.fade(S.bed.volume(), 0, 400);
    }
  },

  cue(id: CueId) {
    if (!enabled) return;
    switch (id) {
      case 'whoosh':
        S.whoosh?.rate(0.85 + Math.random() * 0.3);
        S.whoosh?.play();
        break;
      case 'riser':
        S.riser?.stop();
        S.riser?.play();
        break;
      case 'silence':
        // the held breath: riser cuts, bed drops away
        S.riser?.fade(S.riser.volume(), 0, 250);
        this.duck(0.03, 600);
        break;
      case 'impact':
        S.riser?.stop();
        S.riser?.volume(0.55);
        S.impact?.stop();
        S.impact?.play();
        this.duck(bedTarget, 3500);
        break;
      case 'resolve':
        S.resolve?.play();
        break;
    }
  },

  duck(vol: number, ms: number) {
    if (!S.bed) return;
    S.bed.fade(S.bed.volume(), enabled ? vol : 0, ms);
  },

  /** Crossfade the per-lab tone bed. Pass null to leave Act II. */
  lab(id: LabId | null) {
    currentLab = id;
    for (const [k, h] of Object.entries(S.labs)) {
      if (!h) continue;
      const on = enabled && k === id;
      if (on && !h.playing()) h.play();
      h.fade(h.volume(), on ? 0.32 : 0, 1500);
    }
    // the space bed sits back while a lab hums
    bedTarget = id ? 0.22 : 0.42;
    if (enabled && S.bed) S.bed.fade(S.bed.volume(), bedTarget, 1500);
  },

  ui(name: 'click' | 'tick' | 'hover' | 'toggle' | 'bloom' | 'success' | 'release') {
    if (!enabled || !S.ui) return;
    S.ui.play(name);
  },
};

export type Audio = typeof audio;

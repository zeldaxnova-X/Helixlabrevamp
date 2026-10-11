'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { detectCapability } from './capability';
import { useExperience } from '@/store/useExperience';
import { track } from '@/analytics/track';

// Code-split per mode: three.js only ever ships to the cinematic path.
const Cinematic = dynamic(() => import('@/rig/Cinematic'), { ssr: false });
const MobileExperience = dynamic(() => import('./MobileExperience'), { ssr: false });

/**
 * Decides which experience this visitor gets (never asks), mirrors it onto
 * <html data-mode> for CSS, and mounts it. The SSR flat page is always in the
 * DOM underneath — it's what crawlers, link previews and screen readers read.
 */
export function ExperienceRoot() {
  const mode = useExperience((s) => s.mode);
  const setMode = useExperience((s) => s.setMode);
  const setReducedMotion = useExperience((s) => s.setReducedMotion);

  useEffect(() => {
    const cap = detectCapability();
    setMode(cap.mode, cap.tier);
    setReducedMotion(matchMedia('(prefers-reduced-motion: reduce)').matches);
    track('page_view');
    track('experience_mode', { mode: cap.mode, tier: cap.tier, reason: cap.reason });
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [setMode, setReducedMotion]);

  useEffect(() => {
    if (mode !== 'pending') document.documentElement.dataset.mode = mode;
    if (mode === 'flat') window.scrollTo(0, 0);
  }, [mode]);

  if (mode === 'cinematic') return <Cinematic />;
  if (mode === 'mobile' || mode === 'calm') return <MobileExperience calm={mode === 'calm'} />;
  return null;
}

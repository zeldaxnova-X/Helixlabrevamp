'use client';

import { useEffect, type RefObject } from 'react';
import { useExperience } from '@/store/useExperience';

/**
 * Drive an element's style straight from the scroll clock without React
 * re-renders (narration fades, panels, CTA). `fn` returns opacity 0..1 and an
 * optional transform; visibility + pointer-events follow opacity.
 */
export function useProgressStyle(ref: RefObject<HTMLElement | null>, fn: (p: number) => { o: number; y?: number; s?: number }) {
  useEffect(() => {
    const apply = (p: number) => {
      const el = ref.current;
      if (!el) return;
      const { o, y = 0, s = 1 } = fn(p);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
    };
    apply(useExperience.getState().progress);
    return useExperience.subscribe((st, prev) => st.progress !== prev.progress && apply(st.progress));
    // fn is intentionally captured once; it must be pure in p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

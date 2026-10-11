/**
 * Edolus-style text resolve: the letters flicker through random glyphs and
 * settle left to right. Used on phones as a headline arrives. Leaves the real
 * text in place for screen readers (aria-label) and restores it exactly.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&+=/<>';
const running = new WeakMap<HTMLElement, number>();

export function scramble(el: HTMLElement, ms = 650) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const text = el.dataset.text ?? el.textContent ?? '';
  el.dataset.text = text;
  el.setAttribute('aria-label', text);
  cancelAnimationFrame(running.get(el) ?? 0);
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const settled = Math.floor(k * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;
      out += i < settled || c === ' ' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (k < 1) running.set(el, requestAnimationFrame(step));
    else el.textContent = text;
  };
  running.set(el, requestAnimationFrame(step));
}

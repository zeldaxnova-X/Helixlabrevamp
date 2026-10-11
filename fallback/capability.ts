import type { Mode, Tier } from '@/store/useExperience';

/**
 * Capability routing. Never asks the visitor; always lets them override.
 *
 *   override (?mode=… or saved choice)  → that
 *   no WebGL                            → flat
 *   prefers-reduced-motion              → calm
 *   phone with WebGL2 and a real GPU     → cinematic, low tier (the full journey, lighter)
 *   phone without that, or Data Saver    → mobile (the lite sequence)
 *   desktop with a software GPU, ≤4GB, ≤4 cores → mobile
 *   otherwise                           → cinematic (then a live frame-time check
 *                                          can still downgrade to mobile)
 *
 * The same rules run pre-hydration as an inline script (see EARLY_MODE_SCRIPT)
 * so the right layout is painted on first frame with no flash.
 */

export const MODE_KEY = 'helix:mode';
const MODES: Mode[] = ['cinematic', 'mobile', 'calm', 'flat'];

export interface Capability {
  mode: Mode;
  tier: Tier;
  reason: string;
  renderer: string;
}

export function readOverride(): Mode | null {
  try {
    const q = new URLSearchParams(location.search).get('mode') as Mode | null;
    if (q && MODES.includes(q)) return q;
    const s = localStorage.getItem(MODE_KEY) as Mode | null;
    if (s && MODES.includes(s)) return s;
  } catch {}
  return null;
}

export function saveOverride(mode: Mode | null) {
  try {
    if (mode) localStorage.setItem(MODE_KEY, mode);
    else localStorage.removeItem(MODE_KEY);
  } catch {}
}

function gpuInfo(): { ok: boolean; webgl2: boolean; renderer: string } {
  try {
    const c = document.createElement('canvas');
    const gl2 = c.getContext('webgl2');
    const gl = (gl2 || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, webgl2: false, renderer: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, webgl2: !!gl2, renderer };
  } catch {
    return { ok: false, webgl2: false, renderer: '' };
  }
}

export function detectCapability(): Capability {
  const override = readOverride();
  const { ok, webgl2, renderer } = gpuInfo();
  const r = renderer.toLowerCase();
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  const saveData = !!nav.connection?.saveData;

  const software = /swiftshader|llvmpipe|software|basic render/.test(r);
  const mobileGpu = /adreno|mali|powervr|apple gpu|sgx|tegra|videocore/.test(r) && coarse;
  const tierQ = (() => {
    try {
      return new URLSearchParams(location.search).get('tier') as Tier | null;
    } catch {
      return null;
    }
  })();
  const autoTier: Tier = software || mobileGpu || mem <= 4 || cores <= 4 ? 'low' : /intel/.test(r) && !/iris|arc/.test(r) ? 'mid' : 'high';

  // ?tier=low|mid|high: test a device profile from any machine
  const tier: Tier = tierQ && ['low', 'mid', 'high'].includes(tierQ) ? tierQ : autoTier;
  const pick = (mode: Mode, reason: string): Capability => ({ mode, tier, reason, renderer });
  if (override === 'cinematic' && !ok) return pick('flat', 'override:cinematic but no webgl');
  if (override) return pick(override, 'override');
  if (!ok) return pick('flat', 'no-webgl');
  if (reduced) return pick('calm', 'reduced-motion');
  if (saveData) return pick('mobile', 'save-data');
  if (coarse && small) {
    // phones get the full journey on the low tier when they can carry it
    if (!webgl2 || software || mem <= 2) return pick('mobile', 'phone-lite');
    return { mode: 'cinematic', tier: 'low', reason: 'phone', renderer };
  }
  if (tier === 'low') return pick('mobile', 'weak-device');
  return pick('cinematic', 'capable');
}

/**
 * Pre-hydration guess, inlined in <head>. Mirrors detectCapability() minus the
 * GPU string (too slow to create a context before first paint). Sets
 * <html data-mode="…"> so CSS can lay out the right experience immediately.
 */
export const EARLY_MODE_SCRIPT = `(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search).get('mode'),m=['cinematic','mobile','calm','flat'],s=null;try{s=localStorage.getItem('${MODE_KEY}')}catch(e){}var o=m.indexOf(q)>-1?q:(m.indexOf(s)>-1?s:null);var mm=function(x){return matchMedia(x).matches};var mode=o||(mm('(prefers-reduced-motion: reduce)')?'calm':'cinematic');var c=document.createElement('canvas');if(!(c.getContext('webgl2')||c.getContext('webgl')))mode='flat';d.setAttribute('data-mode',mode);}catch(e){}})();`;

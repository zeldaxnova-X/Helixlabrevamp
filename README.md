# Helix Labs — landing experience

The public marketing site for `www.helixlabs.pro`: a scroll-driven WebGL film. It opens on the night-sky footage, rises to the Earth model, rewinds to the Big Bang, then flies home through endless space — the dust cloud, the Milky Way, Voyager, the Sun, Saturn, the Moon, a satellite — back to Earth, where physics, chemistry, maths and biology are introduced around the planet, ending on a Learn-more invitation over the lighthouse footage.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

Useful URLs while developing:

| URL | What it does |
| --- | --- |
| `/?debug=1` | GPU counters + fps HUD; exposes `window.__helix.go(p)` to jump the clock to progress `p` |
| `/?mode=cinematic` · `mobile` · `calm` · `flat` | Force an experience (also bypasses the return-visitor redirect) |
| `/?voyage=1` | Show the landing page even when a `helix_session` cookie is present |

## One URL, four experiences

Chosen automatically by `fallback/capability.ts` (never asks; the footer "View as" switch overrides and is remembered):

| Mode | Who gets it | What ships |
| --- | --- | --- |
| **cinematic** | Desktop with a capable GPU | Full R3F voyage (`rig/Cinematic.tsx`). three.js is code-split here only. |
| **mobile** | Phones, weak GPUs, Save-Data, or a desktop whose live frame time is too slow | `fallback/MobileExperience.tsx` — night-sky video opening, 2D-canvas Big Bang, portrait video scenes, the four sciences, Learn more. No three.js. |
| **calm** | `prefers-reduced-motion` | The mobile sequence with motion stripped (posters, no burst, fades only). |
| **flat** | No WebGL, or "Simple page" | The SSR page in `fallback/FlatLanding.tsx`. |

The flat page is **always** server-rendered underneath. In the journey modes its intro is visually hidden but stays in the accessibility tree (screen readers read it; it becomes a visible panel if a keyboard user tabs into it), and its outro (the six labs, Learn more, schools, footer) is what the journey scrolls into. That is also what Google and link previews read.

Return visitors: `proxy.ts` redirects to the dashboard when the cross-subdomain `helix_session` cookie is present.

## Architecture

```
content/   all copy: narration, the four sciences + laws, labs, URLs   (single source of truth)
rig/       beats.ts (THE config) · cameraPath · CameraRig · ScrollDriver (Lenis)
           SceneSwitch (proximity mount + model prefetch) · models.ts (ref-counted GLBs)
           gpu.ts (disposal helpers) · Cinematic
scenes/    Origin (hero Earth) · MatterAntimatter · BigBang · Voyage (warp, dust cloud,
           Milky Way, Voyager, Sun, Saturn, Moon, satellite) · Rules (arrival Earth,
           orbits, exploded atom, maths overlay, DNA) · Sky · Effects · parts/ (EarthModel, SunLight)
audio/     Howler engine: muted by default, lazy groups, beat cues
fallback/  capability routing, ExperienceRoot, MobileExperience, FlatLanding
ui/        overlay: opening video, top bar, loader, narration, HUD, science panels, Learn more
analytics/ track() → dataLayer + optional beacon
store/     Zustand: progress, velocity, beat, lab, muted, tier, reduced-motion
tools/     asset pipeline (gltf-transform, sharp, ffmpeg-static)
app/preview  dev-only page showing every model side by side
```

- **One clock.** Lenis produces a smoothed 0–1 `progress` in the store. Nothing else drives the journey.
- **One camera.** `CameraRig` samples a time-parameterised Hermite spline built from every beat's keyframes, then follows it with a damped lag (mass) plus per-beat mouse parallax. Beats never move the camera.
- **Proximity mounting.** Each scene in `SCENES` (in `beats.ts`) is a lazy chunk that exists only while progress is inside its range. Its JS is prefetched one range ahead.
- **Models.** Every GLB goes through `useModel` (rig/models.ts): one decode, a clone per scene, GPU resources freed 2.5 s after the last scene using it unmounts. Material swaps happen in effects (never in `useMemo`), so React's dev double-render can't desync them.
- **Disposal.** R3F frees JSX-created resources; everything built imperatively goes through `useDisposable`. Verify with `?debug=1`: scroll the whole way and back — geometry/texture counts return to a stable baseline.
- **Per-frame work never re-renders React.** Scenes read `readExperience()` inside `useFrame`; overlay text uses `useProgressStyle` (direct style writes).

## Adding or retuning a beat

Everything lives in `rig/beats.ts`:

1. **Retime** — change a beat's `range`. Keep beats contiguous and in order.
2. **Re-frame** — edit its `camera` keys (`at` is local 0–1 time; `hold: true` parks the camera there). Positions are world units; `WORLD` lists the anchors (Earth at the origin, Sun, Moon, lab sites, hub).
3. **Narration / sound** — `narration` (copy comes from `content/site.ts` `NARRATION`), `narrationWindow`, `cue`. Exact-point cues go in `CUE_POINTS`.
4. **A new 3D scene** — add `scenes/MyScene.tsx` (default export), register it in `SceneSwitch.tsx` `importers`, and give it a mount range in `SCENES`. Read progress with `readExperience()` inside `useFrame`; allocate through `useDisposable`.
5. **A science stop** — beats with id `physics` / `chemistry` / `maths` / `biology` and two `hold` keys park the camera; their copy lives in `content/site.ts` `SCIENCES`.

Scroll length overall is `JOURNEY_SCREENS` (viewport heights).

## Assets

`npm run assets` (after `npm i` inside `tools/`) rebuilds `public/assets` from the raw folders beside this repo (`../3D assets`, `../Sound asset`, `../Video assets`). See the header of `tools/build-assets.mjs` for what each step does.

Notes:
- Models are meshopt-compressed with WebP textures (KTX2 needs `toktx`, not installed). Saturn's 3.2M-vertex ring-debris mesh is stripped (the textured ring disc stays); Saturn and the black hole used the old spec-gloss format and are converted to metal-rough.
- Videos: landscape cuts for desktop (`*-wide.mp4`, `*-card.mp4`), portrait cuts for mobile (`*-portrait.mp4`).
- The riser, Earth-arrival chord and per-lab tone beds are **synthesised** placeholders.

## Conversion instrumentation

`analytics/track.ts` pushes to `window.dataLayer` and, if `NEXT_PUBLIC_ANALYTICS_URL` is set, beacons there. Events: `page_view`, `experience_mode`, `beat_reached`, `scroll_complete`, `skip_intro`, `resume_offered/accepted`, `audio_unmute`, `lab_interact`, `signup_click {source}`, `mode_override`, `perf_downgrade`. Every sign-up link also carries `?from=landing:<source>`. Anonymous only: no PII, per-tab random id.

## Environment

| Var | Default |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://app.helixlabs.pro` |
| `NEXT_PUBLIC_SIGNUP_URL` | `${APP}/sign-up` |
| `NEXT_PUBLIC_DASHBOARD_URL` | `${APP}/` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.helixlabs.pro` |
| `NEXT_PUBLIC_ANALYTICS_URL` | unset (dataLayer only) |

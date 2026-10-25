'use client';

import { useState } from 'react';
import { HERO, liteHref, signUpHref } from '@/content/site';
import { audio } from '@/audio/engine';
import { track } from '@/analytics/track';
import { useExperience } from '@/store/useExperience';

/**
 * Always above the 3D, from the first frame: wordmark, sound toggle, and the
 * escape hatch — "Enter Labs" straight to sign-up.
 */
export function TopBar({ onSkip, showSkip, showAutoplay }: { onSkip?: () => void; showSkip?: boolean; showAutoplay?: boolean }) {
  const muted = useExperience((s) => s.muted);
  const setMuted = useExperience((s) => s.setMuted);
  const [hinted, setHinted] = useState(false);
  const autoplay = useExperience((s) => s.autoplay);
  const setAutoplay = useExperience((s) => s.setAutoplay);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    audio.setEnabled(!next);
    if (!next) track('audio_unmute');
    setHinted(true);
  };

  return (
    <header className="topbar" role="banner">
      <a href="#top" className="topbar__mark" aria-label="Helix Labs home">
        <span>{HERO.wordmark}</span>
      </a>
      <div className="topbar__right">
        {showSkip && onSkip && (
          <button type="button" className="topbar__ghost topbar__skip" onClick={onSkip}>
            Skip intro
          </button>
        )}
        {showAutoplay && (
          <button
            type="button"
            className={`topbar__ghost topbar__auto ${autoplay ? 'is-on' : ''}`}
            onClick={() => {
              setAutoplay(!autoplay);
              if (!autoplay) track('autoplay_on');
            }}
            aria-pressed={autoplay}
            aria-label={autoplay ? 'Pause autoplay' : 'Autoplay the journey'}
            title={autoplay ? 'Pause. Scrolling also takes back control' : 'Play the journey for me'}
          >
            <span className="topbar__autoicon" aria-hidden>
              {autoplay ? '❚❚' : '▶'}
            </span>
            <span className="topbar__autolabel">{autoplay ? 'Pause' : 'Autoplay'}</span>
          </button>
        )}
        <button
          type="button"
          className={`topbar__sound ${muted ? '' : 'is-on'} ${!hinted && muted ? 'is-hint' : ''}`}
          onClick={toggle}
          aria-pressed={!muted}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          title={muted ? 'Sound off. Tap for the full experience' : 'Sound on'}
        >
          <span className="bars" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="topbar__soundlabel">{muted ? 'Sound' : 'On'}</span>
        </button>
        {/* the way out to the lite edition — same story, no GPU */}
        <a
          className="topbar__ghost topbar__lite"
          href={liteHref('topbar')}
          onClick={() => track('edition_switch', { to: 'lite', source: 'topbar' })}
          title="The same journey with no 3D — lighter on your device and your data"
        >
          Lite version
        </a>
        <a className="btn btn--primary topbar__cta" href={signUpHref('topbar')} onClick={() => track('signup_click', { source: 'topbar' })}>
          {HERO.cta}
        </a>
      </div>
    </header>
  );
}


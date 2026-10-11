'use client';

import { saveOverride } from './capability';
import { useExperience, type Mode } from '@/store/useExperience';
import { track } from '@/analytics/track';

/** Let the visitor override the automatic choice. Remembered on this device. */
export function ModeSwitcher() {
  const mode = useExperience((s) => s.mode);
  const options: { id: Mode; label: string }[] = [
    { id: 'cinematic', label: 'Full journey' },
    { id: 'mobile', label: 'Lite' },
    { id: 'calm', label: 'Calm (less motion)' },
    { id: 'flat', label: 'Simple page' },
  ];
  return (
    <div className="modeswitch" role="group" aria-label="Choose how to view this page">
      <span>View as</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={mode === o.id}
          onClick={() => {
            saveOverride(o.id);
            track('mode_override', { to: o.id, from: mode });
            // a clean reload gives the new mode a fresh GPU context and scroll
            location.href = location.pathname + (o.id === 'flat' ? '#flat' : '');
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { ExperienceRoot } from '@/fallback/ExperienceRoot';
import { FlatLanding } from '@/fallback/FlatLanding';

/**
 * One URL, four experiences. The flat page is server-rendered underneath; the
 * client island decides whether a cinematic or mobile journey runs above it.
 */
export default function Home() {
  return (
    <main>
      <ExperienceRoot />
      <FlatLanding />
    </main>
  );
}

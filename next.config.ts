import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three / postprocessing ship modern ESM; transpile so examples/jsm resolve cleanly.
  transpilePackages: ['three'],
  async headers() {
    return [
      {
        // Cached for a day (so a visit, and the next, never re-download), revalidated quietly
        // after that: asset files keep their names when they are rebuilt, so never 'immutable'.
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;

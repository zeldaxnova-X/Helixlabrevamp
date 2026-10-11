import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three / postprocessing ship modern ESM; transpile so examples/jsm resolve cleanly.
  transpilePackages: ['three'],
  async headers() {
    return [
      {
        // Media is content-addressed by the asset pipeline; cache hard.
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;

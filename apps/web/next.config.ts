import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// Optional same-origin API routing: Vercel frontend -> cloud container -> Atlas.
// This is a deployment setting, never a URL supplied by the browser.
const apiOrigin = process.env.ANALIZA_API_ORIGIN;
if (apiOrigin) {
  const target = new URL(apiOrigin);
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== '/' ||
    target.port ||
    !['.onrender.com', '.run.app'].some((suffix) => target.hostname.endsWith(suffix))
  ) {
    throw new Error('ANALIZA_API_ORIGIN must be a private-configured HTTPS cloud service origin.');
  }
}

if (
  process.env.NEXT_PUBLIC_RELEASE_PROFILE === 'core' &&
  (process.env.NEXT_PUBLIC_DATA_MODE !== 'mongodb' || process.env.ANALIZA_DATA_MODE !== 'mongodb')
) {
  throw new Error('Core requires server and browser MongoDB modes; demo fallback is forbidden.');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@analiza/contracts', '@analiza/domain', '@analiza/ui'],
  async rewrites() {
    return {
      beforeFiles: apiOrigin
        ? [
            {
              source: '/api/:path*',
              destination: `${new URL(apiOrigin).origin}/api/:path*`,
            },
          ]
        : [],
      afterFiles: [],
      fallback: [],
    };
  },
  ...(process.env.ANALIZA_CONTAINER_BUILD === '1'
    ? {
        output: 'standalone' as const,
        outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
      }
    : {}),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;

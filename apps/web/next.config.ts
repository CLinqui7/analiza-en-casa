import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@analiza/contracts', '@analiza/domain', '@analiza/ui'],
};

export default nextConfig;

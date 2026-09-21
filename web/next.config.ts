import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Local testing via 127.0.0.1 vs localhost
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.1.171'],
  serverExternalPackages: ['ajv', 'ajv-formats'],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

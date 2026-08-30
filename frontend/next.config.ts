import type { NextConfig } from "next";
import { loadEnvConfig } from '@next/env';
import path from 'path';

// Load root .env file
loadEnvConfig(path.resolve(process.cwd(), '..'));

try {
    const { initialize } = require('./lib/config');
    initialize();
} catch (error: any) {
    console.error(error.message);
    process.exit(1);
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.BACKEND_PORT || '3001'}/:path*`
      }
    ];
  }
};

export default nextConfig;

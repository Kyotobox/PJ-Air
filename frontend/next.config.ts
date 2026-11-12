import type { NextConfig } from "next";
import { loadEnvConfig } from '@next/env';
import path from 'path';

// Load root .env file
loadEnvConfig(process.cwd());
loadEnvConfig(path.resolve(process.cwd(), '..'));

try {
    const { initialize } = require('./lib/config');
    initialize();
} catch (error: any) {
    console.error(error.message);
    process.exit(1);
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

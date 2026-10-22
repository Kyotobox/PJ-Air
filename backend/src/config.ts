import * as fs from 'fs';
import { resolve } from 'path';

// Synchronously load the root .env file early
const envPath = resolve(process.cwd(), '../.env');
if (fs.existsSync(envPath)) {
    const dotenv = require('dotenv');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        if (!process.env[k]) {
            process.env[k] = envConfig[k];
        }
    }
}

// Sane Defaults
export const PORT = process.env.BACKEND_PORT || '3001';
export const UPLOAD_PATH = process.env.UPLOAD_PATH || 'uploads';

// Simple Exports
export const DATABASE_PATH = process.env.DATABASE_PATH;
export const JWT_SECRET = process.env.JWT_SECRET;
export const SUPABASE_KEY = process.env.SUPABASE_KEY;
export const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;
export const NODE_ENV = process.env.NODE_ENV;
export const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = process.env.SMTP_PORT || '587';
export const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;

export function initialize() {
    if (!DATABASE_PATH) {
        throw new Error('❌ CRITICAL ERROR: DATABASE_PATH is missing. The backend cannot start.');
    }

    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
        throw new Error('❌ CRITICAL ERROR: JWT_SECRET is missing in production environment.');
    }

    if (!SUPABASE_KEY) {
        console.warn('⚠️ WARNING: SUPABASE_KEY is missing. Storage will fail.');
    }

    if (!GOOGLE_MAPS_KEY) {
        console.warn('⚠️ WARNING: GOOGLE_MAPS_KEY is missing. Geo features will fail.');
    }
}

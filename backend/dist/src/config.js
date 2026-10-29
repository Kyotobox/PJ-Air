"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMS_ENABLED = exports.TWILIO_PHONE_NUMBER = exports.TWILIO_AUTH_TOKEN = exports.TWILIO_ACCOUNT_SID = exports.STRIPE_WEBHOOK_SECRET = exports.STRIPE_PUBLISHABLE_KEY = exports.STRIPE_SECRET_KEY = exports.ADMIN_NOTIFICATION_EMAIL = exports.SMTP_PASS = exports.SMTP_USER = exports.SMTP_SECURE = exports.SMTP_PORT = exports.SMTP_HOST = exports.SITE_URL = exports.NODE_ENV = exports.GOOGLE_MAPS_KEY = exports.SUPABASE_KEY = exports.JWT_SECRET = exports.DATABASE_PATH = exports.UPLOAD_PATH = exports.PORT = void 0;
exports.initialize = initialize;
const fs = __importStar(require("fs"));
const path_1 = require("path");
const envPath = (0, path_1.resolve)(process.cwd(), '../.env');
if (fs.existsSync(envPath)) {
    const dotenv = require('dotenv');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        if (!process.env[k]) {
            process.env[k] = envConfig[k];
        }
    }
}
exports.PORT = process.env.BACKEND_PORT || '3001';
exports.UPLOAD_PATH = process.env.UPLOAD_PATH || 'uploads';
exports.DATABASE_PATH = process.env.DATABASE_PATH;
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.SUPABASE_KEY = process.env.SUPABASE_KEY;
exports.GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;
exports.NODE_ENV = process.env.NODE_ENV;
exports.SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
exports.SMTP_HOST = process.env.SMTP_HOST;
exports.SMTP_PORT = process.env.SMTP_PORT || '587';
exports.SMTP_SECURE = process.env.SMTP_SECURE === 'true';
exports.SMTP_USER = process.env.SMTP_USER;
exports.SMTP_PASS = process.env.SMTP_PASS;
exports.ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;
exports.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
exports.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
exports.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
exports.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
exports.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
exports.TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
exports.SMS_ENABLED = process.env.SMS_ENABLED;
function initialize() {
    if (!exports.DATABASE_PATH) {
        throw new Error('❌ CRITICAL ERROR: DATABASE_PATH is missing. The backend cannot start.');
    }
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
        throw new Error('❌ CRITICAL ERROR: JWT_SECRET is missing in production environment.');
    }
    if (!exports.SUPABASE_KEY) {
        console.warn('⚠️ WARNING: SUPABASE_KEY is missing. Storage will fail.');
    }
    if (!exports.GOOGLE_MAPS_KEY) {
        console.warn('⚠️ WARNING: GOOGLE_MAPS_KEY is missing. Geo features will fail.');
    }
}
//# sourceMappingURL=config.js.map
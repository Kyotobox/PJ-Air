import * as crypto from 'crypto';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production mode');
    }
    return 'jhoanes-bakery-super-secret-key-change-in-production';
  }
  return secret;
}

function base64url(source: Buffer | string): string {
  const buff = Buffer.isBuffer(source) ? source : Buffer.from(source);
  return buff.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const PBKDF2_ITERATIONS = 210000;
const LEGACY_ITERATIONS = 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  const [salt, hash] = storedValue.split(':');
  if (!salt || !hash) return false;

  const hashBuffer = Buffer.from(hash, 'utf8');

  // Verify against upgraded 210,000 iterations first
  const verifyHash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  const verifyBuffer = Buffer.from(verifyHash, 'utf8');
  if (hashBuffer.length === verifyBuffer.length && crypto.timingSafeEqual(hashBuffer, verifyBuffer)) {
    return true;
  }

  // Fallback to legacy 1,000 iterations for existing credentials
  const legacyHash = crypto.pbkdf2Sync(password, salt, LEGACY_ITERATIONS, 64, 'sha512').toString('hex');
  const legacyBuffer = Buffer.from(legacyHash, 'utf8');
  if (hashBuffer.length === legacyBuffer.length && crypto.timingSafeEqual(hashBuffer, legacyBuffer)) {
    return true;
  }

  return false;
}

export function signJwt(payload: any, expiresInSeconds: number = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };
  
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', getJwtSecret())
    .update(signatureInput)
    .digest();
  const encodedSignature = base64url(signature);
  
  return `${signatureInput}.${encodedSignature}`;
}

export function verifyJwt(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', getJwtSecret())
    .update(signatureInput)
    .digest();
  const expectedSignature = base64url(signature);
  
  const providedBuffer = Buffer.from(encodedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }
  
  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // expired
    }
    return payload;
  } catch {
    return null;
  }
}

import * as crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'jhoanes-bakery-super-secret-key-change-in-production';

function base64url(source: Buffer | string): string {
  const buff = Buffer.isBuffer(source) ? source : Buffer.from(source);
  return buff.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  const [salt, hash] = storedValue.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export function signJwt(payload: any, expiresInSeconds: number = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };
  
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET)
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
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest();
  const expectedSignature = base64url(signature);
  
  if (encodedSignature !== expectedSignature) return null;
  
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

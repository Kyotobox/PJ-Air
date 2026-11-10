import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import en from './i18n/en';
import es from './i18n/es';

// ── Password Reset Logic Engine ──────────────────────────────────────────────

export interface UserResetState {
    id: string;
    email: string;
    passwordHash: string;
    reset_password_token?: string | null;
    reset_password_expires?: Date | null;
}

export function generatePasswordResetToken(user: UserResetState, validityMs: number = 3600000) {
    if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
        throw new Error('Invalid or missing email address');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + validityMs);
    
    // Crucial: Existing password is NOT destroyed or changed
    user.reset_password_token = token;
    user.reset_password_expires = expires;

    return { token, expires };
}

export function buildResetPasswordUrl(siteUrl: string, token: string) {
    if (!siteUrl || !token) {
        throw new Error('siteUrl and token are required to build reset URL');
    }
    const cleanSiteUrl = siteUrl.replace(/\/+$/, '');
    return `${cleanSiteUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

export function applyPasswordReset(
    user: UserResetState,
    token: string,
    newPassword: string,
    confirmPassword: string
) {
    if (!token || typeof token !== 'string') {
        throw new Error('Reset token is required');
    }
    if (!user.reset_password_token || user.reset_password_token !== token) {
        throw new Error('Invalid or non-existent reset token');
    }
    if (!user.reset_password_expires || new Date(user.reset_password_expires).getTime() < Date.now()) {
        throw new Error('Reset token has expired');
    }
    if (!newPassword || newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
    }
    if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
    }

    // Apply new password and clear token
    user.passwordHash = `hashed:${newPassword}`;
    user.reset_password_token = null;
    user.reset_password_expires = null;

    return {
        success: true,
        message: 'Password successfully updated',
    };
}

// ── Test Suite: Password Reset Flow & Security ───────────────────────────────

describe('Sprint S68 - Password Reset Flow (Happy Path & Sad Paths)', () => {

    it('Happy Path: generates a 64-char hex token with 1-hour expiration without mutating current password', () => {
        const user: UserResetState = {
            id: 'usr-1',
            email: 'client@jhoanes.com',
            passwordHash: 'original-secret-hash-1234',
        };

        const { token, expires } = generatePasswordResetToken(user, 3600000);

        expect(token).toHaveLength(64);
        expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
        expect(user.reset_password_token).toBe(token);
        expect(user.reset_password_expires?.getTime()).toBeGreaterThan(Date.now());
        
        // Anti-Destructive Guarantee: Original password must remain untouched
        expect(user.passwordHash).toBe('original-secret-hash-1234');
    });

    it('Happy Path: builds clean and secure reset password URL', () => {
        const siteUrl = 'https://testing.jhoanes.com';
        const token = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
        const url = buildResetPasswordUrl(siteUrl, token);

        expect(url).toBe('https://testing.jhoanes.com/auth/reset-password?token=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    });

    it('Happy Path: updates password and clears reset token upon valid token submission', () => {
        const user: UserResetState = {
            id: 'usr-1',
            email: 'client@jhoanes.com',
            passwordHash: 'old-hash',
            reset_password_token: 'valid-token-xyz',
            reset_password_expires: new Date(Date.now() + 1800000), // 30 mins ahead
        };

        const result = applyPasswordReset(user, 'valid-token-xyz', 'StrongPass123!', 'StrongPass123!');
        expect(result.success).toBe(true);
        expect(user.passwordHash).toBe('hashed:StrongPass123!');
        expect(user.reset_password_token).toBeNull();
        expect(user.reset_password_expires).toBeNull();
    });

    // ── Sad Paths ────────────────────────────────────────────────────────────

    it('Sad Path 1: throws error if email is invalid or missing when requesting token', () => {
        const invalidUser: UserResetState = {
            id: 'usr-2',
            email: 'not-an-email',
            passwordHash: 'hash',
        };

        expect(() => generatePasswordResetToken(invalidUser)).toThrowError(
            'Invalid or missing email address'
        );
    });

    it('Sad Path 2: throws error if token does not match user token', () => {
        const user: UserResetState = {
            id: 'usr-3',
            email: 'client@jhoanes.com',
            passwordHash: 'current-hash',
            reset_password_token: 'valid-token-111',
            reset_password_expires: new Date(Date.now() + 1800000),
        };

        expect(() => applyPasswordReset(user, 'wrong-token-999', 'NewPassword123!', 'NewPassword123!')).toThrowError(
            'Invalid or non-existent reset token'
        );
        // Password must not change on failed attempt
        expect(user.passwordHash).toBe('current-hash');
    });

    it('Sad Path 3: throws error if reset token has expired', () => {
        const user: UserResetState = {
            id: 'usr-4',
            email: 'client@jhoanes.com',
            passwordHash: 'current-hash',
            reset_password_token: 'expired-token-222',
            reset_password_expires: new Date(Date.now() - 5000), // Expired 5 seconds ago
        };

        expect(() => applyPasswordReset(user, 'expired-token-222', 'NewPassword123!', 'NewPassword123!')).toThrowError(
            'Reset token has expired'
        );
        expect(user.passwordHash).toBe('current-hash');
    });

    it('Sad Path 4: throws error if new password is too short (< 8 chars)', () => {
        const user: UserResetState = {
            id: 'usr-5',
            email: 'client@jhoanes.com',
            passwordHash: 'current-hash',
            reset_password_token: 'valid-token-333',
            reset_password_expires: new Date(Date.now() + 1800000),
        };

        expect(() => applyPasswordReset(user, 'valid-token-333', 'short', 'short')).toThrowError(
            'New password must be at least 8 characters long'
        );
        expect(user.passwordHash).toBe('current-hash');
    });

    it('Sad Path 5: throws error if password confirmation does not match', () => {
        const user: UserResetState = {
            id: 'usr-6',
            email: 'client@jhoanes.com',
            passwordHash: 'current-hash',
            reset_password_token: 'valid-token-444',
            reset_password_expires: new Date(Date.now() + 1800000),
        };

        expect(() => applyPasswordReset(user, 'valid-token-444', 'Password123!', 'Mismatch123!')).toThrowError(
            'Passwords do not match'
        );
        expect(user.passwordHash).toBe('current-hash');
    });

    // ── Translation & i18n Parity ────────────────────────────────────────────

    it('i18n Parity: verifies bilingual dictionary keys for forgotPassword and resetPassword', () => {
        expect(en.forgotPassword.title).toBeDefined();
        expect(es.forgotPassword.title).toBeDefined();
        expect(en.forgotPassword.submit).toBe('Send Reset Link');
        expect(es.forgotPassword.submit).toBe('Enviar Enlace de Recuperación');

        expect(en.resetPassword.title).toBe('Set New Password');
        expect(es.resetPassword.title).toBe('Establecer Nueva Contraseña');
        expect(en.resetPassword.submit).toBe('Update Password');
        expect(es.resetPassword.submit).toBe('Actualizar Contraseña');
        expect(en.resetPassword.invalidTokenTitle).toBeDefined();
        expect(es.resetPassword.invalidTokenTitle).toBeDefined();
    });
});

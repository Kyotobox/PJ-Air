import { describe, it, expect } from 'vitest';

export interface WholesaleSignupData {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    company_name: string;
    legal_business_name: string;
    business_address: string;
    tax_id: string;
    signer_name: string;
    terms_consent_1: boolean;
    terms_consent_2: boolean;
    terms_consent_3: boolean;
    signature_text: string;
    username?: never; // Explicitly forbidden/eradicated
}

export function buildSanitizedWholesaleSignupPayload(input: any) {
    if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
        throw new Error('Valid email address is mandatory for wholesale registration');
    }
    if (!input.company_name || !input.company_name.trim()) {
        throw new Error('Company or store name is required');
    }
    if (!input.legal_business_name || !input.legal_business_name.trim()) {
        throw new Error('Legal Business Name is required');
    }
    if (!input.business_address || !input.business_address.trim()) {
        throw new Error('Commercial address is required');
    }
    if (!input.tax_id || !input.tax_id.trim()) {
        throw new Error('Tax ID / EIN is required');
    }
    if (!input.signer_name || !input.signer_name.trim()) {
        throw new Error('Authorized signer name is required');
    }
    if (!input.terms_consent_1 || !input.terms_consent_2 || !input.terms_consent_3) {
        throw new Error('All 3 mandatory terms consent checkboxes must be accepted');
    }
    if (!input.signature_text || input.signature_text.trim().length < 3) {
        throw new Error('Valid electronic signature name is required');
    }

    // Notice: username is completely omitted and never accepted
    const { username, ...sanitized } = input;
    return {
        email: input.email.trim().toLowerCase(),
        password: input.password,
        full_name: input.full_name?.trim() || '',
        phone: input.phone?.trim() || '',
        company_name: input.company_name.trim(),
        legal_business_name: input.legal_business_name.trim(),
        business_address: input.business_address.trim(),
        tax_id: input.tax_id.trim(),
        signer_name: input.signer_name.trim(),
        terms_version: 'v2026.10.29',
        signature_text: input.signature_text.trim(),
    };
}

export const WHOLESALE_AGREEMENT_CLAUSES_EN = [
    {
        id: 1,
        title: 'Production Cutoff Policy (36h)',
        summary: 'All wholesale orders must be confirmed at least 36 hours prior to the scheduled delivery day.',
    },
    {
        id: 2,
        title: 'Operating Delivery Schedule',
        summary: 'Deliveries are conducted Wednesday through Monday. No deliveries are scheduled on Tuesdays.',
    },
    {
        id: 3,
        title: 'Credit & Payment Terms',
        summary: 'Approved commercial credit accounts operate under net 7-day terms. Delinquent balances accrue 1.5% monthly.',
    },
    {
        id: 4,
        title: 'Stripe Card-on-File Authorization',
        summary: 'Customer authorizes Jhoanes Bakery to securely tokenize a debit or credit card via Stripe without initial charge ($0.00 SetupIntent).',
    },
    {
        id: 5,
        title: 'Binding Electronic Signature (NY ESRA / Federal E-SIGN Act)',
        summary: 'Adopting typed legal name and checking electronic boxes constitutes a legally binding digital signature under NY ESRA and Federal E-SIGN Act.',
    },
];

describe('Sprint S67: Erradicación de Username & Políticas en Inglés', () => {
    describe('Wholesale Signup Payload (No Username Requirement)', () => {
        it('successfully builds payload without any username field (Happy Path)', () => {
            const rawInput = {
                email: 'Orders@QueensCafe.com',
                password: 'SecretPassword123!',
                full_name: 'David Miller',
                phone: '+1 (718) 555-0199',
                company_name: 'Queens Specialty Coffee',
                legal_business_name: 'Queens Specialty Coffee LLC',
                business_address: '32-15 Broadway, Astoria, NY 11106',
                tax_id: '12-3456789',
                signer_name: 'David Miller',
                terms_consent_1: true,
                terms_consent_2: true,
                terms_consent_3: true,
                signature_text: 'David Miller',
            };

            const payload = buildSanitizedWholesaleSignupPayload(rawInput);
            expect(payload.email).toBe('orders@queenscafe.com');
            expect(payload.company_name).toBe('Queens Specialty Coffee');
            expect(payload).not.toHaveProperty('username');
        });

        it('silently ignores and strips username if provided by legacy forms (Happy Path)', () => {
            const rawInputWithLegacyUser = {
                email: 'Admin@AstoriaBake.com',
                password: 'SecretPassword123!',
                full_name: 'Sarah Connor',
                phone: '+1 (718) 555-0122',
                company_name: 'Astoria Bake House',
                legal_business_name: 'Astoria Bake House Corp',
                business_address: '28-10 30th Ave, Astoria, NY 11102',
                tax_id: '98-7654321',
                signer_name: 'Sarah Connor',
                terms_consent_1: true,
                terms_consent_2: true,
                terms_consent_3: true,
                signature_text: 'Sarah Connor',
                username: 'sarah_legacy_alias',
            };

            const payload = buildSanitizedWholesaleSignupPayload(rawInputWithLegacyUser);
            expect((payload as any).username).toBeUndefined();
        });

        it('rejects signup payload when mandatory commercial fields are missing (Sad Path)', () => {
            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'invalid-email',
                company_name: 'Test Co',
            })).toThrow('Valid email address is mandatory for wholesale registration');

            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'valid@test.com',
                company_name: '',
            })).toThrow('Company or store name is required');

            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'valid@test.com',
                company_name: 'Test',
                legal_business_name: '',
            })).toThrow('Legal Business Name is required');

            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'valid@test.com',
                company_name: 'Test',
                legal_business_name: 'Test Corp',
                business_address: '',
            })).toThrow('Commercial address is required');

            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'valid@test.com',
                company_name: 'Test',
                legal_business_name: 'Test Corp',
                business_address: '123 Main St',
                tax_id: '',
            })).toThrow('Tax ID / EIN is required');

            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'valid@test.com',
                company_name: 'Test',
                legal_business_name: 'Test Corp',
                business_address: '123 Main St',
                tax_id: '12-3456789',
                signer_name: '',
            })).toThrow('Authorized signer name is required');

            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'valid@test.com',
                company_name: 'Test',
                legal_business_name: 'Test Corp',
                business_address: '123 Main St',
                tax_id: '12-3456789',
                signer_name: 'John Doe',
                terms_consent_1: false,
                terms_consent_2: true,
                terms_consent_3: true,
            })).toThrow('All 3 mandatory terms consent checkboxes must be accepted');

            expect(() => buildSanitizedWholesaleSignupPayload({
                email: 'valid@test.com',
                company_name: 'Test',
                legal_business_name: 'Test Corp',
                business_address: '123 Main St',
                tax_id: '12-3456789',
                signer_name: 'John Doe',
                terms_consent_1: true,
                terms_consent_2: true,
                terms_consent_3: true,
                signature_text: '  ',
            })).toThrow('Valid electronic signature name is required');
        });
    });

    describe('Official B2B English Wholesale Agreement Clauses', () => {
        it('contains all 5 mandatory NY commercial clauses in English', () => {
            expect(WHOLESALE_AGREEMENT_CLAUSES_EN).toHaveLength(5);
            expect(WHOLESALE_AGREEMENT_CLAUSES_EN[0].title).toBe('Production Cutoff Policy (36h)');
            expect(WHOLESALE_AGREEMENT_CLAUSES_EN[1].title).toBe('Operating Delivery Schedule');
            expect(WHOLESALE_AGREEMENT_CLAUSES_EN[2].title).toBe('Credit & Payment Terms');
            expect(WHOLESALE_AGREEMENT_CLAUSES_EN[3].title).toBe('Stripe Card-on-File Authorization');
            expect(WHOLESALE_AGREEMENT_CLAUSES_EN[4].title).toBe('Binding Electronic Signature (NY ESRA / Federal E-SIGN Act)');
        });

        it('confirms English clause content contains correct commercial policies', () => {
            const cutoff = WHOLESALE_AGREEMENT_CLAUSES_EN.find(c => c.id === 1);
            expect(cutoff?.summary).toContain('36 hours');

            const delivery = WHOLESALE_AGREEMENT_CLAUSES_EN.find(c => c.id === 2);
            expect(delivery?.summary).toContain('No deliveries are scheduled on Tuesdays');

            const credit = WHOLESALE_AGREEMENT_CLAUSES_EN.find(c => c.id === 3);
            expect(credit?.summary).toContain('net 7-day terms');
            expect(credit?.summary).toContain('1.5% monthly');

            const stripe = WHOLESALE_AGREEMENT_CLAUSES_EN.find(c => c.id === 4);
            expect(stripe?.summary).toContain('$0.00 SetupIntent');

            const esign = WHOLESALE_AGREEMENT_CLAUSES_EN.find(c => c.id === 5);
            expect(esign?.summary).toContain('NY ESRA');
            expect(esign?.summary).toContain('Federal E-SIGN Act');
        });
    });
});

import { describe, it, expect } from 'vitest';
import {
    calculateCheckoutSalesTax,
    validateNightAccessPayload,
    validateST120UploadFile,
    validateST120RegistrationOption,
    NY_COMBINED_SALES_TAX_RATE,
} from './st120-checkout';

describe('Sprint S79 - ST-120 Tax Exemption & Night Access Logic', () => {
    describe('calculateCheckoutSalesTax (Happy & Sad Paths)', () => {
        it('Happy path: correctly calculates 8.875% NY sales tax for non-exempt user', () => {
            const subtotal = 100.0;
            const result = calculateCheckoutSalesTax(subtotal, false);
            expect(result.salesTax).toBe(8.88);
            expect(result.salesTaxRate).toBe(8.875);
            expect(result.isExempt).toBe(false);
            expect(result.legend).toBeNull();
        });

        it('Happy path: calculates exact 0% tax for ST-120 exempt user with official legend', () => {
            const subtotal = 450.75;
            const result = calculateCheckoutSalesTax(subtotal, true);
            expect(result.salesTax).toBe(0.0);
            expect(result.salesTaxRate).toBe(0.0);
            expect(result.isExempt).toBe(true);
            expect(result.legend).toContain('NYS DTF Form ST-120');
        });

        it('Happy path: handles $0.00 subtotal gracefully', () => {
            const result = calculateCheckoutSalesTax(0, false);
            expect(result.salesTax).toBe(0.0);
            expect(result.isExempt).toBe(false);
        });

        it('Sad path: throws error when subtotal is negative', () => {
            expect(() => calculateCheckoutSalesTax(-15.5, false)).toThrow(
                'Invalid discounted subtotal: must be a non-negative number'
            );
        });

        it('Sad path: throws error when subtotal is NaN', () => {
            expect(() => calculateCheckoutSalesTax(NaN, false)).toThrow(
                'Invalid discounted subtotal: must be a non-negative number'
            );
        });

        it('Sad path: throws error when tax rate is negative', () => {
            expect(() => calculateCheckoutSalesTax(100, false, -5)).toThrow(
                'Invalid tax rate: must be a non-negative number'
            );
        });
    });

    describe('validateNightAccessPayload (Happy & Sad Paths)', () => {
        it('Happy path: accepts valid full night access configuration', () => {
            const input = {
                access_code: 'Keypad #3421',
                has_key: true,
                key_location: 'Lockbox next to service entrance, code 9988',
                fridge_access_required: true,
                delivery_notes: 'Ring service bell twice before entering walk-in cold room',
            };

            const result = validateNightAccessPayload(input);
            expect(result.access_code).toBe('Keypad #3421');
            expect(result.has_key).toBe(true);
            expect(result.key_location).toBe('Lockbox next to service entrance, code 9988');
            expect(result.fridge_access_required).toBe(true);
            expect(result.delivery_notes).toContain('Ring service bell');
        });

        it('Happy path: normalizes access without key when has_key is false', () => {
            const input = {
                access_code: '#9000',
                has_key: false,
                key_location: 'Ignored location',
                fridge_access_required: false,
            };

            const result = validateNightAccessPayload(input);
            expect(result.access_code).toBe('#9000');
            expect(result.has_key).toBe(false);
            expect(result.key_location).toBeUndefined();
            expect(result.fridge_access_required).toBe(false);
        });

        it('Sad path: throws error if has_key is true but key_location is missing or empty', () => {
            const input = {
                has_key: true,
                key_location: '  ',
            };

            expect(() => validateNightAccessPayload(input)).toThrow(
                'Key location and lockbox code are required when physical key / lockbox is enabled'
            );
        });

        it('Sad path: throws error if access_code exceeds 50 characters', () => {
            const longCode = 'A'.repeat(51);
            expect(() => validateNightAccessPayload({ access_code: longCode })).toThrow(
                'Access code exceeds maximum allowed length of 50 characters'
            );
        });

        it('Sad path: throws error if delivery_notes exceeds 500 characters', () => {
            const longNotes = 'X'.repeat(501);
            expect(() => validateNightAccessPayload({ delivery_notes: longNotes })).toThrow(
                'Delivery notes exceed maximum allowed length of 500 characters'
            );
        });

        it('Sad path: throws error if payload is null or not an object', () => {
            expect(() => validateNightAccessPayload(null as any)).toThrow(
                'Payload must be a valid object'
            );
        });
    });

    describe('validateST120UploadFile (Happy & Sad Paths)', () => {
        it('Happy path: accepts standard PDF certificate under 15MB', () => {
            const file = {
                name: 'st120_nys_signed.pdf',
                type: 'application/pdf',
                size: 2 * 1024 * 1024,
            };
            expect(validateST120UploadFile(file)).toBe(true);
        });

        it('Happy path: accepts mobile camera photo under 15MB', () => {
            const file = {
                name: 'camera_capture_st120.jpg',
                type: 'image/jpeg',
                size: 4 * 1024 * 1024,
            };
            expect(validateST120UploadFile(file)).toBe(true);
        });

        it('Sad path: throws error if file type is unsupported (e.g. zip/exe)', () => {
            const file = {
                name: 'archive.zip',
                type: 'application/zip',
                size: 1024,
            };
            expect(() => validateST120UploadFile(file)).toThrow(
                'Invalid file type: only PDF documents or image files (camera photos) are supported'
            );
        });

        it('Sad path: throws error if file exceeds 15MB size limit', () => {
            const file = {
                name: 'heavy_scan.pdf',
                type: 'application/pdf',
                size: 16 * 1024 * 1024, // 16MB
            };
            expect(() => validateST120UploadFile(file)).toThrow(
                'File exceeds maximum size limit of 15MB'
            );
        });

        it('Sad path: throws error when file is null or undefined', () => {
            expect(() => validateST120UploadFile(null as any)).toThrow(
                'No file provided'
            );
        });
    });

    describe('validateST120RegistrationOption (Happy & Sad Paths)', () => {
        it('Happy path: Option 1 (Digital 1-Click) generates digital certificate', () => {
            const formData = {
                tax_id: '12-3456789',
                st120_mode: 'digital',
                st120_auto_generate: true,
            };

            const result = validateST120RegistrationOption(formData);
            expect(result.isValid).toBe(true);
            expect(result.mode).toBe('digital');
            expect(result.autoGenerate).toBe(true);
        });

        it('Happy path: Option 2 (Upload) accepts uploaded document URL', () => {
            const formData = {
                tax_id: '12-3456789',
                st120_mode: 'upload',
                st120_document_url: '/uploads/st120/client_st120.pdf',
            };

            const result = validateST120RegistrationOption(formData);
            expect(result.isValid).toBe(true);
            expect(result.mode).toBe('upload');
            expect(result.autoGenerate).toBe(false);
        });

        it('Sad path: throws error when Tax ID / EIN is missing in either option', () => {
            const formData = {
                tax_id: '   ',
                st120_mode: 'digital',
            };

            expect(() => validateST120RegistrationOption(formData)).toThrow(
                'Tax ID / EIN is required for wholesale registration'
            );
        });

        it('Sad path: throws error when Option 2 is selected but document url is missing', () => {
            const formData = {
                tax_id: '12-3456789',
                st120_mode: 'upload',
                st120_document_url: null,
            };

            expect(() => validateST120RegistrationOption(formData)).toThrow(
                'Uploaded Form ST-120 document copy is required when Option 2 (Upload) is selected'
            );
        });

        it('Sad path: throws error when formData is invalid', () => {
            expect(() => validateST120RegistrationOption(null as any)).toThrow(
                'Form data must be an object'
            );
        });
    });
});

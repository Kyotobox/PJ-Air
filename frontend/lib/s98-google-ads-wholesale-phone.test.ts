import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
    GOOGLE_ADS_WHOLESALE_CONFIG,
    formatWholesaleTelUri,
    validateGoogleAdsPhoneCompliance,
    parseWholesalePhone,
} from './google-ads-wholesale-phone';

describe('Sprint S98: Google Ads Wholesale Phone & Click-to-Call Compliance', () => {

    describe('SSSoT Configuration & Standards', () => {
        it('Happy Path: declares exact phone string required by Google Ads crawler', () => {
            expect(GOOGLE_ADS_WHOLESALE_CONFIG.exactDisplayText).toBe('Wholesale: (347) 761-2687');
            expect(GOOGLE_ADS_WHOLESALE_CONFIG.phoneNumberFormatted).toBe('(347) 761-2687');
            expect(GOOGLE_ADS_WHOLESALE_CONFIG.e164PhoneNumber).toBe('+13477612687');
            expect(GOOGLE_ADS_WHOLESALE_CONFIG.telHref).toBe('tel:+13477612687');
            expect(GOOGLE_ADS_WHOLESALE_CONFIG.areaCode).toBe('347');
            expect(GOOGLE_ADS_WHOLESALE_CONFIG.prefix).toBe('761');
            expect(GOOGLE_ADS_WHOLESALE_CONFIG.lineNumber).toBe('2687');
        });
    });

    describe('RFC 3966 `tel:` URI Formatting & Normalization', () => {
        it('Happy Path: normalizes formatted US phone string to RFC 3966 `tel:` link', () => {
            expect(formatWholesaleTelUri('(347) 761-2687')).toBe('tel:+13477612687');
            expect(formatWholesaleTelUri('3477612687')).toBe('tel:+13477612687');
            expect(formatWholesaleTelUri('+13477612687')).toBe('tel:+13477612687');
            expect(formatWholesaleTelUri('1-347-761-2687')).toBe('tel:+13477612687');
        });

        it('Sad Path (§6): throws error on empty or non-string input', () => {
            expect(() => formatWholesaleTelUri('')).toThrowError(/must not be empty/);
            expect(() => formatWholesaleTelUri(null as any)).toThrowError(/must not be empty/);
            expect(() => formatWholesaleTelUri(undefined as any)).toThrowError(/must not be empty/);
        });

        it('Sad Path (§6): throws error on invalid phone length or garbage characters', () => {
            expect(() => formatWholesaleTelUri('12345')).toThrowError(/Invalid US phone format/);
            expect(() => formatWholesaleTelUri('abc-def-ghij')).toThrowError(/Invalid US phone format/);
            expect(() => formatWholesaleTelUri('+442079460958')).toThrowError(/Invalid US phone format/);
        });
    });

    describe('Phone Parsing & Area Code Breakdown', () => {
        it('Happy Path: parses (347) 761-2687 into valid area code and subscriber components', () => {
            const parsed = parseWholesalePhone('(347) 761-2687');
            expect(parsed.countryCode).toBe('+1');
            expect(parsed.areaCode).toBe('347');
            expect(parsed.prefix).toBe('761');
            expect(parsed.lineNumber).toBe('2687');
        });

        it('Sad Path (§6): throws error on empty or malformed phone parsing', () => {
            expect(() => parseWholesalePhone('')).toThrowError(/Phone string is required/);
            expect(() => parseWholesalePhone('347-761')).toThrowError(/Cannot parse phone with 6 digits/);
        });
    });

    describe('Google Ads Compliance Verification Engine', () => {
        it('Happy Path: passes validation when HTML contains both exact text and tel: protocol', () => {
            const validHtml = `
                <footer>
                    <a href="tel:+13477612687">Wholesale: (347) 761-2687</a>
                </footer>
            `;
            const result = validateGoogleAdsPhoneCompliance(validHtml);
            expect(result.compliant).toBe(true);
            expect(result.hasExactText).toBe(true);
            expect(result.hasTelProtocol).toBe(true);
        });

        it('Sad Path (§6): throws when content is empty or null', () => {
            expect(() => validateGoogleAdsPhoneCompliance('')).toThrowError(/cannot be null or empty/);
        });

        it('Sad Path (§6): throws when exact text is missing', () => {
            const missingTextHtml = `<a href="tel:+13477612687">Call us now</a>`;
            expect(() => validateGoogleAdsPhoneCompliance(missingTextHtml)).toThrowError(
                /Missing exact Google Ads required text/
            );
        });

        it('Sad Path (§6): throws when tel: link is missing even if text is displayed', () => {
            const missingTelHtml = `<span>Wholesale: (347) 761-2687</span>`;
            expect(() => validateGoogleAdsPhoneCompliance(missingTelHtml)).toThrowError(
                /Missing direct dial click-to-call link/
            );
        });
    });

    describe('Static Code Analysis: Physical Verification of Key Components', () => {
        const rootDir = path.resolve(__dirname, '..');

        it('Physical Path: Footer.tsx contains exact text and tel: protocol', () => {
            const footerPath = path.join(rootDir, 'components/layout/Footer.tsx');
            expect(fs.existsSync(footerPath)).toBe(true);
            const content = fs.readFileSync(footerPath, 'utf8');

            const validation = validateGoogleAdsPhoneCompliance(content);
            expect(validation.compliant).toBe(true);
            expect(content).toContain('Wholesale: (347) 761-2687');
            expect(content).toContain('tel:+13477612687');
        });

        it('Physical Path: Navbar.tsx exposes wholesale phone in top bar, desktop nav and mobile drawer', () => {
            const navbarPath = path.join(rootDir, 'components/layout/Navbar.tsx');
            expect(fs.existsSync(navbarPath)).toBe(true);
            const content = fs.readFileSync(navbarPath, 'utf8');

            const validation = validateGoogleAdsPhoneCompliance(content);
            expect(validation.compliant).toBe(true);
            expect(content).toContain('Wholesale: (347) 761-2687');
            expect(content).toContain('tel:+13477612687');

            // Header top announcement banner
            expect(content).toContain('bg-[#5B0606]');
            // Mobile drawer call container
            expect(content).toContain('Direct Wholesale Line');
        });

        it('Physical Path: page.tsx imports and mounts Footer and includes wholesale phone pill', () => {
            const pagePath = path.join(rootDir, 'app/page.tsx');
            expect(fs.existsSync(pagePath)).toBe(true);
            const content = fs.readFileSync(pagePath, 'utf8');

            expect(content).toContain("import Footer from '@/components/layout/Footer'");
            expect(content).toContain('<Footer />');
            expect(content).toContain('Wholesale: (347) 761-2687');
            expect(content).toContain('tel:+13477612687');
        });

        it('Physical Path: terms/page.tsx and privacy/page.tsx import and mount Footer', () => {
            const termsPath = path.join(rootDir, 'app/terms/page.tsx');
            const privacyPath = path.join(rootDir, 'app/privacy/page.tsx');

            expect(fs.existsSync(termsPath)).toBe(true);
            expect(fs.existsSync(privacyPath)).toBe(true);

            const termsContent = fs.readFileSync(termsPath, 'utf8');
            const privacyContent = fs.readFileSync(privacyPath, 'utf8');

            expect(termsContent).toContain("import Footer from '@/components/layout/Footer'");
            expect(termsContent).toContain('<Footer />');

            expect(privacyContent).toContain("import Footer from '@/components/layout/Footer'");
            expect(privacyContent).toContain('<Footer />');
        });

        it('Physical Path: ExternalPortalLanding and TemporarilyClosed contain wholesale phone and tel link', () => {
            const externalLandingPath = path.join(rootDir, 'components/landing/ExternalPortalLanding.tsx');
            const tempClosedPath = path.join(rootDir, 'components/landing/TemporarilyClosed.tsx');

            const extContent = fs.readFileSync(externalLandingPath, 'utf8');
            const tempContent = fs.readFileSync(tempClosedPath, 'utf8');

            expect(validateGoogleAdsPhoneCompliance(extContent).compliant).toBe(true);
            expect(validateGoogleAdsPhoneCompliance(tempContent).compliant).toBe(true);
        });
    });
});

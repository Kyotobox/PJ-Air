import { describe, it, expect } from 'vitest';
import {
  JHOANES_LEGAL_IDENTITY,
  META_PIXEL_CONFIG,
  THIRD_PARTY_PROCESSORS,
  PRIVACY_SECTIONS,
  validatePrivacySection,
  verifyComplianceSanityCheck,
} from './privacy-policy-helper';

describe('S84B B2B Privacy Policy Specification Compliance', () => {
  describe('Legal Identity & Controller Verification', () => {
    it('Happy Path: verifies official legal company name and physical headquarters', () => {
      expect(JHOANES_LEGAL_IDENTITY.companyName).toBe('Jhoanes Bakery & Coffee LLC');
      expect(JHOANES_LEGAL_IDENTITY.address).toBe('33-04 Broadway');
      expect(JHOANES_LEGAL_IDENTITY.cityStateZip).toBe('Astoria, NY 11106');
      expect(JHOANES_LEGAL_IDENTITY.primaryEmail).toBe('info@jhoanes.com');
      expect(JHOANES_LEGAL_IDENTITY.ordersEmail).toBe('orders@jhoanes.com');
      expect(JHOANES_LEGAL_IDENTITY.jurisdiction).toContain('New York');
    });
  });

  describe('Meta Pixel & Tracking Technologies', () => {
    it('Happy Path: declares explicit Meta Pixel ID 2166007261006109 and ad conversion platforms', () => {
      expect(META_PIXEL_CONFIG.metaPixelId).toBe('2166007261006109');
      expect(META_PIXEL_CONFIG.provider).toBe('Meta Platforms, Inc.');
      expect(META_PIXEL_CONFIG.platforms).toContain('Facebook');
      expect(META_PIXEL_CONFIG.platforms).toContain('Instagram');
      expect(META_PIXEL_CONFIG.optOutUrl).toContain('facebook.com/adpreferences');
    });

    it('Happy Path: tracking section contains standard conversion events and opt-out rights in EN and ES', () => {
      const section = validatePrivacySection('tracking');
      expect(section.contentEn.some(c => c.includes('2166007261006109'))).toBe(true);
      expect(section.contentEs.some(c => c.includes('2166007261006109'))).toBe(true);
      expect(section.contentEn.some(c => c.includes('ViewContent') && c.includes('Purchase'))).toBe(true);
      expect(section.contentEs.some(c => c.includes('CompleteRegistration'))).toBe(true);
      expect(section.contentEn.some(c => c.includes('optout.aboutads.info'))).toBe(true);
      expect(section.contentEs.some(c => c.includes('Digital Advertising Alliance'))).toBe(true);
    });
  });

  describe('B2B Wholesale Purposes & NYS DTF ST-120 Compliance', () => {
    it('Happy Path: contains all 4 mandatory B2B wholesale collection purposes', () => {
      const section = validatePrivacySection('purposes');
      expect(section.subsections).toBeDefined();
      expect(section.subsections?.length).toBe(4);

      const titlesEn = section.subsections?.map(s => s.subtitleEn) || [];
      expect(titlesEn.some(t => t.includes('Wholesale Commercial Accounts'))).toBe(true);
      expect(titlesEn.some(t => t.includes('Tri-State Logistics (NY/NJ)'))).toBe(true);
      expect(titlesEn.some(t => t.includes('ST-120'))).toBe(true);
      expect(titlesEn.some(t => t.includes('Operational & Billing Communications'))).toBe(true);

      const titlesEs = section.subsections?.map(s => s.subtitleEs) || [];
      expect(titlesEs.some(t => t.includes('Cuentas Comerciales Mayoristas'))).toBe(true);
      expect(titlesEs.some(t => t.includes('Tri-Estatal (NY/NJ)'))).toBe(true);
      expect(titlesEs.some(t => t.includes('ST-120'))).toBe(true);
      expect(titlesEs.some(t => t.includes('Comunicaciones Operativas'))).toBe(true);
    });
  });

  describe('Third-Party Service Providers (Stripe & Twilio)', () => {
    it('Happy Path: declares Stripe Inc. with ACH & credit card PCI-DSS Level 1 encryption', () => {
      const stripe = THIRD_PARTY_PROCESSORS.find(p => p.name === 'Stripe, Inc.');
      expect(stripe).toBeDefined();
      expect(stripe?.purposeEn).toContain('ACH');
      expect(stripe?.purposeEs).toContain('ACH');
      expect(stripe?.securityStandard).toContain('PCI-DSS Level 1');
    });

    it('Happy Path: declares Twilio Inc. with operational SMS dispatch notifications', () => {
      const twilio = THIRD_PARTY_PROCESSORS.find(p => p.name === 'Twilio, Inc.');
      expect(twilio).toBeDefined();
      expect(twilio?.purposeEn).toContain('SMS');
      expect(twilio?.purposeEs).toContain('SMS');
      expect(twilio?.securityStandard).toContain('SOC 2');
    });
  });

  describe('Data Retention & ARCO / NY SHIELD Privacy Rights', () => {
    it('Happy Path: stipulates 3-year statutory retention for NYS DTF Form ST-120 and zero data sale', () => {
      const section = validatePrivacySection('rights');
      expect(section.contentEn.some(c => c.includes('three (3) years') || c.includes('ST-120'))).toBe(true);
      expect(section.contentEs.some(c => c.includes('tres (3) años') || c.includes('ST-120'))).toBe(true);
      expect(section.contentEn.some(c => c.includes('NOT sell'))).toBe(true);
      expect(section.contentEs.some(c => c.includes('NO vende'))).toBe(true);
    });

    it('Happy Path: compliance sanity check passes all checks', () => {
      const sanity = verifyComplianceSanityCheck();
      expect(sanity.hasLegalIdentity).toBe(true);
      expect(sanity.hasMetaPixel).toBe(true);
      expect(sanity.hasStripe).toBe(true);
      expect(sanity.hasTwilio).toBe(true);
      expect(sanity.hasSt120).toBe(true);
      expect(sanity.hasArco).toBe(true);
    });
  });

  describe('Sad Path Validations (§6)', () => {
    it('Sad Path 1: throws error when section identifier does not exist', () => {
      expect(() => validatePrivacySection('non_existent_section')).toThrowError(
        /Invalid privacy policy section identifier: "non_existent_section"/
      );
    });

    it('Sad Path 2: throws error when section identifier is empty string', () => {
      expect(() => validatePrivacySection('')).toThrowError(
        /Invalid privacy policy section identifier: ""/
      );
    });

    it('Sad Path 3: throws error when section identifier is malformed or null-like', () => {
      expect(() => validatePrivacySection(' ')).toThrowError(
        /Invalid privacy policy section identifier: " "/
      );
    });
  });
});

import { describe, it, expect } from 'vitest';
import { isSpanishAdTraffic, isSpanishBrowserLanguage } from './LanguageContext';

describe('LanguageContext Spanish Ad Traffic and Locale Detection', () => {
  describe('isSpanishAdTraffic', () => {
    it('detects lang=es parameter regardless of case', () => {
      expect(isSpanishAdTraffic('?lang=es')).toBe(true);
      expect(isSpanishAdTraffic('lang=ES')).toBe(true);
      expect(isSpanishAdTraffic('?foo=bar&lang=es&baz=1')).toBe(true);
      expect(isSpanishAdTraffic('?lang=en')).toBe(false);
    });

    it('detects utm_content=es parameter regardless of case', () => {
      expect(isSpanishAdTraffic('?utm_content=es')).toBe(true);
      expect(isSpanishAdTraffic('?utm_content=ES')).toBe(true);
      expect(isSpanishAdTraffic('?utm_source=meta&utm_content=es&utm_medium=cpc')).toBe(true);
      expect(isSpanishAdTraffic('?utm_content=en')).toBe(false);
    });

    it('detects utm_campaign containing es or spanish', () => {
      expect(isSpanishAdTraffic('?utm_campaign=ad_es_wholesale')).toBe(true);
      expect(isSpanishAdTraffic('?utm_campaign=summer_spanish_croissants')).toBe(true);
      expect(isSpanishAdTraffic('?utm_campaign=SPANISH_CAMPAIGN')).toBe(true);
      expect(isSpanishAdTraffic('?utm_campaign=nyc_bakery_english')).toBe(false);
    });

    it('returns false on empty string, non-matching parameters, or null input (sad path)', () => {
      expect(isSpanishAdTraffic('')).toBe(false);
      expect(isSpanishAdTraffic(null as any)).toBe(false);
      expect(isSpanishAdTraffic(undefined as any)).toBe(false);
      expect(isSpanishAdTraffic('?utm_source=meta&utm_medium=cpc')).toBe(false);
    });

    it('handles malformed query strings gracefully without throwing (sad path)', () => {
      expect(isSpanishAdTraffic('?%%%invalid-encoding%%%')).toBe(false);
    });
  });

  describe('isSpanishBrowserLanguage', () => {
    it('detects browser languages starting with es', () => {
      expect(isSpanishBrowserLanguage('es')).toBe(true);
      expect(isSpanishBrowserLanguage('es-US')).toBe(true);
      expect(isSpanishBrowserLanguage('es-ES')).toBe(true);
      expect(isSpanishBrowserLanguage('es-419')).toBe(true);
      expect(isSpanishBrowserLanguage('ES-MX')).toBe(true);
    });

    it('returns false for non-Spanish languages', () => {
      expect(isSpanishBrowserLanguage('en')).toBe(false);
      expect(isSpanishBrowserLanguage('en-US')).toBe(false);
      expect(isSpanishBrowserLanguage('fr-FR')).toBe(false);
    });

    it('returns false for empty or undefined language string (sad path)', () => {
      expect(isSpanishBrowserLanguage('')).toBe(false);
      expect(isSpanishBrowserLanguage(undefined)).toBe(false);
    });
  });
});

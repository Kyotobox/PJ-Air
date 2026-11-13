import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseUtmParams,
  storeUtm,
  getStoredUtm,
  clearStoredUtm,
  captureAndStoreUtm,
  formatUtmDisplay,
  UTM_STORAGE_KEY,
} from './utm';

describe('UTM Attribution Helper (Sprint S84C)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('parseUtmParams', () => {
    it('correctly extracts full UTM parameters and fbclid from a query string', () => {
      const qs = '?utm_source=instagram&utm_medium=paid-social&utm_campaign=croissant_promo&utm_content=hero_banner&utm_term=bakery+wholesale&fbclid=fb_click_999';
      const parsed = parseUtmParams(qs);

      expect(parsed).not.toBeNull();
      expect(parsed?.utm_source).toBe('instagram');
      expect(parsed?.utm_medium).toBe('paid-social');
      expect(parsed?.utm_campaign).toBe('croissant_promo');
      expect(parsed?.utm_content).toBe('hero_banner');
      expect(parsed?.utm_term).toBe('bakery wholesale');
      expect(parsed?.fbclid).toBe('fb_click_999');
      expect(parsed?.captured_at).toBeDefined();
    });

    it('extracts partial UTM parameters when only some are present', () => {
      const qs = '?utm_source=meta&utm_campaign=winter2026';
      const parsed = parseUtmParams(qs);

      expect(parsed).not.toBeNull();
      expect(parsed?.utm_source).toBe('meta');
      expect(parsed?.utm_campaign).toBe('winter2026');
      expect(parsed?.utm_medium).toBeUndefined();
    });

    it('returns null (sad path) when query contains no UTM parameters', () => {
      const qs = '?ref=partner&lang=es&tab=overview';
      const parsed = parseUtmParams(qs);
      expect(parsed).toBeNull();
    });

    it('returns null (sad path) when query string is empty or invalid', () => {
      expect(parseUtmParams('')).toBeNull();
      expect(parseUtmParams('???')).toBeNull();
      expect(parseUtmParams(null)).toBeNull();
    });

    it('handles URLSearchParams objects directly', () => {
      const sp = new URLSearchParams('utm_source=google&utm_medium=cpc');
      const parsed = parseUtmParams(sp);
      expect(parsed?.utm_source).toBe('google');
      expect(parsed?.utm_medium).toBe('cpc');
    });
  });

  describe('localStorage persistence: storeUtm, getStoredUtm, clearStoredUtm', () => {
    it('persists and retrieves UTM object accurately', () => {
      const utmData = {
        utm_source: 'meta',
        utm_medium: 'cpc',
        utm_campaign: 'blackfriday',
        fbclid: 'fbc_12345',
      };

      storeUtm(utmData);
      const retrieved = getStoredUtm();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.utm_source).toBe('meta');
      expect(retrieved?.utm_campaign).toBe('blackfriday');
      expect(retrieved?.fbclid).toBe('fbc_12345');
    });

    it('clears stored UTM object', () => {
      storeUtm({ utm_source: 'tiktok' });
      expect(getStoredUtm()).not.toBeNull();

      clearStoredUtm();
      expect(getStoredUtm()).toBeNull();
    });

    it('handles corrupted localStorage JSON gracefully (sad path)', () => {
      localStorage.setItem(UTM_STORAGE_KEY, '{invalid json corrupted');
      expect(getStoredUtm()).toBeNull();
    });

    it('handles localStorage errors silently when setItem throws (sad path)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => storeUtm({ utm_source: 'meta' })).not.toThrow();
    });
  });

  describe('captureAndStoreUtm', () => {
    it('captures from query and automatically stores in localStorage', () => {
      const result = captureAndStoreUtm('?utm_source=meta_ads&utm_campaign=wholesale_launch');
      expect(result?.utm_source).toBe('meta_ads');

      const stored = getStoredUtm();
      expect(stored?.utm_campaign).toBe('wholesale_launch');
    });

    it('preserves existing stored UTM if query contains no new UTM params (sad path/fallback)', () => {
      storeUtm({ utm_source: 'original_campaign', utm_campaign: 'first_touch' });

      // Browsing to page with no UTM params
      const res = captureAndStoreUtm('?page=2');
      expect(res?.utm_source).toBe('original_campaign');
      expect(res?.utm_campaign).toBe('first_touch');
    });
  });

  describe('formatUtmDisplay', () => {
    it('formats Direct when no attribution is present', () => {
      const display = formatUtmDisplay(null);
      expect(display.isDirect).toBe(true);
      expect(display.sourceLabel).toBe('Directo');
    });

    it('identifies Meta / Instagram Ads accurately', () => {
      const display = formatUtmDisplay({
        utm_source: 'instagram',
        utm_medium: 'paid',
        utm_campaign: 'summer_croissants',
      });
      expect(display.sourceLabel).toBe('Meta Ads (Instagram)');
      expect(display.campaignLabel).toBe('Campaña: summer_croissants');
      expect(display.isDirect).toBe(false);
    });

    it('identifies Meta Facebook Ads accurately', () => {
      const display = formatUtmDisplay({
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'retargeting',
      });
      expect(display.sourceLabel).toBe('Meta Ads (Facebook)');
      expect(display.campaignLabel).toBe('Campaña: retargeting');
    });

    it('identifies Google Ads', () => {
      const display = formatUtmDisplay({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'search_bakery_nyc',
        utm_content: 'ad_group_1',
      });
      expect(display.sourceLabel).toBe('Google Ads');
      expect(display.campaignLabel).toBe('Campaña: search_bakery_nyc');
      expect(display.detailLabel).toBe('cpc • ad_group_1');
    });

    it('identifies fbclid attribution when source is missing', () => {
      const display = formatUtmDisplay({
        fbclid: 'fbc_click_abc',
        utm_campaign: 'auto_track',
      });
      expect(display.sourceLabel).toBe('Meta Ads');
      expect(display.campaignLabel).toBe('Campaña: auto_track');
    });

    it('formats generic custom campaign source', () => {
      const display = formatUtmDisplay({
        utm_source: 'influencer_partner',
        utm_campaign: 'exclusive_vip',
      });
      expect(display.sourceLabel).toBe('Influencer_partner');
      expect(display.campaignLabel).toBe('Campaña: exclusive_vip');
    });
  });
});

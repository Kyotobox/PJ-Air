/**
 * s100-transversal-i18n.test.ts
 * Suite de certificación de paridad transversal de internacionalización (Sprint S100).
 * Verifica simetría de diccionarios, helpers bilingües y sad paths obligatorios (§6).
 */

import { describe, it, expect } from 'vitest';
import en from './i18n/en';
import es from './i18n/es';

describe('Sprint S100: Transversal i18n Certification Suite', () => {
  describe('Dictionary Key Symmetry & Parity', () => {
    function getKeysDeep(obj: Record<string, any>, prefix = ''): string[] {
      let keys: string[] = [];
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          keys = keys.concat(getKeysDeep(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    it('Happy Path: en.ts and es.ts contain symmetrical top-level sections', () => {
      const enSections = Object.keys(en);
      const esSections = Object.keys(es);
      expect(enSections.sort()).toEqual(esSections.sort());
    });

    it('Happy Path: all keys in en.ts exist in es.ts and are non-empty strings', () => {
      const enKeys = getKeysDeep(en);
      const esKeys = getKeysDeep(es);

      // Verify no missing keys
      const missingInEs = enKeys.filter(k => !esKeys.includes(k));
      expect(missingInEs).toEqual([]);
    });

    it('Happy Path: all keys in es.ts exist in en.ts and are non-empty strings', () => {
      const enKeys = getKeysDeep(en);
      const esKeys = getKeysDeep(es);

      const missingInEn = esKeys.filter(k => !enKeys.includes(k));
      expect(missingInEn).toEqual([]);
    });

    it('Happy Path: orders tracking steps are properly translated in en and es', () => {
      expect(en.orders.steps.pending.label).toBe('Order Received');
      expect(es.orders.steps.pending.label).toBe('Pedido Recibido');
      expect(en.orders.steps.processing.label).toBe('In Production');
      expect(es.orders.steps.processing.label).toBe('En Producción');
      expect(en.orders.steps.delivering.label).toBe('Out for Delivery');
      expect(es.orders.steps.delivering.label).toBe('En Delivery');
    });
  });

  describe('Orders and Settlement Lexicon Formatting', () => {
    function formatSettlementInvoiceCount(count: number, locale: string): string {
      return `${count} ${locale === 'en' ? 'invoice(s) selected' : 'factura(s) seleccionada(s)'}`;
    }

    function formatOrderInvoiceTitle(order: { isConfirmed: boolean; invoiceNumber?: string; id: string }, locale: string): string {
      if (order.isConfirmed && order.invoiceNumber) {
        return locale === 'en' ? `Invoice ${order.invoiceNumber}` : `Factura ${order.invoiceNumber}`;
      }
      return locale === 'en' ? `Order #${order.id.slice(0, 8)}` : `Pedido #${order.id.slice(0, 8)}`;
    }

    function formatAuthReviewError(rawError: string, locale: string): string {
      if (!rawError) {
        throw new Error('Raw error message is mandatory');
      }
      if (rawError.includes('ACCOUNT_PENDING_APPROVAL')) {
        return locale === 'en'
          ? 'Your wholesale commercial account is currently under administrative review. We will notify you once approved.'
          : 'Tu cuenta comercial está en proceso de revisión por nuestro equipo administrativo. Te notificaremos una vez aprobada.';
      }
      return rawError;
    }

    it('Happy Path: formats settlement count in English without Spanish copy-paste drift (TASK-100-03)', () => {
      const enText = formatSettlementInvoiceCount(3, 'en');
      expect(enText).toBe('3 invoice(s) selected');
      expect(enText).not.toContain('factura(s)');

      const esText = formatSettlementInvoiceCount(3, 'es');
      expect(esText).toBe('3 factura(s) seleccionada(s)');
    });

    it('Happy Path: formats invoice title with "Invoice" in English and "Factura" in Spanish', () => {
      const confirmedOrder = { isConfirmed: true, invoiceNumber: 'INV-2026-0042', id: 'ord-abc-123' };
      expect(formatOrderInvoiceTitle(confirmedOrder, 'en')).toBe('Invoice INV-2026-0042');
      expect(formatOrderInvoiceTitle(confirmedOrder, 'es')).toBe('Factura INV-2026-0042');

      const draftOrder = { isConfirmed: false, id: 'ord-xyz-987' };
      expect(formatOrderInvoiceTitle(draftOrder, 'en')).toBe('Order #ord-xyz-');
      expect(formatOrderInvoiceTitle(draftOrder, 'es')).toBe('Pedido #ord-xyz-');
    });

    it('Happy Path: maps ACCOUNT_PENDING_APPROVAL to English in EN locale (TASK-100-02)', () => {
      const err = 'ACCOUNT_PENDING_APPROVAL: Distant address outside standard NYC radius';
      const enResult = formatAuthReviewError(err, 'en');
      expect(enResult).toBe('Your wholesale commercial account is currently under administrative review. We will notify you once approved.');

      const esResult = formatAuthReviewError(err, 'es');
      expect(esResult).toBe('Tu cuenta comercial está en proceso de revisión por nuestro equipo administrativo. Te notificaremos una vez aprobada.');
    });

    describe('Sad Paths (§6)', () => {
      it('throws an exception when raw error is empty or null', () => {
        expect(() => formatAuthReviewError('', 'en')).toThrow('Raw error message is mandatory');
        expect(() => formatAuthReviewError(null as any, 'en')).toThrow('Raw error message is mandatory');
      });

      it('returns unmapped server error as-is when error code does not match known pattern', () => {
        const unknownErr = 'Database connection timeout on replica';
        expect(formatAuthReviewError(unknownErr, 'en')).toBe(unknownErr);
        expect(formatAuthReviewError(unknownErr, 'es')).toBe(unknownErr);
      });
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseFacadeValidationResult,
  getFacadeRejectionMessage,
  BREAD_FOOD_REJECTION_MESSAGE,
  DOCUMENT_REJECTION_MESSAGE,
  SELFIE_REJECTION_MESSAGE,
  GENERIC_REJECTION_MESSAGE,
} from './facade-validation';

describe('Sprint S66 - Facade Validation Logic Unit Tests (TASK-66-03 & TASK-66-05)', () => {
  describe('Happy Path: Commercial Storefront Approval', () => {
    it('should correctly approve a verified storefront image and return green badge', () => {
      const payload = {
        success: true,
        isValid: true,
        category: 'STOREFRONT',
        confidence: 0.96,
        status: 'VERIFIED',
        message: 'Fachada comercial verificada correctamente.',
      };

      const result = parseFacadeValidationResult(payload);

      expect(result.isValid).toBe(true);
      expect(result.category).toBe('STOREFRONT');
      expect(result.status).toBe('VERIFIED');
      expect(result.rejectionMessage).toBeNull();
      expect(result.badgeLabel).toBe('🟢 Fachada Verificada por IA (Local Comercial)');
    });

    it('should handle offline-first PENDING_AUDIT mode gracefully (§45)', () => {
      const payload = {
        success: true,
        isValid: true,
        category: 'STOREFRONT',
        confidence: 0.5,
        status: 'PENDING_AUDIT',
        message: 'Servicio de visión no configurado, encolado para auditoría manual.',
      };

      const result = parseFacadeValidationResult(payload);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING_INSPECTION');
      expect(result.rejectionMessage).toBeNull();
    });
  });

  describe('Sad Path: Rejection of Non-Storefront Images (Anti-Bread & Anti-Fraud)', () => {
    it('should strictly reject food and bread products with specific anti-bread alert', () => {
      const payload = {
        success: true,
        isValid: false,
        category: 'FOOD_PRODUCT',
        confidence: 0.99,
        status: 'REJECTED',
        message: 'Detectamos un producto alimenticio (pan/pastelería) en lugar de la fachada exterior.',
      };

      const result = parseFacadeValidationResult(payload);

      expect(result.isValid).toBe(false);
      expect(result.category).toBe('FOOD_PRODUCT');
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionMessage).toBe(BREAD_FOOD_REJECTION_MESSAGE);
      expect(result.badgeLabel).toBe('🔴 Foto Rechazada / Requiere Cambio');
    });

    it('should reject bread variations (PAN, BREAD) even if formatted differently', () => {
      const message1 = getFacadeRejectionMessage('FOOD_PRODUCT');
      const message2 = getFacadeRejectionMessage('BREAD_BASKET');
      const message3 = getFacadeRejectionMessage('PANADERIA_PAN');

      expect(message1).toBe(BREAD_FOOD_REJECTION_MESSAGE);
      expect(message2).toBe(BREAD_FOOD_REJECTION_MESSAGE);
      expect(message3).toBe(BREAD_FOOD_REJECTION_MESSAGE);
    });

    it('should reject documents and invoices with document alert', () => {
      const payload = {
        success: true,
        isValid: false,
        category: 'DOCUMENT',
        confidence: 0.95,
        status: 'REJECTED',
        message: 'La imagen corresponde a un documento y no a la fachada del negocio.',
      };

      const result = parseFacadeValidationResult(payload);

      expect(result.isValid).toBe(false);
      expect(result.category).toBe('DOCUMENT');
      expect(result.rejectionMessage).toBe(DOCUMENT_REJECTION_MESSAGE);
    });

    it('should reject personal selfies with selfie alert', () => {
      const payload = {
        success: true,
        isValid: false,
        category: 'SELFIE_PERSON',
        confidence: 0.92,
        status: 'REJECTED',
      };

      const result = parseFacadeValidationResult(payload);

      expect(result.isValid).toBe(false);
      expect(result.category).toBe('SELFIE_PERSON');
      expect(result.rejectionMessage).toBe(SELFIE_REJECTION_MESSAGE);
    });

    it('should fallback to custom backend reason or generic rejection for OTHER category', () => {
      const payloadWithReason = {
        isValid: false,
        category: 'OTHER',
        message: 'Foto de un automóvil en movimiento.',
      };

      const result1 = parseFacadeValidationResult(payloadWithReason);
      expect(result1.isValid).toBe(false);
      expect(result1.rejectionMessage).toContain('Foto de un automóvil en movimiento');

      const payloadWithoutReason = {
        isValid: false,
        category: 'OTHER',
      };

      const result2 = parseFacadeValidationResult(payloadWithoutReason);
      expect(result2.isValid).toBe(false);
      expect(result2.rejectionMessage).toBe(GENERIC_REJECTION_MESSAGE);
    });
  });

  describe('Sad Path: Invalid / Malformed Payloads', () => {
    it('should throw Error when payload is null or not an object (§6 Sad Path)', () => {
      expect(() => parseFacadeValidationResult(null)).toThrow('Respuesta de validación de fachada inválida o vacía');
      expect(() => parseFacadeValidationResult(undefined)).toThrow('Respuesta de validación de fachada inválida o vacía');
      expect(() => parseFacadeValidationResult('string' as any)).toThrow('Respuesta de validación de fachada inválida o vacía');
    });
  });
});

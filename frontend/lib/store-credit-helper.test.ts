/**
 * store-credit-helper.test.ts
 * Suite de pruebas unitarias para el motor de Saldo a Favor (Store Credit SC).
 * Cobertura exhaustiva de Happy Paths y Sad Paths (§6).
 */

import { describe, it, expect } from 'vitest';
import {
  formatVoucherCode,
  parseVoucherCode,
  isValidVoucherCode,
  normalizeVoucherCode,
  calculateCompensationAmount,
  calculateMaxAllowedCompensation,
  validateCompensationInput,
  assertValidCompensationInput,
  validateStoreCreditIssuance,
  assertValidStoreCreditIssuance,
  calculateNewBalance,
  formatStoreCreditBalance,
  getBalanceStatus,
  isIncidentApproved,
  sumApprovedStoreCredits,
} from './store-credit-helper';

describe('store-credit-helper', () => {
  describe('formatVoucherCode', () => {
    describe('Happy Paths', () => {
      it('formatea un correlativo numérico estándar con 4 dígitos (SC-2026-0001)', () => {
        expect(formatVoucherCode(1, 2026)).toBe('SC-2026-0001');
        expect(formatVoucherCode(42, 2026)).toBe('SC-2026-0042');
        expect(formatVoucherCode(999, 2026)).toBe('SC-2026-0999');
        expect(formatVoucherCode(1234, 2026)).toBe('SC-2026-1234');
      });

      it('preserva números de voucher que superan 4 dígitos sin truncamiento', () => {
        expect(formatVoucherCode(10001, 2026)).toBe('SC-2026-10001');
        expect(formatVoucherCode(99999, 2027)).toBe('SC-2027-99999');
      });

      it('utiliza el año en curso por defecto si no se provee', () => {
        const currentYear = new Date().getFullYear();
        expect(formatVoucherCode(7)).toBe(`SC-${currentYear}-0007`);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('lanza excepción ante números correlativos menores o iguales a cero', () => {
        expect(() => formatVoucherCode(0, 2026)).toThrow(
          'El número correlativo de voucher debe ser un entero positivo mayor a cero',
        );
        expect(() => formatVoucherCode(-5, 2026)).toThrow(
          'El número correlativo de voucher debe ser un entero positivo mayor a cero',
        );
      });

      it('lanza excepción ante números decimales o no enteros', () => {
        expect(() => formatVoucherCode(3.14, 2026)).toThrow(
          'El número correlativo de voucher debe ser un entero positivo mayor a cero',
        );
      });

      it('lanza excepción ante valores NaN, infinitos o no numéricos', () => {
        expect(() => formatVoucherCode(NaN, 2026)).toThrow(
          'El número correlativo de voucher debe ser un número finito válido',
        );
        expect(() => formatVoucherCode(Infinity, 2026)).toThrow(
          'El número correlativo de voucher debe ser un número finito válido',
        );
        expect(() => formatVoucherCode('42' as any, 2026)).toThrow(
          'El número correlativo de voucher debe ser un número finito válido',
        );
      });

      it('lanza excepción ante años fuera de rango gregoriano razonable (2000-2100)', () => {
        expect(() => formatVoucherCode(1, 1999)).toThrow(
          'El año del voucher debe ser un año gregoriano válido (2000-2100)',
        );
        expect(() => formatVoucherCode(1, 2150)).toThrow(
          'El año del voucher debe ser un año gregoriano válido (2000-2100)',
        );
        expect(() => formatVoucherCode(1, NaN)).toThrow(
          'El año del voucher debe ser un año gregoriano válido (2000-2100)',
        );
      });
    });
  });

  describe('parseVoucherCode & isValidVoucherCode', () => {
    describe('Happy Paths', () => {
      it('parsea correctamente códigos SC-YYYY-XXXX válidos', () => {
        const parsed = parseVoucherCode('SC-2026-0150');
        expect(parsed).toEqual({ year: 2026, sequence: 150 });
      });

      it('maneja minúsculas y espacios en blanco automáticamente', () => {
        const parsed = parseVoucherCode('  sc-2026-0005  ');
        expect(parsed).toEqual({ year: 2026, sequence: 5 });
      });

      it('valida con isValidVoucherCode formatos legítimos', () => {
        expect(isValidVoucherCode('SC-2026-0001')).toBe(true);
        expect(isValidVoucherCode('SC-2028-12345')).toBe(true);
      });

      it('normaliza códigos con normalizeVoucherCode', () => {
        expect(normalizeVoucherCode('  sc-2026-0001 ')).toBe('SC-2026-0001');
      });
    });

    describe('Sad Paths (§6)', () => {
      it('retorna null para valores null, undefined o tipos inválidos', () => {
        expect(parseVoucherCode(null)).toBeNull();
        expect(parseVoucherCode(undefined)).toBeNull();
        expect(parseVoucherCode('')).toBeNull();
        expect(parseVoucherCode(12345 as any)).toBeNull();
        expect(isValidVoucherCode(null)).toBe(false);
        expect(isValidVoucherCode('')).toBe(false);
      });

      it('retorna null para formatos malformados sin prefijo SC o con separador erróneo', () => {
        expect(parseVoucherCode('INV-2026-0001')).toBeNull();
        expect(parseVoucherCode('SC/2026/0001')).toBeNull();
        expect(parseVoucherCode('SC20260001')).toBeNull();
        expect(parseVoucherCode('SC-26-0001')).toBeNull(); // Año de 2 dígitos
        expect(parseVoucherCode('SC-2026-12')).toBeNull(); // Menos de 4 dígitos correlativos
        expect(isValidVoucherCode('SC-2026-12')).toBe(false);
      });

      it('retorna cadena vacía en normalizeVoucherCode para entradas inválidas', () => {
        expect(normalizeVoucherCode(null as any)).toBe('');
        expect(normalizeVoucherCode(undefined as any)).toBe('');
      });
    });
  });

  describe('calculateCompensationAmount', () => {
    describe('Happy Paths', () => {
      it('calcula el total de compensación producto de cantidad * precio unitario', () => {
        expect(calculateCompensationAmount(2, 15.5)).toBe(31.0);
        expect(calculateCompensationAmount(3, 4.25)).toBe(12.75);
        expect(calculateCompensationAmount(1, 0.99)).toBe(0.99);
      });

      it('redondea con precisión a 2 decimales evitando errores de punto flotante IEEE 754', () => {
        // 3 * 1.10 = 3.3000000000000003
        expect(calculateCompensationAmount(3, 1.1)).toBe(3.3);
        // 7 * 0.07 = 0.49000000000000005
        expect(calculateCompensationAmount(7, 0.07)).toBe(0.49);
      });

      it('permite precio 0 (artículo promocional bonificado)', () => {
        expect(calculateCompensationAmount(5, 0)).toBe(0);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('lanza excepción ante cantidades menores o iguales a 0', () => {
        expect(() => calculateCompensationAmount(0, 10)).toThrow(
          'La cantidad compensatoria debe ser un número positivo mayor a cero',
        );
        expect(() => calculateCompensationAmount(-1, 10)).toThrow(
          'La cantidad compensatoria debe ser un número positivo mayor a cero',
        );
      });

      it('lanza excepción ante precios negativos', () => {
        expect(() => calculateCompensationAmount(2, -5)).toThrow(
          'El precio unitario no puede ser negativo ni inválido',
        );
      });

      it('lanza excepción ante NaN o tipos erróneos', () => {
        expect(() => calculateCompensationAmount(NaN, 10)).toThrow();
        expect(() => calculateCompensationAmount(2, NaN)).toThrow();
        expect(() => calculateCompensationAmount('2' as any, 10)).toThrow();
      });
    });
  });

  describe('calculateMaxAllowedCompensation', () => {
    describe('Happy Paths', () => {
      it('calcula la diferencia entre el total de la orden y montos ya compensados', () => {
        expect(calculateMaxAllowedCompensation(150.0, 50.0)).toBe(100.0);
        expect(calculateMaxAllowedCompensation(200.0, 0)).toBe(200.0);
      });

      it('retorna 0 si ya se compensó la totalidad o más de la orden', () => {
        expect(calculateMaxAllowedCompensation(100.0, 100.0)).toBe(0);
        expect(calculateMaxAllowedCompensation(100.0, 150.0)).toBe(0);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('maneja valores no numéricos o negativos retornando 0 de forma segura', () => {
        expect(calculateMaxAllowedCompensation(-50, 0)).toBe(0);
        expect(calculateMaxAllowedCompensation(NaN as any, 10)).toBe(0);
        expect(calculateMaxAllowedCompensation(100, NaN as any)).toBe(100);
      });
    });
  });

  describe('validateCompensationInput & assertValidCompensationInput', () => {
    describe('Happy Paths', () => {
      it('valida exitosamente parámetros correctos', () => {
        const res = validateCompensationInput({
          quantity: 2,
          unitPrice: 12.5,
          maxQuantity: 5,
        });
        expect(res.isValid).toBe(true);
        expect(res.amount).toBe(25.0);
      });

      it('aserta con éxito retornando el monto compensatorio con assertValidCompensationInput', () => {
        const amount = assertValidCompensationInput({
          quantity: 3,
          unitPrice: 10.0,
          maxQuantity: 3,
        });
        expect(amount).toBe(30.0);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('falla cuando la cantidad excede la cantidad máxima de la orden', () => {
        const res = validateCompensationInput({
          quantity: 4,
          unitPrice: 10.0,
          maxQuantity: 2,
        });
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('no puede exceder las unidades ordenadas');
        expect(() =>
          assertValidCompensationInput({
            quantity: 4,
            unitPrice: 10.0,
            maxQuantity: 2,
          }),
        ).toThrow('no puede exceder las unidades ordenadas');
      });

      it('falla cuando la cantidad es decimal, 0 o negativa', () => {
        expect(validateCompensationInput({ quantity: 0, unitPrice: 10 }).isValid).toBe(false);
        expect(validateCompensationInput({ quantity: -1, unitPrice: 10 }).isValid).toBe(false);
        expect(validateCompensationInput({ quantity: 1.5, unitPrice: 10 }).isValid).toBe(false);
      });

      it('falla cuando el precio unitario es negativo', () => {
        expect(validateCompensationInput({ quantity: 1, unitPrice: -5 }).isValid).toBe(false);
      });

      it('falla cuando input es null o undefined', () => {
        expect(validateCompensationInput(null as any).isValid).toBe(false);
        expect(() => assertValidCompensationInput(null as any)).toThrow();
      });
    });
  });

  describe('validateStoreCreditIssuance & assertValidStoreCreditIssuance', () => {
    const validPayload = {
      orderId: 'ord-12345',
      productId: 42,
      quantity: 2,
      unitPrice: 15.0,
      maxQuantity: 5,
      reasonCategory: 'transit_damage',
      maxOrderTotal: 100.0,
      alreadyCreditedAmount: 0,
    };

    describe('Happy Paths', () => {
      it('aprueba la emisión cuando todos los datos y topes son consistentes', () => {
        const res = validateStoreCreditIssuance(validPayload);
        expect(res.isValid).toBe(true);
        expect(res.amount).toBe(30.0);
        expect(assertValidStoreCreditIssuance(validPayload)).toBe(30.0);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('falla cuando el monto compensatorio excede el total compensable de la orden', () => {
        const res = validateStoreCreditIssuance({
          ...validPayload,
          quantity: 5,
          unitPrice: 30.0, // 150.0 > 100.0
          maxQuantity: 10,
        });
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('supera el saldo compensable máximo');
        expect(() =>
          assertValidStoreCreditIssuance({
            ...validPayload,
            quantity: 5,
            unitPrice: 30.0,
            maxQuantity: 10,
          }),
        ).toThrow('supera el saldo compensable máximo');
      });

      it('falla cuando falta el orderId o productId es inválido', () => {
        expect(validateStoreCreditIssuance({ ...validPayload, orderId: '' }).isValid).toBe(false);
        expect(validateStoreCreditIssuance({ ...validPayload, productId: 0 }).isValid).toBe(false);
        expect(validateStoreCreditIssuance({ ...validPayload, productId: -1 }).isValid).toBe(false);
      });

      it('falla cuando falta el motivo de incidencia', () => {
        expect(validateStoreCreditIssuance({ ...validPayload, reasonCategory: '' }).isValid).toBe(false);
      });

      it('falla cuando el objeto de solicitud es nulo', () => {
        expect(validateStoreCreditIssuance(null as any).isValid).toBe(false);
        expect(() => assertValidStoreCreditIssuance(null as any)).toThrow();
      });
    });
  });

  describe('calculateNewBalance', () => {
    describe('Happy Paths', () => {
      it('incrementa el balance acumulado con operación credit', () => {
        expect(calculateNewBalance(100.0, 50.0, 'credit')).toBe(150.0);
        expect(calculateNewBalance(0, 25.75, 'credit')).toBe(25.75);
        expect(calculateNewBalance(null, 10.0, 'credit')).toBe(10.0);
      });

      it('decrementa el balance acumulado con operación debit', () => {
        expect(calculateNewBalance(100.0, 30.0, 'debit')).toBe(70.0);
        expect(calculateNewBalance(50.0, 50.0, 'debit')).toBe(0);
      });

      it('no permite que debit produzca balances negativos (piso en 0)', () => {
        expect(calculateNewBalance(20.0, 50.0, 'debit')).toBe(0);
      });

      it('mantiene la precisión decimal estricta a 2 decimales', () => {
        expect(calculateNewBalance(10.1, 0.2, 'credit')).toBe(10.3);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('lanza excepción ante un delta negativo', () => {
        expect(() => calculateNewBalance(100, -10, 'credit')).toThrow(
          'El valor delta debe ser un número no negativo',
        );
      });

      it('lanza excepción ante una operación desconocida', () => {
        expect(() => calculateNewBalance(100, 10, 'multiply' as any)).toThrow(
          'Operación de balance desconocida',
        );
      });

      it('lanza excepción ante delta NaN', () => {
        expect(() => calculateNewBalance(100, NaN, 'credit')).toThrow(
          'El valor delta debe ser un número no negativo',
        );
      });
    });
  });

  describe('formatStoreCreditBalance & getBalanceStatus', () => {
    describe('Happy Paths', () => {
      it('formatea montos con símbolo de moneda determinista', () => {
        expect(formatStoreCreditBalance(125.5)).toBe('$125.50');
        expect(formatStoreCreditBalance(0)).toBe('$0.00');
        expect(formatStoreCreditBalance(null)).toBe('$0.00');
        expect(formatStoreCreditBalance(undefined)).toBe('$0.00');
      });

      it('evalúa estado positivo cuando balance > 0', () => {
        const status = getBalanceStatus(45.5);
        expect(status.status).toBe('positive');
        expect(status.hasCredit).toBe(true);
        expect(status.label).toBe('Disponible');
        expect(status.color).toBe('emerald');
        expect(status.formatted).toBe('$45.50');
      });

      it('evalúa estado cero cuando balance es 0 o nulo', () => {
        const status = getBalanceStatus(0);
        expect(status.status).toBe('zero');
        expect(status.hasCredit).toBe(false);
        expect(status.label).toBe('Sin Saldo');
        expect(status.color).toBe('slate');
      });

      it('evalúa estado sobregiro cuando balance < 0', () => {
        const status = getBalanceStatus(-15.0);
        expect(status.status).toBe('negative');
        expect(status.hasCredit).toBe(false);
        expect(status.label).toBe('Sobregiro');
        expect(status.color).toBe('rose');
      });
    });
  });

  describe('isIncidentApproved & sumApprovedStoreCredits', () => {
    describe('Happy Paths', () => {
      it('reconoce incidencias aprobadas vs pendientes/rechazadas', () => {
        expect(isIncidentApproved({ status: 'approved' })).toBe(true);
        expect(isIncidentApproved({ status: 'pending_review' })).toBe(false);
        expect(isIncidentApproved({ status: 'rejected' })).toBe(false);
        expect(isIncidentApproved(null)).toBe(false);
      });

      it('suma montos solo de incidencias con status approved', () => {
        const list = [
          { status: 'approved', amount: 25.5 },
          { status: 'pending_review', amount: 10.0 },
          { status: 'approved', amount: 14.5 },
          { status: 'rejected', amount: 50.0 },
        ];
        expect(sumApprovedStoreCredits(list)).toBe(40.0);
      });

      it('retorna 0 para listas vacías o nulas', () => {
        expect(sumApprovedStoreCredits([])).toBe(0);
        expect(sumApprovedStoreCredits(null)).toBe(0);
        expect(sumApprovedStoreCredits(undefined)).toBe(0);
      });
    });
  });
});

/**
 * incident-validation.test.ts
 * Suite de pruebas unitarias exhaustiva para validación de incidencias de entrega B2B (Sprint S96).
 * Incluye Happy Paths y Sad Paths obligatorios (§6).
 */

import { describe, it, expect } from 'vitest';
import {
  isWithinReportingWindow,
  validateIncidentPayload,
  assertValidIncidentPayload,
  getReasonConfig,
  isPhotoRequiredForReason,
  INCIDENT_REASONS,
} from './incident-validation';

describe('incident-validation', () => {
  const referenceNow = new Date(2026, 10, 17, 9, 30, 0); // 17 de Noviembre 2026, 09:30 AM
  const todayStr = '2026-11-17';
  const yesterdayStr = '2026-11-16';
  const tomorrowStr = '2026-11-18';

  describe('isWithinReportingWindow', () => {
    describe('Happy Paths', () => {
      it('permite reportes para entregas del día actual antes de las 10:00 AM (8:00 AM)', () => {
        const result = isWithinReportingWindow(todayStr, 8, { now: referenceNow });
        expect(result).toBe(true);
      });

      it('permite reportes para entregas del día actual exactamente a las 10:00 AM', () => {
        const result = isWithinReportingWindow(todayStr, 10, { now: referenceNow });
        expect(result).toBe(true);
      });

      it('permite reportes usando la hora implícita de la fecha de referencia cuando es < 10 AM', () => {
        // referenceNow es 09:30 AM
        const result = isWithinReportingWindow(todayStr, undefined, { now: referenceNow });
        expect(result).toBe(true);
      });

      it('soporta límite de hora configurable (maxHour: 12)', () => {
        const result = isWithinReportingWindow(todayStr, 11, {
          maxHour: 12,
          now: referenceNow,
        });
        expect(result).toBe(true);
      });

      it('permite reportes de órdenes diurnas dentro de la ventana de 24 horas', () => {
        // Orden diurna entregada ayer a las 14:00 (hace ~19.5 horas respecto a 09:30 AM de hoy)
        const daytimeDelivery = '2026-11-16 14:00:00';
        const result = isWithinReportingWindow(daytimeDelivery, 9, {
          isDaytimeOrder: true,
          now: referenceNow,
        });
        expect(result).toBe(true);
      });

      it('acepta boolean directo como tercer parámetro para órdenes diurnas', () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const daytimeDelivery = `${y}-${m}-${d} 08:00:00`;
        const result = isWithinReportingWindow(daytimeDelivery, 14, true);
        expect(result).toBe(true);
      });

      it('acepta objetos Date nativos además de strings', () => {
        const dateObj = new Date(2026, 10, 17, 6, 0, 0);
        const result = isWithinReportingWindow(dateObj, 9, { now: referenceNow });
        expect(result).toBe(true);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('bloquea reportes de entregas desatendidas después de las 10:00 AM (ej. 11:00 AM)', () => {
        const result = isWithinReportingWindow(todayStr, 11, { now: referenceNow });
        expect(result).toBe(false);
      });

      it('bloquea reportes cuando la hora calculada excede el maxHour configurable (hora 13 con maxHour 12)', () => {
        const result = isWithinReportingWindow(todayStr, 13, {
          maxHour: 12,
          now: referenceNow,
        });
        expect(result).toBe(false);
      });

      it('bloquea entregas desatendidas de días anteriores incluso si se reportan antes de las 10 AM', () => {
        const result = isWithinReportingWindow(yesterdayStr, 8, {
          isDaytimeOrder: false,
          now: referenceNow,
        });
        expect(result).toBe(false);
      });

      it('bloquea órdenes diurnas cuando han transcurrido más de 24 horas desde la entrega', () => {
        // Entrega realizada hace 30 horas
        const expiredDaytime = '2026-11-15 12:00:00';
        const result = isWithinReportingWindow(expiredDaytime, 18, {
          isDaytimeOrder: true,
          now: referenceNow,
        });
        expect(result).toBe(false);
      });

      it('bloquea reportes con fecha de entrega futura', () => {
        const result = isWithinReportingWindow(tomorrowStr, 9, { now: referenceNow });
        expect(result).toBe(false);
      });

      it('retorna false si deliveryDate es null, undefined o cadena vacía', () => {
        expect(isWithinReportingWindow(null)).toBe(false);
        expect(isWithinReportingWindow(undefined)).toBe(false);
        expect(isWithinReportingWindow('')).toBe(false);
      });

      it('retorna false si deliveryDate tiene un formato inválido', () => {
        expect(isWithinReportingWindow('fecha-invalida-xyz')).toBe(false);
      });

      it('retorna false si la hora solicitada está fuera del rango horario 0-23', () => {
        expect(isWithinReportingWindow(todayStr, -1, { now: referenceNow })).toBe(false);
        expect(isWithinReportingWindow(todayStr, 25, { now: referenceNow })).toBe(false);
      });
    });
  });

  describe('validateIncidentPayload', () => {
    const validBasePayload = {
      productId: 101,
      quantity: 5,
      maxQuantity: 12,
      reason: 'missing_kitchen',
      photoRequired: false,
      hasPhoto: false,
    };

    describe('Happy Paths', () => {
      it('valida exitosamente un faltante en cocina sin foto requerida', () => {
        const res = validateIncidentPayload(validBasePayload);
        expect(res.isValid).toBe(true);
        expect(res.error).toBeUndefined();
      });

      it('valida exitosamente un producto roto con foto adjunta', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          reason: 'transit_damage',
          photoRequired: true,
          hasPhoto: true,
        });
        expect(res.isValid).toBe(true);
        expect(res.error).toBeUndefined();
      });

      it('valida exitosamente cuando la cantidad es exactamente igual a maxQuantity', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          quantity: 12,
          maxQuantity: 12,
        });
        expect(res.isValid).toBe(true);
      });

      it('reconoce etiquetas descriptivas en español como motivos válidos', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          reason: 'Faltante en entrega',
        });
        expect(res.isValid).toBe(true);
      });
    });

    describe('Sad Paths (§6)', () => {
      it('falla cuando la cantidad excede la cantidad ordenada (exceso de cantidad)', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          quantity: 15,
          maxQuantity: 12,
        });
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('no puede exceder la cantidad ordenada');
      });

      it('falla cuando la cantidad es 0 o negativa', () => {
        const resZero = validateIncidentPayload({
          ...validBasePayload,
          quantity: 0,
        });
        expect(resZero.isValid).toBe(false);
        expect(resZero.error).toContain('mayor a 0');

        const resNegative = validateIncidentPayload({
          ...validBasePayload,
          quantity: -3,
        });
        expect(resNegative.isValid).toBe(false);
        expect(resNegative.error).toContain('mayor a 0');
      });

      it('falla cuando la cantidad no es un número entero', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          quantity: 2.5,
        });
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('número entero');
      });

      it('falla cuando el productId es menor o igual a 0 o no numérico', () => {
        const resInvalidId = validateIncidentPayload({
          ...validBasePayload,
          productId: 0,
        });
        expect(resInvalidId.isValid).toBe(false);
        expect(resInvalidId.error).toContain('producto válido');

        const resNaN = validateIncidentPayload({
          ...validBasePayload,
          productId: NaN,
        });
        expect(resNaN.isValid).toBe(false);
        expect(resNaN.error).toContain('producto válido');
      });

      it('falla cuando maxQuantity es inválido', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          maxQuantity: 0,
        });
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('cantidad máxima permitida');
      });

      it('falla cuando el motivo es vacío o no reconocido', () => {
        const resEmpty = validateIncidentPayload({
          ...validBasePayload,
          reason: '',
        });
        expect(resEmpty.isValid).toBe(false);
        expect(resEmpty.error).toContain('seleccionar un motivo');

        const resInvalid = validateIncidentPayload({
          ...validBasePayload,
          reason: 'motivo_inventado_random',
        });
        expect(resInvalid.isValid).toBe(false);
        expect(resInvalid.error).toContain('no es válido');
      });

      it('falla cuando se requiere foto (photoRequired: true) y hasPhoto es false', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          reason: 'transit_damage',
          photoRequired: true,
          hasPhoto: false,
        });
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('Se requiere adjuntar una fotografía');
      });

      it('falla cuando el motivo exige foto intrínsecamente y hasPhoto es false', () => {
        const res = validateIncidentPayload({
          ...validBasePayload,
          reason: 'quality_defect',
          photoRequired: false, // aunque el flag esté en false, quality_defect lo exige
          hasPhoto: false,
        });
        expect(res.isValid).toBe(false);
        expect(res.error).toContain('Se requiere adjuntar una fotografía');
      });

      it('falla si el payload es null o undefined', () => {
        const res = validateIncidentPayload(null as any);
        expect(res.isValid).toBe(false);
      });
    });
  });

  describe('assertValidIncidentPayload (Sad Paths con toThrow §6)', () => {
    it('no lanza excepción si el payload es íntegro y válido', () => {
      expect(() => {
        assertValidIncidentPayload({
          productId: 1,
          quantity: 2,
          maxQuantity: 5,
          reason: 'missing_kitchen',
          photoRequired: false,
          hasPhoto: false,
        });
      }).not.toThrow();
    });

    it('arroja excepción mandatoria ante exceso de cantidad', () => {
      expect(() => {
        assertValidIncidentPayload({
          productId: 1,
          quantity: 10,
          maxQuantity: 5,
          reason: 'missing_kitchen',
          photoRequired: false,
          hasPhoto: false,
        });
      }).toThrowError(/no puede exceder la cantidad ordenada/);
    });

    it('arroja excepción ante falta de fotografía requerida', () => {
      expect(() => {
        assertValidIncidentPayload({
          productId: 1,
          quantity: 1,
          maxQuantity: 5,
          reason: 'transit_damage',
          photoRequired: true,
          hasPhoto: false,
        });
      }).toThrowError(/Se requiere adjuntar una fotografía/);
    });

    it('arroja excepción ante motivo inválido', () => {
      expect(() => {
        assertValidIncidentPayload({
          productId: 1,
          quantity: 1,
          maxQuantity: 5,
          reason: 'invalido',
          photoRequired: false,
          hasPhoto: false,
        });
      }).toThrowError(/El motivo seleccionado no es válido/);
    });
  });

  describe('Configuración y helpers de motivos', () => {
    it('provee los 4 motivos canónicos de la doctrina de incidencias', () => {
      expect(INCIDENT_REASONS).toHaveLength(4);
      const ids = INCIDENT_REASONS.map((r) => r.id);
      expect(ids).toContain('missing_kitchen');
      expect(ids).toContain('transit_damage');
      expect(ids).toContain('quality_defect');
      expect(ids).toContain('wrong_item');
    });

    it('determina si un motivo requiere foto con isPhotoRequiredForReason', () => {
      expect(isPhotoRequiredForReason('missing_kitchen')).toBe(false);
      expect(isPhotoRequiredForReason('transit_damage')).toBe(true);
      expect(isPhotoRequiredForReason('quality_defect')).toBe(true);
      expect(isPhotoRequiredForReason('wrong_item')).toBe(true);
      expect(isPhotoRequiredForReason('desconocido')).toBe(false);
    });

    it('busca configuración por id o etiquetas en español e inglés', () => {
      expect(getReasonConfig('missing_kitchen')?.id).toBe('missing_kitchen');
      expect(getReasonConfig('Faltante en entrega')?.id).toBe('missing_kitchen');
      expect(getReasonConfig('Missing from delivery')?.id).toBe('missing_kitchen');
      expect(getReasonConfig('')).toBeUndefined();
    });
  });
});

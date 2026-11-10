import { describe, it, expect } from 'vitest';
import {
    isDateAvailableForDelivery,
    assertDateAvailableForDelivery,
    calculateDynamicMinDeliveryDate,
    parseDateString,
    getNewYorkDateTimeParts,
    formatDeliveryDatePretty,
    DEFAULT_DELIVERY_SCHEDULE,
    OFFICIAL_US_NY_HOLIDAYS,
    DeliveryScheduleConfig,
} from './delivery-schedule';

describe('Sprint S68 - Delivery Schedule Engine & Dynamic Date Calculation', () => {
    // Configuración base de prueba:
    // Días de despacho: Lunes (1), Miércoles (3), Jueves (4), Viernes (5), Sábado (6), Domingo (0).
    // Martes (2) cerrado.
    const mockConfig: DeliveryScheduleConfig = {
        workingDays: [0, 1, 3, 4, 5, 6],
        holidays: [
            { date: '2026-11-26', name: 'Thanksgiving Day' },
            { date: '2026-12-25', name: 'Christmas Day' },
            { date: '2027-01-01', name: "New Year's Day" },
        ],
        exceptionalDays: [
            { date: '2026-11-24', name: 'Thanksgiving Eve Prep (Special Tuesday)' },
        ],
        cutoffHour: 12,
    };

    // =========================================================================
    // TASK-68-05.1: isDateAvailableForDelivery & assertDateAvailableForDelivery
    // =========================================================================
    describe('isDateAvailableForDelivery - Happy Paths & Sad Paths (§6)', () => {
        it('Happy path: enabled day of the week returns available = true', () => {
            // 2026-11-25 es Miércoles (day 3), que está en workingDays
            const result = isDateAvailableForDelivery('2026-11-25', mockConfig);
            expect(result.available).toBe(true);
            expect(result.dayOfWeek).toBe(3);
            expect(result.reason).toBeUndefined();
        });

        it('Sad path (§6): disabled day of the week returns available = false with descriptive reason', () => {
            // 2026-11-17 es Martes (day 2), normalmente cerrado y no es excepcional
            const resultEs = isDateAvailableForDelivery('2026-11-17', mockConfig, 'es');
            expect(resultEs.available).toBe(false);
            expect(resultEs.dayOfWeek).toBe(2);
            expect(resultEs.reason).toBe('No realizamos entregas los días Martes');

            // Versión en inglés
            const resultEn = isDateAvailableForDelivery('2026-11-17', mockConfig, 'en');
            expect(resultEn.available).toBe(false);
            expect(resultEn.reason).toBe('We do not make deliveries on Tuesdays');
        });

        it('Sad path (§6): holiday blocks the date even if the day of week is an active working day', () => {
            // 2026-11-26 es Jueves (day 4, normalmente hábil), pero es Thanksgiving Day
            const result = isDateAvailableForDelivery('2026-11-26', mockConfig, 'es');
            expect(result.available).toBe(false);
            expect(result.holidayName).toBe('Thanksgiving Day');
            expect(result.reason).toContain('Día festivo no laborable: Thanksgiving Day');

            const resultEn = isDateAvailableForDelivery('2026-11-26', mockConfig, 'en');
            expect(resultEn.available).toBe(false);
            expect(resultEn.reason).toContain('Non-working holiday: Thanksgiving Day');
        });

        it('Happy path: extraordinary date approves delivery even if the day of week is normally closed', () => {
            // 2026-11-24 es Martes (normalmente cerrado), pero está en exceptionalDays
            const result = isDateAvailableForDelivery('2026-11-24', mockConfig);
            expect(result.available).toBe(true);
            expect(result.isExceptional).toBe(true);
            expect(result.exceptionalName).toBe('Thanksgiving Eve Prep (Special Tuesday)');
        });

        it('Sad path (§6): assertDateAvailableForDelivery throws Error with descriptive message when unavailable', () => {
            // Feriado debe lanzar excepción
            expect(() => assertDateAvailableForDelivery('2026-11-26', mockConfig, 'es'))
                .toThrow('Día festivo no laborable: Thanksgiving Day');

            // Día cerrado debe lanzar excepción
            expect(() => assertDateAvailableForDelivery('2026-11-17', mockConfig, 'es'))
                .toThrow('No realizamos entregas los días Martes');

            // Día hábil debe retornar true sin lanzar
            expect(assertDateAvailableForDelivery('2026-11-25', mockConfig)).toBe(true);
        });

        it('Sad path (§6): parseDateString and isDateAvailableForDelivery throw on invalid date input', () => {
            expect(() => parseDateString('invalid-date')).toThrow(/Invalid date string/);
            expect(() => parseDateString('')).toThrow(/Invalid date string/);
            expect(() => parseDateString('2026-13-45')).toThrow(/Date components out of range/);
            expect(() => isDateAvailableForDelivery('bad-format', mockConfig)).toThrow(/Invalid date string/);
            expect(() => isDateAvailableForDelivery('2026-11-25', null as any)).toThrow(/Invalid delivery schedule/);
        });
    });

    // =========================================================================
    // TASK-68-05.2: calculateDynamicMinDeliveryDate & Cutoff Calculations
    // =========================================================================
    describe('calculateDynamicMinDeliveryDate - Lead Time, Cutoff & Skips', () => {
        it('calculates T+2 when order is before cutoff (12:00 PM ET) and lands on working day', () => {
            // Domingo 2026-11-15 10:00 AM NY -> T+2 = Martes 17 (Martes cerrado) -> Salta a Miércoles 18 (Hábil)
            // Lunes 2026-11-16 10:00 AM NY -> T+2 = Miércoles 18 (Hábil)
            const referenceDate = new Date('2026-11-16T15:00:00.000Z'); // 10:00 AM ET (UTC-5)
            const minDate = calculateDynamicMinDeliveryDate(referenceDate, mockConfig);
            expect(minDate).toBe('2026-11-18');
        });

        it('calculates T+3 when order is after cutoff (12:00 PM ET) and respects cutoff strictness', () => {
            // Lunes 2026-11-16 1:00 PM NY (después de las 12 PM) -> T+3 = Jueves 19 (Hábil)
            const referenceDate = new Date('2026-11-16T18:00:00.000Z'); // 1:00 PM ET (UTC-5)
            const minDate = calculateDynamicMinDeliveryDate(referenceDate, mockConfig);
            expect(minDate).toBe('2026-11-19');
        });

        it('correctly skips inactive weekly day (Tuesday) automatically', () => {
            // Sábado 2026-11-14 10:00 AM NY -> T+2 = Lunes 16 (Hábil) -> '2026-11-16'
            // Domingo 2026-11-15 10:00 AM NY -> T+2 = Martes 17 (Cerrado) -> Salta a Miércoles 18!
            const sundayMorning = new Date('2026-11-15T15:00:00.000Z');
            const minDate = calculateDynamicMinDeliveryDate(sundayMorning, mockConfig);
            expect(minDate).toBe('2026-11-18');
        });

        it('correctly skips single holiday and lands on next working day', () => {
            // Martes 2026-11-24 10:00 AM NY -> T+2 = Jueves 26 (Thanksgiving Day - Feriado!)
            // Debe saltar Jueves 26 y aterrizar en Viernes 2026-11-27
            const tuesdayMorning = new Date('2026-11-24T15:00:00.000Z');
            const minDate = calculateDynamicMinDeliveryDate(tuesdayMorning, mockConfig);
            expect(minDate).toBe('2026-11-27');
        });

        it('correctly skips consecutive holidays and closed days', () => {
            // Configuramos feriados consecutivos: Jueves 26 y Viernes 27
            // Sábado y Domingo no están en workingDays en este config especial
            const customHolidayConfig: DeliveryScheduleConfig = {
                workingDays: [1, 2, 3, 4, 5], // Lunes a Viernes
                holidays: [
                    { date: '2026-11-26', name: 'Thanksgiving Day' },
                    { date: '2026-11-27', name: 'Day After Thanksgiving' },
                ],
                exceptionalDays: [],
                cutoffHour: 12,
            };

            // Martes 2026-11-24 10:00 AM NY -> T+2 = Jueves 26 (Feriado!)
            // Jueves 26: Feriado -> salta a Viernes 27
            // Viernes 27: Feriado -> salta a Sábado 28
            // Sábado 28: Fin de semana cerrado -> salta a Domingo 29
            // Domingo 29: Fin de semana cerrado -> salta a Lunes 30
            // Lunes 30: Hábil -> '2026-11-30'
            const tuesdayMorning = new Date('2026-11-24T15:00:00.000Z');
            const minDate = calculateDynamicMinDeliveryDate(tuesdayMorning, customHolidayConfig);
            expect(minDate).toBe('2026-11-30');
        });

        it('allows exceptional date override during min date search', () => {
            // Domingo 2026-11-22 10:00 AM NY -> T+2 = Martes 24
            // Normalmente Martes está cerrado, pero en mockConfig 2026-11-24 es excepcional
            const sundayMorning = new Date('2026-11-22T15:00:00.000Z');
            const minDate = calculateDynamicMinDeliveryDate(sundayMorning, mockConfig);
            expect(minDate).toBe('2026-11-24');
        });

        it('Sad path (§6): calculateDynamicMinDeliveryDate throws when no dates are available within 60 days', () => {
            const blockedConfig: DeliveryScheduleConfig = {
                workingDays: [], // Ningún día hábil
                holidays: [],
                exceptionalDays: [],
                cutoffHour: 12,
            };

            expect(() => calculateDynamicMinDeliveryDate(new Date('2026-11-16T12:00:00.000Z'), blockedConfig))
                .toThrow(/Unable to find an available delivery date/);
        });

        it('Sad path (§6): getNewYorkDateTimeParts throws on invalid date', () => {
            expect(() => getNewYorkDateTimeParts('not-a-valid-date')).toThrow(/Invalid reference date/);
        });
    });

    // =========================================================================
    // TASK-68-05.3: Official US / NY Holidays & Formatting
    // =========================================================================
    describe('OFFICIAL_US_NY_HOLIDAYS & Formatting Utilities', () => {
        it('contains standard federal/state holidays with valid date formatting', () => {
            expect(OFFICIAL_US_NY_HOLIDAYS.length).toBeGreaterThan(15);
            for (const h of OFFICIAL_US_NY_HOLIDAYS) {
                expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(h.name.length).toBeGreaterThan(3);
                // Validar que parseDateString no lance error
                expect(() => parseDateString(h.date)).not.toThrow();
            }

            // Verificar presencia de feriados clave
            const holidayNames = OFFICIAL_US_NY_HOLIDAYS.map(h => h.name);
            expect(holidayNames).toContain('Thanksgiving Day');
            expect(holidayNames).toContain('Christmas Day');
            expect(holidayNames).toContain("New Year's Day");
            expect(holidayNames).toContain('Independence Day');
            expect(holidayNames).toContain('Labor Day');
            expect(holidayNames).toContain('Memorial Day');
        });

        it('formats delivery date nicely in Spanish and English', () => {
            const formattedEs = formatDeliveryDatePretty('2026-11-25', 'es');
            expect(formattedEs.toLowerCase()).toContain('2026');
            expect(formattedEs.toLowerCase()).toContain('25');

            const formattedEn = formatDeliveryDatePretty('2026-11-25', 'en');
            expect(formattedEn.toLowerCase()).toContain('2026');
            expect(formattedEn.toLowerCase()).toContain('25');
        });

        it('DEFAULT_DELIVERY_SCHEDULE fulfills offline-first (§45) guarantees', () => {
            expect(DEFAULT_DELIVERY_SCHEDULE.workingDays).toEqual([0, 1, 3, 4, 5, 6]);
            expect(DEFAULT_DELIVERY_SCHEDULE.cutoffHour).toBe(12);
            expect(DEFAULT_DELIVERY_SCHEDULE.holidays.length).toBeGreaterThan(0);
        });
    });
});

/**
 * delivery-schedule.ts
 * Motor y tipos para el Cronograma Dinámico de Despacho (Sprint S68).
 * Soporta días operativos semanales, feriados (blackout dates) y excepciones extraordinarias.
 * Cumple con §4 (cero mocks en producción), §6 (sad paths) y §45 (offline-first).
 */

export interface DeliveryHoliday {
    date: string; // Formato YYYY-MM-DD
    name: string;
}

export interface DeliveryExceptionalDay {
    date: string; // Formato YYYY-MM-DD
    name: string;
}

export interface DeliveryScheduleConfig {
    workingDays: number[]; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    holidays: DeliveryHoliday[];
    exceptionalDays: DeliveryExceptionalDay[];
    cutoffHour?: number; // Por defecto 12 (12:00 PM ET)
}

export interface DateAvailabilityResult {
    available: boolean;
    reason?: string;
    holidayName?: string;
    exceptionalName?: string;
    isExceptional?: boolean;
    dayOfWeek?: number;
}

/**
 * Configuración por defecto (Offline-first §45).
 * Por defecto: Miércoles a Lunes operativos; Martes (2) no operativo.
 */
export const DEFAULT_DELIVERY_SCHEDULE: DeliveryScheduleConfig = {
    workingDays: [0, 1, 3, 4, 5, 6],
    holidays: [
        { date: '2026-11-26', name: "Thanksgiving Day" },
        { date: '2026-12-25', name: "Christmas Day" },
        { date: '2027-01-01', name: "New Year's Day" },
    ],
    exceptionalDays: [],
    cutoffHour: 12,
};

export const DAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Feriados oficiales típicos NY / US para carga en 1 clic.
 */
export const OFFICIAL_US_NY_HOLIDAYS: DeliveryHoliday[] = [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-19', name: "Martin Luther King Jr. Day" },
    { date: '2026-02-16', name: "Presidents' Day" },
    { date: '2026-05-25', name: "Memorial Day" },
    { date: '2026-06-19', name: "Juneteenth National Independence Day" },
    { date: '2026-07-04', name: "Independence Day" },
    { date: '2026-09-07', name: "Labor Day" },
    { date: '2026-10-12', name: "Columbus / Indigenous Peoples Day" },
    { date: '2026-11-11', name: "Veterans Day" },
    { date: '2026-11-26', name: "Thanksgiving Day" },
    { date: '2026-12-25', name: "Christmas Day" },
    { date: '2027-01-01', name: "New Year's Day" },
    { date: '2027-01-18', name: "Martin Luther King Jr. Day" },
    { date: '2027-02-15', name: "Presidents' Day" },
    { date: '2027-05-31', name: "Memorial Day" },
    { date: '2027-06-19', name: "Juneteenth National Independence Day" },
    { date: '2027-07-04', name: "Independence Day" },
    { date: '2027-09-06', name: "Labor Day" },
    { date: '2027-10-11', name: "Columbus / Indigenous Peoples Day" },
    { date: '2027-11-11', name: "Veterans Day" },
    { date: '2027-11-25', name: "Thanksgiving Day" },
    { date: '2027-12-25', name: "Christmas Day" },
];

/**
 * Parsea una cadena YYYY-MM-DD garantizando cálculo de día de la semana sin deriva de zona horaria.
 */
export function parseDateString(dateStr: string): { year: number; month: number; day: number; dayOfWeek: number } {
    if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error(`Invalid date string: "${dateStr}". Expected format YYYY-MM-DD.`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
        throw new Error(`Date components out of range: "${dateStr}".`);
    }
    const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return {
        year: y,
        month: m,
        day: d,
        dayOfWeek: utcDate.getUTCDay(),
    };
}

/**
 * Evalúa si una fecha está disponible para entrega según la configuración activa.
 * Regla de evaluación:
 * 1. Si está en exceptionalDays -> Disponible (override extraordinario).
 * 2. Si está en holidays -> No disponible (feriado).
 * 3. Si el día de la semana no está en workingDays -> No disponible (día cerrado).
 * 4. De lo contrario -> Disponible.
 */
export function isDateAvailableForDelivery(
    dateStr: string,
    config: DeliveryScheduleConfig = DEFAULT_DELIVERY_SCHEDULE,
    locale: 'es' | 'en' = 'es'
): DateAvailabilityResult {
    if (!config || typeof config !== 'object') {
        throw new Error('Invalid delivery schedule configuration object.');
    }
    const { dayOfWeek } = parseDateString(dateStr);

    // 1. Excepción extraordinaria (prioridad máxima)
    const exceptional = config.exceptionalDays?.find(item => item.date === dateStr);
    if (exceptional) {
        return {
            available: true,
            isExceptional: true,
            exceptionalName: exceptional.name,
            dayOfWeek,
        };
    }

    // 2. Feriado no laborable
    const holiday = config.holidays?.find(item => item.date === dateStr);
    if (holiday) {
        return {
            available: false,
            holidayName: holiday.name,
            reason: locale === 'en'
                ? `Non-working holiday: ${holiday.name}`
                : `Día festivo no laborable: ${holiday.name}`,
            dayOfWeek,
        };
    }

    // 3. Día de la semana cerrado
    const workingDays = Array.isArray(config.workingDays) ? config.workingDays : DEFAULT_DELIVERY_SCHEDULE.workingDays;
    if (!workingDays.includes(dayOfWeek)) {
        const dayName = locale === 'en' ? DAY_NAMES_EN[dayOfWeek] : DAY_NAMES_ES[dayOfWeek];
        return {
            available: false,
            reason: locale === 'en'
                ? `We do not make deliveries on ${dayName}s`
                : `No realizamos entregas los días ${dayName}`,
            dayOfWeek,
        };
    }

    // 4. Operativo
    return {
        available: true,
        dayOfWeek,
    };
}

/**
 * Sad path assertion (§6): Lanza excepción si la fecha no está habilitada.
 */
export function assertDateAvailableForDelivery(
    dateStr: string,
    config: DeliveryScheduleConfig = DEFAULT_DELIVERY_SCHEDULE,
    locale: 'es' | 'en' = 'es'
): boolean {
    const result = isDateAvailableForDelivery(dateStr, config, locale);
    if (!result.available) {
        throw new Error(result.reason || 'Date is not available for delivery.');
    }
    return true;
}

/**
 * Obtiene los componentes de fecha y hora en la zona horaria de New York (ET).
 */
export function getNewYorkDateTimeParts(referenceDate?: Date | string | number): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    dateObj: Date;
} {
    const date = referenceDate instanceof Date
        ? referenceDate
        : referenceDate
            ? new Date(referenceDate)
            : new Date();

    if (isNaN(date.getTime())) {
        throw new Error(`Invalid reference date provided: ${String(referenceDate)}`);
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10);
    const day = parseInt(getPart('day'), 10);
    let hour = parseInt(getPart('hour'), 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(getPart('minute'), 10);

    return {
        year,
        month,
        day,
        hour,
        minute,
        dateObj: date,
    };
}

/**
 * Calcula la fecha mínima de entrega dinámica considerando:
 * - Lead time de 48h con corte a las 12:00 PM ET (T+2 si antes de corte, T+3 si después de corte).
 * - Salto de feriados (individuales o consecutivos).
 * - Salto de días no operativos semanales.
 * - Respeto a días extraordinarios.
 * Retorna la fecha en formato YYYY-MM-DD.
 */
export function calculateDynamicMinDeliveryDate(
    referenceDate?: Date | string | number,
    config: DeliveryScheduleConfig = DEFAULT_DELIVERY_SCHEDULE
): string {
    const cutoff = typeof config.cutoffHour === 'number' ? config.cutoffHour : 12;
    const ny = getNewYorkDateTimeParts(referenceDate);

    // T+2 si antes de la hora de corte, T+3 si pasada la hora de corte
    const daysToAdd = ny.hour >= cutoff ? 3 : 2;

    // Inicializar fecha candidata en UTC a mediodía para evitar cualquier drift de horario de verano
    const candidateUtc = new Date(Date.UTC(ny.year, ny.month - 1, ny.day + daysToAdd, 12, 0, 0));

    // Bucle de búsqueda de primera fecha disponible
    const MAX_SEARCH_DAYS = 60;
    for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
        const y = candidateUtc.getUTCFullYear();
        const m = String(candidateUtc.getUTCMonth() + 1).padStart(2, '0');
        const d = String(candidateUtc.getUTCDate()).padStart(2, '0');
        const candidateStr = `${y}-${m}-${d}`;

        const availability = isDateAvailableForDelivery(candidateStr, config);
        if (availability.available) {
            return candidateStr;
        }

        // Avanzar un día
        candidateUtc.setUTCDate(candidateUtc.getUTCDate() + 1);
    }

    throw new Error('Unable to find an available delivery date within 60 days. Please verify schedule configuration.');
}

/**
 * Formatea una fecha YYYY-MM-DD a formato amigable localizado.
 */
export function formatDeliveryDatePretty(
    dateStr: string,
    locale: 'es' | 'en' = 'es'
): string {
    const { year, month, day } = parseDateString(dateStr);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

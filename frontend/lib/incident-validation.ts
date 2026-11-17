/**
 * incident-validation.ts
 * Motor de validación y reglas de negocio para el reporte de incidencias B2B (Sprint S96).
 * Reglas de ventana horaria (10:00 AM) para entregas desatendidas y verificación de payloads.
 */

export interface IncidentPayloadInput {
  productId: number;
  quantity: number;
  maxQuantity: number;
  reason: string;
  photoRequired: boolean;
  hasPhoto: boolean;
  description?: string;
}

export interface IncidentValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ReportingWindowOptions {
  maxHour?: number; // Límite de hora del día (por defecto 10 para 10:00 AM)
  isDaytimeOrder?: boolean; // Si es pedido diurno, aplica ventana de 24 horas
  now?: Date; // Fecha/hora de referencia para testing determinista
}

export const INCIDENT_REASONS = [
  {
    id: 'missing_kitchen',
    label: 'Faltante en entrega',
    labelEn: 'Missing from delivery',
    requiresPhoto: false,
    description: 'El producto no fue entregado o falta en la caja de despacho',
  },
  {
    id: 'transit_damage',
    label: 'Producto quebrado / aplastado',
    labelEn: 'Broken / crushed product',
    requiresPhoto: true,
    description: 'El producto llegó aplastado, dañado o con rotura en el transporte',
  },
  {
    id: 'quality_defect',
    label: 'Problema de calidad / horneado',
    labelEn: 'Quality / baking issue',
    requiresPhoto: true,
    description: 'Defecto en el horneado, quemado, crudo o alteración visual',
  },
  {
    id: 'wrong_item',
    label: 'Producto incorrecto',
    labelEn: 'Wrong product received',
    requiresPhoto: true,
    description: 'Se entregó una variedad o producto diferente al solicitado',
  },
] as const;

export type IncidentReasonId = (typeof INCIDENT_REASONS)[number]['id'];

/**
 * Obtiene la configuración de un motivo por su ID o etiqueta.
 */
export function getReasonConfig(reasonIdOrLabel: string) {
  if (!reasonIdOrLabel) return undefined;
  const normalized = reasonIdOrLabel.trim().toLowerCase();
  return INCIDENT_REASONS.find(
    (r) =>
      r.id.toLowerCase() === normalized ||
      r.label.toLowerCase() === normalized ||
      r.labelEn.toLowerCase() === normalized,
  );
}

/**
 * Indica si un motivo específico requiere fotografía obligatoria.
 */
export function isPhotoRequiredForReason(reason: string): boolean {
  const cfg = getReasonConfig(reason);
  return cfg ? cfg.requiresPhoto : false;
}

/**
 * Extrae año, mes, día y timestamp base de forma segura.
 */
function parseDeliveryDate(dateInput: string | Date): {
  year: number;
  month: number;
  day: number;
  timeMs: number;
} | null {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return {
      year: dateInput.getFullYear(),
      month: dateInput.getMonth() + 1,
      day: dateInput.getDate(),
      timeMs: dateInput.getTime(),
    };
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;

    // Formato YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      const hours = isoMatch[4] ? parseInt(isoMatch[4], 10) : 6; // default 6 AM para delivery desatendida
      const minutes = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;

      const dateObj = new Date(year, month - 1, day, hours, minutes, 0);
      if (isNaN(dateObj.getTime())) return null;

      return {
        year,
        month,
        day,
        timeMs: dateObj.getTime(),
      };
    }

    const fallbackDate = new Date(trimmed);
    if (isNaN(fallbackDate.getTime())) return null;
    return {
      year: fallbackDate.getFullYear(),
      month: fallbackDate.getMonth() + 1,
      day: fallbackDate.getDate(),
      timeMs: fallbackDate.getTime(),
    };
  }

  return null;
}

/**
 * Valida si un pedido se encuentra dentro de la ventana de reporte autorizada.
 * 
 * Reglas de negocio:
 * 1. Para entregas desatendidas del día actual (madrugada):
 *    - La hora límite es las 10:00 AM (maxHour = 10 configurable).
 *    - Si currentHour <= maxHour: dentro de ventana (true).
 *    - Si currentHour > maxHour: fuera de ventana (false).
 * 2. Para órdenes diurnas (isDaytimeOrder: true):
 *    - Valida ventana de 24 horas contadas desde la fecha/hora de entrega.
 * 3. Para entregas de fechas anteriores (si no es diurna):
 *    - Expiradas (false).
 * 4. Para fechas futuras:
 *    - No permitido (false).
 */
export function isWithinReportingWindow(
  deliveryDate: string | Date | null | undefined,
  currentHour?: number,
  options?: ReportingWindowOptions | boolean,
): boolean {
  if (!deliveryDate) return false;

  const parsed = parseDeliveryDate(deliveryDate);
  if (!parsed) return false;

  const opts: ReportingWindowOptions =
    typeof options === 'boolean'
      ? { isDaytimeOrder: options }
      : (options || {});

  const maxHour = opts.maxHour !== undefined ? opts.maxHour : 10;
  const isDaytime = Boolean(opts.isDaytimeOrder);
  const refDate = opts.now instanceof Date && !isNaN(opts.now.getTime()) ? opts.now : new Date();

  // Si se pasa currentHour explícito, lo respetamos; de lo contrario usamos la hora de refDate
  const hourToCheck = currentHour !== undefined ? currentHour : refDate.getHours();

  if (hourToCheck < 0 || hourToCheck > 23) {
    return false;
  }

  const todayYear = refDate.getFullYear();
  const todayMonth = refDate.getMonth() + 1;
  const todayDay = refDate.getDate();

  const isSameDay =
    parsed.year === todayYear &&
    parsed.month === todayMonth &&
    parsed.day === todayDay;

  // Creamos medianoche de hoy y medianoche de la fecha de entrega para comparar días
  const todayMidnight = new Date(todayYear, todayMonth - 1, todayDay, 0, 0, 0).getTime();
  const deliveryMidnight = new Date(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0).getTime();

  // Fecha futura: la entrega es posterior a hoy
  if (deliveryMidnight > todayMidnight) {
    return false;
  }

  // Caso A: Entrega del día de hoy
  if (isSameDay) {
    if (isDaytime) {
      // Orden diurna del mismo día siempre está dentro de las 24h
      return true;
    }
    // Entrega desatendida estándar matutina: límite 10:00 AM (o maxHour)
    return hourToCheck <= maxHour;
  }

  // Caso B: Entrega de días anteriores
  if (isDaytime) {
    // Si es diurna, verificamos la ventana de 24 horas exactas (86,400,000 ms)
    // Usamos refDate ajustado a la hora evaluada si currentHour fue provisto
    const effectiveNow = new Date(refDate);
    if (currentHour !== undefined) {
      effectiveNow.setHours(currentHour, 0, 0, 0);
    }
    const diffMs = effectiveNow.getTime() - parsed.timeMs;
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours >= 0 && diffHours <= 24;
  }

  // Para entregas desatendidas, la ventana vence a las 10:00 AM del día de entrega
  return false;
}

/**
 * Valida el payload de registro de una incidencia de entrega.
 * 
 * Verifica:
 * - Producto válido (> 0)
 * - Cantidad válida (> 0 y número entero)
 * - Límite de cantidad (quantity <= maxQuantity)
 * - Motivo de incidencia válido
 * - Fotografía de evidencia requerida
 */
export function validateIncidentPayload(data: IncidentPayloadInput): IncidentValidationResult {
  if (!data) {
    return { isValid: false, error: 'El formulario de incidencia está vacío' };
  }

  const { productId, quantity, maxQuantity, reason, photoRequired, hasPhoto } = data;

  if (typeof productId !== 'number' || isNaN(productId) || productId <= 0) {
    return { isValid: false, error: 'Debes seleccionar un producto válido de la orden' };
  }

  if (
    typeof quantity !== 'number' ||
    isNaN(quantity) ||
    quantity <= 0 ||
    !Number.isInteger(quantity)
  ) {
    return { isValid: false, error: 'La cantidad afectada debe ser un número entero mayor a 0' };
  }

  if (typeof maxQuantity !== 'number' || isNaN(maxQuantity) || maxQuantity <= 0) {
    return { isValid: false, error: 'La cantidad máxima permitida debe ser mayor a 0' };
  }

  if (quantity > maxQuantity) {
    return {
      isValid: false,
      error: `La cantidad reportada (${quantity}) no puede exceder la cantidad ordenada (${maxQuantity})`,
    };
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return { isValid: false, error: 'Debes seleccionar un motivo para la incidencia' };
  }

  const matchedReason = getReasonConfig(reason);
  if (!matchedReason) {
    return {
      isValid: false,
      error: 'El motivo seleccionado no es válido. Opciones: Faltante, Daño en tránsito, Calidad o Producto incorrecto',
    };
  }

  const requiresPhoto = photoRequired || matchedReason.requiresPhoto;
  if (requiresPhoto && !hasPhoto) {
    return {
      isValid: false,
      error: 'Se requiere adjuntar una fotografía de evidencia para este tipo de incidencia',
    };
  }

  return { isValid: true };
}

/**
 * Aserción estricta de validación que arroja excepción si el payload no es válido.
 */
export function assertValidIncidentPayload(data: IncidentPayloadInput): void {
  const result = validateIncidentPayload(data);
  if (!result.isValid) {
    throw new Error(result.error || 'Payload de incidencia inválido');
  }
}


/**
 * Utilidad determinista de cálculo de fechas de negocio.
 * Sprint S45: Pagos por Cheque y Conciliación Contable
 */

/**
 * Añade días hábiles deterministas a una fecha de inicio, excluyendo fines de semana (sábados y domingos).
 *
 * @param startDate Fecha base (Date o string YYYY-MM-DD / ISO)
 * @param days Número de días hábiles a sumar (entero no negativo)
 * @returns Fecha resultante en formato ISO string 'YYYY-MM-DD'
 */
export function addBusinessDays(startDate: Date | string, days: number = 3): string {
  if (!startDate) {
    throw new Error('Invalid startDate provided to addBusinessDays');
  }

  if (typeof days !== 'number' || isNaN(days) || days < 0 || !Number.isInteger(days)) {
    throw new Error('Days must be a non-negative integer');
  }

  let current: Date;

  if (typeof startDate === 'string') {
    const trimmed = startDate.trim();
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) {
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid date format: ${startDate}`);
      }
      current = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
    } else {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      current = new Date(Date.UTC(year, month, day));
      if (isNaN(current.getTime())) {
        throw new Error(`Invalid date string: ${startDate}`);
      }
    }
  } else if (startDate instanceof Date) {
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid Date instance provided to addBusinessDays');
    }
    current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  } else {
    throw new Error('Invalid startDate type: expected Date or string');
  }

  let added = 0;
  while (added < days) {
    current.setUTCDate(current.getUTCDate() + 1);
    const dayOfWeek = current.getUTCDay(); // 0: Sunday, 6: Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }

  const y = current.getUTCFullYear();
  const m = String(current.getUTCMonth() + 1).padStart(2, '0');
  const d = String(current.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

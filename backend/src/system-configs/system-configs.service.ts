import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './system-config.entity';

@Injectable()
export class SystemConfigsService implements OnModuleInit {
  private cachedSchedule: {
    workingDays: number[];
    holidays: Array<{ date: string; name: string }>;
    exceptionalDays: Array<{ date: string; name: string }>;
    cutoffHour: number;
  } | null = null;

  constructor(
    @InjectRepository(SystemConfig)
    private readonly repo: Repository<SystemConfig>,
  ) {}

  async onModuleInit() {
    // Ensure table exists in SQLite in production or development
    await this.repo.query(
      `CREATE TABLE IF NOT EXISTS system_configs (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
    );

    // Seed default min_order_amount if not exists
    const minOrder = await this.repo.findOne({ where: { key: 'min_order_amount' } });
    if (!minOrder) {
      await this.repo.save({ key: 'min_order_amount', value: '500' });
      console.log('[CONFIG] Seeded default min_order_amount = 500');
    }

    // Seed default cutoff_hour if not exists
    const cutoff = await this.repo.findOne({ where: { key: 'cutoff_hour' } });
    if (!cutoff) {
      await this.repo.save({ key: 'cutoff_hour', value: '12' });
      console.log('[CONFIG] Seeded default cutoff_hour = 12');
    }

    // Seed default terms_and_conditions_es if not exists
    const termsEs = await this.repo.findOne({ where: { key: 'terms_and_conditions_es' } });
    if (!termsEs) {
      const defaultTermsEs = `TÉRMINOS Y CONDICIONES COMERCIALES — JHOANES WHOLESALE

1. ÁMBITO Y OPERACIÓN MAYORISTA
Jhoanes Wholesale opera como centro de producción y distribución mayorista directa de panadería y pastelería artesanal para restaurantes, cafeterías, bodegas y supermercados.

2. POLÍTICA DE CORTE Y TIEMPOS DE ANTICIPACIÓN
- Todos los pedidos deben colocarse con al menos 1.5 días de anticipación.
- La hora límite de recepción es a las 12:00 p. m. (mediodía).
- Todo pedido confirmado antes de las 12:00 p. m. se programa para la fecha de entrega correspondiente (ej. miércoles antes de las 12:00 p. m. se entrega el viernes).
- Los pedidos recibidos después de las 12:00 p. m. se programan para el siguiente ciclo de producción, salvo autorización expresa de excepción por parte de administración.

3. TARIFAS Y CONDICIONES DE ENTREGA (DELIVERY FEE)
- Cada cliente tiene asignada una tarifa de delivery fija o calculada por zona en su cuenta.
- El monto del delivery fee se añade automáticamente al total del pedido y se refleja en la factura correspondiente.

4. MODALIDADES DE PAGO
- Clientes de Contado: Todo pedido debe liquidarse en su totalidad al momento de la compra a través de la pasarela Stripe (tarjeta de crédito/débito).
- Clientes a Crédito: Operan bajo una línea de crédito comercial aprobada con límite establecido. El monto del pedido se descuenta del crédito disponible y debe liquidarse en la fecha de vencimiento pactada.

5. CANCELACIONES Y RECLAMOS
Cualquier modificación o cancelación debe solicitarse antes de la hora de corte (12:00 p. m.) previa a la fecha de horneado. Reclamos por calidad o faltantes deben notificarse dentro de las 6 horas posteriores a la recepción del pedido.`;
      await this.repo.save({ key: 'terms_and_conditions_es', value: defaultTermsEs });
      console.log('[CONFIG] Seeded default terms_and_conditions_es');
    }

    // Seed default terms_and_conditions_en if not exists
    const termsEn = await this.repo.findOne({ where: { key: 'terms_and_conditions_en' } });
    if (!termsEn) {
      const defaultTermsEn = `COMMERCIAL TERMS AND CONDITIONS — JHOANES WHOLESALE

1. SCOPE AND WHOLESALE OPERATIONS
Jhoanes Wholesale operates as an artisanal bakery production and direct B2B distribution center supplying restaurants, coffee shops, and supermarkets.

2. CUTOFF POLICY AND LEAD TIME
- Orders require approximately 1.5 days advance notice.
- Strict daily cutoff time is 12:00 PM (Noon) Eastern Time.
- Orders submitted before 12:00 PM are baked fresh for the scheduled delivery day (e.g., Wednesday before 12:00 PM is delivered Friday).
- Orders submitted after 12:00 PM will roll over to the subsequent delivery cycle unless an exception is approved by management.

3. DELIVERY FEES
- Each customer account has a designated delivery fee based on location and route assignment.
- The delivery fee is automatically added to the order total and reflected on the official invoice.

4. PAYMENT TERMS
- Cash/Card Customers: Full payment required upon ordering via Stripe checkout.
- Credit Customers: Purchases charged against an authorized B2B credit line, payable according to the agreed due date.

5. CANCELLATIONS AND CLAIMS
Order adjustments or cancellations must be requested prior to the 12:00 PM production cutoff. Any delivery claims must be reported within 6 hours of receipt.`;
      await this.repo.save({ key: 'terms_and_conditions_en', value: defaultTermsEn });
      console.log('[CONFIG] Seeded default terms_and_conditions_en');
    }

    // Seed default accounting_report_emails if not exists
    const accountingEmails = await this.repo.findOne({ where: { key: 'accounting_report_emails' } });
    if (!accountingEmails) {
      await this.repo.save({ key: 'accounting_report_emails', value: 'accounting@jhoanes.com' });
      console.log('[CONFIG] Seeded default accounting_report_emails = accounting@jhoanes.com');
    }

    // Seed default delivery_working_days if not exists
    const workingDaysConfig = await this.repo.findOne({ where: { key: 'delivery_working_days' } });
    if (!workingDaysConfig) {
      await this.repo.save({ key: 'delivery_working_days', value: '[0,1,3,4,5,6]' });
      console.log('[CONFIG] Seeded default delivery_working_days = [0,1,3,4,5,6]');
    }

    // Seed default delivery_holidays if not exists
    const holidaysConfig = await this.repo.findOne({ where: { key: 'delivery_holidays' } });
    if (!holidaysConfig) {
      const defaultHolidays = JSON.stringify([
        { date: '2026-11-26', name: 'Thanksgiving Day' },
        { date: '2026-12-25', name: 'Christmas Day' },
        { date: '2027-01-01', name: "New Year's Day" },
      ]);
      await this.repo.save({ key: 'delivery_holidays', value: defaultHolidays });
      console.log('[CONFIG] Seeded default delivery_holidays');
    }

    // Seed default delivery_exceptional_days if not exists
    const exceptionalDaysConfig = await this.repo.findOne({ where: { key: 'delivery_exceptional_days' } });
    if (!exceptionalDaysConfig) {
      await this.repo.save({ key: 'delivery_exceptional_days', value: '[]' });
      console.log('[CONFIG] Seeded default delivery_exceptional_days = []');
    }

    // Seed default store_general_discount if not exists (TASK-83-04: percentage = 0, is_active = false)
    const storeDiscountConfig = await this.repo.findOne({ where: { key: 'store_general_discount' } });
    if (!storeDiscountConfig) {
      await this.repo.save({
        key: 'store_general_discount',
        value: '{"reason":"","percentage":0,"valid_until":"","is_active":false}',
      });
      console.log('[CONFIG] Seeded default store_general_discount (0%, inactive)');
    } else {
      try {
        const parsed = JSON.parse(storeDiscountConfig.value);
        if (parsed && parsed.percentage === 3.5 && !parsed.is_active) {
          parsed.percentage = 0;
          await this.repo.save({
            key: 'store_general_discount',
            value: JSON.stringify(parsed),
          });
        }
      } catch (_) {}
    }

    // Cache initial delivery schedule
    await this.getDeliverySchedule();
  }

  getCachedDeliverySchedule(): {
    workingDays: number[];
    holidays: Array<{ date: string; name: string }>;
    exceptionalDays: Array<{ date: string; name: string }>;
    cutoffHour: number;
  } | null {
    return this.cachedSchedule;
  }

  async getDeliverySchedule(): Promise<{
    workingDays: number[];
    holidays: Array<{ date: string; name: string }>;
    exceptionalDays: Array<{ date: string; name: string }>;
    cutoffHour: number;
  }> {
    const [workingDaysRaw, holidaysRaw, exceptionalDaysRaw, cutoffHourRaw] = await Promise.all([
      this.get('delivery_working_days', '[0,1,3,4,5,6]'),
      this.get('delivery_holidays', '[]'),
      this.get('delivery_exceptional_days', '[]'),
      this.get('cutoff_hour', '12'),
    ]);

    let workingDays: number[] = [0, 1, 3, 4, 5, 6];
    try {
      const parsed = JSON.parse(workingDaysRaw);
      if (Array.isArray(parsed)) {
        workingDays = parsed
          .map((n) => Number(n))
          .filter((n) => !isNaN(n) && Number.isInteger(n) && n >= 0 && n <= 6);
      }
    } catch {
      workingDays = [0, 1, 3, 4, 5, 6];
    }

    let holidays: Array<{ date: string; name: string }> = [];
    try {
      const parsed = JSON.parse(holidaysRaw);
      if (Array.isArray(parsed)) {
        holidays = parsed.filter(
          (item) => item && typeof item.date === 'string' && typeof item.name === 'string',
        );
      }
    } catch {
      holidays = [];
    }

    let exceptionalDays: Array<{ date: string; name: string }> = [];
    try {
      const parsed = JSON.parse(exceptionalDaysRaw);
      if (Array.isArray(parsed)) {
        exceptionalDays = parsed.filter(
          (item) => item && typeof item.date === 'string' && typeof item.name === 'string',
        );
      }
    } catch {
      exceptionalDays = [];
    }

    let cutoffHour = 12;
    const parsedCutoff = parseInt(cutoffHourRaw, 10);
    if (!isNaN(parsedCutoff) && parsedCutoff >= 0 && parsedCutoff <= 23) {
      cutoffHour = parsedCutoff;
    }

    const schedule = {
      workingDays,
      holidays,
      exceptionalDays,
      cutoffHour,
    };

    this.cachedSchedule = schedule;
    return schedule;
  }

  async updateDeliverySchedule(data: {
    workingDays?: number[];
    holidays?: Array<{ date: string; name: string }>;
    exceptionalDays?: Array<{ date: string; name: string }>;
  }): Promise<{
    workingDays: number[];
    holidays: Array<{ date: string; name: string }>;
    exceptionalDays: Array<{ date: string; name: string }>;
    cutoffHour: number;
  }> {
    if (data.workingDays !== undefined) {
      if (!Array.isArray(data.workingDays)) {
        throw new BadRequestException('workingDays must be an array of numbers (0..6)');
      }
      for (const d of data.workingDays) {
        if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6) {
          throw new BadRequestException('Each item in workingDays must be an integer between 0 and 6');
        }
      }
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (data.holidays !== undefined) {
      if (!Array.isArray(data.holidays)) {
        throw new BadRequestException('holidays must be an array of { date: YYYY-MM-DD, name: string }');
      }
      for (const h of data.holidays) {
        if (
          !h ||
          typeof h.date !== 'string' ||
          !dateRegex.test(h.date) ||
          typeof h.name !== 'string' ||
          !h.name.trim()
        ) {
          throw new BadRequestException(
            'Each holiday must have a valid date (YYYY-MM-DD) and a non-empty name',
          );
        }
      }
    }

    if (data.exceptionalDays !== undefined) {
      if (!Array.isArray(data.exceptionalDays)) {
        throw new BadRequestException('exceptionalDays must be an array of { date: YYYY-MM-DD, name: string }');
      }
      for (const e of data.exceptionalDays) {
        if (
          !e ||
          typeof e.date !== 'string' ||
          !dateRegex.test(e.date) ||
          typeof e.name !== 'string' ||
          !e.name.trim()
        ) {
          throw new BadRequestException(
            'Each exceptional day must have a valid date (YYYY-MM-DD) and a non-empty name',
          );
        }
      }
    }

    if (data.workingDays !== undefined) {
      await this.update('delivery_working_days', JSON.stringify(data.workingDays));
    }
    if (data.holidays !== undefined) {
      await this.update('delivery_holidays', JSON.stringify(data.holidays));
    }
    if (data.exceptionalDays !== undefined) {
      await this.update('delivery_exceptional_days', JSON.stringify(data.exceptionalDays));
    }

    return this.getDeliverySchedule();
  }

  async getStoreDiscount(): Promise<{
    reason: string;
    percentage: number;
    valid_until: string;
    is_active: boolean;
  }> {
    const raw = await this.get('store_general_discount', '');
    if (!raw) {
      return { reason: '', percentage: 0, valid_until: '', is_active: false };
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        percentage: typeof parsed.percentage === 'number' && !isNaN(parsed.percentage) ? parsed.percentage : 0,
        valid_until: typeof parsed.valid_until === 'string' ? parsed.valid_until : '',
        is_active: Boolean(parsed.is_active),
      };
    } catch {
      return { reason: '', percentage: 0, valid_until: '', is_active: false };
    }
  }

  async updateStoreDiscount(data: {
    reason?: string;
    percentage: number;
    valid_until: string;
    is_active: boolean;
  }): Promise<{
    reason: string;
    percentage: number;
    valid_until: string;
    is_active: boolean;
  }> {
    if (
      data.percentage === undefined ||
      typeof data.percentage !== 'number' ||
      isNaN(data.percentage) ||
      data.percentage < 0 ||
      data.percentage > 50
    ) {
      throw new BadRequestException('El porcentaje de descuento no puede exceder el 50%');
    }

    if (data.is_active === undefined || typeof data.is_active !== 'boolean') {
      throw new BadRequestException('is_active must be a boolean');
    }

    if (data.valid_until === undefined || typeof data.valid_until !== 'string') {
      throw new BadRequestException('valid_until must be a valid ISO date string');
    }

    if (data.valid_until.trim() !== '') {
      const parsedDate = Date.parse(data.valid_until);
      if (isNaN(parsedDate)) {
        throw new BadRequestException('valid_until must be a valid ISO date string');
      }
    } else if (data.is_active) {
      throw new BadRequestException('valid_until is required when discount is active');
    }

    const discountConfig = {
      reason: typeof data.reason === 'string' ? data.reason.trim() : '',
      percentage: Number(data.percentage),
      valid_until: data.valid_until,
      is_active: data.is_active,
    };

    await this.update('store_general_discount', JSON.stringify(discountConfig));
    return discountConfig;
  }

  async get(key: string, defaultValue = ''): Promise<string> {
    const config = await this.repo.findOne({ where: { key } });
    return config ? config.value : defaultValue;
  }

  async update(key: string, value: string): Promise<SystemConfig> {
    let config = await this.repo.findOne({ where: { key } });
    if (config) {
      config.value = value;
    } else {
      config = this.repo.create({ key, value });
    }
    return this.repo.save(config);
  }
}

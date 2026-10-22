import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './system-config.entity';

@Injectable()
export class SystemConfigsService implements OnModuleInit {
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

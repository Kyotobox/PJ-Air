import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { ExcelService } from '../orders/excel.service';
import { MailService } from '../mail/mail.service';
import { SystemConfigsService } from '../system-configs/system-configs.service';

export interface FinancialReportDispatchResult {
  sent: boolean;
  recipients: string[];
  reportDate: string;
  ordersCount: number;
}

@Injectable()
export class FinancialReportsCron {
  private readonly logger = new Logger(FinancialReportsCron.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly excelService: ExcelService,
    private readonly mailService: MailService,
    private readonly systemConfigsService: SystemConfigsService,
  ) {}

  /**
   * TASK-56-06 / TASK-57-04: Cron desatendido a las 23:59 (America/New_York)
   * para consolidación diaria de ventas multicanal en Excel y envío automático por correo.
   */
  @Cron('59 23 * * *', { timeZone: 'America/New_York' })
  async handleDailyFinancialReportDispatch(overrideDate?: string): Promise<FinancialReportDispatchResult> {
    this.logger.log('Iniciando consolidación y despacho automático de reporte financiero diario...');

    const todayNY = overrideDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    this.logger.log(`Fecha contable de corte (America/New_York): ${todayNY}`);

    // Consultar pedidos generados o entregados en la fecha de corte
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.created_at LIKE :datePattern OR order.delivery_date = :todayNY', {
        datePattern: `${todayNY}%`,
        todayNY,
      })
      .andWhere('order.status NOT IN (:...cancelled)', { cancelled: ['cancelled', 'Cancelado'] })
      .orderBy('order.created_at', 'ASC')
      .getMany();

    this.logger.log(`Órdenes encontradas para el corte financiero del ${todayNY}: ${orders.length}`);

    // Generar buffer de Excel consolidado
    const excelBuffer = await this.excelService.exportConsolidated(orders);

    // Obtener correos destino configurados por la administración
    const emailsConfig = await this.systemConfigsService.get('accounting_report_emails', 'accounting@jhoanes.com');
    const recipients = emailsConfig
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));

    if (recipients.length === 0) {
      recipients.push('accounting@jhoanes.com');
    }

    const sent = await this.mailService.sendFinancialReport(recipients, todayNY, excelBuffer);

    this.logger.log(`Despacho de reporte financiero ${todayNY} finalizado. Estado: ${sent ? 'EXITOSO' : 'FALLIDO'}`);

    return {
      sent,
      recipients,
      reportDate: todayNY,
      ordersCount: orders.length,
    };
  }
}

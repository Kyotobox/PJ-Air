import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';

export interface OverdueCronSummary {
  processed: number;
  emailsSent: number;
  smsSent: number;
  errors: number;
}

@Injectable()
export class CollectionCron {
  private readonly logger = new Logger(CollectionCron.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Cron job diario a las 9:00 AM (America/New_York) para consultar órdenes vencidas
   * y ejecutar la cobranza multicanal automatizada.
   */
  @Cron('0 9 * * *', { timeZone: 'America/New_York' })
  async handleDailyOverdueCheck(): Promise<OverdueCronSummary> {
    this.logger.log('Iniciando escaneo diario de órdenes con crédito vencido...');

    const summary: OverdueCronSummary = {
      processed: 0,
      emailsSent: 0,
      smsSent: 0,
      errors: 0,
    };

    try {
      // Fecha actual en zona horaria America/New_York (formato YYYY-MM-DD)
      const todayNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
      this.logger.log(`Fecha de corte para cobros vencidos (America/New_York): ${todayNY}`);

      const overdueOrders = await this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.user', 'user')
        .leftJoinAndSelect('user.profile', 'profile')
        .leftJoinAndSelect('order.items', 'items')
        .where('order.payment_due_date IS NOT NULL')
        .andWhere('order.payment_due_date <= :todayNY', { todayNY })
        .andWhere('order.payment_status NOT IN (:...excludedPaymentStatuses)', {
          excludedPaymentStatuses: ['paid', 'refunded'],
        })
        .andWhere('LOWER(order.status) NOT IN (:...cancelledStatuses)', {
          cancelledStatuses: ['cancelled', 'cancelado'],
        })
        .getMany();

      this.logger.log(`Se encontraron ${overdueOrders.length} orden(es) vencida(s) para gestión de cobranza.`);

      for (const order of overdueOrders) {
        summary.processed++;
        try {
          // Cálculo de días de atraso
          const dueTime = new Date(order.payment_due_date).getTime();
          const todayTime = new Date(todayNY).getTime();
          const daysOverdue = Math.max(0, Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24)));

          const clientEmail = order.user?.email;
          const profile = order.user?.profile;
          const clientName = profile?.company_name || profile?.full_name || 'Cliente Comercial';

          // 1. Envío de correo electrónico formal de aviso de factura vencida
          if (clientEmail) {
            const emailSent = await this.mailService.sendOverdueInvoiceAlert(clientEmail, {
              id: order.id,
              total: order.total,
              payment_due_date: order.payment_due_date,
              daysOverdue,
              clientName,
              items: order.items,
            });
            if (emailSent) {
              summary.emailsSent++;
            }
          } else {
            this.logger.warn(`Orden #${order.id} no posee correo electrónico de usuario asociado.`);
          }

          // 2. Envío de SMS diferido si el cliente posee teléfono verificado
          if (profile?.phone && profile.phone_verified) {
            const shortId = (order.id || '').toString().slice(0, 8);
            const amountFormatted = Number(order.total || 0).toFixed(2);
            const smsText = `Panaderia Jhoanes: Su orden #${shortId} ($${amountFormatted}) vencio el ${order.payment_due_date} (${daysOverdue} dias de atraso). Por favor regularice su pago.`;

            const smsResult = await this.smsService.sendOverdueAlert(profile.phone, smsText);
            if (smsResult.success) {
              summary.smsSent++;
            }
          }
        } catch (itemErr: any) {
          summary.errors++;
          this.logger.error(`Error procesando cobro para orden #${order.id}: ${itemErr.message}`);
        }
      }

      this.logger.log(
        `Escaneo de cobranza concluido. Procesadas: ${summary.processed}, Emails: ${summary.emailsSent}, SMS: ${summary.smsSent}, Errores: ${summary.errors}`,
      );
      return summary;
    } catch (err: any) {
      this.logger.error(`Error crítico en escaneo diario de órdenes vencidas: ${err.message}`);
      summary.errors++;
      return summary;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } from '../config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private async initTransporter() {
    try {
      if (SMTP_HOST && SMTP_USER) {
        this.transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT) || 587,
          secure: SMTP_SECURE,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        this.logger.log('SMTP transporter initialized with custom configuration.');
      } else {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: 'mckenna.beier@ethereal.email',
            pass: 'JSF9re7Xh3bTzH4JUK',
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        this.logger.log('SMTP transporter initialized with test configuration.');
      }
    } catch (err: any) {
      this.logger.warn(`Could not initialize SMTP transporter: ${err.message}`);
    }
  }

  async sendOrderReceipt(order: any, customerEmail: string): Promise<boolean> {
    if (!this.transporter || !customerEmail) return false;

    try {
      const itemsListHtml = (order.items || [])
        .map(
          (item: any) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.product?.name || 'Producto'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price_at_time || item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>`
        )
        .join('');

      const deliveryFeeHtml = Number(order.delivery_fee_charged || 0) > 0
        ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: bold;">Tarifa de Envío:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${Number(order.delivery_fee_charged).toFixed(2)}</td></tr>`
        : '';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #b8860b; margin-bottom: 4px;">Panadería Jhoanes — Recibo de Pedido</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Orden #${(order.id || '').toString().slice(0, 8)} • Fecha de Entrega: <strong>${order.delivery_date || 'Programada'}</strong></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc; text-align: left; color: #475569;">
                <th style="padding: 8px 12px;">Producto</th>
                <th style="padding: 8px 12px; text-align: center;">Cantidad</th>
                <th style="padding: 8px 12px; text-align: right;">Precio</th>
                <th style="padding: 8px 12px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
              ${deliveryFeeHtml}
              <tr style="font-size: 16px; background: #fefce8;">
                <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">TOTAL FINAL:</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">$${Number(order.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #475569;">
            <p style="margin: 0;"><strong>Estado del Pago:</strong> ${order.payment_status === 'paid' ? '✅ Pagado vía Stripe' : '⏳ Pendiente según condiciones comerciales'}</p>
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            Gracias por confiar en Panadería Jhoanes Wholesale.
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER ? `"Panadería Jhoanes" <${SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
        to: customerEmail,
        subject: `Recibo de Compra #${(order.id || '').toString().slice(0, 8)} — Panadería Jhoanes`,
        html,
      });

      this.logger.log(`Order receipt sent successfully to ${customerEmail}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error sending order receipt: ${err.message}`);
      return false;
    }
  }

  async sendCreditAlert(userEmail: string, clientName: string, usedCredit: number, creditLimit: number, isOverdraft: boolean): Promise<boolean> {
    if (!this.transporter || !userEmail) return false;

    try {
      const subject = isOverdraft 
        ? `⚠️ Alerta de Sobregiro de Crédito — Panadería Jhoanes`
        : `Actualización de Línea de Crédito — Panadería Jhoanes`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: ${isOverdraft ? '#dc2626' : '#2563eb'};">${subject}</h2>
          <p>Estimado(a) <strong>${clientName}</strong>,</p>
          <p>Le informamos sobre el estado actual de su cuenta de crédito comercial:</p>
          <ul>
            <li><strong>Límite Autorizado:</strong> $${creditLimit.toFixed(2)}</li>
            <li><strong>Saldo Pendiente de Pago:</strong> $${usedCredit.toFixed(2)}</li>
            <li><strong>Estado:</strong> ${isOverdraft ? '<span style="color: red; font-weight: bold;">LÍMITE EXCEDIDO</span>' : '<span style="color: green; font-weight: bold;">AL DÍA</span>'}</li>
          </ul>
          <p>Si requiere regularizar sus pagos o solicitar una extensión de cupo, por favor contacte a su asesor de cuenta.</p>
        </div>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER ? `"Panadería Jhoanes" <${SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
        to: userEmail,
        subject,
        html,
      });

      return true;
    } catch (err: any) {
      this.logger.error(`Error sending credit alert: ${err.message}`);
      return false;
    }
  }

  async sendPaymentFailedAlert(
    userEmail: string,
    clientName: string,
    orderId: string,
    amount: number,
    reason: string,
  ): Promise<boolean> {
    this.logger.warn(`[ALERTA DE COBRO FALLIDO] Orden #${orderId} ($${amount.toFixed(2)}) rechazada para ${userEmail}. Motivo: ${reason}`);

    if (!this.transporter || !userEmail) return false;

    try {
      const subject = `⚠️ Cobro Automático Fallido — Pedido Programado #${orderId.slice(0, 8)}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Cobro Automático No Procesado</h2>
          <p>Estimado(a) <strong>${clientName}</strong>,</p>
          <p>Le notificamos que el cobro automático de su pedido recurrente no pudo completarse con éxito:</p>
          <ul>
            <li><strong>Orden:</strong> #${orderId.slice(0, 8)}</li>
            <li><strong>Monto:</strong> $${amount.toFixed(2)}</li>
            <li><strong>Motivo de rechazo:</strong> ${reason}</li>
          </ul>
          <p>Su pedido se encuentra en estado <strong>Pendiente de Pago</strong>. Por favor acceda a su portal de cliente para actualizar su método de pago o liquidar la factura pendiente.</p>
        </div>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER ? `"Panadería Jhoanes" <${SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
        to: userEmail,
        subject,
        html,
      });

      return true;
    } catch (err: any) {
      this.logger.error(`Error sending payment failed alert: ${err.message}`);
      return false;
    }
  }
}

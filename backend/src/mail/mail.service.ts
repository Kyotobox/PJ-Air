import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, ADMIN_NOTIFICATION_EMAIL } from '../config';

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
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.product?.name || item.product_name || item.name || 'Producto'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price_at_time || item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>`
        )
        .join('');

      const deliveryFeeHtml = Number(order.delivery_fee_charged || 0) > 0
        ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: bold;">Tarifa de Envío:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${Number(order.delivery_fee_charged).toFixed(2)}</td></tr>`
        : '';

      let paymentStatusText = '⏳ Pendiente según condiciones comerciales';
      if (order.payment_status === 'paid') {
        paymentStatusText = '✅ Pagado vía Stripe';
      } else if (order.payment_status === 'credit') {
        paymentStatusText = '📝 Cargado a Crédito Comercial B2B';
      } else if (order.payment_status === 'partially_refunded') {
        paymentStatusText = '🔄 Reembolso Parcial Aplicado';
      } else if (order.payment_status === 'refunded') {
        paymentStatusText = '↩️ Reembolsado Totalmente';
      }

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
            <p style="margin: 0;"><strong>Estado del Pago:</strong> ${paymentStatusText}</p>
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

  async sendAdminNewOrderAlert(order: any, customerEmail?: string, clientName?: string): Promise<boolean> {
    const adminEmail = ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || SMTP_USER || 'pedidos@jhoanes.com';
    if (!this.transporter || !adminEmail) return false;

    try {
      const orderIdShort = (order.id || '').toString().slice(0, 8);
      const itemsListHtml = (order.items || [])
        .map(
          (item: any) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${item.product?.name || item.product_name || item.name || 'Producto'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #1e293b;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price_at_time || item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>`
        )
        .join('');

      const deliveryFee = Number(order.delivery_fee_charged || 0);
      const deliveryFeeHtml = deliveryFee > 0
        ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: bold;">Flete / Envío:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${deliveryFee.toFixed(2)}</td></tr>`
        : '';

      const deliveryTypeText = order.delivery_type === 'pickup' 
        ? '📦 Retiro en Panadería (Pick Up)' 
        : `🚚 Entrega a Domicilio: ${order.delivery_address_text || order.address?.street || 'Dirección registrada'}`;

      let paymentStatusBadge = '<span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: bold;">⏳ PENDIENTE</span>';
      if (order.payment_status === 'paid') {
        paymentStatusBadge = '<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: bold;">✅ PAGADO (Stripe)</span>';
      } else if (order.payment_status === 'credit') {
        paymentStatusBadge = '<span style="background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-weight: bold;">📝 CRÉDITO COMERCIAL</span>';
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="background: #1e293b; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #f59e0b; margin: 0; font-size: 20px;">🔔 Alerta de Nueva Orden Mayorista</h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Notificación Operativa de Producción y Horneados</p>
          </div>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 8px 0;"><strong>Orden:</strong> #${orderIdShort} (ID completo: ${order.id})</p>
            <p style="margin: 0 0 8px 0;"><strong>Cliente B2B:</strong> ${clientName || 'Cliente Mayorista'}</p>
            <p style="margin: 0 0 8px 0;"><strong>Email Contacto:</strong> ${customerEmail || order.user?.email || 'N/A'}</p>
            <p style="margin: 0 0 8px 0;"><strong>Fecha Entrega Solicitada:</strong> <strong style="color: #b45309;">${order.delivery_date || 'Programada'}</strong></p>
            <p style="margin: 0 0 8px 0;"><strong>Modalidad:</strong> ${deliveryTypeText}</p>
            <p style="margin: 0;"><strong>Estado Financiero:</strong> ${paymentStatusBadge}</p>
          </div>

          <h3 style="color: #334155; font-size: 16px; margin: 20px 0 10px 0;">Productos a Producir y Despachar</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                <th style="padding: 8px 12px;">Producto</th>
                <th style="padding: 8px 12px; text-align: center;">Cantidad</th>
                <th style="padding: 8px 12px; text-align: right;">Unitario</th>
                <th style="padding: 8px 12px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
              ${deliveryFeeHtml}
              <tr style="font-size: 16px; background: #fefce8;">
                <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">TOTAL ORDEN:</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">$${Number(order.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 12px; color: #64748b; text-align: center;">
            <p style="margin: 0;">Generado automáticamente por el motor de despacho de Panadería Jhoanes Wholesale.</p>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER ? `"Panadería Jhoanes" <${SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
        to: adminEmail,
        subject: `🔔 Nueva Orden Recibida #${orderIdShort} — ${clientName || customerEmail || 'Cliente Wholesale'}`,
        html,
      });

      this.logger.log(`Admin new order alert sent to ${adminEmail} for order #${orderIdShort}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error sending admin new order alert: ${err.message}`);
      return false;
    }
  }

  async sendRefundReceipt(
    order: any,
    customerEmail: string,
    refundData: { refundedAmount: number; totalRefunded: number; reason?: string }
  ): Promise<boolean> {
    if (!this.transporter || !customerEmail) return false;

    try {
      const orderIdShort = (order.id || '').toString().slice(0, 8);
      const refundedAmount = Number(refundData.refundedAmount || 0);
      const totalRefunded = Number(refundData.totalRefunded || 0);
      const originalTotal = Number(order.total || 0);
      const remainingBalance = Math.max(0, Math.round((originalTotal - totalRefunded) * 100) / 100);
      const isFullRefund = remainingBalance <= 0.001;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #0d9488; margin-bottom: 4px;">Panadería Jhoanes — Comprobante de Reembolso</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Orden #${orderIdShort} • Notificación de Devolución Contable</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          
          <div style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #115e59;">
              Estimado cliente, se ha procesado una devolución contable en su cuenta comercial:
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px;">
              <tr>
                <td style="padding: 6px 0; color: #475569;">Monto Reembolsado en esta Operación:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f766e; font-size: 16px;">+$${refundedAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">Total Acumulado Reembolsado:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold;">$${totalRefunded.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">Importe Original de la Orden:</td>
                <td style="padding: 6px 0; text-align: right;">$${originalTotal.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 1px solid #99f6e4;">
                <td style="padding: 8px 0; font-weight: bold; color: #1e293b;">Saldo Remanente de la Orden:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1e293b;">$${remainingBalance.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 20px; font-size: 13px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 8px;">
            <p style="margin: 0 0 4px 0;"><strong>Tipo de Reembolso:</strong> ${isFullRefund ? '✅ Reembolso Total de la Orden' : '🔄 Reembolso Parcial / Ajuste de Factura'}</p>
            <p style="margin: 0;"><strong>Motivo Registrado:</strong> ${refundData.reason || 'Ajuste administrativo comercial pactado'}</p>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Si el pago fue realizado mediante tarjeta en Stripe, verá reflejado el saldo en su extracto bancario en 5-10 días hábiles. Para compras a crédito, el saldo deudor de su línea comercial ha sido descontado automáticamente.
          </p>

          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            Panadería Jhoanes Wholesale — Departamento de Facturación y Finanzas
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER ? `"Panadería Jhoanes" <${SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
        to: customerEmail,
        subject: `Comprobante de Reembolso — Orden #${orderIdShort} — Panadería Jhoanes`,
        html,
      });

      this.logger.log(`Refund receipt sent successfully to ${customerEmail} for order #${orderIdShort}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error sending refund receipt: ${err.message}`);
      return false;
    }
  }

  async sendStandingOrderConfirmation(
    scheduledOrder: any,
    customerEmail: string,
    clientName?: string
  ): Promise<boolean> {
    if (!this.transporter || !customerEmail) return false;

    try {
      const dayTranslations: Record<string, string> = {
        mon: 'Lunes',
        tue: 'Martes',
        wed: 'Miércoles',
        thu: 'Jueves',
        fri: 'Viernes',
        sat: 'Sábado',
        sun: 'Domingo',
      };

      let daysList: string[] = [];
      try {
        if (typeof scheduledOrder.delivery_days_json === 'string') {
          daysList = JSON.parse(scheduledOrder.delivery_days_json);
        } else if (Array.isArray(scheduledOrder.delivery_days_json)) {
          daysList = scheduledOrder.delivery_days_json;
        }
      } catch (_) {
        daysList = ['mon', 'wed', 'fri'];
      }

      const formattedDays = daysList
        .map((d: string) => dayTranslations[d.toLowerCase().slice(0, 3)] || d)
        .join(', ');

      let itemsList: any[] = [];
      try {
        if (typeof scheduledOrder.items_json === 'string') {
          itemsList = JSON.parse(scheduledOrder.items_json);
        } else if (Array.isArray(scheduledOrder.items_json)) {
          itemsList = scheduledOrder.items_json;
        }
      } catch (_) {
        itemsList = [];
      }

      const itemsHtml = itemsList
        .map(
          (item: any) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.productName || item.name || item.product?.name || 'Producto'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${item.quantity || 1}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${((Number(item.price || 0)) * (Number(item.quantity || 1))).toFixed(2)}</td>
          </tr>`
        )
        .join('');

      const paymentMethodText = scheduledOrder.payment_method === 'credit'
        ? 'Crédito Comercial B2B'
        : 'Tarjeta Domiciliada / Pago Automático';

      const deliveryTypeText = scheduledOrder.delivery_type === 'pickup'
        ? 'Retiro en Panadería (Pick Up)'
        : 'Entrega a Domicilio';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #4f46e5; margin-bottom: 4px;">Panadería Jhoanes Wholesale</h2>
          <h3 style="color: #1e293b; margin-top: 0;">Confirmación de Suscripción Semanal</h3>
          <p style="color: #64748b; font-size: 14px;">Estimado(a) <strong>${clientName || 'Cliente Mayorista'}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">
            Su suscripción fija <strong>"${scheduledOrder.title || 'Suscripción Semanal Mayorista'}"</strong> ha sido configurada y activada con éxito en nuestra plataforma mayorista.
          </p>

          <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 6px 0;"><strong>📅 Días de Entrega Programados:</strong> ${formattedDays || 'Lunes, Miércoles, Viernes'}</p>
            <p style="margin: 0 0 6px 0;"><strong>⏰ Horario de Entrega / Despacho:</strong> ${scheduledOrder.delivery_time || '08:00 AM'}</p>
            <p style="margin: 0 0 6px 0;"><strong>🚚 Modalidad:</strong> ${deliveryTypeText}</p>
            <p style="margin: 0;"><strong>💳 Método de Pago:</strong> ${paymentMethodText}</p>
          </div>

          <h4 style="color: #334155; margin: 16px 0 8px 0;">Desglose de Productos Suscritos</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f8fafc; text-align: left; color: #475569;">
                <th style="padding: 8px 12px;">Producto</th>
                <th style="padding: 8px 12px; text-align: center;">Cantidad</th>
                <th style="padding: 8px 12px; text-align: right;">Unitario</th>
                <th style="padding: 8px 12px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="font-size: 15px; background: #eef2ff;">
                <td colspan="3" style="padding: 10px 12px; text-align: right; font-weight: bold; color: #3730a3;">TOTAL ESTIMADO POR ENTREGA:</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #3730a3;">$${Number(scheduledOrder.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style="background: #f8fafc; border-radius: 8px; padding: 12px; font-size: 12px; color: #64748b; margin-top: 20px;">
            <p style="margin: 0;">
              <strong>Aviso de Operaciones:</strong> Sus pedidos recurrentes se generarán automáticamente en el sistema en las mañanas de los días pactados. Puede pausar, editar cantidades o cancelar su recurrencia en cualquier momento desde su portal de cliente.
            </p>
          </div>

          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            Gracias por su preferencia comercial • Panadería Jhoanes Wholesale
          </p>
        </div>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER ? `"Panadería Jhoanes" <${SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
        to: customerEmail,
        subject: `Confirmación de Suscripción Semanal — Panadería Jhoanes Wholesale`,
        html,
      });

      this.logger.log(`Standing order confirmation sent successfully to ${customerEmail}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error sending standing order confirmation: ${err.message}`);
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

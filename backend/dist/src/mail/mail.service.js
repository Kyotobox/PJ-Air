"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const config_1 = require("../config");
let MailService = MailService_1 = class MailService {
    logger = new common_1.Logger(MailService_1.name);
    transporter = null;
    constructor() {
        this.initTransporter();
    }
    async initTransporter() {
        try {
            if (config_1.SMTP_HOST && config_1.SMTP_USER) {
                this.transporter = nodemailer.createTransport({
                    host: config_1.SMTP_HOST,
                    port: Number(config_1.SMTP_PORT) || 587,
                    secure: config_1.SMTP_SECURE,
                    auth: {
                        user: config_1.SMTP_USER,
                        pass: config_1.SMTP_PASS,
                    },
                    tls: {
                        rejectUnauthorized: false,
                    },
                });
                this.logger.log('SMTP transporter initialized with custom configuration.');
            }
            else {
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
        }
        catch (err) {
            this.logger.warn(`Could not initialize SMTP transporter: ${err.message}`);
        }
    }
    async sendOrderReceipt(order, customerEmail) {
        if (!this.transporter || !customerEmail)
            return false;
        try {
            const itemsListHtml = (order.items || [])
                .map((item) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.product?.name || 'Producto'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price_at_time || item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>`)
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
                from: config_1.SMTP_USER ? `"Panadería Jhoanes" <${config_1.SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
                to: customerEmail,
                subject: `Recibo de Compra #${(order.id || '').toString().slice(0, 8)} — Panadería Jhoanes`,
                html,
            });
            this.logger.log(`Order receipt sent successfully to ${customerEmail}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending order receipt: ${err.message}`);
            return false;
        }
    }
    async sendCreditAlert(userEmail, clientName, usedCredit, creditLimit, isOverdraft) {
        if (!this.transporter || !userEmail)
            return false;
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
                from: config_1.SMTP_USER ? `"Panadería Jhoanes" <${config_1.SMTP_USER}>` : '"Panadería Jhoanes" <pedidos@jhoanes.com>',
                to: userEmail,
                subject,
                html,
            });
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending credit alert: ${err.message}`);
            return false;
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailService);
//# sourceMappingURL=mail.service.js.map
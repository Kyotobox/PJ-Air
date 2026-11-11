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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
            const orderIdShort = (order.id || '').toString().slice(0, 8);
            const itemsListHtml = (order.items || [])
                .map((item) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.product?.name || item.product_name || item.name || 'Bakery Item'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price_at_time || item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>`)
                .join('');
            const deliveryFeeHtml = Number(order.delivery_fee_charged || 0) > 0
                ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: bold;">Delivery Fee:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${Number(order.delivery_fee_charged).toFixed(2)}</td></tr>`
                : '';
            const taxLineHtml = order.tax_exempt
                ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: bold; color: #059669;">Sales Tax NY (ST-120 Exempt):</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #059669;">$0.00 (0.00%)</td></tr>`
                : Number(order.tax_amount || 0) > 0
                    ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: bold;">NY Sales Tax:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${Number(order.tax_amount).toFixed(2)}</td></tr>`
                    : '';
            const taxLegendHtml = order.tax_legend
                ? `<div style="margin-top: 16px; padding: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 11px; color: #065f46; line-height: 1.4;">
             <strong>Official NYS DTF Resale Certification:</strong> ${order.tax_legend}
           </div>`
                : '';
            let paymentStatusText = '⏳ Pending (Commercial Terms)';
            if (order.payment_status === 'paid') {
                paymentStatusText = '✅ Paid via Stripe';
            }
            else if (order.payment_status === 'credit') {
                paymentStatusText = '📝 Charged to B2B Commercial Credit';
            }
            else if (order.payment_status === 'partially_refunded') {
                paymentStatusText = '🔄 Partial Refund Applied';
            }
            else if (order.payment_status === 'refunded') {
                paymentStatusText = '↩️ Fully Refunded';
            }
            else if (order.payment_status === 'partially_paid') {
                paymentStatusText = '⚡ Partially Paid (Pending Settlement)';
            }
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #b8860b; margin-bottom: 4px;">Jhoanes Bakery — Order Receipt</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Order #${orderIdShort} • Delivery Date: <strong>${order.delivery_date || 'Scheduled'}</strong></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc; text-align: left; color: #475569;">
                <th style="padding: 8px 12px;">Item Description</th>
                <th style="padding: 8px 12px; text-align: center;">Qty</th>
                <th style="padding: 8px 12px; text-align: right;">Unit Price</th>
                <th style="padding: 8px 12px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
              ${deliveryFeeHtml}
              ${taxLineHtml}
              <tr style="font-size: 16px; background: #fefce8;">
                <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">TOTAL AMOUNT:</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">$${Number(order.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          ${taxLegendHtml}
          <div style="margin-top: 24px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #475569;">
            <p style="margin: 0;"><strong>Payment Status:</strong> ${paymentStatusText}</p>
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            Thank you for choosing Jhoanes Bakery Wholesale.
          </p>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <orders@jhoanes.com>',
                to: customerEmail,
                subject: `Order Receipt #${orderIdShort} — Jhoanes Bakery Wholesale`,
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
    async sendEnglishInvoice(order, customerEmail) {
        if (!this.transporter || !customerEmail)
            return false;
        try {
            const orderShortId = (order.id || '').toString().slice(0, 8).toUpperCase();
            const itemsListHtml = (order.items || [])
                .map((item) => `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">
              ${item.product?.name || item.product_name || item.name || 'Bakery Item'}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              ${item.quantity}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
              $${Number(item.price_at_time || item.price || 0).toFixed(2)}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">
              $${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}
            </td>
          </tr>`)
                .join('');
            const deliveryFeeValue = Number(order.delivery_fee_charged || 0);
            const deliveryFeeHtml = order.is_complementary || deliveryFeeValue === 0
                ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: 500; color: #16a34a;">Delivery Fee (Complementary Order):</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #16a34a;">$0.00</td></tr>`
                : `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: 500;">Delivery Fee:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${deliveryFeeValue.toFixed(2)}</td></tr>`;
            const storeCreditHtml = Number(order.store_credit_applied || 0) > 0
                ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: 500; color: #2563eb;">Store Credit Applied:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #2563eb;">-$${Number(order.store_credit_applied).toFixed(2)}</td></tr>`
                : '';
            const taxLineHtml = order.tax_exempt
                ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: 500; color: #059669;">Sales Tax NY (ST-120 Exempt):</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #059669;">$0.00 (0.00%)</td></tr>`
                : Number(order.tax_amount || 0) > 0
                    ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: 500;">NY Sales Tax:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${Number(order.tax_amount).toFixed(2)}</td></tr>`
                    : '';
            const taxLegendHtml = order.tax_legend
                ? `<div style="margin-top: 16px; padding: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 11px; color: #065f46; line-height: 1.4;">
             <strong>NYS DTF Resale Certification:</strong> ${order.tax_legend}
           </div>`
                : '';
            const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b8860b; padding-bottom: 16px; margin-bottom: 24px;">
            <div>
              <h1 style="color: #b8860b; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Jhoanes Bakery</h1>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0; text-transform: uppercase; tracking: 1px;">Wholesale Commercial Operations</p>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac;">
                APPROVED / PAID
              </span>
            </div>
          </div>

          <div style="margin-bottom: 24px; font-size: 14px; color: #334155;">
            <p style="margin: 0 0 6px 0;"><strong>Invoice Number:</strong> INV-${orderShortId}</p>
            <p style="margin: 0 0 6px 0;"><strong>Order Date:</strong> ${new Date(order.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style="margin: 0 0 6px 0;"><strong>Delivery Date:</strong> <strong>${order.delivery_date || 'Scheduled'}</strong></p>
            <p style="margin: 0;"><strong>Payment Method:</strong> ${(order.payment_method || 'Commercial Account').toUpperCase()}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 10px 12px; text-align: left;">Item Description</th>
                <th style="padding: 10px 12px; text-align: center;">Qty</th>
                <th style="padding: 10px 12px; text-align: right;">Unit Price</th>
                <th style="padding: 10px 12px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
              ${deliveryFeeHtml}
              ${taxLineHtml}
              ${storeCreditHtml}
              <tr style="font-size: 16px; background-color: #fefce8; border-top: 2px solid #ca8a04;">
                <td colspan="3" style="padding: 14px 12px; text-align: right; font-weight: 800; color: #854d0e;">TOTAL AMOUNT:</td>
                <td style="padding: 14px 12px; text-align: right; font-weight: 800; color: #854d0e;">$${Number(order.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          ${taxLegendHtml}

          <div style="margin-top: 32px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; font-size: 12px; color: #64748b; text-align: center;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #334155;">Thank you for your business with Jhoanes Bakery Wholesale.</p>
            <p style="margin: 0;">For inquiries or delivery instructions, contact operations at Contact@jhoanesbakery.com</p>
          </div>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <invoices@jhoanes.com>',
                to: customerEmail,
                subject: `Commercial Invoice INV-${orderShortId} — Jhoanes Bakery Wholesale`,
                html,
            });
            this.logger.log(`English invoice successfully dispatched to ${customerEmail}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending English invoice: ${err.message}`);
            return false;
        }
    }
    async sendAdminNewOrderAlert(order, customerEmail, clientName) {
        const adminEmail = config_1.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || config_1.SMTP_USER || 'pedidos@jhoanes.com';
        if (!this.transporter || !adminEmail)
            return false;
        try {
            const orderIdShort = (order.id || '').toString().slice(0, 8);
            const itemsListHtml = (order.items || [])
                .map((item) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${item.product?.name || item.product_name || item.name || 'Bakery Item'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #1e293b;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price_at_time || item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>`)
                .join('');
            const deliveryFee = Number(order.delivery_fee_charged || 0);
            const deliveryFeeHtml = deliveryFee > 0
                ? `<tr><td colspan="3" style="padding: 8px 12px; text-align: right; font-weight: bold;">Delivery Fee:</td><td style="padding: 8px 12px; text-align: right; font-weight: bold;">$${deliveryFee.toFixed(2)}</td></tr>`
                : '';
            const deliveryTypeText = order.delivery_type === 'pickup'
                ? '📦 Bakery Store Pickup (Pick Up)'
                : `🚚 Direct Delivery: ${order.delivery_address_text || order.address?.street || 'Registered Address'}`;
            let paymentStatusBadge = '<span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: bold;">⏳ PENDING</span>';
            if (order.payment_status === 'paid') {
                paymentStatusBadge = '<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: bold;">✅ PAID (Stripe)</span>';
            }
            else if (order.payment_status === 'credit') {
                paymentStatusBadge = '<span style="background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-weight: bold;">📝 COMMERCIAL CREDIT</span>';
            }
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="background: #1e293b; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #f59e0b; margin: 0; font-size: 20px;">🔔 New Wholesale Order Notification</h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Production & Baking Operational Alert</p>
          </div>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 8px 0;"><strong>Order:</strong> #${orderIdShort} (Full ID: ${order.id})</p>
            <p style="margin: 0 0 8px 0;"><strong>B2B Customer:</strong> ${clientName || 'Wholesale Client'}</p>
            <p style="margin: 0 0 8px 0;"><strong>Contact Email:</strong> ${customerEmail || order.user?.email || 'N/A'}</p>
            <p style="margin: 0 0 8px 0;"><strong>Requested Delivery Date:</strong> <strong style="color: #b45309;">${order.delivery_date || 'Scheduled'}</strong></p>
            <p style="margin: 0 0 8px 0;"><strong>Delivery Mode:</strong> ${deliveryTypeText}</p>
            <p style="margin: 0;"><strong>Financial Status:</strong> ${paymentStatusBadge}</p>
          </div>

          <h3 style="color: #334155; font-size: 16px; margin: 20px 0 10px 0;">Items Scheduled for Production</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                <th style="padding: 8px 12px;">Item Description</th>
                <th style="padding: 8px 12px; text-align: center;">Qty</th>
                <th style="padding: 8px 12px; text-align: right;">Unit Price</th>
                <th style="padding: 8px 12px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
              ${deliveryFeeHtml}
              <tr style="font-size: 16px; background: #fefce8;">
                <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">ORDER TOTAL:</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #854d0e;">$${Number(order.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 12px; color: #64748b; text-align: center;">
            <p style="margin: 0;">Automatically generated by the Jhoanes Bakery Wholesale dispatch engine.</p>
          </div>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <orders@jhoanes.com>',
                to: adminEmail,
                subject: `🔔 New Wholesale Order #${orderIdShort} — ${clientName || customerEmail || 'Wholesale Client'}`,
                html,
            });
            this.logger.log(`Admin new order alert sent to ${adminEmail} for order #${orderIdShort}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending admin new order alert: ${err.message}`);
            return false;
        }
    }
    async sendRefundReceipt(order, customerEmail, refundData) {
        if (!this.transporter || !customerEmail)
            return false;
        try {
            const orderIdShort = (order.id || '').toString().slice(0, 8);
            const refundedAmount = Number(refundData.refundedAmount || 0);
            const totalRefunded = Number(refundData.totalRefunded || 0);
            const originalTotal = Number(order.total || 0);
            const remainingBalance = Math.max(0, Math.round((originalTotal - totalRefunded) * 100) / 100);
            const isFullRefund = remainingBalance <= 0.001;
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #0d9488; margin-bottom: 4px;">Jhoanes Bakery Wholesale — Refund Receipt</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Order #${orderIdShort} • Accounting Refund Notification</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          
          <div style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #115e59;">
              Dear Valued Customer, an accounting refund has been processed for your commercial account:
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px;">
              <tr>
                <td style="padding: 6px 0; color: #475569;">Amount Refunded in this Transaction:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f766e; font-size: 16px;">+$${refundedAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">Total Cumulative Refunded:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold;">$${totalRefunded.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569;">Original Order Amount:</td>
                <td style="padding: 6px 0; text-align: right;">$${originalTotal.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 1px solid #99f6e4;">
                <td style="padding: 8px 0; font-weight: bold; color: #1e293b;">Remaining Order Balance:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1e293b;">$${remainingBalance.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 20px; font-size: 13px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 8px;">
            <p style="margin: 0 0 4px 0;"><strong>Refund Type:</strong> ${isFullRefund ? '✅ Full Order Refund' : '🔄 Partial Refund / Invoice Adjustment'}</p>
            <p style="margin: 0;"><strong>Recorded Reason:</strong> ${refundData.reason || 'Agreed commercial administrative adjustment'}</p>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            If the payment was processed by card via Stripe, the refund will be reflected on your bank statement within 5–10 business days. For purchases on credit, your commercial line balance has been automatically credited.
          </p>

          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            Jhoanes Bakery Wholesale — Billing & Finance Department
          </p>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <billing@jhoanes.com>',
                to: customerEmail,
                subject: `Refund Receipt — Order #${orderIdShort} — Jhoanes Bakery Wholesale`,
                html,
            });
            this.logger.log(`Refund receipt sent successfully to ${customerEmail} for order #${orderIdShort}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending refund receipt: ${err.message}`);
            return false;
        }
    }
    async sendStandingOrderConfirmation(scheduledOrder, customerEmail, clientName) {
        if (!this.transporter || !customerEmail)
            return false;
        try {
            const dayTranslations = {
                mon: 'Monday',
                tue: 'Tuesday',
                wed: 'Wednesday',
                thu: 'Thursday',
                fri: 'Friday',
                sat: 'Saturday',
                sun: 'Sunday',
            };
            let daysList = [];
            try {
                if (typeof scheduledOrder.delivery_days_json === 'string') {
                    daysList = JSON.parse(scheduledOrder.delivery_days_json);
                }
                else if (Array.isArray(scheduledOrder.delivery_days_json)) {
                    daysList = scheduledOrder.delivery_days_json;
                }
            }
            catch (_) {
                daysList = ['mon', 'wed', 'fri'];
            }
            const formattedDays = daysList
                .map((d) => dayTranslations[d.toLowerCase().slice(0, 3)] || d)
                .join(', ');
            let itemsList = [];
            try {
                if (typeof scheduledOrder.items_json === 'string') {
                    itemsList = JSON.parse(scheduledOrder.items_json);
                }
                else if (Array.isArray(scheduledOrder.items_json)) {
                    itemsList = scheduledOrder.items_json;
                }
            }
            catch (_) {
                itemsList = [];
            }
            const itemsHtml = itemsList
                .map((item) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.productName || item.name || item.product?.name || 'Bakery Item'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${item.quantity || 1}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${((Number(item.price || 0)) * (Number(item.quantity || 1))).toFixed(2)}</td>
          </tr>`)
                .join('');
            const paymentMethodText = scheduledOrder.payment_method === 'credit'
                ? 'B2B Commercial Credit'
                : 'Saved Card / Auto-Pay';
            const deliveryTypeText = scheduledOrder.delivery_type === 'pickup'
                ? 'Bakery Pickup (Pick Up)'
                : 'Direct Delivery';
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #4f46e5; margin-bottom: 4px;">Jhoanes Bakery Wholesale</h2>
          <h3 style="color: #1e293b; margin-top: 0;">Weekly Subscription Confirmation</h3>
          <p style="color: #64748b; font-size: 14px;">Dear <strong>${clientName || 'Valued Wholesale Partner'}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">
            Your standing recurring order <strong>"${scheduledOrder.title || 'Weekly Wholesale Subscription'}"</strong> has been successfully configured and activated on our wholesale platform.
          </p>

          <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 6px 0;"><strong>📅 Scheduled Delivery Days:</strong> ${formattedDays || 'Monday, Wednesday, Friday'}</p>
            <p style="margin: 0 0 6px 0;"><strong>⏰ Estimated Delivery Window:</strong> ${scheduledOrder.delivery_time || '08:00 AM'}</p>
            <p style="margin: 0 0 6px 0;"><strong>🚚 Delivery Mode:</strong> ${deliveryTypeText}</p>
            <p style="margin: 0;"><strong>💳 Payment Method:</strong> ${paymentMethodText}</p>
          </div>

          <h4 style="color: #334155; margin: 16px 0 8px 0;">Subscribed Bakery Items Breakdown</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f8fafc; text-align: left; color: #475569;">
                <th style="padding: 8px 12px;">Item Description</th>
                <th style="padding: 8px 12px; text-align: center;">Qty</th>
                <th style="padding: 8px 12px; text-align: right;">Unit Price</th>
                <th style="padding: 8px 12px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="font-size: 15px; background: #eef2ff;">
                <td colspan="3" style="padding: 10px 12px; text-align: right; font-weight: bold; color: #3730a3;">ESTIMATED TOTAL PER DELIVERY:</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #3730a3;">$${Number(scheduledOrder.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style="background: #f8fafc; border-radius: 8px; padding: 12px; font-size: 12px; color: #64748b; margin-top: 20px;">
            <p style="margin: 0;">
              <strong>Operations Notice:</strong> Your recurring orders will be automatically generated in the system on the mornings of your scheduled delivery days. You can pause, adjust quantities, or cancel your recurrence at any time from your customer portal.
            </p>
          </div>

          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            Thank you for your business • Jhoanes Bakery Wholesale
          </p>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <subscriptions@jhoanes.com>',
                to: customerEmail,
                subject: `Weekly Subscription Confirmation — Jhoanes Bakery Wholesale`,
                html,
            });
            this.logger.log(`Standing order confirmation sent successfully to ${customerEmail}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending standing order confirmation: ${err.message}`);
            return false;
        }
    }
    async sendCreditAlert(userEmail, clientName, usedCredit, creditLimit, isOverdraft) {
        if (!this.transporter || !userEmail)
            return false;
        try {
            const subject = isOverdraft
                ? `⚠️ Credit Limit Overdraft Alert — Jhoanes Bakery Wholesale`
                : `Commercial Credit Line Update — Jhoanes Bakery Wholesale`;
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: ${isOverdraft ? '#dc2626' : '#2563eb'};">${subject}</h2>
          <p>Dear <strong>${clientName}</strong>,</p>
          <p>Please find below the current status of your B2B commercial credit account:</p>
          <ul>
            <li><strong>Authorized Credit Limit:</strong> $${creditLimit.toFixed(2)}</li>
            <li><strong>Outstanding Balance Due:</strong> $${usedCredit.toFixed(2)}</li>
            <li><strong>Status:</strong> ${isOverdraft ? '<span style="color: red; font-weight: bold;">CREDIT LIMIT EXCEEDED</span>' : '<span style="color: green; font-weight: bold;">UP TO DATE</span>'}</li>
          </ul>
          <p>If you need to settle your balance or request a credit line extension, please contact your account representative.</p>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <credit@jhoanes.com>',
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
    async sendPaymentFailedAlert(userEmail, clientName, orderId, amount, reason) {
        this.logger.warn(`[FAILED PAYMENT ALERT] Order #${orderId} ($${amount.toFixed(2)}) declined for ${userEmail}. Reason: ${reason}`);
        if (!this.transporter || !userEmail)
            return false;
        try {
            const subject = `⚠️ Failed Automatic Payment — Scheduled Order #${orderId.slice(0, 8)}`;
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Automatic Payment Unsuccessful</h2>
          <p>Dear <strong>${clientName}</strong>,</p>
          <p>We regret to inform you that the automatic payment for your recurring scheduled order could not be completed successfully:</p>
          <ul>
            <li><strong>Order:</strong> #${orderId.slice(0, 8)}</li>
            <li><strong>Amount:</strong> $${amount.toFixed(2)}</li>
            <li><strong>Decline Reason:</strong> ${reason}</li>
          </ul>
          <p>Your order is currently in <strong>Payment Pending</strong> status. Please access your customer portal to update your payment method or settle the outstanding invoice.</p>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <billing@jhoanes.com>',
                to: userEmail,
                subject,
                html,
            });
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending payment failed alert: ${err.message}`);
            return false;
        }
    }
    async sendOverdueInvoiceAlert(clientEmail, orderData) {
        if (!this.transporter || !clientEmail)
            return false;
        try {
            const orderId = orderData.id || '';
            const orderIdShort = orderId.toString().slice(0, 8);
            const totalAmount = Number(orderData.total || 0).toFixed(2);
            const dueDate = orderData.payment_due_date || 'N/A';
            const clientName = orderData.clientName || orderData.user?.profile?.company_name || orderData.user?.profile?.full_name || 'Valued Customer';
            const paymentLink = orderData.paymentLink || `${config_1.SITE_URL}/orders/${orderId}`;
            let daysOverdue = orderData.daysOverdue;
            if (daysOverdue === undefined && orderData.payment_due_date) {
                const dueTime = new Date(orderData.payment_due_date).getTime();
                const nowTime = new Date().getTime();
                daysOverdue = Math.max(0, Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24)));
            }
            daysOverdue = daysOverdue ?? 0;
            let itemsTable = '';
            if (Array.isArray(orderData.items) && orderData.items.length > 0) {
                const rows = orderData.items.map((item) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${item.product?.name || item.product_name || item.name || 'Bakery Item'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${Number(item.price_at_time || item.price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${(Number(item.price_at_time || item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('');
                itemsTable = `
          <div style="margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f1f5f9; color: #475569; text-align: left;">
                  <th style="padding: 10px 14px;">Item Description</th>
                  <th style="padding: 10px 14px; text-align: center;">Qty</th>
                  <th style="padding: 10px 14px; text-align: right;">Unit Price</th>
                  <th style="padding: 10px 14px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
            }
            let html = '';
            const templatePath = path.join(__dirname, 'templates', 'invoice_overdue.html');
            if (fs.existsSync(templatePath)) {
                html = fs.readFileSync(templatePath, 'utf8')
                    .replace(/\{\{orderId\}\}/g, orderIdShort)
                    .replace(/\{\{clientName\}\}/g, clientName)
                    .replace(/\{\{paymentDueDate\}\}/g, dueDate)
                    .replace(/\{\{daysOverdue\}\}/g, String(daysOverdue))
                    .replace(/\{\{amountDue\}\}/g, totalAmount)
                    .replace(/\{\{paymentLink\}\}/g, paymentLink)
                    .replace(/\{\{itemsTable\}\}/g, itemsTable);
            }
            else {
                html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="color: #dc2626; margin-bottom: 8px;">Overdue Commercial Invoice Notice — Jhoanes Bakery Wholesale</h2>
            <p>Dear <strong>${clientName}</strong>,</p>
            <p>Please be advised that your commercial order <strong>#${orderIdShort}</strong> due on <strong>${dueDate}</strong> is currently <strong>${daysOverdue} day(s) past due</strong>.</p>
            <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; font-size: 16px; font-weight: bold; color: #991b1b;">Outstanding Balance Due: $${totalAmount}</p>
            </div>
            ${itemsTable}
            <div style="text-align: center; margin: 24px 0;">
              <a href="${paymentLink}" style="background: #059669; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Pay Invoice Online</a>
            </div>
            <p style="font-size: 12px; color: #64748b;">For assistance or billing inquiries, reply to this email or contact billing@jhoanesbakery.com.</p>
          </div>
        `;
            }
            const adminEmail = config_1.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || 'pedidos@jhoanes.com';
            const subject = `⚠️ OVERDUE INVOICE: Order #${orderIdShort} — ${clientName} (${daysOverdue} days past due)`;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Collections" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Collections" <billing@jhoanes.com>',
                to: clientEmail,
                cc: adminEmail,
                subject,
                html,
            });
            this.logger.log(`Overdue invoice alert sent successfully to ${clientEmail} with copy to ${adminEmail}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending overdue invoice alert: ${err.message}`);
            return false;
        }
    }
    async sendFeedbackAlert(feedback) {
        const adminEmail = config_1.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || 'pedidos@jhoanes.com';
        this.logger.log(`[FEEDBACK] Notifying feedback box #${feedback.id} to ${adminEmail}`);
        if (!this.transporter)
            return false;
        try {
            const subject = `📩 New B2B Customer Feedback [${feedback.category.toUpperCase()}]`;
            const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">New B2B Customer Feedback</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: bold; width: 140px;">Feedback ID:</td>
              <td style="padding: 6px 0;">${feedback.id}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Category:</td>
              <td style="padding: 6px 0; text-transform: uppercase; font-weight: bold; color: #1e293b;">${feedback.category}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Customer:</td>
              <td style="padding: 6px 0;">${feedback.userName || 'B2B Client'} (${feedback.userEmail || feedback.userId || 'Anonymous'})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Date:</td>
              <td style="padding: 6px 0;">${new Date(feedback.createdAt || Date.now()).toLocaleString()}</td>
            </tr>
          </table>
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${feedback.message}</p>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">
            You can review and manage this ticket from the administrative portal: <a href="${config_1.SITE_URL}/admin/feedback">${config_1.SITE_URL}/admin/feedback</a>
          </p>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <orders@jhoanes.com>',
                to: adminEmail,
                subject,
                html,
            });
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending feedback alert: ${err.message}`);
            return false;
        }
    }
    async sendZelleRejectionAlert(order, customerEmail, reason) {
        try {
            if (!customerEmail || !order) {
                this.logger.warn('sendZelleRejectionAlert invoked without customerEmail or order');
                return false;
            }
            if (!this.transporter) {
                this.logger.warn('SMTP transporter is not initialized');
                return false;
            }
            const orderIdShort = (order.id || '').toString().slice(0, 8);
            const totalFormatted = (Number(order.total) || 0).toFixed(2);
            const siteUrl = config_1.SITE_URL || 'https://jhoanes.com';
            const retryUrl = `${siteUrl}/checkout`;
            const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #ef4444; padding-bottom: 16px;">
            <h1 style="color: #b91c1c; font-size: 22px; margin: 0;">Zelle Verification Notice — Jhoanes Bakery Wholesale</h1>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Unreconciled Transfer for Order #${orderIdShort}</p>
          </div>

          <p style="font-size: 14px; color: #334155;">Dear Valued Customer,</p>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            We are writing to notify you that the Zelle payment transfer reported for your order <strong>#${orderIdShort}</strong> totaling <strong>$${totalFormatted}</strong> could not be verified in our bank accounts.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; font-weight: bold; color: #991b1b;">Rejection Reason:</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #b91c1c;">${reason || 'Receipt illegible or bank reference does not match received funds.'}</p>
          </div>

          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            Your order has been temporarily placed on hold. To reactivate production and dispatch, please log into your customer portal to retry payment with a valid Zelle reference or credit/debit card:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${retryUrl}" style="background: #dc2626; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Retry Payment / Update Reference</a>
          </div>

          <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            Jhoanes Bakery Wholesale — Treasury & Reconciliation Department
          </p>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <treasury@jhoanes.com>',
                to: customerEmail,
                subject: `⚠️ Unreconciled Zelle Payment — Order #${orderIdShort} — Jhoanes Bakery Wholesale`,
                html,
            });
            this.logger.log(`Zelle rejection alert sent successfully to ${customerEmail} for order #${orderIdShort}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending Zelle rejection alert: ${err.message}`);
            return false;
        }
    }
    async sendFinancialReport(recipientEmails, reportDate, excelBuffer) {
        try {
            if (!recipientEmails || recipientEmails.length === 0) {
                this.logger.warn('sendFinancialReport invoked without recipientEmails');
                return false;
            }
            const validEmails = recipientEmails.map(e => e.trim()).filter(Boolean);
            if (validEmails.length === 0)
                return false;
            if (!this.transporter) {
                this.logger.warn('SMTP transporter is not initialized');
                return false;
            }
            const filename = `FINANCIAL_REPORT_${reportDate}.xlsx`;
            const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #065f46; margin: 0; font-size: 20px;">Daily Consolidated Financial Report</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Operations Close as of ${reportDate} (America/New_York)</p>
          </div>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            Please find attached the consolidated financial report in Excel format with the multi-channel breakdown of sales (Stripe, Zelle, Checks, and B2B Credit Lines) and daily tax reconciliations.
          </p>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; color: #64748b; margin: 20px 0;">
            <p style="margin: 0;"><strong>Attached File:</strong> ${filename}</p>
            <p style="margin: 4px 0 0 0;">Generated automatically by the Jhoanes Bakery Wholesale reconciliation engine.</p>
          </div>
        </div>
      `;
            await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Accounting" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Accounting" <accounting@jhoanes.com>',
                to: validEmails.join(', '),
                subject: `📊 Daily Consolidated Financial Report — Jhoanes Wholesale — ${reportDate}`,
                html,
                attachments: [
                    {
                        filename,
                        content: excelBuffer,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                ],
            });
            this.logger.log(`Financial report sent to ${validEmails.join(', ')} for date ${reportDate}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending financial report: ${err.message}`);
            return false;
        }
    }
    async sendPasswordResetEmail(userEmail, resetToken, clientName) {
        if (!this.transporter || !userEmail)
            return false;
        const resetUrl = `${config_1.SITE_URL}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
        const recipientName = clientName || 'Valued Customer';
        const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #b8860b; font-size: 26px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Jhoanes Bakery</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Wholesale & B2B Orders</p>
        </div>
        
        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
          <h2 style="color: #0f172a; font-size: 18px; margin-bottom: 12px;">Password Reset Request</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hello <strong>${recipientName}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            We received a request to reset the password for your account associated with <strong>${userEmail}</strong>.
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            To choose a new password, click the button below:
          </p>
          
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background-color: #b8860b; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(184, 134, 11, 0.2);">
              Reset Password
            </a>
          </div>

          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #b8860b; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #b8860b; padding: 12px 16px; border-radius: 4px; margin-top: 24px;">
            <p style="color: #475569; font-size: 12px; margin: 0; line-height: 1.4;">
              <strong>Security Notice:</strong> This link is valid for <strong>1 hour</strong>. If you did not request this change, you can safely ignore this email; your current password remains secure and unchanged.
            </p>
          </div>
        </div>

        <div style="border-top: 1px solid #f1f5f9; margin-top: 24px; padding-top: 16px; text-align: center;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">
            © ${new Date().getFullYear()} Jhoanes Bakery Wholesale. All rights reserved.
          </p>
        </div>
      </div>
    `;
        try {
            const info = await this.transporter.sendMail({
                from: config_1.SMTP_USER ? `"Jhoanes Bakery Wholesale" <${config_1.SMTP_USER}>` : '"Jhoanes Bakery Wholesale" <no-reply@jhoanes.com>',
                to: userEmail,
                subject: '🔒 Reset Your Password — Jhoanes Bakery Wholesale',
                html,
            });
            this.logger.log(`Password reset email sent to ${userEmail} (ID: ${info.messageId})`);
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending password reset email to ${userEmail}: ${err.message}`);
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
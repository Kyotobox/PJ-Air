"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CollectionCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const order_entity_1 = require("../orders/order.entity");
const mail_service_1 = require("../mail/mail.service");
const sms_service_1 = require("../sms/sms.service");
let CollectionCron = CollectionCron_1 = class CollectionCron {
    orderRepository;
    mailService;
    smsService;
    logger = new common_1.Logger(CollectionCron_1.name);
    constructor(orderRepository, mailService, smsService) {
        this.orderRepository = orderRepository;
        this.mailService = mailService;
        this.smsService = smsService;
    }
    async handleDailyOverdueCheck() {
        this.logger.log('Iniciando escaneo diario de órdenes con crédito vencido...');
        const summary = {
            processed: 0,
            emailsSent: 0,
            smsSent: 0,
            errors: 0,
        };
        try {
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
                    const dueTime = new Date(order.payment_due_date).getTime();
                    const todayTime = new Date(todayNY).getTime();
                    const daysOverdue = Math.max(0, Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24)));
                    const clientEmail = order.user?.email;
                    const profile = order.user?.profile;
                    const clientName = profile?.company_name || profile?.full_name || 'Cliente Comercial';
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
                    }
                    else {
                        this.logger.warn(`Orden #${order.id} no posee correo electrónico de usuario asociado.`);
                    }
                    if (profile?.phone && profile.phone_verified) {
                        const shortId = (order.id || '').toString().slice(0, 8);
                        const amountFormatted = Number(order.total || 0).toFixed(2);
                        const smsText = `Panaderia Jhoanes: Su orden #${shortId} ($${amountFormatted}) vencio el ${order.payment_due_date} (${daysOverdue} dias de atraso). Por favor regularice su pago.`;
                        const smsResult = await this.smsService.sendOverdueAlert(profile.phone, smsText);
                        if (smsResult.success) {
                            summary.smsSent++;
                        }
                    }
                }
                catch (itemErr) {
                    summary.errors++;
                    this.logger.error(`Error procesando cobro para orden #${order.id}: ${itemErr.message}`);
                }
            }
            this.logger.log(`Escaneo de cobranza concluido. Procesadas: ${summary.processed}, Emails: ${summary.emailsSent}, SMS: ${summary.smsSent}, Errores: ${summary.errors}`);
            return summary;
        }
        catch (err) {
            this.logger.error(`Error crítico en escaneo diario de órdenes vencidas: ${err.message}`);
            summary.errors++;
            return summary;
        }
    }
};
exports.CollectionCron = CollectionCron;
__decorate([
    (0, schedule_1.Cron)('0 9 * * *', { timeZone: 'America/New_York' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CollectionCron.prototype, "handleDailyOverdueCheck", null);
exports.CollectionCron = CollectionCron = CollectionCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        mail_service_1.MailService,
        sms_service_1.SmsService])
], CollectionCron);
//# sourceMappingURL=collection.cron.js.map
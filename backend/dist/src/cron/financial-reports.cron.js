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
var FinancialReportsCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialReportsCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const order_entity_1 = require("../orders/order.entity");
const excel_service_1 = require("../orders/excel.service");
const mail_service_1 = require("../mail/mail.service");
const system_configs_service_1 = require("../system-configs/system-configs.service");
let FinancialReportsCron = FinancialReportsCron_1 = class FinancialReportsCron {
    orderRepository;
    excelService;
    mailService;
    systemConfigsService;
    logger = new common_1.Logger(FinancialReportsCron_1.name);
    constructor(orderRepository, excelService, mailService, systemConfigsService) {
        this.orderRepository = orderRepository;
        this.excelService = excelService;
        this.mailService = mailService;
        this.systemConfigsService = systemConfigsService;
    }
    async handleDailyFinancialReportDispatch(overrideDate) {
        this.logger.log('Iniciando consolidación y despacho automático de reporte financiero diario...');
        const todayNY = overrideDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
        this.logger.log(`Fecha contable de corte (America/New_York): ${todayNY}`);
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
            .orderBy('order.created_at', 'ASC')
            .getMany();
        this.logger.log(`Órdenes encontradas para el corte financiero del ${todayNY}: ${orders.length}`);
        const excelBuffer = await this.excelService.exportConsolidated(orders);
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
};
exports.FinancialReportsCron = FinancialReportsCron;
__decorate([
    (0, schedule_1.Cron)('59 23 * * *', { timeZone: 'America/New_York' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinancialReportsCron.prototype, "handleDailyFinancialReportDispatch", null);
exports.FinancialReportsCron = FinancialReportsCron = FinancialReportsCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        excel_service_1.ExcelService,
        mail_service_1.MailService,
        system_configs_service_1.SystemConfigsService])
], FinancialReportsCron);
//# sourceMappingURL=financial-reports.cron.js.map
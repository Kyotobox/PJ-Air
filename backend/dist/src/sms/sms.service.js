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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SmsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
const common_1 = require("@nestjs/common");
const twilio_1 = __importDefault(require("twilio"));
const config_1 = require("../config");
let SmsService = SmsService_1 = class SmsService {
    logger = new common_1.Logger(SmsService_1.name);
    twilioClient = null;
    constructor() {
        this.initClient();
    }
    initClient() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID || config_1.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN || config_1.TWILIO_AUTH_TOKEN;
        if (accountSid && authToken) {
            try {
                this.twilioClient = (0, twilio_1.default)(accountSid, authToken);
                this.logger.log('Twilio SMS client initialized.');
            }
            catch (err) {
                this.logger.warn(`Could not initialize Twilio client: ${err.message}`);
            }
        }
        else {
            this.logger.log('Twilio credentials not fully set; client in standby.');
        }
    }
    async sendSms(to, body) {
        if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED.toLowerCase() === 'false') {
            this.logger.log(`[SMS_GUARD] Envío a ${to} omitido. Motivo: SMS_DISABLED.`);
            return { skipped: true, reason: 'SMS_DISABLED' };
        }
        if (!to) {
            this.logger.warn('[SMS_GUARD] Envío omitido: número de teléfono no provisto.');
            return { skipped: true, reason: 'PHONE_MISSING' };
        }
        const fromNumber = process.env.TWILIO_PHONE_NUMBER || config_1.TWILIO_PHONE_NUMBER;
        if (!fromNumber) {
            this.logger.warn('[SMS_GUARD] Envío omitido: TWILIO_PHONE_NUMBER no configurado.');
            return { skipped: true, reason: 'SENDER_NUMBER_MISSING' };
        }
        try {
            if (!this.twilioClient) {
                this.initClient();
            }
            if (!this.twilioClient) {
                throw new Error('Twilio client is not available');
            }
            const message = await this.twilioClient.messages.create({
                body,
                from: fromNumber,
                to,
            });
            this.logger.log(`SMS enviado exitosamente a ${to}. SID: ${message.sid}`);
            return { success: true, sid: message.sid };
        }
        catch (err) {
            this.logger.error(`Error al despachar SMS a ${to}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }
    async sendOverdueAlert(phone, text) {
        if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED.toLowerCase() === 'false') {
            this.logger.log(`[SMS_GUARD] Alerta de cobranza a ${phone} omitida. Motivo: SMS_DISABLED.`);
            return { skipped: true, reason: 'SMS_DISABLED' };
        }
        if (!phone) {
            return { skipped: true, reason: 'PHONE_MISSING' };
        }
        return this.sendSms(phone, text);
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = SmsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SmsService);
//# sourceMappingURL=sms.service.js.map
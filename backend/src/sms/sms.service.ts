import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from '../config';

export interface SmsResult {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  sid?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: twilio.Twilio | null = null;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN || TWILIO_AUTH_TOKEN;

    if (accountSid && authToken) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
        this.logger.log('Twilio SMS client initialized.');
      } catch (err: any) {
        this.logger.warn(`Could not initialize Twilio client: ${err.message}`);
      }
    } else {
      this.logger.log('Twilio credentials not fully set; client in standby.');
    }
  }

  /**
   * Envia un SMS genérico respetando el guardarraíl de activación.
   */
  async sendSms(to: string, body: string): Promise<SmsResult> {
    if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED.toLowerCase() === 'false') {
      this.logger.log(`[SMS_GUARD] Envío a ${to} omitido. Motivo: SMS_DISABLED.`);
      return { skipped: true, reason: 'SMS_DISABLED' };
    }

    if (!to) {
      this.logger.warn('[SMS_GUARD] Envío omitido: número de teléfono no provisto.');
      return { skipped: true, reason: 'PHONE_MISSING' };
    }

    const fromNumber = process.env.TWILIO_PHONE_NUMBER || TWILIO_PHONE_NUMBER;
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
    } catch (err: any) {
      this.logger.error(`Error al despachar SMS a ${to}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Dispara una alerta de cobranza vencida vía SMS.
   */
  async sendOverdueAlert(phone: string, text: string): Promise<SmsResult> {
    if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED.toLowerCase() === 'false') {
      this.logger.log(`[SMS_GUARD] Alerta de cobranza a ${phone} omitida. Motivo: SMS_DISABLED.`);
      return { skipped: true, reason: 'SMS_DISABLED' };
    }

    if (!phone) {
      return { skipped: true, reason: 'PHONE_MISSING' };
    }

    return this.sendSms(phone, text);
  }
}

export interface SmsResult {
    success?: boolean;
    skipped?: boolean;
    reason?: string;
    sid?: string;
    error?: string;
}
export declare class SmsService {
    private readonly logger;
    private twilioClient;
    constructor();
    private initClient;
    sendSms(to: string, body: string): Promise<SmsResult>;
    sendOverdueAlert(phone: string, text: string): Promise<SmsResult>;
}

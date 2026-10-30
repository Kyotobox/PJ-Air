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
export declare class CollectionCron {
    private readonly orderRepository;
    private readonly mailService;
    private readonly smsService;
    private readonly logger;
    constructor(orderRepository: Repository<Order>, mailService: MailService, smsService: SmsService);
    handleDailyOverdueCheck(): Promise<OverdueCronSummary>;
}

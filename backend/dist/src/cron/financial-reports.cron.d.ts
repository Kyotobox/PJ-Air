import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { ExcelService } from '../orders/excel.service';
import { MailService } from '../mail/mail.service';
import { SystemConfigsService } from '../system-configs/system-configs.service';
export interface FinancialReportDispatchResult {
    sent: boolean;
    recipients: string[];
    reportDate: string;
    ordersCount: number;
}
export declare class FinancialReportsCron {
    private readonly orderRepository;
    private readonly excelService;
    private readonly mailService;
    private readonly systemConfigsService;
    private readonly logger;
    constructor(orderRepository: Repository<Order>, excelService: ExcelService, mailService: MailService, systemConfigsService: SystemConfigsService);
    handleDailyFinancialReportDispatch(overrideDate?: string): Promise<FinancialReportDispatchResult>;
}

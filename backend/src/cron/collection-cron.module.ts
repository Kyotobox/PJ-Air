import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionCron } from './collection.cron';
import { FinancialReportsCron } from './financial-reports.cron';
import { Order } from '../orders/order.entity';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { ExcelService } from '../orders/excel.service';
import { SystemConfigsModule } from '../system-configs/system-configs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    MailModule,
    SmsModule,
    SystemConfigsModule,
  ],
  providers: [CollectionCron, FinancialReportsCron, ExcelService],
  exports: [CollectionCron, FinancialReportsCron],
})
export class CollectionCronModule {}

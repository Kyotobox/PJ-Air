import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionCron } from './collection.cron';
import { Order } from '../orders/order.entity';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    MailModule,
    SmsModule,
  ],
  providers: [CollectionCron],
  exports: [CollectionCron],
})
export class CollectionCronModule {}

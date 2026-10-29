import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CheckPaymentsController } from './check-payments.controller';
import { CheckPaymentsService } from './check-payments.service';
import { CheckPayment } from './check-payment.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CheckPayment, Order, User]),
    OrdersModule,
    UsersModule,
    MailModule,
    CreditModule,
  ],
  controllers: [PaymentsController, CheckPaymentsController],
  providers: [PaymentsService, CheckPaymentsService],
  exports: [PaymentsService, CheckPaymentsService],
})
export class PaymentsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditService } from './credit.service';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Order])],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}

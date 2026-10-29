import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Order])],
  controllers: [CreditController],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ScheduledOrdersService } from './scheduled-orders.service';
import { ScheduledOrdersController } from './scheduled-orders.controller';
import { ExcelService } from './excel.service';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { ScheduledOrder } from './scheduled-order.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Product, ScheduledOrder]),
    MailModule,
  ],
  providers: [OrdersService, ScheduledOrdersService, ExcelService],
  controllers: [OrdersController, ScheduledOrdersController],
  exports: [OrdersService, ScheduledOrdersService, ExcelService],
})
export class OrdersModule {}


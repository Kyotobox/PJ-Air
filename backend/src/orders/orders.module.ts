import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ExcelService } from './excel.service';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Address } from '../addresses/address.entity';
import { MailModule } from '../mail/mail.module';
import { ZonesModule } from '../zones/zones.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Product, Address]),
    MailModule,
    ZonesModule,
    CreditModule,
  ],
  providers: [OrdersService, ExcelService],
  controllers: [OrdersController],
  exports: [OrdersService, ExcelService],
})
export class OrdersModule {}


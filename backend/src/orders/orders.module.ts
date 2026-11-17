import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DeliveryIncidentsService } from './delivery-incidents.service';
import { DeliveryIncidentsController } from './delivery-incidents.controller';
import { ExcelService } from './excel.service';
import { FeeCalculatorService } from './fee-calculator.service';
import { FinanceExportService } from './finance-export.service';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Address } from '../addresses/address.entity';
import { MailModule } from '../mail/mail.module';
import { ZonesModule } from '../zones/zones.module';
import { CreditModule } from '../credit/credit.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { PaymentsModule } from '../payments/payments.module';
import { AddressesModule } from '../addresses/addresses.module';
import { SystemConfigsModule } from '../system-configs/system-configs.module';
import { AdminActionsModule } from '../admin-actions/admin-actions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Product, Address, DeliveryIncident]),
    MailModule,
    ZonesModule,
    CreditModule,
    LogisticsModule,
    SystemConfigsModule,
    AdminActionsModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => AddressesModule),
  ],
  providers: [OrdersService, ExcelService, FeeCalculatorService, DeliveryIncidentsService, FinanceExportService],
  controllers: [DeliveryIncidentsController, OrdersController],
  exports: [OrdersService, ExcelService, FeeCalculatorService, DeliveryIncidentsService, FinanceExportService],
})
export class OrdersModule {}


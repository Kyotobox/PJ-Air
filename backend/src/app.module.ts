import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DATABASE_PATH, NODE_ENV } from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { DevtoolsModule } from './devtools/devtools.module';
import { AuthModule } from './auth/auth.module';
import { SystemConfigsModule } from './system-configs/system-configs.module';
import { AdminActionsModule } from './admin-actions/admin-actions.module';
import { PaymentsModule } from './payments/payments.module';
import { MailModule } from './mail/mail.module';

// Entities
import { Product } from './products/product.entity';
import { Category } from './products/category.entity';
import { User } from './users/user.entity';
import { Profile } from './users/profile.entity';
import { Address } from './addresses/address.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { ProductDiscount } from './users/product-discount.entity';
import { SystemConfig } from './system-configs/system-config.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: DATABASE_PATH,
      entities: [Product, Category, User, Profile, Address, Order, OrderItem, ProductDiscount, SystemConfig],
      synchronize: NODE_ENV !== 'production',
      logging: false,
    }),
    UsersModule,
    ProductsModule,
    OrdersModule,
    AddressesModule,
    DevtoolsModule,
    AuthModule,
    SystemConfigsModule,
    AdminActionsModule,
    PaymentsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  onModuleInit() {
    this.logger.log('Application initialized');
  }
}

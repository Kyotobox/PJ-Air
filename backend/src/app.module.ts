import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
import { ZonesModule } from './zones/zones.module';

// Entities
import { Product } from './products/product.entity';
import { Category } from './products/category.entity';
import { User } from './users/user.entity';
import { Profile } from './users/profile.entity';
import { Address } from './addresses/address.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { ScheduledOrder } from './orders/scheduled-order.entity';
import { ProductDiscount } from './users/product-discount.entity';
import { SystemConfig } from './system-configs/system-config.entity';
import { DeliveryZone } from './zones/delivery-zone.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: DATABASE_PATH,
      entities: [Product, Category, User, Profile, Address, Order, OrderItem, ScheduledOrder, ProductDiscount, SystemConfig, DeliveryZone],
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
    ZonesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    this.logger.log('Application initialized. Running schema verification...');
    try {
      const qr = this.dataSource.createQueryRunner();
      // Enable WAL mode & busy timeout for high-concurrency SQLite operations
      try {
        await qr.query(`PRAGMA journal_mode = WAL;`);
        await qr.query(`PRAGMA busy_timeout = 10000;`);
        await qr.query(`PRAGMA synchronous = NORMAL;`);
      } catch (e: any) {
        this.logger.warn(`Could not set SQLite pragmas: ${e.message}`);
      }

      const orderCols = await qr.query(`PRAGMA table_info(orders);`);
      const orderColNames = orderCols.map((c: any) => c.name);

      if (!orderColNames.includes('stripe_payment_id')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN stripe_payment_id VARCHAR;`);
      }
      if (!orderColNames.includes('refunded_amount')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN refunded_amount DECIMAL(10,2) DEFAULT 0;`);
      }
      if (!orderColNames.includes('refund_reason')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN refund_reason VARCHAR;`);
      }

      const userCols = await qr.query(`PRAGMA table_info(users);`);
      const userColNames = userCols.map((c: any) => c.name);
      if (!userColNames.includes('stripe_customer_id')) {
        await qr.query(`ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR;`);
      }

      const profileCols = await qr.query(`PRAGMA table_info(profiles);`);
      const profileColNames = profileCols.map((c: any) => c.name);
      if (!profileColNames.includes('phone_verified')) {
        await qr.query(`ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT 0;`);
      }

      await qr.query(`
        CREATE TABLE IF NOT EXISTS scheduled_orders (
          id VARCHAR PRIMARY KEY NOT NULL,
          user_id VARCHAR NOT NULL,
          title VARCHAR DEFAULT 'Pedido Recurrente Semanal',
          items_json TEXT NOT NULL,
          delivery_days_json TEXT NOT NULL,
          delivery_time VARCHAR DEFAULT '08:00',
          delivery_type VARCHAR DEFAULT 'saved',
          address_id VARCHAR,
          payment_method VARCHAR DEFAULT 'credit',
          active BOOLEAN DEFAULT 1,
          total DECIMAL(10,2) DEFAULT 0,
          last_run DATETIME,
          created_at DATETIME DEFAULT (datetime('now'))
        );
      `);

      const schedCols = await qr.query(`PRAGMA table_info(scheduled_orders);`);
      const schedColNames = schedCols.map((c: any) => c.name);
      if (!schedColNames.includes('title')) {
        await qr.query(`ALTER TABLE scheduled_orders ADD COLUMN title VARCHAR DEFAULT 'Pedido Recurrente Semanal';`);
      }
      if (!schedColNames.includes('total')) {
        await qr.query(`ALTER TABLE scheduled_orders ADD COLUMN total DECIMAL(10,2) DEFAULT 0;`);
      }

      await qr.query(`
        CREATE TABLE IF NOT EXISTS delivery_zones (
          id VARCHAR PRIMARY KEY NOT NULL,
          name VARCHAR NOT NULL,
          zip_codes TEXT NOT NULL,
          base_fee DECIMAL(10,2) DEFAULT 0,
          min_free_delivery_amount DECIMAL(10,2) DEFAULT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now'))
        );
      `);

      const zoneCountRows = await qr.query(`SELECT COUNT(*) as count FROM delivery_zones;`);
      const zoneCount = zoneCountRows && zoneCountRows[0] ? Number(zoneCountRows[0].count ?? zoneCountRows[0]['COUNT(*)'] ?? 0) : 0;
      if (zoneCount === 0) {
        await qr.query(`
          INSERT INTO delivery_zones (id, name, zip_codes, base_fee, min_free_delivery_amount, is_active)
          VALUES 
          ('zone-astoria-lic', 'Zona 1: Local Inmediata (Astoria & LIC)', '11101, 11102, 11103, 11104, 11105, 11106, 11109, 11377', 5.00, 60.00, 1),
          ('zone-queens-mid', 'Zona 2: Queens Centro & Norte', '11354, 11355, 11356, 11368, 11369, 11370, 11372, 11373, 11374, 11375, 11378, 11379, 11385', 12.00, 120.00, 1),
          ('zone-bk-east-mnh', 'Zona 3: North Brooklyn & East Manhattan', '10044, 10016, 10017, 10021, 10022, 10028, 10065, 10075, 11206, 11211, 11222, 11237, 11249', 18.00, 180.00, 1),
          ('zone-mnh-south-bk', 'Zona 4: Manhattan Central/Sur & Downtown Brooklyn', '10001, 10002, 10003, 10004, 10005, 10006, 10007, 10009, 10010, 10011, 10012, 10013, 10014, 10018, 10019, 10023, 10024, 10025, 10036, 10038, 11201, 11205, 11215, 11217, 11231, 11238', 25.00, 250.00, 1),
          ('zone-outer-bx', 'Zona 5: Queens Exterior & South Bronx', '10451, 10454, 10455, 11357, 11360, 11361, 11364, 11415, 11418, 11421, 11432, 11435', 35.00, 350.00, 1);
        `);
      }
      await qr.release();
      this.logger.log('Schema verification completed successfully.');
    } catch (e: any) {
      this.logger.warn(`Schema verification warning: ${e.message}`);
    }
  }
}

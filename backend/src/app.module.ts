import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { CreditModule } from './credit/credit.module';
import { SmsModule } from './sms/sms.module';
import { CollectionCronModule } from './cron/collection-cron.module';
import { TaxModule } from './tax/tax.module';
import { LogisticsModule } from './logistics/logistics.module';
import { FeedbackModule } from './feedback/feedback.module';
import { BannersModule } from './banners/banners.module';

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
import { DeliveryZone } from './zones/delivery-zone.entity';
import { CheckPayment } from './payments/check-payment.entity';
import { Feedback } from './feedback/feedback.entity';
import { Banner } from './banners/banner.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: DATABASE_PATH,
      entities: [Product, Category, User, Profile, Address, Order, OrderItem, ProductDiscount, SystemConfig, DeliveryZone, CheckPayment, Feedback, Banner],
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
    CreditModule,
    ScheduleModule.forRoot(),
    SmsModule,
    CollectionCronModule,
    TaxModule,
    LogisticsModule,
    FeedbackModule,
    BannersModule,
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
      if (!orderColNames.includes('payment_due_date')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN payment_due_date VARCHAR;`);
      }
      if (!orderColNames.includes('zelle_reference')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN zelle_reference TEXT;`);
      }
      if (!orderColNames.includes('zelle_receipt_url')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN zelle_receipt_url TEXT;`);
      }
      if (!orderColNames.includes('pending_balance')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN pending_balance DECIMAL(10,2) DEFAULT 0;`);
      }

      const userCols = await qr.query(`PRAGMA table_info(users);`);
      const userColNames = userCols.map((c: any) => c.name);
      if (!userColNames.includes('stripe_customer_id')) {
        await qr.query(`ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR;`);
      }
      if (!userColNames.includes('credit_blocked')) {
        await qr.query(`ALTER TABLE users ADD COLUMN credit_blocked BOOLEAN DEFAULT 0;`);
      }
      if (!userColNames.includes('tax_id')) {
        await qr.query(`ALTER TABLE users ADD COLUMN tax_id VARCHAR;`);
      }
      if (!userColNames.includes('st120_status')) {
        await qr.query(`ALTER TABLE users ADD COLUMN st120_status VARCHAR DEFAULT 'NONE';`);
      }
      if (!userColNames.includes('st120_document_url')) {
        await qr.query(`ALTER TABLE users ADD COLUMN st120_document_url VARCHAR;`);
      }
      if (!userColNames.includes('tax_exempt')) {
        await qr.query(`ALTER TABLE users ADD COLUMN tax_exempt BOOLEAN DEFAULT 0;`);
      }

      await qr.query(`
        CREATE TABLE IF NOT EXISTS check_payments (
          id VARCHAR PRIMARY KEY NOT NULL,
          order_id VARCHAR NOT NULL,
          user_id VARCHAR NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          check_number VARCHAR NOT NULL,
          bank_name VARCHAR NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'PENDING_CLEARANCE',
          deposit_date DATETIME NOT NULL,
          estimated_clearance_date DATETIME NOT NULL,
          cleared_at DATETIME,
          bounced_at DATETIME,
          bounce_reason VARCHAR,
          reference_image_url VARCHAR,
          notes VARCHAR,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now'))
        );
      `);

      const profileCols = await qr.query(`PRAGMA table_info(profiles);`);
      const profileColNames = profileCols.map((c: any) => c.name);
      if (!profileColNames.includes('phone_verified')) {
        await qr.query(`ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT 0;`);
      }
      if (!profileColNames.includes('tax_id')) {
        await qr.query(`ALTER TABLE profiles ADD COLUMN tax_id VARCHAR;`);
      }
      if (!profileColNames.includes('st120_status')) {
        await qr.query(`ALTER TABLE profiles ADD COLUMN st120_status VARCHAR DEFAULT 'NONE';`);
      }
      if (!profileColNames.includes('st120_document_url')) {
        await qr.query(`ALTER TABLE profiles ADD COLUMN st120_document_url VARCHAR;`);
      }
      if (!profileColNames.includes('tax_exempt')) {
        await qr.query(`ALTER TABLE profiles ADD COLUMN tax_exempt BOOLEAN DEFAULT 0;`);
      }

      if (!orderColNames.includes('tax_amount')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;`);
      }
      if (!orderColNames.includes('tax_rate')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0;`);
      }
      if (!orderColNames.includes('tax_exempt')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN tax_exempt BOOLEAN DEFAULT 0;`);
      }
      if (!orderColNames.includes('tax_legend')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN tax_legend TEXT;`);
      }
      if (!orderColNames.includes('fee_amount')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN fee_amount DECIMAL(10,2) DEFAULT 0;`);
      }
      if (!orderColNames.includes('fee_method')) {
        await qr.query(`ALTER TABLE orders ADD COLUMN fee_method VARCHAR;`);
      }

      // TASK-43-03: Purgar tabla obsoleta scheduled_orders
      await qr.query(`DROP TABLE IF EXISTS scheduled_orders;`);

      // TASK-48-07: Purgar tabla obsoleta delivery_zones
      await qr.query(`DROP TABLE IF EXISTS delivery_zones;`);

      // TASK-48-06: Crear tabla feedbacks si no existe
      await qr.query(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          id VARCHAR PRIMARY KEY NOT NULL,
          user_id VARCHAR,
          category VARCHAR NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR DEFAULT 'pending',
          created_at DATETIME DEFAULT (datetime('now'))
        );
      `);

      // TASK-51-01: Columnas en addresses para instrucciones de acceso en madrugada
      const addressCols = await qr.query(`PRAGMA table_info(addresses);`);
      const addressColNames = addressCols.map((c: any) => c.name);
      if (!addressColNames.includes('access_code')) {
        await qr.query(`ALTER TABLE addresses ADD COLUMN access_code TEXT;`);
      }
      if (!addressColNames.includes('has_key')) {
        await qr.query(`ALTER TABLE addresses ADD COLUMN has_key BOOLEAN DEFAULT 0;`);
      }
      if (!addressColNames.includes('key_location')) {
        await qr.query(`ALTER TABLE addresses ADD COLUMN key_location TEXT;`);
      }
      if (!addressColNames.includes('fridge_access_required')) {
        await qr.query(`ALTER TABLE addresses ADD COLUMN fridge_access_required BOOLEAN DEFAULT 0;`);
      }
      if (!addressColNames.includes('delivery_photos_json')) {
        await qr.query(`ALTER TABLE addresses ADD COLUMN delivery_photos_json TEXT;`);
      }

      // TASK-52-01: Crear tabla banners si no existe
      await qr.query(`
        CREATE TABLE IF NOT EXISTS banners (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title VARCHAR NOT NULL,
          title_en VARCHAR,
          subtitle TEXT,
          subtitle_en TEXT,
          badge VARCHAR,
          badge_en VARCHAR,
          tag VARCHAR,
          tag_en VARCHAR,
          image_url VARCHAR NOT NULL,
          link_url VARCHAR DEFAULT '#catalogo',
          button_text VARCHAR DEFAULT 'Ver Productos',
          button_text_en VARCHAR DEFAULT 'Browse Catalog',
          display_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now'))
        );
      `);
      await qr.release();
      this.logger.log('Schema verification completed successfully.');
    } catch (e: any) {
      this.logger.warn(`Schema verification warning: ${e.message}`);
    }
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CategoriesController } from './categories.controller';
import { Product } from './product.entity';
import { Category } from './category.entity';
import { PaymentsModule } from '../payments/payments.module';
import { StripeProductSyncService } from './stripe-product-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category]), PaymentsModule],
  providers: [ProductsService, StripeProductSyncService],
  controllers: [CategoriesController, ProductsController],
  exports: [ProductsService, StripeProductSyncService],
})
export class ProductsModule {}


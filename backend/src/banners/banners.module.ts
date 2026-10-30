import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banner } from './banner.entity';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Banner])],
    controllers: [BannersController],
    providers: [BannersService],
    exports: [BannersService],
})
export class BannersModule {}

import { Controller, Get, Param, Patch, Body, UseGuards, Req, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { SystemConfigsService } from './system-configs.service';
import { AdminActionsService } from '../admin-actions/admin-actions.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller(['configs', 'api/configs', 'system-configs', 'api/system-configs'])
export class SystemConfigsController {
  constructor(
    private readonly configsService: SystemConfigsService,
    @Optional() private readonly adminActionsService?: AdminActionsService,
  ) {}

  @Get('delivery-schedule')
  async getDeliverySchedule() {
    return this.configsService.getDeliverySchedule();
  }

  @Patch('delivery-schedule')
  @UseGuards(AuthGuard)
  async updateDeliverySchedule(@Body() body: any, @Req() req: any) {
    const userRole = req.user?.role?.toLowerCase();
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only admin users can modify system configurations');
    }
    return this.configsService.updateDeliverySchedule(body);
  }

  @Get('store-discount')
  async getStoreDiscount() {
    return this.configsService.getStoreDiscount();
  }

  @Patch('store-discount')
  @UseGuards(AuthGuard)
  async updateStoreDiscount(@Body() body: any, @Req() req: any) {
    const userRole = req.user?.role?.toLowerCase();
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only admin users can modify system configurations');
    }
    const previous = await this.configsService.getStoreDiscount();
    const updated = await this.configsService.updateStoreDiscount(body);
    if (this.adminActionsService) {
      try {
        await this.adminActionsService.logAction(
          req.user?.id || 'admin',
          req.user?.name || req.user?.email || 'Admin',
          'DISCOUNT_CHANGE',
          'SystemConfig',
          'store_general_discount',
          previous,
          updated,
          body?.reason || 'Actualización de descuento general de tienda',
          req.ip,
        );
      } catch (_) {}
    }
    return updated;
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    const value = await this.configsService.get(key);
    if (value === '') {
      throw new NotFoundException(`Configuration for key "${key}" not found`);
    }
    return { key, value };
  }

  @Patch(':key')
  @UseGuards(AuthGuard)
  async update(@Param('key') key: string, @Body('value') value: string, @Req() req: any) {
    const userRole = req.user?.role?.toLowerCase();
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only admin users can modify system configurations');
    }
    return this.configsService.update(key, value);
  }
}

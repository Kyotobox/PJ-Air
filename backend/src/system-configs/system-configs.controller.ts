import { Controller, Get, Param, Patch, Body, UseGuards, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SystemConfigsService } from './system-configs.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('configs')
export class SystemConfigsController {
  constructor(private readonly configsService: SystemConfigsService) {}

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

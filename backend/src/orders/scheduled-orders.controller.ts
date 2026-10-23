import { Controller, Post, Get, Body, Param, Patch, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ScheduledOrdersService } from './scheduled-orders.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orders/scheduled')
export class ScheduledOrdersController {
  constructor(private readonly scheduledService: ScheduledOrdersService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() body: any, @Req() req: any) {
    const targetUserId = (req.user?.role === 'admin' && body.userId) ? body.userId : req.user.id;
    return this.scheduledService.create(targetUserId, body);
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAll(@Req() req: any) {
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'produccion';
    if (isAdmin) {
      return this.scheduledService.findAll();
    }
    return this.scheduledService.findByUser(req.user.id);
  }

  @Get('projections')
  @UseGuards(AuthGuard)
  async getProjections(@Query('days') days?: string) {
    const numDays = days ? parseInt(days, 10) : 7;
    return this.scheduledService.getProjections(numDays);
  }

  @Post('run-now')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async runNow(@Body() body: { day?: string }) {
    return this.scheduledService.executeScheduledOrders(body?.day);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string) {
    return this.scheduledService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const isAdmin = req.user?.role === 'admin';
    return this.scheduledService.update(id, req.user.id, isAdmin, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @Req() req: any) {
    const isAdmin = req.user?.role === 'admin';
    return this.scheduledService.remove(id, req.user.id, isAdmin);
  }
}

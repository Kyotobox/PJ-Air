import { Controller, Post, Get, Body, Param, Patch, Query, Res, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ExcelService } from './excel.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResourceOwnershipGuard } from '../auth/resource-ownership.guard';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly excelService: ExcelService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() body: any, @Req() req: any) {
    const targetUserId = (req.user?.role === 'admin' && body.userId) ? body.userId : req.user.id;
    const { userId, ...orderData } = body;
    return this.ordersService.create(targetUserId, orderData);
  }

  @Post('settle-batch')
  @UseGuards(AuthGuard)
  async settleBatch(
    @Body() body: { order_ids: string[]; payment_method: string; payment_reference?: string },
    @Req() req: any,
  ) {
    return this.ordersService.settleBatch(req.user.id, req.user.role, body);
  }

  @Get('frequent-products')
  @UseGuards(AuthGuard)
  async getFrequentProducts(@Req() req: any) {
    return this.ordersService.getFrequentProducts(req.user.id);
  }

  @Get('user/:userId/frequent-products')
  @UseGuards(AuthGuard, ResourceOwnershipGuard)
  async getUserFrequentProducts(@Param('userId') userId: string, @Req() req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'delivery' && role !== 'produccion' && req.user.id !== userId) {
      throw new ForbiddenException('Cannot access other user frequent products');
    }
    return this.ordersService.getFrequentProducts(userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAll(@Req() req: any) {
    const role = req.user?.role;
    if (role === 'admin' || role === 'delivery' || role === 'produccion') {
      return this.ordersService.findAll();
    }
    return this.ordersService.findByUser(req.user.id);
  }

  @Get('user/:userId')
  @UseGuards(AuthGuard, ResourceOwnershipGuard)
  async findByUser(@Param('userId') userId: string, @Req() req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'delivery' && role !== 'produccion' && req.user.id !== userId) {
      throw new ForbiddenException('Cannot access other user orders');
    }
    return this.ordersService.findByUser(userId);
  }

  @Get('reports/export-individual')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async exportIndividual(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: any,
  ) {
    const orders = await this.ordersService.findInRange(startDate, endDate);
    const buffer = await this.excelService.exportIndividual(orders);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ORDENES_INDIVIDUALES.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('reports/export-consolidated')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async exportConsolidated(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: any,
  ) {
    const orders = await this.ordersService.findInRange(startDate, endDate);
    const buffer = await this.excelService.exportConsolidated(orders);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ORDENES_CONSOLIDADO.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('reports/range')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async findInRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string,
  ) {
    return this.ordersService.findInRange(startDate, endDate, userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const order = await this.ordersService.findOne(id);
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'delivery' && role !== 'produccion' && order.user_id !== req.user.id) {
      throw new ForbiddenException('Cannot access this order');
    }
    return order;
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard)
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    const order = await this.ordersService.findOne(id);
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'delivery' && role !== 'produccion' && order.user_id !== req.user.id) {
      throw new ForbiddenException('Cannot modify this order status');
    }
    return this.ordersService.updateStatus(id, status, role);
  }

  @Patch(':id/payment-status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async updatePaymentStatus(@Param('id') id: string, @Body('payment_status') paymentStatus: string) {
    return this.ordersService.update(id, { payment_status: paymentStatus }, 'admin');
  }

  @Patch(':id/approve-zelle')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async approveZelle(@Param('id') id: string) {
    return this.ordersService.approveZellePayment(id);
  }

  @Patch(':id/reject-zelle')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async rejectZelle(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.ordersService.rejectZellePayment(id, reason);
  }

  @Patch(':id/assign')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'produccion')
  async assignDelivery(@Param('id') id: string, @Body('deliveryUserId') deliveryUserId: string) {
    return this.ordersService.assignDelivery(id, deliveryUserId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const order = await this.ordersService.findOne(id);
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'produccion' && order.user_id !== req.user.id) {
      throw new ForbiddenException('Cannot modify this order');
    }
    return this.ordersService.update(id, body, role);
  }
}

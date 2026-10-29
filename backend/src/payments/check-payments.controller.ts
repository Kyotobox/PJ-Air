import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CheckPaymentsService,
  RegisterCheckDto,
} from './check-payments.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CheckPaymentStatus } from './check-payment.entity';

@Controller('payments/checks')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class CheckPaymentsController {
  constructor(private readonly checkPaymentsService: CheckPaymentsService) {}

  @Post()
  async register(@Body() dto: RegisterCheckDto) {
    return await this.checkPaymentsService.registerCheck(dto);
  }

  @Post(':id/deposit')
  async markAsDeposited(
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return await this.checkPaymentsService.markAsDeposited(id, body?.notes);
  }

  @Post(':id/bounce')
  async markAsBounced(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return await this.checkPaymentsService.markAsBounced(id, body?.reason);
  }

  @Get('reconciliation')
  async getReconciliation() {
    return await this.checkPaymentsService.getReconciliationGrouped();
  }

  @Get('order/:orderId')
  async getByOrder(@Param('orderId') orderId: string) {
    return await this.checkPaymentsService.findByOrder(orderId);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.checkPaymentsService.findById(id);
  }

  @Get()
  async getAll(
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('userId') userId?: string,
  ) {
    return await this.checkPaymentsService.findAll({ status: status as CheckPaymentStatus, orderId, userId });
  }
}

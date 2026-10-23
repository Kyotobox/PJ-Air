import { Controller, Post, Body, Headers, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  async createIntent(
    @Body() body: { amount: number; currency?: string; orderId?: string; customerEmail?: string; description?: string }
  ) {
    return this.paymentsService.createPaymentIntent(body);
  }

  @Post('create-settlement-link')
  @UseGuards(AuthGuard)
  async createSettlementLink(
    @Body() body: { orderId?: string; clientId?: string; clientEmail?: string },
    @Req() req: any,
  ) {
    // If not admin and requested for client, ensure only own data is queried
    if (req.user?.role !== 'admin' && body.clientId && body.clientId !== req.user.id) {
      body.clientId = req.user.id;
    }
    return this.paymentsService.createSettlementLink(body);
  }

  @Post('refund')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async createRefund(
    @Body() body: { orderId: string; amount?: number; reason?: string },
  ) {
    return this.paymentsService.createRefund(body);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    @Body() body: any,
  ) {
    const rawPayload = req.rawBody || body;
    return this.paymentsService.handleWebhook(rawPayload, signature);
  }
}

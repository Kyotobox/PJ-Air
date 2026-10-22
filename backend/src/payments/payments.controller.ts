import { Controller, Post, Body, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  async createIntent(
    @Body() body: { amount: number; currency?: string; orderId?: string; customerEmail?: string; description?: string }
  ) {
    return this.paymentsService.createPaymentIntent(body);
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

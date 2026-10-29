import {
  Controller, Post, Get, Delete, Body, Param, Headers, Req, HttpCode, HttpStatus, UseGuards
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  async createIntent(
    @Body() body: {
      amount: number;
      currency?: string;
      orderId?: string;
      customerEmail?: string;
      description?: string;
      customerId?: string;
      paymentMethodId?: string;
      saveCard?: boolean;
      paymentMethodType?: string;
    },
    @Req() req: any,
  ) {
    let customerId = body.customerId;
    if (!customerId && req.user?.id) {
      const customer = await this.paymentsService.getOrCreateCustomer(req.user.id);
      customerId = customer.id;
    }
    return this.paymentsService.createPaymentIntent({
      ...body,
      customerId,
      customerEmail: body.customerEmail || req.user?.email,
    });
  }

  @Post('setup-intent')
  @UseGuards(AuthGuard)
  async createSetupIntent(@Req() req: any) {
    return this.paymentsService.createSetupIntent(req.user.id);
  }

  @Get('payment-methods')
  @UseGuards(AuthGuard)
  async getPaymentMethods(@Req() req: any) {
    return this.paymentsService.getPaymentMethods(req.user.id);
  }

  @Delete('payment-methods/:id')
  @UseGuards(AuthGuard)
  async deletePaymentMethod(@Param('id') id: string, @Req() req: any) {
    return this.paymentsService.deletePaymentMethod(req.user.id, id);
  }

  @Post('customer-portal')
  @UseGuards(AuthGuard)
  async createCustomerPortal(@Req() req: any) {
    return this.paymentsService.createCustomerPortalSession(req.user.id);
  }

  @Post('create-settlement-link')
  @UseGuards(AuthGuard)
  async createSettlementLink(
    @Body() body: { orderId?: string; clientId?: string; clientEmail?: string; paymentMethod?: string },
    @Req() req: any,
  ) {
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

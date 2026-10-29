import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CreditService } from './credit.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('credit')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Get('status')
  @UseGuards(AuthGuard)
  async getStatus(@Req() req: any) {
    const userId = req.user?.id;
    return this.creditService.getClientCreditSummary(userId);
  }

  @Get('my-status')
  @UseGuards(AuthGuard)
  async getMyStatus(@Req() req: any) {
    const userId = req.user?.id;
    return this.creditService.getClientCreditSummary(userId);
  }
}

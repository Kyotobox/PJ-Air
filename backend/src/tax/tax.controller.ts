import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { TaxService } from './tax.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post('validate-st120/:userId')
  @UseGuards(AuthGuard)
  async validateST120(@Param('userId') userId: string) {
    return this.taxService.auditUserST120(userId);
  }

  @Post('approve/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async approveExemption(@Param('userId') userId: string) {
    return this.taxService.approveExemption(userId);
  }

  @Post('reject/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async rejectExemption(@Param('userId') userId: string, @Body('reason') reason?: string) {
    return this.taxService.rejectExemption(userId, reason);
  }

  @Get('status/:userId')
  @UseGuards(AuthGuard)
  async getStatus(@Param('userId') userId: string) {
    const user = await this.taxService['userRepository'].findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    const isExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt);
    const taxId = user?.profile?.tax_id || user?.tax_id || null;
    const st120Status = user?.profile?.st120_status || user?.st120_status || 'NONE';
    const st120DocUrl = user?.profile?.st120_document_url || user?.st120_document_url || null;

    return {
      userId,
      taxId,
      st120Status,
      st120DocumentUrl: st120DocUrl,
      taxExempt: isExempt,
      taxLegend: isExempt ? this.taxService.getOfficialNysDtfLegend(taxId) : null,
    };
  }
}

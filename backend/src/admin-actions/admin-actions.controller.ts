import { Controller, Get, Patch, Param, Body, Query, UseGuards, Req, ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminActionsService } from './admin-actions.service';

@Controller(['admin-actions', 'api/admin-actions'])
export class AdminActionsController {
  constructor(private readonly adminActionsService: AdminActionsService) {}

  @Get('audit-logs')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('target_entity') targetEntity?: string,
    @Query('targetEntity') targetEntityCamel?: string,
    @Query('target_id') targetId?: string,
    @Query('targetId') targetIdCamel?: string,
    @Query('admin_id') adminId?: string,
    @Query('adminId') adminIdCamel?: string,
    @Query('actor_role') actorRole?: string,
    @Query('actorRole') actorRoleCamel?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminActionsService.getAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      action,
      targetEntity: targetEntity || targetEntityCamel,
      targetId: targetId || targetIdCamel,
      adminId: adminId || adminIdCamel,
      actorRole: actorRole || actorRoleCamel,
      search,
      startDate,
      endDate,
    });
  }

  @Patch('users/:id/reset-password')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { newPassword?: string },
    @Req() req: any,
  ) {
    if (!req.user || req.user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden realizar esta acción');
    }
    const { newPassword } = body;
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }
    const res = await this.adminActionsService.resetPassword(id, newPassword);
    try {
      await this.adminActionsService.logAction(
        req.user.id,
        req.user.name || req.user.email || 'Admin',
        'PASSWORD_RESET',
        'User',
        id,
        null,
        null,
        'Restablecimiento forzado de contraseña por administrador',
        req.ip,
      );
    } catch (_) {}
    return res;
  }

  @Patch('me/change-password')
  @UseGuards(AuthGuard)
  async changePassword(
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('No autenticado');
    }
    const { currentPassword, newPassword } = body;
    if (!currentPassword) {
      throw new BadRequestException('Contraseña actual requerida');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }
    return this.adminActionsService.changeOwnPassword(userId, currentPassword, newPassword);
  }
}

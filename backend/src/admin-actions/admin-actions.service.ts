import { Injectable, ForbiddenException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
import { AdminAuditLog } from './admin-audit-log.entity';
import { hashPassword, verifyPassword } from '../auth/crypto.util';
import * as bcrypt from 'bcryptjs';

// Dependencia: crypto.util.ts v2.2.11 — No modificar sin actualizar esta referencia

@Injectable()
export class AdminActionsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
  ) {}

  async resetPassword(targetUserId: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role === 'admin') {
      throw new ForbiddenException('No se puede restablecer la contraseña de otro administrador');
    }

    const hashedPassword = hashPassword(newPassword);
    await this.userRepository.update(targetUserId, { password: hashedPassword });

    let config = await this.systemConfigRepository.findOne({ where: { key: `force_pwd_change:${targetUserId}` } });
    if (config) {
      config.value = 'true';
    } else {
      config = this.systemConfigRepository.create({
        key: `force_pwd_change:${targetUserId}`,
        value: 'true',
      });
    }
    await this.systemConfigRepository.save(config);

    return {
      success: true,
      message: 'Contraseña restablecida. El usuario deberá cambiarla en su próximo acceso.',
    };
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    let isMatch = false;
    const dbPassword = user.password;

    if (dbPassword && dbPassword.includes(':')) {
      isMatch = verifyPassword(currentPassword, dbPassword);
    } else if (dbPassword && (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2y$'))) {
      const hashToCompare = dbPassword.startsWith('$2y$')
        ? dbPassword.replace(/^\$2y\$/, '$2a$')
        : dbPassword;
      isMatch = bcrypt.compareSync(currentPassword, hashToCompare);
    } else {
      isMatch = dbPassword === currentPassword;
    }

    if (!isMatch) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const hashedNewPassword = hashPassword(newPassword);
    await this.userRepository.update(userId, { password: hashedNewPassword });

    await this.systemConfigRepository.delete({ key: `force_pwd_change:${userId}` });

    return {
      success: true,
      message: 'Contraseña actualizada correctamente.',
    };
  }

  async logAction(
    adminId: string,
    adminName: string,
    action: string,
    targetEntity: string,
    targetId: string,
    prevState?: any,
    newState?: any,
    notes?: string,
    ip?: string,
  ): Promise<AdminAuditLog> {
    const prevJson = prevState !== undefined && prevState !== null
      ? (typeof prevState === 'string' ? prevState : JSON.stringify(prevState))
      : null;
    const newJson = newState !== undefined && newState !== null
      ? (typeof newState === 'string' ? newState : JSON.stringify(newState))
      : null;

    const log = this.adminAuditLogRepository.create({
      admin_id: String(adminId || ''),
      admin_name: String(adminName || 'Admin'),
      action: String(action || ''),
      target_entity: String(targetEntity || ''),
      target_id: String(targetId || ''),
      previous_state_json: prevJson,
      new_state_json: newJson,
      notes: notes || null,
      ip_address: ip || null,
    });

    return this.adminAuditLogRepository.save(log);
  }

  async getAuditLogs(options?: {
    page?: number;
    limit?: number;
    action?: string;
    targetEntity?: string;
    targetId?: string;
    adminId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: AdminAuditLog[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options?.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.adminAuditLogRepository.createQueryBuilder('log');

    if (options?.action) {
      qb.andWhere('log.action = :action', { action: options.action });
    }
    if (options?.targetEntity) {
      qb.andWhere('log.target_entity = :targetEntity', { targetEntity: options.targetEntity });
    }
    if (options?.targetId) {
      qb.andWhere('log.target_id = :targetId', { targetId: options.targetId });
    }
    if (options?.adminId) {
      qb.andWhere('log.admin_id = :adminId', { adminId: options.adminId });
    }
    if (options?.startDate) {
      qb.andWhere('log.created_at >= :startDate', { startDate: options.startDate });
    }
    if (options?.endDate) {
      qb.andWhere('log.created_at <= :endDate', { endDate: options.endDate });
    }

    qb.orderBy('log.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [logs, total] = await qb.getManyAndCount();
    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

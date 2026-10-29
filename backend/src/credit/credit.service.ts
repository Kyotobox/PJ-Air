import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

@Injectable()
export class CreditService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Obtiene el límite de crédito autorizado en el perfil / cuenta del cliente.
   */
  async getCreditLimit(clientId: string): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: clientId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException(`Cliente con id ${clientId} no encontrado`);
    }

    return Math.round((Number(user.credit_limit || 0) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Suma de órdenes donde payment_method = 'credit' y status != 'cancelled' y payment_status != 'paid'.
   * Calcula estrictamente la deuda neta deduciendo cualquier monto reembolsado.
   */
  async getUsedCredit(clientId: string): Promise<number> {
    const orders = await this.orderRepository.find({
      where: { user_id: clientId },
    });

    const activeCreditOrders = orders.filter((o) => {
      const isCredit = o.payment_method === 'credit';
      const notCancelled = o.status !== 'cancelled' && o.status !== 'Cancelado';
      const notPaid = o.payment_status !== 'paid';
      return isCredit && notCancelled && notPaid;
    });

    const totalUsed = activeCreditOrders.reduce((sum, o) => {
      const netDebt = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
      return sum + netDebt;
    }, 0);

    return Math.round((totalUsed + Number.EPSILON) * 100) / 100;
  }

  /**
   * Límite disponible = getCreditLimit - getUsedCredit
   */
  async getAvailableCredit(clientId: string): Promise<number> {
    const limit = await this.getCreditLimit(clientId);
    const used = await this.getUsedCredit(clientId);
    return Math.round((limit - used + Number.EPSILON) * 100) / 100;
  }

  /**
   * Cálculo determinista de payment_due_date = created_at + 7 días (ISO YYYY-MM-DD).
   */
  calculatePaymentDueDate(createdAt: Date | string = new Date()): string {
    const base = typeof createdAt === 'string' ? new Date(createdAt) : new Date(createdAt.getTime());
    const dueDate = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    const yr = dueDate.getUTCFullYear();
    const mo = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
    const da = String(dueDate.getUTCDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  /**
   * Valida si una orden a crédito puede ser aprobada o excede el crédito disponible.
   * Sad Path (§6): Si la orden excede getAvailableCredit (y no tiene credit_override), arroja BadRequestException.
   */
  async validateCreditOrder(clientId: string, orderAmount: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: clientId } });
    if (!user) {
      throw new NotFoundException(`Cliente con id ${clientId} no encontrado`);
    }

    if (user.credit_blocked && !user.credit_override) {
      throw new BadRequestException(
        'Crédito bloqueado por mora o cheques devueltos. Contacte a administración para regularizar su cuenta.'
      );
    }

    const availableCredit = await this.getAvailableCredit(clientId);
    const limit = await this.getCreditLimit(clientId);
    const used = await this.getUsedCredit(clientId);

    if (orderAmount > availableCredit && !user.credit_override) {
      throw new BadRequestException(
        `Límite de crédito excedido: Tu límite es de $${limit.toFixed(2)}, tienes $${used.toFixed(2)} pendiente y esta orden suma $${orderAmount.toFixed(2)}. Cupo disponible: $${availableCredit.toFixed(2)}.`
      );
    }
  }
}

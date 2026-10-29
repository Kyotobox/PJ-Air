import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckPayment, CheckPaymentStatus } from './check-payment.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { addBusinessDays } from '../common/utils/date.utils';

export class RegisterCheckDto {
  order_id: string;
  check_number: string;
  bank_name: string;
  amount: number;
  received_date: string; // YYYY-MM-DD
  notes?: string;
  user_id?: string;
  status?: CheckPaymentStatus;
}

@Injectable()
export class CheckPaymentsService {
  constructor(
    @InjectRepository(CheckPayment)
    private readonly checkPaymentRepository: Repository<CheckPayment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Registra un pago por cheque y calcula automáticamente su clearance_deadline a +3 días hábiles.
   */
  async registerCheck(dto: RegisterCheckDto): Promise<CheckPayment> {
    if (!dto.order_id || !dto.check_number || !dto.bank_name || dto.amount === undefined || !dto.received_date) {
      throw new BadRequestException('Faltan campos obligatorios para registrar el cheque (order_id, check_number, bank_name, amount, received_date)');
    }

    const numAmount = Number(dto.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestException('El monto del cheque debe ser un número mayor a cero');
    }

    const order = await this.orderRepository.findOne({
      where: { id: dto.order_id },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException(`Orden con id ${dto.order_id} no encontrada`);
    }

    const clearance_deadline = addBusinessDays(dto.received_date, 3);
    const userId = dto.user_id || order.user_id;

    const checkPayment = this.checkPaymentRepository.create({
      order_id: order.id,
      user_id: userId,
      check_number: dto.check_number.trim(),
      bank_name: dto.bank_name.trim(),
      amount: numAmount,
      received_date: dto.received_date,
      clearance_deadline,
      status: dto.status || 'IN_HAND',
      notes: dto.notes || '',
    });

    return await this.checkPaymentRepository.save(checkPayment);
  }

  /**
   * Marca el cheque como DEPOSITED.
   * Libera cupo de crédito marcando la orden asociada como 'paid'.
   */
  async markAsDeposited(checkPaymentId: string, notes?: string): Promise<CheckPayment> {
    const check = await this.checkPaymentRepository.findOne({
      where: { id: checkPaymentId },
    });

    if (!check) {
      throw new NotFoundException(`Cheque con id ${checkPaymentId} no encontrado`);
    }

    check.status = 'DEPOSITED';
    if (notes) {
      check.notes = check.notes ? `${check.notes} | ${notes}` : notes;
    }

    const savedCheck = await this.checkPaymentRepository.save(check);

    // Liberar cupo de crédito marcando la orden asociada como 'paid'
    const order = await this.orderRepository.findOne({
      where: { id: check.order_id },
    });

    if (order) {
      order.payment_status = 'paid';
      await this.orderRepository.save(order);
    }

    return savedCheck;
  }

  /**
   * Marca el cheque como BOUNCED (Sad Path §6).
   * Revierte la orden a 'pending', reactiva la deuda en la cuenta corriente del cliente,
   * y bloquea el crédito del cliente (credit_override = false, credit_blocked = true).
   */
  async markAsBounced(checkPaymentId: string, bounceReason?: string): Promise<CheckPayment> {
    const check = await this.checkPaymentRepository.findOne({
      where: { id: checkPaymentId },
    });

    if (!check) {
      throw new NotFoundException(`Cheque con id ${checkPaymentId} no encontrado`);
    }

    check.status = 'BOUNCED';
    const reasonText = bounceReason || 'Cheque rebotado por entidad bancaria';
    check.notes = check.notes
      ? `${check.notes} | [REBOTE] ${reasonText}`
      : `[REBOTE] ${reasonText}`;

    const savedCheck = await this.checkPaymentRepository.save(check);

    // Revertir orden a 'pending' para reactivar el cobro y la deuda
    const order = await this.orderRepository.findOne({
      where: { id: check.order_id },
    });

    if (order) {
      order.payment_status = 'pending';
      const bounceAlert = `[ALERTA CONTABLE] Cheque #${check.check_number} rebotado. Pago revertido a deuda activa.`;
      order.notes = order.notes ? `${order.notes} | ${bounceAlert}` : bounceAlert;
      await this.orderRepository.save(order);
    }

    // Bloquear crédito del cliente y revocar cualquier override previo
    const user = await this.userRepository.findOne({
      where: { id: check.user_id },
    });

    if (user) {
      user.credit_override = false;
      user.credit_blocked = true;
      await this.userRepository.save(user);
    }

    return savedCheck;
  }

  /**
   * Retorna todos los cheques con filtros opcionales.
   */
  async findAll(filter?: { status?: CheckPaymentStatus; orderId?: string; userId?: string }): Promise<CheckPayment[]> {
    const where: any = {};
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.orderId) {
      where.order_id = filter.orderId;
    }
    if (filter?.userId) {
      where.user_id = filter.userId;
    }

    return await this.checkPaymentRepository.find({
      where,
      order: { created_at: 'DESC' },
      relations: ['order', 'user'],
    });
  }

  /**
   * Retorna un cheque por su identificador único.
   */
  async findById(id: string): Promise<CheckPayment> {
    const check = await this.checkPaymentRepository.findOne({
      where: { id },
      relations: ['order', 'user'],
    });

    if (!check) {
      throw new NotFoundException(`Cheque con id ${id} no encontrado`);
    }

    return check;
  }

  /**
   * Retorna los cheques asociados a una orden específica.
   */
  async findByOrder(orderId: string): Promise<CheckPayment[]> {
    return await this.checkPaymentRepository.find({
      where: { order_id: orderId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Agrupa los cheques por categorías de conciliación:
   * - "Por Depositar" (IN_HAND, PENDING_RECEIPT)
   * - "Depositados" (DEPOSITED)
   * - "Rebotados / Consecuencias" (BOUNCED)
   */
  async getReconciliationGrouped(): Promise<{
    inHand: CheckPayment[];
    deposited: CheckPayment[];
    bounced: CheckPayment[];
  }> {
    const all = await this.checkPaymentRepository.find({
      order: { created_at: 'DESC' },
      relations: ['order', 'user'],
    });

    const inHand = all.filter((c) => c.status === 'IN_HAND' || c.status === 'PENDING_RECEIPT');
    const deposited = all.filter((c) => c.status === 'DEPOSITED');
    const bounced = all.filter((c) => c.status === 'BOUNCED');

    return { inHand, deposited, bounced };
  }
}

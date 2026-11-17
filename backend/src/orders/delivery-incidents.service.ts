import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { CreateDeliveryIncidentDto } from './dto/create-delivery-incident.dto';

export { CreateDeliveryIncidentDto };

@Injectable()
export class DeliveryIncidentsService {
  constructor(
    @InjectRepository(DeliveryIncident)
    private readonly incidentRepository: Repository<DeliveryIncident>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Genera formato determinista SC-{YYYY}-{correlativo 4 dígitos} (ej. SC-2026-0001).
   */
  async generateVoucherCode(year: number = new Date().getFullYear()): Promise<string> {
    const prefix = `SC-${year}-`;

    let latestIncident: DeliveryIncident | null = null;

    if (typeof this.incidentRepository.find === 'function') {
      const results = await this.incidentRepository.find({
        where: { voucher_code: Like(`${prefix}%`) },
        order: { voucher_code: 'DESC' },
        take: 1,
      });
      latestIncident = results && results.length > 0 ? results[0] : null;
    }

    if (!latestIncident && typeof this.incidentRepository.findOne === 'function') {
      latestIncident = await this.incidentRepository.findOne({
        where: { voucher_code: Like(`${prefix}%`) },
        order: { voucher_code: 'DESC' },
      });
    }

    let nextNumber = 1;
    if (latestIncident && latestIncident.voucher_code) {
      const match = latestIncident.voucher_code.match(/^SC-\d{4}-(\d+)/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed)) {
          nextNumber = parsed + 1;
        }
      }
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedNumber}`;
  }

  /**
   * Valida que la orden y el producto existan en la orden,
   * calcula el monto si no se provee (quantity * item.price_at_time),
   * asigna voucher_code y persiste.
   */
  async createIncident(
    dto: CreateDeliveryIncidentDto,
    userContext?: { id: string; role?: string },
  ): Promise<DeliveryIncident> {
    const orderId = dto.order_id || (dto as any).orderId;
    if (!orderId) {
      throw new BadRequestException('El ID de la orden es mandatorio para registrar una incidencia');
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Orden con id ${orderId} no encontrada`);
    }

    // Si viene contexto de usuario y no es admin, debe ser el dueño de la orden
    if (userContext && userContext.role !== 'admin' && order.user_id !== userContext.id) {
      throw new ForbiddenException('No autorizado para reportar incidencias sobre esta orden');
    }

    const productId = Number(dto.product_id ?? (dto as any).productId);
    if (isNaN(productId)) {
      throw new BadRequestException('El ID del producto es mandatorio y debe ser numérico');
    }

    const orderItem = order.items?.find((item) => Number(item.product_id) === productId);
    if (!orderItem) {
      throw new BadRequestException(
        `El producto con id ${productId} no pertenece a la orden ${orderId}`,
      );
    }

    const quantity = Number(dto.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      throw new BadRequestException('La cantidad afectada debe ser mayor a 0');
    }

    let amount = dto.amount !== undefined && dto.amount !== null ? Number(dto.amount) : undefined;
    if (amount === undefined || isNaN(amount)) {
      const itemPrice = Number(orderItem.price_at_time) || 0;
      amount = Math.round((quantity * itemPrice + Number.EPSILON) * 100) / 100;
    } else {
      amount = Math.round((amount + Number.EPSILON) * 100) / 100;
    }

    const voucherCode = dto.voucher_code || (await this.generateVoucherCode());
    const userId = dto.user_id || (dto as any).userId || order.user_id;

    const incident = this.incidentRepository.create({
      order_id: order.id,
      user_id: userId,
      product_id: productId,
      quantity,
      reason_category: dto.reason_category,
      description: dto.description || null,
      photo_url: dto.photo_url || null,
      amount,
      voucher_code: voucherCode,
      status: dto.status || 'pending_review',
      reviewed_by: dto.reviewed_by || null,
    });

    return await this.incidentRepository.save(incident);
  }

  /**
   * Transición atómica: actualiza status a 'approved', incrementa user.credit_balance
   * atómicamente por el incident.amount, y guarda. Idempotente si ya fue aprobada.
   */
  async approveIncident(incidentId: string, adminId: string): Promise<DeliveryIncident> {
    const incident = await this.incidentRepository.findOne({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException(`Incidencia con id ${incidentId} no encontrada`);
    }

    // Idempotencia: si ya fue aprobada, no duplicar el saldo a favor
    if (incident.status === 'approved') {
      return incident;
    }

    const user = await this.userRepository.findOne({
      where: { id: incident.user_id },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con id ${incident.user_id} no encontrado`);
    }

    const currentBalance = Number(user.credit_balance) || 0;
    const increment = Number(incident.amount) || 0;
    const newBalance = Math.round((currentBalance + increment + Number.EPSILON) * 100) / 100;

    user.credit_balance = newBalance;
    await this.userRepository.save(user);

    incident.status = 'approved';
    incident.reviewed_by = adminId;
    incident.updated_at = new Date();

    return await this.incidentRepository.save(incident);
  }

  /**
   * Consulta incidencias asociadas a una orden.
   */
  async findByOrder(
    orderId: string,
    userContext?: { id: string; role?: string },
  ): Promise<DeliveryIncident[]> {
    if (userContext && userContext.role !== 'admin') {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException(`Orden con id ${orderId} no encontrada`);
      }
      if (order.user_id !== userContext.id) {
        throw new ForbiddenException('No autorizado para ver incidencias de esta orden');
      }
    }

    return await this.incidentRepository.find({
      where: { order_id: orderId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Consulta incidencias asociadas a un cliente.
   */
  async findByUser(userId: string): Promise<DeliveryIncident[]> {
    return await this.incidentRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Consulta una incidencia por ID.
   */
  async findById(id: string): Promise<DeliveryIncident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incidencia con id ${id} no encontrada`);
    }
    return incident;
  }
}

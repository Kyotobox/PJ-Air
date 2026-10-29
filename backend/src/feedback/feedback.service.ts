import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './feedback.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

export interface CreateFeedbackDto {
  userId?: string;
  category: string;
  message: string;
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional()
    private readonly mailService?: MailService,
  ) {}

  async create(dto: CreateFeedbackDto): Promise<Feedback> {
    if (!dto.category || typeof dto.category !== 'string' || !dto.category.trim()) {
      throw new BadRequestException('La categoría de feedback es obligatoria');
    }

    if (!dto.message || typeof dto.message !== 'string' || !dto.message.trim()) {
      throw new BadRequestException('El mensaje de sugerencia o feedback no puede estar vacío');
    }

    const cleanCategory = dto.category.trim().toLowerCase();
    const allowedCategories = ['sugerencia', 'reclamo', 'producto', 'servicio', 'otro', 'suggestion', 'complaint'];
    if (!allowedCategories.includes(cleanCategory)) {
      throw new BadRequestException(`Categoría no válida: ${dto.category}. Permitidas: sugerencia, reclamo, producto, servicio, otro`);
    }

    let user: User | null = null;
    if (dto.userId) {
      user = await this.userRepository.findOne({
        where: { id: dto.userId },
        relations: ['profile'],
      });
    }

    const feedback = new Feedback();
    if (dto.userId) {
      feedback.user_id = dto.userId;
    }
    feedback.category = cleanCategory;
    feedback.message = dto.message.trim();
    feedback.status = 'pending';

    const saved = await this.feedbackRepository.save(feedback);

    // Envío simultáneo por email administrativo vía MailService
    if (this.mailService) {
      try {
        await this.mailService.sendFeedbackAlert({
          id: saved.id,
          userId: saved.user_id,
          userName: (user?.profile as any)?.company_name || (user?.profile as any)?.contact_name || user?.email || 'Cliente B2B',
          userEmail: user?.email,
          category: saved.category,
          message: saved.message,
          createdAt: saved.created_at,
        });
      } catch (err) {
        // Logging non-blocking
        console.error('[FeedbackService] Error al notificar feedback por email:', err);
      }
    }

    return saved;
  }

  async findAll(): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      relations: ['user', 'user.profile'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Feedback> {
    const item = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'user.profile'],
    });
    if (!item) {
      throw new NotFoundException(`Feedback #${id} no encontrado`);
    }
    return item;
  }

  async updateStatus(id: string, newStatus: string): Promise<Feedback> {
    const feedback = await this.findOne(id);
    if (!newStatus || typeof newStatus !== 'string') {
      throw new BadRequestException('El nuevo estado es obligatorio');
    }

    const validStatuses = ['pending', 'reviewed', 'resolved', 'archivado'];
    const cleanStatus = newStatus.trim().toLowerCase();
    if (!validStatuses.includes(cleanStatus)) {
      throw new BadRequestException(`Estado no válido: ${newStatus}. Permitidos: pending, reviewed, resolved`);
    }

    feedback.status = cleanStatus;
    return this.feedbackRepository.save(feedback);
  }
}

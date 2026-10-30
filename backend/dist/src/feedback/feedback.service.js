"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const feedback_entity_1 = require("./feedback.entity");
const user_entity_1 = require("../users/user.entity");
const mail_service_1 = require("../mail/mail.service");
let FeedbackService = class FeedbackService {
    feedbackRepository;
    userRepository;
    mailService;
    constructor(feedbackRepository, userRepository, mailService) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
        this.mailService = mailService;
    }
    async create(dto) {
        if (!dto.category || typeof dto.category !== 'string' || !dto.category.trim()) {
            throw new common_1.BadRequestException('La categoría de feedback es obligatoria');
        }
        if (!dto.message || typeof dto.message !== 'string' || !dto.message.trim()) {
            throw new common_1.BadRequestException('El mensaje de sugerencia o feedback no puede estar vacío');
        }
        const cleanCategory = dto.category.trim().toLowerCase();
        const allowedCategories = ['sugerencia', 'reclamo', 'producto', 'servicio', 'otro', 'suggestion', 'complaint'];
        if (!allowedCategories.includes(cleanCategory)) {
            throw new common_1.BadRequestException(`Categoría no válida: ${dto.category}. Permitidas: sugerencia, reclamo, producto, servicio, otro`);
        }
        let user = null;
        if (dto.userId) {
            user = await this.userRepository.findOne({
                where: { id: dto.userId },
                relations: ['profile'],
            });
        }
        const feedback = new feedback_entity_1.Feedback();
        if (dto.userId) {
            feedback.user_id = dto.userId;
        }
        feedback.category = cleanCategory;
        feedback.message = dto.message.trim();
        feedback.status = 'pending';
        const saved = await this.feedbackRepository.save(feedback);
        if (this.mailService) {
            try {
                await this.mailService.sendFeedbackAlert({
                    id: saved.id,
                    userId: saved.user_id,
                    userName: user?.profile?.company_name || user?.profile?.contact_name || user?.email || 'Cliente B2B',
                    userEmail: user?.email,
                    category: saved.category,
                    message: saved.message,
                    createdAt: saved.created_at,
                });
            }
            catch (err) {
                console.error('[FeedbackService] Error al notificar feedback por email:', err);
            }
        }
        return saved;
    }
    async findAll() {
        return this.feedbackRepository.find({
            relations: ['user', 'user.profile'],
            order: { created_at: 'DESC' },
        });
    }
    async findOne(id) {
        const item = await this.feedbackRepository.findOne({
            where: { id },
            relations: ['user', 'user.profile'],
        });
        if (!item) {
            throw new common_1.NotFoundException(`Feedback #${id} no encontrado`);
        }
        return item;
    }
    async updateStatus(id, newStatus) {
        const feedback = await this.findOne(id);
        if (!newStatus || typeof newStatus !== 'string') {
            throw new common_1.BadRequestException('El nuevo estado es obligatorio');
        }
        const validStatuses = ['pending', 'reviewed', 'resolved', 'archivado'];
        const cleanStatus = newStatus.trim().toLowerCase();
        if (!validStatuses.includes(cleanStatus)) {
            throw new common_1.BadRequestException(`Estado no válido: ${newStatus}. Permitidos: pending, reviewed, resolved`);
        }
        feedback.status = cleanStatus;
        return this.feedbackRepository.save(feedback);
    }
};
exports.FeedbackService = FeedbackService;
exports.FeedbackService = FeedbackService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(feedback_entity_1.Feedback)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        mail_service_1.MailService])
], FeedbackService);
//# sourceMappingURL=feedback.service.js.map
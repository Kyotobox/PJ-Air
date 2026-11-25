import { Repository } from 'typeorm';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { CreateDeliveryIncidentDto } from './dto/create-delivery-incident.dto';
export { CreateDeliveryIncidentDto };
export declare class DeliveryIncidentsService {
    private readonly incidentRepository;
    private readonly orderRepository;
    private readonly userRepository;
    private readonly mailService?;
    private readonly logger;
    constructor(incidentRepository: Repository<DeliveryIncident>, orderRepository: Repository<Order>, userRepository: Repository<User>, mailService?: MailService | undefined);
    generateVoucherCode(year?: number): Promise<string>;
    createIncident(dto: CreateDeliveryIncidentDto, userContext?: {
        id: string;
        role?: string;
    }): Promise<DeliveryIncident>;
    approveIncident(incidentId: string, adminId: string): Promise<DeliveryIncident>;
    private dispatchStoreCreditNotification;
    findByOrder(orderId: string, userContext?: {
        id: string;
        role?: string;
    }): Promise<DeliveryIncident[]>;
    findByUser(userId: string, userContext?: {
        id: string;
        role?: string;
    }): Promise<DeliveryIncident[]>;
    findById(id: string): Promise<DeliveryIncident>;
}

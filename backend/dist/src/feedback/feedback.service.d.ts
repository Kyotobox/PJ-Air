import { Repository } from 'typeorm';
import { Feedback } from './feedback.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
export interface CreateFeedbackDto {
    userId?: string;
    category: string;
    message: string;
}
export declare class FeedbackService {
    private readonly feedbackRepository;
    private readonly userRepository;
    private readonly mailService?;
    constructor(feedbackRepository: Repository<Feedback>, userRepository: Repository<User>, mailService?: MailService | undefined);
    create(dto: CreateFeedbackDto): Promise<Feedback>;
    findAll(): Promise<Feedback[]>;
    findOne(id: string): Promise<Feedback>;
    updateStatus(id: string, newStatus: string): Promise<Feedback>;
}

import { FeedbackService } from './feedback.service';
export declare class FeedbackController {
    private readonly feedbackService;
    constructor(feedbackService: FeedbackService);
    create(body: {
        category: string;
        message: string;
        userId?: string;
    }, req: any): Promise<import("./feedback.entity").Feedback>;
    findAll(): Promise<import("./feedback.entity").Feedback[]>;
    updateStatus(id: string, status: string): Promise<import("./feedback.entity").Feedback>;
}

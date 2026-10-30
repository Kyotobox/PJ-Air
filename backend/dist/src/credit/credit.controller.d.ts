import { CreditService } from './credit.service';
export declare class CreditController {
    private readonly creditService;
    constructor(creditService: CreditService);
    getStatus(req: any): Promise<{
        credit_limit: number;
        used_credit: number;
        available_credit: number;
        credit_blocked: boolean;
        credit_override: boolean;
    }>;
    getMyStatus(req: any): Promise<{
        credit_limit: number;
        used_credit: number;
        available_credit: number;
        credit_blocked: boolean;
        credit_override: boolean;
    }>;
}

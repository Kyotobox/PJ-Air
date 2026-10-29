import { OrdersService } from './orders.service';
import { ExcelService } from './excel.service';
export declare class OrdersController {
    private readonly ordersService;
    private readonly excelService;
    constructor(ordersService: OrdersService, excelService: ExcelService);
    create(body: any, req: any): Promise<import("./order.entity").Order>;
    settleBatch(body: {
        order_ids: string[];
        payment_method: string;
        payment_reference?: string;
    }, req: any): Promise<{
        success: boolean;
        settled_count: number;
        order_ids: string[];
        base_total: number;
        fee_amount: number;
        fee_percentage: number;
        total_paid: number;
        payment_method: string;
        available_credit: number;
        used_credit: number;
    }>;
    getFrequentProducts(req: any): Promise<any[]>;
    getUserFrequentProducts(userId: string, req: any): Promise<any[]>;
    findAll(req: any): Promise<import("./order.entity").Order[]>;
    findByUser(userId: string, req: any): Promise<import("./order.entity").Order[]>;
    exportIndividual(startDate: string, endDate: string, res: any): Promise<void>;
    exportConsolidated(startDate: string, endDate: string, res: any): Promise<void>;
    findInRange(startDate: string, endDate: string, userId?: string): Promise<import("./order.entity").Order[]>;
    findOne(id: string, req: any): Promise<import("./order.entity").Order>;
    updateStatus(id: string, status: string, req: any): Promise<import("./order.entity").Order>;
    updatePaymentStatus(id: string, paymentStatus: string): Promise<import("./order.entity").Order>;
    approveZelle(id: string): Promise<import("./order.entity").Order>;
    rejectZelle(id: string, reason?: string): Promise<import("./order.entity").Order>;
    assignDelivery(id: string, deliveryUserId: string): Promise<import("./order.entity").Order>;
    update(id: string, body: any, req: any): Promise<import("./order.entity").Order>;
}

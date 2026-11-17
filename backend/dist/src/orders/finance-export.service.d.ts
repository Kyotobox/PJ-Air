import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
export declare class FinanceExportService {
    private readonly ordersService?;
    private readonly orderRepository?;
    constructor(ordersService?: OrdersService | undefined, orderRepository?: Repository<Order> | undefined);
    exportTaxAndSalesLedger(startDate?: string, endDate?: string, preloadedOrders?: Order[]): Promise<Buffer>;
    generateTaxAndSalesLedgerWorkbook(orders: Order[]): Promise<Buffer>;
}

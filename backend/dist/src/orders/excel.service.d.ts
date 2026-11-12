import { Order } from './order.entity';
export declare class ExcelService {
    exportIndividual(orders: Order[]): Promise<Buffer>;
    exportConsolidated(orders: Order[]): Promise<Buffer>;
    exportAccounting(orders: Order[]): Promise<Buffer>;
}

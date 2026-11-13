import { Order } from './order.entity';
export declare function resolveCroissantProductionGroup(product?: {
    name?: string;
    production_group?: string | null;
} | null): '1' | '2' | '3';
export declare class ExcelService {
    generateProductionReport(orders: Order[]): Promise<Buffer>;
    exportIndividual(orders: Order[]): Promise<Buffer>;
    exportConsolidated(orders: Order[]): Promise<Buffer>;
    exportAccounting(orders: Order[]): Promise<Buffer>;
}

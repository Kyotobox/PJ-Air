export interface FeeCalculationResult {
    baseAmount: number;
    paymentMethod: string;
    feePercentage: number;
    feeAmount: number;
    totalWithFee: number;
    isCapped?: boolean;
}
export declare class FeeCalculatorService {
    static calculateFee(amount: number, paymentMethod: string): number;
    calculateFee(amount: number, paymentMethod: string): FeeCalculationResult;
    calculateBatchFee(amounts: number[], paymentMethod: string): FeeCalculationResult;
}

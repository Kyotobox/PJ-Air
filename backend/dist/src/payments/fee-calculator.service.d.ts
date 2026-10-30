export declare enum FeePaymentMethod {
    STRIPE_CARD = "STRIPE_CARD",
    ACH = "ACH",
    ACH_DEBIT = "ACH_DEBIT",
    ZELLE = "ZELLE",
    CREDIT = "CREDIT",
    CHECK = "CHECK",
    CASH = "CASH"
}
export interface FeeBreakdown {
    fee: number;
    rate: number;
    isCapped: boolean;
    maxCap: number | null;
    originalAmount: number;
    totalWithFee: number;
    normalizedMethod: string;
}
export declare class FeeCalculatorService {
    static calculateFee(amount: number, paymentMethod: string): number;
    calculateFee(amount: number, paymentMethod: string): number;
    static getFeeBreakdown(amount: number, paymentMethod: string): FeeBreakdown;
    getFeeBreakdown(amount: number, paymentMethod: string): FeeBreakdown;
}

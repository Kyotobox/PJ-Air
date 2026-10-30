"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FeeCalculatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeCalculatorService = exports.FeePaymentMethod = void 0;
const common_1 = require("@nestjs/common");
var FeePaymentMethod;
(function (FeePaymentMethod) {
    FeePaymentMethod["STRIPE_CARD"] = "STRIPE_CARD";
    FeePaymentMethod["ACH"] = "ACH";
    FeePaymentMethod["ACH_DEBIT"] = "ACH_DEBIT";
    FeePaymentMethod["ZELLE"] = "ZELLE";
    FeePaymentMethod["CREDIT"] = "CREDIT";
    FeePaymentMethod["CHECK"] = "CHECK";
    FeePaymentMethod["CASH"] = "CASH";
})(FeePaymentMethod || (exports.FeePaymentMethod = FeePaymentMethod = {}));
let FeeCalculatorService = FeeCalculatorService_1 = class FeeCalculatorService {
    static calculateFee(amount, paymentMethod) {
        const numericAmount = Number(amount);
        if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
            return 0.00;
        }
        if (!paymentMethod || typeof paymentMethod !== 'string') {
            return 0.00;
        }
        const normalized = paymentMethod.trim().toUpperCase().replace(/[\s-]+/g, '_');
        if (normalized === 'STRIPE_CARD' ||
            normalized === 'CARD' ||
            normalized === 'STRIPE' ||
            normalized === 'CREDIT_CARD' ||
            normalized === 'DEBIT_CARD') {
            return Math.round(numericAmount * 0.035 * 100) / 100;
        }
        if (normalized === 'ACH' ||
            normalized === 'ACH_DEBIT' ||
            normalized === 'US_BANK_ACCOUNT' ||
            normalized === 'BANK_ACCOUNT') {
            const calculated = Math.round(numericAmount * 0.008 * 100) / 100;
            return Math.min(calculated, 5.00);
        }
        if (normalized === 'ZELLE' ||
            normalized === 'CREDIT' ||
            normalized === 'CHECK' ||
            normalized === 'CHEQUE' ||
            normalized === 'CASH' ||
            normalized === 'EFECTIVO') {
            return 0.00;
        }
        return 0.00;
    }
    calculateFee(amount, paymentMethod) {
        return FeeCalculatorService_1.calculateFee(amount, paymentMethod);
    }
    static getFeeBreakdown(amount, paymentMethod) {
        const numericAmount = Math.max(0, Number(amount) || 0);
        const fee = this.calculateFee(numericAmount, paymentMethod);
        const normalized = (paymentMethod || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
        let rate = 0;
        let isCapped = false;
        let maxCap = null;
        if (normalized === 'STRIPE_CARD' ||
            normalized === 'CARD' ||
            normalized === 'STRIPE' ||
            normalized === 'CREDIT_CARD' ||
            normalized === 'DEBIT_CARD') {
            rate = 0.035;
        }
        else if (normalized === 'ACH' ||
            normalized === 'ACH_DEBIT' ||
            normalized === 'US_BANK_ACCOUNT' ||
            normalized === 'BANK_ACCOUNT') {
            rate = 0.008;
            maxCap = 5.00;
            const uncapped = Math.round(numericAmount * 0.008 * 100) / 100;
            if (uncapped >= 5.00) {
                isCapped = true;
            }
        }
        return {
            fee,
            rate,
            isCapped,
            maxCap,
            originalAmount: numericAmount,
            totalWithFee: Math.round((numericAmount + fee) * 100) / 100,
            normalizedMethod: normalized,
        };
    }
    getFeeBreakdown(amount, paymentMethod) {
        return FeeCalculatorService_1.getFeeBreakdown(amount, paymentMethod);
    }
};
exports.FeeCalculatorService = FeeCalculatorService;
exports.FeeCalculatorService = FeeCalculatorService = FeeCalculatorService_1 = __decorate([
    (0, common_1.Injectable)()
], FeeCalculatorService);
//# sourceMappingURL=fee-calculator.service.js.map
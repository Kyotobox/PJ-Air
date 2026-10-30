"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FeeCalculatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeCalculatorService = void 0;
const common_1 = require("@nestjs/common");
let FeeCalculatorService = FeeCalculatorService_1 = class FeeCalculatorService {
    static calculateFee(amount, paymentMethod) {
        const calc = new FeeCalculatorService_1();
        try {
            const res = calc.calculateFee(Number(amount) || 0, paymentMethod);
            return res.feeAmount;
        }
        catch (_) {
            return 0.00;
        }
    }
    calculateFee(amount, paymentMethod) {
        if (amount === null || amount === undefined || typeof amount !== 'number' || isNaN(amount)) {
            throw new common_1.BadRequestException('El monto base debe ser un número válido');
        }
        if (amount < 0) {
            throw new common_1.BadRequestException('El monto no puede ser negativo');
        }
        if (!paymentMethod || typeof paymentMethod !== 'string') {
            throw new common_1.BadRequestException('El método de pago es obligatorio');
        }
        const method = paymentMethod.trim().toLowerCase();
        const roundedBase = Math.round((amount + Number.EPSILON) * 100) / 100;
        let feePercentage = 0;
        let feeAmount = 0;
        let isCapped = false;
        if (['card', 'credit_card', 'stripe', 'stripe_card', 'tarjeta', 'debit_card'].includes(method)) {
            feePercentage = 3.5;
            feeAmount = Math.round((roundedBase * 0.035 + Number.EPSILON) * 100) / 100;
        }
        else if (['ach', 'ach_debit', 'transfer', 'bank_transfer', 'us_bank_account'].includes(method)) {
            feePercentage = 0.8;
            const rawFee = roundedBase * 0.008;
            if (rawFee >= 5.0) {
                feeAmount = 5.0;
                isCapped = true;
            }
            else {
                feeAmount = Math.round((rawFee + Number.EPSILON) * 100) / 100;
            }
        }
        else if (['zelle', 'check', 'cheque', 'cash', 'efectivo', 'credit', 'credito'].includes(method)) {
            feePercentage = 0.0;
            feeAmount = 0.0;
        }
        else {
            throw new common_1.BadRequestException(`Método de pago no reconocido: ${paymentMethod}`);
        }
        const totalWithFee = Math.round((roundedBase + feeAmount + Number.EPSILON) * 100) / 100;
        return {
            baseAmount: roundedBase,
            paymentMethod: method,
            feePercentage,
            feeAmount,
            totalWithFee,
            isCapped,
        };
    }
    calculateBatchFee(amounts, paymentMethod) {
        if (!Array.isArray(amounts) || amounts.length === 0) {
            throw new common_1.BadRequestException('Se requiere una lista no vacía de montos');
        }
        const totalSum = amounts.reduce((acc, curr) => {
            if (typeof curr !== 'number' || isNaN(curr) || curr < 0) {
                throw new common_1.BadRequestException('Todos los montos deben ser números válidos no negativos');
            }
            return acc + curr;
        }, 0);
        return this.calculateFee(totalSum, paymentMethod);
    }
};
exports.FeeCalculatorService = FeeCalculatorService;
exports.FeeCalculatorService = FeeCalculatorService = FeeCalculatorService_1 = __decorate([
    (0, common_1.Injectable)()
], FeeCalculatorService);
//# sourceMappingURL=fee-calculator.service.js.map
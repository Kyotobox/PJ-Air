import { Injectable, BadRequestException } from '@nestjs/common';

export interface FeeCalculationResult {
  baseAmount: number;
  paymentMethod: string;
  feePercentage: number;
  feeAmount: number;
  totalWithFee: number;
  isCapped?: boolean;
}

@Injectable()
export class FeeCalculatorService {
  /**
   * Static helper for direct fee amount calculation in orders creation
   */
  static calculateFee(amount: number, paymentMethod: string): number {
    const calc = new FeeCalculatorService();
    try {
      const res = calc.calculateFee(Number(amount) || 0, paymentMethod);
      return res.feeAmount;
    } catch (_) {
      // INTENTIONAL: default unknown or invalid methods to 0.00 fee
      return 0.00;
    }
  }

  /**
   * Calcula de forma determinista el recargo por procesamiento según el método de pago:
   * - Tarjeta (stripe / card / credit_card): 3.5%
   * - ACH: 0.8% tope $5.00
   * - Zelle, Cheque, Cash, Credit: 0.0%
   */
  calculateFee(amount: number, paymentMethod: string): FeeCalculationResult {
    if (amount === null || amount === undefined || typeof amount !== 'number' || isNaN(amount)) {
      throw new BadRequestException('El monto base debe ser un número válido');
    }

    if (amount < 0) {
      throw new BadRequestException('El monto no puede ser negativo');
    }

    if (!paymentMethod || typeof paymentMethod !== 'string') {
      throw new BadRequestException('El método de pago es obligatorio');
    }

    const method = paymentMethod.trim().toLowerCase();
    const roundedBase = Math.round((amount + Number.EPSILON) * 100) / 100;

    let feePercentage = 0;
    let feeAmount = 0;
    let isCapped = false;

    if (['card', 'credit_card', 'stripe', 'stripe_card', 'tarjeta', 'debit_card'].includes(method)) {
      feePercentage = 3.5;
      feeAmount = Math.round((roundedBase * 0.035 + Number.EPSILON) * 100) / 100;
    } else if (['ach', 'ach_debit', 'transfer', 'bank_transfer', 'us_bank_account'].includes(method)) {
      feePercentage = 0.8;
      const rawFee = roundedBase * 0.008;
      if (rawFee >= 5.0) {
        feeAmount = 5.0;
        isCapped = true;
      } else {
        feeAmount = Math.round((rawFee + Number.EPSILON) * 100) / 100;
      }
    } else if (['zelle', 'check', 'cheque', 'cash', 'efectivo', 'credit', 'credito'].includes(method)) {
      feePercentage = 0.0;
      feeAmount = 0.0;
    } else {
      throw new BadRequestException(`Método de pago no reconocido: ${paymentMethod}`);
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

  /**
   * Calcula el fee acumulado para una lista de órdenes o montos
   */
  calculateBatchFee(amounts: number[], paymentMethod: string): FeeCalculationResult {
    if (!Array.isArray(amounts) || amounts.length === 0) {
      throw new BadRequestException('Se requiere una lista no vacía de montos');
    }

    const totalSum = amounts.reduce((acc, curr) => {
      if (typeof curr !== 'number' || isNaN(curr) || curr < 0) {
        throw new BadRequestException('Todos los montos deben ser números válidos no negativos');
      }
      return acc + curr;
    }, 0);

    return this.calculateFee(totalSum, paymentMethod);
  }
}

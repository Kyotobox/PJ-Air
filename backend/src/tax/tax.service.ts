import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { VisionValidationService, VisionValidationResult } from './vision-validation.service';

export interface TaxCalculationResult {
  tax_amount: number;
  tax_rate: number;
  tax_exempt: boolean;
  tax_legend: string | null;
}

export const NYS_DTF_LEGEND_PREFIX =
  'Exempt from NY State and Local Sales and Use Tax under NYS DTF Form ST-120 (Resale Certificate) - Purchases are exclusively for resale in the regular course of business.';

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);
  public static readonly NY_STANDARD_SALES_TAX_RATE = 8.875; // Standard NYC Combined Sales Tax Rate

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    private visionValidationService: VisionValidationService,
  ) {}

  /**
   * Generates the official NYS DTF Resale Exemption legal legend
   */
  getOfficialNysDtfLegend(taxId?: string | null): string {
    const cleanTaxId = taxId ? taxId.trim() : 'N/A';
    return `${NYS_DTF_LEGEND_PREFIX} NY Resale / Tax ID: ${cleanTaxId}`;
  }

  /**
   * Calculates order sales tax with 0% tax engine for ST-120 exempt users
   */
  calculateOrderTax(
    user: { tax_exempt?: boolean | null; tax_id?: string | null; profile?: { tax_exempt?: boolean | null; tax_id?: string | null } },
    subtotal: number,
  ): TaxCalculationResult {
    const isExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt);
    const taxId = user?.tax_id || user?.profile?.tax_id || null;

    if (isExempt) {
      return {
        tax_amount: 0.0,
        tax_rate: 0.0,
        tax_exempt: true,
        tax_legend: this.getOfficialNysDtfLegend(taxId),
      };
    }

    const standardRate = TaxService.NY_STANDARD_SALES_TAX_RATE;
    const calculatedAmount = Math.round(((Number(subtotal) || 0) * (standardRate / 100) + Number.EPSILON) * 100) / 100;

    return {
      tax_amount: calculatedAmount,
      tax_rate: standardRate,
      tax_exempt: false,
      tax_legend: null,
    };
  }

  /**
   * Triggers Vision AI analysis on the user's ST-120 document
   */
  async auditUserST120(userId: string): Promise<VisionValidationResult> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const documentUrl = user.profile?.st120_document_url || user.st120_document_url;
    if (!documentUrl) {
      throw new NotFoundException(`User ${userId} does not have an uploaded ST-120 document`);
    }

    const taxId = user.profile?.tax_id || user.tax_id || '';
    const companyName = user.profile?.company_name || '';

    const result = await this.visionValidationService.analyzeDocument(documentUrl, {
      tax_id: taxId,
      company_name: companyName,
    });

    this.logger.log(`Audit ST-120 completed for user ${userId}. Verdict: ${result.verdict}`);
    return result;
  }

  /**
   * Approves ST-120 exemption and marks user tax_exempt = true
   */
  async approveExemption(userId: string): Promise<{ success: boolean; user: User }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepository.update(userId, {
      st120_status: 'APPROVED',
      tax_exempt: true,
    });

    if (user.profile) {
      await this.profileRepository.update(user.profile.id, {
        st120_status: 'APPROVED',
        tax_exempt: true,
      });
    }

    const updatedUser = (await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    }))!;

    this.logger.log(`ST-120 approved for user ${userId}. tax_exempt set to true.`);
    return { success: true, user: updatedUser };
  }

  /**
   * Rejects ST-120 exemption and marks user tax_exempt = false
   */
  async rejectExemption(userId: string, reason?: string): Promise<{ success: boolean; user: User }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepository.update(userId, {
      st120_status: 'REJECTED',
      tax_exempt: false,
    });

    if (user.profile) {
      await this.profileRepository.update(user.profile.id, {
        st120_status: 'REJECTED',
        tax_exempt: false,
      });
    }

    const updatedUser = (await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    }))!;

    this.logger.warn(`ST-120 rejected for user ${userId}. Reason: ${reason || 'Audit rejection'}`);
    return { success: true, user: updatedUser };
  }
}

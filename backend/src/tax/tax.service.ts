import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { UPLOAD_PATH } from '../config';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { VisionValidationService, VisionValidationResult } from './vision-validation.service';
import { St120GeneratorService } from './st120-generator.service';

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
    @Optional()
    private st120GeneratorService?: St120GeneratorService,
  ) {}

  /**
   * Helper to obtain the generator service instance
   */
  private getGenerator(): St120GeneratorService {
    return this.st120GeneratorService || new St120GeneratorService();
  }

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

    const documentUrl = user.st120_pdf_url || user.profile?.st120_document_url || user.st120_document_url;
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

  /**
   * Generates official digital ST-120 PDF from database legal data and marks user APPROVED
   * TASK-82-02: Valida Razón Social, EIN y datos del firmante, llama a generateDigitalSt120Pdf, actualiza status='APPROVED', tax_exempt=true, st120_pdf_url
   */
  async generateDigitalST120(
    userId: string,
    requestingUser?: { id: string; role?: string },
    dto?: {
      legal_business_name?: string;
      legalBusinessName?: string;
      ein?: string;
      signer_name?: string;
      signerName?: string;
      signer_title?: string;
      signerTitle?: string;
      signature_text?: string;
      signatureText?: string;
      dba?: string;
      business_address?: string;
      businessAddress?: string;
      tax_id?: string;
      taxId?: string;
    },
  ): Promise<{ success: boolean; documentUrl: string; st120_pdf_url: string; auditHash?: string; user: User }> {
    if (requestingUser && requestingUser.role !== 'admin' && requestingUser.id !== userId) {
      throw new ForbiddenException('Cannot generate ST-120 for another user');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'addresses'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // 1. Validar Razón Social
    const legalBusinessName =
      (dto?.legal_business_name && dto.legal_business_name.trim()) ||
      (dto?.legalBusinessName && dto.legalBusinessName.trim()) ||
      (user.legal_business_name && user.legal_business_name.trim()) ||
      (user.profile?.company_name && user.profile.company_name.trim());

    if (!legalBusinessName) {
      throw new BadRequestException('Razón Social (Legal Business Name) es requerida para el Formulario ST-120');
    }

    // 2. Validar EIN
    const ein =
      (dto?.ein && dto.ein.trim()) ||
      (user.ein && user.ein.trim()) ||
      (dto?.tax_id && dto.tax_id.trim()) ||
      (dto?.taxId && dto.taxId.trim()) ||
      (user.tax_id && user.tax_id.trim()) ||
      (user.profile?.tax_id && user.profile.tax_id.trim());

    if (!ein) {
      throw new BadRequestException('Federal EIN / Tax ID es requerido para el Formulario ST-120');
    }

    // 3. Validar datos del firmante
    const signerName =
      (dto?.signer_name && dto.signer_name.trim()) ||
      (dto?.signerName && dto.signerName.trim()) ||
      (user.signer_name && user.signer_name.trim()) ||
      (user.profile?.full_name && user.profile.full_name.trim());

    if (!signerName) {
      throw new BadRequestException('Nombre del firmante es requerido para el Formulario ST-120');
    }

    const signerTitle =
      (dto?.signer_title && dto.signer_title.trim()) ||
      (dto?.signerTitle && dto.signerTitle.trim()) ||
      user.signer_title ||
      'Authorized Representative';

    const signatureText =
      (dto?.signature_text && dto.signature_text.trim()) ||
      (dto?.signatureText && dto.signatureText.trim()) ||
      user.signature_text ||
      signerName;

    const dba =
      dto?.dba !== undefined
        ? (dto.dba ? dto.dba.trim() : null)
        : (user.dba || user.profile?.company_name || null);

    const businessAddress =
      (dto?.business_address && dto.business_address.trim()) ||
      (dto?.businessAddress && dto.businessAddress.trim()) ||
      user.business_address ||
      (user.addresses && user.addresses.length > 0 ? user.addresses[0].address : 'Address on file');

    const taxId =
      (dto?.tax_id && dto.tax_id.trim()) ||
      (dto?.taxId && dto.taxId.trim()) ||
      user.tax_id ||
      user.profile?.tax_id ||
      ein;

    const acceptedAt = user.accepted_at || new Date();
    const ipAddress = user.ip_address || '127.0.0.1';

    const generator = this.getGenerator();
    const pdfData = {
      userId: user.id,
      legalBusinessName,
      dba,
      businessAddress,
      taxId,
      ein,
      signerName,
      signerTitle,
      signatureText,
      acceptedAt,
      ipAddress,
    };

    const pdfResult = generator.generateDigitalSt120Pdf
      ? await generator.generateDigitalSt120Pdf(pdfData)
      : await generator.generateST120Pdf(pdfData);

    await this.userRepository.update(userId, {
      st120_status: 'APPROVED',
      tax_exempt: true,
      st120_document_url: pdfResult.relativeUrl,
      st120_pdf_url: pdfResult.relativeUrl,
      legal_business_name: legalBusinessName,
      ein,
      tax_id: taxId,
      signer_name: signerName,
      signer_title: signerTitle,
      signature_text: signatureText,
      dba,
      business_address: businessAddress,
      accepted_at: acceptedAt,
    });

    if (user.profile) {
      await this.profileRepository.update(user.profile.id, {
        st120_status: 'APPROVED',
        tax_exempt: true,
        st120_document_url: pdfResult.relativeUrl,
        ...(taxId ? { tax_id: taxId } : {}),
        company_name: legalBusinessName,
      });
    }

    const updatedUser = (await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'addresses'],
    }))!;

    this.logger.log(`Digital ST-120 generated and approved for user ${userId}. URL: ${pdfResult.relativeUrl}`);
    return {
      success: true,
      documentUrl: pdfResult.relativeUrl,
      st120_pdf_url: pdfResult.relativeUrl,
      auditHash: pdfResult.auditHash,
      user: updatedUser,
    };
  }

  /**
   * Validates legal signing data, generates official ST-120 PDF, marks user APPROVED
   */
  async signST120(
    userId: string,
    signData: {
      signature_text: string;
      signer_name: string;
      signer_title?: string;
      legal_business_name?: string;
      dba?: string;
      business_address?: string;
      tax_id?: string;
      ein?: string;
    },
    clientIp?: string,
    requestingUser?: { id: string; role?: string },
  ): Promise<{ success: boolean; documentUrl: string; st120_pdf_url: string; user: User }> {
    if (requestingUser && requestingUser.role !== 'admin' && requestingUser.id !== userId) {
      throw new ForbiddenException('Cannot sign ST-120 for another user');
    }

    if (!signData?.signature_text || !signData.signature_text.trim()) {
      throw new BadRequestException('El campo signature_text es obligatorio para la firma digital del ST-120');
    }

    if (!signData?.signer_name || !signData.signer_name.trim()) {
      throw new BadRequestException('El campo signer_name es obligatorio para la firma digital del ST-120');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'addresses'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const now = new Date();
    const effectiveIp = clientIp || user.ip_address || '127.0.0.1';
    const legalName =
      (signData.legal_business_name && signData.legal_business_name.trim()) ||
      user.legal_business_name ||
      user.profile?.company_name ||
      user.email;
    const dba = signData.dba !== undefined ? (signData.dba ? signData.dba.trim() : null) : (user.dba || null);
    const bAddress =
      (signData.business_address && signData.business_address.trim()) ||
      user.business_address ||
      (user.addresses && user.addresses.length > 0 ? user.addresses[0].address : 'Address on file');
    const taxId =
      (signData.tax_id && signData.tax_id.trim()) ||
      user.tax_id ||
      user.profile?.tax_id ||
      user.ein ||
      'PENDING';
    const ein = (signData.ein && signData.ein.trim()) || user.ein || taxId;
    const signerName = signData.signer_name.trim();
    const signerTitle =
      (signData.signer_title && signData.signer_title.trim()) ||
      user.signer_title ||
      'Authorized Representative';
    const signatureText = signData.signature_text.trim();

    const generator = this.getGenerator();
    const pdfData = {
      userId: user.id,
      legalBusinessName: legalName,
      dba,
      businessAddress: bAddress,
      taxId,
      ein,
      signerName,
      signerTitle,
      signatureText,
      acceptedAt: now,
      ipAddress: effectiveIp,
    };

    const pdfResult = generator.generateDigitalSt120Pdf
      ? await generator.generateDigitalSt120Pdf(pdfData)
      : await generator.generateST120Pdf(pdfData);

    await this.userRepository.update(userId, {
      legal_business_name: legalName,
      dba,
      business_address: bAddress,
      tax_id: taxId,
      ein,
      signer_name: signerName,
      signer_title: signerTitle,
      signature_text: signatureText,
      accepted_at: now,
      ip_address: effectiveIp,
      st120_status: 'APPROVED',
      tax_exempt: true,
      st120_document_url: pdfResult.relativeUrl,
      st120_pdf_url: pdfResult.relativeUrl,
    });

    if (user.profile) {
      await this.profileRepository.update(user.profile.id, {
        st120_status: 'APPROVED',
        tax_exempt: true,
        st120_document_url: pdfResult.relativeUrl,
        ...(taxId ? { tax_id: taxId } : {}),
        company_name: legalName,
      });
    }

    const updatedUser = (await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'addresses'],
    }))!;

    this.logger.log(`ST-120 digitally signed and approved for user ${userId}. URL: ${pdfResult.relativeUrl}`);
    return {
      success: true,
      documentUrl: pdfResult.relativeUrl,
      st120_pdf_url: pdfResult.relativeUrl,
      user: updatedUser,
    };
  }

  /**
   * Uploads an ST-120 document and sets status to PENDING or APPROVED
   * TASK-82-02: Permite subir foto o PDF mediante multer a /uploads/st120/ y registra el archivo con estado APPROVED o PENDING
   */
  async uploadST120(
    userId: string,
    file: Express.Multer.File,
    taxId?: string,
    requestingUser?: { id: string; role?: string },
    status?: string,
  ): Promise<{ success: boolean; url: string; documentUrl: string; st120_pdf_url: string; user: User }> {
    if (requestingUser && requestingUser.role !== 'admin' && requestingUser.id !== userId) {
      throw new ForbiddenException('Cannot upload ST-120 for another user');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded or file type not allowed');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const relativeUrl = `/uploads/st120/${file.filename}`;
    const cleanTaxId = taxId && taxId.trim() ? taxId.trim() : undefined;
    const targetStatus = status && status.toUpperCase() === 'APPROVED' ? 'APPROVED' : 'PENDING';
    const isExempt = targetStatus === 'APPROVED';

    await this.userRepository.update(userId, {
      st120_document_url: relativeUrl,
      st120_pdf_url: relativeUrl,
      st120_status: targetStatus,
      ...(isExempt ? { tax_exempt: true } : {}),
      ...(cleanTaxId ? { tax_id: cleanTaxId } : {}),
    });

    if (user.profile) {
      await this.profileRepository.update(user.profile.id, {
        st120_document_url: relativeUrl,
        st120_status: targetStatus,
        ...(isExempt ? { tax_exempt: true } : {}),
        ...(cleanTaxId ? { tax_id: cleanTaxId } : {}),
      });
    }

    const updatedUser = (await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    }))!;

    this.logger.log(`ST-120 document uploaded for user ${userId}: ${relativeUrl} (${targetStatus})`);
    return {
      success: true,
      url: relativeUrl,
      documentUrl: relativeUrl,
      st120_pdf_url: relativeUrl,
      user: updatedUser,
    };
  }

  /**
   * Retrieves official ST-120 PDF file data for download or browser visualization
   * TASK-82-02: GET /api/tax/:userId/st120-pdf retorna el PDF para visualización en navegador o descarga
   */
  async getSt120Pdf(userId: string): Promise<{
    filePath: string;
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const documentUrl =
      user.st120_pdf_url ||
      user.st120_document_url ||
      user.profile?.st120_document_url;

    if (!documentUrl) {
      throw new NotFoundException(`User ${userId} does not have an ST-120 document on file`);
    }

    const cleanRelative = documentUrl.replace(/^\/uploads\/?/, '');
    const filePath = path.join(path.resolve(UPLOAD_PATH), cleanRelative);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`ST-120 physical file not found on disk at: ${cleanRelative}`);
    }

    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

    return {
      filePath,
      buffer,
      filename,
      mimeType,
    };
  }

  /**
   * Admin-only backfill: Generates digital ST-120 for all PENDING users with legal data
   */
  async backfillAllPending(): Promise<{
    success: boolean;
    processedCount: number;
    totalPending: number;
    errors: any[];
  }> {
    const pendingUsers = await this.userRepository.find({
      where: [{ st120_status: 'PENDING' }],
      relations: ['profile', 'addresses'],
    });

    let processedCount = 0;
    const errors: any[] = [];
    const generator = this.getGenerator();

    for (const user of pendingUsers) {
      try {
        const legalBusinessName =
          (user.legal_business_name && user.legal_business_name.trim()) ||
          (user.profile?.company_name && user.profile.company_name.trim()) ||
          user.email;

        const taxId = user.tax_id || user.profile?.tax_id || user.ein;

        // Process users who have minimal identification info
        if (legalBusinessName || taxId || user.signature_text) {
          const dba = user.dba || user.profile?.company_name || null;
          const businessAddress =
            user.business_address ||
            (user.addresses && user.addresses.length > 0 ? user.addresses[0].address : 'Address on file');
          const signerName = user.signer_name || user.profile?.full_name || user.email;
          const signerTitle = user.signer_title || 'Authorized Representative';
          const signatureText =
            user.signature_text || user.signer_name || user.profile?.full_name || 'Digitally Certified';
          const acceptedAt = user.accepted_at || new Date();
          const ipAddress = user.ip_address || '127.0.0.1';

          const pdfResult = await generator.generateST120Pdf({
            userId: user.id,
            legalBusinessName,
            dba,
            businessAddress,
            taxId: taxId || 'PENDING',
            ein: user.ein || null,
            signerName,
            signerTitle,
            signatureText,
            acceptedAt,
            ipAddress,
          });

          await this.userRepository.update(user.id, {
            st120_status: 'APPROVED',
            tax_exempt: true,
            st120_document_url: pdfResult.relativeUrl,
            st120_pdf_url: pdfResult.relativeUrl,
            ...(user.signature_text ? {} : { signature_text: signatureText }),
            ...(user.signer_name ? {} : { signer_name: signerName }),
          });

          if (user.profile) {
            await this.profileRepository.update(user.profile.id, {
              st120_status: 'APPROVED',
              tax_exempt: true,
              st120_document_url: pdfResult.relativeUrl,
            });
          }

          processedCount++;
        }
      } catch (err: any) {
        this.logger.error(`Failed backfill for user ${user.id}: ${err.message}`);
        errors.push({ userId: user.id, error: err.message });
      }
    }

    this.logger.log(`Backfill completed: ${processedCount}/${pendingUsers.length} users processed.`);
    return {
      success: true,
      processedCount,
      totalPending: pendingUsers.length,
      errors,
    };
  }
}

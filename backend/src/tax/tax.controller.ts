import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import { UPLOAD_PATH } from '../config';
import { TaxService } from './tax.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller(['tax', 'api/tax'])
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post('validate-st120/:userId')
  @UseGuards(AuthGuard)
  async validateST120(@Param('userId') userId: string) {
    return this.taxService.auditUserST120(userId);
  }

  @Post('approve/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async approveExemption(@Param('userId') userId: string) {
    return this.taxService.approveExemption(userId);
  }

  @Post('reject/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async rejectExemption(@Param('userId') userId: string, @Body('reason') reason?: string) {
    return this.taxService.rejectExemption(userId, reason);
  }

  @Get('status/:userId')
  @UseGuards(AuthGuard)
  async getStatus(@Param('userId') userId: string) {
    const user = await this.taxService['userRepository'].findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    const isExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt);
    const taxId = user?.profile?.tax_id || user?.tax_id || null;
    const st120Status = user?.profile?.st120_status || user?.st120_status || 'NONE';
    const st120DocUrl = user?.st120_pdf_url || user?.profile?.st120_document_url || user?.st120_document_url || null;

    return {
      userId,
      taxId,
      st120Status,
      st120DocumentUrl: st120DocUrl,
      st120PdfUrl: st120DocUrl,
      taxExempt: isExempt,
      taxLegend: isExempt ? this.taxService.getOfficialNysDtfLegend(taxId) : null,
    };
  }

  /**
   * Generates an official digital Form ST-120 Resale Certificate
   * Admin can specify userId in body, client generates for their own user.id
   * Validates legal business name, EIN, and signer data
   */
  @Post('generate-digital-st120')
  @UseGuards(AuthGuard)
  async generateDigitalST120(@Req() req: any, @Body() body?: any) {
    const targetUserId = req.user?.role === 'admin' && body?.userId ? body.userId : req.user.id;
    return this.taxService.generateDigitalST120(targetUserId, req.user, body);
  }

  /**
   * Signs digital Form ST-120 and sets user to tax_exempt = true, status APPROVED
   */
  @Post('sign-st120')
  @UseGuards(AuthGuard)
  async signST120(@Req() req: any, @Body() body: any) {
    const targetUserId = req.user?.role === 'admin' && body?.userId ? body.userId : req.user.id;
    const clientIp =
      (req.headers && req.headers['x-forwarded-for']) ||
      req.socket?.remoteAddress ||
      req.ip ||
      '127.0.0.1';

    return this.taxService.signST120(targetUserId, body, String(clientIp), req.user);
  }

  /**
   * Uploads an external ST-120 file (PDF or image)
   * Registers file with status APPROVED or PENDING
   */
  @Post('upload-st120')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(resolve(UPLOAD_PATH), 'st120');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

        const ext = extname(file.originalname).toLowerCase();
        const mime = file.mimetype;

        if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(mime)) {
          return cb(
            new BadRequestException(
              'Only PDF and image files (.pdf, .jpg, .jpeg, .png, .webp) are allowed',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadST120(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') bodyUserId?: string,
    @Body('tax_id') taxId?: string,
    @Body('status') status?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file type not allowed');
    }
    const targetUserId = req.user?.role === 'admin' && bodyUserId ? bodyUserId : req.user.id;
    return this.taxService.uploadST120(targetUserId, file, taxId, req.user, status);
  }

  /**
   * Returns ST-120 PDF for inline browser viewing or download
   */
  @Get(':userId/st120-pdf')
  @UseGuards(AuthGuard)
  async getSt120Pdf(
    @Param('userId') paramUserId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const targetUserId = paramUserId === 'me' ? req.user.id : paramUserId;
    if (req.user?.role !== 'admin' && req.user?.id !== targetUserId) {
      throw new ForbiddenException('Cannot access ST-120 PDF for another user');
    }

    const pdfData = await this.taxService.getSt120Pdf(targetUserId);
    res.set({
      'Content-Type': pdfData.mimeType,
      'Content-Disposition': `inline; filename="${pdfData.filename}"`,
      'Content-Length': pdfData.buffer.length,
    });
    res.end(pdfData.buffer);
  }

  /**
   * Backfill all pending ST-120 applications
   */
  @Post('backfill-all')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async backfillAll() {
    return this.taxService.backfillAllPending();
  }
}

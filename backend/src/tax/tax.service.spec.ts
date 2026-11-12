import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { TaxService } from './tax.service';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { VisionValidationService } from './vision-validation.service';
import { St120GeneratorService } from './st120-generator.service';
import { UPLOAD_PATH } from '../config';

describe('TaxService', () => {
  let service: TaxService;

  const mockUser: any = {
    id: 'user-tax-1',
    email: 'client@bakery.com',
    tax_id: '12-3456789',
    tax_exempt: false,
    st120_status: 'PENDING',
    st120_document_url: null,
    st120_pdf_url: null,
    legal_business_name: 'Downtown Bakery LLC',
    dba: 'Downtown Bake',
    ein: '98-7654321',
    business_address: '456 Broadway, New York, NY 10013',
    signer_name: 'John Baker',
    signer_title: 'Owner',
    signature_text: 'John Baker',
    ip_address: '127.0.0.1',
    profile: {
      id: 'user-tax-1',
      tax_id: '12-3456789',
      st120_status: 'PENDING',
      tax_exempt: false,
      company_name: 'Downtown Bakery LLC',
      full_name: 'John Baker',
    },
    addresses: [
      { id: 'addr-1', address: '456 Broadway, New York, NY 10013', is_default: true },
    ],
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockProfileRepository = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockVisionValidationService = {
    analyzeDocument: jest.fn(),
  };

  const defaultPdfResult = {
    filePath: '/tmp/test-st120.pdf',
    relativeUrl: '/uploads/st120/st120-user-tax-1-test.pdf',
    relativePath: '/uploads/st120/st120-user-tax-1-test.pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
    auditHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    forensicHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  };

  const mockSt120GeneratorService = {
    generateDigitalSt120Pdf: jest.fn().mockResolvedValue(defaultPdfResult),
    generateST120Pdf: jest.fn().mockResolvedValue(defaultPdfResult),
  };

  beforeEach(async () => {
    mockSt120GeneratorService.generateDigitalSt120Pdf.mockResolvedValue(defaultPdfResult);
    mockSt120GeneratorService.generateST120Pdf.mockResolvedValue(defaultPdfResult);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Profile), useValue: mockProfileRepository },
        { provide: VisionValidationService, useValue: mockVisionValidationService },
        { provide: St120GeneratorService, useValue: mockSt120GeneratorService },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateOrderTax', () => {
    it('should return 0% tax and legal legend when user is tax exempt (Happy Path)', () => {
      const user = { tax_exempt: true, tax_id: '12-3456789' };
      const result = service.calculateOrderTax(user, 100);

      expect(result.tax_exempt).toBe(true);
      expect(result.tax_rate).toBe(0.0);
      expect(result.tax_amount).toBe(0.0);
      expect(result.tax_legend).toContain('NYS DTF Form ST-120');
      expect(result.tax_legend).toContain('12-3456789');
    });

    it('should apply 8.875% tax when user is not exempt', () => {
      const user = { tax_exempt: false, tax_id: null };
      const result = service.calculateOrderTax(user, 100);

      expect(result.tax_exempt).toBe(false);
      expect(result.tax_rate).toBe(8.875);
      expect(result.tax_amount).toBe(8.88);
      expect(result.tax_legend).toBeNull();
    });
  });

  describe('generateDigitalST120', () => {
    it('should generate official digital ST-120, approve user and persist st120_pdf_url (Happy Path)', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({
          ...mockUser,
          st120_status: 'APPROVED',
          tax_exempt: true,
          st120_document_url: '/uploads/st120/st120-user-tax-1-test.pdf',
          st120_pdf_url: '/uploads/st120/st120-user-tax-1-test.pdf',
        });

      const response = await service.generateDigitalST120('user-tax-1', { id: 'user-tax-1', role: 'client' });

      expect(response.success).toBe(true);
      expect(response.documentUrl).toBe('/uploads/st120/st120-user-tax-1-test.pdf');
      expect(response.st120_pdf_url).toBe('/uploads/st120/st120-user-tax-1-test.pdf');
      expect(response.user.st120_status).toBe('APPROVED');
      expect(response.user.tax_exempt).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        st120_status: 'APPROVED',
        tax_exempt: true,
        st120_document_url: '/uploads/st120/st120-user-tax-1-test.pdf',
        st120_pdf_url: '/uploads/st120/st120-user-tax-1-test.pdf',
      }));
      expect(mockProfileRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        st120_status: 'APPROVED',
        tax_exempt: true,
      }));
    });

    it('should throw NotFoundException if user does not exist (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.generateDigitalST120('non-existent-user', { id: 'non-existent-user', role: 'client' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if client tries to generate ST-120 for another user (Sad Path §6)', async () => {
      await expect(
        service.generateDigitalST120('other-user-id', { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if legal_business_name is missing (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        legal_business_name: null,
        profile: { ...mockUser.profile, company_name: null },
      });

      await expect(
        service.generateDigitalST120('user-tax-1', { id: 'user-tax-1', role: 'client' }, { legal_business_name: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if ein is missing (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        ein: null,
        tax_id: null,
        profile: { ...mockUser.profile, tax_id: null },
      });

      await expect(
        service.generateDigitalST120('user-tax-1', { id: 'user-tax-1', role: 'client' }, { ein: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if signer_name is missing (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        signer_name: null,
        profile: { ...mockUser.profile, full_name: null },
      });

      await expect(
        service.generateDigitalST120('user-tax-1', { id: 'user-tax-1', role: 'client' }, { signer_name: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('signST120', () => {
    it('should validate signature, generate ST-120 and approve user (Happy Path)', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({
          ...mockUser,
          st120_status: 'APPROVED',
          tax_exempt: true,
          st120_document_url: '/uploads/st120/st120-user-tax-1-test.pdf',
          st120_pdf_url: '/uploads/st120/st120-user-tax-1-test.pdf',
        });

      const response = await service.signST120(
        'user-tax-1',
        {
          signature_text: 'John Baker',
          signer_name: 'John Baker',
          signer_title: 'President',
          legal_business_name: 'Downtown Bakery LLC',
        },
        '10.0.0.1',
        { id: 'user-tax-1', role: 'client' },
      );

      expect(response.success).toBe(true);
      expect(response.documentUrl).toBe('/uploads/st120/st120-user-tax-1-test.pdf');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        signer_name: 'John Baker',
        signer_title: 'President',
        signature_text: 'John Baker',
        st120_status: 'APPROVED',
        tax_exempt: true,
      }));
    });

    it('should throw BadRequestException if signature_text is missing (Sad Path §6)', async () => {
      await expect(
        service.signST120('user-tax-1', { signature_text: '', signer_name: 'John Baker' }, '127.0.0.1', { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if signer_name is missing (Sad Path §6)', async () => {
      await expect(
        service.signST120('user-tax-1', { signature_text: 'John Baker', signer_name: '   ' }, '127.0.0.1', { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user does not exist (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.signST120('user-unknown', { signature_text: 'John', signer_name: 'John' }, '127.0.0.1', { id: 'user-unknown', role: 'client' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin tries to sign for someone else (Sad Path §6)', async () => {
      await expect(
        service.signST120('other-user', { signature_text: 'John', signer_name: 'John' }, '127.0.0.1', { id: 'client-1', role: 'client' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('uploadST120', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'tax-doc.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      destination: '/uploads/st120',
      filename: 'unique-doc-123.pdf',
      path: '/uploads/st120/unique-doc-123.pdf',
      buffer: Buffer.from('test'),
      stream: null as any,
    };

    it('should save uploaded document and mark status PENDING by default (Happy Path)', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({
          ...mockUser,
          st120_status: 'PENDING',
          st120_document_url: '/uploads/st120/unique-doc-123.pdf',
        });

      const response = await service.uploadST120('user-tax-1', mockFile, '12-3456789', { id: 'user-tax-1', role: 'client' });

      expect(response.success).toBe(true);
      expect(response.url).toBe('/uploads/st120/unique-doc-123.pdf');
      expect(response.st120_pdf_url).toBe('/uploads/st120/unique-doc-123.pdf');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        st120_status: 'PENDING',
        st120_document_url: '/uploads/st120/unique-doc-123.pdf',
      }));
    });

    it('should register uploaded document with status APPROVED when specified (Happy Path)', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({
          ...mockUser,
          st120_status: 'APPROVED',
          tax_exempt: true,
          st120_document_url: '/uploads/st120/unique-doc-123.pdf',
        });

      const response = await service.uploadST120(
        'user-tax-1',
        mockFile,
        '12-3456789',
        { id: 'admin-1', role: 'admin' },
        'APPROVED',
      );

      expect(response.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        st120_status: 'APPROVED',
        tax_exempt: true,
        st120_document_url: '/uploads/st120/unique-doc-123.pdf',
      }));
    });

    it('should throw BadRequestException if file is null (Sad Path §6)', async () => {
      await expect(
        service.uploadST120('user-tax-1', null as any, undefined, { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user is not found (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.uploadST120('unknown-user', mockFile, undefined, { id: 'unknown-user', role: 'client' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin uploads for other user (Sad Path §6)', async () => {
      await expect(
        service.uploadST120('victim-user', mockFile, undefined, { id: 'attacker-client', role: 'client' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSt120Pdf', () => {
    const testPdfDir = path.join(path.resolve(UPLOAD_PATH), 'st120');
    const testPdfPath = path.join(testPdfDir, 'test-download.pdf');

    beforeAll(() => {
      if (!fs.existsSync(testPdfDir)) {
        fs.mkdirSync(testPdfDir, { recursive: true });
      }
      fs.writeFileSync(testPdfPath, Buffer.from('%PDF-1.4 test download file'));
    });

    afterAll(() => {
      try {
        if (fs.existsSync(testPdfPath)) {
          fs.unlinkSync(testPdfPath);
        }
      } catch (_) {}
    });

    it('should retrieve existing ST-120 PDF file data (Happy Path)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        st120_pdf_url: '/uploads/st120/test-download.pdf',
      });

      const result = await service.getSt120Pdf('user-tax-1');

      expect(result).toBeDefined();
      expect(result.filename).toBe('test-download.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.toString()).toContain('%PDF-1.4');
    });

    it('should throw NotFoundException if user is not found (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.getSt120Pdf('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user has no document URL (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        st120_pdf_url: null,
        st120_document_url: null,
        profile: { ...mockUser.profile, st120_document_url: null },
      });
      await expect(service.getSt120Pdf('user-tax-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if physical file is missing on disk (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        st120_pdf_url: '/uploads/st120/ghost-file-does-not-exist.pdf',
      });
      await expect(service.getSt120Pdf('user-tax-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('backfillAllPending', () => {
    it('should generate official ST-120 for all pending users with legal data (Happy Path)', async () => {
      mockUserRepository.find.mockResolvedValueOnce([
        { ...mockUser, id: 'user-1' },
        { ...mockUser, id: 'user-2', legal_business_name: 'Bakery Two Corp' },
      ]);

      const result = await service.backfillAllPending();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.totalPending).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockSt120GeneratorService.generateST120Pdf).toHaveBeenCalledTimes(2);
    });

    it('should catch individual user errors and continue processing the rest (Sad Path / Resiliency)', async () => {
      mockUserRepository.find.mockResolvedValueOnce([
        { ...mockUser, id: 'failing-user' },
        { ...mockUser, id: 'success-user' },
      ]);

      mockSt120GeneratorService.generateST120Pdf
        .mockRejectedValueOnce(new Error('PDF generation failed'))
        .mockResolvedValueOnce(defaultPdfResult);

      const result = await service.backfillAllPending();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].userId).toBe('failing-user');
    });
  });

  describe('approveExemption and rejectExemption', () => {
    it('should approve exemption and mark tax_exempt = true', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({ ...mockUser, st120_status: 'APPROVED', tax_exempt: true });

      const res = await service.approveExemption('user-tax-1');
      expect(res.success).toBe(true);
      expect(res.user.tax_exempt).toBe(true);
    });

    it('should reject exemption and mark tax_exempt = false', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({ ...mockUser, st120_status: 'REJECTED', tax_exempt: false });

      const res = await service.rejectExemption('user-tax-1', 'Invalid document');
      expect(res.success).toBe(true);
      expect(res.user.st120_status).toBe('REJECTED');
    });

    it('should throw NotFoundException when approving non-existent user (Sad Path §6)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.approveExemption('invalid-user')).rejects.toThrow(NotFoundException);
    });
  });
});

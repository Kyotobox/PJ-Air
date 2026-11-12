import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaxService, NYS_DTF_LEGEND_PREFIX } from './tax.service';
import { St120GeneratorService } from './st120-generator.service';
import { VisionValidationService } from './vision-validation.service';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';

describe('TaxService', () => {
  let service: TaxService;
  let st120GeneratorService: St120GeneratorService;

  const mockUser: any = {
    id: 'user-tax-1',
    email: 'client@bakery.com',
    role: 'client',
    tax_exempt: false,
    st120_status: 'PENDING',
    legal_business_name: 'Downtown Bakery LLC',
    dba: 'Downtown Bake',
    tax_id: '12-3456789',
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

  const mockSt120GeneratorService = {
    generateST120Pdf: jest.fn().mockResolvedValue({
      filePath: '/tmp/test-st120.pdf',
      relativeUrl: '/uploads/st120/st120-user-tax-1-test.pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
      auditHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    }),
  };

  beforeEach(async () => {
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
    st120GeneratorService = module.get<St120GeneratorService>(St120GeneratorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOfficialNysDtfLegend', () => {
    it('should return complete official legend with tax ID (Happy Path)', () => {
      const legend = service.getOfficialNysDtfLegend('12-3456789');
      expect(legend).toContain(NYS_DTF_LEGEND_PREFIX);
      expect(legend).toContain('12-3456789');
    });

    it('should return N/A if tax ID is missing', () => {
      const legend = service.getOfficialNysDtfLegend(null);
      expect(legend).toContain('NY Resale / Tax ID: N/A');
    });
  });

  describe('calculateOrderTax', () => {
    it('should calculate 0% tax for exempt users (Happy Path)', () => {
      const result = service.calculateOrderTax(
        { tax_exempt: true, tax_id: '12-3456789' },
        150.0,
      );
      expect(result.tax_exempt).toBe(true);
      expect(result.tax_amount).toBe(0.0);
      expect(result.tax_rate).toBe(0.0);
      expect(result.tax_legend).toContain('12-3456789');
    });

    it('should calculate standard NYC sales tax (8.875%) for non-exempt users', () => {
      const result = service.calculateOrderTax(
        { tax_exempt: false },
        100.0,
      );
      expect(result.tax_exempt).toBe(false);
      expect(result.tax_rate).toBe(8.875);
      expect(result.tax_amount).toBe(8.88);
      expect(result.tax_legend).toBeNull();
    });
  });

  describe('generateDigitalST120', () => {
    it('should generate official digital ST-120 and approve user (Happy Path)', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce({
          ...mockUser,
          st120_status: 'APPROVED',
          tax_exempt: true,
          st120_document_url: '/uploads/st120/st120-user-tax-1-test.pdf',
        });

      const response = await service.generateDigitalST120('user-tax-1', { id: 'user-tax-1', role: 'client' });

      expect(response.success).toBe(true);
      expect(response.documentUrl).toBe('/uploads/st120/st120-user-tax-1-test.pdf');
      expect(response.user.st120_status).toBe('APPROVED');
      expect(response.user.tax_exempt).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        st120_status: 'APPROVED',
        tax_exempt: true,
        st120_document_url: '/uploads/st120/st120-user-tax-1-test.pdf',
      }));
      expect(mockProfileRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        st120_status: 'APPROVED',
        tax_exempt: true,
      }));
    });

    it('should throw NotFoundException if user does not exist (Sad Path)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.generateDigitalST120('non-existent-user', { id: 'non-existent-user', role: 'client' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if client tries to generate ST-120 for another user (Sad Path)', async () => {
      await expect(
        service.generateDigitalST120('other-user-id', { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(ForbiddenException);
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

    it('should throw BadRequestException if signature_text is missing (Sad Path)', async () => {
      await expect(
        service.signST120('user-tax-1', { signature_text: '', signer_name: 'John Baker' }, '127.0.0.1', { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if signer_name is missing (Sad Path)', async () => {
      await expect(
        service.signST120('user-tax-1', { signature_text: 'John Baker', signer_name: '   ' }, '127.0.0.1', { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user does not exist (Sad Path)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.signST120('user-unknown', { signature_text: 'John', signer_name: 'John' }, '127.0.0.1', { id: 'user-unknown', role: 'client' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin tries to sign for someone else (Sad Path)', async () => {
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

    it('should save uploaded document and mark status PENDING (Happy Path)', async () => {
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
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-tax-1', expect.objectContaining({
        st120_status: 'PENDING',
        st120_document_url: '/uploads/st120/unique-doc-123.pdf',
      }));
    });

    it('should throw BadRequestException if file is null (Sad Path)', async () => {
      await expect(
        service.uploadST120('user-tax-1', null as any, undefined, { id: 'user-tax-1', role: 'client' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user is not found (Sad Path)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.uploadST120('unknown-user', mockFile, undefined, { id: 'unknown-user', role: 'client' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin uploads for other user (Sad Path)', async () => {
      await expect(
        service.uploadST120('victim-user', mockFile, undefined, { id: 'attacker-client', role: 'client' }),
      ).rejects.toThrow(ForbiddenException);
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
        .mockResolvedValueOnce({
          filePath: '/tmp/test.pdf',
          relativeUrl: '/uploads/st120/ok.pdf',
          buffer: Buffer.from('ok'),
          auditHash: '1234',
        });

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

    it('should throw NotFoundException when approving non-existent user (Sad Path)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.approveExemption('invalid-user')).rejects.toThrow(NotFoundException);
    });
  });
});

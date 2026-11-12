import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

describe('TaxController', () => {
  let controller: TaxController;
  let taxService: TaxService;

  const mockTaxService = {
    auditUserST120: jest.fn().mockResolvedValue({ verdict: 'APPROVED', confidence: 0.95 }),
    approveExemption: jest.fn().mockResolvedValue({ success: true, user: { id: 'u1', tax_exempt: true } }),
    rejectExemption: jest.fn().mockResolvedValue({ success: true, user: { id: 'u1', tax_exempt: false } }),
    generateDigitalST120: jest.fn().mockResolvedValue({ success: true, documentUrl: '/uploads/st120/doc.pdf' }),
    signST120: jest.fn().mockResolvedValue({ success: true, documentUrl: '/uploads/st120/signed.pdf' }),
    uploadST120: jest.fn().mockResolvedValue({ success: true, url: '/uploads/st120/upload.pdf' }),
    backfillAllPending: jest.fn().mockResolvedValue({ success: true, processedCount: 5 }),
    getOfficialNysDtfLegend: jest.fn().mockReturnValue('Official Legend'),
    userRepository: {
      findOne: jest.fn().mockResolvedValue({
        id: 'u1',
        tax_id: '12-3456789',
        tax_exempt: true,
        st120_status: 'APPROVED',
        st120_document_url: '/uploads/st120/doc.pdf',
        profile: {
          tax_id: '12-3456789',
          tax_exempt: true,
          st120_status: 'APPROVED',
          st120_document_url: '/uploads/st120/doc.pdf',
        },
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxController],
      providers: [
        { provide: TaxService, useValue: mockTaxService },
      ],
    }).compile();

    controller = module.get<TaxController>(TaxController);
    taxService = module.get<TaxService>(TaxService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return complete tax status and legend for user (Happy Path)', async () => {
      const res = await controller.getStatus('u1');
      expect(res.userId).toBe('u1');
      expect(res.taxExempt).toBe(true);
      expect(res.st120Status).toBe('APPROVED');
      expect(res.taxLegend).toBe('Official Legend');
    });
  });

  describe('generateDigitalST120', () => {
    it('should use req.user.id for client users (Happy Path)', async () => {
      const req = { user: { id: 'client-1', role: 'client' } };
      await controller.generateDigitalST120(req);

      expect(mockTaxService.generateDigitalST120).toHaveBeenCalledWith('client-1', req.user);
    });

    it('should use body.userId if requesting user is admin', async () => {
      const req = { user: { id: 'admin-1', role: 'admin' } };
      await controller.generateDigitalST120(req, { userId: 'target-user-2' });

      expect(mockTaxService.generateDigitalST120).toHaveBeenCalledWith('target-user-2', req.user);
    });
  });

  describe('signST120', () => {
    it('should extract client IP and forward sign request (Happy Path)', async () => {
      const req = {
        user: { id: 'client-1', role: 'client' },
        headers: { 'x-forwarded-for': '203.0.113.195' },
      };
      const body = { signature_text: 'Jane Doe', signer_name: 'Jane Doe' };

      await controller.signST120(req, body);

      expect(mockTaxService.signST120).toHaveBeenCalledWith(
        'client-1',
        body,
        '203.0.113.195',
        req.user,
      );
    });
  });

  describe('uploadST120', () => {
    it('should upload file and call service (Happy Path)', async () => {
      const req = { user: { id: 'client-1', role: 'client' } };
      const file: any = { filename: 'test.pdf' };

      await controller.uploadST120(req, file, undefined, '12-3456789');

      expect(mockTaxService.uploadST120).toHaveBeenCalledWith('client-1', file, '12-3456789', req.user);
    });

    it('should throw BadRequestException if file is missing (Sad Path)', async () => {
      const req = { user: { id: 'client-1', role: 'client' } };
      await expect(controller.uploadST120(req, null as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('backfillAll', () => {
    it('should call taxService.backfillAllPending (Happy Path)', async () => {
      const res = await controller.backfillAll();
      expect(res.success).toBe(true);
      expect(mockTaxService.backfillAllPending).toHaveBeenCalled();
    });
  });
});

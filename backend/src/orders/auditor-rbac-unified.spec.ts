import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeliveryIncidentsService } from './delivery-incidents.service';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { MailService } from '../mail/mail.service';
import { TaxService } from '../tax/tax.service';
import { VisionValidationService } from '../tax/vision-validation.service';
import { St120GeneratorService } from '../tax/st120-generator.service';

describe('Auditor RBAC Unified Authorization (§TASK-102-03)', () => {
  let deliveryService: DeliveryIncidentsService;
  let taxService: TaxService;

  let mockIncidentRepo: any;
  let mockOrderRepo: any;
  let mockUserRepo: any;
  let mockProfileRepo: any;

  beforeEach(async () => {
    mockIncidentRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'inc-1', order_id: 'ord-100', user_id: 'client-user' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'inc-1', order_id: 'ord-100', user_id: 'client-user' }),
      create: jest.fn((dto) => ({ ...dto, id: 'inc-new' })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'inc-saved' })),
    };

    mockOrderRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'ord-100',
        user_id: 'client-user',
        items: [{ product_id: 1, price_at_time: 10 }],
      }),
      find: jest.fn(),
    };

    const dummyUser: any = {
      id: 'client-user',
      email: 'client@example.com',
      tax_id: '12-3456789',
      tax_exempt: true,
      st120_status: 'APPROVED',
      st120_pdf_url: '/uploads/st120/cert.pdf',
      st120_document_url: '/uploads/st120/cert.pdf',
      profile: {
        id: 'prof-1',
        tax_id: '12-3456789',
        tax_exempt: true,
        st120_status: 'APPROVED',
        st120_document_url: '/uploads/st120/cert.pdf',
      },
    };

    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({ ...dummyUser }),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn((u) => Promise.resolve(u)),
    };

    mockProfileRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryIncidentsService,
        TaxService,
        {
          provide: getRepositoryToken(DeliveryIncident),
          useValue: mockIncidentRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Profile),
          useValue: mockProfileRepo,
        },
        {
          provide: MailService,
          useValue: { sendStoreCreditCard: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: VisionValidationService,
          useValue: { analyzeDocument: jest.fn() },
        },
        {
          provide: St120GeneratorService,
          useValue: {
            generateDigitalSt120Pdf: jest.fn().mockResolvedValue({
              relativeUrl: '/uploads/st120/cert.pdf',
              auditHash: 'hash-123',
            }),
            generateST120Pdf: jest.fn().mockResolvedValue({
              relativeUrl: '/uploads/st120/cert.pdf',
              auditHash: 'hash-123',
            }),
          },
        },
      ],
    }).compile();

    deliveryService = module.get<DeliveryIncidentsService>(DeliveryIncidentsService);
    taxService = module.get<TaxService>(TaxService);
  });

  describe('DeliveryIncidentsService - Read-Only Auditor Authorization', () => {
    it('findByOrder: should permit auditor to view incidents of any order (Happy Path)', async () => {
      const auditorContext = { id: 'auditor-1', role: 'auditor' };
      const incidents = await deliveryService.findByOrder('ord-100', auditorContext);

      expect(incidents).toBeDefined();
      expect(incidents.length).toBe(1);
      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: { order_id: 'ord-100' },
        order: { created_at: 'DESC' },
      });
    });

    it('findByOrder: should throw ForbiddenException when client tries to view another user order (Sad Path §6)', async () => {
      const clientContext = { id: 'other-client', role: 'client' };
      await expect(deliveryService.findByOrder('ord-100', clientContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('findByUser: should permit auditor to view incidents of any client (Happy Path)', async () => {
      const auditorContext = { id: 'auditor-1', role: 'auditor' };
      const incidents = await deliveryService.findByUser('client-user', auditorContext);

      expect(incidents).toBeDefined();
      expect(incidents.length).toBe(1);
      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'client-user' },
        order: { created_at: 'DESC' },
      });
    });

    it('findByUser: should throw ForbiddenException when client tries to view another user incidents (Sad Path §6)', async () => {
      const clientContext = { id: 'other-client', role: 'client' };
      await expect(deliveryService.findByUser('client-user', clientContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('createIncident: should reject mutative incident creation by auditor maintaining SoD (Sad Path §6)', async () => {
      const auditorContext = { id: 'auditor-1', role: 'auditor' };
      const dto = {
        order_id: 'ord-100',
        product_id: 1,
        quantity: 1,
        reason_category: 'transit_damage',
      };

      await expect(deliveryService.createIncident(dto as any, auditorContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('TaxService - Read-Only Auditor Authorization & SoD Protection', () => {
    it('findExemptionByUser: should permit auditor to query client tax exemption (Happy Path)', async () => {
      const auditorContext = { id: 'auditor-1', role: 'auditor' };
      const result = await taxService.findExemptionByUser('client-user', auditorContext);

      expect(result).toBeDefined();
      expect(result.userId).toBe('client-user');
      expect(result.taxExempt).toBe(true);
      expect(result.st120Status).toBe('APPROVED');
      expect(result.taxId).toBe('12-3456789');
    });

    it('findExemptionByUser: should throw ForbiddenException when client queries another user (Sad Path §6)', async () => {
      const clientContext = { id: 'other-client', role: 'client' };
      await expect(taxService.findExemptionByUser('client-user', clientContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('findExemptionByUser: should throw NotFoundException when target user does not exist (Sad Path §6)', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);
      const auditorContext = { id: 'auditor-1', role: 'auditor' };

      await expect(taxService.findExemptionByUser('non-existent', auditorContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('downloadCertificate / getSt120Pdf: should throw ForbiddenException when client tries to access another user certificate (Sad Path §6)', async () => {
      const clientContext = { id: 'other-client', role: 'client' };
      await expect(taxService.downloadCertificate('client-user', clientContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('generateDigitalST120: should reject generation by auditor maintaining SoD (Sad Path §6)', async () => {
      const auditorContext = { id: 'auditor-1', role: 'auditor' };
      await expect(
        taxService.generateDigitalST120('client-user', auditorContext, {
          legal_business_name: 'Test Corp',
          ein: '12-3456789',
          signer_name: 'Tester',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('signST120: should reject signing by auditor maintaining SoD (Sad Path §6)', async () => {
      const auditorContext = { id: 'auditor-1', role: 'auditor' };
      await expect(
        taxService.signST120(
          'client-user',
          { signature_text: 'Auditor Signature', signer_name: 'Auditor' },
          '127.0.0.1',
          auditorContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('uploadST120: should reject upload by auditor maintaining SoD (Sad Path §6)', async () => {
      const auditorContext = { id: 'auditor-1', role: 'auditor' };
      const file: any = { filename: 'test.pdf' };
      await expect(
        taxService.uploadST120('client-user', file, '12-3456789', auditorContext),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

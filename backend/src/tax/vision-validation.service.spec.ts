import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisionValidationService, VisionValidationResult } from './vision-validation.service';
import { TaxService, NYS_DTF_LEGEND_PREFIX } from './tax.service';
import { ValidationException } from './tax.exceptions';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

describe('VisionValidationService & TaxEngineSuite (Sprint S46)', () => {
  let visionService: VisionValidationService;
  let taxService: TaxService;
  let mockUserRepository: any;
  let mockProfileRepository: any;

  const testTempDir = path.resolve(process.cwd(), 'temp_test_st120');
  const sampleFilePath = path.join(testTempDir, 'sample_st120.pdf');

  beforeAll(() => {
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
    fs.writeFileSync(sampleFilePath, 'DUMMY_PDF_CONTENT_FOR_ST120_VISION_TEST');
  });

  afterAll(() => {
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockProfileRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionValidationService,
        TaxService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Profile),
          useValue: mockProfileRepository,
        },
      ],
    }).compile();

    visionService = module.get<VisionValidationService>(VisionValidationService);
    taxService = module.get<TaxService>(TaxService);
  });

  it('should be defined', () => {
    expect(visionService).toBeDefined();
    expect(taxService).toBeDefined();
  });

  describe('Tax ID and Company Name Normalization', () => {
    it('should normalize Tax ID by stripping hyphens, spaces and casing', () => {
      expect(visionService.normalizeTaxId(' 12-3456789 ')).toBe('123456789');
      expect(visionService.normalizeTaxId('ny-987-654-321')).toBe('NY987654321');
      expect(visionService.normalizeTaxId(null)).toBe('');
      expect(visionService.normalizeTaxId(undefined)).toBe('');
    });

    it('should normalize company names ignoring legal suffixes', () => {
      expect(visionService.normalizeCompanyName('Jhoanes Bakery LLC')).toBe('jhoanes');
      expect(visionService.normalizeCompanyName('El Sol Panadería Inc.')).toBe('elsol');
      expect(visionService.normalizeCompanyName(null)).toBe('');
    });
  });

  describe('VisionValidationService — Happy Path (§6)', () => {
    it('should successfully match a valid ST-120 document with matching Tax ID and signature', async () => {
      const mockExtraction = {
        isValidST120Format: true,
        extractedTaxId: '12-3456789',
        extractedCompanyName: 'Jhoanes Bakery LLC',
        hasPhysicalSignature: true,
        isBlurryOrUnreadable: false,
        confidenceScore: 0.98,
        notes: 'Official ST-120 certificate authenticated.',
      };

      jest.spyOn(visionService, 'callGeminiVisionApi').mockResolvedValue(mockExtraction);

      const result: VisionValidationResult = await visionService.analyzeDocument(sampleFilePath, {
        tax_id: '12-3456789',
        company_name: 'Jhoanes Bakery',
      });

      expect(result.verdict).toBe('MATCH');
      expect(result.isValidST120Format).toBe(true);
      expect(result.hasPhysicalSignature).toBe(true);
      expect(result.comparisonDetails.taxIdMatch).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);

      // validateAndAssertST120 should not throw on happy path
      await expect(
        visionService.validateAndAssertST120(sampleFilePath, {
          tax_id: '123456789',
          company_name: 'Jhoanes Bakery',
        }),
      ).resolves.toEqual(expect.objectContaining({ verdict: 'MATCH' }));
    });
  });

  describe('VisionValidationService — Sad Paths (§6 Mandatorio)', () => {
    it('Sad Path 1: should return NEEDS_REVIEW and throw ValidationException if document is blurry or unreadable', async () => {
      const mockExtraction = {
        isValidST120Format: true,
        extractedTaxId: '12-3456789',
        extractedCompanyName: 'Jhoanes Bakery',
        hasPhysicalSignature: true,
        isBlurryOrUnreadable: true,
        confidenceScore: 0.35,
        notes: 'Document is illegible and low-resolution.',
      };

      jest.spyOn(visionService, 'callGeminiVisionApi').mockResolvedValue(mockExtraction);

      const result = await visionService.analyzeDocument(sampleFilePath, {
        tax_id: '12-3456789',
      });

      expect(result.verdict).toBe('NEEDS_REVIEW');
      expect(result.reason).toContain('blurry');

      await expect(
        visionService.validateAndAssertST120(sampleFilePath, {
          tax_id: '12-3456789',
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('Sad Path 2: should return MISMATCH and throw ValidationException if Tax ID does not match registered user', async () => {
      const mockExtraction = {
        isValidST120Format: true,
        extractedTaxId: '99-8887776',
        extractedCompanyName: 'Different Corp',
        hasPhysicalSignature: true,
        isBlurryOrUnreadable: false,
        confidenceScore: 0.95,
      };

      jest.spyOn(visionService, 'callGeminiVisionApi').mockResolvedValue(mockExtraction);

      const result = await visionService.analyzeDocument(sampleFilePath, {
        tax_id: '12-3456789',
      });

      expect(result.verdict).toBe('MISMATCH');
      expect(result.comparisonDetails.taxIdMatch).toBe(false);
      expect(result.reason).toContain('does not match');

      await expect(
        visionService.validateAndAssertST120(sampleFilePath, {
          tax_id: '12-3456789',
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('Sad Path 3: should return NEEDS_REVIEW and throw ValidationException if physical/legal signature is missing', async () => {
      const mockExtraction = {
        isValidST120Format: true,
        extractedTaxId: '12-3456789',
        extractedCompanyName: 'Jhoanes Bakery',
        hasPhysicalSignature: false,
        isBlurryOrUnreadable: false,
        confidenceScore: 0.9,
      };

      jest.spyOn(visionService, 'callGeminiVisionApi').mockResolvedValue(mockExtraction);

      const result = await visionService.analyzeDocument(sampleFilePath, {
        tax_id: '12-3456789',
      });

      expect(result.verdict).toBe('NEEDS_REVIEW');
      expect(result.hasPhysicalSignature).toBe(false);
      expect(result.reason).toContain('missing required physical or authorized legal signature');

      await expect(
        visionService.validateAndAssertST120(sampleFilePath, {
          tax_id: '12-3456789',
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('Sad Path 4: should return MISMATCH and throw ValidationException if document is not Form ST-120', async () => {
      const mockExtraction = {
        isValidST120Format: false,
        extractedTaxId: null,
        extractedCompanyName: null,
        hasPhysicalSignature: false,
        isBlurryOrUnreadable: false,
        confidenceScore: 0.1,
      };

      jest.spyOn(visionService, 'callGeminiVisionApi').mockResolvedValue(mockExtraction);

      const result = await visionService.analyzeDocument(sampleFilePath, {
        tax_id: '12-3456789',
      });

      expect(result.verdict).toBe('MISMATCH');
      expect(result.isValidST120Format).toBe(false);

      await expect(
        visionService.validateAndAssertST120(sampleFilePath, {
          tax_id: '12-3456789',
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('Sad Path 5: should throw NotFoundException if document file does not exist on disk', async () => {
      await expect(
        visionService.analyzeDocument('/non/existent/path/to/st120.pdf', {
          tax_id: '12-3456789',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('TaxService — 0% Sales Tax Calculation Engine & Legal Legend', () => {
    it('Happy Path: should apply 0.00% tax and attach official NYS DTF legend for tax-exempt users', () => {
      const exemptUser = {
        tax_exempt: true,
        tax_id: '12-3456789',
      };

      const result = taxService.calculateOrderTax(exemptUser, 500.0);

      expect(result.tax_amount).toBe(0.0);
      expect(result.tax_rate).toBe(0.0);
      expect(result.tax_exempt).toBe(true);
      expect(result.tax_legend).toBeDefined();
      expect(result.tax_legend).toContain(NYS_DTF_LEGEND_PREFIX);
      expect(result.tax_legend).toContain('12-3456789');
    });

    it('Non-exempt Path: should apply standard NY sales tax (8.875%) when tax_exempt is false', () => {
      const nonExemptUser = {
        tax_exempt: false,
        tax_id: null,
      };

      const result = taxService.calculateOrderTax(nonExemptUser, 200.0);

      expect(result.tax_rate).toBe(8.875);
      expect(result.tax_amount).toBe(17.75); // 200 * 0.08875 = 17.75
      expect(result.tax_exempt).toBe(false);
      expect(result.tax_legend).toBeNull();
    });

    it('Exempt user via profile: should recognize profile.tax_exempt as true', () => {
      const userWithProfile = {
        tax_exempt: false,
        profile: {
          tax_exempt: true,
          tax_id: 'NY-CERT-9988',
        },
      };

      const result = taxService.calculateOrderTax(userWithProfile, 1000.0);

      expect(result.tax_amount).toBe(0.0);
      expect(result.tax_exempt).toBe(true);
      expect(result.tax_legend).toContain('NY-CERT-9988');
    });

    it('Admin Approval: should approve user ST-120 and set tax_exempt to true', async () => {
      const mockUser = {
        id: 'user-audit-1',
        profile: { id: 'user-audit-1', st120_status: 'PENDING', tax_exempt: false },
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await taxService.approveExemption('user-audit-1');

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-audit-1', {
        st120_status: 'APPROVED',
        tax_exempt: true,
      });
      expect(mockProfileRepository.update).toHaveBeenCalledWith('user-audit-1', {
        st120_status: 'APPROVED',
        tax_exempt: true,
      });
    });

    it('Admin Rejection: should reject user ST-120 and set tax_exempt to false', async () => {
      const mockUser = {
        id: 'user-audit-2',
        profile: { id: 'user-audit-2', st120_status: 'PENDING', tax_exempt: true },
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await taxService.rejectExemption('user-audit-2', 'Blurry document');

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-audit-2', {
        st120_status: 'REJECTED',
        tax_exempt: false,
      });
      expect(mockProfileRepository.update).toHaveBeenCalledWith('user-audit-2', {
        st120_status: 'REJECTED',
        tax_exempt: false,
      });
    });
  });
});

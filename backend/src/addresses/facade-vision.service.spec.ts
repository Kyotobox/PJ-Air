import { Test, TestingModule } from '@nestjs/testing';
import { FacadeVisionService, FacadeAnalysisResult } from './facade-vision.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

describe('FacadeVisionService (Sprint S66A)', () => {
  let service: FacadeVisionService;
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  const tempTestDir = path.resolve(process.cwd(), 'temp_test_facade');
  const tempImagePath = path.join(tempTestDir, 'test_facade.jpg');

  beforeAll(() => {
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
    fs.writeFileSync(tempImagePath, Buffer.from('FAKE_JPEG_IMAGE_BINARY_DATA'));
  });

  afterAll(() => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FacadeVisionService],
    }).compile();

    service = module.get<FacadeVisionService>(FacadeVisionService);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFacade - Happy Path', () => {
    it('approves a commercial storefront with high confidence (Happy Path)', async () => {
      process.env.GEMINI_API_KEY = 'TEST_GEMINI_KEY';

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: 'STOREFRONT',
                    confidence: 0.96,
                    description: 'Fachada exterior de tienda de abarrotes con letrero visible y vitrina.',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const buffer = Buffer.from('FAKE_STOREFRONT_IMAGE');
      const result: FacadeAnalysisResult = await service.validateFacade(buffer, 'image/jpeg');

      expect(result.isValid).toBe(true);
      expect(result.category).toBe('STOREFRONT');
      expect(result.confidence).toBe(0.96);
      expect(result.status).toBe('VERIFIED');
      expect(result.reason).toContain('Fachada comercial verificada');
    });
  });

  describe('validateFacade - Sad Paths (§6)', () => {
    it('sad path: rejects food products (bread, pastries, baked goods) with strict rejection reason', async () => {
      process.env.GEMINI_API_KEY = 'TEST_GEMINI_KEY';

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: 'FOOD_PRODUCT',
                    confidence: 0.99,
                    description: 'Bandeja con panes horneados, croissants y bollería artesanal.',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const buffer = Buffer.from('FAKE_BREAD_IMAGE');
      const result = await service.validateFacade(buffer, 'image/jpeg');

      expect(result.isValid).toBe(false);
      expect(result.category).toBe('FOOD_PRODUCT');
      expect(result.confidence).toBe(0.99);
      expect(result.status).toBe('REJECTED');
      expect(result.reason).toBe(
        'Detectamos un producto alimenticio (pan/pastelería) en lugar de la fachada exterior de su local comercial.',
      );
    });

    it('sad path: rejects administrative documents, receipts, or invoices', async () => {
      process.env.GEMINI_API_KEY = 'TEST_GEMINI_KEY';

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: 'DOCUMENT',
                    confidence: 0.95,
                    description: 'Factura física de compras y recibo fiscal.',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const buffer = Buffer.from('FAKE_DOCUMENT_IMAGE');
      const result = await service.validateFacade(buffer, 'image/jpeg');

      expect(result.isValid).toBe(false);
      expect(result.category).toBe('DOCUMENT');
      expect(result.status).toBe('REJECTED');
      expect(result.reason).toBe('La imagen corresponde a un documento y no a la fachada del negocio.');
    });

    it('sad path: rejects personal selfies and portrait close-ups', async () => {
      process.env.GEMINI_API_KEY = 'TEST_GEMINI_KEY';

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: 'SELFIE_PERSON',
                    confidence: 0.97,
                    description: 'Selfie en primer plano de una persona sonriendo.',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const buffer = Buffer.from('FAKE_SELFIE_IMAGE');
      const result = await service.validateFacade(buffer, 'image/jpeg');

      expect(result.isValid).toBe(false);
      expect(result.category).toBe('SELFIE_PERSON');
      expect(result.status).toBe('REJECTED');
      expect(result.reason).toBe('La imagen es un retrato personal. Por favor capture la fachada exterior.');
    });

    it('sad path: rejects random objects or vehicles (OTHER category)', async () => {
      process.env.GEMINI_API_KEY = 'TEST_GEMINI_KEY';

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    category: 'OTHER',
                    confidence: 0.92,
                    description: 'Fotografía de un automóvil estacionado en la vía pública.',
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const buffer = Buffer.from('FAKE_CAR_IMAGE');
      const result = await service.validateFacade(buffer, 'image/jpeg');

      expect(result.isValid).toBe(false);
      expect(result.category).toBe('OTHER');
      expect(result.status).toBe('REJECTED');
      expect(result.reason).toBe('La imagen no muestra la fachada exterior de un establecimiento comercial.');
    });

    it('sad path: throws BadRequestException when fileBuffer is null, undefined, or empty (§6)', async () => {
      await expect(service.validateFacade(null as any, 'image/jpeg')).rejects.toThrow(BadRequestException);
      await expect(service.validateFacade(undefined as any, 'image/jpeg')).rejects.toThrow(BadRequestException);
      await expect(service.validateFacade(Buffer.alloc(0), 'image/jpeg')).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateFacade - Offline-First Resilience (§45)', () => {
    it('degrades to PENDING_AUDIT when GEMINI_API_KEY and GOOGLE_API_KEY are missing (§45)', async () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      const buffer = Buffer.from('SOME_IMAGE');
      const result = await service.validateFacade(buffer, 'image/jpeg');

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING_AUDIT');
      expect(result.category).toBe('STOREFRONT');
      expect(result.reason).toContain('Proveedor de IA no disponible');
    });

    it('degrades to PENDING_AUDIT when external API returns HTTP error or network partition occurs (§45)', async () => {
      process.env.GEMINI_API_KEY = 'TEST_KEY';

      global.fetch = jest.fn().mockRejectedValue(new Error('Network connection timeout / partition'));

      const buffer = Buffer.from('SOME_IMAGE');
      const result = await service.validateFacade(buffer, 'image/jpeg');

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('PENDING_AUDIT');
      expect(result.reason).toContain('contingencia de red');
    });
  });

  describe('resolveBufferFromUrlOrPath', () => {
    it('resolves buffer and mimeType from valid base64 DataURL (Happy Path)', () => {
      const base64Data = Buffer.from('HELLO_IMAGE').toString('base64');
      const dataUrl = `data:image/png;base64,${base64Data}`;

      const res = service.resolveBufferFromUrlOrPath(dataUrl);
      expect(res.mimeType).toBe('image/png');
      expect(res.buffer.toString()).toBe('HELLO_IMAGE');
    });

    it('resolves buffer and mimeType from existing local file (Happy Path)', () => {
      const res = service.resolveBufferFromUrlOrPath(tempImagePath);
      expect(res.mimeType).toBe('image/jpeg');
      expect(res.buffer.toString()).toBe('FAKE_JPEG_IMAGE_BINARY_DATA');
    });

    it('sad path: throws BadRequestException when path does not exist', () => {
      expect(() => {
        service.resolveBufferFromUrlOrPath('/non/existent/path/facade_9999.jpg');
      }).toThrow(BadRequestException);
    });

    it('sad path: throws BadRequestException when DataURL is malformed', () => {
      expect(() => {
        service.resolveBufferFromUrlOrPath('data:invalid-format-without-base64');
      }).toThrow(BadRequestException);
    });

    it('sad path: throws BadRequestException when imageUrl is empty or null', () => {
      expect(() => {
        service.resolveBufferFromUrlOrPath('');
      }).toThrow(BadRequestException);
      expect(() => {
        service.resolveBufferFromUrlOrPath(null as any);
      }).toThrow(BadRequestException);
    });
  });
});

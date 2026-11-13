import { Test, TestingModule } from '@nestjs/testing';
import { CheckOcrService } from './check-ocr.service';

describe('CheckOcrService (§6 Unit Certification)', () => {
  let service: CheckOcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckOcrService],
    }).compile();

    service = module.get<CheckOcrService>(CheckOcrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Helper para generar un buffer JPEG simulado válido con contenido opcional
  function createFakeJpeg(content: string = ''): Buffer {
    const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const body = Buffer.from(content || 'Dummy Image Content with sufficient entropy 1234567890!@#$%^&*()_+');
    // Rellenar para garantizar > 64 bytes y varianza de bytes
    const padding = Buffer.alloc(Math.max(0, 100 - body.length));
    for (let i = 0; i < padding.length; i++) {
      padding[i] = (i * 37) % 256;
    }
    return Buffer.concat([header, body, padding]);
  }

  // Helper para generar un buffer PNG simulado válido
  function createFakePng(content: string = ''): Buffer {
    const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const body = Buffer.from(content || 'PNG Image Content with entropy');
    const padding = Buffer.alloc(Math.max(0, 80 - body.length));
    for (let i = 0; i < padding.length; i++) {
      padding[i] = (i * 23) % 256;
    }
    return Buffer.concat([header, body, padding]);
  }

  describe('Happy Path (§6)', () => {
    it('Happy Path: validates complete check photo with MICR line and matching amount', async () => {
      const checkText = 'PAY TO THE ORDER OF: Jhoanes Wholesale Corp\n' +
        'AMOUNT: $150.00\n' +
        'DOLLARS: One hundred fifty and 00/100\n' +
        'MEMO: Weekly wholesale supply\n' +
        '⑆123456789⑆ 9876543210⑈ 1048';

      const validBuffer = createFakeJpeg(checkText);

      const result = await service.validateCheckImage(validBuffer, 150.00);

      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(150.00);
      expect(result.checkNumber).toBe('1048');
      expect(result.routingNumber).toBe('123456789');
      expect(result.accountNumber).toBe('9876543210');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('Happy Path: validates PNG check image with standard formatting', async () => {
      const checkText = 'Check # 2050\n' +
        'Routing: 021000021\n' +
        'Account: 1122334455\n' +
        'Total: $340.50\n' +
        'Chase Bank';

      const validPng = createFakePng(checkText);
      const result = await service.validateCheckImage(validPng, 340.50);

      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(340.50);
      expect(result.checkNumber).toBe('2050');
      expect(result.routingNumber).toBe('021000021');
    });

    it('Happy Path: accepts valid check image without expectedAmount specified', async () => {
      const checkText = 'Check: 1099\nAmount: $75.25\nRouting: 123456789';
      const validBuffer = createFakeJpeg(checkText);

      const result = await service.validateCheckImage(validBuffer);

      expect(result.isValid).toBe(true);
      expect(result.amount).toBe(75.25);
      expect(result.checkNumber).toBe('1099');
    });
  });

  describe('Sad Paths (§6)', () => {
    it('Sad Path 1: rejects when image buffer is missing or empty', async () => {
      const resNull = await service.validateCheckImage(null as any);
      expect(resNull.isValid).toBe(false);
      expect(resNull.reason).toMatch(/falta la imagen/i);

      const resEmpty = await service.validateCheckImage(Buffer.alloc(0));
      expect(resEmpty.isValid).toBe(false);
      expect(resEmpty.reason).toMatch(/falta la imagen/i);
    });

    it('Sad Path 2: rejects when image buffer is too small or corrupt (< 64 bytes)', async () => {
      const tinyBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x01, 0x02]);
      const result = await service.validateCheckImage(tinyBuffer);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/demasiado pequeña|corrupto/i);
    });

    it('Sad Path 3: rejects when file signature is invalid (not JPEG/PNG/WebP/GIF)', async () => {
      const fakeTextFile = Buffer.alloc(120, 'This is a plain text file, definitely not an image format!');
      const result = await service.validateCheckImage(fakeTextFile);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/formato de imagen inválido/i);
    });

    it('Sad Path 4: rejects when check image is blurry or marked with blur indicator', async () => {
      const blurryCheck = createFakeJpeg('[BLUR] Blurry photo taken in motion 123456789');
      const result = await service.validateCheckImage(blurryCheck);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/borroso|ilegible/i);
    });

    it('Sad Path 5: rejects when check image is flat/homogeneous (zero entropy/blank)', async () => {
      // JPEG header + flat identical bytes
      const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const flatBytes = Buffer.alloc(100, 0x00);
      const blankImage = Buffer.concat([header, flatBytes]);

      const result = await service.validateCheckImage(blankImage);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/borroso|ilegible/i);
    });

    it('Sad Path 6: rejects on amount discrepancy between check OCR and order total', async () => {
      const checkText = 'Check # 5500\nAmount: $500.00\nRouting: 123456789\nAccount: 99887766';
      const validBuffer = createFakeJpeg(checkText);

      // Order total is $150.00, but check says $500.00
      const result = await service.validateCheckImage(validBuffer, 150.00);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/discrepancia de monto/i);
      expect(result.amount).toBe(500.00);
    });
  });
});

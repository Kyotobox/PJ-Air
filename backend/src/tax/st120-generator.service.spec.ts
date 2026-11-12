import { St120GeneratorService, OFFICIAL_VENDOR_NAME, OFFICIAL_VENDOR_ADDRESS } from './st120-generator.service';
import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';

describe('St120GeneratorService', () => {
  let service: St120GeneratorService;

  beforeEach(() => {
    service = new St120GeneratorService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateST120Pdf', () => {
    it('should generate a valid NYS DTF ST-120 PDF and write it physically to disk (Happy Path)', async () => {
      const result = await service.generateST120Pdf({
        userId: 'user-unit-test-123',
        legalBusinessName: 'Brooklyn Artisan Cafe LLC',
        dba: 'Artisan Cafe',
        businessAddress: '123 Flatbush Ave, Brooklyn, NY 11217',
        taxId: '12-3456789',
        ein: '98-7654321',
        signerName: 'Jane Doe',
        signerTitle: 'Managing Partner',
        signatureText: 'Jane Doe',
        acceptedAt: new Date('2026-11-12T04:00:00Z'),
        ipAddress: '192.168.1.10',
      });

      expect(result).toBeDefined();
      expect(result.relativeUrl).toMatch(/^\/uploads\/st120\/st120-user-unit-test-123-.+\.pdf$/);
      expect(result.auditHash).toHaveLength(64); // SHA-256 hex string
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(1000);

      // Verify physical existence on disk (§1 Protocolo de Veracidad Física)
      expect(fs.existsSync(result.filePath)).toBe(true);

      // Read back with pdf-lib to verify valid PDF structure
      const parsedDoc = await PDFDocument.load(result.buffer);
      expect(parsedDoc.getPageCount()).toBe(1);

      // Cleanup generated file
      try {
        fs.unlinkSync(result.filePath);
      } catch (_) {
        // ignore
      }
    });

    it('should handle optional and fallback fields gracefully', async () => {
      const result = await service.generateST120Pdf({
        legalBusinessName: 'Queens Diner Corp',
        businessAddress: '78-14 Roosevelt Ave, Jackson Heights, NY',
        signerName: 'John Smith',
      });

      expect(result).toBeDefined();
      expect(result.relativeUrl).toMatch(/^\/uploads\/st120\/st120-client-.+\.pdf$/);
      expect(result.auditHash).toHaveLength(64);
      expect(fs.existsSync(result.filePath)).toBe(true);

      try {
        fs.unlinkSync(result.filePath);
      } catch (_) {
        // ignore
      }
    });
  });
});

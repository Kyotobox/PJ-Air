import { Test, TestingModule } from '@nestjs/testing';
import { ExcelService } from './excel.service';
import { Order } from './order.entity';
import * as ExcelJS from 'exceljs';

describe('ExcelService', () => {
  let service: ExcelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelService],
    }).compile();

    service = module.get<ExcelService>(ExcelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportIndividual', () => {
    it('should prioritize nickname over full_name and email in sheet name', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          user: {
            email: 'client@test.com',
            profile: {
              full_name: 'John Doe',
              nickname: 'JD-Store',
            },
          },
          items: [
            {
              product: {
                name: 'Product A',
                category: { name: 'Category A' },
              },
              quantity: 5,
              price_at_time: 10,
            },
          ],
        } as unknown as Order,
      ];

      const buffer = await service.exportIndividual(mockOrders);
      expect(buffer).toBeDefined();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      // Sheet name should be based on nickname
      const sheet = workbook.getWorksheet('JD-Store');
      expect(sheet).toBeDefined();

      // The sheet should not be named after full_name or email
      expect(workbook.getWorksheet('John Doe')).toBeUndefined();
      expect(workbook.getWorksheet('client@test.com')).toBeUndefined();
    });

    it('should include FECHA DE DESPACHO / ENTREGA and FECHA DE REGISTRO / PEDIDO in headers', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          delivery_date: '2026-11-10',
          created_at: new Date('2026-11-04T10:00:00Z'),
          user: {
            profile: {
              nickname: 'Client-1',
            },
          },
          items: [],
        } as unknown as Order,
      ];

      const buffer = await service.exportIndividual(mockOrders);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet = workbook.getWorksheet('Client-1');
      expect(sheet).toBeDefined();

      const rows: string[][] = [];
      sheet?.eachRow((row) => {
        rows.push(row.values as string[]);
      });

      const hasDispatchHeader = rows.some(
        (r) => Array.isArray(r) && r.some((c) => String(c).includes('FECHA DE DESPACHO / ENTREGA:')),
      );
      const hasCreatedHeader = rows.some(
        (r) => Array.isArray(r) && r.some((c) => String(c).includes('FECHA DE REGISTRO / PEDIDO:')),
      );

      expect(hasDispatchHeader).toBe(true);
      expect(hasCreatedHeader).toBe(true);
    });

    it('should handle orders with missing dates gracefully (sad path fallback)', async () => {
      const mockOrders = [
        {
          id: 'order-no-dates',
          delivery_date: null,
          created_at: null,
          user: {
            profile: {
              nickname: 'Client-NoDates',
            },
          },
          items: [],
        } as unknown as Order,
      ];

      const buffer = await service.exportIndividual(mockOrders);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet = workbook.getWorksheet('Client-NoDates');
      expect(sheet).toBeDefined();
    });
  });

  describe('exportConsolidated', () => {
    it('should include dispatch range notice in consolidated worksheets', async () => {
      const mockOrders = [
        {
          id: 'order-c1',
          user: {
            profile: {
              nickname: 'Client-Alpha',
            },
          },
          items: [
            {
              product: {
                name: 'Croissant',
                category: { name: 'Panadería' },
              },
              quantity: 12,
            },
          ],
        } as unknown as Order,
      ];

      const buffer = await service.exportConsolidated(mockOrders);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet = workbook.getWorksheet('PANADERÍA');
      expect(sheet).toBeDefined();

      const rows: string[][] = [];
      sheet?.eachRow((row) => {
        rows.push(row.values as string[]);
      });

      const hasRangeNotice = rows.some(
        (r) => Array.isArray(r) && r.some((c) => String(c).includes('Cantidades correspondientes a los despachos del rango seleccionado')),
      );

      expect(hasRangeNotice).toBe(true);
    });
  });

  describe('exportAccounting', () => {
    it('should generate an accounting workbook buffer with valid orders and items (happy path)', async () => {
      const mockOrders = [
        {
          id: 'ord-12345678-abcd',
          created_at: new Date('2026-11-01T10:00:00Z'),
          delivery_date: '2026-11-02',
          payment_method: 'credit',
          payment_status: 'paid',
          tax_exempt: true,
          total: 150.0,
          delivery_fee_charged: 10.0,
          tax_amount: 0,
          pending_balance: 0,
          notes: 'Entregar antes de las 8am',
          user: {
            legal_business_name: 'Café de Colombia LLC',
            dba: 'Café Colombia',
            ein: '12-3456789',
            email: 'admin@cafecolombia.com',
            profile: {
              full_name: 'Carlos Ruiz',
              nickname: 'Carlos Cafe',
            },
          },
          items: [
            {
              quantity: 10,
              price_at_time: 14.0,
              product: {
                name: 'Pan de Bono',
                category: { name: 'Panadería Tradicional' },
              },
            },
          ],
        } as unknown as Order,
      ];

      const buffer = await service.exportAccounting(mockOrders);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      // Verify Hoja 1: Facturas y Cobros
      const sheet1 = workbook.getWorksheet('Facturas y Cobros');
      expect(sheet1).toBeDefined();

      const sheet1Rows: any[][] = [];
      sheet1?.eachRow((row) => {
        sheet1Rows.push(row.values as any[]);
      });

      // Verify headers exist
      const hasInvoiceHeader = sheet1Rows.some(
        (r) => Array.isArray(r) && r.includes('Factura #'),
      );
      expect(hasInvoiceHeader).toBe(true);

      // Verify client and mapping
      const hasClient = sheet1Rows.some(
        (r) => Array.isArray(r) && r.includes('Café de Colombia LLC'),
      );
      expect(hasClient).toBe(true);

      const hasCreditNet15 = sheet1Rows.some(
        (r) => Array.isArray(r) && r.includes('Crédito Net 15'),
      );
      expect(hasCreditNet15).toBe(true);

      const hasPaid = sheet1Rows.some(
        (r) => Array.isArray(r) && r.includes('PAGADO'),
      );
      expect(hasPaid).toBe(true);

      const hasTaxExempt = sheet1Rows.some(
        (r) => Array.isArray(r) && r.includes('EXENTO (ST-120)'),
      );
      expect(hasTaxExempt).toBe(true);

      // Verify Totales row exists
      const hasTotalsRow = sheet1Rows.some(
        (r) => Array.isArray(r) && r.includes('TOTALES'),
      );
      expect(hasTotalsRow).toBe(true);

      // Verify Hoja 2: Desglose de Productos
      const sheet2 = workbook.getWorksheet('Desglose de Productos');
      expect(sheet2).toBeDefined();

      const sheet2Rows: any[][] = [];
      sheet2?.eachRow((row) => {
        sheet2Rows.push(row.values as any[]);
      });

      const hasItemHeader = sheet2Rows.some(
        (r) => Array.isArray(r) && r.includes('Producto'),
      );
      expect(hasItemHeader).toBe(true);

      const hasProductName = sheet2Rows.some(
        (r) => Array.isArray(r) && r.includes('Pan de Bono'),
      );
      expect(hasProductName).toBe(true);

      const hasTotalGeneral = sheet2Rows.some(
        (r) => Array.isArray(r) && r.includes('TOTAL GENERAL'),
      );
      expect(hasTotalGeneral).toBe(true);
    });

    it('should handle empty orders array gracefully without errors (sad path)', async () => {
      const buffer = await service.exportAccounting([]);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet1 = workbook.getWorksheet('Facturas y Cobros');
      expect(sheet1).toBeDefined();

      const sheet2 = workbook.getWorksheet('Desglose de Productos');
      expect(sheet2).toBeDefined();

      const sheet1Rows: any[][] = [];
      sheet1?.eachRow((row) => {
        sheet1Rows.push(row.values as any[]);
      });

      const hasEmptyNotice = sheet1Rows.some(
        (r) => Array.isArray(r) && r.some((c) => String(c).includes('No hay facturas')),
      );
      expect(hasEmptyNotice).toBe(true);
    });

    it('should handle orders with missing optional fields without throwing (sad path boundary)', async () => {
      const mockOrders = [
        {
          id: 'ord-incomplete',
          total: null,
          items: null,
          user: null,
          created_at: null,
          delivery_date: null,
          payment_method: null,
          payment_status: null,
        } as unknown as Order,
      ];

      const buffer = await service.exportAccounting(mockOrders);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet1 = workbook.getWorksheet('Facturas y Cobros');
      expect(sheet1).toBeDefined();

      const sheet2 = workbook.getWorksheet('Desglose de Productos');
      expect(sheet2).toBeDefined();
    });
  });
});

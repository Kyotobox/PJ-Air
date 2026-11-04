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
});

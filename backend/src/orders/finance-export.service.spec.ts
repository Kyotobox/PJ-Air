import { Test, TestingModule } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { FinanceExportService } from './finance-export.service';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';

describe('FinanceExportService (TASK-97-04 / Sprint S97B)', () => {
  let service: FinanceExportService;
  let ordersService: OrdersService;

  const mockOrdersService = {
    findInRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceExportService,
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    service = module.get<FinanceExportService>(FinanceExportService);
    ordersService = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportTaxAndSalesLedger - Happy Paths', () => {
    it('generates an Excel workbook with all 15 required canonical columns', async () => {
      const mockOrders: Partial<Order>[] = [
        {
          id: 'ord-uuid-001',
          invoice_number: 'INV-2026-0001',
          created_at: new Date('2026-11-10T14:00:00Z'),
          total: 215.0,
          tax_amount: 0.0,
          tax_exempt: true,
          tax_rate: 0.0,
          store_credit_applied: 20.0,
          delivery_fee_charged: 15.0,
          packaging_discount: 5.0,
          payment_method: 'zelle',
          payment_status: 'paid',
          zelle_reference: 'ZEL-9948271',
          user: {
            email: 'panaderia@queens.com',
            account_type: 'cash',
            st120_status: 'APPROVED',
            tax_exempt: true,
            dba: 'Queens Bakery Cafe',
            profile: {
              nickname: 'Queens Bakery',
              full_name: 'Maria Gomez',
            },
          } as any,
          items: [
            {
              quantity: 10,
              price_at_time: 20.0,
              product: { name: 'Croissant Mantequilla' },
            } as any,
          ],
        },
      ];

      mockOrdersService.findInRange.mockResolvedValue(mockOrders);

      const buffer = await service.exportTaxAndSalesLedger('2026-11-01', '2026-11-17');
      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Libro de Ventas y Tax NY');
      expect(worksheet).toBeDefined();

      const expectedHeaders = [
        'Fecha',
        'Invoice #',
        'Cliente (Nombre Comercial)',
        'Tipo de Cuenta (Cash/Credit)',
        'Subtotal Bruto',
        'Descuentos',
        'Delivery Fee Charged',
        'Base Gravable',
        'Sales Tax NY Recaudado',
        'ST-120 Exención (Sí/No)',
        'Store Credit Aplicado',
        'Total Facturado',
        'Método de Pago',
        'Estado de Pago',
        'Referencia Zelle / Cheque #',
      ];

      const headerRow = worksheet!.getRow(1);
      expect(headerRow.cellCount).toBe(15);
      expectedHeaders.forEach((expectedHeader, index) => {
        expect(headerRow.getCell(index + 1).value).toBe(expectedHeader);
      });
    });

    it('correctly calculates totals, sales tax and base gravable across exempt and non-exempt orders', async () => {
      const mockOrders: Partial<Order>[] = [
        // Order 1: ST-120 Exempt
        {
          id: 'ord-uuid-101',
          invoice_number: 'INV-1001',
          created_at: new Date('2026-11-05T10:00:00Z'),
          total: 200.0,
          tax_amount: 0.0,
          tax_exempt: true,
          tax_rate: 0.0,
          store_credit_applied: 25.0,
          delivery_fee_charged: 10.0,
          global_discount_amount: 10.0,
          payment_method: 'credit',
          payment_status: 'paid',
          user: {
            email: 'exempt@store.com',
            account_type: 'credit',
            tax_exempt: true,
            st120_status: 'APPROVED',
            dba: 'Exempt Gourmet Store',
          } as any,
          items: [
            { quantity: 20, price_at_time: 10.0 } as any, // subtotal = 200.00
          ],
        },
        // Order 2: Taxable (Non-exempt NY Sales Tax 8.875%)
        {
          id: 'ord-uuid-102',
          invoice_number: 'INV-1002',
          created_at: new Date('2026-11-06T15:30:00Z'),
          total: 108.88,
          tax_amount: 8.88,
          tax_exempt: false,
          tax_rate: 8.875,
          store_credit_applied: 0.0,
          delivery_fee_charged: 0.0,
          global_discount_amount: 0.0,
          payment_method: 'check',
          payment_status: 'paid',
          check_number: 'CHK-4491',
          user: {
            email: 'taxable@cafe.com',
            account_type: 'cash',
            tax_exempt: false,
            st120_status: 'NONE',
            profile: { nickname: 'Downtown Deli' },
          } as any,
          items: [
            { quantity: 10, price_at_time: 10.0 } as any, // subtotal = 100.00
          ],
        },
      ];

      mockOrdersService.findInRange.mockResolvedValue(mockOrders);

      const buffer = await service.exportTaxAndSalesLedger('2026-11-01', '2026-11-10');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Libro de Ventas y Tax NY')!;

      // Row 2: Order 1 (Exempt)
      const row1 = worksheet.getRow(2);
      expect(row1.getCell(2).value).toBe('INV-1001');
      expect(row1.getCell(3).value).toBe('Exempt Gourmet Store');
      expect(row1.getCell(4).value).toBe('Credit');
      expect(row1.getCell(5).value).toBe(200.0); // Subtotal Bruto
      expect(row1.getCell(6).value).toBe(10.0);  // Descuento
      expect(row1.getCell(7).value).toBe(10.0);  // Delivery Fee
      expect(row1.getCell(8).value).toBe(0.0);   // Base Gravable (0 for ST-120 exempt)
      expect(row1.getCell(9).value).toBe(0.0);   // Tax Recaudado
      expect(row1.getCell(10).value).toBe('Sí'); // ST-120 Exención
      expect(row1.getCell(11).value).toBe(25.0); // Store Credit Aplicado
      expect(row1.getCell(12).value).toBe(200.0);// Total Facturado

      // Row 3: Order 2 (Taxable)
      const row2 = worksheet.getRow(3);
      expect(row2.getCell(2).value).toBe('INV-1002');
      expect(row2.getCell(3).value).toBe('Downtown Deli');
      expect(row2.getCell(4).value).toBe('Cash');
      expect(row2.getCell(5).value).toBe(100.0); // Subtotal Bruto
      expect(row2.getCell(8).value).toBe(100.06); // Base Gravable: 8.88 / 0.08875 ~ 100.06
      expect(row2.getCell(9).value).toBe(8.88);  // Sales Tax NY
      expect(row2.getCell(10).value).toBe('No'); // ST-120 Exención
      expect(row2.getCell(15).value).toBe('CHK-4491'); // Referencia Cheque #

      // Row 4: Totals Row
      const totalsRow = worksheet.getRow(4);
      expect(totalsRow.getCell(1).value).toBe('TOTALES');
      expect(totalsRow.getCell(5).value).toBe(300.0); // Subtotal Bruto Total: 200 + 100
      expect(totalsRow.getCell(6).value).toBe(10.0);  // Total Descuentos: 10 + 0
      expect(totalsRow.getCell(7).value).toBe(10.0);  // Total Delivery Fee: 10 + 0
      expect(totalsRow.getCell(8).value).toBe(100.06); // Total Base Gravable: 0 + 100.06
      expect(totalsRow.getCell(9).value).toBe(8.88);  // Total Sales Tax NY: 0 + 8.88
      expect(totalsRow.getCell(11).value).toBe(25.0); // Total Store Credit: 25 + 0
      expect(totalsRow.getCell(12).value).toBe(308.88); // Total Facturado: 200 + 108.88
    });

    it('generates a clean empty sheet with zero totals when no orders exist in range', async () => {
      mockOrdersService.findInRange.mockResolvedValue([]);

      const buffer = await service.exportTaxAndSalesLedger('2026-12-01', '2026-12-31');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Libro de Ventas y Tax NY')!;

      // Row 1: Headers
      expect(worksheet.getRow(1).getCell(1).value).toBe('Fecha');
      // Row 2: Empty notice
      expect(worksheet.getRow(2).getCell(1).value).toContain('No se registraron transacciones fiscales');
      // Row 3: Totals row with 0s
      const totalsRow = worksheet.getRow(3);
      expect(totalsRow.getCell(1).value).toBe('TOTALES');
      expect(totalsRow.getCell(5).value).toBe(0);
      expect(totalsRow.getCell(9).value).toBe(0);
      expect(totalsRow.getCell(12).value).toBe(0);
    });
  });

  describe('Sad Paths (§6)', () => {
    it('gracefully handles orders with missing/null dates and undefined fields without corrupting output', async () => {
      const corruptOrders: Partial<Order>[] = [
        {
          id: 'ord-corrupt-001',
          created_at: undefined,
          delivery_date: undefined,
          total: undefined,
          tax_amount: undefined,
          user: undefined,
          items: undefined,
        },
      ];

      mockOrdersService.findInRange.mockResolvedValue(corruptOrders);

      const buffer = await service.exportTaxAndSalesLedger('2026-01-01', '2026-01-02');
      expect(buffer).toBeDefined();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Libro de Ventas y Tax NY')!;
      
      const row = worksheet.getRow(2);
      expect(row.getCell(1).value).toBe('');
      expect(row.getCell(3).value).toBe('Anónimo');
      expect(row.getCell(4).value).toBe('Cash');
      expect(row.getCell(5).value).toBe(0);
      expect(row.getCell(9).value).toBe(0);
      expect(row.getCell(15).value).toBe('N/A');
    });

    it('propagates exception when ordersService.findInRange fails (§6)', async () => {
      mockOrdersService.findInRange.mockRejectedValue(new Error('Database connection failed during report query'));

      await expect(service.exportTaxAndSalesLedger('2026-01-01', '2026-01-02'))
        .rejects.toThrow('Database connection failed during report query');
    });
  });
});

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
  });
});

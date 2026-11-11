import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FinancialReportsCron } from './financial-reports.cron';
import { Order } from '../orders/order.entity';
import { ExcelService } from '../orders/excel.service';
import { MailService } from '../mail/mail.service';
import { SystemConfigsService } from '../system-configs/system-configs.service';

describe('FinancialReportsCron', () => {
  let cron: FinancialReportsCron;
  let mockOrderRepository: any;
  let mockExcelService: any;
  let mockMailService: any;
  let mockSystemConfigsService: any;

  beforeEach(async () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 'order-cron-1', total: 250, payment_method: 'stripe', payment_status: 'paid', status: 'approved' },
        { id: 'order-cron-2', total: 400, payment_method: 'zelle', payment_status: 'paid', status: 'delivered' },
      ]),
    };

    mockOrderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockExcelService = {
      exportConsolidated: jest.fn().mockResolvedValue(Buffer.from('MOCK_EXCEL_BUFFER')),
    };

    mockMailService = {
      sendFinancialReport: jest.fn().mockResolvedValue(true),
    };

    mockSystemConfigsService = {
      get: jest.fn().mockResolvedValue('accounting@jhoanes.com, cfo@jhoanes.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportsCron,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
        { provide: ExcelService, useValue: mockExcelService },
        { provide: MailService, useValue: mockMailService },
        { provide: SystemConfigsService, useValue: mockSystemConfigsService },
      ],
    }).compile();

    cron = module.get<FinancialReportsCron>(FinancialReportsCron);
  });

  it('should be defined', () => {
    expect(cron).toBeDefined();
  });

  it('should execute daily financial report dispatch successfully (happy path)', async () => {
    const result = await cron.handleDailyFinancialReportDispatch('2026-11-01');

    expect(result.sent).toBe(true);
    expect(result.reportDate).toBe('2026-11-01');
    expect(result.ordersCount).toBe(2);
    expect(result.recipients).toEqual(['accounting@jhoanes.com', 'cfo@jhoanes.com']);
    expect(mockExcelService.exportConsolidated).toHaveBeenCalled();
    expect(mockMailService.sendFinancialReport).toHaveBeenCalledWith(
      ['accounting@jhoanes.com', 'cfo@jhoanes.com'],
      '2026-11-01',
      expect.any(Buffer),
    );
    expect(mockOrderRepository.createQueryBuilder().andWhere).toHaveBeenCalledWith(
      'order.status NOT IN (:...cancelled)',
      { cancelled: ['cancelled', 'Cancelado'] },
    );
  });

  it('should exclude cancelled orders from financial reports query and process only active orders (happy path)', async () => {
    const qb = mockOrderRepository.createQueryBuilder();
    const result = await cron.handleDailyFinancialReportDispatch('2026-11-01');

    expect(qb.andWhere).toHaveBeenCalledWith(
      'order.status NOT IN (:...cancelled)',
      { cancelled: ['cancelled', 'Cancelado'] },
    );
    expect(result.ordersCount).toBe(2);
  });

  it('should fallback to default email if config contains empty or invalid emails (happy path fallback)', async () => {
    mockSystemConfigsService.get.mockResolvedValue(' , , ');

    const result = await cron.handleDailyFinancialReportDispatch('2026-11-01');

    expect(result.sent).toBe(true);
    expect(result.recipients).toEqual(['accounting@jhoanes.com']);
  });

  it('should return sent: false when mail service fails to dispatch email (sad path §6)', async () => {
    mockMailService.sendFinancialReport.mockResolvedValue(false);

    const result = await cron.handleDailyFinancialReportDispatch('2026-11-01');

    expect(result.sent).toBe(false);
    expect(result.ordersCount).toBe(2);
  });

  it('should throw error if query builder throws an internal database failure (sad path §6)', async () => {
    const brokenQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockRejectedValue(new Error('Database disk I/O error')),
    };
    mockOrderRepository.createQueryBuilder.mockReturnValue(brokenQueryBuilder);

    await expect(cron.handleDailyFinancialReportDispatch('2026-11-01')).rejects.toThrow('Database disk I/O error');
  });

  it('should throw error if query builder andWhere throws an exclusion syntax error (sad path §6)', async () => {
    const brokenAndWhereQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockImplementation(() => {
        throw new Error('SQL syntax error in NOT IN clause');
      }),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockOrderRepository.createQueryBuilder.mockReturnValue(brokenAndWhereQb);

    await expect(cron.handleDailyFinancialReportDispatch('2026-11-01')).rejects.toThrow('SQL syntax error in NOT IN clause');
  });
});

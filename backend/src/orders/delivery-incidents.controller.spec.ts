import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryIncidentsController } from './delivery-incidents.controller';
import { DeliveryIncidentsService } from './delivery-incidents.service';

describe('DeliveryIncidentsController', () => {
  let controller: DeliveryIncidentsController;
  let service: jest.Mocked<DeliveryIncidentsService>;

  beforeEach(async () => {
    const mockService = {
      createIncident: jest.fn(),
      approveIncident: jest.fn(),
      findByOrder: jest.fn(),
      findByUser: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveryIncidentsController],
      providers: [
        {
          provide: DeliveryIncidentsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DeliveryIncidentsController>(DeliveryIncidentsController);
    service = module.get(DeliveryIncidentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reportIncident (POST /orders/:id/incidents)', () => {
    it('should delegate to service.createIncident with order_id and user context', async () => {
      const dto = {
        product_id: 101,
        quantity: 2,
        reason_category: 'missing_kitchen',
        description: 'Faltante en cocina',
      };
      const req = { user: { id: 'client-1', role: 'client' } };
      const expectedResult = { id: 'incident-1', ...dto, order_id: 'order-123' };

      service.createIncident.mockResolvedValue(expectedResult as any);

      const result = await controller.reportIncident('order-123', dto as any, req);

      expect(service.createIncident).toHaveBeenCalledWith(
        {
          ...dto,
          order_id: 'order-123',
        },
        req.user,
      );
      expect(result).toBe(expectedResult);
    });
  });

  describe('approveIncident (PATCH /orders/incidents/:id/approve)', () => {
    it('should delegate to service.approveIncident with incidentId and admin ID', async () => {
      const req = { user: { id: 'admin-1', role: 'admin' } };
      const expectedResult = { id: 'incident-1', status: 'approved', reviewed_by: 'admin-1' };

      service.approveIncident.mockResolvedValue(expectedResult as any);

      const result = await controller.approveIncident('incident-1', req);

      expect(service.approveIncident).toHaveBeenCalledWith('incident-1', 'admin-1');
      expect(result).toBe(expectedResult);
    });
  });

  describe('getIncidentsByOrder (GET /orders/:id/incidents)', () => {
    it('should delegate to service.findByOrder with orderId and user context', async () => {
      const req = { user: { id: 'client-1', role: 'client' } };
      const expectedIncidents = [{ id: 'incident-1', order_id: 'order-123' }];

      service.findByOrder.mockResolvedValue(expectedIncidents as any);

      const result = await controller.getIncidentsByOrder('order-123', req);

      expect(service.findByOrder).toHaveBeenCalledWith('order-123', req.user);
      expect(result).toBe(expectedIncidents);
    });
  });
});

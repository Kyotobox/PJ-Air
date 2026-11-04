import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { BadRequestException } from '@nestjs/common';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockPaymentsService: any;
  let mockStripeService: any;

  beforeEach(async () => {
    mockPaymentsService = {
      createPaymentIntent: jest.fn(),
      createSetupIntent: jest.fn(),
      getOrCreateCustomer: jest.fn(),
      getPaymentMethods: jest.fn(),
      deletePaymentMethod: jest.fn(),
      createCustomerPortalSession: jest.fn(),
      createSettlementLink: jest.fn(),
      createRefund: jest.fn(),
      handleWebhook: jest.fn(),
    };

    mockStripeService = {
      createSetupIntent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: StripeService, useValue: mockStripeService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /payments/create-setup-intent', () => {
    it('should call stripeService.createSetupIntent with customerId, ein, and terms_version', async () => {
      mockStripeService.createSetupIntent.mockResolvedValue({
        client_secret: 'seti_test_secret_123',
        clientSecret: 'seti_test_secret_123',
        id: 'seti_test_123',
        customerId: 'cus_wholesale_1',
      });

      const body = {
        customerId: 'cus_wholesale_1',
        ein: '12-3456789',
        terms_version: 'v2026.10.29',
      };
      const req = { user: { id: 'user-1' } };

      const result = await controller.createSetupIntentWholesale(body, req);

      expect(mockStripeService.createSetupIntent).toHaveBeenCalledWith({
        customerId: 'cus_wholesale_1',
        userId: 'user-1',
        ein: '12-3456789',
        terms_version: 'v2026.10.29',
        metadata: undefined,
      });
      expect(result.client_secret).toBe('seti_test_secret_123');
    });

    it('should resolve customerId from paymentsService if customerId is not in body but user is logged in', async () => {
      mockPaymentsService.getOrCreateCustomer.mockResolvedValue({ id: 'cus_resolved_from_user' });
      mockStripeService.createSetupIntent.mockResolvedValue({
        client_secret: 'seti_resolved_secret',
        clientSecret: 'seti_resolved_secret',
        id: 'seti_resolved',
        customerId: 'cus_resolved_from_user',
      });

      const body = {
        ein: '99-8887776',
      };
      const req = { user: { id: 'user-logged-in' } };

      const result = await controller.createSetupIntentWholesale(body, req);

      expect(mockPaymentsService.getOrCreateCustomer).toHaveBeenCalledWith('user-logged-in');
      expect(mockStripeService.createSetupIntent).toHaveBeenCalledWith({
        customerId: 'cus_resolved_from_user',
        userId: 'user-logged-in',
        ein: '99-8887776',
        terms_version: undefined,
        metadata: undefined,
      });
      expect(result.client_secret).toBe('seti_resolved_secret');
    });

    it('should propagate BadRequestException if stripeService throws (sad path)', async () => {
      mockStripeService.createSetupIntent.mockRejectedValue(
        new BadRequestException('Customer ID is required to create a SetupIntent'),
      );

      await expect(
        controller.createSetupIntentWholesale({}, { user: undefined }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

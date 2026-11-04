import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { StripeService, PaymentGatewayException } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;
  let mockStripe: any;

  beforeEach(async () => {
    mockStripe = {
      setupIntents: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService],
    }).compile();

    service = module.get<StripeService>(StripeService);
    service.setStripeClient(mockStripe);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSetupIntent - Happy Path', () => {
    it('should generate SetupIntent with valid client_secret and B2B audit metadata', async () => {
      mockStripe.setupIntents.create.mockResolvedValue({
        id: 'seti_test_123',
        client_secret: 'seti_test_123_secret_abc456',
        customer: 'cus_wholesale_888',
      });

      const result = await service.createSetupIntent({
        customerId: 'cus_wholesale_888',
        userId: 'user-uuid-123',
        ein: '12-3456789',
        terms_version: 'v2026.10.29',
      });

      expect(result).toBeDefined();
      expect(result.client_secret).toBe('seti_test_123_secret_abc456');
      expect(result.clientSecret).toBe('seti_test_123_secret_abc456');
      expect(result.id).toBe('seti_test_123');
      expect(result.customerId).toBe('cus_wholesale_888');

      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith({
        customer: 'cus_wholesale_888',
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          source: 'b2b_wholesale_onboarding',
          ein: '12-3456789',
          terms_version: 'v2026.10.29',
          userId: 'user-uuid-123',
        },
      });
    });

    it('should accept customerId as string with optional arguments and defaults', async () => {
      mockStripe.setupIntents.create.mockResolvedValue({
        id: 'seti_test_string_id',
        client_secret: 'seti_string_secret_xyz',
      });

      const result = await service.createSetupIntent('cus_wholesale_999', {
        ein: '98-7654321',
      });

      expect(result.client_secret).toBe('seti_string_secret_xyz');
      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_wholesale_999',
          metadata: expect.objectContaining({
            source: 'b2b_wholesale_onboarding',
            ein: '98-7654321',
            terms_version: 'v2026.10.29',
          }),
        }),
      );
    });
  });

  describe('createSetupIntent - Sad Paths', () => {
    it('should throw BadRequestException when customer ID is missing or empty', async () => {
      await expect(service.createSetupIntent({ customerId: '' })).rejects.toThrow(BadRequestException);
      await expect(service.createSetupIntent({ customerId: '   ' })).rejects.toThrow(BadRequestException);
      await expect(service.createSetupIntent({} as any)).rejects.toThrow(BadRequestException);
      await expect(service.createSetupIntent('')).rejects.toThrow(BadRequestException);
      expect(mockStripe.setupIntents.create).not.toHaveBeenCalled();
    });

    it('should throw PaymentGatewayException / BadRequestException when Stripe call fails', async () => {
      mockStripe.setupIntents.create.mockRejectedValue(
        new Error('Stripe API error: Network failure or invalid customer'),
      );

      await expect(
        service.createSetupIntent({
          customerId: 'cus_invalid_123',
          ein: '12-3456789',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createSetupIntent({
          customerId: 'cus_invalid_123',
        }),
      ).rejects.toThrow(PaymentGatewayException);
    });

    it('should throw PaymentGatewayException if Stripe returns missing client_secret', async () => {
      mockStripe.setupIntents.create.mockResolvedValue({
        id: 'seti_corrupt',
        client_secret: null,
      });

      await expect(
        service.createSetupIntent({
          customerId: 'cus_corrupt_123',
        }),
      ).rejects.toThrow(PaymentGatewayException);
    });

    it('should throw PaymentGatewayException when Stripe client is not initialized', async () => {
      service.setStripeClient(null);

      await expect(
        service.createSetupIntent({
          customerId: 'cus_no_stripe',
        }),
      ).rejects.toThrow(PaymentGatewayException);
    });
  });
});

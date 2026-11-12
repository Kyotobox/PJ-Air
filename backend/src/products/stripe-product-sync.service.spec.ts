import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeProductSyncService } from './stripe-product-sync.service';
import { Product } from './product.entity';
import { StripeService } from '../payments/stripe.service';

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'Test Product',
  price: 10.5,
  description: 'A test product',
  image: null,
  is_deleted: false,
  category: null,
  stripe_product_id: null,
  stripe_price_id: null,
  ...overrides,
} as Product);

const makeStripeMock = (overrides: Record<string, any> = {}) => ({
  products: {
    create: jest.fn().mockResolvedValue({ id: 'prod_new123' }),
    update: jest.fn().mockResolvedValue({}),
  },
  prices: {
    create: jest.fn().mockResolvedValue({ id: 'price_new456' }),
    retrieve: jest.fn().mockResolvedValue({ unit_amount: 1050 }),
    update: jest.fn().mockResolvedValue({}),
  },
  ...overrides,
});

describe('StripeProductSyncService', () => {
  let service: StripeProductSyncService;
  let productRepo: jest.Mocked<Repository<Product>>;
  let stripeService: jest.Mocked<StripeService>;
  let stripeMock: ReturnType<typeof makeStripeMock>;

  beforeEach(async () => {
    stripeMock = makeStripeMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeProductSyncService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            find: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: StripeService,
          useValue: {
            getStripeClient: jest.fn().mockReturnValue(stripeMock),
          },
        },
      ],
    }).compile();

    service = module.get<StripeProductSyncService>(StripeProductSyncService);
    productRepo = module.get(getRepositoryToken(Product));
    stripeService = module.get(StripeService);
  });

  describe('syncAll()', () => {
    it('HAPPY: nuevo producto → products.create + prices.create llamados, IDs guardados', async () => {
      const product = mockProduct();
      (productRepo.find as jest.Mock).mockResolvedValue([product]);

      const result = await service.syncAll();

      expect(stripeMock.products.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Product' }),
      );
      expect(stripeMock.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({ unit_amount: 1050, currency: 'usd' }),
      );
      expect(productRepo.update).toHaveBeenCalledWith(1, {
        stripe_product_id: 'prod_new123',
        stripe_price_id: 'price_new456',
      });
      expect(result.synced).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('HAPPY: producto existente mismo precio → no crea nueva Price', async () => {
      const product = mockProduct({
        stripe_product_id: 'prod_existing',
        stripe_price_id: 'price_existing',
      });
      (productRepo.find as jest.Mock).mockResolvedValue([product]);
      stripeMock.prices.retrieve.mockResolvedValue({ unit_amount: 1050 }); // mismo precio

      const result = await service.syncAll();

      expect(stripeMock.products.update).toHaveBeenCalledWith(
        'prod_existing',
        expect.objectContaining({ name: 'Test Product' }),
      );
      expect(stripeMock.prices.create).not.toHaveBeenCalled();
      expect(stripeMock.prices.update).not.toHaveBeenCalled();
      expect(result.synced).toBe(1);
    });

    it('HAPPY: producto existente con precio cambiado → price antigua desactivada, nueva creada', async () => {
      const product = mockProduct({
        stripe_product_id: 'prod_existing',
        stripe_price_id: 'price_old',
      });
      (productRepo.find as jest.Mock).mockResolvedValue([product]);
      stripeMock.prices.retrieve.mockResolvedValue({ unit_amount: 999 }); // precio diferente
      stripeMock.prices.create.mockResolvedValue({ id: 'price_new789' });

      const result = await service.syncAll();

      expect(stripeMock.prices.update).toHaveBeenCalledWith('price_old', { active: false });
      expect(stripeMock.prices.create).toHaveBeenCalled();
      expect(productRepo.update).toHaveBeenCalledWith(1, {
        stripe_product_id: 'prod_existing',
        stripe_price_id: 'price_new789',
      });
      expect(result.synced).toBe(1);
      expect(result.details[0].action).toBe('price_updated');
    });

    it('SAD: stripe.products.create lanza error → error aislado, synced=0, errors=1', async () => {
      const product = mockProduct();
      (productRepo.find as jest.Mock).mockResolvedValue([product]);
      stripeMock.products.create.mockRejectedValue(new Error('Stripe API error'));

      const result = await service.syncAll();

      expect(result.synced).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.details[0].action).toBe('error');
      expect(result.details[0].error).toBe('Stripe API error');
    });

    it('SAD: Stripe no inicializado → retorna vacío sin crash', async () => {
      (stripeService.getStripeClient as jest.Mock).mockReturnValue(null);

      const result = await service.syncAll();

      expect(result).toEqual({ synced: 0, skipped: 0, errors: 0, details: [] });
      expect(productRepo.find).not.toHaveBeenCalled();
    });
  });
});

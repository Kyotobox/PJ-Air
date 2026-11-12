import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StripeProductSyncService } from './stripe-product-sync.service';

/**
 * Unit Tests — ProductsController
 *
 * The service is fully mocked so we can verify that each controller
 * method correctly delegates to the service and forwards parameters.
 */
describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    findAll: jest.fn(),
    findByCategory: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateCategory: jest.fn(),
    processCSV: jest.fn(),
  };

  const mockStripeProductSyncService = {
    syncAll: jest.fn().mockResolvedValue({ synced: 0, skipped: 0, errors: 0, details: [] }),
    syncOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductsService },
        { provide: StripeProductSyncService, useValue: mockStripeProductSyncService },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // GET endpoints
  // -----------------------------------------------------------------------
  describe('findAll', () => {
    it('should return all products from the service', async () => {
      const products = [
        { id: 1, name: 'A', price: 10 },
        { id: 2, name: 'B', price: 20 },
      ];
      mockProductsService.findAll.mockResolvedValue(products);

      const result = await controller.findAll();

      expect(result).toEqual(products);
      expect(mockProductsService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByCategory', () => {
    it('should forward the category parameter to the service', async () => {
      const products = [{ id: 1, name: 'A', category: 'Electronics' }];
      mockProductsService.findByCategory.mockResolvedValue(products);

      const result = await controller.findByCategory('Electronics');

      expect(result).toEqual(products);
      expect(mockProductsService.findByCategory).toHaveBeenCalledWith('Electronics');
    });
  });

  describe('findOne', () => {
    it('should parse the id string to number and delegate to the service', async () => {
      const product = { id: 5, name: 'Widget' };
      mockProductsService.findOne.mockResolvedValue(product);

      const result = await controller.findOne('5');

      expect(result).toEqual(product);
      expect(mockProductsService.findOne).toHaveBeenCalledWith(5);
    });
  });

  // -----------------------------------------------------------------------
  // POST endpoints
  // -----------------------------------------------------------------------
  describe('create', () => {
    it('should forward the body to service.create', async () => {
      const dto = { name: 'New Product', price: 15.00 };
      mockProductsService.create.mockResolvedValue({ id: 1, ...dto });

      const result = await controller.create(dto);

      expect(result).toMatchObject(dto);
      expect(mockProductsService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('uploadImage', () => {
    it('should return the uploaded file URL', async () => {
      const file = {
        filename: 'abc123.jpg',
        originalname: 'photo.jpg',
      } as Express.Multer.File;

      const result = await controller.uploadImage(file);

      expect(result).toEqual({ url: '/uploads/products/abc123.jpg' });
    });

    it('should throw when no file is provided', async () => {
      await expect(
        controller.uploadImage(undefined as unknown as Express.Multer.File),
      ).rejects.toThrow('No file uploaded');
    });
  });

  describe('uploadProducts (bulk CSV upload)', () => {
    it('should call processCSV when a CSV file is present', async () => {
      mockProductsService.processCSV.mockResolvedValue([]);

      const csvFile = {
        originalname: 'products.csv',
        buffer: Buffer.from('name,price\nA,10'),
      } as Express.Multer.File;

      const result = await controller.uploadProducts([csvFile], {});

      expect(mockProductsService.processCSV).toHaveBeenCalledWith(csvFile);
      expect(result).toEqual({ message: 'Upload processed successfully' });
    });

    it('should NOT call processCSV when no CSV file is present', async () => {
      const imageFile = {
        originalname: 'photo.png',
        buffer: Buffer.from('img'),
      } as Express.Multer.File;

      const result = await controller.uploadProducts([imageFile], {});

      expect(mockProductsService.processCSV).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Upload processed successfully' });
    });
  });

  // -----------------------------------------------------------------------
  // PATCH endpoints
  // -----------------------------------------------------------------------
  describe('update', () => {
    it('should parse id and forward partial data to service.update', async () => {
      const updated = { id: 3, name: 'Updated', price: 25 };
      mockProductsService.update.mockResolvedValue(updated);

      const result = await controller.update('3', { name: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockProductsService.update).toHaveBeenCalledWith(3, { name: 'Updated' });
    });
  });

  describe('updateCategory', () => {
    it('should forward category rename parameters to the service', async () => {
      mockProductsService.updateCategory.mockResolvedValue({ updated: 4 });

      const body = { oldName: 'Old', newName: 'New', newNameEn: 'NewEn', minQty: 3 };
      const result = await controller.updateCategory(body);

      expect(result).toEqual({ updated: 4 });
      expect(mockProductsService.updateCategory).toHaveBeenCalledWith('Old', {
        newName: 'New',
        newNameEn: 'NewEn',
        minQty: 3,
      });
    });
  });

  // -----------------------------------------------------------------------
  // DELETE endpoint
  // -----------------------------------------------------------------------
  describe('delete', () => {
    it('should parse id and delegate to service.delete', async () => {
      mockProductsService.delete.mockResolvedValue({ id: 7, name: 'Removed' });

      const result = await controller.delete('7');

      expect(result).toMatchObject({ id: 7 });
      expect(mockProductsService.delete).toHaveBeenCalledWith(7);
    });
  });
});

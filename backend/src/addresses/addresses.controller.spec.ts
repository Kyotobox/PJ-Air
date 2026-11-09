import { Test, TestingModule } from '@nestjs/testing';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

describe('AddressesController', () => {
  let controller: AddressesController;
  let service: AddressesService;

  const mockAddressesService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [
        {
          provide: AddressesService,
          useValue: mockAddressesService,
        },
      ],
    }).compile();

    controller = module.get<AddressesController>(AddressesController);
    service = module.get<AddressesService>(AddressesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('routing for addresses', () => {
    it('should create an address', async () => {
      const addressData = { street: 'Main St' };
      const body = { userId: '1', ...addressData };
      mockAddressesService.create.mockResolvedValue({ id: '10', ...body });

      const req = { user: { id: '1', role: 'client' } };
      const result = await controller.create(body, req as any);
      expect(service.create).toHaveBeenCalledWith('1', addressData);
      expect(result).toEqual({ id: '10', userId: '1', street: 'Main St' });
    });

    it('should fetch addresses by user', async () => {
      mockAddressesService.findByUser.mockResolvedValue([{ id: '10' }]);
      const req = { user: { id: '1', role: 'client' } };
      const result = await controller.findByUser('1', req as any);
      expect(service.findByUser).toHaveBeenCalledWith('1');
      expect(result).toEqual([{ id: '10' }]);
    });

    it('should edit an address', async () => {
      const body = { street: 'Second St' };
      mockAddressesService.findOne.mockResolvedValue({ id: '10', user_id: '1' });
      mockAddressesService.update.mockResolvedValue({ id: '10', ...body });
      const req = { user: { id: '1', role: 'client' } };
      const result = await controller.update('10', body, req as any);
      expect(service.update).toHaveBeenCalledWith('10', body);
      expect(result).toEqual({ id: '10', street: 'Second St' });
    });

    it('should delete an address', async () => {
      mockAddressesService.findOne.mockResolvedValue({ id: '10', user_id: '1' });
      mockAddressesService.delete.mockResolvedValue({ id: '10' });
      const req = { user: { id: '1', role: 'client' } };
      const result = await controller.delete('10', req as any);
      expect(service.delete).toHaveBeenCalledWith('10');
      expect(result).toEqual({ id: '10' });
    });

    describe('uploadPhoto', () => {
      it('should return uploaded file URL', async () => {
        const file = {
          filename: 'facade-photo-123.jpg',
          originalname: 'facade.jpg',
        } as Express.Multer.File;

        const result = await controller.uploadPhoto(file);
        expect(result).toEqual({ url: '/uploads/addresses/facade-photo-123.jpg' });
      });

      it('sad path: should throw BadRequestException when no file is uploaded', async () => {
        await expect(
          controller.uploadPhoto(undefined as any),
        ).rejects.toThrow('No file uploaded or file type not allowed');
      });
    });

      describe('uploadFacade', () => {
        it('should return uploaded facade file URL', async () => {
          const file = {
            filename: 'facade-photo-456.jpg',
            originalname: 'facade456.jpg',
          } as Express.Multer.File;

          const result = await controller.uploadFacade(file);
          expect(result).toEqual({ url: '/uploads/addresses/facade-photo-456.jpg' });
        });

        it('sad path: should throw BadRequestException when no file is uploaded to uploadFacade', async () => {
          await expect(
            controller.uploadFacade(undefined as any),
          ).rejects.toThrow('No file uploaded or file type not allowed');
        });
      });

      describe('validateFacade', () => {
        it('should validate a storefront photo via file upload (Happy Path)', async () => {
          const mockVisionService = {
            validateFacade: jest.fn().mockResolvedValue({
              isValid: true,
              category: 'STOREFRONT',
              confidence: 0.95,
              status: 'VERIFIED',
              reason: 'Fachada comercial verificada correctamente.',
            }),
            resolveBufferFromUrlOrPath: jest.fn(),
          };

          const ctrl = new AddressesController(
            mockAddressesService as any,
            undefined,
            mockVisionService as any,
          );

          const file = {
            buffer: Buffer.from('FAKE_STOREFRONT_IMAGE'),
            mimetype: 'image/jpeg',
          } as Express.Multer.File;

          const result = await ctrl.validateFacade(file);

          expect(result.success).toBe(true);
          expect(result.isValid).toBe(true);
          expect(result.category).toBe('STOREFRONT');
          expect(result.confidence).toBe(0.95);
          expect(result.status).toBe('VERIFIED');
          expect(mockVisionService.validateFacade).toHaveBeenCalledWith(file.buffer, 'image/jpeg');
        });

        it('should validate a storefront photo via body image_url (Happy Path)', async () => {
          const mockVisionService = {
            validateFacade: jest.fn().mockResolvedValue({
              isValid: true,
              category: 'STOREFRONT',
              confidence: 0.95,
              status: 'VERIFIED',
            }),
            resolveBufferFromUrlOrPath: jest.fn().mockReturnValue({
              buffer: Buffer.from('RESOLVED_IMAGE_BUFFER'),
              mimeType: 'image/png',
            }),
          };

          const ctrl = new AddressesController(
            mockAddressesService as any,
            undefined,
            mockVisionService as any,
          );

          const result = await ctrl.validateFacade(undefined, { image_url: '/uploads/addresses/facade.png' });

          expect(result.success).toBe(true);
          expect(result.isValid).toBe(true);
          expect(mockVisionService.resolveBufferFromUrlOrPath).toHaveBeenCalledWith('/uploads/addresses/facade.png');
          expect(mockVisionService.validateFacade).toHaveBeenCalled();
        });

        it('sad path: rejects food products (bread) returning isValid: false', async () => {
          const mockVisionService = {
            validateFacade: jest.fn().mockResolvedValue({
              isValid: false,
              category: 'FOOD_PRODUCT',
              confidence: 0.98,
              status: 'REJECTED',
              reason: 'Detectamos un producto alimenticio (pan/pastelería) en lugar de la fachada exterior de su local comercial.',
            }),
            resolveBufferFromUrlOrPath: jest.fn(),
          };

          const ctrl = new AddressesController(
            mockAddressesService as any,
            undefined,
            mockVisionService as any,
          );

          const file = {
            buffer: Buffer.from('FAKE_BREAD_IMAGE'),
            mimetype: 'image/jpeg',
          } as Express.Multer.File;

          const result = await ctrl.validateFacade(file);

          expect(result.success).toBe(true);
          expect(result.isValid).toBe(false);
          expect(result.category).toBe('FOOD_PRODUCT');
          expect(result.confidence).toBe(0.98);
          expect(result.message).toContain('producto alimenticio');
        });

        it('sad path: throws BadRequestException when neither file nor image_url is provided', async () => {
          const mockVisionService = {
            validateFacade: jest.fn(),
            resolveBufferFromUrlOrPath: jest.fn(),
          };

          const ctrl = new AddressesController(
            mockAddressesService as any,
            undefined,
            mockVisionService as any,
          );

          await expect(ctrl.validateFacade(undefined, {})).rejects.toThrow(
            'Debe proporcionar un archivo de imagen o image_url para validar la fachada.',
          );
        });

        it('fallback: returns PENDING_AUDIT when facadeVisionService is not configured', async () => {
          const ctrl = new AddressesController(mockAddressesService as any);
          const result = await ctrl.validateFacade(undefined, { image_url: '/some/image.jpg' });

          expect(result.success).toBe(true);
          expect(result.isValid).toBe(true);
          expect(result.status).toBe('PENDING_AUDIT');
        });
      });

    describe('validateAddress', () => {
      it('should validate an address using addressValidationService', async () => {
        const mockValidation = {
          validateAndGeocode: jest.fn().mockResolvedValue({
            lat: 40.761032,
            lng: -73.923714,
            formatted_address: '33-04 Broadway, Astoria, NY 11106, USA',
            cached: false,
          }),
        };

        const ctrl = new AddressesController(mockAddressesService as any, mockValidation as any);
        const result = await ctrl.validateAddress({ address: '3304 Broadway, Astoria, NY 11106' });
        expect(result.valid).toBe(true);
        expect(result.lat).toBe(40.761032);
        expect(result.formatted_address).toBe('33-04 Broadway, Astoria, NY 11106, USA');
      });

      it('sad path: should throw BadRequestException if address field is missing', async () => {
        const ctrl = new AddressesController(mockAddressesService as any);
        await expect(ctrl.validateAddress({})).rejects.toThrow('El campo "address" es obligatorio para la validación.');
      });
    });
  });
});

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
  });
});

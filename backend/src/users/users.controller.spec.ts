import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateProfile: jest.fn(),
    updateRole: jest.fn(),
    updateAvatar: jest.fn(),
    updateGeneralDiscount: jest.fn(),
    updateDeliveryFee: jest.fn(),
    updateMinOrderAmount: jest.fn(),
    getProductDiscounts: jest.fn(),
    setProductDiscount: jest.fn(),
    deleteProductDiscount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Profile retrieval', () => {
    it('should find all users', async () => {
      mockUsersService.findAll.mockResolvedValue([]);
      expect(await controller.findAll()).toEqual([]);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should find one user', async () => {
      mockUsersService.findOne.mockResolvedValue({ id: '1' });
      expect(await controller.findOne('1')).toEqual({ id: '1' });
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('Profile updates', () => {
    it('should update profile', async () => {
      const data = { full_name: 'John' };
      mockUsersService.updateProfile.mockResolvedValue(data);
      expect(await controller.updateProfile('1', data)).toEqual(data);
      expect(service.updateProfile).toHaveBeenCalledWith('1', data);
    });

    it('should update role', async () => {
      mockUsersService.updateRole.mockResolvedValue({ id: '1', role: 'admin' });
      expect(await controller.updateRole('1', { role: 'admin' })).toEqual({ id: '1', role: 'admin' });
      expect(service.updateRole).toHaveBeenCalledWith('1', 'admin');
    });
  });

  describe('Discount management', () => {
    it('should update general discount', async () => {
      mockUsersService.updateGeneralDiscount.mockResolvedValue(undefined);
      await controller.updateGeneralDiscount('1', { discount: 10 });
      expect(service.updateGeneralDiscount).toHaveBeenCalledWith('1', 10);
    });

    it('should update client min order amount (TASK-71-05)', async () => {
      mockUsersService.updateMinOrderAmount.mockResolvedValue(undefined);
      const res = await controller.updateMinOrderAmount('1', { min_order_amount: 45 });
      expect(service.updateMinOrderAmount).toHaveBeenCalledWith('1', 45);
      expect(res).toEqual({ success: true, min_order_amount: 45 });
    });

    it('should get product discounts', async () => {
      mockUsersService.getProductDiscounts.mockResolvedValue([]);
      expect(await controller.getProductDiscounts('1')).toEqual([]);
      expect(service.getProductDiscounts).toHaveBeenCalledWith('1');
    });

    it('should set product discount', async () => {
      mockUsersService.setProductDiscount.mockResolvedValue({});
      await controller.setProductDiscount('1', { productId: 2, discount_percentage: 15 });
      expect(service.setProductDiscount).toHaveBeenCalledWith('1', 2, { discount_percentage: 15, special_price: undefined });
    });

    it('should delete product discount', async () => {
      mockUsersService.deleteProductDiscount.mockResolvedValue(undefined);
      await controller.deleteProductDiscount('123');
      expect(service.deleteProductDiscount).toHaveBeenCalledWith('123');
    });
  });
});

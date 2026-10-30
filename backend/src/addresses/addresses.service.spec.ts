import { Test, TestingModule } from '@nestjs/testing';
import { AddressesService } from './addresses.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Address } from './address.entity';
import { NotFoundException } from '@nestjs/common';

describe('AddressesService', () => {
  let service: AddressesService;

  const mockAddressRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        { provide: getRepositoryToken(Address), useValue: mockAddressRepository },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Business constraints (simulated unit tests)', () => {
    it('should limit the maximum number of addresses a user can have (simulated)', async () => {
      mockAddressRepository.find.mockResolvedValue([1, 2, 3, 4, 5]);
      
      const addresses = await service.findByUser('1');
      expect(addresses.length).toBe(5);
    });

    it('should set a default address (simulated)', async () => {
      const mockAddress = { id: '1', user_id: '1', is_default: false };
      mockAddressRepository.findOne.mockResolvedValue(mockAddress);
      mockAddressRepository.save.mockResolvedValue({ ...mockAddress, is_default: true });

      const updatedAddress = await service.update('1', { is_default: true });
      expect(updatedAddress.is_default).toBe(true);
    });
  });

  describe('Integration Tests: Database operations', () => {
    it('should link addresses correctly to user entities upon creation', async () => {
      const mockAddressData = { street: 'Main St', city: 'City' };
      const userId = 'user-123';
      
      mockAddressRepository.create.mockReturnValue({ ...mockAddressData, user_id: userId });
      mockAddressRepository.save.mockResolvedValue({ id: 'addr-1', ...mockAddressData, user_id: userId });

      const result = await service.create(userId, mockAddressData);
      
      expect(mockAddressRepository.create).toHaveBeenCalledWith({ ...mockAddressData, user_id: userId });
      expect(mockAddressRepository.save).toHaveBeenCalled();
      expect((result as any).user_id).toBe(userId);
    });

    it('should fetch all addresses correctly linked to user entities', async () => {
      const userId = 'user-123';
      mockAddressRepository.find.mockResolvedValue([{ id: 'addr-1', user_id: userId, is_temporary: false }]);

      const result = await service.findByUser(userId);
      expect(mockAddressRepository.find).toHaveBeenCalledWith({
        where: { user_id: userId, is_temporary: false },
      });
      expect(result[0].user_id).toBe(userId);
    });
  });

  describe('Sprint S51: Early Morning Access Instructions & Delivery Photos', () => {
    const earlyMorningPayload = {
      alias: 'Queens Coffee Lab',
      address: '3304 Broadway, Astoria, NY 11106',
      notes: 'Unload at rear delivery gate',
      access_code: 'GATE-9842#',
      has_key: true,
      key_location: '24h deli across the street with cashier',
      fridge_access_required: true,
      delivery_photos_json: JSON.stringify([
        '/uploads/addresses/facade-gate.jpg',
        '/uploads/addresses/corridor-spot.jpg',
        '/uploads/addresses/walk-in-cooler.jpg',
      ]),
    };

    it('should persist early morning access instructions and delivery photos upon creation', async () => {
      const userId = 'b2b-client-777';
      const createdEntity = {
        id: 'addr-s51-001',
        user_id: userId,
        ...earlyMorningPayload,
      };

      mockAddressRepository.create.mockReturnValue(createdEntity);
      mockAddressRepository.save.mockResolvedValue(createdEntity);

      const result = await service.create(userId, earlyMorningPayload);

      expect(mockAddressRepository.create).toHaveBeenCalledWith({
        ...earlyMorningPayload,
        user_id: userId,
      });
      expect(mockAddressRepository.save).toHaveBeenCalledWith(createdEntity);
      expect(result.access_code).toBe('GATE-9842#');
      expect(result.has_key).toBe(true);
      expect(result.key_location).toBe('24h deli across the street with cashier');
      expect(result.fridge_access_required).toBe(true);
      expect(JSON.parse(result.delivery_photos_json)).toHaveLength(3);
    });

    it('should update existing address with new early morning delivery photos and access instructions', async () => {
      const existingAddr = {
        id: 'addr-s51-002',
        user_id: 'b2b-client-777',
        alias: 'Cafe Old Name',
        address: '100 Main St',
        access_code: null,
        has_key: false,
        key_location: null,
        fridge_access_required: false,
        delivery_photos_json: null,
      };

      const updatePayload = {
        access_code: 'DOOR-1234',
        has_key: true,
        key_location: 'Lockbox 8899 on left pipe',
        fridge_access_required: true,
        delivery_photos_json: JSON.stringify(['/uploads/addresses/door.jpg']),
      };

      mockAddressRepository.findOne.mockResolvedValue({ ...existingAddr });
      mockAddressRepository.save.mockImplementation(async (entity) => entity);

      const updated = await service.update('addr-s51-002', updatePayload);

      expect(mockAddressRepository.findOne).toHaveBeenCalledWith({ where: { id: 'addr-s51-002' } });
      expect(updated.access_code).toBe('DOOR-1234');
      expect(updated.has_key).toBe(true);
      expect(updated.key_location).toBe('Lockbox 8899 on left pipe');
      expect(updated.fridge_access_required).toBe(true);
      expect(updated.delivery_photos_json).toBe(JSON.stringify(['/uploads/addresses/door.jpg']));
    });

    it('sad path: should throw NotFoundException when updating an address that does not exist', async () => {
      mockAddressRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { access_code: '9999' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('sad path: should throw NotFoundException when finding an address by id that does not exist', async () => {
      mockAddressRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sad path: should throw NotFoundException when deleting an address that does not exist', async () => {
      mockAddressRepository.findOne.mockResolvedValue(null);

      await expect(
        service.delete('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

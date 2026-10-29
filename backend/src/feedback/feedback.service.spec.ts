import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { Feedback } from './feedback.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let feedbackRepo: any;
  let userRepo: any;
  let mailService: any;

  beforeEach(async () => {
    feedbackRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'fb-123', created_at: new Date(), ...dto })),
      save: jest.fn().mockImplementation(async (item) => ({ ...item, id: item.id || 'fb-saved-1' })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    userRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'usr-1',
        email: 'b2b@test.com',
        profile: { company_name: 'Bodega Central' },
      }),
    };

    mailService = {
      sendFeedbackAlert: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: getRepositoryToken(Feedback), useValue: feedbackRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
  });

  describe('create - Happy Path', () => {
    it('should create feedback and dispatch admin email via MailService', async () => {
      const res = await service.create({
        userId: 'usr-1',
        category: 'sugerencia',
        message: 'Por favor agregar más variedad de panes rústicos.',
      });

      expect(res.category).toBe('sugerencia');
      expect(res.message).toBe('Por favor agregar más variedad de panes rústicos.');
      expect(res.status).toBe('pending');
      expect(feedbackRepo.save).toHaveBeenCalled();
      expect(mailService.sendFeedbackAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'sugerencia',
          message: 'Por favor agregar más variedad de panes rústicos.',
        }),
      );
    });

    it('should allow anonymous feedback without userId', async () => {
      const res = await service.create({
        category: 'reclamo',
        message: 'Entrega demorada en turno matutino.',
      });

      expect(res.user_id).toBeFalsy();
      expect(feedbackRepo.save).toHaveBeenCalled();
    });
  });

  describe('create - Sad Paths (§6)', () => {
    it('should throw BadRequestException if category is empty or invalid', async () => {
      await expect(service.create({ category: '', message: 'test' })).rejects.toThrow(BadRequestException);
      await expect(service.create({ category: 'invalid_cat', message: 'test' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if message is empty or whitespace only', async () => {
      await expect(service.create({ category: 'sugerencia', message: '' })).rejects.toThrow(BadRequestException);
      await expect(service.create({ category: 'sugerencia', message: '   ' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus - Happy & Sad Paths', () => {
    it('should update feedback status to reviewed or resolved', async () => {
      feedbackRepo.findOne.mockResolvedValue({ id: 'fb-1', status: 'pending' });

      const updated = await service.updateStatus('fb-1', 'resolved');
      expect(updated.status).toBe('resolved');
      expect(feedbackRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if feedback does not exist', async () => {
      feedbackRepo.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('non-existent', 'resolved')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid status', async () => {
      feedbackRepo.findOne.mockResolvedValue({ id: 'fb-1', status: 'pending' });

      await expect(service.updateStatus('fb-1', 'magic_status')).rejects.toThrow(BadRequestException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SmsService } from './sms.service';

jest.mock('twilio', () => {
  const mMessages = {
    create: jest.fn(),
  };
  const mTwilio = jest.fn(() => ({
    messages: mMessages,
  }));
  return mTwilio;
});

describe('SmsService', () => {
  let service: SmsService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmsService],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Guardrail SMS_ENABLED=false (Sad Path §6)', () => {
    it('should skip sending and return reason SMS_DISABLED when SMS_ENABLED is "false"', async () => {
      process.env.SMS_ENABLED = 'false';

      const result = await service.sendOverdueAlert('+17185550199', 'Su factura está vencida.');

      expect(result).toEqual({ skipped: true, reason: 'SMS_DISABLED' });
    });

    it('should skip sending when SMS_ENABLED is undefined', async () => {
      delete process.env.SMS_ENABLED;

      const result = await service.sendOverdueAlert('+17185550199', 'Su factura está vencida.');

      expect(result).toEqual({ skipped: true, reason: 'SMS_DISABLED' });
    });

    it('should skip sending when phone is missing', async () => {
      process.env.SMS_ENABLED = 'true';

      const result = await service.sendOverdueAlert('', 'Texto de alerta');

      expect(result).toEqual({ skipped: true, reason: 'PHONE_MISSING' });
    });
  });

  describe('Happy Path (SMS_ENABLED=true)', () => {
    it('should invoke Twilio client and return success with message SID', async () => {
      process.env.SMS_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'MOCK_TWILIO_ACCOUNT_SID';
      process.env.TWILIO_AUTH_TOKEN = 'test_token_123';
      process.env.TWILIO_PHONE_NUMBER = '+15551234567';

      const twilioModule = require('twilio');
      const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM_test_message_sid_789' });
      twilioModule.mockReturnValue({
        messages: { create: mockCreate },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [SmsService],
      }).compile();
      const activeService = module.get<SmsService>(SmsService);

      const result = await activeService.sendOverdueAlert('+17185550199', 'Panadería Jhoanes: Su orden #12345678 está vencida.');

      expect(result).toEqual({ success: true, sid: 'SM_test_message_sid_789' });
      expect(mockCreate).toHaveBeenCalledWith({
        body: 'Panadería Jhoanes: Su orden #12345678 está vencida.',
        from: '+15551234567',
        to: '+17185550199',
      });
    });

    it('should catch Twilio exceptions and return success false with error message (Sad Path §6)', async () => {
      process.env.SMS_ENABLED = 'true';
      process.env.TWILIO_ACCOUNT_SID = 'MOCK_TWILIO_ACCOUNT_SID';
      process.env.TWILIO_AUTH_TOKEN = 'test_token_123';
      process.env.TWILIO_PHONE_NUMBER = '+15551234567';

      const twilioModule = require('twilio');
      const mockCreate = jest.fn().mockRejectedValue(new Error('Twilio Network Error'));
      twilioModule.mockReturnValue({
        messages: { create: mockCreate },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [SmsService],
      }).compile();
      const activeService = module.get<SmsService>(SmsService);

      const result = await activeService.sendOverdueAlert('+17185550199', 'Alerta');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Twilio Network Error');
    });
  });
});

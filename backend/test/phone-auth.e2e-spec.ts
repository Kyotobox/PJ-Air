import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { Profile } from '../src/users/profile.entity';

describe('Phone Auth Verification (e2e)', () => {
  let app: INestApplication;
  let testUserId: string;
  let testUserToken: string;
  let profileRepo: Repository<Profile>;
  let userRepo: Repository<User>;

  const testUser = {
    email: 'phone-auth-test@jhpanesbakery.com',
    password: 'TestPassword123!',
    full_name: 'Phone Auth Tester',
    company_name: 'B2B Verification Bakery',
    phone: '+1 (305) 555-0100',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    profileRepo = app.get<Repository<Profile>>(getRepositoryToken(Profile));

    // Clean up if already exists
    const existing = await userRepo.findOne({ where: { email: testUser.email } });
    if (existing) {
      await profileRepo.delete({ id: existing.id });
      await userRepo.delete({ id: existing.id });
    }

    // Register test user
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(testUser)
      .expect(201);

    testUserId = signupRes.body.user.id;
    testUserToken = signupRes.body.session.access_token;
  });

  afterAll(async () => {
    if (testUserId) {
      await profileRepo.delete({ id: testUserId });
      await userRepo.delete({ id: testUserId });
    }
    await app.close();
  });

  it('Verificación sin token JWT -> 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .send({
        phone: '+1 (305) 555-0100',
        verificationCode: '123456',
      })
      .expect(401);
  });

  it('Sad path: teléfono inválido (menos de 10 dígitos) -> 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        phone: '30555',
        verificationCode: '123456',
      })
      .expect(400);

    expect(res.body.message).toMatch(/invalid phone number format/i);
  });

  it('Sad path: teléfono vacío -> 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        phone: '',
        verificationCode: '123456',
      })
      .expect(400);

    expect(res.body.message).toMatch(/phone number is required/i);
  });

  it('Sad path: código erróneo -> 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        phone: '+1 (305) 555-0100',
        verificationCode: '999999',
      })
      .expect(400);

    expect(res.body.message).toMatch(/invalid or expired verification code/i);
  });

  it('Verificación exitosa de teléfono con código válido (123456) y preservación en BD', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        phone: '+1 (305) 555-0100',
        verificationCode: '123456',
      })
      .expect(201);

    expect(res.body).toEqual({
      success: true,
      phone_verified: true,
      phone: '+1 (305) 555-0100',
    });

    // Check DB persistence
    const profile = await profileRepo.findOne({ where: { id: testUserId } });
    expect(profile).toBeDefined();
    expect(profile?.phone_verified).toBe(true);
    expect(profile?.phone).toBe('+1 (305) 555-0100');
  });

  it('Verificación exitosa mediante token Firebase válido en endpoint /auth/verify-phone-token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-phone-token')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        phone: '+13055550199',
        idToken: 'mock-valid-firebase-token',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.phone_verified).toBe(true);
    expect(res.body.phone).toBe('+13055550199');

    const profile = await profileRepo.findOne({ where: { id: testUserId } });
    expect(profile?.phone_verified).toBe(true);
    expect(profile?.phone).toBe('+13055550199');
  });

  it('Sad path: ID token inválido -> 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-phone-token')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        phone: '+13055550199',
        idToken: 'invalid-id-token-12345',
      })
      .expect(400);

    expect(res.body.message).toMatch(/invalid or expired verification code/i);
  });

  it('Preservación del estado phone_verified al actualizar otros campos del perfil', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${testUserId}/profile`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        full_name: 'Updated Tester Name',
      })
      .expect(200);

    const profile = await profileRepo.findOne({ where: { id: testUserId } });
    expect(profile?.full_name).toBe('Updated Tester Name');
    expect(profile?.phone_verified).toBe(true);
  });

  it('Reseteo de phone_verified a false si se modifica el teléfono sin verificar', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${testUserId}/profile`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        phone: '+1 (305) 555-9999',
      })
      .expect(200);

    const profile = await profileRepo.findOne({ where: { id: testUserId } });
    expect(profile?.phone).toBe('+1 (305) 555-9999');
    expect(profile?.phone_verified).toBe(false);
  });
});

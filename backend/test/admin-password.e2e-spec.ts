import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { Profile } from '../src/users/profile.entity';
import { SystemConfig } from '../src/system-configs/system-config.entity';
import { DevtoolsService } from '../src/devtools/devtools.service';

describe('Admin Password Management (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminUserId: string;
  let testUserId: string;
  let testUserToken: string;

  const adminCredentials = {
    email: 'admin@test.com', // Admin tester fallback
    password: '123123',
  };

  const testUserPayload = {
    email: 'pwd-test@jhpanesbakery.com',
    password: 'TestPwd2026!',
    full_name: 'Test Pwd User',
    username: 'pwdtestuser',
    company_name: 'Password Test Bakery',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Ensure admin user exists by seeding it
    const devtoolsService = app.get<DevtoolsService>(DevtoolsService);
    await devtoolsService.seedAdmin();

    // Clean up test user if it exists from a previous run
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const profileRepo = app.get<Repository<Profile>>(getRepositoryToken(Profile));
    const configRepo = app.get<Repository<SystemConfig>>(getRepositoryToken(SystemConfig));
    const existingTestUser = await userRepo.findOne({ where: { email: testUserPayload.email } });
    if (existingTestUser) {
      await profileRepo.delete({ id: existingTestUser.id });
      await userRepo.delete({ id: existingTestUser.id });
      await configRepo.delete({ key: `force_pwd_change:${existingTestUser.id}` });
    }

    // 1. Log in as admin to get token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(adminCredentials)
      .expect(201);

    adminToken = loginRes.body.session.access_token;
    adminUserId = loginRes.body.user.id;

    // 2. Sign up disposable user
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(testUserPayload)
      .expect(201);

    testUserId = signupRes.body.user.id;
  });

  afterAll(async () => {
    // Teardown: Delete disposable user and associated force_pwd_change configs
    try {
      const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
      const configRepo = app.get<Repository<SystemConfig>>(getRepositoryToken(SystemConfig));
      const profileRepo = app.get<Repository<Profile>>(getRepositoryToken(Profile));
      await profileRepo.delete({ id: testUserId });
      await userRepo.delete({ id: testUserId });
      await configRepo.delete({ key: `force_pwd_change:${testUserId}` });
    } catch (err) {
      console.error('Error during e2e teardown:', err);
    }
    await app.close();
  });

  it('debería retornar 401 Unauthorized si se intenta resetear sin estar autenticado', async () => {
    await request(app.getHttpServer())
      .patch(`/admin-actions/users/${testUserId}/reset-password`)
      .send({ newPassword: 'ResetPwd2026!' })
      .expect(401);
  });

  it('debería resetear la contraseña del cliente estando autenticado como admin', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin-actions/users/${testUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'ResetPwd2026!' })
      .expect(200);

    expect(res.body.success).toBe(true);

    const configRepo = app.get<Repository<SystemConfig>>(getRepositoryToken(SystemConfig));
    const config = await configRepo.findOne({ where: { key: `force_pwd_change:${testUserId}` } });
    expect(config).toBeDefined();
    expect(config?.value).toBe('true');
  });

  it('debería incluir require_password_change en el login del usuario reseteado', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUserPayload.email,
        password: 'ResetPwd2026!',
      })
      .expect(201);

    expect(loginRes.body.require_password_change).toBe(true);
    expect(loginRes.body.session).toHaveProperty('access_token');
    testUserToken = loginRes.body.session.access_token;
  });

  it('debería retornar 401 si se intenta cambiar la clave propia con la actual incorrecta', async () => {
    await request(app.getHttpServer())
      .patch('/admin-actions/me/change-password')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        currentPassword: 'WrongPassword!',
        newPassword: 'FinalPwd2026!',
      })
      .expect(401);
  });

  it('debería cambiar la contraseña propia correctamente y borrar el flag', async () => {
    const res = await request(app.getHttpServer())
      .patch('/admin-actions/me/change-password')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        currentPassword: 'ResetPwd2026!',
        newPassword: 'FinalPwd2026!',
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    const configRepo = app.get<Repository<SystemConfig>>(getRepositoryToken(SystemConfig));
    const config = await configRepo.findOne({ where: { key: `force_pwd_change:${testUserId}` } });
    expect(config).toBeNull();
  });

  it('debería iniciar sesión correctamente después del cambio sin requerir cambio de clave', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUserPayload.email,
        password: 'FinalPwd2026!',
      })
      .expect(201);

    expect(loginRes.body.require_password_change).toBeUndefined();
  });

  it('debería retornar 403 si un admin intenta restablecer la contraseña de otro admin', async () => {
    await request(app.getHttpServer())
      .patch(`/admin-actions/users/${adminUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'AdminReset123!' })
      .expect(403);
  });
});

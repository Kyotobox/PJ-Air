import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getClientAuthHeaders } from './helpers/auth.helper';

describe('Resource Ownership Security (e2e)', () => {
  let app: INestApplication;
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Register User 1
    const res1 = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `own_user1_${Date.now()}@test.com`,
        password: 'Password123!',
        full_name: 'Owner User 1',
        company_name: 'Bakery One',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
      });
    user1Token = res1.body.session.access_token;
    user1Id = res1.body.user.id;

    // Register User 2
    const res2 = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `own_user2_${Date.now()}@test.com`,
        password: 'Password123!',
        full_name: 'Owner User 2',
        company_name: 'Bakery Two',
        phone: '+13055550101',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
      });
    user2Token = res2.body.session.access_token;
    user2Id = res2.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 403 when a user tries to fetch or modify another user\'s addresses', async () => {
    const user1Headers = { Authorization: `Bearer ${user1Token}` };
    const user2Headers = { Authorization: `Bearer ${user2Token}` };

    // 1. User 1 attempts to fetch User 2's addresses
    const fetchRes = await request(app.getHttpServer())
      .get(`/addresses/user/${user2Id}`)
      .set(user1Headers);
      
    expect(fetchRes.status).toBe(403);

    // 2. User 1 creates an address
    const createRes = await request(app.getHttpServer())
      .post('/addresses')
      .set(user1Headers)
      .send({
        alias: 'Casa User 1',
        address: 'Calle Falsa 123',
        city: 'Caracas',
        zone: 'Centro',
      })
      .expect(201);

    const addressId = createRes.body.id;

    // 3. User 2 attempts to modify User 1's address
    const patchRes = await request(app.getHttpServer())
      .patch(`/addresses/${addressId}`)
      .set(user2Headers)
      .send({ address: 'Hacked Address' });

    expect(patchRes.status).toBe(403);

    // 4. User 2 attempts to delete User 1's address
    const deleteRes = await request(app.getHttpServer())
      .delete(`/addresses/${addressId}`)
      .set(user2Headers);

    expect(deleteRes.status).toBe(403);
  });

  it('should return 403 when a user tries to access another user\'s order list via user route', async () => {
    const user1Headers = { Authorization: `Bearer ${user1Token}` };

    const response = await request(app.getHttpServer())
      .get(`/orders/user/${user2Id}`)
      .set(user1Headers);
      
    expect(response.status).toBe(403);
  });
});

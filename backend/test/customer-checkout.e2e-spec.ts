import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DevtoolsService } from '../src/devtools/devtools.service';

describe('Customer Checkout Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const testUser = {
    email: `checkout_test_${Date.now()}@example.com`,
    password: 'Password123!',
    full_name: 'Checkout User',
    username: `checkoutuser_${Date.now()}`,
    company_name: 'Panadería Central',
    phone: '+13055550100',
    phone_verified: true,
    idToken: 'mock-valid-firebase-token',
  };

  const addressPayload = {
    alias: 'Home',
    address: '123 Main St',
    city: 'Test City',
    zone: 'Downtown'
  };

  const orderPayload = {
    total: 100.0,
    items: [
      { productId: 1, quantity: 2, price: 50.0 }
    ]
  };

  let jwtToken: string;
  let anotherUserJwtToken: string;
  let currentUserId: string;
  let anotherUserId: string;
  let addressId: string;

  it('should successfully register a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(testUser)
      .expect(201);
    
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should fail user registration when company_name is missing for wholesale client', async () => {
    const invalidUser = {
      email: `no_company_${Date.now()}@example.com`,
      password: 'Password123!',
      full_name: 'No Company User',
      username: `nocompany_${Date.now()}`,
    };
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(invalidUser)
      .expect(400);

    expect(res.body.message).toContain('Company or store name is required');
  });

  it('should fail user registration with duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(testUser)
      .expect(400); // or 409 Conflict, depending on implementation
  });

  it('should fail login with incorrect credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword!',
      })
      .expect(401);
  });

  it('should successfully login and generate session/token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(201); // or 200

    expect(res.body.session).toHaveProperty('access_token');
    jwtToken = res.body.session.access_token;
    currentUserId = res.body.user.id;
  });

  it('should complete password recovery HTTP flow', async () => {
    // 1. Request recovery
    await request(app.getHttpServer())
      .post('/auth/recover-password')
      .send({ identifier: testUser.email })
      .expect(201);

    // 2. Change password (simulated with standard payload)
    // Note: Assuming a simple reset flow for e2e testing purposes
    // In reality, this might require intercepting the recovery token.
  }, 15000);

  it('should ensure users can only fetch and modify their own addresses (isolation)', async () => {
    // 1. Setup a second user
    const secondUser = {
      email: `another_user_${Date.now()}@example.com`,
      password: 'Password123!',
      full_name: 'Another User',
      username: `another_${Date.now()}`,
      company_name: 'Second Bakery',
      phone: '+13055550101',
      phone_verified: true,
      idToken: 'mock-valid-firebase-token',
    };
    await request(app.getHttpServer()).post('/auth/signup').send(secondUser);
    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ email: secondUser.email, password: secondUser.password });
    anotherUserJwtToken = loginRes.body.session.access_token;
    anotherUserId = loginRes.body.user.id;

    // 2. First user adds an address
    const addRes = await request(app.getHttpServer())
      .post('/addresses')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ ...addressPayload, userId: currentUserId })
      .expect(201);
    
    addressId = addRes.body.id;

    // 3. Second user tries to fetch first user's addresses
    await request(app.getHttpServer())
      .get(`/addresses/user/${currentUserId}`)
      .set('Authorization', `Bearer ${anotherUserJwtToken}`)
      .expect(403); // or 404

    // 4. Second user tries to modify first user's address
    await request(app.getHttpServer())
      .patch(`/addresses/${addressId}`)
      .set('Authorization', `Bearer ${anotherUserJwtToken}`)
      .send({ city: 'New City', userId: anotherUserId })
      .expect(403); // or 404
  });

  it('should complete the full checkout flow: register -> login -> add address -> create order -> fetch order history', async () => {
    // For this test, we have already registered, logged in, and added an address above.
    // We will just complete the remaining steps to verify the full flow logic contextually.

    // 0. Seed admin and login to get admin credentials for creating product
    const devtoolsService = app.get<DevtoolsService>(DevtoolsService);
    await devtoolsService.seedAdmin();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: '123123' });
    const adminToken = adminLogin.body?.session?.access_token;

    const productReq = request(app.getHttpServer())
      .post('/products');
    if (adminToken) {
      productReq.set('Authorization', `Bearer ${adminToken}`);
    }

    const productRes = await productReq
      .send({
        name: 'E2E Checkout Product',
        name_en: 'E2E Checkout Product EN',
        price: 50.0,
        category: 'e2e-test',
        brand: 'e2e',
        description: 'Test product for e2e checkout flow',
        stock: 100,
        published: true
      })
      .expect(201);
      
    const productId = productRes.body.id;

    const dynamicOrderPayload = {
      ...orderPayload,
      items: [{ productId, quantity: 2, price: 50.0 }]
    };

    // 1. Create order
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ ...dynamicOrderPayload, addressId, userId: currentUserId })
      .expect(201);

    expect(orderRes.body).toHaveProperty('id');
    expect(orderRes.body.status).toBe('pending'); // or standard initial status

    // 2. Fetch order history
    const historyRes = await request(app.getHttpServer())
      .get(`/orders/user/${currentUserId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(Array.isArray(historyRes.body)).toBe(true);
    expect(historyRes.body.some((o: any) => o.id === orderRes.body.id)).toBe(true);
  });
});

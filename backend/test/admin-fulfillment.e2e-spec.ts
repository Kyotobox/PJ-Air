import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DevtoolsService } from '../src/devtools/devtools.service';

describe('Admin Fulfillment Flow (e2e)', () => {
  let app: INestApplication;
  let adminJwtToken: string;
  let clientJwtToken: string;
  let testOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Seed admin
    const devtoolsService = app.get<DevtoolsService>(DevtoolsService);
    await devtoolsService.seedAdmin();

    // 2. Login as admin
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: '123123' })
      .expect(201);
    adminJwtToken = adminLoginRes.body.session.access_token;

    // 3. Register client and create product + order
    const clientSignupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `fulfillment_client_${Date.now()}@test.com`,
        password: 'Password123!',
        full_name: 'Fulfillment Client',
        company_name: 'Fulfillment Bakery',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
      })
      .expect(201);
    clientJwtToken = clientSignupRes.body.session.access_token;
    const clientId = clientSignupRes.body.user.id;

    // Create product
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminJwtToken}`)
      .send({
        name: 'Fulfillment Test Bread',
        price: 25.0,
        stock: 100,
        category: 'panaderia',
      })
      .expect(201);

    // Create address
    const addressRes = await request(app.getHttpServer())
      .post('/addresses')
      .set('Authorization', `Bearer ${clientJwtToken}`)
      .send({
        alias: 'Main Bakery Store',
        address: 'Av Principal 45',
        city: 'Caracas',
        zone: 'Norte',
      })
      .expect(201);

    // Create order
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientJwtToken}`)
      .send({
        items: [{ productId: productRes.body.id, quantity: 2, price: 25.0 }],
        addressId: addressRes.body.id,
      })
      .expect(201);

    testOrderId = orderRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should block unauthenticated access to /orders', async () => {
    await request(app.getHttpServer())
      .get('/orders')
      .expect(401);
  });

  it('should complete fulfillment: fetch orders as admin -> update order status to shipped', async () => {
    // 1. Admin fetches orders
    const pendingOrdersRes = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${adminJwtToken}`)
      .expect(200);

    expect(Array.isArray(pendingOrdersRes.body)).toBe(true);
    const targetOrder = pendingOrdersRes.body.find((o: any) => o.id === testOrderId);
    expect(targetOrder).toBeDefined();

    // 2. Admin updates status to confirmed
    const confirmedRes = await request(app.getHttpServer())
      .patch(`/orders/${testOrderId}/status`)
      .set('Authorization', `Bearer ${adminJwtToken}`)
      .send({ status: 'confirmed' })
      .expect(200);

    expect(confirmedRes.body.status).toBe('confirmed');

    // 3. Admin updates status to shipped
    const shippedRes = await request(app.getHttpServer())
      .patch(`/orders/${testOrderId}/status`)
      .set('Authorization', `Bearer ${adminJwtToken}`)
      .send({ status: 'shipped' })
      .expect(200);

    expect(shippedRes.body.status).toBe('shipped');
  });
});

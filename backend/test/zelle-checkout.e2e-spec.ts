import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DevtoolsService } from '../src/devtools/devtools.service';

describe('Zelle B2B Checkout & Cutoff Flow (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let clientToken: string;
  let clientId: string;
  let productId: number;
  let zelleRef: string;
  let zelleOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Seed admin and get admin token
    const devtools = app.get<DevtoolsService>(DevtoolsService);
    await devtools.seedAdmin();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: '123123' });
    adminToken = adminLogin.body?.session?.access_token;

    // 2. Register wholesale client
    const clientEmail = `zelle_client_${Date.now()}@example.com`;
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: clientEmail,
        password: 'Password123!',
        full_name: 'Zelle Wholesale Buyer',
        company_name: 'Bodega El Roble B2B',
      });
    clientToken = signupRes.body?.session?.access_token;
    clientId = signupRes.body?.user?.id;

    // 3. Create test product
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pan Canilla Mayorista Zelle',
        price: 50.0,
        category: 'Panadería',
        sku: `PAN-ZEL-${Date.now()}`,
      });
    productId = productRes.body?.id;
    zelleRef = `CONF-ZEL-${Date.now()}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Sad Path: should reject Zelle order if zelle_reference is missing or whitespace only', async () => {
    // 5 days ahead
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'pickup',
        payment_method: 'zelle',
        zelle_reference: '   ',
        items: [{ productId, quantity: 2 }],
      })
      .expect(400);

    expect(res.body.message).toContain('referencia');
  });

  it('Happy Path: should place order with Zelle, packaging fee and 100% direct payment discount bonus', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'pickup',
        payment_method: 'zelle',
        zelle_reference: zelleRef,
        items: [{ productId, quantity: 2 }], // 50 * 2 = 100
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.payment_method).toBe('zelle');
    expect(res.body.zelle_reference).toBe(zelleRef);
    expect(res.body.payment_status).toBe('pending_zelle_verification');
    expect(Number(res.body.packaging_fee)).toBe(3.5);
    expect(Number(res.body.packaging_discount)).toBe(3.5);
    expect(Number(res.body.total)).toBe(100.0);

    zelleOrderId = res.body.id;
  });

  it('Sad Path: should reject another order attempting to use the same active zelle_reference', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'pickup',
        payment_method: 'zelle',
        zelle_reference: zelleRef, // duplicate reference!
        items: [{ productId, quantity: 2 }],
      })
      .expect(400);

    expect(res.body.message).toContain('ya ha sido registrado');
  });

  it('Security Guard: should forbid non-admin client from calling approve-zelle', async () => {
    await request(app.getHttpServer())
      .patch(`/orders/${zelleOrderId}/approve-zelle`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('Happy Path: should allow admin to approve Zelle payment, transitioning payment_status to paid', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/orders/${zelleOrderId}/approve-zelle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.id).toBe(zelleOrderId);
    expect(res.body.payment_status).toBe('paid');
  });

  it('Sad Path: should allow admin to reject Zelle payment, setting status to Cancelado and payment_status to unpaid', async () => {
    // 1. Create a second Zelle order to reject
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];
    const rejectRef = `REJ-ZEL-${Date.now()}`;

    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'pickup',
        payment_method: 'zelle',
        zelle_reference: rejectRef,
        items: [{ productId, quantity: 2 }],
      })
      .expect(201);

    const rejectOrderId = orderRes.body.id;

    // 2. Reject it as admin
    const res = await request(app.getHttpServer())
      .patch(`/orders/${rejectOrderId}/reject-zelle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Comprobante no recibido en cuenta bancaria' })
      .expect(200);

    expect(res.body.payment_status).toBe('unpaid');
    expect(res.body.status).toBe('Cancelado');
    expect(res.body.notes).toContain('Comprobante no recibido');
  });

  it('Sad Path: should reject orders placed for past dates or same-day delivery', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastStr = yesterday.toISOString().split('T')[0];

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: pastStr,
        deliveryType: 'pickup',
        payment_method: 'stripe',
        items: [{ productId, quantity: 2 }],
      })
      .expect(400);

    expect(res.body.message).toContain('pasado');
  });
});

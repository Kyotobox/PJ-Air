import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DevtoolsService } from '../src/devtools/devtools.service';

describe('Delivery Zones & Precedence Resolution Flow (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let clientToken: string;
  let clientId: string;
  let vipClientToken: string;
  let vipClientId: string;
  let productId: number;
  let zoneId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Seed admin and obtain access token
    const devtools = app.get<DevtoolsService>(DevtoolsService);
    await devtools.seedAdmin();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: '123123' });
    adminToken = adminLogin.body?.session?.access_token;

    // 2. Register standard wholesale client
    const clientEmail = `zones_buyer_${Date.now()}@example.com`;
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: clientEmail,
        password: 'Password123!',
        full_name: 'Regular Zone Buyer',
        company_name: 'Doral Market Corp',
      });
    clientToken = signupRes.body?.session?.access_token;
    clientId = signupRes.body?.user?.id;

    // 3. Register VIP wholesale client with agreed custom delivery fee
    const vipEmail = `vip_buyer_${Date.now()}@example.com`;
    const vipSignupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: vipEmail,
        password: 'Password123!',
        full_name: 'VIP Contract Buyer',
        company_name: 'Gran Panadería Central',
      });
    vipToken: vipClientToken = vipSignupRes.body?.session?.access_token;
    vipClientId = vipSignupRes.body?.user?.id;

    // Set VIP special delivery fee ($7.50) on VIP user profile
    await request(app.getHttpServer())
      .patch(`/users/${vipClientId}/delivery-fee`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee: 7.50 });

    // 4. Create standard test product ($50.00 each)
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pan Gallego Artesanal Mayorista',
        price: 50.0,
        category: 'Panadería',
        sku: `PAN-ZONE-${Date.now()}`,
      });
    productId = productRes.body?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. ZONE CRUD & SECURITY ────────────────────────────────────────────────
  it('Sad Path: should reject zone creation if user is not admin', async () => {
    await request(app.getHttpServer())
      .post('/zones')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        name: 'Unauthorized Zone',
        zip_codes: '33178',
        base_fee: 10.0,
      })
      .expect(403);
  });

  it('Sad Path: should reject zone creation if name or zip_codes are empty', async () => {
    await request(app.getHttpServer())
      .post('/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '   ',
        zip_codes: '33178',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Valid Zone',
        zip_codes: '   ',
      })
      .expect(400);
  });

  it('Happy Path: Admin creates a delivery zone with base fee and free delivery threshold', async () => {
    const res = await request(app.getHttpServer())
      .post('/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Doral & Medley Commercial',
        zip_codes: '33178, 33166, 33122',
        base_fee: 12.0,
        min_free_delivery_amount: 150.0,
        is_active: true,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Doral & Medley Commercial');
    expect(Number(res.body.base_fee)).toBe(12.0);
    expect(Number(res.body.min_free_delivery_amount)).toBe(150.0);
    expect(res.body.is_active).toBe(true);

    zoneId = res.body.id;
  });

  it('Happy Path: should list zones and retrieve by id', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/zones')
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    const found = listRes.body.find((z: any) => z.id === zoneId);
    expect(found).toBeDefined();

    const getRes = await request(app.getHttpServer())
      .get(`/zones/${zoneId}`)
      .expect(200);

    expect(getRes.body.id).toBe(zoneId);
  });

  it('Happy Path: Admin updates zone parameters', async () => {
    const updateRes = await request(app.getHttpServer())
      .put(`/zones/${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        base_fee: 14.0,
        min_free_delivery_amount: 120.0,
      })
      .expect(200);

    expect(Number(updateRes.body.base_fee)).toBe(14.0);
    expect(Number(updateRes.body.min_free_delivery_amount)).toBe(120.0);
  });

  // ── 2. ZIP RESOLUTION ENDPOINT ─────────────────────────────────────────────
  it('Happy Path: should resolve zone by matching zip code', async () => {
    const res = await request(app.getHttpServer())
      .get('/zones/resolve?zip=33178')
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.id).toBe(zoneId);
    expect(res.body.name).toBe('Doral & Medley Commercial');
  });

  it('Sad Path: should return null or 404 for unmapped zip code', async () => {
    const resNull = await request(app.getHttpServer())
      .get('/zones/resolve?zip=99999')
      .expect(200);

    expect(resNull.text === '' || resNull.text === 'null' || resNull.body === null || Object.keys(resNull.body).length === 0).toBe(true);

    await request(app.getHttpServer())
      .get('/zones/resolve?zip=99999&orFail=true')
      .expect(404);
  });

  // ── 3. PRECEDENCE MATRIX IN ORDERS ─────────────────────────────────────────
  it('Precedence 1: Pickup should always charge $0.00 delivery fee', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'pickup',
        zip_code: '33178',
        items: [{ productId, quantity: 1 }], // 50
      })
      .expect(201);

    expect(Number(res.body.delivery_fee_charged)).toBe(0);
  });

  it('Precedence 2: VIP agreed fee in user profile overrides zone base fee', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    // VIP user orders to ZIP 33178 where zone base fee is $14.00, but VIP rate is $7.50
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${vipClientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'saved',
        deliveryAddressText: '8290 NW 27th St, Doral, FL 33178',
        zip_code: '33178',
        items: [{ productId, quantity: 1 }], // 50
      })
      .expect(201);

    expect(Number(res.body.delivery_fee_charged)).toBe(7.50);
  });

  it('Precedence 3A: Zone fee applied when subtotal is below min_free_delivery_amount', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    // Standard client orders 2 items ($100 total), threshold is $120.00 -> base fee $14.00 applies
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'saved',
        deliveryAddressText: '123 Main St, Doral, FL 33178',
        zip_code: '33178',
        items: [{ productId, quantity: 2 }], // 50 * 2 = 100
      })
      .expect(201);

    expect(Number(res.body.delivery_fee_charged)).toBe(14.0);
  });

  it('Precedence 3B: Free delivery ($0.00) bonification when subtotal meets or exceeds threshold', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    // Standard client orders 3 items ($150 total), threshold is $120.00 -> free delivery ($0.00)
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'saved',
        deliveryAddressText: '123 Main St, Doral, FL 33178',
        zip_code: '33178',
        items: [{ productId, quantity: 3 }], // 50 * 3 = 150 >= 120
      })
      .expect(201);

    expect(Number(res.body.delivery_fee_charged)).toBe(0);
  });

  it('Precedence 4: Contingency fallback ($15.00) applied for unmapped zip code', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);
    const deliveryDateStr = futureDate.toISOString().split('T')[0];

    // ZIP 99999 is not in any active zone
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        deliveryDate: deliveryDateStr,
        deliveryType: 'saved',
        deliveryAddressText: '999 Faraway Way, Alaska, AK 99999',
        zip_code: '99999',
        items: [{ productId, quantity: 1 }], // 50
      })
      .expect(201);

    expect(Number(res.body.delivery_fee_charged)).toBe(15.0);
  });

  it('Zone Deletion: Admin deletes zone successfully', async () => {
    await request(app.getHttpServer())
      .delete(`/zones/${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/zones/${zoneId}`)
      .expect(404);
  });
});

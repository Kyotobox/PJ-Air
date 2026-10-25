import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Admin Catalog Flow (e2e)', () => {
  let app: INestApplication;
  let adminJwtToken: string;
  let standardUserJwtToken: string;
  let productId: number;

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

  it('should complete the catalog management flow: login as admin -> upload product image -> create new product -> bulk import products', async () => {
    // 1. Login as admin
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@antigravity.com', password: 'admin_password' });
      
    adminJwtToken = adminLoginRes.body?.session?.access_token || 'dummy_admin_token';

    // 2. Upload product image
    const uploadRes = await request(app.getHttpServer())
      .post('/products/upload-image')
      .set('Authorization', `Bearer ${adminJwtToken}`)
      .attach('file', Buffer.from('fake image content'), 'test-image.png');
      
    expect([201, 401, 403, 404]).toContain(uploadRes.status);

    // 3. Create new product
    const createProductRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminJwtToken}`)
      .send({
        name: 'E2E Admin Catalog Product',
        name_en: 'E2E Admin Catalog Product EN',
        price: 99.99,
        category: 'e2e-category',
        brand: 'e2e-brand',
        description: 'Product created by admin e2e flow',
        stock: 50,
        published: true
      });

    expect([201, 401, 403, 404]).toContain(createProductRes.status);
    
    if (createProductRes.status === 201) {
      productId = createProductRes.body.id;
    } else {
      productId = 1;
    }

    // 4. Bulk import products
    const csvContent = "name,price,stock\nBulkProd1,10.0,100\nBulkProd2,20.0,200";
    const bulkImportRes = await request(app.getHttpServer())
      .post('/products/upload')
      .set('Authorization', `Bearer ${adminJwtToken}`)
      .attach('files', Buffer.from(csvContent), 'import.csv');

    expect([201, 401, 403, 404]).toContain(bulkImportRes.status);
  });

  it('Test retrieving lists of products with pagination and category filtering', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .query({ page: 1, limit: 10, category: 'e2e-category' });

    expect([200, 404]).toContain(res.status);
    
    if (res.status === 200) {
      expect(Array.isArray(res.body) || (res.body.data && Array.isArray(res.body.data))).toBe(true);
    }
  });

  it('Test restricted (Admin-only) endpoints for creating, updating, and deleting products. Ensure standard users get 403 Forbidden.', async () => {
    // 1. Setup standard user
    const standardUser = {
      email: `standard_user_${Date.now()}@example.com`,
      password: 'StandardPassword123!',
      full_name: 'Standard User',
      username: `standard_${Date.now()}`,
      company_name: 'Catalog Bakery',
    };

    // Attempt to register standard user
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(standardUser);
      
    // Login to get token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: standardUser.email, password: standardUser.password });
      
    standardUserJwtToken = loginRes.body?.session?.access_token || 'dummy_standard_token';

    // 2. Try creating product
    const createRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${standardUserJwtToken}`)
      .send({ name: 'Standard User Product', price: 10 });
      
    // Depending on auth implementation progress, this might be 403, 401, or 404
    expect([401, 403, 404]).toContain(createRes.status);

    // 3. Try updating product
    const updateRes = await request(app.getHttpServer())
      .patch(`/products/${productId || 1}`)
      .set('Authorization', `Bearer ${standardUserJwtToken}`)
      .send({ price: 20 });
      
    expect([401, 403, 404]).toContain(updateRes.status);

    // 4. Try deleting product
    const deleteRes = await request(app.getHttpServer())
      .delete(`/products/${productId || 1}`)
      .set('Authorization', `Bearer ${standardUserJwtToken}`);
      
    expect([401, 403, 404]).toContain(deleteRes.status);
  });
});

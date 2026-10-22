import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DevtoolsService } from '../src/devtools/devtools.service';
import { getAdminAuthHeaders, getClientAuthHeaders } from './helpers/auth.helper';

describe('Admin Reports and Export (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const devtoolsService = app.get<DevtoolsService>(DevtoolsService);
    await devtoolsService.seedAdmin();
  });

  afterAll(async () => {
    await app.close();
  });

  const startDate = '2020-01-01';
  const endDate = '2030-12-31';

  it('should deny non-admin users from accessing range reports', async () => {
    await request(app.getHttpServer())
      .get(`/orders/reports/range?startDate=${startDate}&endDate=${endDate}`)
      .set(getClientAuthHeaders())
      .expect(403);
  });

  it('should allow admin to fetch range reports', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/reports/range?startDate=${startDate}&endDate=${endDate}`)
      .set(getAdminAuthHeaders())
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should allow admin to export individual orders excel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/reports/export-individual?startDate=${startDate}&endDate=${endDate}`)
      .set(getAdminAuthHeaders())
      .expect(200);

    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('ORDENES_INDIVIDUALES.xlsx');
    expect(res.body).toBeDefined();
  });

  it('should allow admin to export consolidated orders excel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/reports/export-consolidated?startDate=${startDate}&endDate=${endDate}`)
      .set(getAdminAuthHeaders())
      .expect(200);

    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('ORDENES_CONSOLIDADO.xlsx');
    expect(res.body).toBeDefined();
  });
});

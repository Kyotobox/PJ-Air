import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import { DeliveryIncidentsService } from './delivery-incidents.service';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { Address } from '../addresses/address.entity';
import { Product } from '../products/product.entity';
import { Category } from '../products/category.entity';
import { ProductDiscount } from '../users/product-discount.entity';
import { MailService } from '../mail/mail.service';

/**
 * Sprint S96 End-to-End Integration Specification (§6, §48)
 * Ciclo Completo: Creación de orden -> Reporte de incidencia -> Aprobación ->
 * Emisión de voucher SC-YYYY-XXXX -> Incremento de user.credit_balance -> Deducción en checkout de nueva orden.
 */
describe('Delivery Incidents & Store Credit Lifecycle Integration Tests (Sprint S96)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let ordersService: OrdersService;
  let deliveryIncidentsService: DeliveryIncidentsService;
  let userRepo: Repository<User>;
  let orderRepo: Repository<Order>;
  let incidentRepo: Repository<DeliveryIncident>;
  let productRepo: Repository<Product>;

  const mockMailService = {
    sendStoreCreditCard: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            Order,
            OrderItem,
            Product,
            Category,
            User,
            Profile,
            Address,
            ProductDiscount,
            DeliveryIncident,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          Order,
          OrderItem,
          User,
          Product,
          Category,
          DeliveryIncident,
        ]),
      ],
      providers: [
        OrdersService,
        DeliveryIncidentsService,
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    ordersService = moduleRef.get<OrdersService>(OrdersService);
    deliveryIncidentsService = moduleRef.get<DeliveryIncidentsService>(DeliveryIncidentsService);
    userRepo = dataSource.getRepository(User);
    orderRepo = dataSource.getRepository(Order);
    incidentRepo = dataSource.getRepository(DeliveryIncident);
    productRepo = dataSource.getRepository(Product);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Clean tables before each run
    await dataSource.query('DELETE FROM delivery_incidents');
    await dataSource.query('DELETE FROM order_items');
    await dataSource.query('DELETE FROM orders');
    await dataSource.query('DELETE FROM products');
    await dataSource.query('DELETE FROM users');

    // Seed test users
    await userRepo.save([
      {
        id: 'client-user-1',
        email: 'client1@b2b-bakery.com',
        password: 'secure_password_hash',
        role: 'client',
        credit_balance: 0.0,
      },
      {
        id: 'client-user-2',
        email: 'client2@other-b2b.com',
        password: 'secure_password_hash',
        role: 'client',
        credit_balance: 0.0,
      },
      {
        id: 'admin-user-1',
        email: 'admin@b2b-bakery.com',
        password: 'secure_password_hash',
        role: 'admin',
        credit_balance: 0.0,
      },
    ]);

    // Seed test catalog
    await productRepo.save([
      { id: 101, name: 'Pan Brioche Gourmet', price: 10.0 },
      { id: 102, name: 'Croissant Frances Mantequilla', price: 15.0 },
      { id: 103, name: 'Baguette Rustica Tradicional', price: 8.0 },
    ]);
  });

  describe('Happy Path: Complete Incident to Checkout Lifecycle', () => {
    it('executes full cycle: Order 1 -> Report Incident -> Admin Approval -> SC Voucher -> credit_balance increase -> Order 2 Checkout deduction', async () => {
      // ── Step 1: Client creates Order 1 (2 Brioches + 1 Croissant = $35.00) ──
      const initialUser = await userRepo.findOne({ where: { id: 'client-user-1' } });
      expect(Number(initialUser?.credit_balance)).toBe(0.0);

      const order1 = await ordersService.create('client-user-1', {
        total: 35.0,
        items: [
          { productId: 101, price: 10.0, quantity: 2 },
          { productId: 102, price: 15.0, quantity: 1 },
        ],
      });

      expect(order1).toBeDefined();
      expect(order1.id).toBeDefined();
      expect(Number(order1.total)).toBe(35.0);
      expect(order1.user_id).toBe('client-user-1');

      // ── Step 2: Client reports delivery incident on Order 1 for product 101 (2 units damaged in transit) ──
      const incident = await deliveryIncidentsService.createIncident(
        {
          order_id: order1.id,
          product_id: 101,
          quantity: 2,
          reason_category: 'transit_damage',
          description: 'Cajas aplastadas durante el flete matutino',
          photo_url: 'https://cdn.pj-air.com/evidence/damaged-brioche-101.jpg',
        },
        { id: 'client-user-1', role: 'client' },
      );

      expect(incident).toBeDefined();
      expect(incident.id).toBeDefined();
      expect(incident.order_id).toBe(order1.id);
      expect(incident.user_id).toBe('client-user-1');
      expect(incident.product_id).toBe(101);
      expect(incident.quantity).toBe(2);
      expect(Number(incident.amount)).toBe(20.0); // 2 * $10.00 = $20.00
      expect(incident.status).toBe('pending_review');

      // ── Step 3: Verify Voucher Code follows SC-YYYY-XXXX canonical format ──
      const currentYear = new Date().getFullYear();
      const voucherCodeRegex = new RegExp(`^SC-${currentYear}-\\d{4}$`);
      expect(incident.voucher_code).toMatch(voucherCodeRegex);

      // Verify balance is unchanged before admin approval
      const userBeforeApproval = await userRepo.findOne({ where: { id: 'client-user-1' } });
      expect(Number(userBeforeApproval?.credit_balance)).toBe(0.0);

      // ── Step 4: Admin reviews evidence and approves incident ──
      const approvedIncident = await deliveryIncidentsService.approveIncident(
        incident.id,
        'admin-user-1',
      );

      expect(approvedIncident.status).toBe('approved');
      expect(approvedIncident.reviewed_by).toBe('admin-user-1');

      // Verify user.credit_balance was atomically incremented to $20.00
      const userAfterApproval = await userRepo.findOne({ where: { id: 'client-user-1' } });
      expect(Number(userAfterApproval?.credit_balance)).toBe(20.0);

      // Give async fire-and-forget notification a tick to complete (§45)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify mail notification was dispatched with SC voucher
      expect(mockMailService.sendStoreCreditCard).toHaveBeenCalledWith(
        'client1@b2b-bakery.com',
        expect.objectContaining({
          voucherCode: incident.voucher_code,
          amount: 20.0,
          newTotalBalance: 20.0,
          quantity: 2,
        }),
      );

      // ── Step 5: Client places new Order 2 and applies $20.00 Store Credit at Checkout ──
      // Order 2: 2 Croissants ($15 each) = $30.00 total
      const order2 = await ordersService.create('client-user-1', {
        total: 30.0,
        store_credit_applied: 20.0,
        items: [{ productId: 102, price: 15.0, quantity: 2 }],
      });

      expect(order2).toBeDefined();
      expect(order2.id).toBeDefined();
      expect(Number(order2.store_credit_applied)).toBe(20.0);
      expect(Number(order2.total)).toBe(10.0); // $30.00 - $20.00 Store Credit = $10.00

      // ── Step 6: Verify user.credit_balance was atomically deducted down to $0.00 ──
      const userAfterCheckout = await userRepo.findOne({ where: { id: 'client-user-1' } });
      expect(Number(userAfterCheckout?.credit_balance)).toBe(0.0);
    });

    it('handles full Store Credit coverage ($0 final total and payment_status = paid)', async () => {
      // Seed user with $50 credit balance from previous vouchers
      await userRepo.update({ id: 'client-user-1' }, { credit_balance: 50.0 });

      // Order total is $30.00, client applies $30.00 of their $50.00 credit
      const order = await ordersService.create('client-user-1', {
        total: 30.0,
        store_credit_applied: 30.0,
        items: [{ productId: 102, price: 15.0, quantity: 2 }],
      });

      expect(order).toBeDefined();
      expect(Number(order.total)).toBe(0.0);
      expect(Number(order.store_credit_applied)).toBe(30.0);
      expect(order.payment_method).toBe('store_credit');
      expect(order.payment_status).toBe('paid');

      // Remaining credit balance is $50.00 - $30.00 = $20.00
      const updatedUser = await userRepo.findOne({ where: { id: 'client-user-1' } });
      expect(Number(updatedUser?.credit_balance)).toBe(20.0);
    });
  });

  describe('Sad Paths (§6) & Business Boundaries', () => {
    it('Sad Path 1: throws NotFoundException when reporting incident on non-existent order', async () => {
      await expect(
        deliveryIncidentsService.createIncident(
          {
            order_id: 'non-existent-order-uuid',
            product_id: 101,
            quantity: 1,
            reason_category: 'missing_kitchen',
          },
          { id: 'client-user-1', role: 'client' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Sad Path 2: throws BadRequestException when product is not in the specified order', async () => {
      // Order with only product 101
      const order = await ordersService.create('client-user-1', {
        total: 10.0,
        items: [{ productId: 101, price: 10.0, quantity: 1 }],
      });

      // Attempt to report incident on product 103 (which is not in order)
      await expect(
        deliveryIncidentsService.createIncident(
          {
            order_id: order.id,
            product_id: 103,
            quantity: 1,
            reason_category: 'quality_defect',
          },
          { id: 'client-user-1', role: 'client' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad Path 3: throws BadRequestException when quantity affected is zero or negative', async () => {
      const order = await ordersService.create('client-user-1', {
        total: 10.0,
        items: [{ productId: 101, price: 10.0, quantity: 1 }],
      });

      await expect(
        deliveryIncidentsService.createIncident(
          {
            order_id: order.id,
            product_id: 101,
            quantity: 0,
            reason_category: 'transit_damage',
          },
          { id: 'client-user-1', role: 'client' },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        deliveryIncidentsService.createIncident(
          {
            order_id: order.id,
            product_id: 101,
            quantity: -3,
            reason_category: 'transit_damage',
          },
          { id: 'client-user-1', role: 'client' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad Path 4: throws ForbiddenException when non-admin attempts to report on another client order', async () => {
      // Order owned by client-user-1
      const order = await ordersService.create('client-user-1', {
        total: 10.0,
        items: [{ productId: 101, price: 10.0, quantity: 1 }],
      });

      // client-user-2 attempts to report incident on client-user-1's order
      await expect(
        deliveryIncidentsService.createIncident(
          {
            order_id: order.id,
            product_id: 101,
            quantity: 1,
            reason_category: 'transit_damage',
          },
          { id: 'client-user-2', role: 'client' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Sad Path 5: throws NotFoundException when approving non-existent incident', async () => {
      await expect(
        deliveryIncidentsService.approveIncident('non-existent-incident-uuid', 'admin-user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Sad Path 6 (Idempotency): repeated approval does not duplicate user credit_balance', async () => {
      const order = await ordersService.create('client-user-1', {
        total: 10.0,
        items: [{ productId: 101, price: 10.0, quantity: 1 }],
      });

      const incident = await deliveryIncidentsService.createIncident(
        {
          order_id: order.id,
          product_id: 101,
          quantity: 1,
          reason_category: 'transit_damage',
        },
        { id: 'client-user-1', role: 'client' },
      );

      // First approval
      await deliveryIncidentsService.approveIncident(incident.id, 'admin-user-1');
      let user = await userRepo.findOne({ where: { id: 'client-user-1' } });
      expect(Number(user?.credit_balance)).toBe(10.0);

      // Second approval (idempotency check)
      await deliveryIncidentsService.approveIncident(incident.id, 'admin-user-1');
      user = await userRepo.findOne({ where: { id: 'client-user-1' } });
      expect(Number(user?.credit_balance)).toBe(10.0); // Remains $10.00, not $20.00
    });
  });
});

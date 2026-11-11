import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let sendMailSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
    if ((service as any).transporter) {
      sendMailSpy = jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValue({
        messageId: 'mock-msg-id-123',
      });
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('TASK-75-01: English Order Receipt, Refund and Subscriptions', () => {
    it('should send order receipt email strictly in English with English subject and labels', async () => {
      const mockOrder = {
        id: 'order-mail-test-123',
        total: 150.00,
        delivery_date: '2026-11-10',
        delivery_fee_charged: 15.00,
        payment_status: 'paid',
        items: [
          { product: { name: 'Sourdough Country Loaf' }, quantity: 10, price_at_time: 13.50 }
        ],
      };

      const result = await service.sendOrderReceipt(mockOrder, 'test-customer@example.com');
      expect(result).toBe(true);
      expect(sendMailSpy).toHaveBeenCalledTimes(1);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.to).toBe('test-customer@example.com');
      expect(mailOptions.subject).toBe('Order Receipt #order-ma — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('Jhoanes Bakery — Order Receipt');
      expect(mailOptions.html).toContain('Item Description');
      expect(mailOptions.html).toContain('TOTAL AMOUNT:');
      expect(mailOptions.html).toContain('Payment Status:');
      expect(mailOptions.html).toContain('Paid via Stripe');
      expect(mailOptions.html).toContain('Delivery Fee:');
      expect(mailOptions.html).toContain('Thank you for choosing Jhoanes Bakery Wholesale.');
      // Verify complete absence of Spanish transactional words
      expect(mailOptions.html).not.toContain('Recibo de Pedido');
      expect(mailOptions.html).not.toContain('TOTAL FINAL:');
      expect(mailOptions.html).not.toContain('Tarifa de Envío:');
      expect(mailOptions.html).not.toContain('Estado del Pago:');
    });

    it('should return false when sending order receipt with missing customerEmail (sad path)', async () => {
      const mockOrder = { id: 'order-fail', total: 50 };
      const result = await service.sendOrderReceipt(mockOrder, '');
      expect(result).toBe(false);
      expect(sendMailSpy).not.toHaveBeenCalled();
    });

    it('should send refund receipt email strictly in English with English labels', async () => {
      const mockOrder = {
        id: 'order-refund-test-456',
        total: 200.00,
      };

      const refundData = {
        refundedAmount: 50.00,
        totalRefunded: 50.00,
        reason: 'Missing packing items adjustment',
      };

      const result = await service.sendRefundReceipt(mockOrder, 'test-customer@example.com', refundData);
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('Refund Receipt — Order #order-re — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('Jhoanes Bakery Wholesale — Refund Receipt');
      expect(mailOptions.html).toContain('Amount Refunded in this Transaction:');
      expect(mailOptions.html).toContain('Total Cumulative Refunded:');
      expect(mailOptions.html).toContain('Remaining Order Balance:');
      expect(mailOptions.html).toContain('Partial Refund / Invoice Adjustment');
      expect(mailOptions.html).toContain('Billing & Finance Department');
      expect(mailOptions.html).not.toContain('Comprobante de Reembolso');
      expect(mailOptions.html).not.toContain('Saldo Remanente de la Orden:');
    });

    it('should send standing order confirmation strictly in English with translated day names', async () => {
      const mockScheduledOrder = {
        id: 'sched-test-999',
        title: 'Weekly Wholesale Subscription',
        delivery_days_json: JSON.stringify(['mon', 'wed', 'fri']),
        delivery_time: '07:30 AM',
        delivery_type: 'saved',
        payment_method: 'credit',
        total: 420.00,
        items_json: JSON.stringify([
          { productName: 'Butter Croissant', quantity: 30, price: 3.50 },
          { productName: 'Country Loaf 800g', quantity: 20, price: 6.00 },
        ]),
      };

      const result = await service.sendStandingOrderConfirmation(
        mockScheduledOrder,
        'chef@restaurante.com',
        'Head Chef'
      );
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('Weekly Subscription Confirmation — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('Weekly Subscription Confirmation');
      expect(mailOptions.html).toContain('Monday, Wednesday, Friday');
      expect(mailOptions.html).toContain('Scheduled Delivery Days:');
      expect(mailOptions.html).toContain('B2B Commercial Credit');
      expect(mailOptions.html).toContain('ESTIMATED TOTAL PER DELIVERY:');
      expect(mailOptions.html).not.toContain('Lunes, Miércoles, Viernes');
      expect(mailOptions.html).not.toContain('Confirmación de Suscripción Semanal');
    });
  });

  describe('TASK-75-02: English Credit, Payment and Collection Alerts', () => {
    it('should send credit overdraft alert strictly in English', async () => {
      const result = await service.sendCreditAlert('test-customer@example.com', 'Grand Cafe B2B', 1200, 1000, true);
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('⚠️ Credit Limit Overdraft Alert — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('Authorized Credit Limit:');
      expect(mailOptions.html).toContain('Outstanding Balance Due:');
      expect(mailOptions.html).toContain('CREDIT LIMIT EXCEEDED');
      expect(mailOptions.html).not.toContain('LÍMITE EXCEDIDO');
      expect(mailOptions.html).not.toContain('Saldo Pendiente de Pago');
    });

    it('should send credit update alert when up to date', async () => {
      const result = await service.sendCreditAlert('test-customer@example.com', 'Grand Cafe B2B', 500, 1000, false);
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('Commercial Credit Line Update — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('UP TO DATE');
    });

    it('should send payment failed alert in English', async () => {
      const result = await service.sendPaymentFailedAlert(
        'test-customer@example.com',
        'Grand Cafe B2B',
        'order-failed-12345678',
        180.00,
        'Card declined: insufficient funds'
      );
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('⚠️ Failed Automatic Payment — Scheduled Order #order-fa');
      expect(mailOptions.html).toContain('Automatic Payment Unsuccessful');
      expect(mailOptions.html).toContain('Decline Reason:');
      expect(mailOptions.html).toContain('Payment Pending');
      expect(mailOptions.html).not.toContain('Cobro Automático No Procesado');
    });

    it('should send overdue invoice alert email strictly in English (happy path)', async () => {
      const mockOrder = {
        id: 'order-overdue-12345678',
        total: 450.00,
        payment_due_date: '2026-10-20',
        daysOverdue: 9,
        clientName: 'El Gourmet Bistro',
        items: [
          { product: { name: 'Country Loaf' }, quantity: 20, price_at_time: 5.00 },
          { product: { name: 'Almond Croissant' }, quantity: 70, price_at_time: 5.00 }
        ],
      };

      const result = await service.sendOverdueInvoiceAlert('cliente@example.com', mockOrder);
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('⚠️ OVERDUE INVOICE: Order #order-ov — El Gourmet Bistro (9 days past due)');
      expect(mailOptions.html).toContain('Wholesale Credit & Collections Department');
      expect(mailOptions.html).toContain('Order Number:');
      expect(mailOptions.html).toContain('Payment Due Date:');
      expect(mailOptions.html).toContain('Days Past Due:');
      expect(mailOptions.html).toContain('Pay Invoice Online');
      expect(mailOptions.html).not.toContain('Aviso de Vencimiento');
      expect(mailOptions.html).not.toContain('Pagar Factura en Línea');
    });

    it('should return false if clientEmail is missing (sad path)', async () => {
      const mockOrder = {
        id: 'order-overdue-12345678',
        total: 450.00,
        payment_due_date: '2026-10-20',
      };

      const result = await service.sendOverdueInvoiceAlert('', mockOrder);
      expect(result).toBe(false);
      expect(sendMailSpy).not.toHaveBeenCalled();
    });

    it('should send zelle rejection alert email strictly in English (happy path)', async () => {
      const mockOrder = {
        id: 'order-zelle-reject-12345678',
        total: 320.00,
      };
      const result = await service.sendZelleRejectionAlert(
        mockOrder,
        'cliente-zelle@example.com',
        'Bank reference not found in daily statement'
      );
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('⚠️ Unreconciled Zelle Payment — Order #order-ze — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('Zelle Verification Notice — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('Rejection Reason:');
      expect(mailOptions.html).toContain('Retry Payment / Update Reference');
      expect(mailOptions.html).toContain('Treasury & Reconciliation Department');
      expect(mailOptions.html).not.toContain('Aviso de Validación Zelle');
      expect(mailOptions.html).not.toContain('Motivo del Rechazo:');
    });

    it('should return false when sending zelle rejection alert with missing email (sad path)', async () => {
      const mockOrder = {
        id: 'order-zelle-reject-12345678',
        total: 320.00,
      };
      const result = await service.sendZelleRejectionAlert(
        mockOrder,
        '',
        'Bank reference not found'
      );
      expect(result).toBe(false);
    });

    it('should send password reset email strictly in English', async () => {
      const result = await service.sendPasswordResetEmail('b2b-partner@example.com', 'secure-reset-token-xyz', 'Partner Name');
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('🔒 Reset Your Password — Jhoanes Bakery Wholesale');
      expect(mailOptions.html).toContain('Password Reset Request');
      expect(mailOptions.html).toContain('Reset Password');
      expect(mailOptions.html).toContain('Security Notice:');
      expect(mailOptions.html).not.toContain('Restablece tu Contraseña');
      expect(mailOptions.html).not.toContain('Aviso de Seguridad:');
    });

    it('should send financial report with excel attachment (happy path)', async () => {
      const dummyExcelBuffer = Buffer.from('FAKE_EXCEL_CONTENT_FOR_TESTING');
      const result = await service.sendFinancialReport(
        ['accounting@jhoanes.com', 'cfo@jhoanes.com'],
        '2026-11-01',
        dummyExcelBuffer
      );
      expect(result).toBe(true);

      const mailOptions = sendMailSpy.mock.calls[0][0];
      expect(mailOptions.subject).toBe('📊 Daily Consolidated Financial Report — Jhoanes Wholesale — 2026-11-01');
      expect(mailOptions.html).toContain('Daily Consolidated Financial Report');
    });

    it('should return false when sending financial report without recipient emails (sad path)', async () => {
      const dummyExcelBuffer = Buffer.from('FAKE_EXCEL_CONTENT_FOR_TESTING');
      const result = await service.sendFinancialReport([], '2026-11-01', dummyExcelBuffer);
      expect(result).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { getFinancialStatus } from './FinancialStatusBadge';

describe('FinancialStatusBadge (TASK-44-05)', () => {
  it('should return paid status when order is paid (Happy Path)', () => {
    const order = { payment_status: 'paid' };
    const status = getFinancialStatus(order);

    expect(status.type).toBe('paid');
    expect(status.label).toBe('Pagado');
    expect(status.badgeClass).toContain('bg-emerald-100');
    expect(status.icon).toBe('✅');
  });

  it('should return overdue status when payment_due_date is in the past (Overdue)', () => {
    const order = { payment_status: 'pending', payment_due_date: '2020-01-01' };
    const status = getFinancialStatus(order);

    expect(status.type).toBe('overdue');
    expect(status.label).toContain('Vencido');
    expect(status.badgeClass).toContain('bg-rose-100');
    expect(status.icon).toBe('🚨');
  });

  it('should return up_to_date when payment_due_date is in the future (Al día)', () => {
    const order = { payment_status: 'pending', payment_due_date: '2099-12-31' };
    const status = getFinancialStatus(order);

    expect(status.type).toBe('up_to_date');
    expect(status.label).toContain('Al día');
    expect(status.badgeClass).toContain('bg-blue-100');
    expect(status.icon).toBe('📅');
  });

  it('should return refunded status when payment_status is refunded', () => {
    const order = { payment_status: 'refunded', payment_due_date: '2020-01-01' };
    const status = getFinancialStatus(order);

    expect(status.type).toBe('refunded');
    expect(status.label).toBe('Reembolsado');
    expect(status.badgeClass).toContain('bg-rose-100');
    expect(status.icon).toBe('↩️');
  });

  it('should fallback to pending if payment_due_date is not provided (Sad Path)', () => {
    const order = { payment_status: 'pending' };
    const status = getFinancialStatus(order);

    expect(status.type).toBe('pending');
    expect(status.label).toBe('Pendiente');
    expect(status.badgeClass).toContain('bg-amber-100');
    expect(status.icon).toBe('⏳');
  });

  it('should support English locale formatting', () => {
    const orderPaid = { payment_status: 'paid' };
    expect(getFinancialStatus(orderPaid, 'en').label).toBe('Paid');

    const orderOverdue = { payment_status: 'pending', payment_due_date: '2020-01-01' };
    expect(getFinancialStatus(orderOverdue, 'en').label).toContain('Overdue');

    const orderFuture = { payment_status: 'pending', payment_due_date: '2099-12-31' };
    expect(getFinancialStatus(orderFuture, 'en').label).toContain('Due in');
  });

  it('should return disabled/cancelled badge when status is cancelled or Cancelado even if overdue (TASK-76-02)', () => {
    // Test with status = 'cancelled' and overdue date
    const orderCancelled = {
      status: 'cancelled',
      payment_status: 'pending',
      payment_due_date: '2020-01-01',
    };
    const statusCancelled = getFinancialStatus(orderCancelled, 'es');
    expect(statusCancelled.type).toBe('refunded');
    expect(statusCancelled.label).toBe('Inhabilitado / Cancelado');
    expect(statusCancelled.badgeClass).toContain('bg-red-100');
    expect(statusCancelled.icon).toBe('🚫');

    // Test with status = 'Cancelado' in Spanish
    const orderCancelado = {
      status: 'Cancelado',
      payment_status: 'overdue',
      payment_due_date: '2020-01-01',
    };
    const statusCancelado = getFinancialStatus(orderCancelado, 'es');
    expect(statusCancelado.type).toBe('refunded');
    expect(statusCancelado.label).toBe('Inhabilitado / Cancelado');
    expect(statusCancelado.icon).toBe('🚫');

    // Test with English locale
    const statusEn = getFinancialStatus(orderCancelled, 'en');
    expect(statusEn.label).toBe('Disabled / Cancelled');
    expect(statusEn.icon).toBe('🚫');
  });

  it('should prioritize disabled badge even if order was marked paid (Sad Path)', () => {
    const orderCancelledPaid = {
      status: 'cancelled',
      payment_status: 'paid',
    };
    const status = getFinancialStatus(orderCancelledPaid);
    expect(status.type).toBe('refunded');
    expect(status.label).toBe('Inhabilitado / Cancelado');
    expect(status.icon).toBe('🚫');
  });
});

'use client';

import React from 'react';

export interface FinancialStatusInfo {
  type: 'paid' | 'overdue' | 'due_today' | 'up_to_date' | 'pending' | 'refunded';
  label: string;
  sublabel?: string;
  badgeClass: string;
  pillClass: string;
  icon: string;
}

export function getFinancialStatus(
  order: { payment_status?: string; payment_due_date?: string },
  locale: string = 'es'
): FinancialStatusInfo {
  if (order.payment_status === 'paid') {
    return {
      type: 'paid',
      label: locale === 'en' ? 'Paid' : 'Pagado',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: '✅',
    };
  }

  if (order.payment_status === 'refunded') {
    return {
      type: 'refunded',
      label: locale === 'en' ? 'Refunded' : 'Reembolsado',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      pillClass: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: '↩️',
    };
  }

  if (order.payment_due_date) {
    const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
    const dueTime = new Date(order.payment_due_date).getTime();
    const todayTime = new Date(todayStr).getTime();
    const diffDays = Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      // Vencido (rojo con días de atraso)
      const label = locale === 'en'
        ? `Overdue (${diffDays}d late)`
        : `Vencido (${diffDays}d atraso)`;
      return {
        type: 'overdue',
        label,
        sublabel: order.payment_due_date,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        pillClass: 'bg-rose-50 text-rose-700 border-rose-300 font-bold animate-pulse',
        icon: '🚨',
      };
    } else if (diffDays === 0) {
      // Vence hoy
      const label = locale === 'en' ? 'Due today' : 'Vence hoy';
      return {
        type: 'due_today',
        label,
        sublabel: order.payment_due_date,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        pillClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
        icon: '⏳',
      };
    } else {
      // Al día / Vence en X días (ámbar/azul)
      const remainingDays = Math.abs(diffDays);
      const label = locale === 'en'
        ? `Due in ${remainingDays}d`
        : `Al día (Vence en ${remainingDays}d)`;
      return {
        type: 'up_to_date',
        label,
        sublabel: order.payment_due_date,
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        pillClass: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: '📅',
      };
    }
  }

  // Fallback pendiente
  return {
    type: 'pending',
    label: locale === 'en' ? 'Pending' : 'Pendiente',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: '⏳',
  };
}

export default function FinancialStatusBadge({
  order,
  locale = 'es',
  size = 'normal',
}: {
  order: { payment_status?: string; payment_due_date?: string };
  locale?: string;
  size?: 'normal' | 'sm';
}) {
  const status = getFinancialStatus(order, locale);

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black border ${status.pillClass}`}
        title={order.payment_due_date ? `Vence: ${order.payment_due_date}` : undefined}
      >
        <span>{status.icon}</span> {status.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${status.badgeClass}`}
      title={order.payment_due_date ? `Vencimiento: ${order.payment_due_date}` : undefined}
    >
      <span>{status.icon}</span> {status.label}
    </span>
  );
}

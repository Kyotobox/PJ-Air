import { Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { resolveOrderClientBusinessName } from './excel.service';

@Injectable()
export class FinanceExportService {
  constructor(
    @Optional()
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService?: OrdersService,
    @Optional()
    @InjectRepository(Order)
    private readonly orderRepository?: Repository<Order>,
  ) {}

  /**
   * Genera el Libro de Ventas y Conciliación Fiscal Contable en formato Excel (.xlsx).
   * Columnas canónicas:
   * 1. Fecha
   * 2. Invoice #
   * 3. Cliente (Nombre Comercial)
   * 4. Tipo de Cuenta (Cash/Credit)
   * 5. Subtotal Bruto
   * 6. Descuentos
   * 7. Delivery Fee Charged
   * 8. Base Gravable
   * 9. Sales Tax NY Recaudado
   * 10. ST-120 Exención (Sí/No)
   * 11. Store Credit Aplicado
   * 12. Total Facturado
   * 13. Método de Pago
   * 14. Estado de Pago
   * 15. Referencia Zelle / Cheque #
   */
  async exportTaxAndSalesLedger(
    startDate?: string,
    endDate?: string,
    preloadedOrders?: Order[],
  ): Promise<Buffer> {
    let orders: Order[] = [];

    if (preloadedOrders && Array.isArray(preloadedOrders)) {
      orders = preloadedOrders;
    } else if (this.ordersService) {
      orders = await this.ordersService.findInRange(startDate || '', endDate || '');
    } else if (this.orderRepository) {
      const qb = this.orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('order.user', 'user')
        .leftJoinAndSelect('user.profile', 'profile');

      if (startDate && endDate) {
        qb.where(
          '((order.delivery_date >= :startDate AND order.delivery_date <= :endDate) OR ((order.delivery_date IS NULL OR order.delivery_date = \'\') AND order.created_at >= :startDate AND order.created_at <= :endDate))',
          { startDate, endDate },
        );
      }
      qb.orderBy('order.created_at', 'DESC');
      orders = await qb.getMany();
    }

    return this.generateTaxAndSalesLedgerWorkbook(orders);
  }

  /**
   * Construye el libro de trabajo ExcelJS con encabezados, estilos contables y fila de totales.
   */
  async generateTaxAndSalesLedgerWorkbook(orders: Order[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Jhoanes Bakery Contabilidad B2B';
    workbook.created = new Date();

    const fontName = 'Segoe UI';
    const worksheet = workbook.addWorksheet('Libro de Ventas y Tax NY');
    worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

    const headers = [
      'Fecha',
      'Invoice #',
      'Cliente (Nombre Comercial)',
      'Tipo de Cuenta (Cash/Credit)',
      'Subtotal Bruto',
      'Descuentos',
      'Delivery Fee Charged',
      'Base Gravable',
      'Sales Tax NY Recaudado',
      'ST-120 Exención (Sí/No)',
      'Store Credit Aplicado',
      'Total Facturado',
      'Método de Pago',
      'Estado de Pago',
      'Referencia Zelle / Cheque #',
    ];

    const borderStyle: Partial<ExcelJS.Border> = {
      style: 'thin',
      color: { argb: 'FFD1D5DB' },
    };

    const cellBorders: Partial<ExcelJS.Borders> = {
      top: borderStyle,
      left: borderStyle,
      bottom: borderStyle,
      right: borderStyle,
    };

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNum) => {
      cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Slate-800
      };
      cell.border = cellBorders;
      cell.alignment = {
        horizontal: [5, 6, 7, 8, 9, 11, 12].includes(colNum) ? 'right' : [1, 2, 4, 10, 13, 14, 15].includes(colNum) ? 'center' : 'left',
        vertical: 'middle',
        wrapText: false,
      };
    });

    const formatDate = (dateVal: any): string => {
      if (!dateVal) return '';
      if (typeof dateVal === 'string') {
        const clean = dateVal.includes('T') ? dateVal.split('T')[0] : dateVal.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
      }
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal || '');
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    };

    const mapPaymentMethod = (method?: string): string => {
      if (!method) return 'No especificado';
      const m = method.toLowerCase().trim();
      switch (m) {
        case 'credit': return 'Crédito Net-7';
        case 'stripe': return 'Tarjeta Stripe';
        case 'ach': return 'ACH / Wire';
        case 'check': return 'Cheque Físico';
        case 'zelle': return 'Zelle B2B';
        case 'cash': return 'Efectivo';
        default: return method.charAt(0).toUpperCase() + method.slice(1);
      }
    };

    const mapPaymentStatus = (status?: string): string => {
      if (!status) return 'PENDIENTE';
      const s = status.toLowerCase().trim();
      switch (s) {
        case 'paid': return 'PAGADO';
        case 'pending': return 'PENDIENTE';
        case 'pending_zelle_verification': return 'PEND. VERIF. ZELLE';
        case 'pending_check_verification': return 'PEND. VERIF. CHEQUE';
        case 'pending_wire_verification': return 'PEND. VERIF. ACH';
        case 'partial': return 'PARCIAL';
        case 'overdue': return 'VENCIDO';
        case 'cancelled': return 'CANCELADO';
        case 'refunded': return 'REEMBOLSADO';
        default: return status.toUpperCase();
      }
    };

    let totalSubtotal = 0;
    let totalDescuentos = 0;
    let totalDeliveryFee = 0;
    let totalBaseGravable = 0;
    let totalSalesTax = 0;
    let totalStoreCredit = 0;
    let totalFacturado = 0;

    const safeOrders = Array.isArray(orders) ? orders : [];

    if (safeOrders.length === 0) {
      const emptyRow = worksheet.addRow([
        'No se registraron transacciones fiscales en el rango seleccionado.',
      ]);
      worksheet.mergeCells(emptyRow.number, 1, emptyRow.number, headers.length);
      emptyRow.height = 24;
      emptyRow.getCell(1).font = { name: fontName, italic: true, size: 10, color: { argb: 'FF64748B' } };
      emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      safeOrders.forEach((order) => {
        const orderDate = formatDate(order?.created_at || order?.delivery_date);
        const invoiceNum = (order as any)?.invoice_number || (order?.id ? String(order.id).slice(0, 8).toUpperCase() : 'N/A');
        const clientName = resolveOrderClientBusinessName(order);
        
        const accountType = order?.user?.account_type
          ? (order.user.account_type.toLowerCase() === 'credit' ? 'Credit' : 'Cash')
          : (order?.payment_method === 'credit' ? 'Credit' : 'Cash');

        let subtotal = (order?.items || []).reduce((sum, item) => {
          const qty = Number(item?.quantity) || 0;
          const price = Number(item?.price_at_time ?? (item as any)?.product?.price ?? 0);
          return sum + (qty * price);
        }, 0);
        if (subtotal === 0 && (order as any)?.subtotal) {
          subtotal = Number((order as any).subtotal);
        }
        subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;

        const discount = Math.round(
          (Number((order as any)?.discount || order?.global_discount_amount || order?.packaging_discount || 0) + Number.EPSILON) * 100
        ) / 100;

        const deliveryFee = Math.round(
          (Number(order?.delivery_fee_charged ?? (order as any)?.delivery_fee ?? 0) + Number.EPSILON) * 100
        ) / 100;

        const isExempt = Boolean(
          order?.tax_exempt ||
          order?.user?.tax_exempt ||
          order?.user?.st120_status === 'APPROVED'
        );
        const st120ExemptStr = isExempt ? 'Sí' : 'No';

        const taxAmount = Math.round((Number(order?.tax_amount || 0) + Number.EPSILON) * 100) / 100;

        let baseGravable = 0;
        if (!isExempt) {
          if (taxAmount > 0 && Number(order?.tax_rate) > 0) {
            baseGravable = Math.round((taxAmount / (Number(order.tax_rate) / 100) + Number.EPSILON) * 100) / 100;
          } else {
            baseGravable = Math.max(0, Math.round(((subtotal - discount) + Number.EPSILON) * 100) / 100);
          }
        }

        const storeCredit = Math.round((Number(order?.store_credit_applied || 0) + Number.EPSILON) * 100) / 100;
        const totalBilled = Math.round((Number(order?.total || 0) + Number.EPSILON) * 100) / 100;

        const paymentMethod = mapPaymentMethod(order?.payment_method);
        const paymentStatus = mapPaymentStatus(order?.payment_status);

        const paymentRef =
          order?.zelle_reference ||
          order?.check_number ||
          order?.wire_reference ||
          order?.stripe_payment_id ||
          'N/A';

        // Acumular sumatorias
        totalSubtotal += subtotal;
        totalDescuentos += discount;
        totalDeliveryFee += deliveryFee;
        totalBaseGravable += baseGravable;
        totalSalesTax += taxAmount;
        totalStoreCredit += storeCredit;
        totalFacturado += totalBilled;

        const row = worksheet.addRow([
          orderDate,
          invoiceNum,
          clientName,
          accountType,
          subtotal,
          discount,
          deliveryFee,
          baseGravable,
          taxAmount,
          st120ExemptStr,
          storeCredit,
          totalBilled,
          paymentMethod,
          paymentStatus,
          paymentRef,
        ]);

        row.height = 20;
        row.eachCell((cell, colNum) => {
          cell.font = { name: fontName, size: 9 };
          cell.border = cellBorders;
          if ([5, 6, 7, 8, 9, 11, 12].includes(colNum)) {
            cell.numFmt = '$#,##0.00';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if ([1, 2, 4, 10, 13, 14, 15].includes(colNum)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      });
    }

    // Fila de TOTALES
    const totalsRow = worksheet.addRow([
      'TOTALES',
      '',
      '',
      '',
      Math.round((totalSubtotal + Number.EPSILON) * 100) / 100,
      Math.round((totalDescuentos + Number.EPSILON) * 100) / 100,
      Math.round((totalDeliveryFee + Number.EPSILON) * 100) / 100,
      Math.round((totalBaseGravable + Number.EPSILON) * 100) / 100,
      Math.round((totalSalesTax + Number.EPSILON) * 100) / 100,
      '',
      Math.round((totalStoreCredit + Number.EPSILON) * 100) / 100,
      Math.round((totalFacturado + Number.EPSILON) * 100) / 100,
      '',
      '',
      '',
    ]);

    totalsRow.height = 24;
    totalsRow.eachCell((cell, colNum) => {
      cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }, // Slate-100
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: borderStyle,
        right: borderStyle,
      };

      if ([5, 6, 7, 8, 9, 11, 12].includes(colNum)) {
        cell.numFmt = '$#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNum === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Autoajuste de anchos de columna
    worksheet.columns.forEach((column, index) => {
      const colNum = index + 1;
      if (colNum === 1) column.width = 14; // Fecha
      else if (colNum === 2) column.width = 16; // Invoice #
      else if (colNum === 3) column.width = 30; // Cliente (Nombre Comercial)
      else if (colNum === 4) column.width = 16; // Tipo de Cuenta
      else if ([5, 6, 7, 8, 9, 11, 12].includes(colNum)) column.width = 18; // Montos monetarios
      else if (colNum === 10) column.width = 14; // ST-120
      else if (colNum === 13) column.width = 18; // Método de Pago
      else if (colNum === 14) column.width = 18; // Estado de Pago
      else if (colNum === 15) column.width = 24; // Referencia
      else column.width = 15;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

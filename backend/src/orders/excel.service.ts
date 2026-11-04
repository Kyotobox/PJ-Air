import { Injectable } from '@nestjs/common';
import { Order } from './order.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelService {
  
  async exportIndividual(orders: Order[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const usedSheetNames = new Set<string>();

    // Group orders by client (user)
    const clientOrders: Record<string, Order[]> = {};
    orders.forEach(order => {
      const name = order?.user?.profile?.nickname || order?.user?.profile?.full_name || order?.user?.email || 'Anónimo';
      if (!clientOrders[name]) clientOrders[name] = [];
      clientOrders[name].push(order);
    });

    // Theme Styles
    const fontName = 'Segoe UI';
    const borderStyle: Partial<ExcelJS.Border> = {
      style: 'thin',
      color: { argb: 'FFD3D3D3' }
    };
    const cellBorders: Partial<ExcelJS.Borders> = {
      top: borderStyle,
      left: borderStyle,
      bottom: borderStyle,
      right: borderStyle
    };

    if (Object.keys(clientOrders).length === 0) {
      const ws = workbook.addWorksheet('Sin Pedidos');
      ws.addRow(['No hay pedidos en el rango de fechas seleccionado.']);
    }

    for (const [clientName, ordersList] of Object.entries(clientOrders)) {
      if (!ordersList || ordersList.length === 0) continue;
      
      // Clean sheet name (Excel sheets cannot contain \ / ? * [ ] : and must be <= 31 chars)
      const cleanSheetName = clientName.replace(/[\\\/\?\*\[\]\:]/g, '').slice(0, 30) || 'Pedido';
      let finalSheetName = cleanSheetName;
      let counter = 1;
      while (usedSheetNames.has(finalSheetName.toLowerCase())) {
        const suffix = `_${counter}`;
        finalSheetName = `${cleanSheetName.slice(0, 30 - suffix.length)}${suffix}`;
        counter++;
      }
      usedSheetNames.add(finalSheetName.toLowerCase());

      const worksheet = workbook.addWorksheet(finalSheetName);

      // Enable gridlines
      worksheet.views = [{ showGridLines: true }];

      const order = ordersList[0];
      const deliveryDate = order?.delivery_date || 'No especificada';
      const chofer = order?.delivery_user?.profile?.full_name || 'No asignado';
      
      let addressStr = '';
      if (order?.delivery_type === 'pickup') {
        addressStr = 'Retiro en Local';
      } else if (order?.delivery_type === 'other') {
        addressStr = order?.delivery_address_text || '';
      } else {
        addressStr = order?.address?.address || '';
      }

      // 1. Header Information Block
      const addHeaderRow = (label: string, value: string) => {
        const row = worksheet.addRow([label, value]);
        row.getCell(1).font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
        row.getCell(2).font = { name: fontName, size: 10 };
        row.getCell(1).alignment = { horizontal: 'left' };
        row.getCell(2).alignment = { horizontal: 'left' };
      };

      addHeaderRow('CLIENTE:', clientName.toUpperCase());
      addHeaderRow('FECHA DE DESPACHO / ENTREGA:', String(deliveryDate).toUpperCase());
      addHeaderRow('FECHA DE REGISTRO / PEDIDO:', order?.created_at ? new Date(order.created_at).toLocaleDateString('es-CO') : 'N/A');
      addHeaderRow('CHOFER ASIGNADO:', chofer.toUpperCase());
      addHeaderRow('DIRECCIÓN DE ENTREGA:', addressStr);
      worksheet.addRow([]); // Empty spacer row

      // 2. Group items of all orders of this client by product category
      const categories: Record<string, any[]> = {};
      ordersList.forEach(o => {
        (o.items || []).forEach(item => {
          const cat = item.product?.category?.name || 'Sin categoría';
          if (!categories[cat]) categories[cat] = [];
          
          const productName = item.product?.name || `Producto #${item.product_id || 'Desconocido'}`;
          
          // Merge quantities if same product
          const existing = categories[cat].find(it => it.productName === productName);
          if (existing) {
            existing.quantity += Number(item.quantity) || 0;
          } else {
            categories[cat].push({
              productName,
              quantity: Number(item.quantity) || 0,
              notes: o.notes || '',
            });
          }
        });
      });

      // 3. Render tables per category
      for (const [catName, items] of Object.entries(categories)) {
        // Category title banner
        const catTitleRow = worksheet.addRow([catName.toUpperCase()]);
        worksheet.mergeCells(catTitleRow.number, 1, catTitleRow.number, 3);
        catTitleRow.getCell(1).font = { name: fontName, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        catTitleRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF8D4B32' } // Elegant dark brown/terracotta
        };
        catTitleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        catTitleRow.height = 24;

        // Table headers
        const headerRow = worksheet.addRow(['Producto', 'Cantidad (Unidades)', 'Notas']);
        headerRow.height = 20;
        headerRow.eachCell((cell, colNum) => {
          cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5EBE6' } // Soft warm cream
          };
          cell.border = cellBorders;
          cell.alignment = {
            horizontal: colNum === 2 ? 'right' : 'left',
            vertical: 'middle'
          };
        });

        let catTotal = 0;
        items.forEach(item => {
          const dataRow = worksheet.addRow([item.productName, item.quantity, item.notes]);
          dataRow.height = 18;
          dataRow.getCell(1).font = { name: fontName, size: 10 };
          dataRow.getCell(2).font = { name: fontName, size: 10 };
          dataRow.getCell(3).font = { name: fontName, size: 10, italic: true };
          
          dataRow.getCell(1).border = cellBorders;
          dataRow.getCell(2).border = cellBorders;
          dataRow.getCell(3).border = cellBorders;

          dataRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
          dataRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
          dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
          
          catTotal += item.quantity;
        });

        // Total row
        const totalRow = worksheet.addRow([`TOTAL ${catName.toUpperCase()}`, catTotal, '']);
        totalRow.height = 20;
        totalRow.eachCell((cell, colNum) => {
          cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8D0C5' } // Warm accent peach
          };
          cell.border = cellBorders;
          cell.alignment = {
            horizontal: colNum === 2 ? 'right' : 'left',
            vertical: 'middle'
          };
        });

        worksheet.addRow([]); // Spacer row between tables
      }

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell?.({ includeEmpty: true }, cell => {
          if (cell.value && !cell.isMerged) {
            const len = cell.value.toString().length;
            if (len > maxLen) maxLen = len;
          }
        });
        column.width = Math.max(maxLen + 4, 12);
      });

      // Specific width refinements
      worksheet.getColumn(1).width = 30; // Product column
      worksheet.getColumn(2).width = 22; // Quantity column
      worksheet.getColumn(3).width = 35; // Notes column
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportConsolidated(orders: Order[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const usedSheetNames = new Set<string>();

    // 1. Get all unique client names (stores)
    const clientNames = Array.from(new Set(orders.map(o => 
      o?.user?.profile?.nickname || o?.user?.profile?.full_name || o?.user?.email || 'Anónimo'
    ))).sort();

    // 2. Group items by product category, then product name, then client name
    const dataStructure: Record<string, Record<string, Record<string, number>>> = {};
    
    orders.forEach(order => {
      const client = order?.user?.profile?.nickname || order?.user?.profile?.full_name || order?.user?.email || 'Anónimo';
      (order.items || []).forEach(item => {
        const cat = item.product?.category?.name || 'Sin categoría';
        const prod = item.product?.name || `Producto #${item.product_id || 'Desconocido'}`;
        const qty = Number(item.quantity) || 0;

        if (!dataStructure[cat]) dataStructure[cat] = {};
        if (!dataStructure[cat][prod]) dataStructure[cat][prod] = {};
        
        dataStructure[cat][prod][client] = (dataStructure[cat][prod][client] || 0) + qty;
      });
    });

    const fontName = 'Segoe UI';
    const borderStyle: Partial<ExcelJS.Border> = {
      style: 'thin',
      color: { argb: 'FFD3D3D3' }
    };
    const cellBorders: Partial<ExcelJS.Borders> = {
      top: borderStyle,
      left: borderStyle,
      bottom: borderStyle,
      right: borderStyle
    };

    if (Object.keys(dataStructure).length === 0) {
      const ws = workbook.addWorksheet('Sin Pedidos');
      ws.addRow(['No hay pedidos en el rango de fechas seleccionado.']);
    }

    for (const [catName, products] of Object.entries(dataStructure)) {
      // Clean sheet name (Excel sheets cannot contain \ / ? * [ ] : and must be <= 31 chars)
      const cleanSheetName = catName.replace(/[\\\/\?\*\[\]\:]/g, '').toUpperCase().slice(0, 30) || 'CONSOLIDADO';
      let finalSheetName = cleanSheetName;
      let counter = 1;
      while (usedSheetNames.has(finalSheetName.toLowerCase())) {
        const suffix = `_${counter}`;
        finalSheetName = `${cleanSheetName.slice(0, 30 - suffix.length)}${suffix}`;
        counter++;
      }
      usedSheetNames.add(finalSheetName.toLowerCase());

      const worksheet = workbook.addWorksheet(finalSheetName);
      worksheet.views = [{ showGridLines: true }];

      // Title row
      const titleRow = worksheet.addRow([`CONSOLIDADO DE PEDIDOS: ${catName.toUpperCase()}`]);
      worksheet.mergeCells(titleRow.number, 1, titleRow.number, clientNames.length + 2);
      titleRow.height = 28;
      titleRow.getCell(1).font = { name: fontName, bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      titleRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF5C3D2E' } // Dark brown primary theme
      };
      titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

      // Subtitle notice: Cantidades correspondientes a los despachos del rango seleccionado
      const noticeRow = worksheet.addRow(['* Cantidades correspondientes a los despachos del rango seleccionado']);
      worksheet.mergeCells(noticeRow.number, 1, noticeRow.number, clientNames.length + 2);
      noticeRow.height = 18;
      noticeRow.getCell(1).font = { name: fontName, italic: true, size: 9, color: { argb: 'FF5C3D2E' } };
      noticeRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

      worksheet.addRow([]); // Spacer

      // Table headers
      const headers = ['PRODUCTO', ...clientNames.map(c => c.toUpperCase()), 'TOTAL'];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 22;
      headerRow.eachCell((cell, colNum) => {
        cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5EBE6' } // Soft warm cream
        };
        cell.border = cellBorders;
        cell.alignment = {
          horizontal: colNum === 1 ? 'left' : 'right',
          vertical: 'middle'
        };
      });

      const clientColumnTotals: Record<string, number> = {};
      let grandTotal = 0;

      // Product rows
      for (const [prodName, clientQtys] of Object.entries(products)) {
        const rowData: any[] = [prodName];
        let prodTotal = 0;

        clientNames.forEach(client => {
          const qty = clientQtys[client] || 0;
          rowData.push(qty);
          prodTotal += qty;
          clientColumnTotals[client] = (clientColumnTotals[client] || 0) + qty;
        });

        rowData.push(prodTotal);
        grandTotal += prodTotal;

        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 18;
        dataRow.eachCell((cell, colNum) => {
          cell.font = { name: fontName, size: 10 };
          cell.border = cellBorders;
          cell.alignment = {
            horizontal: colNum === 1 ? 'left' : 'right',
            vertical: 'middle'
          };
          
          // Mute 0 values for cleaner visual design
          if (colNum > 1 && cell.value === 0) {
            cell.font = { name: fontName, size: 10, color: { argb: 'FFC0C0C0' } }; // Light gray
          }
        });
      }

      // Totals row
      const totalsRowData: any[] = ['TOTAL GENERAL'];
      clientNames.forEach(client => {
        totalsRowData.push(clientColumnTotals[client] || 0);
      });
      totalsRowData.push(grandTotal);

      const totalsRow = worksheet.addRow(totalsRowData);
      totalsRow.height = 22;
      totalsRow.eachCell((cell, colNum) => {
        cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8D0C5' } // Accent peach
        };
        cell.border = cellBorders;
        cell.alignment = {
          horizontal: colNum === 1 ? 'left' : 'right',
          vertical: 'middle'
        };
      });

      // Column width auto-fit
      worksheet.columns.forEach((column, index) => {
        if (index === 0) {
          column.width = 30; // Product name column
        } else {
          column.width = 15; // Client and Total columns
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

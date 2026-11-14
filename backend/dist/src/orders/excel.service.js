"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelService = void 0;
exports.resolveCroissantProductionGroup = resolveCroissantProductionGroup;
const common_1 = require("@nestjs/common");
const ExcelJS = __importStar(require("exceljs"));
function resolveCroissantProductionGroup(product) {
    if (product?.production_group === '1' || product?.production_group === '2' || product?.production_group === '3') {
        return product.production_group;
    }
    const name = (product?.name || '').trim().toLowerCase();
    if (name.startsWith('small') || name.includes('small')) {
        return '3';
    }
    if (name.includes('almond') ||
        name.includes('banoffee') ||
        name.includes('beef puff') ||
        name.includes('chicken puff') ||
        name.includes('chocolate mousse') ||
        name.includes('fruit danish') ||
        name.includes('new york roll') ||
        name.includes('pain au chocolat') ||
        name.includes('pistachio') ||
        name.includes('raspberry') ||
        name.includes('pain suisse') ||
        name.includes('pan swiss') ||
        name.includes('cheese') ||
        name.includes('turkey bacon')) {
        return '2';
    }
    return '1';
}
let ExcelService = class ExcelService {
    async generateProductionReport(orders) {
        return this.exportConsolidated(orders);
    }
    async exportIndividual(orders) {
        const workbook = new ExcelJS.Workbook();
        const usedSheetNames = new Set();
        const clientOrders = {};
        orders.forEach(order => {
            const name = order?.user?.profile?.nickname || order?.user?.profile?.full_name || order?.user?.email || 'Anónimo';
            if (!clientOrders[name])
                clientOrders[name] = [];
            clientOrders[name].push(order);
        });
        const fontName = 'Segoe UI';
        const borderStyle = {
            style: 'thin',
            color: { argb: 'FFD3D3D3' }
        };
        const cellBorders = {
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
            if (!ordersList || ordersList.length === 0)
                continue;
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
            worksheet.views = [{ showGridLines: true }];
            const order = ordersList[0];
            const deliveryDate = order?.delivery_date || 'No especificada';
            const chofer = order?.delivery_user?.profile?.full_name || 'No asignado';
            let addressStr = '';
            if (order?.delivery_type === 'pickup') {
                addressStr = 'Retiro en Local';
            }
            else if (order?.delivery_type === 'other') {
                addressStr = order?.delivery_address_text || '';
            }
            else {
                addressStr = order?.address?.address || '';
            }
            const addHeaderRow = (label, value) => {
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
            worksheet.addRow([]);
            const categories = {};
            ordersList.forEach(o => {
                (o.items || []).forEach(item => {
                    const cat = item.product?.category?.name || 'Sin categoría';
                    if (!categories[cat])
                        categories[cat] = [];
                    const productName = item.product?.name || `Producto #${item.product_id || 'Desconocido'}`;
                    const existing = categories[cat].find(it => it.productName === productName);
                    if (existing) {
                        existing.quantity += Number(item.quantity) || 0;
                    }
                    else {
                        categories[cat].push({
                            productName,
                            quantity: Number(item.quantity) || 0,
                            notes: o.notes || '',
                        });
                    }
                });
            });
            for (const [catName, items] of Object.entries(categories)) {
                const catTitleRow = worksheet.addRow([catName.toUpperCase()]);
                worksheet.mergeCells(catTitleRow.number, 1, catTitleRow.number, 3);
                catTitleRow.getCell(1).font = { name: fontName, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
                catTitleRow.getCell(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF8D4B32' }
                };
                catTitleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
                catTitleRow.height = 24;
                const headerRow = worksheet.addRow(['Producto', 'Cantidad (Unidades)', 'Notas']);
                headerRow.height = 20;
                headerRow.eachCell((cell, colNum) => {
                    cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF5EBE6' }
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
                const totalRow = worksheet.addRow([`TOTAL ${catName.toUpperCase()}`, catTotal, '']);
                totalRow.height = 20;
                totalRow.eachCell((cell, colNum) => {
                    cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE8D0C5' }
                    };
                    cell.border = cellBorders;
                    cell.alignment = {
                        horizontal: colNum === 2 ? 'right' : 'left',
                        vertical: 'middle'
                    };
                });
                worksheet.addRow([]);
            }
            worksheet.columns.forEach(column => {
                let maxLen = 0;
                column.eachCell?.({ includeEmpty: true }, cell => {
                    if (cell.value && !cell.isMerged) {
                        const len = cell.value.toString().length;
                        if (len > maxLen)
                            maxLen = len;
                    }
                });
                column.width = Math.max(maxLen + 4, 12);
            });
            worksheet.getColumn(1).width = 30;
            worksheet.getColumn(2).width = 22;
            worksheet.getColumn(3).width = 35;
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    async exportConsolidated(orders) {
        const workbook = new ExcelJS.Workbook();
        const usedSheetNames = new Set();
        const clientNames = Array.from(new Set(orders.map(o => o?.user?.profile?.nickname || o?.user?.profile?.full_name || o?.user?.email || 'Anónimo'))).sort();
        const dataStructure = {};
        orders.forEach(order => {
            const client = order?.user?.profile?.nickname || order?.user?.profile?.full_name || order?.user?.email || 'Anónimo';
            (order.items || []).forEach(item => {
                const cat = item.product?.category?.name || 'Sin categoría';
                const prod = item.product?.name || `Producto #${item.product_id || 'Desconocido'}`;
                const qty = Number(item.quantity) || 0;
                if (!dataStructure[cat])
                    dataStructure[cat] = {};
                if (!dataStructure[cat][prod]) {
                    dataStructure[cat][prod] = {
                        productObj: item.product,
                        clientQtys: {},
                    };
                }
                else if (!dataStructure[cat][prod].productObj && item.product) {
                    dataStructure[cat][prod].productObj = item.product;
                }
                dataStructure[cat][prod].clientQtys[client] = (dataStructure[cat][prod].clientQtys[client] || 0) + qty;
            });
        });
        const fontName = 'Segoe UI';
        const borderStyle = {
            style: 'thin',
            color: { argb: 'FFD3D3D3' }
        };
        const cellBorders = {
            top: borderStyle,
            left: borderStyle,
            bottom: borderStyle,
            right: borderStyle
        };
        if (Object.keys(dataStructure).length === 0) {
            const ws = workbook.addWorksheet('Sin Pedidos');
            ws.addRow(['No hay pedidos en el rango de fechas seleccionado.']);
        }
        const isCroissantsCategory = (categoryName) => {
            const norm = categoryName.trim().toUpperCase();
            return norm === 'CROISSANTS' || norm === 'CROISSANT';
        };
        for (const [catName, products] of Object.entries(dataStructure)) {
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
            const titleRow = worksheet.addRow([`CONSOLIDADO DE PEDIDOS: ${catName.toUpperCase()}`]);
            worksheet.mergeCells(titleRow.number, 1, titleRow.number, clientNames.length + 2);
            titleRow.height = 28;
            titleRow.getCell(1).font = { name: fontName, bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            titleRow.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF5C3D2E' }
            };
            titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
            const noticeRow = worksheet.addRow(['* Cantidades correspondientes a los despachos del rango seleccionado']);
            worksheet.mergeCells(noticeRow.number, 1, noticeRow.number, clientNames.length + 2);
            noticeRow.height = 18;
            noticeRow.getCell(1).font = { name: fontName, italic: true, size: 9, color: { argb: 'FF5C3D2E' } };
            noticeRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
            worksheet.addRow([]);
            if (isCroissantsCategory(catName)) {
                const groupDefs = [
                    {
                        id: '1',
                        title: '🥐 GRUPO 1: CROISSANTS PLAIN (BASE)',
                        totalLabel: 'TOTAL SUBGRUPO 1 PLAIN',
                        bgColor: 'FFF5EBE6',
                    },
                    {
                        id: '2',
                        title: '🎨 GRUPO 2: CROISSANTS DE COLORES (MASAS ESPECIALES)',
                        totalLabel: 'TOTAL SUBGRUPO 2 COLORES',
                        bgColor: 'FFEAE0E8',
                    },
                    {
                        id: '3',
                        title: '🥐 GRUPO 3: SMALL CROISSANTS',
                        totalLabel: 'TOTAL SUBGRUPO 3 SMALL',
                        bgColor: 'FFF5EBE6',
                    },
                ];
                const groupedProducts = {
                    '1': [],
                    '2': [],
                    '3': [],
                };
                for (const [prodName, prodData] of Object.entries(products)) {
                    const groupKey = resolveCroissantProductionGroup(prodData.productObj || { name: prodName });
                    groupedProducts[groupKey].push({
                        prodName,
                        clientQtys: prodData.clientQtys,
                    });
                }
                for (const key of ['1', '2', '3']) {
                    groupedProducts[key].sort((a, b) => a.prodName.localeCompare(b.prodName, 'en', { sensitivity: 'base' }));
                }
                const overallCroissantTotals = {};
                let overallCroissantGrandTotal = 0;
                for (const gDef of groupDefs) {
                    const gProducts = groupedProducts[gDef.id] || [];
                    if (gProducts.length === 0)
                        continue;
                    const bannerRow = worksheet.addRow([gDef.title]);
                    worksheet.mergeCells(bannerRow.number, 1, bannerRow.number, clientNames.length + 2);
                    bannerRow.height = 24;
                    bannerRow.getCell(1).font = { name: fontName, bold: true, size: 11, color: { argb: 'FF5C3D2E' } };
                    bannerRow.getCell(1).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: gDef.bgColor },
                    };
                    bannerRow.getCell(1).border = cellBorders;
                    bannerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
                    const headers = ['PRODUCTO', ...clientNames.map(c => c.toUpperCase()), 'TOTAL'];
                    const subHeaderRow = worksheet.addRow(headers);
                    subHeaderRow.height = 20;
                    subHeaderRow.eachCell((cell, colNum) => {
                        cell.font = { name: fontName, bold: true, size: 9, color: { argb: 'FF5C3D2E' } };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF5EBE6' },
                        };
                        cell.border = cellBorders;
                        cell.alignment = {
                            horizontal: colNum === 1 ? 'left' : 'right',
                            vertical: 'middle',
                        };
                    });
                    const subGroupColumnTotals = {};
                    let subGroupGrandTotal = 0;
                    for (const item of gProducts) {
                        const rowData = [item.prodName];
                        let prodTotal = 0;
                        clientNames.forEach(client => {
                            const qty = item.clientQtys[client] || 0;
                            rowData.push(qty);
                            prodTotal += qty;
                            subGroupColumnTotals[client] = (subGroupColumnTotals[client] || 0) + qty;
                            overallCroissantTotals[client] = (overallCroissantTotals[client] || 0) + qty;
                        });
                        rowData.push(prodTotal);
                        subGroupGrandTotal += prodTotal;
                        overallCroissantGrandTotal += prodTotal;
                        const dataRow = worksheet.addRow(rowData);
                        dataRow.height = 18;
                        dataRow.eachCell((cell, colNum) => {
                            cell.font = { name: fontName, size: 10 };
                            cell.border = cellBorders;
                            cell.alignment = {
                                horizontal: colNum === 1 ? 'left' : 'right',
                                vertical: 'middle',
                            };
                            if (colNum > 1 && cell.value === 0) {
                                cell.font = { name: fontName, size: 10, color: { argb: 'FFC0C0C0' } };
                            }
                        });
                    }
                    const subTotalsRowData = [gDef.totalLabel];
                    clientNames.forEach(client => {
                        subTotalsRowData.push(subGroupColumnTotals[client] || 0);
                    });
                    subTotalsRowData.push(subGroupGrandTotal);
                    const subTotalsRow = worksheet.addRow(subTotalsRowData);
                    subTotalsRow.height = 22;
                    subTotalsRow.eachCell((cell, colNum) => {
                        cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE8D0C5' },
                        };
                        cell.border = cellBorders;
                        cell.alignment = {
                            horizontal: colNum === 1 ? 'left' : 'right',
                            vertical: 'middle',
                        };
                    });
                    if (gDef.id === '1') {
                        const totalUnits = subGroupGrandTotal;
                        const fullTrays = Math.floor(totalUnits / 12);
                        const extraUnits = totalUnits % 12;
                        const decimalTrays = (totalUnits / 12).toFixed(2);
                        const trayRow1 = worksheet.addRow(['  📦 TOTAL BANDEJAS (12 UNID/BANDEJA):', `${fullTrays} bandejas (${decimalTrays})`]);
                        trayRow1.getCell(1).font = { name: fontName, bold: true, size: 9, color: { argb: 'FF5C3D2E' } };
                        trayRow1.getCell(2).font = { name: fontName, bold: true, size: 9, color: { argb: 'FF5C3D2E' } };
                        const trayRow2 = worksheet.addRow(['  ➕ CROISSANTS ADICIONALES (SUELTOS):', `${extraUnits} unidades`]);
                        trayRow2.getCell(1).font = { name: fontName, bold: true, size: 9, color: { argb: 'FF5C3D2E' } };
                        trayRow2.getCell(2).font = { name: fontName, bold: true, size: 9, color: { argb: 'FF5C3D2E' } };
                    }
                    worksheet.addRow([]);
                }
                const grandTotalsRowData = ['TOTAL GENERAL CROISSANTS'];
                clientNames.forEach(client => {
                    grandTotalsRowData.push(overallCroissantTotals[client] || 0);
                });
                grandTotalsRowData.push(overallCroissantGrandTotal);
                const grandTotalsRow = worksheet.addRow(grandTotalsRowData);
                grandTotalsRow.height = 24;
                grandTotalsRow.eachCell((cell, colNum) => {
                    cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF5C3D2E' },
                    };
                    cell.border = {
                        top: borderStyle,
                        bottom: { style: 'double', color: { argb: 'FF5C3D2E' } },
                        left: borderStyle,
                        right: borderStyle,
                    };
                    cell.alignment = {
                        horizontal: colNum === 1 ? 'left' : 'right',
                        vertical: 'middle',
                    };
                });
            }
            else {
                const headers = ['PRODUCTO', ...clientNames.map(c => c.toUpperCase()), 'TOTAL'];
                const headerRow = worksheet.addRow(headers);
                headerRow.height = 22;
                headerRow.eachCell((cell, colNum) => {
                    cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF5EBE6' },
                    };
                    cell.border = cellBorders;
                    cell.alignment = {
                        horizontal: colNum === 1 ? 'left' : 'right',
                        vertical: 'middle',
                    };
                });
                const clientColumnTotals = {};
                let grandTotal = 0;
                for (const [prodName, prodData] of Object.entries(products)) {
                    const rowData = [prodName];
                    let prodTotal = 0;
                    clientNames.forEach(client => {
                        const qty = prodData.clientQtys[client] || 0;
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
                            vertical: 'middle',
                        };
                        if (colNum > 1 && cell.value === 0) {
                            cell.font = { name: fontName, size: 10, color: { argb: 'FFC0C0C0' } };
                        }
                    });
                }
                const totalsRowData = ['TOTAL GENERAL'];
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
                        fgColor: { argb: 'FFE8D0C5' },
                    };
                    cell.border = cellBorders;
                    cell.alignment = {
                        horizontal: colNum === 1 ? 'left' : 'right',
                        vertical: 'middle',
                    };
                });
            }
            worksheet.columns.forEach((column, index) => {
                if (index === 0) {
                    column.width = 38;
                }
                else {
                    column.width = 15;
                }
            });
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    async exportAccounting(orders) {
        const workbook = new ExcelJS.Workbook();
        const fontName = 'Segoe UI';
        const borderStyle = {
            style: 'thin',
            color: { argb: 'FFD3D3D3' },
        };
        const cellBorders = {
            top: borderStyle,
            left: borderStyle,
            bottom: borderStyle,
            right: borderStyle,
        };
        const formatDate = (dateVal) => {
            if (!dateVal)
                return '';
            if (typeof dateVal === 'string') {
                const clean = dateVal.includes('T') ? dateVal.split('T')[0] : dateVal.split(' ')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(clean))
                    return clean;
            }
            const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
            if (isNaN(d.getTime()))
                return String(dateVal || '');
            const yr = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
        };
        const mapPaymentMethod = (method) => {
            if (!method)
                return 'No especificado';
            const m = method.toLowerCase().trim();
            switch (m) {
                case 'credit':
                    return 'Crédito Net 15';
                case 'stripe':
                    return 'Tarjeta Stripe';
                case 'ach':
                    return 'ACH';
                case 'check':
                    return 'Cheque';
                case 'zelle':
                    return 'Zelle';
                case 'cash':
                    return 'Efectivo';
                default:
                    return method.charAt(0).toUpperCase() + method.slice(1);
            }
        };
        const mapPaymentStatus = (status) => {
            if (!status)
                return 'PENDIENTE';
            const s = status.toLowerCase().trim();
            switch (s) {
                case 'paid':
                    return 'PAGADO';
                case 'pending':
                    return 'PENDIENTE';
                case 'partial':
                    return 'PARCIAL';
                case 'overdue':
                    return 'VENCIDO';
                case 'cancelled':
                    return 'CANCELADO';
                case 'refunded':
                    return 'REEMBOLSADO';
                default:
                    return status.toUpperCase();
            }
        };
        const ws1 = workbook.addWorksheet('Facturas y Cobros');
        ws1.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];
        const headers1 = [
            'Factura #',
            'Fecha Pedido',
            'Fecha Entrega',
            'Cliente (Razón Social)',
            'Nombre Comercial / DBA',
            'Tax ID / EIN',
            'Exento de Impuestos',
            'Subtotal Productos ($)',
            'Descuento ($)',
            'Flete ($)',
            'Impuesto Sales Tax ($)',
            'Total Facturado ($)',
            'Método de Pago',
            'Estado del Pago',
            'Balance Pendiente ($)',
            'Notas / Referencia',
        ];
        const headerRow1 = ws1.addRow(headers1);
        headerRow1.height = 26;
        headerRow1.eachCell((cell, colNum) => {
            cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF5C3D2E' },
            };
            cell.border = cellBorders;
            cell.alignment = {
                horizontal: (colNum >= 8 && colNum <= 12) || colNum === 15 ? 'right' : (colNum <= 3 || colNum === 6 || colNum === 7 || colNum === 13 || colNum === 14 ? 'center' : 'left'),
                vertical: 'middle',
            };
        });
        const safeOrders = Array.isArray(orders) ? orders : [];
        const totals = {
            subtotal: 0,
            discount: 0,
            deliveryFee: 0,
            taxAmount: 0,
            total: 0,
            pendingBalance: 0,
        };
        if (safeOrders.length === 0) {
            const emptyRow = ws1.addRow(['No hay facturas ni registros contables en el rango de fechas seleccionado.']);
            ws1.mergeCells(emptyRow.number, 1, emptyRow.number, headers1.length);
            emptyRow.height = 24;
            emptyRow.getCell(1).font = { name: fontName, italic: true, size: 10, color: { argb: 'FF7F7F7F' } };
            emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        else {
            safeOrders.forEach(order => {
                const invoiceNum = order?.invoice_number || (order?.id ? String(order.id).slice(0, 8).toUpperCase() : '');
                const orderDate = formatDate(order?.created_at);
                const deliveryDate = formatDate(order?.delivery_date);
                const legalName = order?.user?.legal_business_name || order?.user?.profile?.full_name || order?.user?.email || 'Anónimo';
                const dba = order?.user?.dba || order?.user?.profile?.nickname || '';
                const taxId = order?.user?.ein || order?.user?.tax_id || '';
                const taxExempt = order?.tax_exempt ? 'EXENTO (ST-120)' : 'NO';
                let subtotal = (order?.items || []).reduce((sum, item) => {
                    const qty = Number(item?.quantity) || 0;
                    const price = Number(item?.price_at_time ?? item?.product?.price ?? 0);
                    return sum + (qty * price);
                }, 0);
                if (subtotal === 0 && order?.subtotal) {
                    subtotal = Number(order.subtotal);
                }
                const discount = Number(order?.discount || order?.packaging_discount || order?.store_credit_applied || 0);
                const deliveryFee = Number(order?.delivery_fee_charged || 0);
                const taxAmount = Number(order?.tax_amount || 0);
                const total = Number(order?.total || 0);
                const paymentMethod = mapPaymentMethod(order?.payment_method);
                const paymentStatus = mapPaymentStatus(order?.payment_status);
                const pendingBalance = Number(order?.pending_balance || 0);
                const notes = String(order?.notes || order?.zelle_reference || order?.check_number || '');
                totals.subtotal += subtotal;
                totals.discount += discount;
                totals.deliveryFee += deliveryFee;
                totals.taxAmount += taxAmount;
                totals.total += total;
                totals.pendingBalance += pendingBalance;
                const row = ws1.addRow([
                    invoiceNum,
                    orderDate,
                    deliveryDate,
                    legalName,
                    dba,
                    taxId,
                    taxExempt,
                    Number(subtotal.toFixed(2)),
                    Number(discount.toFixed(2)),
                    Number(deliveryFee.toFixed(2)),
                    Number(taxAmount.toFixed(2)),
                    Number(total.toFixed(2)),
                    paymentMethod,
                    paymentStatus,
                    Number(pendingBalance.toFixed(2)),
                    notes,
                ]);
                row.height = 20;
                row.eachCell((cell, colNum) => {
                    cell.font = { name: fontName, size: 10 };
                    cell.border = cellBorders;
                    if (colNum === 1 || colNum === 2 || colNum === 3 || colNum === 6) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                    else if (colNum === 7 || colNum === 13 || colNum === 14) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                    else if ((colNum >= 8 && colNum <= 12) || colNum === 15) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '"$"#,##0.00';
                    }
                    else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }
                });
            });
            const totalsRow = ws1.addRow([
                'TOTALES',
                '',
                '',
                '',
                '',
                '',
                '',
                Number(totals.subtotal.toFixed(2)),
                Number(totals.discount.toFixed(2)),
                Number(totals.deliveryFee.toFixed(2)),
                Number(totals.taxAmount.toFixed(2)),
                Number(totals.total.toFixed(2)),
                '',
                '',
                Number(totals.pendingBalance.toFixed(2)),
                '',
            ]);
            totalsRow.height = 24;
            totalsRow.eachCell((cell, colNum) => {
                cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE8D0C5' },
                };
                cell.border = {
                    top: borderStyle,
                    bottom: { style: 'double', color: { argb: 'FF5C3D2E' } },
                    left: borderStyle,
                    right: borderStyle,
                };
                if ((colNum >= 8 && colNum <= 12) || colNum === 15) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '"$"#,##0.00';
                }
                else {
                    cell.alignment = { horizontal: colNum === 1 ? 'center' : 'left', vertical: 'middle' };
                }
            });
        }
        const ws2 = workbook.addWorksheet('Desglose de Productos');
        ws2.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];
        const headers2 = [
            'Factura #',
            'Fecha Pedido',
            'Cliente',
            'Categoría',
            'Producto',
            'Cantidad (Unidades)',
            'Precio Unitario ($)',
            'Total Ítem ($)',
        ];
        const headerRow2 = ws2.addRow(headers2);
        headerRow2.height = 26;
        headerRow2.eachCell((cell, colNum) => {
            cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF5C3D2E' },
            };
            cell.border = cellBorders;
            cell.alignment = {
                horizontal: colNum === 6 || colNum === 7 || colNum === 8 ? 'right' : (colNum <= 2 ? 'center' : 'left'),
                vertical: 'middle',
            };
        });
        let totalUnits = 0;
        let grandTotalItems = 0;
        let totalItemsCount = 0;
        if (safeOrders.length === 0) {
            const emptyRow2 = ws2.addRow(['No hay desglose de productos para el rango de fechas seleccionado.']);
            ws2.mergeCells(emptyRow2.number, 1, emptyRow2.number, headers2.length);
            emptyRow2.height = 24;
            emptyRow2.getCell(1).font = { name: fontName, italic: true, size: 10, color: { argb: 'FF7F7F7F' } };
            emptyRow2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        else {
            safeOrders.forEach(order => {
                const invoiceNum = order?.invoice_number || (order?.id ? String(order.id).slice(0, 8).toUpperCase() : '');
                const orderDate = formatDate(order?.created_at || order?.delivery_date);
                const clientName = order?.user?.legal_business_name || order?.user?.dba || order?.user?.profile?.nickname || order?.user?.profile?.full_name || order?.user?.email || 'Anónimo';
                (order?.items || []).forEach(item => {
                    const category = item?.product?.category?.name || 'Sin categoría';
                    const productName = item?.product?.name || `Producto #${item?.product_id || 'Desconocido'}`;
                    const qty = Number(item?.quantity) || 0;
                    const unitPrice = Number(item?.price_at_time ?? item?.product?.price ?? 0);
                    const itemTotal = Number((qty * unitPrice).toFixed(2));
                    totalUnits += qty;
                    grandTotalItems += itemTotal;
                    totalItemsCount++;
                    const row = ws2.addRow([
                        invoiceNum,
                        orderDate,
                        clientName,
                        category,
                        productName,
                        qty,
                        Number(unitPrice.toFixed(2)),
                        itemTotal,
                    ]);
                    row.height = 19;
                    row.eachCell((cell, colNum) => {
                        cell.font = { name: fontName, size: 10 };
                        cell.border = cellBorders;
                        if (colNum === 1 || colNum === 2) {
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        }
                        else if (colNum === 6) {
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                            cell.numFmt = '#,##0';
                        }
                        else if (colNum === 7 || colNum === 8) {
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                            cell.numFmt = '"$"#,##0.00';
                        }
                        else {
                            cell.alignment = { horizontal: 'left', vertical: 'middle' };
                        }
                    });
                });
            });
            if (totalItemsCount > 0) {
                const totalsRow2 = ws2.addRow([
                    'TOTAL GENERAL',
                    '',
                    '',
                    '',
                    '',
                    totalUnits,
                    '',
                    Number(grandTotalItems.toFixed(2)),
                ]);
                totalsRow2.height = 24;
                totalsRow2.eachCell((cell, colNum) => {
                    cell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF5C3D2E' } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE8D0C5' },
                    };
                    cell.border = {
                        top: borderStyle,
                        bottom: { style: 'double', color: { argb: 'FF5C3D2E' } },
                        left: borderStyle,
                        right: borderStyle,
                    };
                    if (colNum === 6) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0';
                    }
                    else if (colNum === 8) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '"$"#,##0.00';
                    }
                    else {
                        cell.alignment = { horizontal: colNum === 1 ? 'center' : 'left', vertical: 'middle' };
                    }
                });
            }
        }
        [ws1, ws2].forEach(ws => {
            ws.columns.forEach(column => {
                let maxLen = 0;
                column.eachCell?.({ includeEmpty: true }, cell => {
                    if (cell.value && !cell.isMerged) {
                        const str = typeof cell.value === 'object' && 'text' in cell.value
                            ? String(cell.value.text)
                            : String(cell.value);
                        if (str.length > maxLen)
                            maxLen = str.length;
                    }
                });
                column.width = Math.max(maxLen + 4, 14);
            });
        });
        ws1.getColumn(1).width = 14;
        ws1.getColumn(2).width = 14;
        ws1.getColumn(3).width = 14;
        ws1.getColumn(4).width = 28;
        ws1.getColumn(5).width = 22;
        ws1.getColumn(6).width = 16;
        ws1.getColumn(7).width = 20;
        ws1.getColumn(8).width = 22;
        ws1.getColumn(9).width = 16;
        ws1.getColumn(10).width = 15;
        ws1.getColumn(11).width = 22;
        ws1.getColumn(12).width = 20;
        ws1.getColumn(13).width = 18;
        ws1.getColumn(14).width = 16;
        ws1.getColumn(15).width = 20;
        ws1.getColumn(16).width = 30;
        ws2.getColumn(1).width = 14;
        ws2.getColumn(2).width = 14;
        ws2.getColumn(3).width = 28;
        ws2.getColumn(4).width = 22;
        ws2.getColumn(5).width = 30;
        ws2.getColumn(6).width = 20;
        ws2.getColumn(7).width = 20;
        ws2.getColumn(8).width = 20;
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
};
exports.ExcelService = ExcelService;
exports.ExcelService = ExcelService = __decorate([
    (0, common_1.Injectable)()
], ExcelService);
//# sourceMappingURL=excel.service.js.map
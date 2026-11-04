import * as XLSX from 'xlsx';

export interface KitchenItem {
    name: string;
    quantity: number;
    notes: string;
    category: string;
    rawItem?: any;
}

export interface KitchenCategoryGroup {
    category: string;
    items: KitchenItem[];
    subtotal: number;
    subtotalLabel: string;
}

export interface GroupedKitchenResult {
    groups: KitchenCategoryGroup[];
    totalUnits: number;
}

export interface KitchenPrintOptions {
    orderId: string;
    clientName: string;
    deliveryDateStr?: string;
    driverName: string;
    deliveryAddress: string;
    packingStyle: string;
    items: any[];
    orderNotes?: string;
    locale?: string;
}

const SPANISH_DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const SPANISH_MONTHS = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

const ENGLISH_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const ENGLISH_MONTHS = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/**
 * Normaliza y extrae el nombre de la categoría de un ítem de forma determinista.
 */
export function extractCategoryName(item: any): string {
    if (!item) return 'GENERAL';
    const cat = item.product?.category ?? item.category;
    if (typeof cat === 'object' && cat !== null) {
        const name = cat.name || cat.title || '';
        return name.trim() ? name.trim().toUpperCase() : 'GENERAL';
    }
    if (typeof cat === 'string' && cat.trim()) {
        return cat.trim().toUpperCase();
    }
    return 'GENERAL';
}

/**
 * Normaliza y extrae el nombre del producto de forma determinista.
 */
export function extractProductName(item: any): string {
    if (!item) return 'Producto sin nombre';
    const name = item.product?.name ?? item.name ?? item.product_name;
    if (typeof name === 'string' && name.trim()) {
        return name.trim();
    }
    return 'Producto sin nombre';
}

/**
 * Normaliza y extrae la cantidad numérica.
 */
export function extractQuantity(item: any): number {
    if (!item) return 0;
    const rawQty = item.quantity ?? item.qty ?? item.units ?? 0;
    const parsed = Number(rawQty);
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

/**
 * Normaliza y extrae las notas operativas del ítem (excluyendo notas de pago).
 */
export function extractItemNotes(item: any): string {
    if (!item) return '';
    const notes = item.notes ?? item.special_instructions ?? item.description ?? '';
    if (typeof notes === 'string') {
        return notes.trim();
    }
    return '';
}

/**
 * Limpia y sanitiza las notas operativas para cocina:
 * Oculta estrictamente precios monetarios, comisiones, teléfonos y correos.
 */
export function sanitizeOperationalNotes(notes?: string): string {
    if (!notes || !notes.trim()) return '';

    return notes
        // Ocultar teléfonos (ej. 555-0199, +17185550199, etc.)
        .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[TEL OCULTO]')
        // Ocultar correos electrónicos
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[CORREO OCULTO]')
        // Ocultar precios monetarios (ej. $150, $150.00, etc.)
        .replace(/\$\s*\d+(\.\d{1,2})?/g, '')
        // Ocultar porcentajes de comisiones (ej. 3.5%, 3%, etc.)
        .replace(/\b\d+(\.\d+)?\s*%/g, '')
        // Ocultar palabras clave financieras
        .replace(/\b(stripe|fee|fees|comision|comisión|comisiones|tarjeta|card|payment|pago|pagado|paid|reembolso|refund)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * TASK-59-02: Motor puro de ordenamiento A-Z y agrupación por categorías con subtotales deterministas.
 */
export function groupAndSortKitchenItems(rawItems: any[]): GroupedKitchenResult {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { groups: [], totalUnits: 0 };
    }

    const categoryMap = new Map<string, KitchenItem[]>();
    let totalUnits = 0;

    for (const raw of rawItems) {
        const category = extractCategoryName(raw);
        const name = extractProductName(raw);
        const quantity = extractQuantity(raw);
        const notes = extractItemNotes(raw);

        const kitchenItem: KitchenItem = {
            name,
            quantity,
            notes,
            category,
            rawItem: raw,
        };

        if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(kitchenItem);
        totalUnits += quantity;
    }

    // Ordenar categorías alfabéticamente A-Z
    const sortedCategoryNames = Array.from(categoryMap.keys()).sort((a, b) =>
        a.localeCompare(b, 'en', { sensitivity: 'base' })
    );

    const groups: KitchenCategoryGroup[] = [];

    for (const cat of sortedCategoryNames) {
        const items = categoryMap.get(cat) || [];
        // Ordenar productos dentro de cada categoría alfabéticamente A-Z
        items.sort((a, b) =>
            a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
        );

        const subtotal = items.reduce((acc, curr) => acc + curr.quantity, 0);

        groups.push({
            category: cat,
            items,
            subtotal,
            subtotalLabel: `TOTAL ${cat}`,
        });
    }

    return { groups, totalUnits };
}

/**
 * Formatea la fecha de entrega en mayúsculas (ej. "WEDNESDAY, NOVEMBER 4" o "MIÉRCOLES, 4 DE NOVIEMBRE").
 * Determinista e independiente del locale del sistema operativo/Node.
 */
export function formatDeliveryDateUpper(dateStr?: string, locale: string = 'en'): string {
    if (!dateStr || !dateStr.trim()) {
        return 'NO PROGRAMADA';
    }

    try {
        const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
        const parts = cleanDateStr.split('-');
        let d: Date;
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            d = new Date(year, month, day, 12, 0, 0);
        } else {
            d = new Date(dateStr);
        }

        if (!isNaN(d.getTime())) {
            const dayOfWeek = d.getDay();
            const monthIdx = d.getMonth();
            const dayNum = d.getDate();
            const yearNum = d.getFullYear();

            const isEs = locale.toLowerCase().startsWith('es');
            if (isEs) {
                const dayName = SPANISH_DAYS[dayOfWeek] || '';
                const monthName = SPANISH_MONTHS[monthIdx] || '';
                return `${dayName}, ${dayNum} DE ${monthName} DE ${yearNum}`;
            } else {
                const dayName = ENGLISH_DAYS[dayOfWeek] || '';
                const monthName = ENGLISH_MONTHS[monthIdx] || '';
                return `${dayName}, ${monthName} ${dayNum}, ${yearNum}`;
            }
        }
    } catch {
        // Fallback silencioso
    }

    return dateStr.trim().toUpperCase();
}

/**
 * Sanitiza el nombre de cliente para su uso en nombres de archivo Excel sin caracteres peligrosos.
 */
export function sanitizeFileNamePart(text: string): string {
    if (!text) return 'CLIENTE';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'CLIENTE';
}

/**
 * TASK-59-03: Plantilla HTML/CSS de impresión 1:1 con EJEMPLO _1_.xlsx y paginación inteligente.
 */
export function generateKitchenPrintHtml(options: KitchenPrintOptions): string {
    const {
        orderId,
        clientName,
        deliveryDateStr,
        driverName,
        deliveryAddress,
        packingStyle,
        items,
        orderNotes,
        locale = 'en',
    } = options;

    const formattedDate = formatDeliveryDateUpper(deliveryDateStr, locale);
    const shortOrderId = orderId ? orderId.slice(0, 8).toUpperCase() : 'N/A';
    const { groups, totalUnits } = groupAndSortKitchenItems(items);

    // Contar total de filas para determinar paginación inteligente
    const totalItemRows = groups.reduce((acc, g) => acc + g.items.length + 3, 0);
    const isMultiPage = totalItemRows > 18;

    let tablesHtml = '';
    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const group = groups[gIdx];
        const rowsHtml = group.items.map(item => `
            <tr>
                <td class="col-product">${escapeHtml(item.name)}</td>
                <td class="col-qty">${item.quantity}</td>
                <td class="col-notes">${escapeHtml(item.notes)}</td>
            </tr>
        `).join('');

        tablesHtml += `
            <div class="category-block ${gIdx > 0 ? 'category-spacing' : ''}">
                <div class="category-header">${escapeHtml(group.category)}</div>
                <table class="kitchen-table">
                    <thead>
                        <tr>
                            <th class="col-product">Producto</th>
                            <th class="col-qty">Cantidad (Unidades)</th>
                            <th class="col-notes">NOTAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="subtotal-row">
                            <td class="col-product">${escapeHtml(group.subtotalLabel)}</td>
                            <td class="col-qty">${group.subtotal}</td>
                            <td class="col-notes"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    const cleanNotes = sanitizeOperationalNotes(orderNotes);

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="utf-8">
    <title>Hoja_Cocina_${shortOrderId}_${escapeHtml(sanitizeFileNamePart(clientName))}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            color: #000;
            background: #fff;
            padding: 18px 24px;
            max-width: 850px;
            margin: 0 auto;
        }
        @media print {
            @page {
                size: letter portrait;
                margin: 10mm 12mm 15mm 12mm;
            }
            body {
                padding: 0;
                max-width: none;
                width: 100%;
            }
            .no-print {
                display: none !important;
            }
            .page-break-indicator {
                display: block !important;
            }
            .category-block {
                page-break-inside: avoid;
            }
            .print-page-footer {
                position: fixed;
                bottom: 4mm;
                left: 0;
                right: 0;
                display: flex;
                justify-content: space-between;
                font-size: 8px;
                color: #555;
                text-transform: uppercase;
                border-top: 1px dotted #ccc;
                padding-top: 2px;
            }
        }

        /* Franja Amarilla del Encabezado 1:1 con Excel (A1:C2) */
        .yellow-header-box {
            background-color: #FFFF00 !important;
            border: 2px solid #000;
            padding: 10px 14px;
            margin-bottom: 12px;
            font-size: 11px;
            line-height: 1.55;
            font-weight: 700;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .yellow-header-box .header-line {
            display: block;
            margin-bottom: 2px;
        }
        .yellow-header-box .header-label {
            font-weight: 900;
        }

        /* Categoría */
        .category-block {
            margin-bottom: 14px;
        }
        .category-header {
            background-color: #F6C6AD !important;
            border: 1px solid #333;
            border-bottom: none;
            padding: 5px 8px;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #000;
        }

        /* Tabla de Productos */
        .kitchen-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            margin-bottom: 4px;
        }
        .kitchen-table th, .kitchen-table td {
            border: 1px solid #777;
            padding: 4px 8px;
        }
        .kitchen-table th {
            background-color: #83CBEB !important;
            font-weight: 900;
            color: #000;
            text-align: left;
            font-size: 10.5px;
        }
        .col-product {
            width: 55%;
            text-align: left;
        }
        .col-qty {
            width: 25%;
            text-align: center;
            font-weight: 700;
        }
        .col-notes {
            width: 20%;
            text-align: center;
            font-weight: 600;
            color: #333;
        }

        /* Fila de Subtotal Amarillo 1:1 con Excel */
        .subtotal-row td {
            background-color: #FFFF00 !important;
            font-weight: 900;
            color: #000;
            border: 1.5px solid #000;
        }

        /* Resumen Total General */
        .grand-total-box {
            margin-top: 12px;
            padding: 8px 12px;
            border: 2px solid #000;
            background: #fff;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
        }

        .order-notes-box {
            margin-top: 10px;
            padding: 6px 10px;
            border: 1px dashed #444;
            background: #fafafa;
            font-size: 10px;
        }
        .order-notes-box b {
            text-transform: uppercase;
        }

        /* Paginación Inteligente */
        .pagination-alert {
            display: ${isMultiPage ? 'block' : 'none'};
            text-align: right;
            font-size: 10px;
            font-weight: 900;
            color: #b45309;
            margin: 8px 0 12px 0;
            letter-spacing: 0.5px;
        }
        .page-break-indicator {
            display: none;
            text-align: right;
            font-size: 10px;
            font-weight: 900;
            color: #000;
            padding: 6px 0;
            page-break-after: always;
        }

        /* Controles de Vista Previa */
        .print-actions {
            margin-bottom: 16px;
            display: flex;
            gap: 10px;
        }
        .btn-print {
            background: #000;
            color: #fff;
            padding: 8px 16px;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="no-print print-actions">
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir Hoja de Cocina</button>
    </div>

    <!-- Encabezado con Franja Amarilla 1:1 con Excel -->
    <div class="yellow-header-box">
        <span class="header-line"><span class="header-label">PEDIDO:</span> ${escapeHtml(clientName.toUpperCase())}</span>
        <span class="header-line"><span class="header-label">FECHA ENTREGA:</span> ${escapeHtml(formattedDate)}</span>
        <span class="header-line"><span class="header-label">CHOFER ASIGNADO:</span> ${escapeHtml((driverName || 'WILLIAM MEDINA').toUpperCase())}</span>
        <span class="header-line"><span class="header-label">DIRECCION:</span> ${escapeHtml((deliveryAddress || 'RECOGIDA EN TIENDA / NO ESPECIFICADA').toUpperCase())}</span>
        <span class="header-line"><span class="header-label">ESTILO DE EMPAQUE:</span> ${escapeHtml((packingStyle || 'CAJAS DE CARTON').toUpperCase())}</span>
    </div>

    ${isMultiPage ? '<div class="pagination-alert">MORE INFORMATION ON THE NEXT PAGE →</div>' : ''}

    <!-- Tablas por Categoría A-Z -->
    ${tablesHtml}

    <!-- Total General de Unidades -->
    <div class="grand-total-box">
        <span>TOTAL GENERAL DE UNIDADES:</span>
        <span>${totalUnits} UNIDADES</span>
    </div>

    ${cleanNotes ? `
    <div class="order-notes-box">
        <b>Instrucciones Operativas de Cocina:</b> ${escapeHtml(cleanNotes)}
    </div>
    ` : ''}

    <div class="print-page-footer">
        <span>Jhoanes Bakery & Wholesale • Hoja de Producción y Despacho #${shortOrderId}</span>
        <span>${formattedDate}</span>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 300);
        };
    </script>
</body>
</html>`;
}

/**
 * TASK-59-04: Generador dinámico de archivo Excel (.xlsx) idéntico a la plantilla física EJEMPLO _1_.xlsx.
 */
export function generateKitchenExcelWorkbook(options: KitchenPrintOptions): {
    workbook: XLSX.WorkBook;
    filename: string;
} {
    const {
        orderId,
        clientName,
        deliveryDateStr,
        driverName,
        deliveryAddress,
        packingStyle,
        items,
        orderNotes,
        locale = 'en',
    } = options;

    const formattedDate = formatDeliveryDateUpper(deliveryDateStr, locale);
    const shortOrderId = orderId ? orderId.slice(0, 8).toUpperCase() : 'ORDEN';
    const sanitizedClient = sanitizeFileNamePart(clientName);
    const filename = `Hoja_Cocina_${shortOrderId}_${sanitizedClient}.xlsx`;

    const { groups, totalUnits } = groupAndSortKitchenItems(items);

    // Texto de celda A1 (A1:C2 combinadas)
    const headerLines = [
        `PEDIDO: ${clientName.toUpperCase()}`,
        `FECHA ENTREGA: ${formattedDate}`,
        `CHOFER ASIGNADO: ${(driverName || 'WILLIAM MEDINA').toUpperCase()}`,
        `DIRECCION: ${(deliveryAddress || 'RECOGIDA EN TIENDA / NO ESPECIFICADA').toUpperCase()}`,
        `ESTILO DE EMPAQUE: ${(packingStyle || 'CAJAS DE CARTON').toUpperCase()}`,
    ];
    const headerText = headerLines.join('\r\n');

    // Construcción de la matriz de celdas
    const rows: (string | number)[][] = [];

    // Fila 1 (Índice 0): A1 con texto, B1 y C1 vacíos
    rows.push([headerText, '', '']);
    // Fila 2 (Índice 1): Parte del merge A1:C2
    rows.push(['', '', '']);
    // Fila 3 (Índice 2): Espaciador
    rows.push(['', '', '']);

    for (const group of groups) {
        // Fila de Categoría (ej. "CROISSANTS")
        rows.push([group.category, '', '']);
        // Encabezados de Columna
        rows.push(['Producto', 'Cantidad (Unidades)', 'NOTAS']);
        // Filas de Productos
        for (const item of group.items) {
            rows.push([item.name, item.quantity, item.notes || '']);
        }
        // Subtotal de Categoría (ej. "TOTAL CROISSANTS", 48, "")
        rows.push([group.subtotalLabel, group.subtotal, '']);
        // Espaciador entre categorías
        rows.push(['', '', '']);
    }

    // Fila de Total General
    rows.push(['TOTAL GENERAL DE UNIDADES', totalUnits, '']);

    if (orderNotes && orderNotes.trim()) {
        const cleanNotes = sanitizeOperationalNotes(orderNotes);
        if (cleanNotes) {
            rows.push(['', '', '']);
            rows.push(['NOTAS OPERATIVAS:', cleanNotes, '']);
        }
    }

    // Crear la hoja con SheetJS
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Configurar columnas según especificación física (42, 28, 20)
    ws['!cols'] = [
        { wch: 42 },
        { wch: 28 },
        { wch: 20 },
    ];

    // Configurar celdas combinadas A1:C2 (fila 0 col 0 a fila 1 col 2)
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 2 } },
    ];

    // Nombre de la hoja (máximo 31 caracteres permitido por Excel)
    const rawSheetName = clientName ? clientName.toUpperCase().slice(0, 31) : 'HOJA DE COCINA';
    const sheetName = rawSheetName.replace(/[\\/?*[\]:]/g, '_') || 'HOJA DE COCINA';

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    return { workbook: wb, filename };
}

/**
 * Dispara la descarga del archivo Excel en el navegador.
 */
export function downloadKitchenExcel(options: KitchenPrintOptions): string {
    const { workbook, filename } = generateKitchenExcelWorkbook(options);
    XLSX.writeFile(workbook, filename);
    return filename;
}

/**
 * Abre una ventana emergente del navegador para imprimir la Hoja de Cocina con Print CSS 1:1.
 */
export function openKitchenPrintWindow(options: KitchenPrintOptions): Window | null {
    const html = generateKitchenPrintHtml(options);
    const win = window.open('', '_blank', 'width=950,height=800,scrollbars=yes');
    if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
    }
    return win;
}

function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

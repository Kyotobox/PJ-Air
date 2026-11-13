import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
    groupAndSortKitchenItems,
    formatDeliveryDateUpper,
    generateKitchenPrintHtml,
    generateKitchenExcelWorkbook,
    sanitizeFileNamePart,
    extractCategoryName,
    extractQuantity,
    extractProductName,
} from './kitchen-dispatch';

describe('Kitchen Dispatch Engine (TASK-59-02, TASK-59-03, TASK-59-04)', () => {
    const sampleItems = [
        {
            product: { name: 'Artisanal Croissant', category: 'Croissants' },
            quantity: 6,
            notes: '',
        },
        {
            product: { name: 'Dubai Chocolate Croissant', category: 'Croissants' },
            quantity: 12,
            notes: '',
        },
        {
            product: { name: 'Almond Croissant', category: 'Croissants' },
            quantity: 10,
            notes: '',
        },
        {
            product: { name: 'New York Cheesecake Slices x10', category: 'Cakes Slices' },
            quantity: 2,
            notes: 'CP',
        },
        {
            product: { name: 'Fruit Tart', category: 'Tarts' },
            quantity: 4,
            notes: 'CP',
        },
        {
            product: { name: 'Tiramisu Cup', category: 'Desserts' },
            quantity: 8,
            notes: '',
        },
        {
            product: { name: 'Napoleon', category: 'Desserts' },
            quantity: 6,
            notes: '',
        },
    ];

    // =========================================================================
    // HAPPY PATH TESTS (TASK-59-02, TASK-83-03)
    // =========================================================================
    describe('groupAndSortKitchenItems - Happy Path', () => {
        it('groups items by category, sorts categories A-Z, and segments croissants into operational groups (TASK-83-03)', () => {
            const result = groupAndSortKitchenItems(sampleItems);

            // Categories should be sorted A-Z, with croissants divided into Grupo 1 and Grupo 2:
            const categoryNames = result.groups.map(g => g.category);
            expect(categoryNames).toEqual([
                'CAKES SLICES',
                '🥐 GRUPO 1: CROISSANTS PLAIN (BASE)',
                '🎨 GRUPO 2: CROISSANTS DE COLORES (MASAS ESPECIALES)',
                'DESSERTS',
                'TARTS',
            ]);

            // Total units across all items: 6 + 12 + 10 + 2 + 4 + 8 + 6 = 48
            expect(result.totalUnits).toBe(48);

            // Products in Grupo 1 PLAIN (Artisanal Croissant, Dubai Chocolate Croissant)
            const g1Group = result.groups.find(g => g.category.includes('GRUPO 1'));
            expect(g1Group).toBeDefined();
            expect(g1Group?.items.map(i => i.name)).toEqual([
                'Artisanal Croissant',
                'Dubai Chocolate Croissant',
            ]);
            expect(g1Group?.subtotal).toBe(18); // 6 + 12
            expect(g1Group?.subtotalLabel).toBe('TOTAL SUBGRUPO 1 PLAIN');

            // Products in Grupo 2 COLORES (Almond Croissant)
            const g2Group = result.groups.find(g => g.category.includes('GRUPO 2'));
            expect(g2Group).toBeDefined();
            expect(g2Group?.items.map(i => i.name)).toEqual([
                'Almond Croissant',
            ]);
            expect(g2Group?.subtotal).toBe(10);
            expect(g2Group?.subtotalLabel).toBe('TOTAL SUBGRUPO 2 COLORES');

            // Products in DESSERTS category should be sorted A-Z: Napoleon -> Tiramisu Cup
            const dessertsGroup = result.groups.find(g => g.category === 'DESSERTS');
            expect(dessertsGroup?.items.map(i => i.name)).toEqual([
                'Napoleon',
                'Tiramisu Cup',
            ]);
            expect(dessertsGroup?.subtotal).toBe(14);
            expect(dessertsGroup?.subtotalLabel).toBe('TOTAL DESSERTS');
        });

        it('correctly segments all 3 Croissant groups including Small Croissants (TASK-83-03)', () => {
            const itemsWithSmall = [
                ...sampleItems,
                {
                    product: { name: 'Small Artisanal Croissant', category: 'Croissants', production_group: '3' },
                    quantity: 20,
                    notes: '',
                },
                {
                    product: { name: 'Small Pistachio Croissant', category: 'Croissants' }, // fallback -> 3
                    quantity: 15,
                    notes: '',
                },
            ];

            const result = groupAndSortKitchenItems(itemsWithSmall);

            const g3Group = result.groups.find(g => g.category.includes('GRUPO 3'));
            expect(g3Group).toBeDefined();
            expect(g3Group?.category).toBe('🥐 GRUPO 3: SMALL CROISSANTS');
            expect(g3Group?.subtotalLabel).toBe('TOTAL SUBGRUPO 3 SMALL');
            expect(g3Group?.subtotal).toBe(35); // 20 + 15
            expect(g3Group?.items.map(i => i.name)).toEqual([
                'Small Artisanal Croissant',
                'Small Pistachio Croissant',
            ]);
        });
    });

    // =========================================================================
    // SAD PATH TESTS (§6 Mandatorio)
    // =========================================================================
    describe('groupAndSortKitchenItems - Sad Path', () => {
        it('returns empty groups and 0 total units when items array is empty or not an array', () => {
            expect(groupAndSortKitchenItems([])).toEqual({ groups: [], totalUnits: 0 });
            expect(groupAndSortKitchenItems(null as any)).toEqual({ groups: [], totalUnits: 0 });
            expect(groupAndSortKitchenItems(undefined as any)).toEqual({ groups: [], totalUnits: 0 });
        });

        it('assigns GENERAL category when item has null, empty, or missing category', () => {
            const items = [
                { product: { name: 'Item Without Category' }, quantity: 5 },
                { product: { name: 'Item Blank Category', category: '' }, quantity: 3 },
                { product: { name: 'Item Null Category', category: null }, quantity: 2 },
            ];

            const result = groupAndSortKitchenItems(items);
            expect(result.groups).toHaveLength(1);
            expect(result.groups[0].category).toBe('GENERAL');
            expect(result.groups[0].subtotal).toBe(10);
            expect(result.groups[0].subtotalLabel).toBe('TOTAL GENERAL');
        });

        it('handles null, missing, or malformed product names with a safe fallback', () => {
            const items = [
                { product: null, quantity: 3 },
                { product: { name: '   ' }, quantity: 2 },
            ];

            const result = groupAndSortKitchenItems(items);
            expect(result.groups[0].items[0].name).toBe('Producto sin nombre');
            expect(result.groups[0].items[1].name).toBe('Producto sin nombre');
        });

        it('handles invalid, negative, or string quantities deterministically', () => {
            const items = [
                { product: { name: 'Item A', category: 'Cakes' }, quantity: '15' as any },
                { product: { name: 'Item B', category: 'Cakes' }, quantity: -5 },
                { product: { name: 'Item C', category: 'Cakes' }, quantity: 'invalid_number' as any },
            ];

            const result = groupAndSortKitchenItems(items);
            const cakes = result.groups.find(g => g.category === 'CAKES');
            expect(cakes?.items.find(i => i.name === 'Item A')?.quantity).toBe(15);
            expect(cakes?.items.find(i => i.name === 'Item B')?.quantity).toBe(0);
            expect(cakes?.items.find(i => i.name === 'Item C')?.quantity).toBe(0);
            expect(cakes?.subtotal).toBe(15);
            expect(result.totalUnits).toBe(15);
        });

        it('handles null item in the items array without crashing', () => {
            const items = [
                null,
                undefined,
                { product: { name: 'Valid Item', category: 'Bread' }, quantity: 4 },
            ];

            const result = groupAndSortKitchenItems(items);
            expect(result.totalUnits).toBe(4);
            const bread = result.groups.find(g => g.category === 'BREAD');
            expect(bread?.items).toHaveLength(1);
        });
    });

    // =========================================================================
    // DATE FORMATTING TESTS
    // =========================================================================
    describe('formatDeliveryDateUpper', () => {
        it('formats ISO delivery date string to uppercase with weekday and month', () => {
            const formatted = formatDeliveryDateUpper('2026-11-04', 'en');
            expect(formatted).toContain('WEDNESDAY');
            expect(formatted).toContain('NOVEMBER');
            expect(formatted).toContain('4');
        });

        it('handles Spanish locale correctly', () => {
            const formatted = formatDeliveryDateUpper('2026-11-04', 'es');
            expect(formatted.toLowerCase()).toContain('noviembre');
        });

        it('returns NO PROGRAMADA for empty or undefined dates (Sad Path)', () => {
            expect(formatDeliveryDateUpper('')).toBe('NO PROGRAMADA');
            expect(formatDeliveryDateUpper(undefined)).toBe('NO PROGRAMADA');
            expect(formatDeliveryDateUpper('   ')).toBe('NO PROGRAMADA');
        });
    });

    // =========================================================================
    // FILE SANITIZATION TESTS
    // =========================================================================
    describe('sanitizeFileNamePart', () => {
        it('removes accents, special characters, and path separators', () => {
            expect(sanitizeFileNamePart('Pinch of Sprinkles / Bake Shoppe & Café!')).toBe('Pinch_of_Sprinkles_Bake_Shoppe_Cafe');
            expect(sanitizeFileNamePart('')).toBe('CLIENTE');
            expect(sanitizeFileNamePart('   ')).toBe('CLIENTE');
        });
    });

    // =========================================================================
    // PRINT HTML 1:1 TEMPLATE TESTS (TASK-59-03)
    // =========================================================================
    describe('generateKitchenPrintHtml (TASK-59-03)', () => {
        const options = {
            orderId: 'ord-abc-12345678',
            clientName: 'Moka Cafe Astoria',
            deliveryDateStr: '2026-11-04',
            driverName: 'William Medina',
            deliveryAddress: '31-01 Broadway, Astoria, NY 11106',
            packingStyle: 'CAJAS DE CARTON',
            items: sampleItems,
            orderNotes: 'Entregar antes de las 6am. No tocar el timbre.',
        };

        it('renders yellow header box (#FFFF00) with client, date, driver, address, and packing style in uppercase', () => {
            const html = generateKitchenPrintHtml(options);

            expect(html).toContain('#FFFF00');
            expect(html).toContain('PEDIDO:');
            expect(html).toContain('MOKA CAFE ASTORIA');
            expect(html).toContain('FECHA ENTREGA:');
            expect(html).toContain('CHOFER ASIGNADO:');
            expect(html).toContain('WILLIAM MEDINA');
            expect(html).toContain('DIRECCION:');
            expect(html).toContain('31-01 BROADWAY, ASTORIA, NY 11106');
            expect(html).toContain('ESTILO DE EMPAQUE:');
            expect(html).toContain('CAJAS DE CARTON');
        });

        it('strictly hides monetary prices, fee percentages, and customer contact data', () => {
            const html = generateKitchenPrintHtml({
                ...options,
                orderNotes: 'Paid $150 via Stripe fee 3.5%. Call client at 555-0199 or email test@moka.com',
            });

            // Prices and financial markers should be absent
            expect(html).not.toContain('$150');
            expect(html).not.toContain('3.5%');
            expect(html).not.toContain('fee');
            expect(html).not.toContain('Stripe');
            expect(html).not.toContain('Total Factura');
            expect(html).not.toContain('Subtotal: $');
        });

        it('displays "MORE INFORMATION ON THE NEXT PAGE →" when items exceed threshold for multi-page', () => {
            // Generate > 32 items to trigger multi-page (TASK-62-05 threshold)
            const manyItems = [];
            for (let i = 1; i <= 35; i++) {
                manyItems.push({
                    product: { name: `Product ${i}`, category: `Category ${i % 5}` },
                    quantity: 2,
                });
            }

            const multiPageHtml = generateKitchenPrintHtml({
                ...options,
                items: manyItems,
            });

            expect(multiPageHtml).toContain('MORE INFORMATION ON THE NEXT PAGE →');
        });
    });

    // =========================================================================
    // EXCEL EXPORT WORKBOOK TESTS (TASK-59-04)
    // =========================================================================
    describe('generateKitchenExcelWorkbook (TASK-59-04)', () => {
        const options = {
            orderId: 'ord-abc-12345678',
            clientName: 'Cortelyou Cafe',
            deliveryDateStr: '2026-11-04',
            driverName: 'William Medina',
            deliveryAddress: '1418 Cortelyou Rd, Brooklyn, NY 11226',
            packingStyle: 'CAJA PLASTICA / CONTENEDORES',
            items: sampleItems,
        };

        it('builds an Excel workbook with merged cells A1:C2 and columns 42, 28, 20', () => {
            const { workbook, filename } = generateKitchenExcelWorkbook(options);

            // Filename format: Hoja_Cocina_[OrderNum]_[Cliente].xlsx
            expect(filename).toBe('Hoja_Cocina_ORD-ABC-_Cortelyou_Cafe.xlsx');

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Verify column widths: 42, 28, 20
            expect(sheet['!cols']).toBeDefined();
            expect(sheet['!cols']?.[0]?.wch).toBe(42);
            expect(sheet['!cols']?.[1]?.wch).toBe(28);
            expect(sheet['!cols']?.[2]?.wch).toBe(20);

            // Verify merged cells A1:C2: s = { r: 0, c: 0 }, e = { r: 1, c: 2 }
            expect(sheet['!merges']).toBeDefined();
            expect(sheet['!merges']).toEqual([
                { s: { r: 0, c: 0 }, e: { r: 1, c: 2 } },
            ]);

            // Header cell A1 content check
            const a1Value = sheet['A1']?.v as string;
            expect(a1Value).toContain('PEDIDO: CORTELYOU CAFE');
            expect(a1Value).toContain('FECHA ENTREGA:');
            expect(a1Value).toContain('CHOFER ASIGNADO: WILLIAM MEDINA');
            expect(a1Value).toContain('DIRECCION: 1418 CORTELYOU RD, BROOKLYN, NY 11226');
            expect(a1Value).toContain('ESTILO DE EMPAQUE: CAJA PLASTICA / CONTENEDORES');

            // Convert to JSON and verify category and subtotal rows
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
            const rowTexts = rows.map(r => r.join(' | '));

            expect(rowTexts.some(r => r.includes('TOTAL SUBGRUPO 1 PLAIN'))).toBe(true);
            expect(rowTexts.some(r => r.includes('TOTAL SUBGRUPO 2 COLORES'))).toBe(true);
            expect(rowTexts.some(r => r.includes('TOTAL GENERAL CROISSANTS'))).toBe(true);
            expect(rowTexts.some(r => r.includes('TOTAL GENERAL DE UNIDADES'))).toBe(true);
        });

        it('handles empty items without errors in Excel generation (Sad Path)', () => {
            const { workbook, filename } = generateKitchenExcelWorkbook({
                ...options,
                items: [],
            });

            expect(filename).toContain('.xlsx');
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            expect(sheet['!merges']).toBeDefined();
            expect(sheet['!cols']).toBeDefined();
        });
    });
});

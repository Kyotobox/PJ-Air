import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASS = '123123';

async function loginAsAdmin(page: any) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.locator('input[type="text"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASS);
  await page.locator('form button').first().click();
  await page.waitForURL('**/admin**', { timeout: 15000 });
}

test.describe('Contraste Físico y Visual de Interfaces Reales', () => {

  test('01 — Catálogo Público y Flujo de Navegación', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/visual-contrast/01-catalogo-publico.png', fullPage: true });
    
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('02 — Pantalla de Autenticación (Login)', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/visual-contrast/02-login.png', fullPage: true });

    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('03 — Rol Admin: Panel de Control y Pedidos (/admin/orders)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/orders`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/visual-contrast/03-admin-pedidos.png', fullPage: true });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('04 — Rol Admin: Directorio de Clientes (/admin/clients)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/clients`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/visual-contrast/04-admin-clientes.png', fullPage: true });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('05 — Rol Admin: Reportes y Analítica (/admin/reports)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/reports`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/visual-contrast/05-admin-reportes.png', fullPage: true });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('06 — Carrito y Checkout Transaccional', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);
    
    await page.goto(`${BASE_URL}/checkout`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/visual-contrast/06-checkout.png', fullPage: true });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

});

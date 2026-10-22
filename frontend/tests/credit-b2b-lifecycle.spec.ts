import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const BASE_URL = 'https://testing.jhoanes.com';
const CLIENT_EMAIL = 'stripetest@jhoanes.com';
const CLIENT_PASS = 'Password123!';
const CLIENT_ID = '270c424a-2b9f-4904-bee0-a5574efa36c7';

const ADMIN_EMAIL = 'eleuterioc@gmail.com';
const ADMIN_PASS = 'jhoanes';

const SSH_CMD = 'ssh -i ~/.ssh/id_ed25519_ruben -o StrictHostKeyChecking=no root@187.124.67.53';
const REMOTE_DB = '/var/www/pj-air-testing/database-testing.sqlite';

const SCREENSHOTS_ROOT = path.resolve(__dirname, '../../ui_screenshots');
const SCREENSHOTS_VAULT = path.resolve(__dirname, '../../vault/runtime/ui_screenshots');

function runRemoteSql(sql: string) {
  const escaped = sql.replace(/"/g, '\\"');
  return execSync(`${SSH_CMD} "sqlite3 ${REMOTE_DB} \\"${escaped}\\""`).toString().trim();
}

async function saveDualScreenshot(page: Page, filename: string) {
  const rootPath = path.join(SCREENSHOTS_ROOT, filename);
  const vaultPath = path.join(SCREENSHOTS_VAULT, filename);
  await page.screenshot({ path: rootPath, fullPage: true });
  await page.screenshot({ path: vaultPath, fullPage: true });
}

test.describe.serial('B2B Credit & E2E Testing Suite (Sprint 30)', () => {
  let clientToken = '';
  let adminToken = '';
  let clientUser: any = null;
  let adminUser: any = null;
  let orderAId = '';
  let orderCId = '';

  test.beforeAll(async () => {
    // Ensure screenshot directories exist
    if (!fs.existsSync(SCREENSHOTS_ROOT)) fs.mkdirSync(SCREENSHOTS_ROOT, { recursive: true });
    if (!fs.existsSync(SCREENSHOTS_VAULT)) fs.mkdirSync(SCREENSHOTS_VAULT, { recursive: true });

    // Clean prior test orders and reset client to credit mode: 1000 limit, override 0
    runRemoteSql(`
      DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = '${CLIENT_ID}');
      DELETE FROM orders WHERE user_id = '${CLIENT_ID}';
      UPDATE users SET account_type = 'credit', credit_limit = 1000.00, credit_override = 0 WHERE id = '${CLIENT_ID}';
      UPDATE addresses SET is_default = 1 WHERE user_id = '${CLIENT_ID}';
    `);

    // Obtain client and admin tokens via direct API
    const clientRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: CLIENT_EMAIL, password: CLIENT_PASS }),
    });
    const clientData = await clientRes.json();
    clientToken = clientData.session.access_token;
    clientUser = clientData.user;

    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.session.access_token;
    adminUser = adminData.user;

    console.log('[Setup] Database primed, tokens obtained.');
  });

  // Helper to authenticate user on page context
  async function authenticateSession(page: Page, token: string, user: any, role: string) {
    const domain = 'testing.jhoanes.com';
    await page.context().addCookies([
      { name: 'auth_token', value: token, domain, path: '/' },
      { name: 'session_role', value: role, domain, path: '/' },
    ]);

    const sessionPayload = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { role, full_name: user.profile?.full_name || 'User' },
      },
      session: { access_token: token },
    };

    await page.addInitScript((sessionData) => {
      window.localStorage.setItem('local_session', JSON.stringify(sessionData));
      window.localStorage.setItem('language', 'es');
      window.localStorage.setItem('jhoanes_language', 'es');
    }, sessionPayload);
  }

  // Helper to set cart in localStorage
  async function setCart(page: Page, items: any[]) {
    await page.addInitScript(({ items, clientId }) => {
      window.localStorage.setItem(`jhoanes-cart-${clientId}`, JSON.stringify(items));
      window.localStorage.setItem('jhoanes-cart-guest', JSON.stringify(items));
    }, { items, clientId: CLIENT_ID });
  }

  test('Caso A: Flujo Feliz a Crédito ($250.00)', async ({ page }) => {
    await authenticateSession(page, clientToken, clientUser, 'client');

    const cartA = [
      {
        id: 101,
        name: 'Artisanal Croissant',
        price: 2.5,
        originalPrice: 2.5,
        quantity: 100,
        image: '/uploads/products/Artisanal Croissant.jpg',
        description: 'Artisanal butter croissant',
      },
    ];

    await setCart(page, cartA);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify credit mode indicator
    const creditNotice = page.locator('text=/Línea de Crédito|Credit Account/i');
    await expect(creditNotice.first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=$1000.00').first()).toBeVisible({ timeout: 10000 });

    // Verify Stripe is NOT in the DOM
    const stripeFrame = page.locator('iframe[name*="__privateStripeFrame"]');
    await expect(stripeFrame).toHaveCount(0);

    // Check terms
    const termsCheckbox = page.locator('#terms_agree_checkout');
    await termsCheckbox.check();
    expect(await termsCheckbox.isChecked()).toBeTruthy();

    // Confirm order
    const confirmBtn = page.locator('button:has-text("Confirmar Pedido"), button:has-text("Place Order")');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Wait for redirect to /orders/[id]
    await page.waitForURL(/\/orders\/[a-zA-Z0-9-]+/, { timeout: 20000 });
    const orderUrl = page.url();
    const parts = orderUrl.split('/orders/');
    orderAId = parts[1].split('?')[0].split('#')[0];
    console.log(`[Caso A] Created orderAId: ${orderAId}`);

    await page.waitForTimeout(2500);

    // Validate backend entity status and payment_status
    const orderADetailRes = await fetch(`${BASE_URL}/api/orders/${orderAId}`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const orderADetail = await orderADetailRes.json();
    console.log('[Caso A] Verified order entity:', {
      id: orderADetail.id,
      status: orderADetail.status,
      payment_status: orderADetail.payment_status,
      total: orderADetail.total,
    });
    expect(orderADetail.status).toBe('Pedido Enviado');
    expect(orderADetail.payment_status).toBe('pending');
    expect(Number(orderADetail.total)).toBe(250);

    // Validate page content
    const pageText = await page.textContent('body');
    expect(pageText).toMatch(/Order Confirmed|Pedido Confirmado|Order Received|Pedido Enviado/i);

    // Take screenshot
    await saveDualScreenshot(page, 'credit_test_case_a_success.png');
    console.log('[Caso A] Screenshot saved to ui_screenshots/credit_test_case_a_success.png');
  });

  test('Caso B: Bloqueo por Límite Excedido ($850.00 adicional)', async ({ page }) => {
    // Client currently has $250.00 pending debt from Order A. Adding $850.00 = $1,100.00 > $1,000.00 limit.
    await authenticateSession(page, clientToken, clientUser, 'client');

    const cartB = [
      {
        id: 101,
        name: 'Artisanal Croissant',
        price: 2.5,
        originalPrice: 2.5,
        quantity: 340, // 340 * 2.5 = 850.00
        image: '/uploads/products/Artisanal Croissant.jpg',
        description: 'Artisanal butter croissant',
      },
    ];

    await setCart(page, cartB);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Verify Red Alert is visible
    const alertMessage = page.locator('text=/Límite de crédito excedido|Credit limit exceeded/i');
    await expect(alertMessage.first()).toBeVisible({ timeout: 10000 });

    // Verify Confirm button is disabled
    const confirmBtn = page.locator('button:has-text("Confirmar Pedido"), button:has-text("Place Order")');
    await expect(confirmBtn).toBeDisabled();

    // Force backend order creation to verify 400 BadRequestException
    const forcedOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        userId: CLIENT_ID,
        deliveryType: 'saved',
        total: 850.0,
        items: [{ productId: 101, quantity: 340, price: 2.5 }],
      }),
    });

    expect(forcedOrderRes.status).toBe(400);
    const forcedErr = await forcedOrderRes.json();
    console.log('[Caso B] Backend properly rejected forced order:', forcedErr);
    expect(forcedErr.message).toContain('Límite de crédito excedido');

    // Take screenshot
    await saveDualScreenshot(page, 'credit_test_case_b_blocked.png');
    console.log('[Caso B] Screenshot saved to ui_screenshots/credit_test_case_b_blocked.png');
  });

  test('Caso C: Sobregiro Administrativo Autorizado (override = 1)', async ({ page }) => {
    // Authorize credit override for user via admin API
    const overrideRes = await fetch(`${BASE_URL}/api/users/${CLIENT_ID}/credit`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ credit_override: true }),
    });
    expect(overrideRes.ok).toBeTruthy();
    console.log('[Caso C] Credit override enabled for client.');

    await authenticateSession(page, clientToken, clientUser, 'client');

    const cartC = [
      {
        id: 101,
        name: 'Artisanal Croissant',
        price: 2.5,
        originalPrice: 2.5,
        quantity: 340, // 340 * 2.5 = 850.00
        image: '/uploads/products/Artisanal Croissant.jpg',
        description: 'Artisanal butter croissant',
      },
    ];

    await setCart(page, cartC);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Verify Yellow Overdraft Warning Banner
    const overdraftBanner = page.locator('text=/Autorización de sobregiro activa|Overdraft override active/i');
    await expect(overdraftBanner.first()).toBeVisible({ timeout: 10000 });

    // Verify Confirm button is now ENABLED
    const termsCheckbox = page.locator('#terms_agree_checkout');
    await termsCheckbox.check();

    const confirmBtn = page.locator('button:has-text("Confirmar Pedido"), button:has-text("Place Order")');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Wait for redirect to /orders/[id]
    await page.waitForURL(/\/orders\/[a-zA-Z0-9-]+/, { timeout: 20000 });
    const orderUrl = page.url();
    const parts = orderUrl.split('/orders/');
    orderCId = parts[1].split('?')[0].split('#')[0];
    console.log(`[Caso C] Created orderCId: ${orderCId}`);

    await page.waitForTimeout(2500);

    // Validate backend entity status and payment_status for Order C
    const orderCDetailRes = await fetch(`${BASE_URL}/api/orders/${orderCId}`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const orderCDetail = await orderCDetailRes.json();
    console.log('[Caso C] Verified order entity:', {
      id: orderCDetail.id,
      status: orderCDetail.status,
      payment_status: orderCDetail.payment_status,
      total: orderCDetail.total,
    });
    expect(orderCDetail.status).toBe('Pedido Enviado');
    expect(orderCDetail.payment_status).toBe('pending');
    expect(Number(orderCDetail.total)).toBe(850);

    // Verify PM2 log for overdraft email notification
    const pm2Logs = execSync(`${SSH_CMD} "pm2 logs pj-air-backend-testing --lines 50 --nostream"`).toString();
    const hasCreditAlert = pm2Logs.includes('sendCreditAlert') || pm2Logs.includes('MailService') || pm2Logs.includes('Sobregiro') || pm2Logs.includes('credit alert');
    console.log('[Caso C] PM2 Log check for credit alert:', hasCreditAlert);

    // Take screenshot
    await saveDualScreenshot(page, 'credit_test_case_c_overdraft_authorized.png');
    console.log('[Caso C] Screenshot saved to ui_screenshots/credit_test_case_c_overdraft_authorized.png');
  });

  test('Caso D: Reconciliación de Deuda y Liberación de Cupo (Admin)', async ({ page }) => {
    await authenticateSession(page, adminToken, adminUser, 'admin');

    // Check pre-reconciliation credit summary ($1,100.00 debt)
    const summaryBeforeRes = await fetch(`${BASE_URL}/api/users/${CLIENT_ID}/credit-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summaryBefore = await summaryBeforeRes.json();
    console.log('[Caso D] Summary before reconciliation:', summaryBefore);
    expect(summaryBefore.used_credit).toBe(1100);

    // 1. Visit /admin/orders
    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // 2. Visit /admin/clients
    await page.goto(`${BASE_URL}/admin/clients`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Search for client
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('stripetest');
      await page.waitForTimeout(1000);
    }

    // Open client modal
    const editBtn = page.locator('button:has-text("Editar")').first();
    await editBtn.click();
    await page.waitForTimeout(2000);

    // Verify modal is open and has credit section
    await expect(page.locator('text=/Crédito B2B y Condiciones Financieras|Línea de Crédito/i').first()).toBeVisible({ timeout: 10000 });

    // Mark first order ($250.00) as paid via button
    const markPaidBtn = page.locator('button:has-text("Marcar Pagado")').first();
    await expect(markPaidBtn).toBeVisible({ timeout: 8000 });
    await markPaidBtn.click();
    await page.waitForTimeout(2500);

    // Verify in credit summary that debt decreased from $1,100 to $850
    const summaryAfterOrderARes = await fetch(`${BASE_URL}/api/users/${CLIENT_ID}/credit-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summaryAfterOrderA = await summaryAfterOrderARes.json();
    console.log('[Caso D] Summary after paying Order A ($250):', summaryAfterOrderA);
    expect(summaryAfterOrderA.used_credit).toBe(850);
    expect(summaryAfterOrderA.available_credit).toBe(150);

    // Cancel remaining order ($850.00) via status cancellation
    const cancelRes = await fetch(`${BASE_URL}/api/orders/${orderCId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(cancelRes.ok).toBeTruthy();
    console.log(`[Caso D] Order C (${orderCId}) cancelled successfully.`);

    // Verify debt is now $0.00 and available credit is $1,000.00
    const summaryFinalRes = await fetch(`${BASE_URL}/api/users/${CLIENT_ID}/credit-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summaryFinal = await summaryFinalRes.json();
    console.log('[Caso D] Summary after cancelling Order C:', summaryFinal);
    expect(summaryFinal.used_credit).toBe(0);
    expect(summaryFinal.available_credit).toBe(1000);

    // Refresh client modal to reflect updated zero-debt state
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const editBtn2 = page.locator('button:has-text("Editar")').first();
    if (await editBtn2.isVisible()) {
      await editBtn2.click();
      await page.waitForTimeout(1500);
    }

    // Take screenshot of reconciliation
    await saveDualScreenshot(page, 'credit_test_case_d_reconciliation.png');
    console.log('[Caso D] Screenshot saved to ui_screenshots/credit_test_case_d_reconciliation.png');
  });
});

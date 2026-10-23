const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://testing.jhoanes.com';
const ADMIN_EMAIL = 'eleuterioc@gmail.com';
const ADMIN_PASS = 'jhoanes';

const CLIENT_EMAIL = 'stripetest@jhoanes.com';
const CLIENT_PASS = 'Password123!';

const SCREENSHOTS_ROOT = path.resolve(__dirname, '../ui_screenshots');
const SCREENSHOTS_VAULT = path.resolve(__dirname, '../vault/runtime/ui_screenshots');

if (!fs.existsSync(SCREENSHOTS_ROOT)) fs.mkdirSync(SCREENSHOTS_ROOT, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_VAULT)) fs.mkdirSync(SCREENSHOTS_VAULT, { recursive: true });

async function saveDualScreenshot(page, filename) {
  const rootPath = path.join(SCREENSHOTS_ROOT, filename);
  const vaultPath = path.join(SCREENSHOTS_VAULT, filename);
  await page.screenshot({ path: rootPath, fullPage: true });
  fs.copyFileSync(rootPath, vaultPath);
  console.log(`[Screenshot Saved] -> ${rootPath} & ${vaultPath}`);
}

async function loginApi(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.statusText}`);
  return await res.json();
}

async function authenticateSession(context, page, token, user, role) {
  const domain = 'testing.jhoanes.com';
  await context.addCookies([
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
    window.localStorage.setItem('app_default_locale', 'es');
    window.localStorage.setItem('app_user_locale', 'es');
    window.localStorage.setItem('language', 'es');
    window.localStorage.setItem('jhoanes_language', 'es');
  }, sessionPayload);
}

async function run() {
  console.log('=== Starting Sprint 32 E2E Playwright Suite ===');

  const adminAuth = await loginApi(ADMIN_EMAIL, ADMIN_PASS);
  const adminToken = adminAuth.session.access_token;
  const adminUser = adminAuth.user;
  console.log('[Auth] Admin logged in:', adminUser.email);

  const clientAuth = await loginApi(CLIENT_EMAIL, CLIENT_PASS);
  const clientToken = clientAuth.session.access_token;
  const clientUser = clientAuth.user;
  console.log('[Auth] Client logged in:', clientUser.email);

  const browser = await chromium.launch({ headless: true });

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Admin Order Detail & Refund Issuance (/admin/orders/[id])
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing Admin Order Detail & Refund Issuance ---');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();
    await authenticateSession(adminContext, adminPage, adminToken, adminUser, 'admin');

    await adminPage.goto(`${BASE_URL}/admin/orders/ord-credit-test-paid`, { waitUntil: 'networkidle' });
    await adminPage.waitForSelector('text=Orden #ord-cred', { timeout: 15000 });
    await adminPage.waitForTimeout(1000);

    // Click Emitir Reembolso
    console.log('Clicking "Emitir Reembolso" button...');
    const refundBtn = adminPage.locator('[data-testid="issue-refund-btn"]');
    await refundBtn.waitFor({ state: 'visible', timeout: 10000 });
    await refundBtn.click();
    await adminPage.waitForTimeout(1000);

    // In refund modal: select Partial refund
    console.log('Selecting Partial Refund in modal...');
    await adminPage.click('button:has-text("Parcial (Ajuste)")');
    await adminPage.waitForTimeout(500);

    // Enter partial refund amount: $35.00
    const amountInput = adminPage.locator('input[type="number"]');
    await amountInput.fill('35.00');

    // Select reason: Merma o Rotura de Panadería en Tránsito
    await adminPage.selectOption('select', 'merma_panaderia');

    // Fill notes
    const notesInput = adminPage.locator('textarea');
    await notesInput.fill('Compensación comercial por 14 croissants con merma en empaque.');
    await adminPage.waitForTimeout(500);

    // Submit refund
    console.log('Submitting refund...');
    await adminPage.click('button:has-text("Confirmar Reembolso")');

    // Wait for the reactive badge to update
    await adminPage.waitForSelector('[data-testid="financial-badge-partially-refunded"]', { timeout: 10000 });
    console.log('Refund processed! Partial refund badge displayed.');
    await adminPage.waitForTimeout(1000);

    await saveDualScreenshot(adminPage, 'sprint32_admin_refund_issued.png');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Admin Clients B2B Debt & Settlement Link (/admin/clients)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing Admin Clients B2B Debt & Settlement Link ---');
    await adminPage.goto(`${BASE_URL}/admin/clients`, { waitUntil: 'networkidle' });
    await adminPage.waitForSelector('text=Clientes', { timeout: 15000 });
    await adminPage.waitForTimeout(1500);

    // Open detail for stripetest@jhoanes.com
    console.log('Opening client drawer for stripetest@jhoanes.com...');
    const clientRow = adminPage.locator('tr:has-text("stripetest@jhoanes.com")');
    await clientRow.locator('button:has-text("Editar")').click();
    await adminPage.waitForTimeout(2000);

    // Click "Generar Enlace de Cobro"
    const genLinkBtn = adminPage.locator('[data-testid="generate-settlement-link-btn"]').first();
    await genLinkBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Clicking "Generar Enlace de Cobro"...');
    await genLinkBtn.click();
    await adminPage.waitForTimeout(1500);

    await saveDualScreenshot(adminPage, 'sprint32_admin_clients_settlement_link.png');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Admin Orders Table with Financial Badges (/admin/orders)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing Admin Orders Table with Financial Badges ---');
    await adminPage.goto(`${BASE_URL}/admin/orders`, { waitUntil: 'networkidle' });
    await adminPage.waitForSelector('text=Gestión de Órdenes', { timeout: 15000 });
    await adminPage.waitForTimeout(2000);

    await saveDualScreenshot(adminPage, 'sprint32_admin_orders_financial_badges.png');

    await adminContext.close();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Client Online Settlement (/orders/ord-credit-test-pending)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing Client Online Settlement Payment Flow ---');
    const clientContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const clientPage = await clientContext.newPage();
    await authenticateSession(clientContext, clientPage, clientToken, clientUser, 'client');

    await clientPage.goto(`${BASE_URL}/orders/ord-credit-test-pending`, { waitUntil: 'networkidle' });
    await clientPage.waitForSelector('[data-testid="order-credit-badge"]', { timeout: 15000 });
    await clientPage.waitForTimeout(1000);

    // Click "Pagar Factura en Línea"
    console.log('Clicking "Pagar Factura en Línea"...');
    const payOnlineBtn = clientPage.locator('[data-testid="pay-invoice-online-btn"]');
    await payOnlineBtn.waitFor({ state: 'visible', timeout: 10000 });
    await payOnlineBtn.click();
    await clientPage.waitForTimeout(2000);

    await saveDualScreenshot(clientPage, 'sprint32_client_settlement_online.png');

    await clientContext.close();

    console.log('\n=== All Sprint 32 Playwright E2E Tests Completed Successfully! ===');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Sprint 32 Playwright Suite Failed:', err);
  process.exit(1);
});

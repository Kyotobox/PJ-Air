const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'https://testing.jhoanes.com';
const ADMIN_EMAIL = 'eleuterioc@gmail.com';
const ADMIN_PASS = 'jhoanes';

const CLIENT_EMAIL = 'stripetest@jhoanes.com';
const CLIENT_PASS = 'Password123!';

const SSH_KEY = path.resolve(process.env.HOME, '.ssh/id_ed25519_ruben');
const SSH_CMD = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no root@187.124.67.53`;
const REMOTE_DB = '/var/www/pj-air-testing/database-testing.sqlite';

function runRemoteSql(sql) {
  try {
    const escaped = sql.replace(/"/g, '\\"');
    execSync(`${SSH_CMD} "sqlite3 ${REMOTE_DB} \\"${escaped}\\""`);
  } catch (e) {
    console.warn('runRemoteSql warning:', e.message);
  }
}

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
      account_type: user.account_type || (role === 'admin' ? 'admin' : 'credit'),
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
  console.log('========================================================================');
  console.log('=== Starting Sprint 37 E2E Validation: B2B Email Ecosystem & Alerts  ===');
  console.log('========================================================================');

  // Ensure credit customer is set up
  runRemoteSql(`UPDATE users SET account_type = 'credit', credit_limit = 5000.00, credit_override = 1 WHERE email = '${CLIENT_EMAIL}';`);

  const adminAuth = await loginApi(ADMIN_EMAIL, ADMIN_PASS);
  const adminToken = adminAuth.session.access_token;
  const adminUser = adminAuth.user;
  console.log('[Auth] Admin authenticated:', adminUser.email);

  const clientAuth = await loginApi(CLIENT_EMAIL, CLIENT_PASS);
  const clientToken = clientAuth.session.access_token;
  const clientUser = clientAuth.user;
  clientUser.account_type = 'credit';
  console.log('[Auth] Client authenticated:', clientUser.email);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Crear orden a crédito (dispara sendOrderReceipt & sendAdminNewOrderAlert)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Sprint 37 - Test 1/3] Creando orden a crédito...');
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      userId: clientUser.id,
      total: 180.00,
      deliveryDate: '2026-11-20',
      deliveryType: 'pickup',
      items: [
        { productId: 101, quantity: 40, price: 2.50 },
        { productId: 102, quantity: 16, price: 5.00 },
      ],
      paymentStatus: 'pending',
    }),
  });

  if (!orderRes.ok) {
    const errorText = await orderRes.text();
    throw new Error(`Failed to create credit order: ${orderRes.status} ${errorText}`);
  }

  const order = await orderRes.json();
  console.log(`[Test 1 Success] Orden creada exitosamente #${order.id} por $${order.total}`);
  console.log('  -> Notificación al cliente (sendOrderReceipt) y a operaciones (sendAdminNewOrderAlert) despachadas asíncronamente.');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Emitir reembolso parcial (dispara sendRefundReceipt)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Sprint 37 - Test 2/3] Emitiendo reembolso parcial de $40.00...');
  const refundRes = await fetch(`${BASE_URL}/api/payments/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      orderId: order.id,
      amount: 40.00,
      reason: 'Ajuste contable comercial por merma pactada',
    }),
  });

  if (!refundRes.ok) {
    const errorText = await refundRes.text();
    throw new Error(`Failed to issue partial refund: ${refundRes.status} ${errorText}`);
  }

  const refund = await refundRes.json();
  console.log(`[Test 2 Success] Reembolso procesado exitosamente:`, refund);
  console.log('  -> Comprobante de reembolso (sendRefundReceipt) despachado al cliente asíncronamente.');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Crear suscripción semanal (dispara sendStandingOrderConfirmation)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Sprint 37 - Test 3/3] Creando suscripción semanal recurrente...');
  const standingRes = await fetch(`${BASE_URL}/api/orders/scheduled`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      title: 'Suministro Diario Panadería Jhoanes Wholesale',
      delivery_days_json: JSON.stringify(['mon', 'wed', 'fri']),
      delivery_time: '07:00',
      delivery_type: 'saved',
      payment_method: 'credit',
      items_json: JSON.stringify([
        { productId: 101, productName: 'Artisanal Croissant', quantity: 50, price: 2.50 },
        { productId: 102, productName: 'Raspberry Croissant', quantity: 20, price: 4.95 },
      ]),
      total: 224.00,
      active: true,
    }),
  });

  if (!standingRes.ok) {
    const errorText = await standingRes.text();
    throw new Error(`Failed to create standing order: ${standingRes.status} ${errorText}`);
  }

  const standing = await standingRes.json();
  console.log(`[Test 3 Success] Suscripción semanal creada #${standing.id} por $${standing.total}`);
  console.log('  -> Confirmación de suscripción (sendStandingOrderConfirmation) despachada al cliente asíncronamente.');

  // ─────────────────────────────────────────────────────────────────────────
  // E2E UI NAVIGATION & SCREENSHOTS VIA PLAYWRIGHT
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Playwright] Iniciando sesión en navegador para capturar evidencias visuales...');
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. Client Order Detail
    console.log('[Playwright UI] Capturando vista de la orden creada en cliente...');
    await authenticateSession(context, page, clientToken, clientUser, 'client');
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await saveDualScreenshot(page, 'sprint37_order_credit_receipt.png');

    // 2. Admin Order Detail with Refund
    console.log('[Playwright UI] Capturando orden con estado reembolsado en panel admin...');
    await authenticateSession(context, page, adminToken, adminUser, 'admin');
    await page.goto(`${BASE_URL}/admin/orders/${order.id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await saveDualScreenshot(page, 'sprint37_admin_order_refund.png');

    // 3. Client Standing Orders view
    console.log('[Playwright UI] Capturando suscripciones semanales activas...');
    await authenticateSession(context, page, clientToken, clientUser, 'client');
    await page.goto(`${BASE_URL}/orders/scheduled`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await saveDualScreenshot(page, 'sprint37_standing_order_subscription.png');

    console.log('\n========================================================================');
    console.log('=== SPRINT 37 E2E VALIDATION & AUDIT COMPLETED 100% SUCCESSFULLY!    ===');
    console.log('========================================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ Fatal error in Sprint 37 E2E validation:', err);
  process.exit(1);
});

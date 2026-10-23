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
  console.log('=== Starting Sprint 34 E2E Playwright Suite ===');

  const adminAuth = await loginApi(ADMIN_EMAIL, ADMIN_PASS);
  const adminToken = adminAuth.session.access_token;
  const adminUser = adminAuth.user;
  console.log('[Auth] Admin logged in:', adminUser.email);

  const clientAuth = await loginApi(CLIENT_EMAIL, CLIENT_PASS);
  const clientToken = clientAuth.session.access_token;
  const clientUser = clientAuth.user;
  console.log('[Auth] Client logged in:', clientUser.email);

  // Create a standing order via API for end-to-end integration
  try {
    const createSubRes = await fetch(`${BASE_URL}/api/orders/scheduled`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        title: 'Suministro Semanal Hotel & Cafetería',
        items_json: JSON.stringify([
          { productId: 'prod-01', productName: 'Croissant Artesanal Francés', quantity: 40, price: 3.50 },
          { productId: 'prod-02', productName: 'Baguette Rústica Tradicional', quantity: 25, price: 2.20 },
        ]),
        delivery_days_json: JSON.stringify(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        delivery_time: '07:00',
        delivery_type: 'saved',
        payment_method: 'credit',
        total: 195.00,
        active: true,
      }),
    });
    if (createSubRes.ok) {
      const created = await createSubRes.json();
      console.log('[API] Seeded standing order via API:', created.id);
    }
  } catch (seedErr) {
    console.warn('API seed warning:', seedErr.message);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Client Standing Orders Management & Setup Modal (/orders/scheduled)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 1] Client Standing Orders & Setup Modal ---');
    const clientContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const clientPage = await clientContext.newPage();
    await authenticateSession(clientContext, clientPage, clientToken, clientUser, 'client');

    await clientPage.goto(`${BASE_URL}/orders/scheduled`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await clientPage.waitForTimeout(3000);

    const newBtn = clientPage.locator('button:has-text("Nuevo Pedido Recurrente")').first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      console.log('Opened "Nuevo Pedido Recurrente" modal');
      await clientPage.waitForTimeout(1500);
    }

    const modalTitleVisible = await clientPage.locator('text=Configurar Pedido Recurrente').first().isVisible().catch(() => false);
    console.log('Modal title visible:', modalTitleVisible);

    await saveDualScreenshot(clientPage, 'sprint34_client_scheduled_orders_modal.png');

    // Close modal to view the list
    const closeBtn = clientPage.locator('button:has-text("Cancelar")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await clientPage.waitForTimeout(1000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Client Standing Orders List View
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 2] Client Standing Orders List View ---');
    const subCardVisible = await clientPage.locator('text=Suministro Semanal Hotel & Cafetería').first().isVisible().catch(() => false);
    const activeBadgeVisible = await clientPage.locator('text=Activo').first().isVisible().catch(() => false);
    console.log('Subscription card visible:', subCardVisible);
    console.log('Active badge visible:', activeBadgeVisible);

    await saveDualScreenshot(clientPage, 'sprint34_client_scheduled_orders_list.png');
    await clientContext.close();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Admin Weekly Production Calendar Projections (/admin/standing-orders)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 3] Admin Production Calendar Projections ---');
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();
    await authenticateSession(adminContext, adminPage, adminToken, adminUser, 'admin');

    await adminPage.goto(`${BASE_URL}/admin/standing-orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await adminPage.waitForTimeout(3000);

    const hasCalendarTitle = await adminPage.locator('text=Proyección de Horneados y Standing Orders').first().isVisible().catch(() => false);
    const hasProductionPill = await adminPage.locator('text=Horneado Necesario').first().isVisible().catch(() => false);
    const hasRevenueStat = await adminPage.locator('text=Facturación Semanal Proyectada').first().isVisible().catch(() => false);

    console.log('Admin Calendar title visible:', hasCalendarTitle);
    console.log('Horneado Necesario list visible:', hasProductionPill);
    console.log('Weekly revenue stat visible:', hasRevenueStat);

    await saveDualScreenshot(adminPage, 'sprint34_admin_production_calendar.png');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Global Subscriptions Table & Force Cron Dispatch
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 4] Global Subscriptions & Cron Dispatch ---');
    const subsTabBtn = adminPage.locator('button:has-text("Lista Global de Suscripciones")');
    if (await subsTabBtn.isVisible()) {
      await subsTabBtn.click();
      console.log('Switched to Global Subscriptions tab');
      await adminPage.waitForTimeout(1500);
    }

    const runCronBtn = adminPage.locator('button:has-text("Forzar Despacho Cron Hoy")');
    if (await runCronBtn.isVisible()) {
      console.log('Clicking "Forzar Despacho Cron Hoy" button...');
      await runCronBtn.click();
      await adminPage.waitForTimeout(3000);
    }

    const cronSuccessToast = await adminPage.locator('text=Cron ejecutado').first().isVisible().catch(() => false);
    console.log('Cron execution notification visible:', cronSuccessToast);

    await saveDualScreenshot(adminPage, 'sprint34_admin_cron_dispatch_executed.png');
    await adminContext.close();

    console.log('\n=== Sprint 34 Playwright Suite Completed Successfully! ===');
  } catch (err) {
    console.error('Playwright suite execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();

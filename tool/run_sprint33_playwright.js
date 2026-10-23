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
  console.log('=== Starting Sprint 33 E2E Playwright Suite ===');

  // Prime test orders state in remote database
  runRemoteSql(`
    UPDATE orders SET payment_status = 'pending', refunded_amount = 0, refund_reason = NULL, stripe_payment_id = NULL WHERE id = 'ord-credit-test-pending';
  `);

  const clientAuth = await loginApi(CLIENT_EMAIL, CLIENT_PASS);
  const clientToken = clientAuth.session.access_token;
  const clientUser = clientAuth.user;
  console.log('[Auth] Client logged in:', clientUser.email);

  const browser = await chromium.launch({ headless: true });

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Profile Billing & Payment Methods Self-Service (/profile)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 1] Client Profile Billing & Payment Methods ---');
    const profileContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const profilePage = await profileContext.newPage();
    await authenticateSession(profileContext, profilePage, clientToken, clientUser, 'client');

    await profilePage.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await profilePage.waitForTimeout(3000);

    // Verify presence of payment methods section
    const hasBillingSection = await profilePage.locator('text=Métodos de Pago y Facturación').first().isVisible().catch(() => false);
    const hasSavedCard = await profilePage.locator('text=4242').first().isVisible().catch(() => false);
    const hasPortalBtn = await profilePage.locator('text=Portal de Facturación').first().isVisible().catch(() => false);

    console.log('Billing section visible:', hasBillingSection);
    console.log('Saved Visa 4242 card visible:', hasSavedCard);
    console.log('Portal button visible:', hasPortalBtn);

    await saveDualScreenshot(profilePage, 'sprint33_client_profile_payment_methods.png');
    await profileContext.close();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: 1-Click Checkout Modal on Client Order (/orders/[id])
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 2] 1-Click Checkout Modal Display ---');
    const orderContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const orderPage = await orderContext.newPage();
    await authenticateSession(orderContext, orderPage, clientToken, clientUser, 'client');

    await orderPage.goto(`${BASE_URL}/orders/ord-credit-test-pending`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await orderPage.waitForTimeout(3000);

    const payOnlineBtn = orderPage.locator('button:has-text("Pagar Factura en Línea")');
    if (await payOnlineBtn.isVisible()) {
      await payOnlineBtn.click();
      console.log('Clicked "Pagar Factura en Línea" button');
      await orderPage.waitForTimeout(3000);
    }

    const has1ClickTab = await orderPage.locator('text=1-Clic Guardado').first().isVisible().catch(() => false);
    const hasCardTab = await orderPage.locator('text=Tarjeta Crédito/Débito').first().isVisible().catch(() => false);
    const hasAchTab = await orderPage.locator('text=Transferencia ACH').first().isVisible().catch(() => false);

    console.log('Tab 1-Clic Guardado visible:', has1ClickTab);
    console.log('Tab Tarjeta visible:', hasCardTab);
    console.log('Tab ACH visible:', hasAchTab);

    await saveDualScreenshot(orderPage, 'sprint33_checkout_1click_modal.png');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: ACH Direct Debit Selection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 3] ACH Direct Debit Option Selection ---');
    const achTabBtn = orderPage.locator('button:has-text("Transferencia ACH")');
    if (await achTabBtn.isVisible()) {
      await achTabBtn.click();
      console.log('Switched to ACH tab');
      await orderPage.waitForTimeout(1500);
    }

    const hasAchBanner = await orderPage.locator('text=Transferencia Directa ACH').first().isVisible().catch(() => false);
    console.log('ACH banner visible:', hasAchBanner);

    await saveDualScreenshot(orderPage, 'sprint33_checkout_ach_tab.png');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Execute 1-Click Payment
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- [TEST 4] Execute 1-Click Payment ---');
    const oneClickTabBtn = orderPage.locator('button:has-text("1-Clic Guardado")');
    if (await oneClickTabBtn.isVisible()) {
      await oneClickTabBtn.click();
      await orderPage.waitForTimeout(1000);
    }

    const pay1ClickBtn = orderPage.locator('button:has-text("Pagar 1 Clic")');
    if (await pay1ClickBtn.isVisible()) {
      console.log('Clicking 1-Click payment execution button...');
      await pay1ClickBtn.click();
      await orderPage.waitForTimeout(600);
    }

    const hasSuccessBadge = await orderPage.locator('text=Pago Procesado con Éxito').first().isVisible().catch(() => false);
    console.log('Payment modal success state visible:', hasSuccessBadge);

    await saveDualScreenshot(orderPage, 'sprint33_1click_payment_success.png');
    
    // Wait for modal auto-dismiss and toast
    await orderPage.waitForTimeout(2000);
    const hasOrderPaidBadge = await orderPage.locator('text=Pago confirmado').first().isVisible().catch(() => false);
    console.log('Order confirmed toast / paid status visible:', hasOrderPaidBadge);
    await orderContext.close();

    console.log('\n=== Sprint 33 Playwright Suite Completed Successfully! ===');
  } catch (err) {
    console.error('Playwright suite execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();

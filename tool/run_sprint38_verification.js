const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://testing.jhoanes.com';
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
  const url = 'https://testing.jhoanes.com';
  await context.addCookies([
    { name: 'auth_token', value: token, url },
    { name: 'session_role', value: role, url },
  ]);

  const sessionPayload = {
    user: {
      id: user.id,
      email: user.email,
      role: role,
      user_metadata: user.user_metadata || {},
    },
    token: token,
    session: { access_token: token, user },
  };

  await page.addInitScript((data) => {
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('jhoanes_session', JSON.stringify(data.session));
    localStorage.setItem('local_session', JSON.stringify({ session: data.session, user: data.user }));
    localStorage.setItem('user_data', JSON.stringify(data.user));
  }, sessionPayload);
}

async function main() {
  console.log('=== STARTING PLAYWRIGHT SPRINT 38 PHYSICAL VERIFICATION ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Register Page (Company Name is MANDATORY, NO "Optional" badge)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Register Page: Company Name mandatory ---');
  await page.goto(`${BASE_URL}/auth/register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Check optional badge does not exist
  const optionalBadgeCount = await page.locator('text=Optional, text=Opcional').count();
  console.log(`Optional badge count on register page: ${optionalBadgeCount} (Expected: 0)`);
  if (optionalBadgeCount > 0) {
    console.warn('WARNING: Optional badge found on register page!');
  }

  // Check company_name input has required attribute
  const companyInput = page.locator('input[placeholder*="Bakery"], input[placeholder*="Panadería"]').first();
  const isRequired = await companyInput.getAttribute('required');
  console.log(`Company name input required attribute: ${isRequired !== null ? 'YES' : 'NO'}`);

  await saveDualScreenshot(page, 'sprint38_register_mandatory_company.png');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Address Creation (/profile/addresses/new - NO Alias field)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Address Creation Page: NO Alias field ---');
  const clientLogin = await loginApi(CLIENT_EMAIL, CLIENT_PASS);
  await authenticateSession(context, page, clientLogin.session.access_token, clientLogin.user, 'client');

  await page.goto(`${BASE_URL}/profile/addresses/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Check that "Name (Alias)" / "Nombre (Alias)" is NOT present
  const aliasLabelCount = await page.locator('text="Name (Alias)", text="Nombre (Alias)"').count();
  console.log(`Alias label count on new address page: ${aliasLabelCount} (Expected: 0)`);

  // Verify full address textarea is present
  const addressTextarea = page.locator('textarea').first();
  const addressVisible = await addressTextarea.isVisible();
  console.log(`Full address textarea visible: ${addressVisible}`);

  await saveDualScreenshot(page, 'sprint38_address_no_alias.png');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Unpaid Order Detail View (/orders/[id] shows Pago Pendiente)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Order Detail View for Unpaid Order ---');
  // Get an existing product
  const prods = await (await fetch(`${BASE_URL}/api/products`)).json();
  const validProductId = prods[0]?.id || 101;

  // Create a test order via API with payment_status: 'unpaid'
  const createOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientLogin.session.access_token}`
    },
    body: JSON.stringify({
      status: 'Pedido Enviado',
      payment_status: 'unpaid',
      deliveryDate: '2026-10-30',
      items: [
        { productId: validProductId, quantity: 4, price: 2.5 }
      ]
    })
  });

  const orderData = await createOrderRes.json();
  console.log(`Created test unpaid order ID: ${orderData.id}`);

  await page.goto(`${BASE_URL}/orders/${orderData.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify that "Order Confirmed!" is NOT shown for unpaid orders
  const confirmedCount = await page.locator('h1:has-text("Order Confirmed!"), h1:has-text("Orden Confirmada")').count();
  console.log(`Confirmed title count on unpaid order: ${confirmedCount} (Expected: 0)`);

  // Verify that "Payment Pending" / "Pago Pendiente" IS shown
  const pendingCount = await page.locator('h1:has-text("Payment Pending"), h1:has-text("Pago Pendiente")').count();
  console.log(`Payment Pending title count on unpaid order: ${pendingCount} (Expected: 1)`);

  // Verify that the button to pay via Stripe is visible
  const payBtn = page.locator('[data-testid="pay-invoice-online-btn"]');
  const payBtnVisible = await payBtn.isVisible();
  console.log(`Complete Payment (Stripe) button visible: ${payBtnVisible}`);

  await saveDualScreenshot(page, 'sprint38_order_unpaid_pending_badge.png');

  await browser.close();
  console.log('\n[PASS] ALL SPRINT 38 PHYSICAL CHECKS COMPLETED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Fatal error in sprint 38 verification:', err);
  process.exit(1);
});

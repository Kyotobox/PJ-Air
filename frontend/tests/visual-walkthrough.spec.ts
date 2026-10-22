import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASS = '123123';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../vault/runtime/ui_screenshots');

async function authenticateAsAdmin(page: Page) {
  const res = await page.request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS }
  });
  const data = await res.json();
  const token = data.session.access_token;

  await page.context().addCookies([
    { name: 'auth_token', value: token, domain: 'localhost', path: '/' },
    { name: 'session_role', value: 'admin', domain: 'localhost', path: '/' },
  ]);

  await page.addInitScript((sessionData) => {
    window.localStorage.setItem('local_session', JSON.stringify(sessionData));
  }, data);
}

test.describe('E2E Visual Walkthrough & UI/UX Verification', () => {

  test('01 — Public Catalog / Landing (Open without blocking modal)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/`);
    await page.waitForTimeout(2000);

    // Verify blocking login modal is NOT present
    const blockingModal = page.locator('.fixed.inset-0:has-text("Iniciar Sesión")');
    await expect(blockingModal).toHaveCount(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01_landing_public_catalog.png'),
      fullPage: true,
    });
  });

  test('02 — Terms and Conditions (Bilingual EN/ES)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/terms`);
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02_terms_page_es.png'),
      fullPage: true,
    });

    const enButton = page.locator('button:has-text("English")');
    if (await enButton.isVisible()) {
      await enButton.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03_terms_page_en.png'),
        fullPage: true,
      });
    }
  });

  test('03 — Checkout Gate & Login Redirect', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${FRONTEND_URL}/checkout`);
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04_login_redirect_flow.png'),
    });
  });

  test('04 — Admin Executive Control Tower (/admin)', async ({ page }) => {
    await authenticateAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForTimeout(2500);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06_executive_control_panel.png'),
      fullPage: true,
    });
  });

  test('05 — Admin Clients Management with B2B Credit (/admin/clients)', async ({ page }) => {
    await authenticateAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/admin/clients`);
    await page.waitForTimeout(2500);

    // Open first client modal if present
    const editBtn = page.locator('button:has-text("Editar")').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '07_admin_clients_management.png'),
      fullPage: true,
    });
  });

  test('06 — Interactive Production Reports with Batch Manager (/admin/reports)', async ({ page }) => {
    await authenticateAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/admin/reports`);
    await page.waitForTimeout(2000);

    const generateBtn = page.locator('button:has-text("Generar Reporte")');
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(3000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '08_interactive_production_reports.png'),
      fullPage: true,
    });
  });

  test('07 — Authenticated Checkout with Mandatory Terms Checkbox', async ({ page }) => {
    await authenticateAsAdmin(page);
    await page.goto(`${FRONTEND_URL}/checkout`);
    await page.waitForTimeout(2500);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05_checkout_view.png'),
      fullPage: true,
    });
  });

});

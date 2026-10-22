# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-contrast.spec.ts >> Contraste Físico y Visual de Interfaces Reales >> 03 — Rol Admin: Panel de Control y Pedidos (/admin/orders)
- Location: tests/visual-contrast.spec.ts:29:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button[type="submit"]')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Welcome Back" [level=1] [ref=e9]
      - paragraph [ref=e10]: Fresh delights are waiting for you
    - generic [ref=e11]:
      - generic [ref=e12]:
        - text: Email or Username
        - textbox "your@email.com or username" [ref=e17]: admin@test.com
      - generic [ref=e18]:
        - generic [ref=e19]: Password
        - textbox "••••••••" [active] [ref=e25]: "123123"
      - generic [ref=e26]:
        - button "Sign In" [ref=e27]
        - link "Forgot your password?" [ref=e31] [cursor=pointer]:
          - /url: /auth/forgot-password
    - paragraph [ref=e33]:
      - text: Don't have an account yet?
      - link "Sign up now" [ref=e34] [cursor=pointer]:
        - /url: /auth/register
  - alert [ref=e35]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE_URL = 'http://localhost:3000';
  4  | const ADMIN_EMAIL = 'admin@test.com';
  5  | const ADMIN_PASS = '123123';
  6  | 
  7  | async function loginAsAdmin(page: any) {
  8  |   await page.goto(`${BASE_URL}/auth/login`);
  9  |   await page.locator('input[type="text"]').fill(ADMIN_EMAIL);
  10 |   await page.locator('input[type="password"]').fill(ADMIN_PASS);
  11 |   await page.locator('form button').first().click();
  12 |   await page.waitForURL('**/admin**', { timeout: 15000 });
  13 | }
  14 | 
  15 | test.describe('Contraste Físico y Visual de Interfaces Reales', () => {
  16 | 
  17 |   test('01 — Catálogo Público y Flujo de Navegación', async ({ page }) => {
  18 |     await page.goto(`${BASE_URL}/`);
  19 |     await page.waitForTimeout(2000);
  20 |     await page.screenshot({ path: 'test-results/visual-contrast/01-catalogo-publico.png', fullPage: true });
  21 |     
  22 |     const heading = page.locator('h1, h2').first();
  23 |     await expect(heading).toBeVisible();
  24 |   });
  25 | 
  26 |   test('02 — Pantalla de Autenticación (Login)', async ({ page }) => {
  27 |     await page.goto(`${BASE_URL}/auth/login`);
  28 |     await page.waitForTimeout(1000);
  29 |     await page.screenshot({ path: 'test-results/visual-contrast/02-login.png', fullPage: true });
  30 | 
  31 |     await expect(page.locator('input[type="text"]')).toBeVisible();
  32 |     await expect(page.locator('input[type="password"]')).toBeVisible();
> 33 |   });
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  34 | 
  35 |   test('03 — Rol Admin: Panel de Control y Pedidos (/admin/orders)', async ({ page }) => {
  36 |     await loginAsAdmin(page);
  37 |     await page.goto(`${BASE_URL}/admin/orders`);
  38 |     await page.waitForTimeout(2500);
  39 |     await page.screenshot({ path: 'test-results/visual-contrast/03-admin-pedidos.png', fullPage: true });
  40 |     await expect(page.locator('h1, h2').first()).toBeVisible();
  41 |   });
  42 | 
  43 |   test('04 — Rol Admin: Directorio de Clientes (/admin/clients)', async ({ page }) => {
  44 |     await loginAsAdmin(page);
  45 |     await page.goto(`${BASE_URL}/admin/clients`);
  46 |     await page.waitForTimeout(2500);
  47 |     await page.screenshot({ path: 'test-results/visual-contrast/04-admin-clientes.png', fullPage: true });
  48 |     await expect(page.locator('h1, h2').first()).toBeVisible();
  49 |   });
  50 | 
  51 |   test('05 — Rol Admin: Reportes y Analítica (/admin/reports)', async ({ page }) => {
  52 |     await loginAsAdmin(page);
  53 |     await page.goto(`${BASE_URL}/admin/reports`);
  54 |     await page.waitForTimeout(2500);
  55 |     await page.screenshot({ path: 'test-results/visual-contrast/05-admin-reportes.png', fullPage: true });
  56 |     await expect(page.locator('h1, h2').first()).toBeVisible();
  57 |   });
  58 | 
  59 |   test('06 — Carrito y Checkout Transaccional', async ({ page }) => {
  60 |     await page.goto(`${BASE_URL}/`);
  61 |     await page.waitForTimeout(2000);
  62 |     
  63 |     await page.goto(`${BASE_URL}/checkout`);
  64 |     await page.waitForTimeout(2000);
  65 |     await page.screenshot({ path: 'test-results/visual-contrast/06-checkout.png', fullPage: true });
  66 |     await expect(page.locator('h1, h2').first()).toBeVisible();
  67 |   });
  68 | 
  69 | });
  70 | 
```
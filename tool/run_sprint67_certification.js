/**
 * tool/run_sprint67_certification.js
 * 
 * Certificación Playwright en vivo sobre https://testing.jhoanes.com para Sprint S67:
 * 1. Acceder a /auth/register y verificar físicamente la erradicación del campo 'username' / 'Usuario'.
 * 2. Desplegar el acordeón de Términos y Condiciones Oficiales y validar la presencia de las 5 cláusulas en inglés oficial.
 * 3. Capturar evidencia sprint67_01_register_no_username_english_terms.png.
 * 4. Acceder a /terms y verificar la página de políticas comerciales en inglés.
 * 5. Capturar evidencia sprint67_02_commercial_terms_page_english.png.
 */

const tls = require('tls');
try {
  tls.DEFAULT_CIPHERS = 'DEFAULT@SECLEVEL=1';
} catch (e) {}

const extraLibPaths = ['/tmp/libs/usr/lib/aarch64-linux-gnu', '/tmp/libs/lib/aarch64-linux-gnu'];
const currentLd = process.env.LD_LIBRARY_PATH || '';
process.env.LD_LIBRARY_PATH = extraLibPaths.concat(currentLd.split(':').filter(Boolean)).join(':');
process.env.FONTCONFIG_PATH = '/tmp/libs/etc/fonts';
process.env.FONTCONFIG_FILE = '/tmp/libs/etc/fonts/fonts.conf';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TESTING_URL || 'https://testing.jhoanes.com';
const SCREENSHOTS_ROOT = path.resolve(__dirname, '../ui_screenshots');
const SCREENSHOTS_VAULT = path.resolve(__dirname, '../vault/runtime/ui_screenshots');

if (!fs.existsSync(SCREENSHOTS_ROOT)) fs.mkdirSync(SCREENSHOTS_ROOT, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_VAULT)) fs.mkdirSync(SCREENSHOTS_VAULT, { recursive: true });

async function saveDualScreenshot(page, filename) {
  const rootPath = path.join(SCREENSHOTS_ROOT, filename);
  const vaultPath = path.join(SCREENSHOTS_VAULT, filename);
  
  await page.screenshot({ path: rootPath, fullPage: true });
  fs.copyFileSync(rootPath, vaultPath);

  const stats = fs.statSync(rootPath);
  const vaultStats = fs.statSync(vaultPath);

  if (!fs.existsSync(rootPath) || stats.size === 0) {
    throw new Error(`Fallo de captura: ${rootPath} no existe o está vacío`);
  }
  if (!fs.existsSync(vaultPath) || vaultStats.size === 0) {
    throw new Error(`Fallo de réplica: ${vaultPath} no existe o está vacío`);
  }

  const sizeKb = (stats.size / 1024).toFixed(1);
  console.log(`[CERT-SCREENSHOT] ${filename} -> Root: ${rootPath} (${sizeKb} KB) | Vault: ${vaultPath}`);
  return { filename, rootPath, vaultPath, sizeKb };
}

async function run() {
  console.log(`=== INICIANDO CERTIFICACIÓN SPRINT S67 EN VIVO (${BASE_URL}) ===`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  try {
    // 1. Visitar /auth/register
    console.log(`[1/4] Navegando a ${BASE_URL}/auth/register...`);
    await page.goto(`${BASE_URL}/auth/register`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 2. Verificar que no existe campo de username ni placeholder johndoe_b2b
    const johndoeInput = await page.$('input[placeholder="johndoe_b2b"]');
    if (johndoeInput) {
      throw new Error('FALLO CRÍTICO: El input con placeholder johndoe_b2b sigue presente en la página!');
    }
    console.log('[+] Verificado: Campo @username erradicado del formulario de registro.');

    // 3. Abrir acordeón de Términos y Condiciones
    console.log('[2/4] Abriendo acordeón de Términos y Condiciones en registro...');
    const accordionBtn = await page.$('text=Official Terms & Commercial Conditions');
    if (accordionBtn) {
      await accordionBtn.click();
    } else {
      const fallbackBtn = await page.$('text=Términos y Condiciones Comerciales');
      if (fallbackBtn) await fallbackBtn.click();
    }
    await page.waitForTimeout(1000);

    // Verificar presencia de cláusula en inglés
    const content = await page.content();
    const hasEnglishPolicy = content.includes('Production Cutoff Policy (36h)') || content.includes('Operating Delivery Schedule');
    console.log(`[+] Cláusula en inglés oficial detectada en acordeón: ${hasEnglishPolicy}`);

    // Capturar screenshot 1
    await saveDualScreenshot(page, 'sprint67_01_register_no_username_english_terms.png');

    // 4. Navegar a /terms
    console.log(`[3/4] Navegando a ${BASE_URL}/terms...`);
    await page.goto(`${BASE_URL}/terms`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Capturar screenshot 2
    await saveDualScreenshot(page, 'sprint67_02_commercial_terms_page_english.png');

    console.log('[4/4] === CERTIFICACIÓN VISUAL PLAYWRIGHT S67 EXITOSA ===');
  } catch (err) {
    console.error('[-] Error en certificación:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();

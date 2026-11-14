#!/usr/bin/env node
/**
 * TASK-94-03: Script de Conciliación Histórica de Invoices en Stripe
 * 
 * Recorre todas las órdenes que posean un PaymentIntent de Stripe ('pi_...') y un
 * número oficial de factura ('INV-XXXX'). Si en Stripe persiste el código temporal
 * (ej. primeros 8 caracteres de UUID) en lugar del folio canónico, actualiza la descripción
 * y los metadatos del PaymentIntent.
 * 
 * Uso:
 *   node scripts/reconcile-stripe-invoices.js [--dry-run] [--db=/path/to/database.sqlite]
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Load .env from cwd or __dirname
const candidateEnvs = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
];

for (const envPath of candidateEnvs) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const isDryRun = process.argv.includes('--dry-run');
const dbArg = process.argv.find(arg => arg.startsWith('--db='));
const defaultDbCandidates = [
  process.env.DATABASE_PATH,
  path.resolve(process.cwd(), 'database.sqlite'),
  path.resolve(__dirname, '../database.sqlite'),
];
const dbPath = dbArg 
  ? dbArg.replace('--db=', '') 
  : defaultDbCandidates.find(p => p && fs.existsSync(p)) || path.resolve(__dirname, '../database.sqlite');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET) {
  console.error('❌ Error: STRIPE_SECRET_KEY no está definido en el entorno.');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Error: Base de datos no encontrada en ${dbPath}`);
  process.exit(1);
}

const stripe = require('stripe')(STRIPE_SECRET);
const db = new sqlite3.Database(dbPath);

console.log('===============================================================');
console.log(`🚀 [TASK-94-03] Conciliación Histórica de Invoices en Stripe`);
console.log(`📁 Base de Datos: ${dbPath}`);
console.log(`⚙️ Modo: ${isDryRun ? 'DRY-RUN (Simulación sin mutar Stripe)' : 'LIVE (Actualización en tiempo real)'}`);
console.log('===============================================================\n');

async function reconcile() {
  const query = `
    SELECT 
      o.id, 
      o.invoice_number, 
      o.stripe_payment_id, 
      o.total, 
      o.payment_status,
      u.email,
      p.full_name,
      p.company_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN profiles p ON p.id = o.user_id
    WHERE o.stripe_payment_id LIKE 'pi_%'
      AND o.invoice_number IS NOT NULL
      AND TRIM(o.invoice_number) != ''
    ORDER BY o.created_at ASC;
  `;

  db.all(query, [], async (err, rows) => {
    if (err) {
      console.error('❌ Error consultando base de datos:', err.message);
      db.close();
      process.exit(1);
    }

    console.log(`📋 Total de órdenes encontradas con PaymentIntent y Factura: ${rows.length}`);

    let updatedCount = 0;
    let alreadySyncedCount = 0;
    let failedCount = 0;

    for (const order of rows) {
      const piId = order.stripe_payment_id;
      const invNum = order.invoice_number;
      const clientName = order.full_name || order.company_name || order.email || 'Cliente';

      try {
        const intent = await stripe.paymentIntents.retrieve(piId);
        const currentDesc = intent.description || '';
        const currentMetaInv = intent.metadata?.invoice_number || '';

        const needsSync = !currentDesc.includes(invNum) || currentMetaInv !== invNum;

        if (needsSync) {
          console.log(`🔍 [DESFASE DETECTADO] Orden #${order.id.slice(0, 8)} | Factura BD: ${invNum}`);
          console.log(`   Stripe Actual: desc="${currentDesc}" | meta.invoice_number="${currentMetaInv}"`);

          const targetDescription = `Invoice ${invNum} — ${clientName}`;
          const targetMetadata = {
            ...(intent.metadata || {}),
            invoice_number: invNum,
            orderId: order.id,
          };

          if (!isDryRun) {
            await stripe.paymentIntents.update(piId, {
              description: targetDescription,
              metadata: targetMetadata,
            });
            console.log(`   ✅ [SINCRONIZADO] ${piId} -> "${targetDescription}"`);
          } else {
            console.log(`   [DRY-RUN] Se actualizaría ${piId} con "${targetDescription}"`);
          }
          updatedCount++;
        } else {
          console.log(`✔️ [ALINEADO] Orden #${order.id.slice(0, 8)} (${invNum}) ya está sincronizada en Stripe (${piId}).`);
          alreadySyncedCount++;
        }
      } catch (stripeErr) {
        console.error(`   ❌ [ERROR STRIPE] ${piId}: ${stripeErr.message}`);
        failedCount++;
      }
    }

    console.log('\n===============================================================');
    console.log(`🏁 Resumen de Conciliación:`);
    console.log(`   - Total Analizados: ${rows.length}`);
    console.log(`   - Actualizados / Corregidos: ${updatedCount}`);
    console.log(`   - Ya Sincronizados: ${alreadySyncedCount}`);
    console.log(`   - Errores: ${failedCount}`);
    console.log('===============================================================\n');

    db.close();
  });
}

reconcile();

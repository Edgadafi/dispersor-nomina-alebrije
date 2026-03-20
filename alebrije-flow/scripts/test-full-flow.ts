import "dotenv/config";
import { buildAtomicPayroll } from "../src/lib/payroll_builder.js";
import {
  getLatestSaveEvents,
  type SaveEventPayload,
} from "../src/lib/events_listener.js";
import {
  adminKeypair,
  sorobanServer,
  networkPassphrase,
} from "../src/lib/stellar.js";
import * as StellarSdk from "@stellar/stellar-sdk";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 60000;

async function runIntegrationTest() {
  console.log("🧪 Iniciando Prueba de Integración: Alebrije Flow\n");

  if (!adminKeypair) {
    console.error("❌ ADMIN_SECRET_KEY no configurado. Crea .env con tu llave de Testnet.");
    process.exit(1);
  }

  const employeePK =
    process.env.EMPLOYEE_PUBLIC_KEY ?? "GA...PUBLIC_KEY_EMPLEADO_TEST";
  const netAmount = process.env.NET_AMOUNT ?? "100.00";
  const savingsAmount = Number(process.env.SAVINGS_AMOUNT ?? "10");

  if (employeePK.startsWith("GA...")) {
    console.warn(
      "⚠️  EMPLOYEE_PUBLIC_KEY no configurado. Usa una cuenta Testnet con trustline a USDC.\n"
    );
  }

  console.log("🏗️  1. Construyendo Transacción Atómica (Pago USDC + Bóveda Soroban)...");
  let xdr: string;
  try {
    xdr = await buildAtomicPayroll(
      adminKeypair.publicKey(),
      employeePK,
      netAmount,
      savingsAmount
    );
    console.log("   ✓ Transacción construida y simulada (Soroban RPC)\n");
  } catch (e) {
    console.error("❌ Error construyendo transacción:", e);
    process.exit(1);
  }

  console.log("✍️  2. Firmando (Multisig bypass para test — en MVP real: Accesly SDK)...");
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    xdr,
    networkPassphrase
  ) as StellarSdk.Transaction;
  transaction.sign(adminKeypair);
  console.log("   ✓ Firma aplicada\n");

  console.log("🚀 3. Enviando a Stellar Testnet...");
  let txHash: string;
  try {
    const result = await sorobanServer.sendTransaction(transaction);
    txHash = result.hash;
    if (result.status === "ERROR" && result.errorResult) {
      console.error("❌ Transacción rechazada:", result.errorResult);
      process.exit(1);
    }
    console.log(`   ✓ Enviada. Hash: ${txHash}\n`);
  } catch (e) {
    console.error("❌ Error enviando transacción:", e);
    process.exit(1);
  }

  console.log("⏳ 4. Esperando evento save_evt del contrato vault...");
  const startTime = Date.now();

  const checkEvents = (): Promise<SaveEventPayload | null> =>
    getLatestSaveEvents({ ledgerRange: 2000, limit: 100 }).then((events) => {
      const match = events.find((e) => e.txHash === txHash);
      return match ?? null;
    });

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const event = await checkEvents();
    if (event) {
      console.log("\n✅ ¡EVENTO CAPTURADO!");
      console.log(`   💰 Empleado: ${event.owner} | Ahorro: ${event.amount} USDC`);
      console.log(`   📋 Ledger: ${event.ledger} | Tx: ${event.txHash}`);
      console.log("\n🎉 Prueba de integración superada.");
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    process.stdout.write(".");
  }

  console.log("\n❌ Timeout: no se detectó el evento save_evt. Verifica VAULT_CONTRACT_ID.");
  process.exit(1);
}

runIntegrationTest();

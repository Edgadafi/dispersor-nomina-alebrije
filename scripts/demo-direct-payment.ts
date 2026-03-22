/**
 * Demo de dispersión DIRECTA vía Stellar (sin SDP receiver registration).
 *
 * Uso: npx tsx scripts/demo-direct-payment.ts [data/nomina-demo.csv]
 */
import { readFileSync } from "node:fs";
import { dispersarDesdeCsv } from "../alebrije-flow/src/dispersar-direct.js";

async function main() {
  const csvPath = process.argv[2] ?? "./data/nomina-demo.csv";
  const csvContent = readFileSync(csvPath, "utf-8");

  console.log(`\n🐉 Dispersión directa — ${csvContent.split("\n").length - 1} pagos\n`);

  const result = await dispersarDesdeCsv(csvContent);

  console.log(`  Batch: ${result.batchId}`);
  console.log(`  TxHash: ${result.txHash}`);
  console.log(`  Commitment: ${result.commitmentHash.slice(0, 16)}...`);
  console.log(`\n✅ Dispersión LFPDP completada. ${result.count} pagos, ${result.total} ${result.asset}`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});

import "dotenv/config";
import { createSdpClientFromEnv } from "../alebrije-flow/src/sdp-client.js";
import {
  resolverWalletYAsset,
  dispersarNomina,
  monitorearDispersion,
} from "../alebrije-flow/src/nomina-service.js";

const CSV_PATH = process.argv[2] ?? "./data/nomina-demo.csv";

// Callback del Concierge: imprime con timestamp
const concierge = (msg: string) => {
  const ts = new Date().toLocaleTimeString("es-MX");
  console.log(`\x1b[36m[Concierge ${ts}]\x1b[0m ${msg}`);
};

async function main() {
  console.log("\n🐉 Dispersor Alebrije — Demo end-to-end\n");

  const sdp = createSdpClientFromEnv();

  await concierge("Conectando con el SDP...");
  const { walletId, assetId } = await resolverWalletYAsset(sdp, "MXNe");
  await concierge(`Wallet: ${walletId} | Asset MXNe: ${assetId}`);

  const resultado = await dispersarNomina(CSV_PATH, sdp, {
    walletId,
    assetId,
    name: `demo-hackathon-${new Date().toISOString().slice(0, 10)}`,
    onStatus: concierge,
    autoApprove: true,
  });

  console.log("\n📋 Resultado inicial:", resultado);

  await concierge("Monitoreando pagos en tiempo real...");
  const final = await monitorearDispersion(
    resultado.disbursementId,
    sdp,
    concierge,
    { intervalMs: 8_000, timeoutMs: 15 * 60 * 1000 }
  );

  console.log("\n✅ Estado final:", final.status);
  console.log(`💰 Total dispersado: ${final.amount_disbursed} MXNe`);
  console.log(
    `📊 Pagos: ${final.total_payments_sent}/${final.total_payments} exitosos`
  );
}

main().catch((err) => {
  console.error("\x1b[31m❌ Error:\x1b[0m", err.message);
  process.exit(1);
});

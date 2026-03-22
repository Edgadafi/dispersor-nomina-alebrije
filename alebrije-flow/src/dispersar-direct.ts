/**
 * Dispersión de nómina LFPDP: commitment on-chain + datos off-chain.
 * No se exponen salarios en el ledger; dispersión real vía SPEI (mock en demo).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
config({ path: resolve(process.cwd(), "alebrije-flow/.env") });
import { computeBatchCommitment } from "./commitment.js";
import { postCommitmentTx } from "./commitment-tx.js";
import { storeBatch, updateBatchTxHash } from "./payroll-store.js";
import { sendReceipt } from "./receipt-sender.js";
import { parseCsvFromString } from "./parse-csv.js";

const ASSET_CODE = process.env.ASSET_CODE ?? "USDC";

export type { CsvRow } from "./parse-csv.js";

export interface DispersarResult {
  ok: boolean;
  batchId: string;
  commitmentHash: string;
  hash: string;
  txHash: string;
  total: number;
  asset: string;
  count: number;
}

export { parseCsvFromString };

/**
 * Dispersión LFPDP: commitment on-chain, datos cifrados off-chain, dispersión mock.
 */
export async function dispersarDesdeCsv(
  csvContent: string
): Promise<DispersarResult> {
  const rows = parseCsvFromString(csvContent);
  if (rows.length === 0) throw new Error("CSV vacío");

  const batchId = randomUUID();
  const commitmentHashBuffer = computeBatchCommitment(rows, batchId);
  const commitmentHashHex = commitmentHashBuffer.toString("hex");

  const total = rows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);

  storeBatch(
    batchId,
    {
      rows,
      total,
      asset: ASSET_CODE,
      commitmentHash: commitmentHashHex,
    },
    null
  );

  const txHash = await postCommitmentTx(commitmentHashBuffer);
  updateBatchTxHash(batchId, txHash);

  const fecha = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    console.log(
      `[Mock SPEI] Batch ${batchId}: empleado ${row.employee_id ?? "N/A"} -> ${row.amount} ${ASSET_CODE} (would disburse via SPEI)`
    );
    if (row.phone && row.amount) {
      await sendReceipt(row.phone, {
        employee_id: row.employee_id ?? "N/A",
        amount: row.amount,
        asset: ASSET_CODE,
        txHash,
        date: fecha,
      });
    }
  }

  return {
    ok: true,
    batchId,
    commitmentHash: commitmentHashHex,
    hash: txHash,
    txHash,
    total,
    asset: ASSET_CODE,
    count: rows.length,
  };
}

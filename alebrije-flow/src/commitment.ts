/**
 * Cálculo y verificación de commitments de batch para LFPDP.
 * Hash on-chain; datos completos off-chain.
 */
import { createHash } from "node:crypto";

export interface BatchRow {
  employee_id?: string;
  amount: string;
  stellar_address?: string;
}

function hashRow(row: BatchRow): Buffer {
  const emp = row.employee_id ?? "";
  const amt = row.amount ?? "0";
  const addr = row.stellar_address ?? "";
  const payload = `${emp}|${amt}|${addr}`;
  return createHash("sha256").update(payload).digest();
}

/**
 * Merkle root simplificado: H(H(row1) | H(row2) | ...)
 */
function merkleRoot(rows: BatchRow[]): Buffer {
  const hashes = rows.map(hashRow);
  const combined = Buffer.concat(hashes);
  return createHash("sha256").update(combined).digest();
}

/**
 * Calcula el commitment del batch (32 bytes) para Stellar MemoHash.
 */
export function computeBatchCommitment(
  rows: BatchRow[],
  batchId: string
): Buffer {
  const count = rows.length;
  const total = rows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
  const totalStr = total.toFixed(7);
  const root = merkleRoot(rows);

  const payload = Buffer.concat([
    Buffer.from(batchId, "utf-8"),
    Buffer.from(`|${count}|${totalStr}|`, "utf-8"),
    root,
  ]);
  return createHash("sha256").update(payload).digest();
}

/**
 * Verifica que el commitment coincide con los datos almacenados.
 */
export function verifyCommitment(
  commitmentHash: Buffer,
  storedData: { rows: BatchRow[]; batchId: string }
): boolean {
  const recomputed = computeBatchCommitment(
    storedData.rows,
    storedData.batchId
  );
  return Buffer.compare(commitmentHash, recomputed) === 0;
}

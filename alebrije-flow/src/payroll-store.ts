/**
 * Almacenamiento off-chain cifrado de datos salariales (LFPDP).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

config({ path: resolve(process.cwd(), "alebrije-flow/.env") });

const STORE_DIR = resolve(process.cwd(), "data/payroll-store");
const ALGORITHM = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 32;
const KEY_LEN = 32;

export interface CsvRow {
  amount: string;
  stellar_address?: string;
  phone?: string;
  employee_id?: string;
  date_of_birth?: string;
}

export interface StoredBatch {
  batchId: string;
  commitmentHash: string;
  rows: CsvRow[];
  total: number;
  asset: string;
  createdAt: string;
  txHash: string | null;
}

function getKey(): Buffer {
  const raw = process.env.PAYROLL_STORE_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "PAYROLL_STORE_KEY debe tener al menos 32 caracteres en .env"
    );
  }
  return scryptSync(raw, "payroll-salt", KEY_LEN);
}

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function batchPath(batchId: string): string {
  const safe = batchId.replace(/[^a-zA-Z0-9-]/g, "_");
  return resolve(STORE_DIR, `${safe}.enc`);
}

function encrypt(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(b64: string): string {
  const key = getKey();
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final("utf-8");
}

/**
 * Almacena un batch cifrado. txHash puede ser null inicialmente.
 */
export function storeBatch(
  batchId: string,
  data: {
    rows: CsvRow[];
    total: number;
    asset: string;
    commitmentHash: string;
  },
  txHash: string | null
): void {
  ensureDir();
  const stored: StoredBatch = {
    batchId,
    commitmentHash: data.commitmentHash,
    rows: data.rows,
    total: data.total,
    asset: data.asset,
    createdAt: new Date().toISOString(),
    txHash,
  };
  const plain = JSON.stringify(stored);
  const enc = encrypt(plain);
  writeFileSync(batchPath(batchId), enc, "utf-8");
}

/**
 * Actualiza el txHash de un batch ya almacenado.
 */
export function updateBatchTxHash(batchId: string, txHash: string): void {
  const batch = getBatch(batchId);
  if (!batch) throw new Error(`Batch ${batchId} no encontrado`);
  storeBatch(batchId, batch, txHash);
}

/**
 * Obtiene un batch desencriptado.
 */
export function getBatch(batchId: string): StoredBatch | null {
  ensureDir();
  const path = batchPath(batchId);
  if (!existsSync(path)) return null;
  const enc = readFileSync(path, "utf-8");
  try {
    const plain = decrypt(enc);
    return JSON.parse(plain) as StoredBatch;
  } catch {
    return null;
  }
}

/**
 * Lista los IDs de batch almacenados.
 */
export function listBatches(): string[] {
  ensureDir();
  const files = readdirSync(STORE_DIR).filter((f) => f.endsWith(".enc"));
  return files.map((f) => f.replace(/\.enc$/, "").replace(/_/g, "-"));
}

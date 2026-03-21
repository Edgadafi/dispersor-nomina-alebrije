/**
 * Servicio de nómina que usa el Stellar Disbursement Platform (SDP).
 * Reemplaza la lógica manual de transacciones Stellar por llamadas al SDP REST API.
 *
 * Flujo: leer CSV → crear disbursement → subir instrucciones → aprobar → iniciar.
 */

import { readFileSync } from "node:fs";
import { parse } from "node:path";
import {
  SdpClient,
  type DisbursementResponse,
  type PaymentResponse,
} from "./sdp-client.js";

/** Callback opcional para reportar estado al Concierge (Gemini) */
export type ConciergeStatusCallback = (msg: string) => void | Promise<void>;

const REQUIRED_CSV_COLUMNS = ["phone", "employee_id", "amount", "date_of_birth"] as const;

interface CsvRow {
  phone: string;
  employee_id: string;
  amount: string;
  date_of_birth: string;
}

/**
 * Convierte CSV con columnas alebrije a formato SDP (phone, id, amount, verification).
 * SDP usa verification para DATE_OF_BIRTH.
 */
function convertCsvToSdpFormat(csvContent: string): string {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV debe tener encabezado y al menos una fila");
  }

  const header = lines[0].toLowerCase();
  const cols = header.split(",").map((c) => c.trim());

  const phoneIdx = cols.indexOf("phone");
  const empIdx = cols.indexOf("employee_id");
  const amountIdx = cols.indexOf("amount");
  const dobIdx = cols.indexOf("date_of_birth");

  if (phoneIdx < 0 || empIdx < 0 || amountIdx < 0 || dobIdx < 0) {
    throw new Error(
      `CSV debe tener columnas: ${REQUIRED_CSV_COLUMNS.join(", ")}. Encontrado: ${cols.join(", ")}`
    );
  }

  const sdpHeader = "phone,id,amount,verification,paymentID";
  const sdpRows: string[] = [sdpHeader];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.length < Math.max(phoneIdx, empIdx, amountIdx, dobIdx) + 1) continue;

    const phone = vals[phoneIdx]?.trim() ?? "";
    const empId = vals[empIdx]?.trim() ?? "";
    const amount = vals[amountIdx]?.trim() ?? "";
    const dob = vals[dobIdx]?.trim() ?? "";

    if (!phone || !amount) continue;

    sdpRows.push(`${quote(phone)},${quote(empId)},${quote(amount)},${quote(dob)},PAY_${i}`);
  }

  return sdpRows.join("\n");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || c === "\r") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function quote(s: string): string {
  return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Valida que el CSV tenga las columnas requeridas y filas válidas.
 */
function validateCsv(csvPath: string): CsvRow[] {
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV debe tener encabezado y al menos una fila de datos");
  }

  const header = lines[0].toLowerCase();
  const cols = header.split(",").map((c) => c.trim());

  const phoneIdx = cols.indexOf("phone");
  const empIdx = cols.indexOf("employee_id");
  const amountIdx = cols.indexOf("amount");
  const dobIdx = cols.indexOf("date_of_birth");

  const missing = REQUIRED_CSV_COLUMNS.filter(
    (c) => cols.indexOf(c) < 0
  );
  if (missing.length > 0) {
    throw new Error(
      `Columnas requeridas faltantes: ${missing.join(", ")}. Encontrado: ${cols.join(", ")}`
    );
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.length < 4) continue;

    const phone = vals[phoneIdx]?.trim() ?? "";
    const employee_id = vals[empIdx]?.trim() ?? "";
    const amount = vals[amountIdx]?.trim() ?? "";
    const date_of_birth = vals[dobIdx]?.trim() ?? "";

    if (!phone || !amount) {
      throw new Error(`Fila ${i + 1}: phone y amount son obligatorios`);
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error(`Fila ${i + 1}: amount debe ser un número positivo`);
    }

    rows.push({ phone, employee_id, amount, date_of_birth });
  }

  return rows;
}

export interface DispersionResult {
  disbursementId: string;
  status: string;
  totalPayments: number;
  message: string;
}

/**
 * Resuelve walletId y assetId automáticamente desde el SDP.
 * Busca la primera wallet disponible y el asset con código assetCode.
 * Útil para el demo: no necesitas conocer los IDs de antemano.
 */
export async function resolverWalletYAsset(
  sdpClient: SdpClient,
  assetCode = "MXNe"
): Promise<{ walletId: string; assetId: string }> {
  const [wallets, assets] = await Promise.all([
    sdpClient.listWallets(),
    sdpClient.listAssets(),
  ]);

  if (wallets.length === 0) {
    throw new Error(
      "No hay wallets registradas en el SDP. " +
        "Ve al Dashboard en http://localhost:8000 y registra una wallet primero."
    );
  }

  const asset = assets.find(
    (a) => a.code.toUpperCase() === assetCode.toUpperCase()
  );
  if (!asset) {
    const disponibles = assets.map((a) => a.code).join(", ");
    throw new Error(
      `Asset "${assetCode}" no encontrado en el SDP. ` +
        `Disponibles: ${disponibles || "ninguno"}. ` +
        "Registra el asset en el Dashboard primero."
    );
  }

  return {
    walletId: wallets[0].id,
    assetId: asset.id,
  };
}

/**
 * Dispersa la nómina usando el SDP.
 *
 * @param csvPath - Ruta al CSV (phone, employee_id, amount, date_of_birth)
 * @param sdpClient - Cliente SDP configurado con JWT
 * @param options - walletId, assetId, nombre del disbursement, y callback para concierge
 */
export async function dispersarNomina(
  csvPath: string,
  sdpClient: SdpClient,
  options: {
    walletId: string;
    assetId: string;
    name?: string;
    onStatus?: ConciergeStatusCallback;
    autoApprove?: boolean;
  }
): Promise<DispersionResult> {
  const report = options.onStatus ?? (() => {});

  await report("Validando archivo CSV...");
  const rows = validateCsv(csvPath);
  await report(`CSV válido: ${rows.length} empleados`);

  const disbursementName =
    options.name ??
    `nomina-${parse(csvPath).name}-${new Date().toISOString().slice(0, 10)}`;

  await report("Creando disbursement en SDP...");
  const created = await sdpClient.createDisbursement({
    name: disbursementName,
    wallet_id: options.walletId,
    asset_id: options.assetId,
    verification_field: "DATE_OF_BIRTH",
    registration_contact_type: "PHONE_NUMBER",
  });

  const disbursementId = created.id;
  await report(`Disbursement creado: ${disbursementId}`);

  const csvContent = readFileSync(csvPath, "utf-8");
  const sdpCsv = convertCsvToSdpFormat(csvContent);
  const csvBuffer = Buffer.from(sdpCsv, "utf-8");

  await report("Subiendo instrucciones (CSV) al SDP...");
  await sdpClient.uploadDisbursementInstructions(
    disbursementId,
    csvBuffer,
    `nomina-${Date.now()}.csv`
  );

  let status = await sdpClient.getDisbursementStatus(disbursementId);
  await report(`Estado actual: ${status.status}`);

  // Esperar aprobación si el org tiene approval flow
  if (status.status === "READY" || options.autoApprove) {
    await report("Iniciando dispersión...");
    await sdpClient.startDisbursement(disbursementId);
    status = await sdpClient.getDisbursementStatus(disbursementId);
  } else if (status.status === "DRAFT") {
    await report(
      "Disbursement en DRAFT. Requiere aprobación en el Dashboard antes de iniciar."
    );
  }

  return {
    disbursementId,
    status: status.status,
    totalPayments: status.total_payments ?? rows.length,
    message: `Disbursement ${disbursementId} en estado ${status.status}. Puedes hacer polling con getDisbursementStatus().`,
  };
}

/**
 * Obtiene el estado actual de un disbursement (para polling).
 */
export async function getEstadoDispersion(
  disbursementId: string,
  sdpClient: SdpClient
): Promise<DisbursementResponse> {
  return sdpClient.getDisbursementStatus(disbursementId);
}

/**
 * Lista los pagos de un disbursement (para seguimiento).
 */
export async function listarPagos(
  disbursementId: string,
  sdpClient: SdpClient
): Promise<PaymentResponse[]> {
  const pag = await sdpClient.listPayments(disbursementId, {
    page_limit: 100,
  });
  return pag.data ?? [];
}

/**
 * Hace polling del estado de un disbursement hasta que complete o falle.
 * Llama onStatus en cada ciclo para que el Concierge (Gemini) pueda reportar.
 *
 * @param disbursementId - ID del disbursement a monitorear
 * @param sdpClient - Cliente SDP
 * @param onStatus - Callback del Concierge para reportar progreso
 * @param options - intervalMs (default 10s), timeoutMs (default 10min)
 */
export async function monitorearDispersion(
  disbursementId: string,
  sdpClient: SdpClient,
  onStatus: ConciergeStatusCallback,
  options: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<DisbursementResponse> {
  const intervalMs = options.intervalMs ?? 10_000;
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const estado = await sdpClient.getDisbursementStatus(disbursementId);

    const enviados = estado.total_payments_sent ?? 0;
    const fallidos = estado.total_payments_failed ?? 0;
    const total = estado.total_payments ?? 0;
    const pendientes = total - enviados - fallidos;

    await onStatus(
      `[${estado.status}] ${enviados}/${total} pagos enviados` +
        (fallidos > 0 ? ` · ${fallidos} fallidos` : "") +
        (pendientes > 0 ? ` · ${pendientes} pendientes` : "")
    );

    if (estado.status === "COMPLETED") {
      await onStatus(
        `Dispersión completada. Total enviado: ${estado.amount_disbursed} MXNe`
      );
      return estado;
    }

    if (estado.status === "PAUSED") {
      await onStatus(
        "Dispersión pausada. Revisa el Dashboard para continuar o cancelar."
      );
      return estado;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timeout: el disbursement ${disbursementId} no completó en ${timeoutMs / 60_000} minutos.`
  );
}

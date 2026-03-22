/**
 * Envío de recibos de nómina a empleados (SMS vía Twilio o DRY_RUN).
 * Se invoca tras una dispersión exitosa.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "alebrije-flow/.env") });

export interface ReceiptPayload {
  employee_id: string;
  amount: string;
  asset: string;
  txHash: string;
  date?: string;
}

// Por defecto DRY_RUN. Para enviar SMS reales: RECEIPT_DRY_RUN=0
const RECEIPT_DRY_RUN =
  process.env.RECEIPT_DRY_RUN === undefined ||
  process.env.RECEIPT_DRY_RUN === "" ||
  !["0", "false", "no"].includes(process.env.RECEIPT_DRY_RUN.toLowerCase());
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_SERVICE_SID = process.env.TWILIO_SERVICE_SID;

function formatReceiptMessage(payload: ReceiptPayload): string {
  const fecha = payload.date ?? new Date().toISOString().slice(0, 10);
  return [
    "📄 Recibo de nómina",
    `Empleado: ${payload.employee_id}`,
    `Monto: ${payload.amount} ${payload.asset}`,
    `Fecha: ${fecha}`,
    `Tx: ${payload.txHash.slice(0, 8)}...`,
  ].join("\n");
}

/**
 * Envía recibo por SMS al empleado. Si no hay Twilio configurado, DRY_RUN (log).
 */
export async function sendReceipt(
  phone: string,
  payload: ReceiptPayload
): Promise<{ ok: boolean; error?: string }> {
  const body = formatReceiptMessage(payload);

  if (
    RECEIPT_DRY_RUN ||
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_AUTH_TOKEN
  ) {
    console.log(`[DRY_RUN] Recibo a ${phone}:`, body);
    return { ok: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const form = new URLSearchParams();
  form.set("To", phone);
  form.set("Body", body);
  if (TWILIO_SERVICE_SID) {
    form.set("MessagingServiceSid", TWILIO_SERVICE_SID);
  } else if (TWILIO_PHONE_NUMBER) {
    form.set("From", TWILIO_PHONE_NUMBER);
  } else {
    console.warn("[ReceiptSender] Falta TWILIO_PHONE_NUMBER o TWILIO_SERVICE_SID, usando DRY_RUN");
    console.log(`[DRY_RUN] Recibo a ${phone}:`, body);
    return { ok: true };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = (await res.json()) as { sid?: string; message?: string; error_code?: number };
    if (!res.ok) {
      const err = data.message ?? `HTTP ${res.status}`;
      console.error(`[ReceiptSender] Twilio error para ${phone}:`, err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ReceiptSender] Error enviando a ${phone}:`, msg);
    return { ok: false, error: msg };
  }
}

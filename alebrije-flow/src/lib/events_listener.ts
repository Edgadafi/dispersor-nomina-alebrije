import * as StellarSdk from "@stellar/stellar-sdk";
import { sorobanServer } from "./stellar.js";

const VAULT_CONTRACT_ID =
  process.env.VAULT_CONTRACT_ID ??
  "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";

/** Nombre del evento emitido por el contrato vault cuando un empleado recibe ahorro */
const SAVE_EVT = "save_evt";

export interface SaveEventPayload {
  owner: string;
  amount: string;
  ledger: number;
  txHash: string;
  ledgerClosedAt: string;
}

export type SaveEventNotification = (payload: SaveEventPayload) => void;

/**
 * Obtiene los últimos eventos del contrato vault vía Soroban RPC.
 * Filtra por 'save_evt' y ejecuta onSave para cada depósito de ahorro.
 */
export async function listenVaultSaveEvents(
  onSave: SaveEventNotification,
  options?: {
    /** Rango de ledgers hacia atrás (default: 1000) */
    ledgerRange?: number;
    /** Límite de eventos por request (default: 50) */
    limit?: number;
  }
): Promise<SaveEventPayload[]> {
  const { ledgerRange = 1000, limit = 50 } = options ?? {};

  const { sequence: latestLedger } = await sorobanServer.getLatestLedger();
  const startLedger = Math.max(0, latestLedger - ledgerRange);

  const response = await sorobanServer.getEvents({
    startLedger,
    endLedger: latestLedger,
    filters: [
      {
        type: "contract",
        contractIds: [VAULT_CONTRACT_ID],
      },
    ],
    limit,
  });

  const saveEvents: SaveEventPayload[] = [];

  for (const evt of response.events) {
    const firstTopic = evt.topic?.[0];
    if (!firstTopic) continue;

    const topicName = StellarSdk.scValToNative(firstTopic);

    if (topicName !== SAVE_EVT) continue;

    // Topic[0]: Symbol "save_evt"
    // Topic[1]: Address (dueño del ahorro)
    // Data: i128 (monto)
    const ownerScVal = evt.topic[1];
    const amountScVal = evt.value;

    let owner = "unknown";
    if (ownerScVal) {
      try {
        owner = StellarSdk.Address.fromScVal(ownerScVal).toString();
      } catch {
        owner = "unknown";
      }
    }
    const amount =
      amountScVal != null
        ? String(StellarSdk.scValToNative(amountScVal))
        : "0";

    const payload: SaveEventPayload = {
      owner,
      amount,
      ledger: evt.ledger,
      txHash: evt.txHash,
      ledgerClosedAt: evt.ledgerClosedAt,
    };

    saveEvents.push(payload);
    onSave(payload);
  }

  return saveEvents;
}

/**
 * Notificación por consola cuando un empleado recibe ahorro.
 * Úsala como callback: listenVaultSaveEvents(notifySaveToConsole)
 */
export function notifySaveToConsole(payload: SaveEventPayload): void {
  console.log(
    `[Alebrije] Empleado ${payload.owner} recibió ahorro: ${payload.amount} USDC (ledger ${payload.ledger})`
  );
}

/**
 * Obtiene los últimos save_evt sin callback. Útil para consultas puntuales.
 */
export async function getLatestSaveEvents(
  options?: Parameters<typeof listenVaultSaveEvents>[1]
): Promise<SaveEventPayload[]> {
  const events: SaveEventPayload[] = [];
  await listenVaultSaveEvents((p) => events.push(p), options);
  return events;
}

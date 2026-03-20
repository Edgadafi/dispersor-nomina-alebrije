import { scValToNative } from "@stellar/stellar-sdk";

export interface ParsedSaveEvent {
  owner: string;
  amount: string;
  txHash: string;
}

export function parseSaveEvent(event: {
  topic?: unknown[];
  value?: unknown;
  txHash: string;
}): ParsedSaveEvent {
  // Extraer el dueño desde los topics (Topic 1)
  const owner = scValToNative(event.topic![1] as Parameters<typeof scValToNative>[0]);
  // Extraer el monto desde el data
  const amount = scValToNative(event.value as Parameters<typeof scValToNative>[0]);

  return {
    owner: String(owner),
    amount: (Number(amount) / 10_000_000).toFixed(2), // Ajuste de decimales USDC
    txHash: event.txHash,
  };
}

/** Mensaje en lenguaje humano para notificaciones */
export function toHumanMessage(parsed: ParsedSaveEvent): string {
  return `Empleado ${parsed.owner} recibió ${parsed.amount} USDC de ahorro. Tx: ${parsed.txHash}`;
}

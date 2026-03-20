import * as StellarSdk from "@stellar/stellar-sdk";

const VAULT_CONTRACT_ID =
  process.env.VAULT_CONTRACT_ID ??
  "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE"; // Placeholder: reemplazar con ID del contrato desplegado

/**
 * Genera la operación Soroban para depositar en la Bóveda.
 * Requiere que el contrato vault esté desplegado y el contract ID configurado.
 *
 * Nota: Las transacciones Soroban típicamente requieren una sola operación.
 * Si mezclas con classic ops, puede ser necesario simular/ensamblar antes de enviar.
 */
export async function callVaultDeposit(
  owner: string,
  amount: number
): Promise<ReturnType<typeof StellarSdk.Operation.invokeContractFunction>> {
  const contract = new StellarSdk.Contract(VAULT_CONTRACT_ID);
  const ownerAddress = StellarSdk.Address.fromString(owner);
  const amountScVal = StellarSdk.nativeToScVal(amount, { type: "i128" });

  return contract.call("deposit", ownerAddress.toScVal(), amountScVal);
}

import * as StellarSdk from "@stellar/stellar-sdk";

const VAULT_CONTRACT_ID =
  process.env.VAULT_CONTRACT_ID ??
  "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE"; // Placeholder: reemplazar con ID del contrato desplegado

/** USDC usa 7 decimales: 1 USDC = 10^7 Stroops */
const USDC_DECIMALS = 10_000_000;

/**
 * Genera la operación Soroban para depositar en la Bóveda.
 * Requiere que el contrato vault esté desplegado y el contract ID configurado.
 *
 * @param amount Monto en unidades humanas (ej. 10 = 10 USDC)
 */
export async function callVaultDeposit(
  owner: string,
  amount: number
): Promise<ReturnType<typeof StellarSdk.Operation.invokeContractFunction>> {
  const contract = new StellarSdk.Contract(VAULT_CONTRACT_ID);
  const ownerAddress = StellarSdk.Address.fromString(owner);
  const amountStroops = BigInt(Math.floor(amount * USDC_DECIMALS));
  const amountScVal = StellarSdk.nativeToScVal(amountStroops, { type: "i128" });

  return contract.call("deposit", ownerAddress.toScVal(), amountScVal);
}

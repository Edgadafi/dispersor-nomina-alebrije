import * as StellarSdk from "@stellar/stellar-sdk";
import { server, sorobanServer, networkPassphrase } from "./stellar.js";
import { callVaultDeposit } from "./vault_interaction.js";

// USDC: Bitso Testnet. Dev 1 debe proporcionar USDC_BITSO_ISSUER cuando esté listo.
// Fallback: Circle USDC testnet (GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5)
const USDC_BITSO_ISSUER =
  process.env.USDC_BITSO_ISSUER ??
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_BITSO = new StellarSdk.Asset("USDC", USDC_BITSO_ISSUER);

/**
 * Crea una transacción atómica que:
 * 1. Envía el sueldo neto al empleado (USDC vía Bitso/Stellar).
 * 2. Deposita el ahorro en la Bóveda de Soroban.
 * 3. Requiere Multisig 3-de-4.
 *
 * Simula la tx vía Soroban RPC antes de retornar, calculando CPU/RAM
 * para que la parte de la bóveda no haga fallar el pago de nómina.
 */
export async function buildAtomicPayroll(
  employerPublic: string,
  employeePublic: string,
  netAmount: string,
  savingsAmount: number
): Promise<string> {
  try {
    const account = await server.loadAccount(employerPublic);

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    });

    // OPERACIÓN 1: Pago de Nómina (USDC a Bitso/Empleado — no XLM volátil)
    txBuilder.addOperation(
      StellarSdk.Operation.payment({
        destination: employeePublic,
        asset: USDC_BITSO,
        amount: netAmount,
      })
    );

    // OPERACIÓN 2: Depósito en Bóveda (Soroban)
    const vaultOp = await callVaultDeposit(employeePublic, savingsAmount);
    txBuilder.addOperation(vaultOp);

    // CONFIGURACIÓN DE SEGURIDAD: Seteamos el tiempo de expiración
    const rawTransaction = txBuilder.setTimeout(180).build();

    // SIMULACIÓN Soroban RPC: calcula recursos (CPU/RAM) para la bóveda
    const preparedTransaction =
      await sorobanServer.prepareTransaction(rawTransaction);

    // RETORNO: XDR listo para firmar (Accesly SDK)
    return preparedTransaction.toXDR();
  } catch (error) {
    console.error("Error construyendo transacción atómica:", error);
    throw error;
  }
}

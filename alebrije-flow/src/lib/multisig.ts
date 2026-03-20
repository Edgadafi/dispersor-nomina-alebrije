import * as StellarSdk from "@stellar/stellar-sdk";

// Configuramos los pesos para el Multisig 3-de-4
export const MULTISIG_CONFIG = {
  masterWeight: 1,
  lowThreshold: 1,
  medThreshold: 3, // Requiere 3 firmas para pagar nómina
  highThreshold: 3,
};

/**
 * Esta función prepara la transacción para que sea firmada
 * por los participantes definidos en el SDK de Accesly.
 */
export async function collectSignatures(
  transaction: StellarSdk.Transaction
): Promise<StellarSdk.Transaction> {
  console.log("Esperando firmas biométricas vía Accesly SDK...");
  // Aquí llamaremos a los métodos del SDK de Accesly en /vendor
  return transaction;
}

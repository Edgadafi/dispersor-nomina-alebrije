/**
 * Publicación del commitment en Stellar (LFPDP).
 * Tx con memo_hash; pago mínimo a sí mismo para anclar el hash on-chain.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "alebrije-flow/.env") });
import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";

/**
 * Publica el commitment como transacción Stellar (memo_hash + pago mínimo a sí mismo).
 * Retorna el hash de la transacción.
 */
export async function postCommitmentTx(commitmentHash: Buffer): Promise<string> {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret) {
    throw new Error("Falta ADMIN_SECRET_KEY en .env");
  }
  if (commitmentHash.length !== 32) {
    throw new Error("commitmentHash debe ser 32 bytes");
  }

  const server = new StellarSdk.Horizon.Server(HORIZON);
  const sender = StellarSdk.Keypair.fromSecret(secret);
  const account = await server.loadAccount(sender.publicKey());

  const memo = StellarSdk.Memo.hash(commitmentHash);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addMemo(memo)
    .addOperation(
      StellarSdk.Operation.payment({
        destination: sender.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: "0.0000001",
      })
    )
    .setTimeout(180)
    .build();

  tx.sign(sender);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

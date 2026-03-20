import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON_URL =
  process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK = process.env.STELLAR_NETWORK ?? "testnet";

export const networkPassphrase =
  NETWORK === "mainnet"
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;

export const server = new StellarSdk.Horizon.Server(HORIZON_URL);

/** Soroban RPC: simula transacciones para calcular CPU/RAM antes de enviar */
export const sorobanServer = new StellarSdk.rpc.Server(SOROBAN_RPC_URL, {
  allowHttp: NETWORK === "testnet",
});

export const adminKeypair = process.env.ADMIN_SECRET_KEY
  ? StellarSdk.Keypair.fromSecret(process.env.ADMIN_SECRET_KEY)
  : null;

/**
 * Lógica de dispersión directa vía Stellar.
 * Reutilizable desde CLI (demo-direct-payment.ts) y API HTTP.
 * Tras la dispersión exitosa, envía recibo de nómina por SMS a cada empleado con teléfono.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "alebrije-flow/.env") });
import * as StellarSdk from "@stellar/stellar-sdk";
import { sendReceipt } from "./receipt-sender.js";

const ASSET_CODE = process.env.ASSET_CODE ?? "USDC";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const CETES_ISSUER =
  "GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4";
const HORIZON = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export interface CsvRow {
  amount: string;
  stellar_address?: string;
  phone?: string;
  employee_id?: string;
  date_of_birth?: string;
}

export function parseCsvFromString(csvContent: string): CsvRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV necesita encabezado y al menos una fila");
  const header = lines[0].toLowerCase().split(",").map((c) => c.trim());
  const addrIdx = header.findIndex(
    (c) => c === "stellar_address" || c === "stellar address"
  );
  const amountIdx = header.indexOf("amount");
  if (amountIdx < 0) throw new Error("CSV necesita columna 'amount'");
  const phoneIdx = header.findIndex((c) => c === "phone");
  const empIdx = header.findIndex(
    (c) => c === "employee_id" || c === "employee id"
  );
  const dobIdx = header.findIndex(
    (c) => c === "date_of_birth" || c === "date of birth"
  );

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    const amount = vals[amountIdx] ?? "0";
    const stellar_address = addrIdx >= 0 ? vals[addrIdx] : undefined;
    const phone = phoneIdx >= 0 ? vals[phoneIdx] : undefined;
    const employee_id = empIdx >= 0 ? vals[empIdx] : undefined;
    const date_of_birth = dobIdx >= 0 ? vals[dobIdx] : undefined;
    rows.push({ amount, stellar_address, phone, employee_id, date_of_birth });
  }
  return rows;
}

export interface DispersarResult {
  hash: string;
  total: number;
  asset: string;
  recipient: string;
  count: number;
}

export async function dispersarDesdeCsv(
  csvContent: string
): Promise<DispersarResult> {
  const secret = process.env.ADMIN_SECRET_KEY;
  const fallbackAddr = process.env.EMPLOYEE_PUBLIC_KEY;

  if (!secret) {
    throw new Error("Falta ADMIN_SECRET_KEY en .env");
  }

  const server = new StellarSdk.Horizon.Server(HORIZON);
  const sender = StellarSdk.Keypair.fromSecret(secret);
  const issuer =
    ASSET_CODE.toUpperCase() === "USDC" ? USDC_ISSUER : CETES_ISSUER;
  const asset = new StellarSdk.Asset(ASSET_CODE, issuer);

  const rows = parseCsvFromString(csvContent);
  if (rows.length === 0) throw new Error("CSV vacío");

  let payDest = fallbackAddr;
  const hasExplicitAddr = rows.some((r) => r.stellar_address);
  if (hasExplicitAddr && rows.every((r) => r.stellar_address === rows[0].stellar_address)) {
    payDest = rows[0].stellar_address!;
  }

  let destToUse: string;
  if (!payDest) {
    const demoReceiver = StellarSdk.Keypair.random();
    const sourceAccount = await server.loadAccount(sender.publicKey());
    const tx1 = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: demoReceiver.publicKey(),
          startingBalance: "2",
        })
      )
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset,
          source: demoReceiver.publicKey(),
        })
      )
      .setTimeout(180)
      .build();
    tx1.sign(sender, demoReceiver);
    await server.submitTransaction(tx1);
    destToUse = demoReceiver.publicKey();
  } else {
    let hasTrust = false;
    try {
      const destAccount = await server.loadAccount(payDest);
      hasTrust = destAccount.balances.some(
        (b: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
          b.asset_type !== "native" &&
          b.asset_code === ASSET_CODE &&
          b.asset_issuer === issuer
      );
    } catch {
      /* cuenta no existe */
    }
    if (hasTrust) {
      destToUse = payDest;
    } else {
      const demoReceiver = StellarSdk.Keypair.random();
      const sourceAccount = await server.loadAccount(sender.publicKey());
      const tx1 = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.createAccount({
            destination: demoReceiver.publicKey(),
            startingBalance: "2",
          })
        )
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset,
            source: demoReceiver.publicKey(),
          })
        )
        .setTimeout(180)
        .build();
      tx1.sign(sender, demoReceiver);
      await server.submitTransaction(tx1);
      destToUse = demoReceiver.publicKey();
    }
  }

  const account = await server.loadAccount(sender.publicKey());
  let builder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  });

  for (const row of rows) {
    builder = builder.addOperation(
      StellarSdk.Operation.payment({
        destination: destToUse,
        asset,
        amount: row.amount,
      })
    );
  }

  const tx = builder.setTimeout(180).build();
  tx.sign(sender);
  const result = await server.submitTransaction(tx);

  const fecha = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    if (row.phone && row.amount) {
      await sendReceipt(row.phone, {
        employee_id: row.employee_id ?? "N/A",
        amount: row.amount,
        asset: ASSET_CODE,
        txHash: result.hash,
        date: fecha,
      });
    }
  }

  const total = rows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);

  return {
    hash: result.hash,
    total,
    asset: ASSET_CODE,
    recipient: destToUse,
    count: rows.length,
  };
}

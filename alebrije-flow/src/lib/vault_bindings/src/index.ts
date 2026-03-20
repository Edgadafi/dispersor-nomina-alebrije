import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDACVPAQUZGZ3S432DXDHRWC2XO2L7K3UYQAREG6NKHR2G2M7M5EWBBE",
  }
} as const


/**
 * Clave de almacenamiento para el balance de un dueño
 */
export interface BalanceKey {
  owner: string;
}

export interface Client {
  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Consulta el balance de ahorro de un dueño.
   */
  balance: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposita monto en la bóveda para el dueño indicado.
   * El invocador debe tener saldo suficiente (en modo token se transferiría).
   * MVP: solo registra el balance y emite save_evt.
   * Topic[0]: Symbol "save_evt", Topic[1]: Address (dueño), Data: i128 (monto)
   */
  deposit: ({owner, amount}: {owner: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAACtDb25zdWx0YSBlbCBiYWxhbmNlIGRlIGFob3JybyBkZSB1biBkdWXDsW8uAAAAAAdiYWxhbmNlAAAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAPxEZXBvc2l0YSBtb250byBlbiBsYSBiw7N2ZWRhIHBhcmEgZWwgZHVlw7FvIGluZGljYWRvLgpFbCBpbnZvY2Fkb3IgZGViZSB0ZW5lciBzYWxkbyBzdWZpY2llbnRlIChlbiBtb2RvIHRva2VuIHNlIHRyYW5zZmVyaXLDrWEpLgpNVlA6IHNvbG8gcmVnaXN0cmEgZWwgYmFsYW5jZSB5IGVtaXRlIHNhdmVfZXZ0LgpUb3BpY1swXTogU3ltYm9sICJzYXZlX2V2dCIsIFRvcGljWzFdOiBBZGRyZXNzIChkdWXDsW8pLCBEYXRhOiBpMTI4IChtb250bykAAAAHZGVwb3NpdAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAQAAADRDbGF2ZSBkZSBhbG1hY2VuYW1pZW50byBwYXJhIGVsIGJhbGFuY2UgZGUgdW4gZHVlw7FvAAAAAAAAAApCYWxhbmNlS2V5AAAAAAABAAAAAAAAAAVvd25lcgAAAAAAABM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    balance: this.txFromJSON<i128>,
        deposit: this.txFromJSON<null>
  }
}
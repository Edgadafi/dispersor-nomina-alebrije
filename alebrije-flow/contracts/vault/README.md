# Vault Contract

Bóveda de ahorro DeFi para nómina Alebrije. Almacena balances por empleado y emite el evento `save_evt` cuando se deposita.

## Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

Output: `target/wasm32-unknown-unknown/release/vault.wasm`

## Despliegue (Soroban CLI)

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/vault.wasm \
  --network testnet \
  --source <TU_CUENTA>
```

Copia el Contract ID y configúralo en `VAULT_CONTRACT_ID` en tu `.env`.

## Interface

### `deposit(owner: Address, amount: i128)`

Registra un depósito para el dueño. Emite el evento `save_evt`:
- **Topic[0]**: Symbol `"save_evt"`
- **Topic[1]**: Address (dueño del ahorro)
- **Data**: i128 (monto)

### `balance(owner: Address) -> i128`

Consulta el balance de ahorro de un dueño.

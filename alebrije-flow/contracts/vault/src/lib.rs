#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

/// Clave de almacenamiento para el balance de un dueño
#[contracttype]
#[derive(Clone, Eq, PartialEq)]
pub struct BalanceKey {
    pub owner: Address,
}

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    /// Deposita monto en la bóveda para el dueño indicado.
    /// El invocador debe tener saldo suficiente (en modo token se transferiría).
    /// MVP: solo registra el balance y emite save_evt.
    /// Topic[0]: Symbol "save_evt", Topic[1]: Address (dueño), Data: i128 (monto)
    pub fn deposit(env: Env, owner: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let key = BalanceKey { owner: owner.clone() };
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = current.checked_add(amount).expect("overflow");
        env.storage().persistent().set(&key, &new_balance);
        env.storage()
            .persistent()
            .extend_ttl(&key, 1000, 1000);

        // Emit save_evt: Topic[0]=save_evt, Topic[1]=owner, Data=amount
        let save_evt = symbol_short!("save_evt");
        env.events().publish((save_evt, owner), amount);
    }

    /// Consulta el balance de ahorro de un dueño.
    pub fn balance(env: Env, owner: Address) -> i128 {
        let key = BalanceKey { owner };
        env.storage().persistent().get(&key).unwrap_or(0)
    }
}

# Dispersor de Nómina Alebrije: Nómina & Ahorro DeFi

Dispersor de nómina resiliente para MiPymes y corporativos en LATAM, impulsado por Stellar, Soroban y Google AI Studio.

## ✨ Características MVP

- **Blockchain Invisible:** Acceso con Passkeys (Accesly SDK) y nombres humanos (.alebrije).
- **Multisig 3-de-4:** Seguridad institucional contra fallos bancarios (Caso BBVA).
- **Caja de Ahorro DeFi:** Bóveda en Soroban para resguardo en USDC.
- **IA Concierge:** Guía Alebrije (Gemini 1.5) gestiona la operación por voz/texto.

## 🛠 Tech Stack

- **Network:** Stellar Testnet.
- **Smart Contracts:** Soroban (Rust).
- **On/Off Ramp:** Alianza estratégica con Bitso (SEP-24).
- **Backend:** Node.js + TypeScript + Google AI Studio.

---

## Arquitectura v2 (SDP)

Desde la migración, la capa de dispersión usa el **Stellar Disbursement Platform (SDP)** oficial en lugar del contrato Soroban trustless.

### Componentes

| Componente | Rol |
|------------|-----|
| **SDP Backend** | Motor de dispersión vía Docker (`stellar/stellar-disbursement-platform-backend`) |
| **SDP TSS** | Transaction Submission Service para envío de pagos Stellar |
| **PostgreSQL** | Base de datos del SDP |
| **alebrije-flow** | Thin API wrapper que llama al SDP REST API |

### Asset

- **MXNe** (Etherfuse) en lugar de USDC (Bitso)
- Issuer testnet: `GDMTVHLWJTHSUDMZVVMXXH6VJHA2ZV3HNG5LYNAZ6RTWB7GISM6PGTU`

### Flujo de dispersión

1. **CSV** con columnas: `phone`, `employee_id`, `amount`, `date_of_birth`
2. `SdpClient.createDisbursement()` + `uploadDisbursementInstructions()`
3. Aprobación (SDP approval flow o auto en dev)
4. `SdpClient.startDisbursement()`
5. Polling con `getDisbursementStatus()` / `listPayments()`

### Empleados

- Registro vía **SEP-24 nativo del SDP** (SMS OTP con Twilio)
- No depende de Bitso para el flujo de wallet

### Quick start

```bash
# 1. Configurar .env (copiar desde .env.example)
cp .env.example .env

# 2. Levantar SDP
npm run sdp:up

# 3. Setup inicial (migraciones + tenant)
npm run setup

# 4. Ver logs
npm run sdp:logs
```

### Lo que se conserva

- Passkeys con Accesly SDK
- IA Concierge con Gemini 1.5
- Nombres .alebrije
- Multisig 3-de-4 → movido al approval flow del SDP

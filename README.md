# Dispersor de Nómina Alebrije: Nómina & Ahorro DeFi

Dispersor de nómina resiliente para MiPymes y corporativos en LATAM, impulsado por Stellar, Soroban y Google AI Studio.

## ✨ Características MVP

- **Blockchain Invisible:** Acceso con Passkeys (Accesly SDK) y nombres humanos (.alebrije).
- **Multisig 3-de-4:** Seguridad institucional contra fallos bancarios (Caso BBVA).
- **Caja de Ahorro DeFi:** Bóveda en Soroban para resguardo en CETES.
- **Privacidad LFPDP:** Commitment on-chain, datos cifrados off-chain; auditoría sin exponer salarios.
- **IA Concierge:** Guía Alebrije (Gemini 1.5) gestiona la operación por voz/texto.

## 🛠 Tech Stack

- **Network:** Stellar Testnet.
- **Smart Contracts:** Soroban (Rust).
- **On/Off Ramp:** Etherfuse (SEP-24, SPEI México).
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

- **CETES** (Etherfuse): asset principal del MVP en testnet.
- Issuer testnet: `GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4`

### Flujo de dispersión

1. **CSV** con columnas: `phone`, `employee_id`, `amount`, `date_of_birth`
2. `SdpClient.createDisbursement()` + `uploadDisbursementInstructions()`
3. Aprobación (SDP approval flow o auto en dev)
4. `SdpClient.startDisbursement()`
5. Polling con `getDisbursementStatus()` / `listPayments()`

### API LFPDP (commitment on-chain, privacidad LFPDP)

Flujo alternativo para nomillar.vercel.app: commitment en Stellar, datos cifrados off-chain, dispersión mock (SPEI en producción).

```bash
npm run api
```

Ver [docs/CONEXION_NOMILLAR.md](docs/CONEXION_NOMILLAR.md) para integración con el frontend.

### Empleados

- Registro vía **SEP-24 nativo del SDP** (SMS OTP con Twilio)
- Flujo de wallet independiente; on/off ramp vía Etherfuse

### Quick start

**Opción A — SDP (dispersión completa):**
```bash
# 1. Configurar .env (copiar desde .env.example)
cp .env.example .env

# 2. Levantar SDP
npm run sdp:up

# 3. Setup inicial (migraciones + tenant)
npm run setup

# 4. Ver logs
npm run sdp:logs

# 5. Registrar CETES. Requiere SDP_ADMIN_EMAIL/PASSWORD tras activar la cuenta
#    del owner en el tenant.
npm run register-asset
```

**Opción B — API LFPDP (commitment + nomillar):**
```bash
# 1. Configurar alebrije-flow/.env (ADMIN_SECRET_KEY, PAYROLL_STORE_KEY)
# 2. Levantar API
npm run api

# 3. Probar dispersión
npm run demo:direct
```

### Lo que se conserva

- Passkeys con Accesly SDK
- IA Concierge con Gemini 1.5
- Nombres .alebrije
- Multisig 3-de-4 → movido al approval flow del SDP

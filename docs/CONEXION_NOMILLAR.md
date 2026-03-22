# Conectar dispersor con nomillar.vercel.app

## Flujo LFPDP (privacidad)

- **On-chain:** Solo un hash (commitment) del batch en Stellar. No se exponen salarios ni identidades.
- **Off-chain:** Datos completos cifrados en `data/payroll-store/`.
- **Dispersión:** Mock (SPEI en producción). Los empleados reciben recibo por SMS.

## 1. Levantar la API

```bash
npm run api
```

La API queda en `http://localhost:3001` (o la URL de tu despliegue).

## 2. Endpoint de dispersión

**POST** `/api/dispersar`

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "csv": "phone,employee_id,amount,date_of_birth,stellar_address\n+525512345601,EMP001,1.00,1990-01-15,GCF4XVNREGZD3BJE2MURDVKISSATDWP2CX6FFCWZIQFC6NKJMP26TWXH"
}
```

**Formato CSV mínimo:** debe tener columna `amount`. Opcional: `stellar_address`, `phone`, `employee_id`, `date_of_birth`. Si el CSV incluye `phone`, tras la dispersión cada empleado recibe su recibo por SMS (vía Twilio) o en modo DRY_RUN.

**Respuesta exitosa (200):**
```json
{
  "ok": true,
  "batchId": "uuid",
  "commitmentHash": "hex",
  "hash": "stellar-tx-hash",
  "txHash": "stellar-tx-hash",
  "total": 5,
  "asset": "USDC",
  "count": 5
}
```

**Health check:** `GET /health` → `{"ok":true,"service":"alebrije-dispersor"}`

## 3. Auditoría

### Verificación pública (sin datos sensibles)

**GET** `/api/batch/:batchId/verify`

Retorna `{ batchId, commitmentHash, txHash, verified }`. El auditor puede contrastar el commitment on-chain con los datos off-chain.

### Acceso a datos completos (autorizado)

**GET** `/api/batch/:batchId`

Requiere `Authorization: Bearer <AUDITOR_TOKEN>` o header `X-Auditor-Key: <AUDITOR_TOKEN>`.

Retorna el batch desencriptado (rows, total, asset, etc.) solo para auditores autorizados.

## 4. Código para el frontend (nomillar)

```javascript
// Ejemplo: React/Next.js
async function dispersarNomina(csvText) {
  const res = await fetch("https://TU-API-URL/api/dispersar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv: csvText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error en dispersión");
  return data;
}
```

## 5. Desplegar la API

- **Railway, Render, Fly.io:** build `npm install`, start `npm run api`
- **Variables de entorno obligatorias:**
  - `ADMIN_SECRET_KEY` (Stellar)
  - `PAYROLL_STORE_KEY` (min 32 caracteres para cifrado)
- **Opcionales:** `ASSET_CODE`, `AUDITOR_TOKEN`, `RECEIPT_DRY_RUN`

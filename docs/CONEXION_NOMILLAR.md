# Conectar dispersor con nomillar.vercel.app

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

**Formato CSV mínimo:** debe tener columna `amount`. Opcional: `stellar_address`, `phone`, `employee_id`, `date_of_birth`. Si el CSV incluye `phone`, tras la dispersión cada empleado recibe su recibo por SMS (vía Twilio) o en modo DRY_RUN si no hay credenciales Twilio.

**Respuesta exitosa (200):**
```json
{
  "ok": true,
  "hash": "cc972cc4d7820ba16e911a644aea71c5b0ab1fcccea9865361b12e7beffaefd9",
  "total": 5,
  "asset": "USDC",
  "recipient": "GDW3TZTWH4WBQSNCFNOJEIOSLRXLN3X3ALXVGFHCUOOMOVX7HCT7QNFI",
  "count": 5
}
```

**Health check:** `GET /health` → `{"ok":true,"service":"alebrije-dispersor"}`

## 3. Código para el frontend (nomillar)

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

## 4. Desplegar la API

Para que nomillar.vercel.app la consuma, despliega la API en:

- **Railway**: `railway up` o conecta el repo
- **Render**: crea Web Service, build `npm install`, start `npm run api`
- **Fly.io**: `fly launch` + `fly deploy`

Configura las variables de entorno en el proveedor:
- `ADMIN_SECRET_KEY` (obligatorio)
- `ASSET_CODE` (opcional, default USDC)
- `EMPLOYEE_PUBLIC_KEY` (opcional, para destino por defecto)

Luego actualiza en el frontend la URL base de la API.

#!/usr/bin/env bash
# Setup del Stellar Disbursement Platform para Alebrije Nómina
# Uso: ./scripts/setup-sdp.sh (o npm run setup)
# Requiere: docker compose, .env con variables configuradas

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Cargar .env si existe
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

ADMIN_PORT="${ADMIN_PORT:-8003}"
ADMIN_ACCOUNT="${ADMIN_ACCOUNT:-SDP-admin}"
ADMIN_API_KEY="${ADMIN_API_KEY:-api_key_1234567890}"
TENANT_NAME="${TENANT_NAME:-alebrije-nominas}"

echo "=== Alebrije SDP Setup ==="
echo ""

# 0. Generar clave EC256 para dev si no existe (requerida por docker-compose)
mkdir -p config
if [ ! -f config/ec256-dev.pem ]; then
  echo "Generando config/ec256-dev.pem..."
  openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out config/ec256-dev.pem
fi

# 1. Levantar solo postgres y esperar healthy
echo "[1/4] Iniciando PostgreSQL..."
docker compose up -d postgres

echo "Esperando a que Postgres esté healthy..."
for i in {1..30}; do
  if docker compose exec postgres pg_isready -U postgres 2>/dev/null; then
    echo "Postgres listo."
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: Postgres no respondió a tiempo."
    exit 1
  fi
  sleep 2
done

# 2. Migraciones (--entrypoint evita conflicto con el entrypoint sh -c del servicio)
echo ""
echo "[2/4] Ejecutando migraciones de base de datos..."

docker compose run --rm --no-deps --entrypoint sh sdp-backend -c '
  [ -z "$EC256_PRIVATE_KEY" ] && export EC256_PRIVATE_KEY="$(cat /config/ec256-dev.pem 2>/dev/null)"
  ./stellar-disbursement-platform db admin migrate up
  ./stellar-disbursement-platform db tss migrate up
  ./stellar-disbursement-platform db auth migrate up --all
  ./stellar-disbursement-platform db sdp migrate up --all
  ./stellar-disbursement-platform db setup-for-network --all
'

echo "Migraciones completadas."

# 2b. Levantar backend y TSS
echo "Iniciando SDP backend y TSS..."
docker compose up -d sdp-backend sdp-tss
echo "Esperando 45s a que los servicios inicien..."
sleep 45

# 3. Crear tenant (Admin API usa Basic Auth en puerto 8003)
echo ""
echo "[3/4] Creando tenant '$TENANT_NAME'..."

# Esperar a que el admin API esté disponible
for i in {1..20}; do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${ADMIN_PORT}/tenants" \
    -u "${ADMIN_ACCOUNT}:${ADMIN_API_KEY}" 2>/dev/null | grep -qE "200|201|401"; then
    break
  fi
  if [ $i -eq 20 ]; then
    echo "ADVERTENCIA: Admin API no disponible. Crea el tenant manualmente:"
    echo "  curl -X POST http://localhost:${ADMIN_PORT}/tenants \\"
    echo "    -u ${ADMIN_ACCOUNT}:${ADMIN_API_KEY} \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"name\":\"$TENANT_NAME\",\"organization_name\":\"Alebrije Nóminas\",\"owner_email\":\"admin@alebrije.local\",\"owner_first_name\":\"Admin\",\"owner_last_name\":\"Alebrije\",\"distribution_account_type\":\"DISTRIBUTION_ACCOUNT.STELLAR.ENV\"}'"
    exit 0
  fi
  sleep 3
done

# Verificar si el tenant ya existe
EXISTING=$(curl -s -u "${ADMIN_ACCOUNT}:${ADMIN_API_KEY}" "http://localhost:${ADMIN_PORT}/tenants" 2>/dev/null || echo "[]")
if echo "$EXISTING" | grep -q "\"name\":\"$TENANT_NAME\""; then
  echo "Tenant '$TENANT_NAME' ya existe."
else
  curl -s -X POST "http://localhost:${ADMIN_PORT}/tenants" \
    -u "${ADMIN_ACCOUNT}:${ADMIN_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$TENANT_NAME\",
      \"organization_name\": \"Alebrije Nóminas\",
      \"owner_email\": \"admin@alebrije.local\",
      \"owner_first_name\": \"Admin\",
      \"owner_last_name\": \"Alebrije\",
      \"distribution_account_type\": \"DISTRIBUTION_ACCOUNT.STELLAR.ENV\"
    }" && echo "Tenant creado correctamente." || echo "Error creando tenant. Verifica credenciales en .env"
fi

# 4. Instrucciones para JWT
echo ""
echo "[4/4] === Instrucciones para obtener JWT (Dashboard API) ==="
echo ""
echo "1. Accede al SDP Dashboard (si lo tienes desplegado):"
echo "   SDP_UI_BASE_URL: ${SDP_UI_BASE_URL:-http://localhost:3000}"
echo ""
echo "2. Para usar la API directamente, haz login:"
echo "   POST ${BASE_URL:-http://localhost:8000}/login"
echo "   Body: {\"email\": \"<owner_email>\", \"password\": \"<password_set_during_activation>\"}"
echo ""
echo "3. El token JWT se usa como: Authorization: Bearer <token>"
echo ""
echo "4. Para hackathon con ngrok, configura BASE_URL en .env:"
echo "   BASE_URL=https://xxxx.ngrok.io"
echo ""
echo "=== Setup completado ==="

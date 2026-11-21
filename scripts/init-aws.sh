#!/usr/bin/env bash
set -euo pipefail

export AWS_PAGER=""

BUCKET="telemetry-raw-logs"
QUEUE="high-cpu-alerts"
TABLE="AgentStatus"
REGION="us-east-1"

echo "==================================="
echo " AWS EMULATOR - INICIALIZACION"
echo "==================================="

# Verificar configuración local
if [[ "${AWS_ENDPOINT_URL:-}" != "https://127.0.0.1:9297" ]]; then
    echo "ERROR: endpoint local no configurado."
    echo "Ejecuta: source scripts/use-emulator.sh"
    exit 1
fi

ACCOUNT=$(aws sts get-caller-identity \
    --query Account --output text)

if [[ "$ACCOUNT" != "000000000000" ]]; then
    echo "ERROR: cuenta AWS inesperada: $ACCOUNT"
    exit 1
fi

echo "[OK] Cuenta emulada: $ACCOUNT"

# 1. S3
echo ""
echo "=== AMAZON S3 ==="

if aws s3api head-bucket \
    --bucket "$BUCKET" >/dev/null 2>&1; then

    echo "[OK] Bucket existente: $BUCKET"

else
    echo "Creando bucket $BUCKET..."

    aws s3api create-bucket \
        --bucket "$BUCKET" \
        --region "$REGION"

    echo "[OK] Bucket creado"
fi

# 2. SQS
echo ""
echo "=== AMAZON SQS ==="

# CreateQueue devuelve la cola existente si sus
# atributos coinciden, sin crear una duplicada.
aws sqs create-queue \
    --queue-name "$QUEUE" \
    --query QueueUrl \
    --output text

echo "[OK] Cola disponible: $QUEUE"

# 3. DynamoDB
echo ""
echo "=== AMAZON DYNAMODB ==="

if aws dynamodb describe-table \
    --table-name "$TABLE" \
    > /dev/null 2>&1; then

    echo "[OK] Tabla existente: $TABLE"

else
    echo "Creando tabla $TABLE..."

    aws dynamodb create-table \
        --table-name "$TABLE" \
        --attribute-definitions \
            AttributeName=agentId,AttributeType=S \
        --key-schema \
            AttributeName=agentId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$REGION"
fi

echo "Verificando tabla..."

aws dynamodb wait table-exists \
    --table-name "$TABLE"

STATUS=$(aws dynamodb describe-table \
    --table-name "$TABLE" \
    --query 'Table.TableStatus' \
    --output text)

KEY=$(aws dynamodb describe-table \
    --table-name "$TABLE" \
    --query 'Table.KeySchema[0].AttributeName' \
    --output text)

if [[ "$STATUS" != "ACTIVE" || "$KEY" != "agentId" ]]; then
    echo "ERROR: la tabla no tiene la configuración esperada."
    echo "Estado: $STATUS"
    echo "Clave: $KEY"
    exit 1
fi

echo "[OK] Tabla activa y clave primaria correcta"

echo ""
echo "==================================="
echo " RECURSOS DISPONIBLES"
echo "==================================="
echo "S3:       $BUCKET"
echo "SQS:      $QUEUE"
echo "DynamoDB: $TABLE"
echo "Cuenta:   $ACCOUNT"
echo "==================================="

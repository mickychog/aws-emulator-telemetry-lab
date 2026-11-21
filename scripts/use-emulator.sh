#!/usr/bin/env bash

# Endpoint local del AWS Emulator
export AWS_ENDPOINT_URL="https://127.0.0.1:9297"

# Credenciales y configuración exclusivas del emulador
export AWS_SHARED_CREDENTIALS_FILE="$HOME/.aws/emulator/9297/emulator_credentials"
export AWS_CONFIG_FILE="$HOME/.aws/emulator/9297/config"

# Certificados locales
export AWS_CA_BUNDLE="$HOME/.aws/emulator/9297/ca.pem"
export NODE_EXTRA_CA_CERTS="$HOME/.aws/emulator/9297/ca.pem"

# Configuración adicional
export AWS_REGION="us-east-1"
export AWS_DEFAULT_REGION="us-east-1"
export AWS_EC2_METADATA_DISABLED="true"
export AWS_DISABLE_HOST_PREFIX_INJECTION="true"

# Eliminar credenciales AWS heredadas de la terminal
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN
unset AWS_PROFILE

export AWS_PAGER=""
echo "AWS Emulator configurado."
echo "Endpoint: $AWS_ENDPOINT_URL"

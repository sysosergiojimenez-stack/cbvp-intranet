#!/bin/bash
# ==============================================================================
# Script de clonado: crea la infraestructura de GCP para una nueva estacion
# (cuenta de servicio propia + variables de entorno + deploy a Cloud Run).
#
# Requisito previo: ya tenes que haber corrido los pasos MANUALES de
# CLONAR_NUEVA_ESTACION.md (rama nueva, config de organizacion.ts, logo,
# copias de las hojas de Sheets). Este script arranca desde ahi.
#
# Uso: bash scripts/clonar_estacion.sh
# ==============================================================================
set -e

echo "=== Clonar CBVP Intranet - infraestructura GCP para una nueva estacion ==="
echo ""
read -p "Nombre corto de la estacion (ej: abvp, minusculas, sin espacios): " NOMBRE
read -p "Nombre del servicio Cloud Run (ej: abvp-intranet-git): " SERVICIO
read -p "ID de la hoja USUARIOS de esta estacion: " SHEET_USUARIOS
read -p "ID de la hoja GUARDIAS de esta estacion: " SHEET_GUARDIAS
read -p "Servicio Cloud Run BASE del cual copiar variables compartidas (default: cbvp-intranet-git): " SERVICIO_BASE
SERVICIO_BASE=${SERVICIO_BASE:-cbvp-intranet-git}
read -p "Proyecto de Google Cloud (default: cbvp-intranet): " PROYECTO
PROYECTO=${PROYECTO:-cbvp-intranet}
read -p "Region de Cloud Run (default: europe-west1): " REGION
REGION=${REGION:-europe-west1}

SA_NAME="${NOMBRE}-intranet-sa"
SA_EMAIL="${SA_NAME}@${PROYECTO}.iam.gserviceaccount.com"

echo ""
echo "--- Paso 1: Creando cuenta de servicio $SA_EMAIL ---"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROYECTO" >/dev/null 2>&1; then
  echo "La cuenta de servicio ya existe, la reutilizamos."
else
  gcloud iam service-accounts create "$SA_NAME" --display-name="${NOMBRE} Intranet Service Account" --project="$PROYECTO"
fi

echo ""
echo "--- Paso 2: Generando clave JSON de la cuenta de servicio ---"
KEY_FILE="/tmp/${NOMBRE}-sa-key.json"
gcloud iam service-accounts keys create "$KEY_FILE" --iam-account="$SA_EMAIL" --project="$PROYECTO"

echo ""
echo "=================================================================="
echo "IMPORTANTE: antes de continuar, compartí estas 2 hojas de Sheets"
echo "como EDITOR con esta cuenta de servicio:"
echo ""
echo "   $SA_EMAIL"
echo ""
echo "Hoja USUARIOS: https://docs.google.com/spreadsheets/d/$SHEET_USUARIOS/edit"
echo "Hoja GUARDIAS: https://docs.google.com/spreadsheets/d/$SHEET_GUARDIAS/edit"
echo "=================================================================="
read -p "Presiona ENTER cuando hayas compartido AMBAS hojas..." _

echo ""
echo "--- Paso 3: Armando el archivo de variables de entorno ---"
gcloud run services describe "$SERVICIO_BASE" --region "$REGION" --project "$PROYECTO" --format=json > "/tmp/${NOMBRE}-base-service.json"

python3 << PYEOF
import json

with open("/tmp/${NOMBRE}-base-service.json") as f:
    data = json.load(f)
env_list = data['spec']['template']['spec']['containers'][0]['env']

# Variables que se reutilizan tal cual del servicio base (no son especificas de la estacion)
compartidas = {'GEMINI_API_KEY', 'GCS_BUCKET_NAME', 'DATABASE_URL', 'APP_ID', 'APP_SECRET', 'NODE_ENV', 'DRIVE_FOLDER_ID'}

with open("$KEY_FILE") as f:
    nueva_credencial = f.read()

lineas = []
for item in env_list:
    nombre = item['name']
    if nombre in compartidas:
        valor = item.get('value', '')
        lineas.append(f'{nombre}: {json.dumps(valor)}')

lineas.append(f'GOOGLE_SERVICE_ACCOUNT_JSON: {json.dumps(nueva_credencial)}')
lineas.append(f'SHEET_USUARIOS_ID: {json.dumps("$SHEET_USUARIOS")}')
lineas.append(f'SHEET_GUARDIAS_ID: {json.dumps("$SHEET_GUARDIAS")}')

with open("/tmp/${NOMBRE}-env.yaml", "w") as f:
    f.write("\n".join(lineas) + "\n")

print("Archivo de variables generado con", len(lineas), "variables (incluye cuenta de servicio propia).")
PYEOF

echo ""
echo "--- Paso 4: Deploy a Cloud Run ---"
gcloud run deploy "$SERVICIO" --source . --region "$REGION" --project "$PROYECTO" --env-vars-file="/tmp/${NOMBRE}-env.yaml" --allow-unauthenticated

echo ""
echo "=== LISTO! ==="
echo "Estacion '$NOMBRE' desplegada con su propia cuenta de servicio ($SA_EMAIL),"
echo "sin competir por cuota de Sheets con ninguna otra estacion."

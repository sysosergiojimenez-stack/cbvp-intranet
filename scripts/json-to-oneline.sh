#!/bin/bash
# Script para convertir JSON de service account a una sola linea
# Uso: bash scripts/json-to-oneline.sh ~/Downloads/tu-archivo.json

if [ -z "$1" ]; then
    echo "Uso: bash scripts/json-to-oneline.sh <ruta-al-archivo.json>"
    echo "Ejemplo: bash scripts/json-to-oneline.sh ~/Downloads/service-account.json"
    exit 1
fi

# Leer archivo, eliminar saltos de linea y espacios extra
JSON_ONELINE=$(cat "$1" | tr -d '\n' | tr -d '\r' | sed 's/  */ /g')

echo ""
echo "=========================================="
echo "JSON en una sola linea (copia esto):"
echo "=========================================="
echo "$JSON_ONELINE"
echo ""
echo "=========================================="
echo "Pega el texto de arriba en Cloud Run"
echo "=========================================="

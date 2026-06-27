#!/usr/bin/env node
/**
 * Este script convierte tu archivo JSON de Service Account
 * en un formato compatible con .env
 * 
 * USO:
 *   node scripts/prepare-json.js /ruta/a/tu/archivo.json
 * 
 * Ejemplo:
 *   node scripts/prepare-json.js ~/Downloads/mi-proyecto-123456.json
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];

if (!inputFile) {
  console.error('❌ Error: Debes pasar la ruta al archivo JSON');
  console.error('');
  console.error('Uso:');
  console.error('  node scripts/prepare-json.js /ruta/a/tu-archivo.json');
  console.error('');
  console.error('Ejemplo:');
  console.error('  node scripts/prepare-json.js ~/Downloads/cbvp-service-account.json');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: El archivo no existe: ${inputFile}`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(inputFile, 'utf8');
  const json = JSON.parse(content);

  // Validar campos requeridos
  const required = ['type', 'project_id', 'private_key', 'client_email'];
  for (const field of required) {
    if (!json[field]) {
      console.error(`❌ Error: El JSON no tiene el campo requerido: ${field}`);
      process.exit(1);
    }
  }

  if (json.type !== 'service_account') {
    console.error('❌ Error: El JSON no es de tipo service_account');
    process.exit(1);
  }

  // Convertir a string de una sola línea
  const singleLine = JSON.stringify(json);

  console.log('');
  console.log('✅ JSON validado correctamente');
  console.log('');
  console.log('📧 Service Account Email:', json.client_email);
  console.log('📁 Project ID:', json.project_id);
  console.log('');
  console.log('=== COPIA ESTO PARA TU .env ===');
  console.log('');
  console.log(`GOOGLE_SERVICE_ACCOUNT_JSON=${singleLine}`);
  console.log('');
  console.log('=== INSTRUCCIONES ===');
  console.log('1. Copia la linea de arriba (GOOGLE_SERVICE_ACCOUNT_JSON=...)');
  console.log('2. Pegala en tu archivo .env');
  console.log('3. Debe ir TODA en una sola linea');
  console.log('');
  console.log('⚠️  NO OLVIDES compartir tus Google Sheets con este email:');
  console.log(`   ${json.client_email}`);
  console.log('');

} catch (err) {
  console.error('❌ Error al leer el JSON:', err.message);
  process.exit(1);
}

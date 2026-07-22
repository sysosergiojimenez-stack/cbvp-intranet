# Como clonar esta app para otro cuerpo de bomberos

Esta guia asume que ya tenes acceso a Google Cloud, Google Sheets y una cuenta de GitHub.
Tiempo estimado: 1-2 horas la primera vez que lo hagas.

## 1. Copiar el codigo

```bash
git clone https://github.com/sysosergiojimenez-stack/cbvp-intranet.git nombre-nuevo-cuerpo
cd nombre-nuevo-cuerpo
git remote remove origin
```

Crea un repositorio nuevo y vacio en GitHub, y despues:

```bash
git remote add origin https://github.com/TU-USUARIO/nombre-nuevo-repo.git
git push -u origin main
```

## 2. Crear el Google Sheet nuevo

Crea una planilla de Google Sheets nueva, con estas pestañas y encabezados exactos (fila 1):

### USUARIOS
`ID | Codigo | AnioJuramento | Categoria | Cargo | Rango | CodigoRadial | PrimerNombre | SegundoNombre | PrimerApellido | SegundoApellido | NroDoc | FechaNacimiento | Correo | Contrasena`

### ROLES
`Cargo | Nivel | Descripcion | Accesos`

### Guardias_Encabezado
`idPlanilla | fechaCarga | fechaGuardia | grupo | inicioGuardia | finalizaGuardia | directorSem | comandanteSemana | oficialK20 | novedades | urlImagen`

### Guardias_Personal
`idFila | idPlanilla | fechaCarga | fechaGuardia | grupo | tipo | codigo | nombre | asignacion | asistencia | idCargador | nombreCargador`

### Asistencia_Encabezado
`idPlanilla | fechaCarga | fechaActividad | tipoActividad | inicioActividad | finalizaActividad | acargoActividad | detalles | urlImagen`

### Asistencia_Personal
`idFila | idPlanilla | fechaCarga | fechaActividad | (vacia) | (vacia) | codigo | nombre | asistencia | usuarioId | usuarioNombre`

### SALIDAS_MOVIL
`id | idPlanilla | fechaCarga | movil | conductor | oficialACargo | nroTripulantes | tipoServicio | fechaSalida | horaSalida | kilometrajeSalida | direccion | fechaLlegada | horaLlegada | kilometrajeLlegada | urlImagenes`

Anota el **ID de la planilla** (esta en la URL: `docs.google.com/spreadsheets/d/ESTE-ES-EL-ID/edit`).

## 3. Crear el bucket de Google Cloud Storage

```bash
gcloud storage buckets create gs://nombre-nuevo-cuerpo-planillas --location=us-central1
```

Anota el nombre del bucket.

## 4. Cuenta de servicio de Google

1. En Google Cloud Console, crea una cuenta de servicio nueva con permisos de **Editor** sobre Google Sheets y Storage Object Admin sobre el bucket.
2. Descarga la clave JSON de esa cuenta de servicio.
3. Comparti la planilla de Google Sheets (paso 2) con el email de la cuenta de servicio, dandole permiso de **Editor**.

## 5. API Key de Gemini

Anda a [Google AI Studio](https://aistudio.google.com/apikey) y genera una API key nueva para este proyecto.

## 6. Editar los 2 archivos de configuracion

Edita `api/lib/organizacion.ts` y `src/config/organizacion.ts` (deben quedar identicos entre si) con los datos del cuerpo de bomberos nuevo:

```typescript
export const ORGANIZACION = {
  nombreCorto: "XXX",
  nombreCompleto: "Nombre completo del cuerpo",
  compania: "Nombre de la compañia/base",
  companiaCorta: "Nombre corto para el sidebar",
  direccion: "Direccion fisica",
  email: "correo@ejemplo.com",
  telefono: "numero de telefono",
};
```

## 7. Variables de entorno

Configuralas en Cloud Run (o en un archivo `.env` local para probar primero):

| Variable | Valor |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | El contenido completo del JSON de la cuenta de servicio (paso 4), entre comillas simples |
| `GEMINI_API_KEY` | La API key del paso 5 |
| `SHEET_USUARIOS_ID` | El ID de la planilla del paso 2 |
| `SHEET_GUARDIAS_ID` | El mismo ID de la planilla del paso 2 (se reusa para todas las pestañas) |
| `GCS_BUCKET_NAME` | El nombre del bucket del paso 3 |
| `DRIVE_FOLDER_ID` | (opcional, solo si usas alguna integracion con Drive) |

## 8. Probar en local

```bash
npm install
npm run dev
```

Anda a la vista previa, confirma que el login funcione y que el nombre/logo se vean correctos.

## 9. Desplegar a Cloud Run

```bash
gcloud config set project TU-PROYECTO-DE-GCP
npm run build
gcloud run deploy nombre-nuevo-cuerpo --source . --region europe-west1
```

## 10. Cargar el primer usuario

Como todavia no hay usuarios en la planilla `USUARIOS`, agrega la primera fila manualmente (con una contraseña provisoria) para poder entrar por primera vez y crear el resto desde la app.

---

## Notas

- El logo (circulo con llama) y el nombre "Fire Intranet" son genericos - no hace falta cambiarlos salvo que quieras un branding distinto para ese cuerpo.
- Los prompts de la IA (extraccion de planillas) ya usan `ORGANIZACION.nombreCompleto` automaticamente, no hay que tocarlos.
- Si el cuerpo nuevo usa formatos de planilla distintos (Guardia, Asistencia, Salida de Movil), los prompts de `api/services/gemini.ts` estan diseñados para ESTOS formatos especificos - si cambia el diseño de la planilla, hay que ajustar el prompt correspondiente.

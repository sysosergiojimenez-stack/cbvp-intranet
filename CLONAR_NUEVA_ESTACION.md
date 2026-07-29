# Como clonar esta app para una nueva estacion de bomberos

Esta guia describe el proceso completo, paso a paso, para desplegar una copia
independiente de la intranet para otra compania/estacion, reutilizando el
mismo codigo pero con datos, hojas de Google Sheets, logo y cuenta de
servicio propios (para que ninguna estacion compita con otra por cuota de
la API de Google Sheets).

Tiempo estimado total: 30-45 minutos.

---

## Parte A - Pasos manuales (antes de correr el script)

### 1. Crear la rama de git

```bash
cd ~/cbvp-intranet
git checkout main
git pull
git checkout -b NOMBRE_ESTACION   # ej: git checkout -b abvp
git push -u origin NOMBRE_ESTACION
```

### 2. Duplicar las hojas de Google Sheets

- Abrí la hoja **USUARIOS** actual en Google Drive -> clic derecho -> **"Hacer una copia"**. Podes hacerlo desde tu cuenta o pedirle al cliente que, logueado con SU cuenta, haga la copia (asi el archivo vive en el Drive del cliente).
- Repetir con la hoja **GUARDIAS** (la que tiene todas las pestañas: Guardias_Encabezado, Guardias_Personal, RolesGuardia_*, etc.)
- Anotá los 2 IDs nuevos (la parte de la URL entre `/d/` y `/edit`). Los vas a necesitar en la Parte B.
- **No hace falta compartirlas todavia** con ninguna cuenta de servicio - eso lo hace el script en el momento justo.

### 3. Editar la configuracion de la organizacion

Editar estos 2 archivos (son los UNICOS que hace falta tocar para cambiar
nombre, direccion, email, telefono, etc. de la nueva estacion):

- `src/config/organizacion.ts`
- `api/lib/organizacion.ts`

Los dos tienen la misma forma:

```ts
export const ORGANIZACION = {
  nombreCorto: "...",
  nombreCompleto: "...",       // linea superior del membrete
  compania: "...",              // linea de la compania/departamento
  companiaCorta: "...",         // usado en el Dashboard
  direccion: "...",
  email: "...",
  telefono: "...",
  sede: "...",                  // Dashboard: "Sede"
  jurisdiccion: "...",          // Dashboard: "Jurisdiccion"
  fundacion: "...",             // Dashboard: "Fundacion" (poner "-" si no aplica)
  lema: "...",
};
```

### 4. Reemplazar el logo/insignia

- Subi el logo nuevo a Cloud Shell (icono de upload / cargar archivo).
- Copialo como `public/insignia.png` (si es PNG) o `public/insignia.jpg` (si es JPG).
- Si cambia el formato (jpg -> png o viceversa), hay que actualizar las referencias en el codigo:

```bash
grep -rn "insignia\.\(jpg\|png\)\|'JPEG'\|'PNG'" src/
```

Y ajustar cada `<img src="...">` y cada `doc.addImage(logo, 'JPEG'|'PNG', ...)` en:
- `src/components/layout/AppLayout.tsx`
- `src/pages/Login.tsx`
- `src/lib/exportarInformePdf.ts`
- `src/lib/exportarRolGuardiaPdf.ts`
- `src/lib/exportarPlanillasGuardiaPdf.ts`

### 5. Commitear los cambios de las Partes A.3 y A.4

```bash
git add -A
git commit -m "feat: NOMBRE_ESTACION - datos de organizacion y logo"
git push
```

---

## Parte B - Script automatizado (infraestructura de GCP)

Con la rama ya lista, corré el script (esta parado en la carpeta del proyecto,
en la rama de la nueva estacion):

```bash
cd ~/cbvp-intranet
bash scripts/clonar_estacion.sh
```

El script te va a pedir:
1. Nombre corto de la estacion (ej: `abvp`)
2. Nombre del servicio Cloud Run (ej: `abvp-intranet-git`)
3. Los 2 IDs de las hojas de Sheets (de la Parte A.2)
4. El servicio Cloud Run base del cual copiar variables compartidas (Enter para usar el default)
5. Proyecto de GCP (Enter para usar el default)
6. Region (Enter para usar el default)

Y automaticamente:
- Crea una cuenta de servicio **nueva y exclusiva** para esta estacion (`NOMBRE-intranet-sa@...`)
- Genera su clave JSON
- Te pausa para que compartas las 2 hojas de Sheets con esa cuenta de servicio nueva (como Editor)
- Arma el archivo de variables de entorno, reutilizando las que son compartidas
  (API keys, bucket de storage, etc.) y usando las nuevas para lo especifico
  de la estacion (credencial de Sheets propia + IDs de hojas)
- Hace el deploy a Cloud Run

Al terminar, la nueva estacion queda funcionando de forma totalmente
independiente, sin compartir cuota de la API de Sheets con ninguna otra
estacion ya desplegada.

---

## Parte C - Verificacion final

- [ ] Entrar a la URL nueva y confirmar que el membrete/logo son los correctos
- [ ] Cargar el primer usuario (Segundo Oficial o Desarrollador) directamente en la hoja USUARIOS nueva para poder loguearse
- [ ] Probar el login
- [ ] Generar un PDF de prueba (Informe, Rol de Guardia o Planilla) para confirmar que el membrete se ve bien
- [ ] Revisar que el intervalo de refresco automatico (`refetchInterval` en `src/providers/trpc.tsx`) sea razonable para evitar problemas de cuota si hay varios usuarios conectados a la vez

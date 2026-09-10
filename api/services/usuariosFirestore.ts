import { getFirestoreClient } from "./firestore";

export const colUsuarios = () => getFirestoreClient().collection("usuarios");
export const colRoles = () => getFirestoreClient().collection("roles");

/**
 * Trae toda la coleccion "usuarios" reacomodada como filas posicionales
 * (mismo orden de columnas A-W que tenia la pestana Sheets "USUARIOS"),
 * para poder reusar sin cambios la logica de negocio de los routers que
 * solo leen USUARIOS de forma transversal (planillas, asistencia,
 * rolesGuardia), sin tener que reescribir esos calculos.
 */
export async function obtenerUsuariosComoFilas(): Promise<unknown[][]> {
  const snapshot = await colUsuarios().get();
  const filas: unknown[][] = [[]]; // fila 0 = placeholder de encabezado (los loops arrancan en i=1)
  snapshot.forEach((doc) => {
    const f = doc.data();
    filas.push([
      doc.id,                 // 0 identificador
      f.codigo,                // 1
      f.anioJuramento,         // 2
      f.categoria,              // 3
      f.cargo,                  // 4
      f.rango,                  // 5
      f.codigoRadial,           // 6
      f.primerNombre,           // 7
      f.segundoNombre,          // 8
      f.primerApellido,         // 9
      f.segundoApellido,        // 10
      f.nroDoc,                 // 11
      f.fechaNacimiento,        // 12
      f.correo,                 // 13
      f.contrasena,             // 14
      f.nivelPermiso,           // 15
      f.descripcionPermiso,     // 16
      f.situ,                   // 17
      f.cuota,                  // 18
      f.licenciaInicio,         // 19
      f.licenciaDias,           // 20
      f.exencion,                // 21
      f.comisionadoDesde,        // 22
    ]);
  });
  return filas;
}

import { colUsuarios } from "../services/usuariosFirestore";

// Codigos de los usuarios con nivel de permiso igual o superior al
// indicado -- usado para decidir a quien avisar de eventos "administrativos"
// (ej. nueva salida de movil) sin tener que mantener una lista aparte.
export async function getCodigosPorNivelMinimo(nivelMinimo: number): Promise<string[]> {
  const snapshot = await colUsuarios().get();
  const codigos: string[] = [];
  snapshot.forEach((doc) => {
    const fila = doc.data();
    const nivel = parseInt(String(fila.nivelPermiso || "1"), 10) || 1;
    const codigo = String(fila.codigo || "").trim();
    if (codigo && nivel >= nivelMinimo) codigos.push(codigo);
  });
  return codigos;
}

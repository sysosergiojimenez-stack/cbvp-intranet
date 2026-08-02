const CARACTERES = "abcdefghijklmnopqrstuvwxyz0123456789";
const LONGITUD = 7;

export function generarIdentificador(): string {
  let id = "";
  for (let i = 0; i < LONGITUD; i++) {
    id += CARACTERES[Math.floor(Math.random() * CARACTERES.length)];
  }
  return id;
}

export async function generarIdentificadorUnico(
  identificadoresExistentes: Set<string>
): Promise<string> {
  let intentos = 0;
  while (intentos < 100) {
    const id = generarIdentificador();
    if (!identificadoresExistentes.has(id)) {
      return id;
    }
    intentos++;
  }
  // Si hay muchas colisiones, generar uno con timestamp para garantizar unicidad
  return `${generarIdentificador()}${Date.now().toString(36)}`;
}

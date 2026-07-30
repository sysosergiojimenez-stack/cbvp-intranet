// Formatea el nombre completo de un bombero incluyendo su rango y la
// abreviatura de su categoria, segun las reglas de CBVP:
//   - Con rango especifico: "{Rango} {Abreviatura} {Nombre} {Apellido}"
//     Ej: "Capitan Mayor BVC Carlos Cespedes"
//   - Con rango generico "Voluntario(a)" (o sin rango): solo
//     "{Abreviatura} {Nombre} {Apellido}"
//     Ej: "BVC Carlos Cespedes"

export function abreviaturaCategoria(categoria: string): string {
  const c = (categoria || "").trim().toUpperCase();
  if (c === "COMBATIENTE") return "BVC";
  if (c === "ACTIVO") return "BVA";
  if (c === "FUNDADOR") return "BVF";
  return "";
}

export function formatearNombreCompleto(
  rango: string,
  categoria: string,
  primerNombre: string,
  primerApellido: string
): string {
  const abrev = abreviaturaCategoria(categoria);
  const nombreBase = primerNombre + (primerApellido ? " " + primerApellido : "");
  const rangoLimpio = (rango || "").trim();
  const esVoluntarioGenerico = !rangoLimpio || rangoLimpio.toUpperCase() === "VOLUNTARIO(A)";

  if (esVoluntarioGenerico) {
    return abrev ? `${abrev} ${nombreBase}` : nombreBase;
  }
  return abrev ? `${rangoLimpio} ${abrev} ${nombreBase}` : `${rangoLimpio} ${nombreBase}`;
}

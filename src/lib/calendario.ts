export const DIAS_SEMANA = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

export function generarSemanasCalendario(anio: number, mes: number): (number | null)[][] {
  const primerDia = new Date(anio, mes - 1, 1);
  const numDias = new Date(anio, mes, 0).getDate();
  let diaSemanaInicio = primerDia.getDay();
  diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

  const semanas: (number | null)[][] = [];
  let semanaActual: (number | null)[] = new Array(diaSemanaInicio).fill(null);
  for (let dia = 1; dia <= numDias; dia++) {
    semanaActual.push(dia);
    if (semanaActual.length === 7) {
      semanas.push(semanaActual);
      semanaActual = [];
    }
  }
  if (semanaActual.length > 0) {
    while (semanaActual.length < 7) semanaActual.push(null);
    semanas.push(semanaActual);
  }
  return semanas;
}

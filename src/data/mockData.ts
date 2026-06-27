import type { Personal, PlanillaEncabezado, GuardiaPersonal, GuardiaHistorial, EstadisticasGuardias } from '@/types';

export const PERSONAL_DATA: Personal[] = [
  { identificador: "1", codigo: "C-1001/18", anioJuramento: "2018", categoria: "Activo", cargo: "Comandante", rango: "Capitan", codigoRadial: "CM01", primerNombre: "Carlos", segundoNombre: "Antonio", primerApellido: "Gonzalez", segundoApellido: "Rios", nroDoc: "1234567", fechaNacimiento: "1985-03-15", correo: "c.gonzalez@cbvp.py", nombreCompleto: "Carlos Antonio Gonzalez Rios" },
  { identificador: "2", codigo: "C-1002/19", anioJuramento: "2019", categoria: "Activo", cargo: "Oficial", rango: "Teniente", codigoRadial: "TN02", primerNombre: "Maria", segundoNombre: "Elena", primerApellido: "Fernandez", segundoApellido: "Lopez", nroDoc: "2345678", fechaNacimiento: "1990-07-22", correo: "m.fernandez@cbvp.py", nombreCompleto: "Maria Elena Fernandez Lopez" },
  { identificador: "3", codigo: "C-1003/19", anioJuramento: "2019", categoria: "Activo", cargo: "Oficial", rango: "Subteniente", codigoRadial: "ST03", primerNombre: "Juan", segundoNombre: "Pablo", primerApellido: "Martinez", segundoApellido: "Silva", nroDoc: "3456789", fechaNacimiento: "1992-11-08", correo: "j.martinez@cbvp.py", nombreCompleto: "Juan Pablo Martinez Silva" },
  { identificador: "4", codigo: "C-1004/20", anioJuramento: "2020", categoria: "Activo", cargo: "Suboficial", rango: "Sargento", codigoRadial: "SG04", primerNombre: "Ana", segundoNombre: "Lucia", primerApellido: "Rodriguez", segundoApellido: "Benitez", nroDoc: "4567890", fechaNacimiento: "1988-05-30", correo: "a.rodriguez@cbvp.py", nombreCompleto: "Ana Lucia Rodriguez Benitez" },
  { identificador: "5", codigo: "C-1005/20", anioJuramento: "2020", categoria: "Activo", cargo: "Suboficial", rango: "Cabo", codigoRadial: "CB05", primerNombre: "Luis", segundoNombre: "Alberto", primerApellido: "Ramirez", segundoApellido: "Gimenez", nroDoc: "5678901", fechaNacimiento: "1995-01-12", correo: "l.ramirez@cbvp.py", nombreCompleto: "Luis Alberto Ramirez Gimenez" },
  { identificador: "6", codigo: "C-1006/21", anioJuramento: "2021", categoria: "Activo", cargo: "Voluntario(a)", rango: "Distinguido", codigoRadial: "DT06", primerNombre: "Pedro", segundoNombre: "Jose", primerApellido: "Acosta", segundoApellido: "Cardozo", nroDoc: "6789012", fechaNacimiento: "1997-09-25", correo: "p.acosta@cbvp.py", nombreCompleto: "Pedro Jose Acosta Cardozo" },
  { identificador: "7", codigo: "C-1007/21", anioJuramento: "2021", categoria: "Activo", cargo: "Voluntario(a)", rango: "Distinguido", codigoRadial: "DT07", primerNombre: "Laura", segundoNombre: "Beatriz", primerApellido: "Medina", segundoApellido: "Flores", nroDoc: "7890123", fechaNacimiento: "1999-04-18", correo: "l.medina@cbvp.py", nombreCompleto: "Laura Beatriz Medina Flores" },
  { identificador: "8", codigo: "C-1008/22", anioJuramento: "2022", categoria: "Activo", cargo: "Voluntario(a)", rango: "Aspirante", codigoRadial: "AS08", primerNombre: "Diego", segundoNombre: "Fernando", primerApellido: "Benitez", segundoApellido: "Soto", nroDoc: "8901234", fechaNacimiento: "2000-12-05", correo: "d.benitez@cbvp.py", nombreCompleto: "Diego Fernando Benitez Soto" },
  { identificador: "9", codigo: "C-1009/22", anioJuramento: "2022", categoria: "Activo", cargo: "Voluntario(a)", rango: "Aspirante", codigoRadial: "AS09", primerNombre: "Sofia", segundoNombre: "Carolina", primerApellido: "Vargas", segundoApellido: "Mendez", nroDoc: "9012345", fechaNacimiento: "2001-06-14", correo: "s.vargas@cbvp.py", nombreCompleto: "Sofia Carolina Vargas Mendez" },
  { identificador: "10", codigo: "C-1010/23", anioJuramento: "2023", categoria: "Activo", cargo: "Voluntario(a)", rango: "Aspirante", codigoRadial: "AS10", primerNombre: "Roberto", segundoNombre: "Alejandro", primerApellido: "Castillo", segundoApellido: "Duarte", nroDoc: "0123456", fechaNacimiento: "2002-08-28", correo: "r.castillo@cbvp.py", nombreCompleto: "Roberto Alejandro Castillo Duarte" },
  { identificador: "11", codigo: "C-1011/23", anioJuramento: "2023", categoria: "Activo", cargo: "Radio Operador", rango: "Aspirante", codigoRadial: "RO11", primerNombre: "Gabriela", segundoNombre: "Andrea", primerApellido: "Molina", segundoApellido: "Paez", nroDoc: "1123456", fechaNacimiento: "2000-02-17", correo: "g.molina@cbvp.py", nombreCompleto: "Gabriela Andrea Molina Paez" },
  { identificador: "12", codigo: "C-1012/24", anioJuramento: "2024", categoria: "Activo", cargo: "Voluntario(a)", rango: "Aspirante", codigoRadial: "AS12", primerNombre: "Andres", segundoNombre: "Manuel", primerApellido: "Rojas", segundoApellido: "Cabrera", nroDoc: "2123456", fechaNacimiento: "2003-10-09", correo: "a.rojas@cbvp.py", nombreCompleto: "Andres Manuel Rojas Cabrera" },
  { identificador: "13", codigo: "C-1013/18", anioJuramento: "2018", categoria: "Activo", cargo: "Director", rango: "Capitan", codigoRadial: "DR13", primerNombre: "Fernando", segundoNombre: "Luis", primerApellido: "Pereira", segundoApellido: "Navarro", nroDoc: "3123456", fechaNacimiento: "1982-07-04", correo: "f.pereira@cbvp.py", nombreCompleto: "Fernando Luis Pereira Navarro" },
  { identificador: "14", codigo: "C-1014/20", anioJuramento: "2020", categoria: "Activo", cargo: "Mecanico", rango: "Cabo", codigoRadial: "MC14", primerNombre: "Hugo", segundoNombre: "Ernesto", primerApellido: "Torres", segundoApellido: "Rivas", nroDoc: "4123456", fechaNacimiento: "1993-12-22", correo: "h.torres@cbvp.py", nombreCompleto: "Hugo Ernesto Torres Rivas" },
  { identificador: "15", codigo: "C-1015/21", anioJuramento: "2021", categoria: "Activo", cargo: "Voluntario(a)", rango: "Distinguido", codigoRadial: "DT15", primerNombre: "Carmen", segundoNombre: "Rosa", primerApellido: "Aguilar", segundoApellido: "Bravo", nroDoc: "5123456", fechaNacimiento: "1998-03-11", correo: "c.aguilar@cbvp.py", nombreCompleto: "Carmen Rosa Aguilar Bravo" },
];

export const PLANILLAS_MOCK: PlanillaEncabezado[] = [
  { idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", inicioGuardia: "08:00", finalizaGuardia: "20:00", directorSem: "C-1013/18", comandanteSemana: "C-1001/18", oficialK20: "C-1002/19", novedades: "Mantenimiento preventivo del AB-201. Se realizo limpieza del cuartel.", urlImagen: "https://drive.google.com/file/d/abc123" },
  { idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", inicioGuardia: "20:00", finalizaGuardia: "08:00", directorSem: "C-1013/18", comandanteSemana: "C-1003/19", oficialK20: "C-1004/20", novedades: "Servicio de incendio en zona residencial. Sin novedades graves.", urlImagen: "https://drive.google.com/file/d/def456" },
  { idPlanilla: "GRD-20260118-081200", fechaCarga: "18/01/2026 08:12", fechaGuardia: "17/01/2026", grupo: "C", inicioGuardia: "08:00", finalizaGuardia: "20:00", directorSem: "C-1013/18", comandanteSemana: "C-1001/18", oficialK20: "C-1005/20", novedades: "Revision de equipos de respiracion autonoma.", urlImagen: "https://drive.google.com/file/d/ghi789" },
  { idPlanilla: "GRD-20260117-202000", fechaCarga: "17/01/2026 20:20", fechaGuardia: "16/01/2026", grupo: "A", inicioGuardia: "20:00", finalizaGuardia: "08:00", directorSem: "C-1013/18", comandanteSemana: "C-1002/19", oficialK20: "C-1006/21", novedades: "Servicio de rescate vehicular en Ruta 2. KM 45.", urlImagen: "https://drive.google.com/file/d/jkl012" },
  { idPlanilla: "GRD-20260116-081000", fechaCarga: "16/01/2026 08:10", fechaGuardia: "15/01/2026", grupo: "B", inicioGuardia: "08:00", finalizaGuardia: "20:00", directorSem: "C-1013/18", comandanteSemana: "C-1003/19", oficialK20: "C-1007/21", novedades: "Capacitacion en manejo de materiales peligrosos.", urlImagen: "https://drive.google.com/file/d/mno345" },
  { idPlanilla: "GRD-20260115-201800", fechaCarga: "15/01/2026 20:18", fechaGuardia: "14/01/2026", grupo: "C", inicioGuardia: "20:00", finalizaGuardia: "08:00", directorSem: "C-1013/18", comandanteSemana: "C-1001/18", oficialK20: "C-1008/22", novedades: "Sin novedades.", urlImagen: "https://drive.google.com/file/d/pqr678" },
  { idPlanilla: "GRD-20260114-080800", fechaCarga: "14/01/2026 08:08", fechaGuardia: "13/01/2026", grupo: "A", inicioGuardia: "08:00", finalizaGuardia: "20:00", directorSem: "C-1013/18", comandanteSemana: "C-1004/20", oficialK20: "C-1009/22", novedades: "Mantenimiento de mangueras y equipos.", urlImagen: "https://drive.google.com/file/d/stu901" },
  { idPlanilla: "GRD-20260113-201200", fechaCarga: "13/01/2026 20:12", fechaGuardia: "12/01/2026", grupo: "B", inicioGuardia: "20:00", finalizaGuardia: "08:00", directorSem: "C-1013/18", comandanteSemana: "C-1005/20", oficialK20: "C-1010/23", novedades: "Servicio de incendio en comercio. Controlado en 30 minutos.", urlImagen: "https://drive.google.com/file/d/vwx234" },
  { idPlanilla: "GRD-20260112-081500", fechaCarga: "12/01/2026 08:15", fechaGuardia: "11/01/2026", grupo: "C", inicioGuardia: "08:00", finalizaGuardia: "20:00", directorSem: "C-1013/18", comandanteSemana: "C-1001/18", oficialK20: "C-1011/23", novedades: "Dia de parque abierto a la comunidad.", urlImagen: "https://drive.google.com/file/d/yzu567" },
  { idPlanilla: "GRD-20260111-202500", fechaCarga: "11/01/2026 20:25", fechaGuardia: "10/01/2026", grupo: "A", inicioGuardia: "20:00", finalizaGuardia: "08:00", directorSem: "C-1013/18", comandanteSemana: "C-1002/19", oficialK20: "C-1012/24", novedades: "Servicio de emergencia medica. Traslado a hospital.", urlImagen: "https://drive.google.com/file/d/abc890" },
];

export const GUARDIAS_PERSONAL_MOCK: GuardiaPersonal[] = [
  // GRD-20260120-080530
  { idFila: "GRD-20260120-080530-1", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "GUARDIA NORMAL", codigo: "C-1001/18", nombre: "Carlos Antonio Gonzalez Rios", asignacion: "Jefe de Guardia", asistencia: "PRESENTE", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-2", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "GUARDIA NORMAL", codigo: "C-1004/20", nombre: "Ana Lucia Rodriguez Benitez", asignacion: "AB-201", asistencia: "PRESENTE", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-3", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "GUARDIA NORMAL", codigo: "C-1006/21", nombre: "Pedro Jose Acosta Cardozo", asignacion: "AB-202", asistencia: "ACACR", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-4", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "GUARDIA NORMAL", codigo: "C-1008/22", nombre: "Diego Fernando Benitez Soto", asignacion: "Reserva", asistencia: "PRESENTE", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-5", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "GUARDIA ESPECIAL", codigo: "C-1002/19", nombre: "Maria Elena Fernandez Lopez", asignacion: "Supervision", asistencia: "", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-6", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "REFUERZO", codigo: "C-1015/21", nombre: "Carmen Rosa Aguilar Bravo", asignacion: "Apoyo", asistencia: "", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-7", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "RADIO OPERADOR", codigo: "C-1011/23", nombre: "Gabriela Andrea Molina Paez", asignacion: "Alfa", asistencia: "K20-Activo", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-8", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "MOVIL", codigo: "AB-201", nombre: "", asignacion: "Operativo", asistencia: "10.450", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  { idFila: "GRD-20260120-080530-9", idPlanilla: "GRD-20260120-080530", fechaCarga: "20/01/2026 08:05", fechaGuardia: "19/01/2026", grupo: "A", tipo: "MOVIL", codigo: "AB-202", nombre: "", asignacion: "Taller", asistencia: "8.230", idCargador: "1", nombreCargador: "Carlos Antonio Gonzalez Rios" },
  // GRD-20260119-201500
  { idFila: "GRD-20260119-201500-1", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "GUARDIA NORMAL", codigo: "C-1003/19", nombre: "Juan Pablo Martinez Silva", asignacion: "Jefe de Guardia", asistencia: "PRESENTE", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
  { idFila: "GRD-20260119-201500-2", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "GUARDIA NORMAL", codigo: "C-1005/20", nombre: "Luis Alberto Ramirez Gimenez", asignacion: "AB-201", asistencia: "PRESENTE", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
  { idFila: "GRD-20260119-201500-3", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "GUARDIA NORMAL", codigo: "C-1007/21", nombre: "Laura Beatriz Medina Flores", asignacion: "AB-202", asistencia: "ACASR", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
  { idFila: "GRD-20260119-201500-4", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "GUARDIA NORMAL", codigo: "C-1009/22", nombre: "Sofia Carolina Vargas Mendez", asignacion: "Reserva", asistencia: "PRESENTE", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
  { idFila: "GRD-20260119-201500-5", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "GUARDIA ESPECIAL", codigo: "C-1014/20", nombre: "Hugo Ernesto Torres Rivas", asignacion: "Mantenimiento", asistencia: "", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
  { idFila: "GRD-20260119-201500-6", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "REFUERZO", codigo: "C-1012/24", nombre: "Andres Manuel Rojas Cabrera", asignacion: "Apoyo", asistencia: "", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
  { idFila: "GRD-20260119-201500-7", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "RADIO OPERADOR", codigo: "C-1004/20", nombre: "Ana Lucia Rodriguez Benitez", asignacion: "Alfa", asistencia: "K20-Activo", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
  { idFila: "GRD-20260119-201500-8", idPlanilla: "GRD-20260119-201500", fechaCarga: "19/01/2026 20:15", fechaGuardia: "18/01/2026", grupo: "B", tipo: "MOVIL", codigo: "AB-201", nombre: "", asignacion: "Operativo", asistencia: "10.520", idCargador: "2", nombreCargador: "Maria Elena Fernandez Lopez" },
];

export function getGuardiasByPlanilla(idPlanilla: string): GuardiaPersonal[] {
  return GUARDIAS_PERSONAL_MOCK.filter(g => g.idPlanilla === idPlanilla);
}

export function getGuardiasByBombero(codigo: string): { guardias: GuardiaHistorial[]; stats: EstadisticasGuardias } {
  const guardias = GUARDIAS_PERSONAL_MOCK
    .filter(g => g.codigo === codigo)
    .map(g => ({
      idPlanilla: g.idPlanilla,
      fechaGuardia: g.fechaGuardia,
      grupo: g.grupo,
      tipo: g.tipo,
      asignacion: g.asignacion,
      asistencia: g.asistencia,
      fechaCarga: g.fechaCarga,
    }));

  const stats: EstadisticasGuardias = {
    totalGuardias: guardias.length,
    guardiasNormales: guardias.filter(g => g.tipo === 'GUARDIA NORMAL').length,
    guardiasEspeciales: guardias.filter(g => g.tipo === 'GUARDIA ESPECIAL').length,
    refuerzos: guardias.filter(g => g.tipo === 'REFUERZO').length,
    presentes: guardias.filter(g => g.asistencia === 'PRESENTE').length,
    acacr: guardias.filter(g => g.asistencia === 'ACACR').length,
    acasr: guardias.filter(g => g.asistencia === 'ACASR').length,
    asasr: guardias.filter(g => g.asistencia === 'ASASR').length,
  };

  return { guardias, stats };
}

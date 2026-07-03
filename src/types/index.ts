export interface Usuario {
  exito: boolean;
  identificador: string;
  codigo: string;
  categoria: string;
  cargo: string;
  rango: string;
  nivelPermiso: number;
  descripcionPermiso: string;
  accesosPermiso: string;
  nombreCompleto: string;
  correo: string;
}

export interface Permiso {
  exito: boolean;
  nivel: number;
  descripcion: string;
  accesos: string;
  mensaje?: string;
}

export interface Personal {
  identificador: string;
  codigo: string;
  anioJuramento: string;
  categoria: string;
  cargo: string;
  rango: string;
  codigoRadial: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  nroDoc: string;
  fechaNacimiento: string;
  correo: string;
  nombreCompleto: string;
}

export interface GuardiaPersonal {
  idFila: string;
  idPlanilla: string;
  fechaCarga: string;
  fechaGuardia: string;
  grupo: string;
  tipo: 'GUARDIA NORMAL' | 'GUARDIA ESPECIAL' | 'REFUERZO' | 'RADIO OPERADOR' | 'MOVIL';
  codigo: string;
  nombre: string;
  asignacion: string;
  asistencia: string;
  idCargador: string;
  nombreCargador: string;
}

export interface PlanillaEncabezado {
  idPlanilla: string;
  fechaCarga: string;
  fechaGuardia: string;
  grupo: string;
  inicioGuardia: string;
  finalizaGuardia: string;
  directorSem: string;
  comandanteSemana: string;
  oficialK20: string;
  novedades: string;
  urlImagen: string;
}

export interface DatosExtraidos {
  compania: string;
  grupo: string;
  fechaGuardia: string;
  tipoGuardia: string;
  personal: Array<{
    numero: string;
    codigo: string;
    nombre: string;
    asignacion: string;
    asistencia: string;
  }>;
  guardiasEspeciales: Array<{
    numero: string;
    codigo: string;
    nombre: string;
    asignacion: string;
  }>;
  refuerzos: Array<{
    numero: string;
    codigo: string;
    nombre: string;
    asignacion: string;
  }>;
  radioOperadores: Array<{
    codigo: string;
    nombre: string;
    alfa: string;
    k20: string;
  }>;
  moviles: Array<{
    codigo: string;
    situacion: string;
    kilometraje: string;
  }>;
  novedades: string;
  inicioGuardia: string;
  finalizaGuardia: string;
  directorSem: string;
  comandanteSemana: string;
  oficialK20: string;
}

export interface RespuestaServidor {
  exito: boolean;
  mensaje?: string;
  idPlanilla?: string;
  datos?: DatosExtraidos;
  planillas?: PlanillaEncabezado[];
  personal?: GuardiaPersonal[];
  guardias?: GuardiaHistorial[];
  stats?: EstadisticasGuardias;
}

export interface GuardiaHistorial {
  idPlanilla: string;
  fechaGuardia: string;
  grupo: string;
  tipo: string;
  asignacion: string;
  asistencia: string;
  fechaCarga: string;
}

export interface EstadisticasGuardias {
  totalGuardias: number;
  guardiasNormales: number;
  guardiasEspeciales: number;
  refuerzos: number;
  presentes: number;
  acacr: number;
  acasr: number;
  asasr: number;
}

export type TipoPersonal = 'GUARDIA NORMAL' | 'GUARDIA ESPECIAL' | 'REFUERZO' | 'RADIO OPERADOR' | 'MOVIL';

export type AccionPermiso =
  | 'ver_todo'
  | 'editar_planillas'
  | 'eliminar_planillas'
  | 'ver_personal'
  | 'ver_historial'
  | 'cargar_planillas'
  | 'ver_perfil_propio'
  | 'configuracion';

// ========== ASISTENCIA (Practicas/Citaciones) ==========
export interface AsistenciaEncabezado {
  idPlanilla: string;
  fechaCarga: string;
  fechaActividad: string;
  tipoActividad: string;
  inicioActividad: string;
  finalizaActividad: string;
  acargoActividad: string;
  detalles: string;
  urlImagen: string;
}

export interface AsistenciaPersonal {
  idFila: string;
  idPlanilla: string;
  fechaCarga: string;
  fechaActividad: string;
  codigo: string;
  nombre: string;
  asistencia: string;
  cargadoPorId: string;
  cargadoPorNombre: string;
}

export interface EstadisticasAsistencia {
  totalActividades: number;
  presentes: number;
  ausentes: number;
  comisionados: number;
}

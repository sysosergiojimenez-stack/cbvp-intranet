// Definicion de la Historia Prehospitalaria (formulario oficial del CBVP).
// La usan la pagina del formulario y la exportacion a PDF, para que las dos
// muestren los mismos campos en el mismo orden.
//
// Las casillas se guardan en `checks` y los textos en `textos`, ambos con la
// clave "<grupo>_<item>" (ej. "condicion_atrapado"). Sin puntos, porque
// Firestore los interpreta como rutas de campo.

export function clave(grupo: string, item: string): string {
  return `${grupo}_${item}`;
}

// Codigos de servicio que generan una Historia Prehospitalaria.
export const CODIGOS_PREHOSPITALARIOS = ['10:44', '10:49', '10:50', '10:51'];

export function esServicioPrehospitalario(tipoServicio: string): boolean {
  return CODIGOS_PREHOSPITALARIOS.some(c => tipoServicio.startsWith(c));
}

export interface ItemDef {
  key: string;
  label: string;
  // Muestra una linea de texto junto a la casilla (ej. "Atrapado: ......")
  detalle?: boolean;
  // El item solo tiene la linea de texto, sin casilla (ej. "Caída desde ... mts")
  sinCasilla?: boolean;
}

export interface GrupoDef {
  grupo: string;
  titulo: string;
  items: ItemDef[];
}

export const CONDICION: GrupoDef = {
  grupo: 'condicion', titulo: 'CONDICIÓN',
  items: [
    { key: 'atrapado', label: 'Atrapado', detalle: true },
    { key: 'obito', label: 'Óbito', detalle: true },
    { key: 'viaPublica', label: 'Vía Pública', detalle: true },
    { key: 'domicilio', label: 'Domicilio', detalle: true },
    { key: 'dentroVehiculo', label: 'Dentro del vehículo', detalle: true },
    { key: 'nosocomio', label: 'Nosocomio', detalle: true },
    { key: 'habitacion', label: 'Habitación', detalle: true },
    { key: 'piso', label: 'Piso', detalle: true },
  ],
};

export const MOTIVO: GrupoDef = {
  grupo: 'motivo', titulo: 'MOTIVO DE LA LLAMADA',
  items: [
    { key: 'incendio', label: 'Incendio' },
    { key: 'accidenteTransito', label: 'Accidente de tránsito' },
    { key: 'rescate', label: 'Rescate', detalle: true },
    { key: 'tbr', label: 'TBR', detalle: true },
    { key: 'tar', label: 'TAR', detalle: true },
    { key: 'arrollamiento', label: 'Arrollamiento', detalle: true },
    { key: 'caida', label: 'Caída desde (mts. aprox.)', detalle: true, sinCasilla: true },
    { key: 'armaBlanca', label: 'Herida por arma blanca', detalle: true },
    { key: 'armaFuego', label: 'Herida por arma de fuego', detalle: true },
    { key: 'trabajoParto', label: 'Trabajo de parto', detalle: true },
    { key: 'otros', label: 'Otros', detalle: true },
    { key: 'problemasMedicos', label: 'Problemas médicos', detalle: true },
  ],
};

export const RESPIRACION: GrupoDef = {
  grupo: 'respiracion', titulo: 'RESPIRACIÓN',
  items: [
    { key: 'normal', label: 'Normal' }, { key: 'superficial', label: 'Superficial' },
    { key: 'laboriosa', label: 'Laboriosa' }, { key: 'hiperventila', label: 'Hiperventila' },
    { key: 'apnea', label: 'Apnea' }, { key: 'noVerifica', label: 'No verifica' },
  ],
};

export const CORAZON: GrupoDef = {
  grupo: 'corazon', titulo: 'CORAZÓN',
  items: [
    { key: 'normal', label: 'Normal' }, { key: 'arritmia', label: 'Arritmia' },
    { key: 'asistolia', label: 'Asistolia' }, { key: 'otros', label: 'Otros' },
    { key: 'noVerifica', label: 'No verifica' },
  ],
};

export const PIEL: GrupoDef = {
  grupo: 'piel', titulo: 'PIEL',
  items: [
    { key: 'normal', label: 'Normal' }, { key: 'frio', label: 'Frío' }, { key: 'caliente', label: 'Caliente' },
    { key: 'roja', label: 'Roja' }, { key: 'palida', label: 'Pálida' },
    { key: 'cianotica', label: 'Cianótica' }, { key: 'sudorosa', label: 'Sudorosa' },
  ],
};

export const ANTECEDENTES: GrupoDef = {
  grupo: 'antecedentes', titulo: 'ANTECEDENTES',
  items: [
    { key: 'ausentes', label: 'Ausentes' }, { key: 'cardiaco', label: 'Cardiaco' },
    { key: 'hta', label: 'HTA' }, { key: 'acv', label: 'ACV' },
    { key: 'diabetes', label: 'Diabetes' }, { key: 'epilepsia', label: 'Epilepsia' },
    { key: 'epoc', label: 'EPOC' }, { key: 'alergias', label: 'Alergias' },
    { key: 'medicacion', label: 'Medicación' }, { key: 'otros', label: 'Otros' },
    { key: 'noVerifica', label: 'No verifica' },
  ],
};

export const PUPILAS: GrupoDef = {
  grupo: 'pupilas', titulo: 'PUPILAS',
  items: [
    { key: 'reactivas', label: 'Reactivas' }, { key: 'miosis', label: 'Miosis' },
    { key: 'midriasis', label: 'Midriasis' }, { key: 'anisocoria', label: 'Anisocoria' },
    { key: 'noVerifica', label: 'No verifica' },
  ],
};

export const PULMONES: GrupoDef = {
  grupo: 'pulmones', titulo: 'PULMONES',
  items: [
    { key: 'normales', label: 'Normales' }, { key: 'sibilancia', label: 'Sibilancia' },
    { key: 'murVes', label: 'Mur. Ves.' }, { key: 'ausentes', label: 'Ausentes' },
    { key: 'noVerifica', label: 'No verifica' },
  ],
};

export const LESIONES: GrupoDef = {
  grupo: 'lesiones', titulo: 'LESIONES',
  items: [
    { key: 'heridas', label: 'Heridas' }, { key: 'fracturas', label: 'Fracturas' },
    { key: 'politrauma', label: 'Politrauma.' }, { key: 'comp', label: 'Comp.' },
    { key: 'neurolog', label: 'Neurolog.' }, { key: 'noVerifica', label: 'No verifica' },
  ],
};

export const QUEMADURAS_PROFUNDIDAD: GrupoDef = {
  grupo: 'quemProf', titulo: 'QUEMADURAS (Según profundidad)',
  items: [
    { key: 'primer', label: 'Primer Grado' }, { key: 'segundo', label: 'Segundo Grado' }, { key: 'tercer', label: 'Tercer Grado' },
  ],
};

export const QUEMADURAS_EXTENSION: GrupoDef = {
  grupo: 'quemExt', titulo: 'QUEMADURAS (Según su extensión)',
  items: [
    { key: 'termica', label: 'Térmica' }, { key: 'quimica', label: 'Química' },
    { key: 'electrica', label: 'Eléctrica' }, { key: 'radiante', label: 'Radiante' },
    { key: 'noVerifico', label: 'No se verificó' },
  ],
};

export const ASISTENCIA: GrupoDef = {
  grupo: 'asistencia', titulo: 'ASISTENCIA',
  items: [
    { key: 'collar', label: 'Collar Cervical' }, { key: 'tabla', label: 'Tabla Espinal' },
    { key: 'hgt', label: 'H.G.T.' }, { key: 'intubacion', label: 'Intubación' },
    { key: 'succion', label: 'Succión' }, { key: 'oxigeno', label: 'Oxígeno' },
  ],
};

export const MEDICACION: GrupoDef = {
  grupo: 'medicacion', titulo: 'MEDICACIÓN',
  items: [
    { key: 'iv', label: 'I.V.' }, { key: 'im', label: 'I.M.' }, { key: 'sl', label: 'S.L.' },
    { key: 'dext', label: 'Dext.' }, { key: 'sf', label: 'S.F.' }, { key: 'rl', label: 'R.L.' },
  ],
};

export const CIERRE: GrupoDef = {
  grupo: 'cierre', titulo: '',
  items: [
    { key: 'derivadoPreArribo', label: 'Derivado pre arribo' },
    { key: 'suspendido', label: 'Suspendido' },
    { key: 'falsaAlarma', label: 'Falsa Alarma' },
  ],
};

export const EXPLORACION: { key: string; label: string }[] = [
  { key: 'cabeza', label: 'CABEZA' }, { key: 'cuello', label: 'CUELLO' }, { key: 'torax', label: 'TÓRAX' },
  { key: 'abdomen', label: 'ABDOMEN' }, { key: 'miembroSuperior', label: 'MIEMBRO SUPERIOR' },
  { key: 'miembroInferior', label: 'MIEMBRO INFERIOR' }, { key: 'dorso', label: 'DORSO' },
];

export const GLASGOW: { campo: 'glasgowOjos' | 'glasgowVerbal' | 'glasgowMotora'; titulo: string; opciones: [string, number][] }[] = [
  { campo: 'glasgowOjos', titulo: 'ABRE LOS OJOS', opciones: [['Espontáneo', 4], ['A voces', 3], ['Al dolor', 2], ['Ninguno', 1]] },
  { campo: 'glasgowVerbal', titulo: 'RESPUESTA VERBAL', opciones: [['Orientado', 5], ['Confuso', 4], ['Palabras inapropiadas', 3], ['Palabras incomprensibles', 2], ['Ninguno', 1]] },
  { campo: 'glasgowMotora', titulo: 'RESPUESTA MOTRIZ', opciones: [['Obedece ordenes', 6], ['Localiza el dolor', 5], ['Se aleja del dolor', 4], ['Flexiona el dolor', 3], ['Extiende al dolor', 2], ['Ninguno', 1]] },
];

export const LEYENDA_SIGLAS: string[][] = [
  ['Obito: Muerto', 'T.B.R.: Traslado de Bajo Riesgo', 'T.A.R.: Traslado de Alto Riesgo', 'Apnea: Ausencia de respiración', 'Arritmia: Falta de ritmo cardiaco', 'Asistolia: Ausencia de latido cardiaco', 'Cianosis: Coloración azulada de piel y mucosas'],
  ['EPOC: Enfermedad Pulmonar Obstructiva Crónica', 'ACV: Accidente Cerebro Vascular', 'Miosis: Contracción pupilar', 'Midriasis: Dilatación del tamaño pupilar', 'Anisocoria: Diferencia del tamaño pupilar', 'H.G.T.: Hemo Gluco Test', 'I.V.: Intra Venosa'],
  ['I.M.: Intra Muscular', 'S.L.: Sublingual', 'Dext.: Dextrosa', 'R.L.: Ringer Lactato', 'S.F.: Solución Fisiológica', 'Sibilancia: Sonido somo silbido de los pulmones'],
];

export const SIGNOS_VITALES_FILAS = 5;
export const RESPONDIENTES_FILAS = 4;

export interface SignoVital { hora: string; fc: string; fr: string; pa: string; temp: string }
export interface Respondiente { nombre: string; cod: string }

// Datos de una Historia Prehospitalaria (los mismos campos que valida el router).
export interface HistoriaPrehospitalaria {
  id?: string;
  salidaId: string;
  // Codigo del tipo de servicio de origen: "10:44", "10:49", "10:50" o "10:51"
  tipoInforme: string;
  nServicio: string;
  movil: string;
  fecha: string;
  direccion: string;
  nombre: string;
  edad: string;
  sexo: string;
  destino: string;
  prioridadTriage: string;
  signosVitales: SignoVital[];
  checks: Record<string, boolean>;
  textos: Record<string, string>;
  glasgowOjos: number | null;
  glasgowVerbal: number | null;
  glasgowMotora: number | null;
  respondientes: Respondiente[];
}

export function historiaVacia(): HistoriaPrehospitalaria {
  return {
    salidaId: '', tipoInforme: '10:44', nServicio: '', movil: '', fecha: '', direccion: '',
    nombre: '', edad: '', sexo: '', destino: '', prioridadTriage: '',
    signosVitales: Array.from({ length: SIGNOS_VITALES_FILAS }, () => ({ hora: '', fc: '', fr: '', pa: '', temp: '' })),
    checks: {}, textos: {},
    glasgowOjos: null, glasgowVerbal: null, glasgowMotora: null,
    respondientes: Array.from({ length: RESPONDIENTES_FILAS }, () => ({ nombre: '', cod: '' })),
  };
}

// Completa un informe parcial (de la salida o de la base) con los valores vacios
// y garantiza la cantidad fija de filas de signos vitales y respondientes.
export function normalizarHistoria(parcial: Partial<HistoriaPrehospitalaria>): HistoriaPrehospitalaria {
  const base = historiaVacia();
  const signos = [...(parcial.signosVitales || [])];
  while (signos.length < SIGNOS_VITALES_FILAS) signos.push({ hora: '', fc: '', fr: '', pa: '', temp: '' });
  const resp = [...(parcial.respondientes || [])];
  while (resp.length < RESPONDIENTES_FILAS) resp.push({ nombre: '', cod: '' });
  return { ...base, ...parcial, checks: parcial.checks || {}, textos: parcial.textos || {}, signosVitales: signos, respondientes: resp };
}

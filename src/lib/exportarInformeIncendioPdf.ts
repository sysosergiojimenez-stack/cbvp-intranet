import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';

interface Persona { nombre: string; ci: string; edad: string; nacionalidad: string }
interface VoluntarioConductor { movil: string; conductor: string; codigo: string }
interface VoluntarioCombatiente { movil: string; combatiente: string; codigo: string }

export interface InformeIncendioPdf {
  nServicio: string;
  movil: string;
  fecha: string;
  ordenDeSalida: string;
  horaSalida: string;
  horaLlegada: string;
  horaRetirada: string;
  direccion: string;
  frenteAlNo: string;
  entreCalle1: string;
  entreCalle2: string;
  ciudad: string;
  barrio: string;
  zona: string;
  alMandoDelActo: string;
  aCargoDeLaCompania: string;
  seguro: string;
  seguroEmpresa: string;
  seguroValor: string;
  magnitud: string;
  transporteAereoTipo: string;
  transporteTerrestreTipo: string;
  transporteAcuaticoTipo: string;
  edificioTipos: string[];
  edificioComercialTipoDetalle: string;
  edificioPublicoTipoDetalle: string;
  edificioMatConstruccion: string;
  edificioEspecificarTipo: string;
  forestalBosqueTipo: string;
  forestalPastizalTipo: string;
  forestalOtrosEspecificar: string;
  propietarioChofer: string;
  identCI: string;
  identEdad: string;
  identNacionalidad: string;
  identEstadoCivil: string;
  identRegNo: string;
  identTelPart: string;
  identDireccionPart: string;
  identTelLab: string;
  identDireccionLab: string;
  identMaterialContenidoRamo: string;
  vehiculoTipo: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoChapaNo: string;
  posibleCausa: string;
  posibleOrigen: string;
  estadoFuego: number | null;
  factoresPropagacion: string;
  accesoLocal: string;
  accesoViolentadoPor: string;
  colorLlamas: string;
  colorHumo: string;
  oloresIdentificados: string;
  materialesExplosivos: boolean;
  materialesInflamables: boolean;
  materialesToxicos: boolean;
  materialesOtros: boolean;
  inmueblesAfectadosFuego: string;
  inmueblesAfectadosExtincion: string;
  objetosAfectadosFuego: string;
  objetosAfectadosExtincion: string;
  heridos: Persona[];
  muertos: Persona[];
  materialesUtilizadosMoviles: string;
  materialesUtilizadosMenor: string;
  materialesUtilizadosAjenos: string;
  otrosDeApoyo: string;
  personalPolicialACargoDe: string;
  ministerioPublicoOficiadoPor: string;
  otrosDatosInteres: string;
  desarrolloDelInforme: string;
  nominaConductores: VoluntarioConductor[];
  nominaCombatientes: VoluntarioCombatiente[];
  nominaACargo: string;
  nominaFirma: string;
}

const ESTADOS_FUEGO_LABEL: Record<number, string> = {
  1: '1- No se ve nada / Se investiga',
  2: '2- Se ve humo — Ataque interior rapido y agresivo',
  3: '3- Se ve humo y poco fuego — Ataque interior rapido y agresivo',
  4: '4- Fuego en desarrollo — Ataque interior cauteloso',
  5: '5- Fuego Activo — Ataque interior cauteloso',
  6: '6- Fuego Marginal — Ataque interior y cauteloso',
  7: '7- Total en llamas — Operaciones exteriores defensivas',
  8: '8- Inicio Descendente — Op. Ext. Defensivos, previendo colapso',
  9: '9- Descendente — Op. Ext. Defensivos, previendo colapso',
  10: '10- Remocion',
};

async function cargarImagenBase64(ruta: string): Promise<string | null> {
  try {
    const resp = await fetch(ruta);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function dibujarCheckbox(doc: jsPDF, x: number, y: number, marcado: boolean, label: string): number {
  const size = 3.2;
  doc.setDrawColor(0, 0, 0);
  doc.rect(x, y - size + 0.8, size, size);
  if (marcado) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', x + 0.5, y);
    doc.setFont('helvetica', 'normal');
  }
  doc.text(label, x + size + 1.5, y);
  return x + size + 1.5 + doc.getTextWidth(label) + 4;
}

export async function exportarInformeIncendioPdf(informe: InformeIncendioPdf) {
  const escudo = await cargarImagenBase64('/escudo-cbvp.png');
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 12;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 15;
    }
  };

  // ---- Encabezado ----
  if (escudo) {
    try {
      const props = doc.getImageProperties(escudo);
      const ratio = props.width / props.height || 1;
      const h = 16;
      doc.addImage(escudo, 'PNG', marginLeft, y, h * ratio, h);
    } catch { /* ignore */ }
  }
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(ORGANIZACION.nombreCompleto.toUpperCase(), pageWidth / 2 + 8, y + 6, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`COMPAÑIA: ${ORGANIZACION.compania}`, pageWidth / 2 + 8, y + 12, { align: 'center' });
  y += 18;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE INCENDIO', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const linea = (texto: string) => {
    checkPageBreak(6);
    doc.text(texto, marginLeft, y);
    y += 5.5;
  };

  linea(`N° Servicio: ${informe.nServicio || '-'}      Fecha: ${informe.fecha || '-'}      Orden de Salida: ${informe.ordenDeSalida || '-'}      Movil: ${informe.movil || '-'}`);
  linea(`Hora de salida: ${informe.horaSalida || '-'}      Hora de llegada: ${informe.horaLlegada || '-'}      Hora de retirada: ${informe.horaRetirada || '-'}`);
  linea(`Direccion: ${informe.direccion || '-'}      Frente al N°: ${informe.frenteAlNo || '-'}`);
  linea(`Entre: ${informe.entreCalle1 || '-'}   y   ${informe.entreCalle2 || '-'}`);
  linea(`Ciudad: ${informe.ciudad || '-'}      Barrio: ${informe.barrio || '-'}      Zona: ${informe.zona || '-'}`);
  linea(`Al mando del Acto: ${informe.alMandoDelActo || '-'}      A cargo de la Compañia: ${informe.aCargoDeLaCompania || '-'}`);
  linea(`Seguro: ${informe.seguro || '-'}      Empresa: ${informe.seguroEmpresa || '-'}      Valor: ${informe.seguroValor || '-'}`);
  linea(`Magnitud: ${informe.magnitud || '-'}`);
  linea(`Transporte — Aereo: ${informe.transporteAereoTipo || '-'}  ·  Terrestre: ${informe.transporteTerrestreTipo || '-'}  ·  Acuatico: ${informe.transporteAcuaticoTipo || '-'}`);

  checkPageBreak(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Edificio:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  let xChk = marginLeft + 16;
  const tiposEdificio = ['Vivienda', 'Edificio', 'Comercial', 'Deposito', 'Industrial', 'Publico'];
  for (const t of tiposEdificio) {
    if (xChk > marginLeft + contentWidth - 30) { xChk = marginLeft + 16; y += 6; }
    xChk = dibujarCheckbox(doc, xChk, y, informe.edificioTipos.includes(t), t);
  }
  y += 7;
  linea(`Comercial-Tipo: ${informe.edificioComercialTipoDetalle || '-'}   Publico-Tipo: ${informe.edificioPublicoTipoDetalle || '-'}`);
  linea(`Mat. de Construccion: ${informe.edificioMatConstruccion || '-'}`);
  linea(`Especificar tipo: ${informe.edificioEspecificarTipo || '-'}`);
  linea(`Forestal — Bosque: ${informe.forestalBosqueTipo || '-'}  ·  Pastizal: ${informe.forestalPastizalTipo || '-'}  ·  Otros: ${informe.forestalOtrosEspecificar || '-'}`);

  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.text('Identificacion del local / transporte', marginLeft, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  linea(`Propietario/Chofer: ${informe.propietarioChofer || '-'}`);
  linea(`C.I. N°: ${informe.identCI || '-'}   Edad: ${informe.identEdad || '-'}   Nacionalidad: ${informe.identNacionalidad || '-'}`);
  linea(`E. Civil: ${informe.identEstadoCivil || '-'}   Reg. N°: ${informe.identRegNo || '-'}   Tel. Part.: ${informe.identTelPart || '-'}`);
  linea(`Direccion part.: ${informe.identDireccionPart || '-'}   Tel. Lab.: ${informe.identTelLab || '-'}`);
  linea(`Direccion lab.: ${informe.identDireccionLab || '-'}`);
  linea(`Material contenido/ramo: ${informe.identMaterialContenidoRamo || '-'}`);
  linea(`Vehiculo — Tipo: ${informe.vehiculoTipo || '-'}   Marca: ${informe.vehiculoMarca || '-'}   Modelo: ${informe.vehiculoModelo || '-'}   Chapa N°: ${informe.vehiculoChapaNo || '-'}`);

  checkPageBreak(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Posible Causa:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  const causaLineas = doc.splitTextToSize(informe.posibleCausa || '-', contentWidth);
  doc.text(causaLineas, marginLeft, y + 5);
  y += 5 + causaLineas.length * 4.2 + 2;
  checkPageBreak(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Posible Origen:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  const origenLineas = doc.splitTextToSize(informe.posibleOrigen || '-', contentWidth);
  doc.text(origenLineas, marginLeft, y + 5);
  y += 5 + origenLineas.length * 4.2 + 3;

  checkPageBreak(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Estado del fuego a la llegada de la dotacion:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  linea(informe.estadoFuego ? ESTADOS_FUEGO_LABEL[informe.estadoFuego] : '-');
  linea(`Factores de propagacion: ${informe.factoresPropagacion || '-'}`);
  linea(`Acceso al local: ${informe.accesoLocal || '-'}   Violentado por: ${informe.accesoViolentadoPor || '-'}`);
  linea(`Color de las llamas: ${informe.colorLlamas || '-'}   Color del Humo: ${informe.colorHumo || '-'}   Olores: ${informe.oloresIdentificados || '-'}`);

  checkPageBreak(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Materiales:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  let xMat = marginLeft + 20;
  const materiales: [boolean, string][] = [
    [informe.materialesExplosivos, 'Explosivos'], [informe.materialesInflamables, 'Inflamables'],
    [informe.materialesToxicos, 'Toxicos'], [informe.materialesOtros, 'Otros'],
  ];
  for (const [marcado, label] of materiales) xMat = dibujarCheckbox(doc, xMat, y, marcado, label);
  y += 7;

  linea(`Inmuebles afectados — Fuego: ${informe.inmueblesAfectadosFuego || '-'}`);
  linea(`Inmuebles afectados — Extincion: ${informe.inmueblesAfectadosExtincion || '-'}`);
  linea(`Objetos afectados — Fuego: ${informe.objetosAfectadosFuego || '-'}`);
  linea(`Objetos afectados — Extincion: ${informe.objetosAfectadosExtincion || '-'}`);

  // ---- Pagina 2: heridos/muertos, materiales, desarrollo, nomina ----
  doc.addPage();
  y = 15;

  const tablaPersonas = (titulo: string, personas: Persona[]) => {
    checkPageBreak(20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, marginLeft, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Nombre', 'C.I. N°', 'Edad', 'Nacionalidad']],
      body: personas.length > 0 ? personas.map(p => [p.nombre, p.ci, p.edad, p.nacionalidad]) : [['-', '-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8 },
      margin: { left: marginLeft, right: marginRight },
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    y = doc.lastAutoTable.finalY + 6;
  };

  tablaPersonas('Heridos', informe.heridos);
  tablaPersonas('Muertos', informe.muertos);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.text('Materiales Utilizados', marginLeft, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  linea(`Moviles: ${informe.materialesUtilizadosMoviles || '-'}`);
  linea(`Menor: ${informe.materialesUtilizadosMenor || '-'}`);
  linea(`Ajenos: ${informe.materialesUtilizadosAjenos || '-'}`);
  linea(`Otros de Apoyo: ${informe.otrosDeApoyo || '-'}`);
  linea(`Personal Policial a cargo de: ${informe.personalPolicialACargoDe || '-'}`);
  linea(`Ministerio Publico oficiado por: ${informe.ministerioPublicoOficiadoPor || '-'}`);
  linea(`Otros datos de interes: ${informe.otrosDatosInteres || '-'}`);

  checkPageBreak(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Desarrollo del Informe', marginLeft, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const desarrolloLineas = doc.splitTextToSize(informe.desarrolloDelInforme || '-', contentWidth);
  for (const l of desarrolloLineas) {
    checkPageBreak(5);
    doc.text(l, marginLeft, y);
    y += 4.2;
  }
  y += 4;

  const tablaNomina = (titulo: string, filas: string[][], head: string[]) => {
    checkPageBreak(20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, marginLeft, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [head],
      body: filas.length > 0 ? filas : [head.map(() => '-')],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8 },
      margin: { left: marginLeft, right: marginRight },
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    y = doc.lastAutoTable.finalY + 6;
  };

  doc.setFontSize(8.5);
  tablaNomina('Nomina de Voluntarios — Conductores', informe.nominaConductores.map(c => [c.movil, c.conductor, c.codigo]), ['Movil', 'Conductor', 'Codigo']);
  tablaNomina('Nomina de Voluntarios — Combatientes', informe.nominaCombatientes.map(c => [c.movil, c.combatiente, c.codigo]), ['Movil', 'Combatiente', 'Codigo']);

  checkPageBreak(20);
  linea(`A Cargo: ${informe.nominaACargo || '-'}`);
  y += 6;
  doc.setDrawColor(0, 0, 0);
  doc.line(marginLeft, y, marginLeft + 70, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(informe.nominaFirma || '', marginLeft, y);
  y += 4;
  doc.text('Firma', marginLeft, y);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(
    'El Croquis del Lugar y la Prioridad de Rescate se completan a mano sobre esta hoja impresa.',
    marginLeft, pageHeight - 8
  );

  const nombreArchivo = `INFORME_DE_INCENDIO_${(informe.nServicio || 'sin_numero').replace(/[\\/]/g, '_')}_${(informe.fecha || '').replace(/\//g, '-')}.pdf`;
  doc.save(nombreArchivo);
}

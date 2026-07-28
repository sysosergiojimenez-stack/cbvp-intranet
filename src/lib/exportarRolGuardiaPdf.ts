import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];

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

async function cargarLogoBase64(): Promise<string | null> {
  return cargarImagenBase64('/insignia.jpg');
}

async function cargarEscudoBase64(): Promise<string | null> {
  return cargarImagenBase64('/escudo-cbvp.png');
}

function encabezado(doc: jsPDF, logo: string | null, escudo: string | null, subtitulo: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (escudo) {
    try {
      doc.addImage(escudo, 'PNG', 10, 6, 16, 18);
    } catch {
      /* ignore */
    }
  }
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', pageWidth - 10 - 18, 6, 18, 18);
    } catch {
      /* ignore */
    }
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(ORGANIZACION.nombreCompleto, pageWidth / 2, 10, { align: 'center' });
  doc.setFontSize(8.5);
  doc.text(ORGANIZACION.compania, pageWidth / 2, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(subtitulo, pageWidth / 2, 20, { align: 'center' });
  doc.setDrawColor(180, 30, 30);
  doc.setLineWidth(0.4);
  doc.line(10, 27, pageWidth - 10, 27);
}

function generarSemanas(anio: number, mes: number): (number | null)[][] {
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

function tablaCalendario(doc: jsPDF, anio: number, mes: number, diasMarcados: number[], startX: number, startY: number, ancho: number) {
  const semanas = generarSemanas(anio, mes);
  const marcados = new Set(diasMarcados);

  autoTable(doc, {
    startY,
    margin: { left: startX, right: doc.internal.pageSize.getWidth() - startX - ancho },
    tableWidth: ancho,
    head: [
      [{ content: `${MESES[mes - 1].slice(0, 3)}-${anio}`, colSpan: 7 }],
      DIAS_SEMANA.map((d) => d.slice(0, 1)),
    ],
    body: semanas.map((semana) => semana.map((d) => (d === null ? '' : String(d)))),
    theme: 'grid',
    styles: { fontSize: 4.5, cellPadding: 0.5, halign: 'center', valign: 'middle', lineWidth: 0.1 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 4.2 },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const val = Number(data.cell.raw);
        if (!isNaN(val) && marcados.has(val)) {
          data.cell.styles.fillColor = [200, 245, 210];
          data.cell.styles.textColor = [20, 120, 40];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
  return doc.lastAutoTable.finalY;
}

interface PersonalItem {
  id: string;
  codigo: string;
  nombre: string;
  radial: string;
  asignacion: string;
}

function tablaPersonalConCalendarios(
  doc: jsPDF,
  titulo: string,
  personal: PersonalItem[],
  anioInicio: number,
  mesInicio: number,
  diasInicio: number[],
  anioFin: number,
  mesFin: number,
  diasFin: number[],
  startY: number
) {
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 10, startY);
  const y = startY + 3;

  const anchoTabla = 108;
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: doc.internal.pageSize.getWidth() - 10 - anchoTabla },
    tableWidth: anchoTabla,
    head: [['N', 'Cod.', 'Radial', 'Personales', 'Asignacion']],
    body: personal.map((p, idx) => [String(idx + 1), p.codigo, p.radial || '-', p.nombre, p.asignacion || '-']),
    theme: 'grid',
    styles: { fontSize: 5.5, cellPadding: 0.8, lineWidth: 0.1 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 5.5 },
    columnStyles: { 0: { cellWidth: 5 }, 1: { cellWidth: 15 }, 2: { cellWidth: 12 }, 3: { cellWidth: 46 }, 4: { cellWidth: 30 } },
  });

  const anchoCal = 34;
  const separacion = 3;
  const xCal1 = 10 + anchoTabla + 5;
  const xCal2 = xCal1 + anchoCal + separacion;

  tablaCalendario(doc, anioInicio, mesInicio, diasInicio, xCal1, y, anchoCal);
  tablaCalendario(doc, anioFin, mesFin, diasFin, xCal2, y, anchoCal);

  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 4;
}

interface ListaItem {
  id: string;
  codigo: string;
  nombre: string;
  radial: string;
  asignacion: string;
  observaciones: string;
}

function tablaListaExtra(doc: jsPDF, titulo: string, items: ListaItem[], mostrarAsignacion: boolean, startY: number): number {
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 10, startY);

  const head = ['N', 'Cod.', 'Radial', 'Personales', ...(mostrarAsignacion ? ['Asignacion'] : []), 'Observaciones'];
  const body = items.map((p, idx) => [
    String(idx + 1),
    p.codigo,
    p.radial || '-',
    p.nombre,
    ...(mostrarAsignacion ? [p.asignacion || '-'] : []),
    p.observaciones || '-',
  ]);

  autoTable(doc, {
    startY: startY + 3,
    margin: { left: 10, right: 10 },
    head: [head],
    body: body.length > 0 ? body : [Array(head.length).fill('')],
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 0.8, lineWidth: 0.1 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 6 },
  });

  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 4;
}

interface Grupo {
  id: string;
  nombreGrupo: string;
  personal: PersonalItem[];
  diasInicio: number[];
  diasFin: number[];
}

export async function exportarRolGuardiaPdf(params: {
  mesInicio: number;
  anioInicio: number;
  mesFin: number;
  anioFin: number;
  grupos: Grupo[];
  especiales: ListaItem[];
  licencias: ListaItem[];
  activos: ListaItem[];
}) {
  const logo = await cargarLogoBase64();
  const escudo = await cargarEscudoBase64();
  const subtitulo = `ROL DE GUARDIA - ${MESES[params.mesInicio - 1]} ${params.anioInicio} / ${MESES[params.mesFin - 1]} ${params.anioFin}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  let cursorY = 0;

  encabezado(doc, logo, escudo, subtitulo);
  cursorY = 32;

  const asegurarEspacio = (alturaEstim: number) => {
    if (cursorY + alturaEstim > pageHeight - 10) {
      doc.addPage('a4', 'portrait');
      encabezado(doc, logo, escudo, subtitulo);
      cursorY = 32;
    }
  };

  for (const grupo of params.grupos) {
    asegurarEspacio(30);
    cursorY = tablaPersonalConCalendarios(
      doc,
      grupo.nombreGrupo,
      grupo.personal,
      params.anioInicio,
      params.mesInicio,
      grupo.diasInicio,
      params.anioFin,
      params.mesFin,
      grupo.diasFin,
      cursorY
    );
  }

  asegurarEspacio(20);
  cursorY = tablaListaExtra(doc, 'Guardias Especiales', params.especiales, true, cursorY);
  asegurarEspacio(20);
  cursorY = tablaListaExtra(doc, 'Licencias', params.licencias, false, cursorY);
  asegurarEspacio(20);
  cursorY = tablaListaExtra(doc, 'Activos', params.activos, true, cursorY);

  const nombreArchivo = `Rol_de_Guardia_${MESES[params.mesInicio - 1]}_${MESES[params.mesFin - 1]}_${params.anioFin}.pdf`;
  doc.save(nombreArchivo);
}

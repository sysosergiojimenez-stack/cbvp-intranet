import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// escudo (nuevo) va a la izquierda, logo/insignia (el que ya teniamos) va a la derecha
function encabezado(doc: jsPDF, logo: string | null, escudo: string | null, subtitulo: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (escudo) {
    try {
      doc.addImage(escudo, 'PNG', 10, 8, 19.7, 22);
    } catch {
      /* ignore */
    }
  }
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', pageWidth - 10 - 22, 8, 22, 22);
    } catch {
      /* ignore */
    }
  }
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Cuerpo de Bomberos Voluntarios del Paraguay', pageWidth / 2, 13, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Vigesima Compania Capital "Mercado 4"', pageWidth / 2, 19, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('"Sirviendo a quienes sirven con su trabajo"', pageWidth / 2, 24, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitulo, pageWidth / 2, 30, { align: 'center' });
  doc.setDrawColor(180, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(10, 33, pageWidth - 10, 33);
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
      [{ content: `${MESES[mes - 1]}-${anio}`, colSpan: 7 }],
      DIAS_SEMANA,
    ],
    body: semanas.map((semana) => semana.map((d) => (d === null ? '' : String(d)))),
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 6 },
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
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 10, startY);
  const y = startY + 4;

  const anchoTabla = 155;
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: doc.internal.pageSize.getWidth() - 10 - anchoTabla },
    tableWidth: anchoTabla,
    head: [['N°', 'Cod.', 'Radial', 'Personales', 'Asignacion']],
    body: personal.map((p, idx) => [String(idx + 1), p.codigo, p.radial || '-', p.nombre, p.asignacion || '-']),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 7 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 2: { cellWidth: 16 }, 3: { cellWidth: 65 }, 4: { cellWidth: 44 } },
  });

  const anchoCal = 55;
  const separacion = 6;
  const xCal1 = 10 + anchoTabla + 10;
  const xCal2 = xCal1 + anchoCal + separacion;

  tablaCalendario(doc, anioInicio, mesInicio, diasInicio, xCal1, y, anchoCal);
  tablaCalendario(doc, anioFin, mesFin, diasFin, xCal2, y, anchoCal);

  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 10;
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
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 10, startY);

  const head = ['N°', 'Cod.', 'Radial', 'Personales', ...(mostrarAsignacion ? ['Asignacion'] : []), 'Observaciones'];
  const body = items.map((p, idx) => [
    String(idx + 1),
    p.codigo,
    p.radial || '-',
    p.nombre,
    ...(mostrarAsignacion ? [p.asignacion || '-'] : []),
    p.observaciones || '-',
  ]);

  autoTable(doc, {
    startY: startY + 4,
    margin: { left: 10, right: 10 },
    head: [head],
    body: body.length > 0 ? body : [Array(head.length).fill('')],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 8 },
  });

  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 10;
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

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let cursorY = 0;
  let primera = true;

  for (const grupo of params.grupos) {
    if (!primera) doc.addPage('a4', 'landscape');
    primera = false;
    encabezado(doc, logo, escudo, subtitulo);
    cursorY = 40;
    tablaPersonalConCalendarios(
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

  // Pagina final: Guardias Especiales, Licencias y Activos
  doc.addPage('a4', 'landscape');
  encabezado(doc, logo, escudo, subtitulo);
  cursorY = 40;
  cursorY = tablaListaExtra(doc, 'Guardias Especiales', params.especiales, true, cursorY);
  if (cursorY > 150) { doc.addPage('a4', 'landscape'); encabezado(doc, logo, escudo, subtitulo); cursorY = 40; }
  cursorY = tablaListaExtra(doc, 'Licencias', params.licencias, false, cursorY);
  if (cursorY > 150) { doc.addPage('a4', 'landscape'); encabezado(doc, logo, escudo, subtitulo); cursorY = 40; }
  cursorY = tablaListaExtra(doc, 'Activos', params.activos, true, cursorY);

  const nombreArchivo = `Rol_de_Guardia_${MESES[params.mesInicio - 1]}_${MESES[params.mesFin - 1]}_${params.anioFin}.pdf`;
  doc.save(nombreArchivo);
}

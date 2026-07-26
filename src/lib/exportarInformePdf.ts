import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

async function cargarLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch('/insignia.jpg');
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

function encabezado(doc: jsPDF, logo: string | null, subtitulo: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', 10, 8, 22, 22);
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

interface FilaDias {
  codigo: string;
  nombre: string;
  situ?: string;
  dias: string[];
  porcentaje: number;
}

function tablaDias(doc: jsPDF, titulo: string, filas: FilaDias[], columnas: number[], startY: number, mostrarSitu: boolean): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 10, startY);

  const head = [['Cod.', 'Nombre', ...(mostrarSitu ? ['SITU'] : []), ...columnas.map(String), '%']];
  const body = filas.map((f) => [
    f.codigo,
    f.nombre,
    ...(mostrarSitu ? [f.situ || ''] : []),
    ...f.dias,
    `${f.porcentaje}%`,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: startY + 3,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 6 },
    columnStyles: { 1: { halign: 'left', cellWidth: 30 } },
    margin: { left: 10, right: 10 },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const val = data.cell.raw;
        if (val === 'P') {
          data.cell.styles.fillColor = [200, 245, 210];
          data.cell.styles.textColor = [20, 120, 40];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'A') {
          data.cell.styles.fillColor = [250, 210, 210];
          data.cell.styles.textColor = [160, 20, 20];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
  return doc.lastAutoTable.finalY + 8;
}

interface FilaTotal {
  codigo: string;
  nombre: string;
  situ: string;
  cuota: string;
  guardiasPercent: number;
  practicasPercent: number | null;
  citacionesPercent: number | null;
  acumulado: number | string;
}

interface ResumenCuadro {
  regimenNormal: number;
  regimenEspecial: number;
  b10a: number;
  b15a: number;
  b20a: number;
  comisionados: number;
  enCuadro: number;
  licencia: number;
  fueraDeCuadro: number;
  total: number;
}

export async function exportarInformePdf(params: {
  mes: number;
  anio: number;
  categoria: 'COMBATIENTE' | 'ACTIVO';
  resumen: ResumenCuadro | null;
  guardiasNormales: FilaDias[];
  guardiasEspeciales: FilaDias[];
  diasDelMes: number;
  practicas: FilaDias[];
  sabados: number[];
  citaciones: FilaDias[];
  fechasCitacion: number[];
  sinCitaciones: boolean;
  totalAcumulado: FilaTotal[];
}) {
  const logo = await cargarLogoBase64();
  const nombreMes = MESES[params.mes - 1];
  const subtitulo = `Informe de Asistencia - ${params.categoria === 'COMBATIENTE' ? 'Bomberos Voluntarios Combatientes' : 'Bomberos Voluntarios Activos'} - ${nombreMes} ${params.anio}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let cursorY = 0;

  if (params.resumen) {
    encabezado(doc, logo, subtitulo);
    cursorY = 42;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de Cuadro de Servicio', 10, cursorY);
    cursorY += 5;

    autoTable(doc, {
      startY: cursorY,
      head: [['Especificaciones', 'Cantidad']],
      body: [
        ['Voluntarios en Cuadro de Servicio Regimen Normal', String(params.resumen.regimenNormal)],
        ['Voluntarios en Cuadro de Servicio Regimen Especial', String(params.resumen.regimenEspecial)],
        ['Con Beneficios - 10 anios', String(params.resumen.b10a)],
        ['Con Beneficios - 15 anios', String(params.resumen.b15a)],
        ['Con Beneficios - 20 anios', String(params.resumen.b20a)],
        ['Comisionados', String(params.resumen.comisionados)],
        ['TOTAL EN CUADRO DE SERVICIO', String(params.resumen.enCuadro)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [180, 30, 30], textColor: 255 },
      margin: { left: 10, right: 60 },
    });
    // @ts-expect-error lastAutoTable
    cursorY = doc.lastAutoTable.finalY + 5;

    autoTable(doc, {
      startY: cursorY,
      head: [['Especificaciones', 'Cantidad']],
      body: [
        ['Voluntarios con Licencia', String(params.resumen.licencia)],
        ['Voluntarios fuera del Cuadro de Servicio', String(params.resumen.fueraDeCuadro)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [180, 30, 30], textColor: 255 },
      margin: { left: 10, right: 60 },
    });
    // @ts-expect-error lastAutoTable
    cursorY = doc.lastAutoTable.finalY + 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 30, 30);
    doc.text(`TOTALIZAN ${params.resumen.total} VOLUNTARIOS EN NOMINA DEL CUARTEL`, 10, cursorY);
    doc.setTextColor(0, 0, 0);
  }

  doc.addPage('a4', 'landscape');
  encabezado(doc, logo, subtitulo);
  cursorY = 42;

  if (params.categoria === 'ACTIVO') {
    tablaDias(doc, 'Asistencia Activos', params.guardiasNormales, Array.from({ length: params.diasDelMes }, (_, i) => i + 1), cursorY, true);
  } else {
    tablaDias(doc, 'Guardias Normales', params.guardiasNormales, Array.from({ length: params.diasDelMes }, (_, i) => i + 1), cursorY, true);

    if (params.guardiasEspeciales.length > 0) {
      doc.addPage('a4', 'landscape');
      encabezado(doc, logo, subtitulo);
      cursorY = 42;
      tablaDias(doc, 'Guardias Especiales', params.guardiasEspeciales, Array.from({ length: params.diasDelMes }, (_, i) => i + 1), cursorY, true);
    }
  }

  if (params.categoria === 'COMBATIENTE') {
    doc.addPage('a4', 'portrait');
    encabezado(doc, logo, subtitulo);
    cursorY = 42;
    tablaDias(doc, 'Practicas (sabados del mes)', params.practicas, params.sabados, cursorY, false);
  }

  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subtitulo);
  cursorY = 42;
  const tituloCitaciones = `Citaciones${params.sinCitaciones ? ' (NO HUBO)' : ''}`;
  tablaDias(doc, tituloCitaciones, params.citaciones, params.fechasCitacion, cursorY, false);

  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subtitulo);
  cursorY = 42;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Acumulado', 10, cursorY);

  const esActivoAcumulado = params.categoria === 'ACTIVO';
  autoTable(doc, {
    startY: cursorY + 3,
    head: [[
      'Cod.', 'Nombre', 'SITU',
      esActivoAcumulado ? 'Asistencia' : 'Guardias',
      ...(esActivoAcumulado ? [] : ['Practicas']),
      'Citaciones', 'Acumulado', 'Cuota',
    ]],
    body: params.totalAcumulado.map((f) => [
      f.codigo,
      f.nombre,
      f.situ,
      `${f.guardiasPercent}%`,
      ...(esActivoAcumulado ? [] : [f.practicasPercent === null ? '-' : `${f.practicasPercent}%`]),
      f.citacionesPercent === null ? '-' : `${f.citacionesPercent}%`,
      typeof f.acumulado === 'string' ? f.acumulado : `${f.acumulado}%`,
      f.cuota || '-',
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 7 },
    margin: { left: 10, right: 10 },
  });

  const nombreArchivo = `Informe_Asistencia_${params.categoria}_${nombreMes}_${params.anio}.pdf`;
  doc.save(nombreArchivo);
}

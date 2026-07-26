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

function tablaTotalAcumulado(doc: jsPDF, filas: FilaTotal[], startY: number, esActivo: boolean): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Acumulado', 10, startY);

  autoTable(doc, {
    startY: startY + 3,
    head: [[
      'Cod.', 'Nombre', 'SITU',
      esActivo ? 'Asistencia' : 'Guardias',
      ...(esActivo ? [] : ['Practicas']),
      'Citaciones', 'Acumulado', 'Cuota',
    ]],
    body: filas.map((f) => [
      f.codigo,
      f.nombre,
      f.situ,
      `${f.guardiasPercent}%`,
      ...(esActivo ? [] : [f.practicasPercent === null ? '-' : `${f.practicasPercent}%`]),
      f.citacionesPercent === null ? '-' : `${f.citacionesPercent}%`,
      typeof f.acumulado === 'string' ? f.acumulado : `${f.acumulado}%`,
      f.cuota || '-',
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 7 },
    margin: { left: 10, right: 10 },
  });

  // @ts-expect-error lastAutoTable
  return doc.lastAutoTable.finalY + 8;
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

interface DatosCategoria {
  guardiasNormales: FilaDias[];
  guardiasEspeciales: FilaDias[];
  diasDelMes: number;
  practicas: FilaDias[];
  sabados: number[];
  citaciones: FilaDias[];
  fechasCitacion: number[];
  sinCitaciones: boolean;
  totalAcumulado: FilaTotal[];
}

interface EstadisticaServicio {
  tipo: string;
  cantidad: number;
}

export async function exportarInformeCombinado(params: {
  mes: number;
  anio: number;
  resumen: ResumenCuadro | null;
  combatiente: DatosCategoria;
  activo: DatosCategoria;
  estadisticasServicios: EstadisticaServicio[];
  totalServicios: number;
}) {
  const logo = await cargarLogoBase64();
  const nombreMes = MESES[params.mes - 1];
  const subBase = `Informe Mensual - ${nombreMes} ${params.anio}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let cursorY = 0;

  // ---- 1. Portada: resumen de cuadro de servicio ----
  if (params.resumen) {
    encabezado(doc, logo, subBase);
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

  const subCombatiente = `${subBase} - Bomberos Voluntarios Combatientes`;
  const subActivo = `${subBase} - Bomberos Voluntarios Activos`;

  // ---- 2. Guardias Combatientes (Normales + Especiales) ----
  doc.addPage('a4', 'landscape');
  encabezado(doc, logo, subCombatiente);
  cursorY = 42;
  const diasArr = Array.from({ length: params.combatiente.diasDelMes }, (_, i) => i + 1);
  tablaDias(doc, 'Guardias Normales', params.combatiente.guardiasNormales, diasArr, cursorY, true);

  if (params.combatiente.guardiasEspeciales.length > 0) {
    doc.addPage('a4', 'landscape');
    encabezado(doc, logo, subCombatiente);
    cursorY = 42;
    tablaDias(doc, 'Guardias Especiales', params.combatiente.guardiasEspeciales, diasArr, cursorY, true);
  }

  // ---- 3. Practicas Combatientes ----
  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subCombatiente);
  cursorY = 42;
  tablaDias(doc, 'Practicas (sabados del mes)', params.combatiente.practicas, params.combatiente.sabados, cursorY, false);

  // ---- 4. Citaciones Combatientes ----
  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subCombatiente);
  cursorY = 42;
  const tituloCitCombatiente = `Citaciones${params.combatiente.sinCitaciones ? ' (NO HUBO)' : ''}`;
  tablaDias(doc, tituloCitCombatiente, params.combatiente.citaciones, params.combatiente.fechasCitacion, cursorY, false);

  // ---- 5. Total Acumulado Combatientes ----
  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subCombatiente);
  cursorY = 42;
  tablaTotalAcumulado(doc, params.combatiente.totalAcumulado, cursorY, false);

  // ---- 6. Asistencia Activos ----
  doc.addPage('a4', 'landscape');
  encabezado(doc, logo, subActivo);
  cursorY = 42;
  const diasArrActivo = Array.from({ length: params.activo.diasDelMes }, (_, i) => i + 1);
  tablaDias(doc, 'Asistencia Activos', params.activo.guardiasNormales, diasArrActivo, cursorY, true);

  // ---- 7. Citaciones Activos ----
  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subActivo);
  cursorY = 42;
  const tituloCitActivo = `Citaciones${params.activo.sinCitaciones ? ' (NO HUBO)' : ''}`;
  tablaDias(doc, tituloCitActivo, params.activo.citaciones, params.activo.fechasCitacion, cursorY, false);

  // ---- 8. Total Acumulado (resumen general) Activos ----
  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subActivo);
  cursorY = 42;
  tablaTotalAcumulado(doc, params.activo.totalAcumulado, cursorY, true);

  // ---- 9. Estadisticas de Servicios ----
  doc.addPage('a4', 'portrait');
  encabezado(doc, logo, subBase);
  cursorY = 42;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Estadisticas de Servicios', 10, cursorY);
  cursorY += 5;

  autoTable(doc, {
    startY: cursorY,
    head: [['Tipo de Servicio', 'Cantidad']],
    body: [
      ...params.estadisticasServicios.map((e) => [e.tipo, String(e.cantidad)]),
      ['Total', String(params.totalServicios)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255 },
    margin: { left: 10, right: 60 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === params.estadisticasServicios.length) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const nombreArchivo = `Informe_Mensual_${nombreMes}_${params.anio}.pdf`;
  doc.save(nombreArchivo);
}

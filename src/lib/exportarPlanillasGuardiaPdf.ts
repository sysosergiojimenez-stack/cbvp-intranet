import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';

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

interface PersonalItem {
  codigo: string;
  nombre: string;
  asignacion: string;
}

function formatearFecha(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function dibujarPlanillaDia(doc: jsPDF, logo: string | null, nombreGrupo: string, fecha: Date, personal: PersonalItem[]) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- Encabezado ----
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 10, 7, 20, 20);
    } catch {
      /* ignore */
    }
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(ORGANIZACION.nombreCompleto.toUpperCase(), 33, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(ORGANIZACION.compania, 33, 15);
  doc.text(ORGANIZACION.direccion, 33, 19);
  doc.text(`Email: ${ORGANIZACION.email}  -  Tel: ${ORGANIZACION.telefono}`, 33, 23);

  let y = 30;

  // ---- Titulo ----
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(10, y, pageWidth - 20, 8);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`PLANILLA DE GUARDIA: ${nombreGrupo.toUpperCase()}   FECHA: ${formatearFecha(fecha)}`, pageWidth / 2, y + 5.5, { align: 'center' });
  y += 12;

  // ---- GUARDIA NORMAL ----
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('GUARDIA NORMAL', 10, y + 4);
  y += 6;

  const filasMinimo = Math.max(personal.length, 9);
  const filasGuardiaNormal = Array.from({ length: filasMinimo }, (_, i) => {
    const p = personal[i];
    return [
      String(i + 1),
      p ? p.codigo : '',
      p ? p.nombre : '',
      p ? p.asignacion || '' : '',
      '', // entrada
      '', // salida
      '', // firma
      '', // reemplazante cod
      '', // reemplazante personal
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [
      [
        { content: 'N°', rowSpan: 2 },
        { content: 'Cod.', rowSpan: 2 },
        { content: 'Personal', rowSpan: 2 },
        { content: 'Asignacion', rowSpan: 2 },
        { content: 'Horario', colSpan: 2 },
        { content: 'Firma', rowSpan: 2 },
        { content: 'Reemplazante', colSpan: 2 },
      ],
      ['Entrada', 'Salida', 'Cod.', 'Personal'],
    ],
    body: filasGuardiaNormal,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1, halign: 'center', valign: 'middle', lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontSize: 6, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 18 },
      2: { cellWidth: 48, halign: 'left' },
      3: { cellWidth: 24 },
      4: { cellWidth: 13 },
      5: { cellWidth: 13 },
      6: { cellWidth: 16 },
      7: { cellWidth: 14 },
      8: { cellWidth: 37, halign: 'left' },
    },
  });

  // @ts-expect-error lastAutoTable
  y = doc.lastAutoTable.finalY + 5;

  // ---- GUARDIAS ESPECIALES + MOVILES ----
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('GUARDIAS ESPECIALES', 10, y);
  doc.text('MOVILES', pageWidth - 55, y);
  y += 2;

  const anchoEspeciales = 139;

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 55 },
    tableWidth: anchoEspeciales,
    head: [['N°', 'Cod', 'Personal', 'Asignacion', 'Entrada', 'Salida', 'Firma']],
    body: Array.from({ length: 4 }, (_, i) => [String(i + 1), '', '', '', '', '', '']),
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center', lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontSize: 6, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 18 }, 2: { cellWidth: 48, halign: 'left' }, 3: { cellWidth: 24 }, 4: { cellWidth: 13 }, 5: { cellWidth: 13 }, 6: { cellWidth: 16 } },
  });
  // @ts-expect-error lastAutoTable
  const finEspeciales = doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth - 55, right: 10 },
    tableWidth: 45,
    head: [['Cod', 'Situacion']],
    body: [
      ['AB-202', '[ ] 10:78\n[ ] 10:79'],
      ['AR-203', '[ ] 10:77\n[ ] 10:78'],
      ['', '[ ] 10:78\n[ ] 10:79'],
      ['', '[ ] 10:78\n[ ] 10:79'],
    ],
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, halign: 'center', lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontSize: 6, fontStyle: 'bold' },
  });
  // @ts-expect-error lastAutoTable
  const finMoviles = doc.lastAutoTable.finalY;

  y = Math.max(finEspeciales, finMoviles) + 5;

  // ---- REFUERZOS + RADIO OPERADORES ALFA ----
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('REFUERZOS', 10, y);
  doc.text('RADIO OPERADORES ALFA', pageWidth - 55, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 55 },
    tableWidth: anchoEspeciales,
    head: [['N°', 'Cod', 'Personal', 'Asignacion', 'Entrada', 'Salida', 'Firma']],
    body: Array.from({ length: 4 }, (_, i) => [String(i + 1), '', '', '', '', '', '']),
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center', lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontSize: 6, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 18 }, 2: { cellWidth: 48, halign: 'left' }, 3: { cellWidth: 24 }, 4: { cellWidth: 13 }, 5: { cellWidth: 13 }, 6: { cellWidth: 16 } },
  });
  // @ts-expect-error lastAutoTable
  const finRefuerzos = doc.lastAutoTable.finalY;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(150, 150, 150);
  doc.line(pageWidth - 55, y + 12, pageWidth - 12, y + 12);
  doc.line(pageWidth - 55, y + 20, pageWidth - 12, y + 20);

  y = finRefuerzos + 5;

  // ---- NOVEDADES DE LA GUARDIA ----
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NOVEDADES DE LA GUARDIA', 10, y);
  y += 2;
  const altoObs = 20;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(10, y, pageWidth - 20, altoObs);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Obs.:', 12, y + 4);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.15);
  for (let i = 1; i <= 3; i++) {
    doc.line(12, y + 4 + i * 4.5, pageWidth - 12, y + 4 + i * 4.5);
  }
  y += altoObs + 5;

  // ---- REFERENCIAS ----
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('REFERENCIAS:', 10, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    body: [
      ['ACACR = AUSENTE CON AVISO CON REEMPLAZO', 'ASASR = AUSENTE SIN AVISO SIN REEMPLAZO'],
      ['ACASR = AUSENTE CON AVISO SIN REEMPLAZO', ''],
    ],
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, lineWidth: 0.1 },
  });
  // @ts-expect-error lastAutoTable
  y = doc.lastAutoTable.finalY + 6;

  // ---- Horarios e Inicio/Fin ----
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Inicio la Guardia :        :        Hs.', 10, y);
  y += 5;
  doc.text('Finaliza la Guardia:        :        Hs.', 10, y);
  y += 8;

  // ---- Firmas ----
  doc.setFontSize(7.5);
  doc.text('Director de Semana   :', 10, y);
  y += 6;
  doc.text('Comandante de Semana:', 10, y);
  y += 6;
  doc.text('Oficial K20            :', 10, y);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(pageWidth - 75, y - 2, pageWidth - 12, y - 2);
  doc.setFontSize(7);
  doc.text('Firma a Cargo de Guardia', pageWidth - 43.5, y + 2, { align: 'center' });
}

export async function exportarPlanillasGuardiaPdf(params: {
  nombreGrupo: string;
  personal: PersonalItem[];
  fechas: Date[];
}) {
  const logo = await cargarImagenBase64('/insignia.png');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let primera = true;
  for (const fecha of params.fechas) {
    if (!primera) doc.addPage('a4', 'portrait');
    primera = false;
    dibujarPlanillaDia(doc, logo, params.nombreGrupo, fecha, params.personal);
  }

  const nombreArchivo = `Planillas_Guardia_${params.nombreGrupo.replace(/\s+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}

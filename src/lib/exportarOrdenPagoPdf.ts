import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';
import { LABEL_TIPO_MOVIMIENTO, type TipoMovimientoOrdenPago } from '@contracts/ordenesPago';

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

async function cargarInsigniaBase64(): Promise<string | null> {
  return cargarImagenBase64('/insignia.jpg');
}

function normalizarNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Las firmas escaneadas solo se estampan automaticamente cuando el nombre
// cargado en la orden coincide con la persona de la firma (por apellido),
// para no poner la firma de alguien en una orden firmada por otra persona.
// Si no coincide, se deja la linea en blanco para firmar a mano como antes.
const FIRMAS_CONOCIDAS: { apellido: string; archivo: string }[] = [
  { apellido: 'cespedes', archivo: '/firma-comandante.png' },
  { apellido: 'riveros', archivo: '/firma-director.png' },
];

async function cargarFirmaSiCorresponde(nombre: string): Promise<string | null> {
  const normalizado = normalizarNombre(nombre);
  const match = FIRMAS_CONOCIDAS.find((f) => normalizado.includes(f.apellido));
  if (!match) return null;
  return cargarImagenBase64(match.archivo);
}

function formatearMiles(valor: number): string {
  return Number.isFinite(valor) ? Math.round(valor).toLocaleString('es-PY') : '0';
}

export interface DetalleOrdenPago {
  descripcion: string;
  bancoAlias: string;
  nroCuenta: string;
  monto: number;
}

export interface OrdenPagoExport {
  numero: number;
  anio: number;
  fecha: string;
  bancoNombre: string;
  bancoCuenta: string;
  tipoMovimiento: TipoMovimientoOrdenPago;
  detalle: DetalleOrdenPago[];
  total: number;
  observaciones: string;
  comandanteNombre: string;
  directorNombre: string;
}

export async function exportarOrdenPagoPdf(orden: OrdenPagoExport) {
  const [insignia, firmaComandante, firmaDirector] = await Promise.all([
    cargarInsigniaBase64(),
    cargarFirmaSiCorresponde(orden.comandanteNombre || ''),
    cargarFirmaSiCorresponde(orden.directorNombre || ''),
  ]);
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  const y0 = 10;
  if (insignia) {
    try {
      const props = doc.getImageProperties(insignia);
      const ratio = props.width / props.height || 1;
      const h = 20;
      const w = h * ratio;
      doc.addImage(insignia, 'JPEG', 12, y0, w, h);
    } catch {
      /* ignore */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ORDEN DE PAGO', pageWidth / 2, y0 + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(ORGANIZACION.nombreCompleto, pageWidth / 2, y0 + 13, { align: 'center' });

  // Caja OP Nr / Fecha, arriba a la derecha
  const cajaW = 48;
  const cajaX = pageWidth - 12 - cajaW;
  doc.setDrawColor(120, 120, 120);
  doc.setFillColor(240, 240, 240);
  doc.rect(cajaX, y0, cajaW, 20, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('OP Nr:', cajaX + 3, y0 + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${orden.numero}/${orden.anio}`, cajaX + 20, y0 + 6);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', cajaX + 3, y0 + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(orden.fecha, cajaX + 20, y0 + 14);

  let y = y0 + 25;
  doc.setDrawColor(180, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(10, y, pageWidth - 10, y);
  y += 6;

  // Banner de la compania
  doc.setFillColor(20, 20, 20);
  doc.rect(10, y, pageWidth - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(ORGANIZACION.compania.toUpperCase(), pageWidth / 2, y + 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 12;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2 },
    body: [
      [
        { content: 'Banco de la Compania', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, orden.bancoNombre || '-',
        { content: 'Nr. de cuenta', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, orden.bancoCuenta || '-',
      ],
      [
        { content: 'Tipo de movimiento', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } },
        { content: LABEL_TIPO_MOVIMIENTO[orden.tipoMovimiento] || orden.tipoMovimiento, colSpan: 3 },
      ],
    ],
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 53 }, 2: { cellWidth: 38 }, 3: { cellWidth: 57 } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
  y = doc.lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DETALLE DEL CONCEPTO / OBJETO DE PAGO', 10, y);

  autoTable(doc, {
    startY: y + 2,
    theme: 'grid',
    head: [['N°', 'Descripcion / Concepto', 'Banco / Alias', 'Nr. Cuenta', 'Monto (Gs.)']],
    body: orden.detalle.map((d, i) => [
      String(i + 1),
      d.descripcion || '-',
      d.bancoAlias || '-',
      d.nroCuenta || '-',
      formatearMiles(d.monto),
    ]),
    foot: [[
      { content: 'TOTAL:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] } },
      { content: formatearMiles(orden.total), styles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] } },
    ]],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    footStyles: { textColor: [0, 0, 0] },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 4: { halign: 'right', cellWidth: 30 } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable
  y = doc.lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('OBSERVACIONES', 10, y);
  y += 2;
  doc.setDrawColor(0);
  doc.rect(10, y, pageWidth - 20, 16);
  if (orden.observaciones) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lineas = doc.splitTextToSize(orden.observaciones, pageWidth - 26);
    doc.text(lineas, 13, y + 5);
  }
  y += 28;

  // Firmas
  const colW = (pageWidth - 20) / 2;
  const xIzq = 10;
  const xDer = 10 + colW;

  // Si el nombre cargado coincide con una firma conocida, se estampa la
  // imagen escaneada apoyada sobre la linea (como una firma real); si no,
  // la linea queda en blanco para firmar a mano.
  const dibujarFirma = (firma: string | null, xCentro: number) => {
    if (!firma) return;
    try {
      const props = doc.getImageProperties(firma);
      const ratio = props.width / props.height || 1;
      const alto = 9;
      const ancho = Math.min(alto * ratio, 42);
      doc.addImage(firma, 'PNG', xCentro - ancho / 2, y - alto - 0.5, ancho, alto);
    } catch {
      /* ignore */
    }
  };
  dibujarFirma(firmaComandante, xIzq + colW / 2);
  dibujarFirma(firmaDirector, xDer + colW / 2);

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(xIzq + 10, y, xIzq + colW - 10, y);
  doc.line(xDer + 10, y, xDer + colW - 10, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('COMANDANTE O PRESIDENTE', xIzq + colW / 2, y, { align: 'center' });
  doc.text('DIRECTOR ADMINISTRATIVO O TESORERO', xDer + colW / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(orden.comandanteNombre || '', xIzq + colW / 2, y, { align: 'center' });
  doc.text(orden.directorNombre || '', xDer + colW / 2, y, { align: 'center' });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Documento de uso interno - ${ORGANIZACION.compania} - Este formulario debe conservarse en los registros contables de la Compania.`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);

  const nombreArchivo = `Orden_de_Pago_${orden.numero}_${orden.anio}.pdf`;
  doc.save(nombreArchivo);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';

async function cargarInsigniaBase64(): Promise<string | null> {
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

function formatearNumero(valor: number): string {
  return valor.toLocaleString('es-PY', { maximumFractionDigits: 2 });
}

// Dibuja los 3 espacios de firma (Solicitado por / Aprobado por / Ejecutado
// por), cada uno con linea y etiqueta para Firma, Aclaracion y Cargo.
function dibujarFirmas(doc: jsPDF, yInicial: number, pageWidth: number): number {
  const margen = 15;
  const espacio = 10;
  const anchoColumna = (pageWidth - margen * 2 - espacio * 2) / 3;
  const titulos = ['1. SOLICITADO POR', '2. APROBADO POR', '3. EJECUTADO POR'];
  const campos = ['Firma', 'Aclaracion', 'Cargo'];

  let y = yInicial;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  titulos.forEach((titulo, i) => {
    const x = margen + i * (anchoColumna + espacio);
    doc.text(titulo, x, y);
  });

  y += 14;
  for (const campo of campos) {
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    for (let i = 0; i < 3; i++) {
      const x = margen + i * (anchoColumna + espacio);
      doc.line(x, y, x + anchoColumna, y);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    for (let i = 0; i < 3; i++) {
      const x = margen + i * (anchoColumna + espacio);
      doc.text(campo, x, y + 4);
    }
    doc.setTextColor(0, 0, 0);
    y += 16;
  }

  return y;
}

export interface ItemOrdenCompraExport {
  item: string;
  cantidad: number | null;
  // Precio unitario y nombre del proveedor que quedaron marcados para este
  // item. Si el item no fue marcado (o le falta cantidad/precio), ambos
  // llegan en null y el item se reporta como pendiente de asignar.
  precioSeleccionado: number | null;
  proveedorSeleccionado: string | null;
}

export interface GrupoOrdenCompraExport {
  nombre: string;
  items: ItemOrdenCompraExport[];
}

export interface OrdenCompraExport {
  nombre: string;
  grupos: GrupoOrdenCompraExport[];
  presupuesto?: number | null;
}

export async function exportarOrdenCompraPdf(orden: OrdenCompraExport) {
  const insignia = await cargarInsigniaBase64();
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

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
  doc.text('ORDEN DE COMPRA', pageWidth / 2, y0 + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(ORGANIZACION.nombreCompleto, pageWidth / 2, y0 + 13, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(orden.nombre, pageWidth / 2, y0 + 20, { align: 'center' });

  let y = y0 + 27;
  doc.setDrawColor(180, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(10, y, pageWidth - 10, y);
  y += 8;

  // Agrupa los items marcados por proveedor (preservando el orden de
  // aparicion). Los items sin proveedor marcado simplemente no entran.
  interface FilaProveedor { grupo: string; item: string; cantidad: number; precioUnitario: number; subtotal: number }
  const ordenProveedores: string[] = [];
  const porProveedor = new Map<string, FilaProveedor[]>();

  for (const grupo of orden.grupos) {
    for (const it of grupo.items) {
      if (!it.proveedorSeleccionado || it.cantidad === null || it.precioSeleccionado === null) {
        continue;
      }
      if (!porProveedor.has(it.proveedorSeleccionado)) {
        ordenProveedores.push(it.proveedorSeleccionado);
        porProveedor.set(it.proveedorSeleccionado, []);
      }
      porProveedor.get(it.proveedorSeleccionado)!.push({
        grupo: grupo.nombre,
        item: it.item || '-',
        cantidad: it.cantidad,
        precioUnitario: it.precioSeleccionado,
        subtotal: it.cantidad * it.precioSeleccionado,
      });
    }
  }

  for (const proveedor of ordenProveedores) {
    const filas = porProveedor.get(proveedor)!;
    const total = filas.reduce((acc, f) => acc + f.subtotal, 0);

    if (y > pageHeight - 45) {
      doc.addPage();
      y = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(180, 30, 30);
    doc.text(proveedor.toUpperCase(), 10, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Grupo', 'Item', 'Cantidad', 'Precio Unitario', 'Subtotal']],
      body: filas.map((f) => [
        f.grupo,
        f.item,
        { content: formatearNumero(f.cantidad), styles: { halign: 'right' as const } },
        { content: formatearNumero(f.precioUnitario), styles: { halign: 'right' as const } },
        { content: formatearNumero(f.subtotal), styles: { halign: 'right' as const } },
      ]),
      foot: [[
        { content: `TOTAL ${proveedor.toUpperCase()}:`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] } },
        { content: formatearNumero(total), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [230, 230, 230] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
      ]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [20, 20, 20], textColor: 255 },
      columnStyles: {
        2: { halign: 'right', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 30 },
      },
      margin: { left: 10, right: 10 },
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    y = doc.lastAutoTable.finalY + 10;
  }

  if (ordenProveedores.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No hay items marcados para esta orden de compra.', 10, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  if (y > pageHeight - 65) {
    doc.addPage();
    y = 20;
  } else {
    y += 10;
  }
  dibujarFirmas(doc, y, pageWidth);

  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Documento de uso interno - CBVP.', pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  const nombreArchivo = `OrdenCompra_${orden.nombre.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}

export interface ItemOrdenIndividualExport {
  grupo: string;
  item: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface OrdenIndividualExport {
  numero: number;
  nombreComparativo: string;
  proveedor: string;
  fechaGeneracion: string;
  estado: 'pendiente' | 'ejecutada' | 'anulada';
  monto: number;
  items: ItemOrdenIndividualExport[];
}

// Reimprime una orden de compra ya generada y guardada (una sola, con su
// numero), para poder descargarla de nuevo desde "Ordenes de Compra
// Generadas" sin tener que volver a generar todo el comparativo.
export async function exportarOrdenIndividualPdf(orden: OrdenIndividualExport) {
  const insignia = await cargarInsigniaBase64();
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

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
  doc.text(`ORDEN DE COMPRA N° ${orden.numero}`, pageWidth / 2, y0 + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(ORGANIZACION.nombreCompleto, pageWidth / 2, y0 + 13, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(orden.nombreComparativo, pageWidth / 2, y0 + 20, { align: 'center' });

  let y = y0 + 27;
  doc.setDrawColor(180, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(10, y, pageWidth - 10, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(180, 30, 30);
  doc.text(orden.proveedor.toUpperCase(), 10, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  const fecha = new Date(orden.fechaGeneracion).toLocaleDateString('es-PY');
  const etiquetaEstado = orden.estado === 'ejecutada' ? 'Ejecutada' : orden.estado === 'anulada' ? 'Anulada' : 'Pendiente';
  doc.text(`Fecha de generacion: ${fecha}  -  Estado: ${etiquetaEstado}`, 10, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Grupo', 'Item', 'Cantidad', 'Precio Unitario', 'Subtotal']],
    body: orden.items.map((f) => [
      f.grupo,
      f.item,
      { content: formatearNumero(f.cantidad), styles: { halign: 'right' as const } },
      { content: formatearNumero(f.precioUnitario), styles: { halign: 'right' as const } },
      { content: formatearNumero(f.subtotal), styles: { halign: 'right' as const } },
    ]),
    foot: [[
      { content: 'TOTAL:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] } },
      { content: formatearNumero(orden.monto), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [230, 230, 230] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
    ]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    columnStyles: {
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
  y = doc.lastAutoTable.finalY + 10;

  if (y > pageHeight - 65) {
    doc.addPage();
    y = 20;
  } else {
    y += 10;
  }
  dibujarFirmas(doc, y, pageWidth);

  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Documento de uso interno - CBVP.', pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  const nombreArchivo = `OrdenCompra_N${orden.numero}_${orden.proveedor.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}

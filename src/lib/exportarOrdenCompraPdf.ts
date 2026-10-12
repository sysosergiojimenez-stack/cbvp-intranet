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
  // aparicion) y junta aparte los que quedaron sin asignar.
  interface FilaProveedor { grupo: string; item: string; cantidad: number; precioUnitario: number; subtotal: number }
  const ordenProveedores: string[] = [];
  const porProveedor = new Map<string, FilaProveedor[]>();
  const sinAsignar: { grupo: string; item: string }[] = [];

  for (const grupo of orden.grupos) {
    for (const it of grupo.items) {
      if (!it.proveedorSeleccionado || it.cantidad === null || it.precioSeleccionado === null) {
        if (it.item.trim()) sinAsignar.push({ grupo: grupo.nombre, item: it.item || '-' });
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

  const totalesProveedor: { proveedor: string; total: number }[] = [];

  for (const proveedor of ordenProveedores) {
    const filas = porProveedor.get(proveedor)!;
    const total = filas.reduce((acc, f) => acc + f.subtotal, 0);
    totalesProveedor.push({ proveedor, total });

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

  if (sinAsignar.length > 0) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 15;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(200, 140, 20);
    doc.text('ITEMS SIN PROVEEDOR ASIGNADO', 10, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Grupo', 'Item']],
      body: sinAsignar.map((f) => [f.grupo, f.item]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [20, 20, 20], textColor: 255 },
      margin: { left: 10, right: 10 },
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    y = doc.lastAutoTable.finalY + 12;
  }

  // Pagina de resumen: total por proveedor, total general y el contraste
  // contra el presupuesto disponible si fue indicado.
  doc.addPage();
  y = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(180, 30, 30);
  doc.text('RESUMEN / TOTALES', pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 10;

  const totalGeneral = totalesProveedor.reduce((acc, p) => acc + p.total, 0);

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Proveedor', 'Total']],
    body: totalesProveedor.map((p) => [
      p.proveedor,
      { content: formatearNumero(p.total), styles: { halign: 'right' as const } },
    ]),
    foot: [[
      { content: 'TOTAL GENERAL:', styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] } },
      { content: formatearNumero(totalGeneral), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [230, 230, 230] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
    ]],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
  y = doc.lastAutoTable.finalY + 12;

  if (typeof orden.presupuesto === 'number') {
    const remanente = orden.presupuesto - totalGeneral;
    const esFaltante = remanente < 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CONTROL DE PRESUPUESTO', 10, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Presupuesto disponible', 'Total general', esFaltante ? 'Faltante' : 'Remanente']],
      body: [[
        { content: formatearNumero(orden.presupuesto), styles: { halign: 'right' as const } },
        { content: formatearNumero(totalGeneral), styles: { halign: 'right' as const } },
        {
          content: formatearNumero(Math.abs(remanente)),
          styles: {
            halign: 'right' as const,
            fontStyle: 'bold' as const,
            textColor: (esFaltante ? [200, 30, 30] : [20, 130, 60]) as [number, number, number],
          },
        },
      ]],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [20, 20, 20], textColor: 255 },
      columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 10, right: 10 },
    });
  }

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

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
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

async function generarQrDataUrl(url: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(url, { width: 120, margin: 0 });
  } catch {
    return null;
  }
}

export interface CotizacionComprasExport {
  proveedor: string;
  codigoProducto: string;
  nombreProducto: string;
  precio: number | null;
  url: string;
}

export interface ItemComprasExport {
  item: string;
  cantidad: number | null;
  cotizaciones: CotizacionComprasExport[];
}

export interface HojaComprasExport {
  nombre: string;
  items: ItemComprasExport[];
}

export interface ComparativoComprasExport {
  nombre: string;
  hojas: HojaComprasExport[];
}

// A diferencia del comparativo original (columnas fijas de proveedor por
// pestaña), aca cada item trae su propia lista de cotizaciones, asi que el
// PDF arma una tabla de cotizaciones por item en vez de una tabla por
// proveedor.
export async function exportarComparativoComprasPdf(comparativo: ComparativoComprasExport) {
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
  doc.text('COMPARATIVO DE PRECIOS', pageWidth / 2, y0 + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(ORGANIZACION.nombreCompleto, pageWidth / 2, y0 + 13, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(comparativo.nombre, pageWidth / 2, y0 + 20, { align: 'center' });

  let y = y0 + 27;
  doc.setDrawColor(180, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(10, y, pageWidth - 10, y);
  y += 10;

  // Cada pestaña va en su propia pagina, no todas juntas.
  let primeraHojaRenderizada = true;
  for (const hoja of comparativo.hojas) {
    const itemsConCotizaciones = hoja.items.filter((it) => it.cotizaciones.length > 0);
    if (itemsConCotizaciones.length === 0) continue;

    if (!primeraHojaRenderizada) {
      doc.addPage();
      y = 15;
    }
    primeraHojaRenderizada = false;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(180, 30, 30);
    doc.text(hoja.nombre.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 9;

    for (let idx = 0; idx < itemsConCotizaciones.length; idx++) {
      const item = itemsConCotizaciones[idx];

      if (y > pageHeight - 40) {
        doc.addPage();
        y = 15;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const cantidadTexto = item.cantidad !== null ? `  (Cantidad: ${formatearNumero(item.cantidad)})` : '';
      const lineasItem: string[] = doc.splitTextToSize(`${idx + 1}. ${item.item || 'Sin nombre'}${cantidadTexto}`, pageWidth - 20);
      for (const linea of lineasItem) {
        doc.text(linea, 10, y);
        y += 4.5;
      }
      y += 1;

      const precios = item.cotizaciones.map((c) => c.precio);
      const minimo = precios.some((p) => p !== null) ? Math.min(...precios.filter((p): p is number => p !== null)) : null;

      // QR por cotizacion con URL cargada: se generan antes de la tabla
      // porque la libreria es asincronica y el dibujo de celdas no lo es.
      const qrPorFila = await Promise.all(
        item.cotizaciones.map((c) => (c.url.trim() ? generarQrDataUrl(c.url.trim()) : Promise.resolve(null)))
      );

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Proveedor', 'Codigo', 'Producto', 'Precio Unitario', 'Costo Total', 'URL']],
        body: item.cotizaciones.map((c) => {
          const costoTotal = item.cantidad !== null && c.precio !== null ? item.cantidad * c.precio : null;
          const esMinimo = minimo !== null && c.precio === minimo;
          const estilo = esMinimo ? { fillColor: [20, 120, 60] as [number, number, number], textColor: 255 } : {};
          const tieneUrl = c.url.trim() !== '';
          return [
            { content: c.proveedor || '-', styles: estilo },
            { content: c.codigoProducto || '-', styles: estilo },
            { content: c.nombreProducto || '-', styles: estilo },
            { content: c.precio === null ? '-' : formatearNumero(c.precio), styles: { halign: 'right' as const, ...estilo } },
            { content: costoTotal === null ? '-' : formatearNumero(costoTotal), styles: { halign: 'right' as const, ...estilo } },
            // El contenido de texto se deja vacio cuando hay URL: el QR se
            // dibuja aparte en didDrawCell. minCellHeight le hace lugar.
            { content: tieneUrl ? '' : '-', styles: { halign: 'center' as const, minCellHeight: tieneUrl ? 18 : undefined, ...estilo } },
          ];
        }),
        styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fillColor: [20, 20, 20], textColor: 255 },
        columnStyles: {
          3: { cellWidth: 24 },
          4: { cellWidth: 24 },
          5: { cellWidth: 20 },
        },
        margin: { left: 10, right: 10 },
        // Dibuja el QR escaneable y agrega un enlace clickeable/seleccionable
        // sobre toda la celda para poder abrir la URL directamente desde el PDF.
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 5) return;
          const cot = item.cotizaciones[data.row.index];
          const url = cot?.url.trim();
          const qr = qrPorFila[data.row.index];
          if (!url || !qr) return;
          const size = Math.min(data.cell.height - 2, 16);
          const qx = data.cell.x + (data.cell.width - size) / 2;
          const qy = data.cell.y + 1;
          try {
            doc.addImage(qr, 'PNG', qx, qy, size, size);
          } catch {
            /* ignore */
          }
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
        },
      });
      // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
      y = doc.lastAutoTable.finalY + 6;
    }

    y += 2;
  }

  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Documento de uso interno - ${ORGANIZACION.compania}.`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  const nombreArchivo = `ComparativoCompras_${comparativo.nombre.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}

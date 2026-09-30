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

export interface ItemComparativoExport {
  item: string;
  cantidad: number | null;
  precios: (number | null)[];
}

export interface HojaComparativoExport {
  nombre: string;
  proveedores: string[];
  items: ItemComparativoExport[];
}

export interface ComparativoExport {
  nombre: string;
  hojas: HojaComparativoExport[];
}

export async function exportarComparativoPdf(comparativo: ComparativoExport) {
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
  y += 8;

  for (const hoja of comparativo.hojas) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(180, 30, 30);
    doc.text(hoja.nombre.toUpperCase(), 10, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    const totales = [0, 1, 2].map((idx) =>
      hoja.items.reduce((acc, it) => {
        const precio = it.precios[idx];
        if (it.cantidad === null || precio === null) return acc;
        return acc + it.cantidad * precio;
      }, 0)
    );
    const totalMinimo = totales.some((t) => t > 0) ? Math.min(...totales.filter((t) => t > 0)) : null;

    const body = hoja.items.map((it) => {
      const minimo = it.precios.some((v) => v !== null) ? Math.min(...(it.precios.filter((v): v is number => v !== null))) : null;
      return [
        it.item || '-',
        it.cantidad === null ? '-' : formatearNumero(it.cantidad),
        ...[0, 1, 2].map((idx) => {
          const valor = it.precios[idx];
          const esMinimo = minimo !== null && valor === minimo;
          return {
            content: valor === null ? '-' : formatearNumero(valor),
            styles: esMinimo ? { fontStyle: 'bold' as const, textColor: [20, 130, 60] as [number, number, number] } : {},
          };
        }),
      ];
    });

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Item', 'Cantidad', hoja.proveedores[0] || 'Proveedor 1', hoja.proveedores[1] || 'Proveedor 2', hoja.proveedores[2] || 'Proveedor 3']],
      body,
      foot: [[
        { content: 'TOTAL:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] } },
        ...[0, 1, 2].map((idx) => ({
          content: formatearNumero(totales[idx]),
          styles: {
            fontStyle: 'bold' as const,
            fillColor: [230, 230, 230] as [number, number, number],
            textColor: (totalMinimo !== null && totales[idx] === totalMinimo ? [20, 130, 60] : [0, 0, 0]) as [number, number, number],
          },
        })),
      ]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [20, 20, 20], textColor: 255 },
      columnStyles: {
        1: { halign: 'right', cellWidth: 20 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      margin: { left: 10, right: 10 },
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    y = doc.lastAutoTable.finalY + 10;
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

  const nombreArchivo = `Comparativo_${comparativo.nombre.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}

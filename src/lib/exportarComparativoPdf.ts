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
  // Codigo/descripcion propia de cada proveedor para este item (puede
  // diferir entre proveedores), alineado con el indice de "precios".
  itemProveedor: string[];
  cantidad: number | null;
  precios: (number | null)[];
}

export interface ProveedorComparativoExport {
  nombre: string;
  ruc: string;
  telefono: string;
  direccion: string;
  contacto: string;
}

export interface HojaComparativoExport {
  nombre: string;
  proveedores: ProveedorComparativoExport[];
  items: ItemComparativoExport[];
}

export interface ComparativoExport {
  nombre: string;
  hojas: HojaComparativoExport[];
}

function datosContacto(p: ProveedorComparativoExport): string {
  const partes: string[] = [];
  if (p.ruc.trim()) partes.push(`RUC: ${p.ruc.trim()}`);
  if (p.telefono.trim()) partes.push(`Tel: ${p.telefono.trim()}`);
  if (p.direccion.trim()) partes.push(`Direccion: ${p.direccion.trim()}`);
  if (p.contacto.trim()) partes.push(`Contacto: ${p.contacto.trim()}`);
  return partes.length > 0 ? ` (${partes.join(' - ')})` : '';
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
  y += 10;

  let primeraHojaRenderizada = true;
  for (const hoja of comparativo.hojas) {
    if (hoja.items.length === 0) continue;

    // Cada seccion (hoja/pestaña) va en su propia pagina, no todas juntas.
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

    for (let idx = 0; idx < hoja.proveedores.length; idx++) {
      const proveedor = hoja.proveedores[idx];
      if (!proveedor) continue;
      const nombreProveedor = proveedor.nombre.trim() || `Proveedor ${idx + 1}`;

      if (y > pageHeight - 45) {
        doc.addPage();
        y = 15;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const lineasHeader: string[] = doc.splitTextToSize(`PROVEEDOR ${idx + 1}: ${nombreProveedor}${datosContacto(proveedor)}`, pageWidth - 20);
      for (const linea of lineasHeader) {
        doc.text(linea, pageWidth / 2, y, { align: 'center' });
        y += 4.5;
      }
      y += 1;

      const total = hoja.items.reduce((acc, it) => {
        const precio = it.precios[idx];
        if (it.cantidad === null || precio === null) return acc;
        return acc + it.cantidad * precio;
      }, 0);

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        head: [['Ord', 'Item', 'Codigo y Descripcion del Proveedor', 'Cantidad', 'Precio Unitario', 'Costo Total']],
        body: hoja.items.map((it, i) => {
          const precio = it.precios[idx];
          const costoTotal = it.cantidad !== null && precio !== null ? it.cantidad * precio : null;
          return [
            String(i + 1),
            it.item || '-',
            it.itemProveedor[idx] || '-',
            { content: it.cantidad === null ? '-' : formatearNumero(it.cantidad), styles: { halign: 'right' as const } },
            { content: precio === null ? '-' : formatearNumero(precio), styles: { halign: 'right' as const } },
            { content: costoTotal === null ? '-' : formatearNumero(costoTotal), styles: { halign: 'right' as const } },
          ];
        }),
        foot: [[
          { content: 'TOTAL:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] } },
          { content: formatearNumero(total), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [230, 230, 230] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] } },
        ]],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [20, 20, 20], textColor: 255 },
        columnStyles: {
          0: { halign: 'right', cellWidth: 10 },
          3: { halign: 'right', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'right', cellWidth: 30 },
        },
        margin: { left: 10, right: 10 },
      });
      // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
      y = doc.lastAutoTable.finalY + 8;
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

  const nombreArchivo = `Comparativo_${comparativo.nombre.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';
import type { FilaInventarioExport } from './exportarMaterialMenorCsv';

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

function encabezado(doc: jsPDF, logo: string | null, escudo: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (escudo) {
    try { doc.addImage(escudo, 'PNG', 10, 8, 19.7, 22); } catch { /* ignore */ }
  }
  if (logo) {
    try { doc.addImage(logo, 'JPEG', pageWidth - 10 - 22, 8, 22, 22); } catch { /* ignore */ }
  }
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(ORGANIZACION.nombreCompleto, pageWidth / 2, 13, { align: 'center' });
  doc.setFontSize(11);
  doc.text(ORGANIZACION.compania, pageWidth / 2, 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Inventario de Material Menor', pageWidth / 2, 26, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(new Date().toLocaleDateString('es-ES'), pageWidth / 2, 31, { align: 'center' });
  doc.setTextColor(0);
  doc.setDrawColor(180, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(10, 34, pageWidth - 10, 34);
}

export async function exportarInventarioPdf(filas: FilaInventarioExport[]) {
  const [logo, escudo] = await Promise.all([
    cargarImagenBase64('/insignia.jpg'),
    cargarImagenBase64('/escudo-cbvp.png'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  autoTable(doc, {
    startY: 38,
    head: [['Categoria', 'Item', 'Marca / Modelo', 'Cantidad', 'Ubicacion', 'Tipo', 'Serial / Codigo', 'Precio Unit.']],
    body: filas.map((f) => [
      f.categoria,
      f.item,
      [f.marca, f.modelo].filter(Boolean).join(' '),
      f.cantidad,
      f.ubicacion,
      f.tipo,
      f.serialCodigo,
      f.precioUnitario,
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, fontSize: 7 },
    margin: { left: 8, right: 8 },
    didDrawPage: () => {
      // El header se repite en cada pagina nueva que agrega autoTable.
      encabezado(doc, logo, escudo);
    },
  });

  doc.save(`Inventario_Material_Menor_${new Date().toISOString().slice(0, 10)}.pdf`);
}

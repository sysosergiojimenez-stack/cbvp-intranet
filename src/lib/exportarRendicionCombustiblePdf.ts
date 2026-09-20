import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// El indicativo radial del cuartel; se usa como "Lugar de salida" fijo en
// cada fila, igual que en la planilla original en papel.
const INDICATIVO_CUARTEL = 'K20';

function formatearAnio(anio: number): string {
  const s = String(anio);
  return s.length === 4 ? `${s[0]}.${s.slice(1)}` : s;
}

function formatearMiles(valor: string): string {
  const n = parseInt(String(valor || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('es-PY') : '';
}

export interface FilaRendicionCombustible {
  fechaSalida: string;
  conductor: string;
  ci: string;
  kilometrajeSalida: string;
  direccion: string;
  kilometrajeLlegada: string;
  kmRecorridos: number | null;
  tipoServicio: string;
  factura: string;
  litros: string;
  importe: string;
}

export interface MovilRendicion {
  codificacion: string;
  tipo: string;
  tipoCombustible: string;
  numeroTarjetaFlota: string;
  proveedorCombustible: string;
}

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

export async function exportarRendicionCombustiblePdf(
  movil: MovilRendicion,
  mes: number,
  anio: number,
  filas: FilaRendicionCombustible[]
) {
  const escudo = await cargarImagenBase64('/escudo-cbvp.png');
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 10;
  if (escudo) {
    try {
      const props = doc.getImageProperties(escudo);
      const ratio = props.width / props.height || 1;
      const h = 18;
      const w = h * ratio;
      doc.addImage(escudo, 'PNG', pageWidth / 2 - w / 2, y, w, h);
      y += h + 3;
    } catch {
      /* ignore */
    }
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(ORGANIZACION.nombreCompleto.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Conforme Resolución DA 365/18 del Ministerio de Hacienda', pageWidth / 2, y, { align: 'center' });
  y += 6;

  const nombreEntidad = `${INDICATIVO_CUARTEL} - ${ORGANIZACION.compania}`;
  const vehiculo = [movil.tipo, movil.codificacion].filter(Boolean).join(' ');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15 },
    body: [
      [{ content: 'Nombre de la entidad', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, nombreEntidad,
        { content: 'Ejercicio', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, formatearAnio(anio),
        { content: 'Bimestre', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, `${MESES[mes - 1]} ${anio}`],
      [{ content: 'Vehiculo', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, vehiculo,
        { content: 'Chapa', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, '',
        { content: 'Tipo de Combustible', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, movil.tipoCombustible],
      [{ content: 'Número de tarjeta flota', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, movil.numeroTarjetaFlota,
        { content: 'Proveedor', styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }, { content: movil.proveedorCombustible, colSpan: 3 }],
    ],
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 65 }, 2: { cellWidth: 30 }, 3: { cellWidth: 50 }, 4: { cellWidth: 35 } },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
  y = doc.lastAutoTable.finalY + 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANILLA DE USO DE COMBUSTIBLE', pageWidth / 2, y, { align: 'center' });
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.3, valign: 'middle', halign: 'center', overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 6.5 },
    head: [[
      'Fecha del viaje', 'CI N°', 'Nombre y Apellido', 'Firma',
      'Lugar de salida', 'Km de salida', 'Lugar de destino', 'Km de llegada', 'Km recorridos',
      'Motivo del viaje',
      'Factura N°', 'Lts. Cargados', 'Importe total (en Gs)', 'Firma Autorizada (Tesorero/Administrador)',
    ]],
    body: filas.map((f) => [
      f.fechaSalida,
      f.ci,
      f.conductor,
      '',
      INDICATIVO_CUARTEL,
      f.kilometrajeSalida,
      f.direccion,
      f.kilometrajeLlegada,
      f.kmRecorridos !== null ? String(f.kmRecorridos) : '',
      f.tipoServicio,
      f.factura,
      f.litros,
      formatearMiles(f.importe),
      '',
    ]),
    columnStyles: {
      2: { halign: 'left' },
      6: { halign: 'left' },
      9: { halign: 'left' },
    },
    margin: { left: 10, right: 10 },
  });

  // Pie de firma: una sola vez, al final real de la planilla (no en cada
  // pagina) -- si no entra en la pagina donde termino la tabla, se agrega
  // una pagina nueva para no superponerlo con la ultima fila.
  const pageHeight = doc.internal.pageSize.getHeight();
  // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
  let yFirma = doc.lastAutoTable.finalY + 14;
  if (yFirma > pageHeight - 16) {
    doc.addPage();
    yFirma = 20;
  }
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('SELLO DE LA COMPAÑÍA:', 15, yFirma);
  doc.text('FIRMA Y ACLARACIÓN DEL COMANDANTE', pageWidth - 15, yFirma, { align: 'right' });

  const nombreArchivo = `RENDICION_DE_COMBUSTIBLE_${MESES[mes - 1]}_${anio}_${movil.codificacion}.pdf`;
  doc.save(nombreArchivo);
}

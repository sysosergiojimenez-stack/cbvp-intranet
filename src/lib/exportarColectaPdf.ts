import jsPDF from 'jspdf';
import {
  BILLETES, MONEDAS, aEntero, dividirFecha, formatearGs, totalesConteo,
  type ColectaGeneral, type ConteoBloque, type DatosConteo, type FilaDistribucion,
  type FilaPos, type FilaResumen, type FilaTransferencia,
} from '@/lib/colecta';

// Formatos de Tesoreria Nacional del CBVP para la colecta: blanco y negro,
// tablas con borde, encabezado con los escudos del CBVP y de Tesoreria.

const ML = 15;
const W = 180;
const AMARILLO: [number, number, number] = [255, 255, 0];

interface Logos { cbvp: string | null; tesoreria: string | null }

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

async function cargarLogos(): Promise<Logos> {
  const [cbvp, tesoreria] = await Promise.all([
    cargarImagenBase64('/escudo-cbvp.png'),
    cargarImagenBase64('/escudo-tesoreria.png'),
  ]);
  return { cbvp, tesoreria };
}

interface OpcionesCelda {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  align?: 'left' | 'center' | 'right';
  fill?: [number, number, number];
  sinBorde?: boolean;
}

function celda(doc: jsPDF, x: number, y: number, w: number, h: number, texto: string, o: OpcionesCelda = {}) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  if (o.fill) {
    doc.setFillColor(...o.fill);
    doc.rect(x, y, w, h, 'FD');
  } else if (!o.sinBorde) {
    doc.rect(x, y, w, h);
  }
  if (!texto) return;
  doc.setFont('helvetica', o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
  doc.setFontSize(o.size ?? 10);
  doc.setTextColor(0, 0, 0);
  const align = o.align ?? 'left';
  const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 2 : x + 2;
  const recortado = doc.splitTextToSize(texto, w - 4)[0] || '';
  doc.text(recortado, tx, y + h / 2, { align, baseline: 'middle' });
}

// Escudos + "TESORERIA NACIONAL" + titulo del formato + Compania. Devuelve el Y siguiente.
function encabezado(doc: jsPDF, logos: Logos, titulo: string, compania: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const tam = 24;
  if (logos.cbvp) { try { doc.addImage(logos.cbvp, 'PNG', ML, 10, tam, tam); } catch { /* ignore */ } }
  if (logos.tesoreria) { try { doc.addImage(logos.tesoreria, 'PNG', ML + W - tam, 10, tam, tam); } catch { /* ignore */ } }
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.text('TESORERÍA NACIONAL', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text('CUERPO DE BOMBEROS VOLUNTARIOS DEL PARAGUAY', pageWidth / 2, 27, { align: 'center' });
  const y = 38;
  celda(doc, ML, y, W, 9, titulo, { bold: true, size: 14, align: 'center' });
  celda(doc, ML, y + 9, W, 7.5, `Compañía: ${compania}`, { bold: true, size: 10.5 });
  return y + 16.5 + 5;
}

type Firma = string;
// Cada fila lleva una o dos firmas, con una linea para firmar arriba del rotulo.
function bloqueFirmas(doc: jsPDF, yInicio: number, filas: Firma[][]): number {
  let y = yInicio;
  const alto = 15;
  for (const fila of filas) {
    fila.forEach((rotulo, i) => {
      const x = i === 0 ? ML : ML + 100;
      const largo = fila.length === 1 ? 90 : 80;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.line(x, y + alto - 5, x + largo, y + alto - 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(rotulo, x, y + alto - 0.8);
    });
    y += alto;
  }
  return y;
}

const FIRMAS_COMPLETAS: Firma[][] = [
  ['Firma y Aclaración del Voluntario interviniente'],
  ['Director Administrativo'],
  ['Síndico Titular', 'Sello de Compañía'],
  ['Testigo', 'Testigo'],
];
const FIRMAS_ACTA: Firma[][] = [
  ['Director Administrativo'],
  ['Síndico Titular', 'Sello de Compañía'],
  ['Testigo', 'Testigo'],
];

// Tabla con encabezado en negrita y filas de alto fijo. columnas: [titulo, ancho, alineacion]
function tabla(
  doc: jsPDF, y: number, columnas: [string, number, 'left' | 'center' | 'right'][],
  filas: string[][], altoFila: number, altoEncabezado = 8,
): number {
  let x = ML;
  columnas.forEach(([titulo, ancho]) => {
    celda(doc, x, y, ancho, altoEncabezado, titulo, { bold: true, align: 'center', size: 9 });
    x += ancho;
  });
  y += altoEncabezado;
  for (const fila of filas) {
    x = ML;
    columnas.forEach(([, ancho, align], i) => {
      celda(doc, x, y, ancho, altoFila, fila[i] || '', { align, size: 10 });
      x += ancho;
    });
    y += altoFila;
  }
  return y;
}

// Parrafo introductorio de las actas, con los datos de la fecha y el local si se cargaron.
function parrafoActa(doc: jsPDF, y: number, g: ColectaGeneral): number {
  const { dia, mes, anio } = dividirFecha(g.fecha);
  const lineas = [
    `En la ciudad de ${g.ciudad || '…........................'}, a los ${dia || '____'} días del mes de ${mes || '__________'} de ${anio || '____'},`,
    `en el local ${g.local || '_________________________________________'}; se procedió a la apertura`,
    'de las alcancías y sobres detallados más abajo; arrojando el siguiente resultado que declaramos:',
  ];
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  lineas.forEach((l, i) => doc.text(l, ML, y + i * 5.5));
  return y + lineas.length * 5.5 + 4;
}

// Un total en cero se deja vacio, para que el formato en blanco no salga con ceros impresos.
function montoOVacio(n: number): string {
  return n === 0 ? '' : formatearGs(n);
}

function filaTotal(doc: jsPDF, y: number, rotulo: string, valor: string, anchoRotulo: number, anchoValor: number): number {
  celda(doc, ML, y, anchoRotulo, 8, rotulo, { bold: true, italic: true, align: 'center' });
  celda(doc, ML + anchoRotulo, y, anchoValor, 8, valor, { bold: true, align: 'right' });
  return y + 8;
}

// ---------------- 1. Distribucion de alcancias ----------------
function dibujarDistribucion(doc: jsPDF, logos: Logos, g: ColectaGeneral, filas: FilaDistribucion[]) {
  let y = encabezado(doc, logos, 'DISTRIBUCIÓN DE ALCANCÍAS', g.compania);
  y = tabla(doc, y,
    [['N° de alcancía', 28, 'center'], ['Nombre y Apellido del Responsable', 70, 'left'], ['C.I. N°', 24, 'center'], ['Teléfono', 28, 'center'], ['Firma', 30, 'center']],
    filas.map(f => [f.n, f.responsable, f.ci, f.telefono, '']), 9);
  bloqueFirmas(doc, y + 6, FIRMAS_COMPLETAS);
}

// ---------------- 2. Conteo de alcancias y sobres ----------------
function dibujarConteoBloque(doc: jsPDF, x: number, y: number, rotuloNumero: string, b: ConteoBloque): number {
  const bw = 85;
  const cols = [30, 25, 30];
  const t = totalesConteo(b);
  celda(doc, x, y, bw, 7.5, `${rotuloNumero} ${b.numero}`, { bold: true });
  y += 7.5;

  const seccion = (titulo: string, denominaciones: number[], totalRotulo: string, total: number) => {
    celda(doc, x, y, bw, 7, titulo, { bold: true, align: 'center', fill: AMARILLO });
    y += 7;
    ['Denominación', 'Cantidad', 'Sub totales'].forEach((c, i) => {
      celda(doc, x + cols.slice(0, i).reduce((s, v) => s + v, 0), y, cols[i], 7, c, { bold: true, align: 'center', fill: AMARILLO, size: 9.5 });
    });
    y += 7;
    for (const d of denominaciones) {
      const cant = aEntero(b.cantidades[String(d)] || '');
      const hayCantidad = (b.cantidades[String(d)] || '').trim() !== '';
      celda(doc, x, y, cols[0], 7, formatearGs(d), { align: 'right' });
      celda(doc, x + cols[0], y, cols[1], 7, hayCantidad ? String(cant) : '', { align: 'center' });
      celda(doc, x + cols[0] + cols[1], y, cols[2], 7, hayCantidad ? formatearGs(d * cant) : '', { align: 'right' });
      y += 7;
    }
    celda(doc, x, y, cols[0] + cols[1], 7, totalRotulo, { bold: true, align: 'center' });
    celda(doc, x + cols[0] + cols[1], y, cols[2], 7, montoOVacio(total), { bold: true, align: 'right' });
    y += 7;
  };

  seccion('Billetes', BILLETES, 'Total Billetes', t.billetes);
  seccion('Monedas', MONEDAS, 'Total Monedas', t.monedas);
  return y;
}

function dibujarConteo(doc: jsPDF, logos: Logos, g: ColectaGeneral, d: DatosConteo) {
  let y = encabezado(doc, logos, 'CONTEO DE ALCANCÍAS', g.compania);
  const xIzq = ML, xDer = ML + 95;
  const yFin = dibujarConteoBloque(doc, xIzq, y, 'Alcancía N°:', d.alcancia);
  dibujarConteoBloque(doc, xDer, y, 'Sobre N°:', d.sobre);
  y = yFin;
  const ta = totalesConteo(d.alcancia), ts = totalesConteo(d.sobre);
  celda(doc, xIzq, y, 55, 8, 'Total Alcancía + Billetes', { bold: true, italic: true, align: 'center' });
  celda(doc, xIzq + 55, y, 30, 8, montoOVacio(ta.total), { bold: true, align: 'right', fill: AMARILLO });
  celda(doc, xDer, y, 55, 8, 'Total Sobre', { bold: true, italic: true, align: 'center' });
  celda(doc, xDer + 55, y, 30, 8, montoOVacio(ts.total), { bold: true, align: 'right', fill: AMARILLO });
  bloqueFirmas(doc, y + 12, FIRMAS_COMPLETAS);
}

// ---------------- 3. Resumen de alcancias abiertas ----------------
const COL_RESUMEN: [string, number, 'left' | 'center' | 'right'][] = [
  ['N° de alcancía', 30, 'center'], ['Total de Billetes', 45, 'right'], ['Total de monedas', 45, 'right'], ['Total General', 60, 'right'],
];

function filasResumen(filas: FilaResumen[]): string[][] {
  return filas.map(f => {
    const b = aEntero(f.billetes), m = aEntero(f.monedas);
    const hay = f.billetes.trim() !== '' || f.monedas.trim() !== '';
    return [f.n, f.billetes.trim() !== '' ? formatearGs(b) : '', f.monedas.trim() !== '' ? formatearGs(m) : '', hay ? formatearGs(b + m) : ''];
  });
}

function dibujarResumen(doc: jsPDF, logos: Logos, g: ColectaGeneral, filas: FilaResumen[]) {
  let y = encabezado(doc, logos, 'RESUMEN DE ALCANCÍAS ABIERTAS', g.compania);
  y = tabla(doc, y, COL_RESUMEN, filasResumen(filas), 10);
  bloqueFirmas(doc, y + 8, FIRMAS_ACTA);
}

// ---------------- 4. Acta de conteo ----------------
function dibujarActaConteo(doc: jsPDF, logos: Logos, g: ColectaGeneral, filas: FilaResumen[]) {
  let y = encabezado(doc, logos, 'ACTA DE CONTEO', g.compania);
  y = parrafoActa(doc, y, g);
  y = tabla(doc, y, COL_RESUMEN, filasResumen(filas), 8);
  const abiertas = filas.filter(f => f.billetes.trim() !== '' || f.monedas.trim() !== '').length;
  const totalGs = filas.reduce((s, f) => s + aEntero(f.billetes) + aEntero(f.monedas), 0);
  y += 5;
  y = filaTotal(doc, y, 'Total de alcancías abiertas', abiertas === 0 ? '' : String(abiertas), 120, 60);
  y = filaTotal(doc, y, 'Total guaraníes', montoOVacio(totalGs), 120, 60);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.text('Firman al pie del presente ACTA como prueba de conformidad.', ML, y + 8);
  bloqueFirmas(doc, y + 12, FIRMAS_ACTA);
}

// ---------------- 5. Acta de control de POS Upay ----------------
function dibujarPos(doc: jsPDF, logos: Logos, g: ColectaGeneral, filas: FilaPos[]) {
  let y = encabezado(doc, logos, 'ACTA DE CONTROL DE POS UPAY', g.compania);
  y = parrafoActa(doc, y, g);
  y = tabla(doc, y,
    [['N° de POS Upay', 40, 'center'], ['DESDE', 45, 'center'], ['HASTA', 45, 'center'], ['MONTO', 50, 'right']],
    filas.map(f => [f.n, f.desde, f.hasta, f.monto.trim() !== '' ? formatearGs(aEntero(f.monto)) : '']), 10);
  y += 5;
  y = filaTotal(doc, y, 'Total guaraníes', montoOVacio(filas.reduce((s, f) => s + aEntero(f.monto), 0)), 130, 50);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.text('Firman al pie del presente ACTA como prueba de conformidad.', ML, y + 8);
  bloqueFirmas(doc, y + 12, FIRMAS_ACTA);
}

// ---------------- 6. Acta de control de transferencias ----------------
function dibujarTransferencias(doc: jsPDF, logos: Logos, g: ColectaGeneral, filas: FilaTransferencia[]) {
  let y = encabezado(doc, logos, 'ACTA DE CONTROL DE TRANSFERENCIAS', g.compania);
  y = parrafoActa(doc, y, g);
  y = tabla(doc, y,
    [['N° de TRANSFERENCIA', 45, 'center'], ['NRO DE COMPROBANTE', 50, 'center'], ['BANCO', 40, 'center'], ['MONTO', 45, 'right']],
    filas.map(f => [f.n, f.comprobante, f.banco, f.monto.trim() !== '' ? formatearGs(aEntero(f.monto)) : '']), 10);
  y += 5;
  y = filaTotal(doc, y, 'Total guaraníes', montoOVacio(filas.reduce((s, f) => s + aEntero(f.monto), 0)), 135, 45);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.text('Firman al pie del presente ACTA como prueba de conformidad.', ML, y + 8);
  bloqueFirmas(doc, y + 12, FIRMAS_ACTA);
}

// ---------------- API publica ----------------
export interface DatosColecta {
  general: ColectaGeneral;
  distribucion: FilaDistribucion[];
  conteo: DatosConteo;
  resumen: FilaResumen[];
  pos: FilaPos[];
  transferencias: FilaTransferencia[];
}

export type FormatoColecta = 'distribucion' | 'conteo' | 'resumen' | 'acta' | 'pos' | 'transferencias';

export const FORMATOS_COLECTA: { id: FormatoColecta; titulo: string; archivo: string }[] = [
  { id: 'distribucion', titulo: 'Distribución de alcancías', archivo: 'DISTRIBUCION_DE_ALCANCIAS' },
  { id: 'conteo', titulo: 'Conteo de alcancías y sobres', archivo: 'CONTEO_DE_ALCANCIAS_Y_SOBRES' },
  { id: 'resumen', titulo: 'Resumen de alcancías abiertas', archivo: 'RESUMEN_DE_ALCANCIAS_ABIERTAS' },
  { id: 'acta', titulo: 'Acta de conteo', archivo: 'ACTA_DE_CONTEO' },
  { id: 'pos', titulo: 'Control de POS Upay', archivo: 'CONTROL_DE_POS_UPAY' },
  { id: 'transferencias', titulo: 'Control de transferencias', archivo: 'CONTROL_DE_TRANSFERENCIAS' },
];

function dibujar(doc: jsPDF, logos: Logos, formato: FormatoColecta, d: DatosColecta) {
  switch (formato) {
    case 'distribucion': return dibujarDistribucion(doc, logos, d.general, d.distribucion);
    case 'conteo': return dibujarConteo(doc, logos, d.general, d.conteo);
    case 'resumen': return dibujarResumen(doc, logos, d.general, d.resumen);
    case 'acta': return dibujarActaConteo(doc, logos, d.general, d.resumen);
    case 'pos': return dibujarPos(doc, logos, d.general, d.pos);
    case 'transferencias': return dibujarTransferencias(doc, logos, d.general, d.transferencias);
  }
}

export async function exportarColectaPdf(formato: FormatoColecta | 'todos', d: DatosColecta) {
  const logos = await cargarLogos();
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const formatos = formato === 'todos' ? FORMATOS_COLECTA.map(f => f.id) : [formato];
  formatos.forEach((f, i) => {
    if (i > 0) doc.addPage();
    dibujar(doc, logos, f, d);
  });
  const nombre = formato === 'todos' ? 'COLECTA_TODOS_LOS_FORMATOS' : FORMATOS_COLECTA.find(f => f.id === formato)!.archivo;
  doc.save(`${nombre}.pdf`);
}

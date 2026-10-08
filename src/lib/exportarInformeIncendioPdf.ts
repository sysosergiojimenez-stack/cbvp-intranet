import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';

interface Persona { nombre: string; ci: string; edad: string; nacionalidad: string }
interface VoluntarioConductor { movil: string; conductor: string; codigo: string }
interface VoluntarioCombatiente { movil: string; combatiente: string; codigo: string }

export interface InformeIncendioPdf {
  nServicio: string;
  movil: string;
  fecha: string;
  ordenDeSalida: string;
  horaSalida: string;
  horaLlegada: string;
  horaRetirada: string;
  direccion: string;
  frenteAlNo: string;
  entreCalle1: string;
  entreCalle2: string;
  ciudad: string;
  barrio: string;
  zona: string;
  alMandoDelActo: string;
  aCargoDeLaCompania: string;
  seguro: string;
  seguroEmpresa: string;
  seguroValor: string;
  magnitud: string;
  transporteAereoTipo: string;
  transporteTerrestreTipo: string;
  transporteAcuaticoTipo: string;
  edificioTipos: string[];
  edificioComercialTipoDetalle: string;
  edificioPublicoTipoDetalle: string;
  edificioMatConstruccion: string;
  edificioEspecificarTipo: string;
  forestalBosqueTipo: string;
  forestalPastizalTipo: string;
  forestalOtrosEspecificar: string;
  propietarioChofer: string;
  identCI: string;
  identEdad: string;
  identNacionalidad: string;
  identEstadoCivil: string;
  identRegNo: string;
  identTelPart: string;
  identDireccionPart: string;
  identTelLab: string;
  identDireccionLab: string;
  identMaterialContenidoRamo: string;
  vehiculoTipo: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoChapaNo: string;
  posibleCausa: string;
  posibleOrigen: string;
  estadoFuego: number | null;
  factoresPropagacion: string;
  accesoLocal: string;
  accesoViolentadoPor: string;
  colorLlamas: string;
  colorHumo: string;
  oloresIdentificados: string;
  materialesExplosivos: boolean;
  materialesInflamables: boolean;
  materialesToxicos: boolean;
  materialesOtros: boolean;
  inmueblesAfectadosFuego: string;
  inmueblesAfectadosExtincion: string;
  objetosAfectadosFuego: string;
  objetosAfectadosExtincion: string;
  heridos: Persona[];
  muertos: Persona[];
  materialesUtilizadosMoviles: string;
  materialesUtilizadosMenor: string;
  materialesUtilizadosAjenos: string;
  otrosDeApoyo: string;
  personalPolicialACargoDe: string;
  ministerioPublicoOficiadoPor: string;
  otrosDatosInteres: string;
  desarrolloDelInforme: string;
  nominaConductores: VoluntarioConductor[];
  nominaCombatientes: VoluntarioCombatiente[];
  nominaACargo: string;
  nominaFirma: string;
  croquisFotos: string[];
}

const ESTADOS_FUEGO_CORTO: Record<number, { titulo: string; sub: string }> = {
  1: { titulo: 'No se ve nada', sub: 'Se investiga' },
  2: { titulo: 'Se ve humo', sub: 'Ataque interior rápido y agresivo' },
  3: { titulo: 'Se ve humo y poco fuego', sub: 'Ataque interior rápido y agresivo' },
  4: { titulo: 'Fuego en desarrollo', sub: 'Ataque interior cauteloso' },
  5: { titulo: 'Fuego Activo', sub: 'Ataque interior cauteloso' },
  6: { titulo: 'Fuego Marginal', sub: 'Ataque interior y cauteloso' },
  7: { titulo: 'Total en llamas', sub: 'Operaciones exteriores Defensivas' },
  8: { titulo: 'Inicio Descendente', sub: 'Op. Ext. Defensivos, previendo colapso' },
  9: { titulo: 'Descendente', sub: 'Op. Ext. Defensivos, previendo colapso' },
  10: { titulo: 'Remoción', sub: '' },
};

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

function formatoDeDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function dibujarCheckbox(doc: jsPDF, x: number, y: number, marcado: boolean, label: string, size = 3): number {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(x, y - size + 0.7, size, size);
  if (marcado) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', x + 0.4, y - 0.2);
    doc.setFont('helvetica', 'normal');
  }
  doc.text(label, x + size + 1.3, y);
  return x + size + 1.3 + doc.getTextWidth(label) + 3.5;
}

export async function exportarInformeIncendioPdf(informe: InformeIncendioPdf) {
  const [escudo, prioridadRescate, ...iconos] = await Promise.all([
    cargarImagenBase64('/escudo-cbvp.png'),
    cargarImagenBase64('/prioridad-rescate.png'),
    ...Array.from({ length: 10 }, (_, i) => cargarImagenBase64(`/estado-fuego/${i + 1}.png`)),
  ]);

  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const mL = 10;
  const mR = pageWidth - 10;
  const frameW = mR - mL;
  let y = 10;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 10) {
      doc.addPage();
      y = 10;
    }
  };

  // ---------- helpers de dibujo tipo planilla ----------
  const rectAt = (x: number, yTop: number, w: number, h: number) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(x, yTop, w, h);
  };

  const textCell = (x: number, yTop: number, w: number, h: number, texto: string, opts: { bold?: boolean; size?: number; align?: 'left' | 'center' } = {}) => {
    rectAt(x, yTop, w, h);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 9);
    doc.setTextColor(0, 0, 0);
    if ((opts.align ?? 'left') === 'center') {
      doc.text(texto, x + w / 2, yTop + h / 2 + 1.2, { align: 'center' });
    } else {
      doc.text(texto, x + 2, yTop + h / 2 + 1.2);
    }
  };

  // Celda "Label: valor" (negrita + normal), una sola linea, recortada si no entra
  const fieldCell = (x: number, yTop: number, w: number, h: number, label: string, value: string) => {
    rectAt(x, yTop, w, h);
    doc.setFontSize(8.3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const labelTxt = label ? `${label}: ` : '';
    doc.text(labelTxt, x + 2, yTop + h / 2 + 1.2);
    const labelW = doc.getTextWidth(labelTxt);
    doc.setFont('helvetica', 'normal');
    const maxW = w - labelW - 4;
    const fitted = doc.splitTextToSize(value || '-', Math.max(maxW, 8))[0] || '';
    doc.text(fitted, x + 2 + labelW, yTop + h / 2 + 1.2);
  };

  // Celda "encabezado chico arriba + valor abajo" (Transporte / Forestal)
  const headerValueCell = (x: number, yTop: number, w: number, h: number, header: string, value: string) => {
    rectAt(x, yTop, w, h);
    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(header, x + w / 2, yTop + 3, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(value || '-', x + 2, yTop + h - 1.5);
  };

  // Celda de texto libre multilinea (Posible Causa / Factores)
  const textAreaCell = (x: number, yTop: number, w: number, h: number, label: string, value: string, opts: { align?: 'left' | 'center' } = {}) => {
    rectAt(x, yTop, w, h);
    doc.setFontSize(8.3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    if (opts.align === 'center') {
      doc.text(label, x + w / 2, yTop + 4.3, { align: 'center' });
    } else {
      doc.text(label, x + 2, yTop + 4.3);
    }
    doc.setFont('helvetica', 'normal');
    const lineas = doc.splitTextToSize(value || '-', w - 4);
    let ty = yTop + 8.5;
    for (const l of lineas) {
      if (ty > yTop + h - 1.5) break;
      doc.text(l, x + 2, ty);
      ty += 3.8;
    }
  };

  const checkboxRowCell = (x: number, yTop: number, w: number, h: number, label: string, items: [boolean, string][]) => {
    rectAt(x, yTop, w, h);
    doc.setFontSize(8.3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(label, x + 2, yTop + h / 2 + 1.2);
    const labelW = doc.getTextWidth(label) + 3;
    let cx = x + labelW;
    doc.setFont('helvetica', 'normal');
    for (const [marcado, texto] of items) {
      cx = dibujarCheckbox(doc, cx, yTop + h / 2 + 1.2, marcado, texto) + 1;
    }
  };

  // ================= PÁGINA 1 =================
  if (escudo) {
    try {
      const props = doc.getImageProperties(escudo);
      const ratio = props.width / props.height || 1;
      const h = 13;
      doc.addImage(escudo, 'PNG', mL, y, h * ratio, h);
    } catch { /* ignore */ }
  }
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(ORGANIZACION.nombreCompleto.toUpperCase(), pageWidth / 2 + 8, y + 5.5, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`COMPAÑÍA: ${ORGANIZACION.compania}`, pageWidth / 2 + 8, y + 11, { align: 'center' });
  y += 16;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE INCENDIO', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  const rh = 6.3;

  // N Servicio / Fecha / Orden de Salida
  checkPageBreak(rh);
  { const w1 = 38, w2 = 42, w3 = frameW - w1 - w2;
    fieldCell(mL, y, w1, rh, 'N° Servicio', informe.nServicio);
    fieldCell(mL + w1, y, w2, rh, 'Fecha', informe.fecha);
    fieldCell(mL + w1 + w2, y, w3, rh, 'Orden de Salida', informe.ordenDeSalida);
    y += rh; }

  // Hora salida / llegada / retirada
  checkPageBreak(rh);
  { const w = frameW / 3;
    fieldCell(mL, y, w, rh, 'Hora de salida', informe.horaSalida);
    fieldCell(mL + w, y, w, rh, 'Hora de llegada', informe.horaLlegada);
    fieldCell(mL + 2 * w, y, w, rh, 'Hora de retirada', informe.horaRetirada);
    y += rh; }

  // Direccion / Frente al No
  checkPageBreak(rh);
  { const w1 = frameW * 0.68, w2 = frameW - w1;
    fieldCell(mL, y, w1, rh, 'Dirección', informe.direccion);
    fieldCell(mL + w1, y, w2, rh, 'Frente al N°', informe.frenteAlNo);
    y += rh; }

  // Entre / y
  checkPageBreak(rh);
  { const w1 = frameW * 0.58, w2 = frameW - w1;
    fieldCell(mL, y, w1, rh, 'Entre', informe.entreCalle1);
    fieldCell(mL + w1, y, w2, rh, 'y', informe.entreCalle2);
    y += rh; }

  // Ciudad / Barrio / Zona
  checkPageBreak(rh);
  { const w1 = frameW * 0.38, w2 = frameW * 0.31, w3 = frameW - w1 - w2;
    fieldCell(mL, y, w1, rh, 'Ciudad', informe.ciudad);
    fieldCell(mL + w1, y, w2, rh, 'Barrio', informe.barrio);
    fieldCell(mL + w1 + w2, y, w3, rh, 'Zona', informe.zona);
    y += rh; }

  // Al mando del Acto / A cargo de la Compañia
  checkPageBreak(rh);
  { const w = frameW / 2;
    fieldCell(mL, y, w, rh, 'Al mando del Acto', informe.alMandoDelActo);
    fieldCell(mL + w, y, w, rh, 'A cargo de la Compañía', informe.aCargoDeLaCompania);
    y += rh; }

  // Seguro SI/NO | Empresa | Valor
  checkPageBreak(rh);
  { const w1 = 40, w2 = frameW * 0.55, w3 = frameW - w1 - w2;
    rectAt(mL, y, w1, rh);
    doc.setFontSize(8.3); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Seguro:', mL + 2, y + rh / 2 + 1.2);
    let xS = mL + 17;
    doc.setFont('helvetica', 'normal');
    xS = dibujarCheckbox(doc, xS, y + rh / 2 + 1.2, informe.seguro === 'SI', 'SI');
    dibujarCheckbox(doc, xS, y + rh / 2 + 1.2, informe.seguro === 'NO', 'NO');
    fieldCell(mL + w1, y, w2, rh, 'Empresa', informe.seguroEmpresa);
    fieldCell(mL + w1 + w2, y, w3, rh, 'Valor', informe.seguroValor);
    y += rh; }

  // Magnitud
  checkPageBreak(rh);
  checkboxRowCell(mL, y, frameW, rh, 'Magnitud:', [
    [informe.magnitud === 'Grande', 'Grande'], [informe.magnitud === 'Mediana', 'Mediana'],
    [informe.magnitud === 'Pequena', 'Pequeña'], [informe.magnitud === 'No se trabajo', 'No se trabajó'],
    [informe.magnitud === 'Falsa Alarma', 'Falsa Alarma'], [informe.magnitud === 'Otros', 'Otros'],
  ]);
  y += rh;

  // Transporte
  checkPageBreak(8);
  { const labelW = 26, w = (frameW - labelW) / 3; const h = 8;
    textCell(mL, y, labelW, h, 'Transporte:', { bold: true, size: 8.3 });
    headerValueCell(mL + labelW, y, w, h, 'Aéreo - Tipo', informe.transporteAereoTipo);
    headerValueCell(mL + labelW + w, y, w, h, 'Terrestre - Tipo', informe.transporteTerrestreTipo);
    headerValueCell(mL + labelW + 2 * w, y, w, h, 'Acuático - Tipo', informe.transporteAcuaticoTipo);
    y += h; }

  // Edificio (checkboxes, 2 filas) | Mat. de Construccion
  checkPageBreak(15);
  { const wIzq = frameW * 0.62, wDer = frameW - wIzq; const h = 15;
    rectAt(mL, y, wIzq, h);
    doc.setFontSize(8.3); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Edificio:', mL + 2, y + 5);
    const tipos: [string, string][] = [['Vivienda', 'Vivienda'], ['Edificio', 'Edificio'], ['Comercial', 'Comercial Tipo'], ['Deposito', 'Depósito'], ['Industrial', 'Industrial'], ['Publico', 'Público Tipo']];
    doc.setFont('helvetica', 'normal');
    let cx = mL + 19, cy = y + 5;
    tipos.forEach(([clave, texto], i) => {
      if (i === 3) { cx = mL + 19; cy = y + 11; }
      cx = dibujarCheckbox(doc, cx, cy, informe.edificioTipos.includes(clave), texto) + 1;
    });
    fieldCell(mL + wIzq, y, wDer, h, 'Mat. Construcción', informe.edificioMatConstruccion);
    y += h; }

  checkPageBreak(rh);
  fieldCell(mL, y, frameW, rh, 'Especificar tipo', [informe.edificioComercialTipoDetalle, informe.edificioPublicoTipoDetalle, informe.edificioEspecificarTipo].filter(Boolean).join(' · '));
  y += rh;

  // Forestal
  checkPageBreak(8);
  { const labelW = 26, w = (frameW - labelW) / 3; const h = 8;
    textCell(mL, y, labelW, h, 'Forestal:', { bold: true, size: 8.3 });
    headerValueCell(mL + labelW, y, w, h, 'Bosque - Tipo', informe.forestalBosqueTipo);
    headerValueCell(mL + labelW + w, y, w, h, 'Pastizal - Tipo', informe.forestalPastizalTipo);
    headerValueCell(mL + labelW + 2 * w, y, w, h, 'Otros - Especificar', informe.forestalOtrosEspecificar);
    y += h; }

  // Identificacion del local / transporte
  checkPageBreak(5.8 * 5);
  { const labelW = 40, fieldW = frameW - labelW; const subH = 5.8; const blockH = subH * 5;
    rectAt(mL, y, labelW, blockH);
    doc.setFontSize(7.8); doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(0, 0, 0);
    const lineasLabel = doc.splitTextToSize('Identificación del local / transporte', labelW - 3);
    let ly = y + blockH / 2 - ((lineasLabel.length - 1) * 3.2) / 2 + 1;
    for (const l of lineasLabel) { doc.text(l, mL + 1.5, ly); ly += 3.2; }
    let fy = y;
    fieldCell(mL + labelW, fy, fieldW, subH, 'Propietario/Chofer', informe.propietarioChofer); fy += subH;
    { const w1 = fieldW * 0.4, w2 = fieldW * 0.3, w3 = fieldW - w1 - w2;
      fieldCell(mL + labelW, fy, w1, subH, 'C.I. N°', informe.identCI);
      fieldCell(mL + labelW + w1, fy, w2, subH, 'Edad', informe.identEdad);
      fieldCell(mL + labelW + w1 + w2, fy, w3, subH, 'Nacionalidad', informe.identNacionalidad); fy += subH; }
    { const w1 = fieldW * 0.4, w2 = fieldW * 0.3, w3 = fieldW - w1 - w2;
      fieldCell(mL + labelW, fy, w1, subH, 'E. Civil', informe.identEstadoCivil);
      fieldCell(mL + labelW + w1, fy, w2, subH, 'Reg. N°', informe.identRegNo);
      fieldCell(mL + labelW + w1 + w2, fy, w3, subH, 'Tel. Part.', informe.identTelPart); fy += subH; }
    { const w1 = fieldW * 0.6, w2 = fieldW - w1;
      fieldCell(mL + labelW, fy, w1, subH, 'Dirección part.', informe.identDireccionPart);
      fieldCell(mL + labelW + w1, fy, w2, subH, 'Tel. Lab.', informe.identTelLab); fy += subH; }
    { const w1 = fieldW * 0.4, w2 = fieldW - w1;
      fieldCell(mL + labelW, fy, w1, subH, 'Dirección lab.', informe.identDireccionLab);
      fieldCell(mL + labelW + w1, fy, w2, subH, 'Material contenido/ramo', informe.identMaterialContenidoRamo); fy += subH; }
    y += blockH; }

  // Vehiculo
  checkPageBreak(rh);
  { const w1 = frameW * 0.26, w2 = frameW * 0.26, w3 = frameW * 0.22, w4 = frameW - w1 - w2 - w3;
    fieldCell(mL, y, w1, rh, 'Vehículo tipo', informe.vehiculoTipo);
    fieldCell(mL + w1, y, w2, rh, 'Marca', informe.vehiculoMarca);
    fieldCell(mL + w1 + w2, y, w3, rh, 'Modelo', informe.vehiculoModelo);
    fieldCell(mL + w1 + w2 + w3, y, w4, rh, 'Chapa N°', informe.vehiculoChapaNo);
    y += rh; }

  // Posible Causa | Posible Origen
  checkPageBreak(15);
  { const w = frameW / 2; const h = 15;
    textAreaCell(mL, y, w, h, 'Posible Causa (fenómeno originario)', informe.posibleCausa, { align: 'center' });
    textAreaCell(mL + w, y, w, h, 'Posible Origen (objeto por donde comenzó)', informe.posibleOrigen, { align: 'center' });
    y += h; }

  // Estado del Fuego a la llegada de la dotacion — grilla de 10 con icono
  checkPageBreak(7 + 24 * 2);
  textCell(mL, y, frameW, 7, 'Estado del Fuego a la llegada de la dotación', { bold: true, align: 'center', size: 10 });
  y += 7;
  { const colW = frameW / 5; const rowHIcon = 24;
    for (let fila = 0; fila < 2; fila++) {
      checkPageBreak(rowHIcon);
      for (let col = 0; col < 5; col++) {
        const n = fila * 5 + col + 1;
        const x = mL + col * colW;
        const seleccionado = informe.estadoFuego === n;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(seleccionado ? 0.7 : 0.25);
        doc.rect(x, y, colW, rowHIcon);
        const icono = iconos[n - 1];
        if (icono) {
          try {
            const props = doc.getImageProperties(icono);
            const ratio = props.width / props.height || 1;
            const iconH = 12;
            const iconW = iconH * ratio;
            doc.addImage(icono, 'PNG', x + (colW - iconW) / 2, y + 1.5, iconW, iconH);
          } catch { /* ignore */ }
        }
        const info = ESTADOS_FUEGO_CORTO[n];
        doc.setFontSize(6.3);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        dibujarCheckbox(doc, x + 1.5, y + 16.5, seleccionado, '', 2.4);
        doc.setFont('helvetica', 'bold');
        const tituloLineas = doc.splitTextToSize(`${n}- ${info.titulo}`, colW - 7);
        let ty = y + 16.5;
        for (const l of tituloLineas.slice(0, 2)) { doc.text(l, x + 5.5, ty); ty += 2.9; }
        if (info.sub) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.6);
          doc.setTextColor(90, 90, 90);
          const subLineas = doc.splitTextToSize(info.sub, colW - 4);
          for (const l of subLineas.slice(0, 2)) { doc.text(l, x + 1.5, ty); ty += 2.5; }
        }
      }
      y += rowHIcon;
    }
  }
  doc.setLineWidth(0.25);

  // Factores de propagacion
  checkPageBreak(11);
  textAreaCell(mL, y, frameW, 11, 'Factores que han contribuido a la propagación de las llamas:', informe.factoresPropagacion);
  y += 11;

  // Acceso al local
  checkPageBreak(rh);
  { rectAt(mL, y, frameW, rh);
    doc.setFontSize(8.3); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Acceso al local:', mL + 2, y + rh / 2 + 1.2);
    let xA = mL + 32;
    doc.setFont('helvetica', 'normal');
    xA = dibujarCheckbox(doc, xA, y + rh / 2 + 1.2, informe.accesoLocal === 'Abierto', 'Abierto');
    xA = dibujarCheckbox(doc, xA, y + rh / 2 + 1.2, informe.accesoLocal === 'Cerrado', 'Cerrado');
    doc.setFont('helvetica', 'bold');
    doc.text('Violentado por:', xA + 2, y + rh / 2 + 1.2);
    const vW = doc.getTextWidth('Violentado por: ');
    doc.setFont('helvetica', 'normal');
    doc.text(informe.accesoViolentadoPor || '-', xA + 4 + vW, y + rh / 2 + 1.2);
    y += rh; }

  // Color llamas / Color humo / Olores
  checkPageBreak(rh);
  { const w = frameW / 3;
    fieldCell(mL, y, w, rh, 'Color de las llamas', informe.colorLlamas);
    fieldCell(mL + w, y, w, rh, 'Color del Humo', informe.colorHumo);
    fieldCell(mL + 2 * w, y, w, rh, 'Olores identificados', informe.oloresIdentificados);
    y += rh; }

  // Existencia de Materiales
  checkPageBreak(rh);
  checkboxRowCell(mL, y, frameW, rh, 'Existencia de Materiales:', [
    [informe.materialesExplosivos, 'Explosivos'], [informe.materialesInflamables, 'Inflamables'],
    [informe.materialesToxicos, 'Tóxicos'], [informe.materialesOtros, 'Otros'],
  ]);
  y += rh;

  // Inmuebles afectados
  checkPageBreak(rh * 2);
  { const labelW = 33, fieldW = frameW - labelW; const h = rh * 2;
    rectAt(mL, y, labelW, h);
    doc.setFontSize(8); doc.setFont('helvetica', 'bolditalic'); doc.setTextColor(0, 0, 0);
    doc.text('Inmuebles', mL + 2, y + h / 2 - 1.5);
    doc.text('afectados', mL + 2, y + h / 2 + 2.5);
    fieldCell(mL + labelW, y, fieldW, rh, 'Fuego', informe.inmueblesAfectadosFuego);
    fieldCell(mL + labelW, y + rh, fieldW, rh, 'Extinción', informe.inmueblesAfectadosExtincion);
    y += h; }

  // Objetos afectados
  checkPageBreak(rh * 2);
  { const labelW = 33, fieldW = frameW - labelW; const h = rh * 2;
    rectAt(mL, y, labelW, h);
    doc.setFontSize(8); doc.setFont('helvetica', 'bolditalic'); doc.setTextColor(0, 0, 0);
    doc.text('Objetos', mL + 2, y + h / 2 - 1.5);
    doc.text('afectados', mL + 2, y + h / 2 + 2.5);
    fieldCell(mL + labelW, y, fieldW, rh, 'Fuego', informe.objetosAfectadosFuego);
    fieldCell(mL + labelW, y + rh, fieldW, rh, 'Extinción', informe.objetosAfectadosExtincion);
    y += h; }

  // ================= PÁGINA 2 =================
  doc.addPage();
  y = 12;

  // Heridos / Muertos — tabla combinada con columna de etiqueta (rowSpan)
  { const filasHeridos = informe.heridos.length > 0 ? informe.heridos : [{ nombre: '-', ci: '-', edad: '-', nacionalidad: '-' }];
    const filasMuertos = informe.muertos.length > 0 ? informe.muertos : [{ nombre: '-', ci: '-', edad: '-', nacionalidad: '-' }];
    const body: any[] = [];
    filasHeridos.forEach((p, i) => {
      const row: any[] = [p.nombre || '-', p.ci || '-', p.edad || '-', p.nacionalidad || '-'];
      if (i === 0) row.unshift({ content: 'HERIDOS', rowSpan: filasHeridos.length, styles: { valign: 'middle', halign: 'center', fontStyle: 'bolditalic' } });
      body.push(row);
    });
    filasMuertos.forEach((p, i) => {
      const row: any[] = [p.nombre || '-', p.ci || '-', p.edad || '-', p.nacionalidad || '-'];
      if (i === 0) row.unshift({ content: 'MUERTOS', rowSpan: filasMuertos.length, styles: { valign: 'middle', halign: 'center', fontStyle: 'bolditalic' } });
      body.push(row);
    });
    autoTable(doc, {
      startY: y,
      head: [['', 'Nombres', 'C.I. N°', 'Edad', 'Nacionalidad']],
      body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.25 },
      columnStyles: { 0: { cellWidth: 22 } },
      margin: { left: mL, right: pageWidth - mR },
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    y = doc.lastAutoTable.finalY; }

  // Materiales Utilizados
  checkPageBreak(6.3 * 4);
  { const labelW = 33, fieldW = frameW - labelW; const subH = 6.3; const blockH = subH * 4;
    rectAt(mL, y, labelW, blockH);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('MATERIALES', mL + 2, y + blockH / 2 - 1.5);
    doc.text('UTILIZADOS:', mL + 2, y + blockH / 2 + 2.5);
    let fy = y;
    fieldCell(mL + labelW, fy, fieldW, subH, 'Móviles', informe.materialesUtilizadosMoviles); fy += subH;
    fieldCell(mL + labelW, fy, fieldW, subH, 'Menor', informe.materialesUtilizadosMenor); fy += subH;
    rectAt(mL + labelW, fy, fieldW, subH); fy += subH;
    fieldCell(mL + labelW, fy, fieldW, subH, 'Ajenos', informe.materialesUtilizadosAjenos); fy += subH;
    y += blockH; }

  checkPageBreak(rh);
  fieldCell(mL, y, frameW, rh, 'Otros de Apoyo', informe.otrosDeApoyo);
  y += rh;
  checkPageBreak(rh);
  fieldCell(mL, y, frameW, rh, 'Personal Policial a cargo de', informe.personalPolicialACargoDe);
  y += rh;
  checkPageBreak(rh);
  fieldCell(mL, y, frameW, rh, 'Ministerio Público oficiado por', informe.ministerioPublicoOficiadoPor);
  y += rh;
  checkPageBreak(rh);
  fieldCell(mL, y, frameW, rh, 'Otros datos de interés', informe.otrosDatosInteres);
  y += rh;

  // Desarrollo del Informe | Prioridad de Rescate
  { const hDesarrollo = 78;
    checkPageBreak(hDesarrollo);
    const w = frameW / 2; const h = hDesarrollo;
    rectAt(mL, y, w, h);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('DESARROLLO DEL INFORME', mL + w / 2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    const lineasDesarrollo = doc.splitTextToSize(informe.desarrolloDelInforme || '-', w - 5);
    let ty = y + 11;
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    for (let li = 0; ty < y + h - 2; li++) {
      doc.text(lineasDesarrollo[li] || '', mL + 2, ty);
      doc.line(mL + 2, ty + 1, mL + w - 2, ty + 1);
      ty += 6.2;
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);

    rectAt(mL + w, y, w, h);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('PRIORIDAD DE RESCATE', mL + w + w / 2, y + 5, { align: 'center' });
    if (prioridadRescate) {
      try {
        const props = doc.getImageProperties(prioridadRescate);
        const ratio = props.width / props.height || 1;
        const maxW = w - 6, maxH = h - 11;
        let imgW = maxW, imgH = imgW / ratio;
        if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
        doc.addImage(prioridadRescate, 'PNG', mL + w + (w - imgW) / 2, y + 8, imgW, imgH);
      } catch { /* ignore */ }
    }
    y += h; }

  // Nomina de Voluntarios | Croquis del Lugar
  { const hBloque = 92;
    checkPageBreak(hBloque);
    const w = frameW / 2; const startY = y;
    rectAt(mL, y, w, hBloque);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('NOMINA DE VOLUNTARIOS', mL + w / 2, y + 5, { align: 'center' });
    let ny = y + 8;
    autoTable(doc, {
      startY: ny,
      head: [['Móvil', 'Conductor', 'Código']],
      body: informe.nominaConductores.length > 0 ? informe.nominaConductores.map(c => [c.movil || '-', c.conductor || '-', c.codigo || '-']) : [['-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, lineWidth: 0.2 },
      margin: { left: mL + 2 },
      tableWidth: w - 4,
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    ny = doc.lastAutoTable.finalY + 2.5;
    autoTable(doc, {
      startY: ny,
      head: [['Móvil', 'Combatiente', 'Código']],
      body: informe.nominaCombatientes.length > 0 ? informe.nominaCombatientes.map(c => [c.movil || '-', c.combatiente || '-', c.codigo || '-']) : [['-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, lineWidth: 0.2 },
      margin: { left: mL + 2 },
      tableWidth: w - 4,
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    ny = doc.lastAutoTable.finalY + 4;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
    if (ny < startY + hBloque - 14) {
      doc.text(`A Cargo: ${informe.nominaACargo || '-'}`, mL + 2, ny);
      ny += 9;
      doc.setDrawColor(0, 0, 0);
      doc.line(mL + 2, ny, mL + 62, ny);
      ny += 4;
      doc.text(informe.nominaFirma || 'Firma', mL + 2, ny);
    }

    rectAt(mL + w, y, w, hBloque);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('CROQUIS DEL LUGAR', mL + w + w / 2, y + 5, { align: 'center' });
    const gridX = mL + w + 5, gridY = y + 9, gridW = w - 10, gap = 3;
    const cellW = (gridW - 2 * gap) / 3; const cellH = (hBloque - 13 - 2 * gap) / 3;
    for (let fila = 0; fila < 3; fila++) {
      for (let col = 0; col < 3; col++) {
        const idx = fila * 3 + col;
        const cx = gridX + col * (cellW + gap);
        const cyBox = gridY + fila * (cellH + gap);
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.2);
        doc.rect(cx, cyBox, cellW, cellH);
        const url = informe.croquisFotos[idx];
        if (url) {
          const foto = await cargarImagenBase64(url);
          if (foto) {
            try {
              const props = doc.getImageProperties(foto);
              const ratio = props.width / props.height || 1;
              let w2 = cellW - 2, h2 = w2 / ratio;
              if (h2 > cellH - 2) { h2 = cellH - 2; w2 = h2 * ratio; }
              doc.addImage(foto, formatoDeDataUrl(foto), cx + (cellW - w2) / 2, cyBox + (cellH - h2) / 2, w2, h2);
            } catch { /* ignore, deja el recuadro vacio */ }
          }
        }
      }
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    y = startY + hBloque; }

  const nombreArchivo = `INFORME_DE_INCENDIO_${(informe.nServicio || 'sin_numero').replace(/[\\/]/g, '_')}_${(informe.fecha || '').replace(/\//g, '-')}.pdf`;
  doc.save(nombreArchivo);
}

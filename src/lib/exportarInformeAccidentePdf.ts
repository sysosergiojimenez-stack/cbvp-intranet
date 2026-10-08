import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ORGANIZACION } from '@/config/organizacion';

interface Persona { nombre: string; ci: string; edad: string; nacionalidad: string }
export interface VehiculoAccidente {
  tipo: string; marca: string; modelo: string; color: string; chapaNo: string;
  conductor: string; ci: string; edad: string; registroNo: string; municipio: string; domicilio: string;
}

export interface InformeAccidentePdf {
  tipoInforme: string;
  nServicio: string;
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
  naturalezaTipos: string[];
  naturalezaOtros: string;
  lugarTipos: string[];
  vehiculos: VehiculoAccidente[];
  heridos: Persona[];
  muertos: Persona[];
  totalAccidentados: string;
  totalHeridos: string;
  totalMuertos: string;
  materialesUtilizadosMoviles: string;
  materialesUtilizadosMenor: string;
  materialesUtilizadosAjenos: string;
  otrosDeApoyo: string;
  personalPolicialACargoDe: string;
  ministerioPublicoOficiadoPor: string;
  otrosDatosInteres: string;
  causasAccidente: string;
  desarrolloDelInforme: string;
  nominaConductores: { movil: string; conductor: string; codigo: string }[];
  nominaCombatientes: { movil: string; combatiente: string; codigo: string }[];
  nominaACargo: string;
  nominaFirma: string;
  croquisFotos: string[];
}

export const NATURALEZAS: [string, string][] = [
  ['A', 'A) Derrumbe'], ['B', 'B) Extracción de Cadáver'], ['C', 'C) Extricación'],
  ['E', 'E) Colisión'], ['F', 'F) Explosión'], ['G', 'G) Otros (especificar)'],
];
export const LUGARES: [string, string][] = [
  ['Altura', 'Altura'], ['Subterraneo', 'Subterráneo'], ['Nivel de Terreno', 'Nivel de Terreno'], ['Acuatica', 'Acuática'],
  ['Vehiculo', 'Vehículo'], ['Equipo', 'Equipo'], ['Maquinaria', 'Maquinaria'], ['Instalacion', 'Instalación'],
];

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

export async function exportarInformeAccidentePdf(informe: InformeAccidentePdf) {
  const [escudo] = await Promise.all([cargarImagenBase64('/escudo-cbvp.png')]);

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

  const rectAt = (x: number, yTop: number, w: number, h: number) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(x, yTop, w, h);
  };

  const fieldCell = (x: number, yTop: number, w: number, h: number, label: string, value: string) => {
    rectAt(x, yTop, w, h);
    doc.setFontSize(8.3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const labelTxt = label ? `${label}: ` : '';
    doc.text(labelTxt, x + 2, yTop + h / 2 + 1.2);
    const labelW = doc.getTextWidth(labelTxt);
    doc.setFont('helvetica', 'normal');
    const fitted = doc.splitTextToSize(value || '-', Math.max(w - labelW - 4, 8))[0] || '';
    doc.text(fitted, x + 2 + labelW, yTop + h / 2 + 1.2);
  };

  const textAreaCell = (x: number, yTop: number, w: number, h: number, label: string, value: string) => {
    rectAt(x, yTop, w, h);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(label, x + w / 2, yTop + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lineas = doc.splitTextToSize(value || '-', w - 4);
    let ty = yTop + 9;
    for (const l of lineas) {
      if (ty > yTop + h - 1.5) break;
      doc.text(l, x + 2, ty);
      ty += 3.8;
    }
  };

  // ---------- Encabezado ----------
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
  doc.text('INFORME DE', pageWidth / 2 - 22, y, { align: 'center' });
  { let cx = pageWidth / 2 - 4;
    doc.setFontSize(12);
    cx = dibujarCheckbox(doc, cx, y, informe.tipoInforme === '10:41', '10:41', 3.6);
    dibujarCheckbox(doc, cx, y, informe.tipoInforme === '10:42', '10:42', 3.6); }
  y += 4.5;

  const rh = 6.3;

  checkPageBreak(rh);
  { const w1 = 38, w2 = 42, w3 = frameW - w1 - w2;
    fieldCell(mL, y, w1, rh, 'N° Servicio', informe.nServicio);
    fieldCell(mL + w1, y, w2, rh, 'Fecha', informe.fecha);
    fieldCell(mL + w1 + w2, y, w3, rh, 'Orden de Salida', informe.ordenDeSalida);
    y += rh; }

  checkPageBreak(rh);
  { const w = frameW / 3;
    fieldCell(mL, y, w, rh, 'Hora de salida', informe.horaSalida);
    fieldCell(mL + w, y, w, rh, 'Hora de llegada', informe.horaLlegada);
    fieldCell(mL + 2 * w, y, w, rh, 'Hora de retirada', informe.horaRetirada);
    y += rh; }

  checkPageBreak(rh);
  { const w1 = frameW * 0.68;
    fieldCell(mL, y, w1, rh, 'Dirección', informe.direccion);
    fieldCell(mL + w1, y, frameW - w1, rh, 'Frente al N°', informe.frenteAlNo);
    y += rh; }

  checkPageBreak(rh);
  { const w1 = frameW * 0.58;
    fieldCell(mL, y, w1, rh, 'Entre', informe.entreCalle1);
    fieldCell(mL + w1, y, frameW - w1, rh, 'y', informe.entreCalle2);
    y += rh; }

  checkPageBreak(rh);
  { const w1 = frameW * 0.38, w2 = frameW * 0.31;
    fieldCell(mL, y, w1, rh, 'Ciudad', informe.ciudad);
    fieldCell(mL + w1, y, w2, rh, 'Barrio', informe.barrio);
    fieldCell(mL + w1 + w2, y, frameW - w1 - w2, rh, 'Zona', informe.zona);
    y += rh; }

  checkPageBreak(rh);
  { const w = frameW / 2;
    fieldCell(mL, y, w, rh, 'Al mando del Acto', informe.alMandoDelActo);
    fieldCell(mL + w, y, w, rh, 'A cargo de la Compañía', informe.aCargoDeLaCompania);
    y += rh; }

  // ---------- Naturaleza de intervencion ----------
  { const h = 20, labelW = 32;
    checkPageBreak(h);
    rectAt(mL, y, labelW, h);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Naturaleza de', mL + 2, y + h / 2 - 1);
    doc.text('intervención:', mL + 2, y + h / 2 + 3);
    rectAt(mL + labelW, y, frameW - labelW, h);
    doc.setFontSize(8.3); doc.setFont('helvetica', 'normal');
    const colW = (frameW - labelW) / 2;
    const celdas: [string, string][] = [
      NATURALEZAS[0], NATURALEZAS[3], NATURALEZAS[1], NATURALEZAS[4], NATURALEZAS[2], NATURALEZAS[5],
    ];
    celdas.forEach(([clave, texto], i) => {
      const fila = Math.floor(i / 2), col = i % 2;
      dibujarCheckbox(doc, mL + labelW + 3 + col * colW, y + 5 + fila * 4.5, informe.naturalezaTipos.includes(clave), texto);
    });
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(mL + labelW + 3, y + h - 2.5, mL + frameW - 3, y + h - 2.5);
    doc.text(informe.naturalezaOtros || '', mL + labelW + 4, y + h - 3.3);
    doc.setDrawColor(0, 0, 0);
    y += h; }

  // ---------- Lugar ----------
  { const h = 13, labelW = 20;
    checkPageBreak(h);
    rectAt(mL, y, labelW, h);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Lugar:', mL + 2, y + h / 2 + 1.2);
    rectAt(mL + labelW, y, frameW - labelW, h);
    doc.setFontSize(8.3); doc.setFont('helvetica', 'normal');
    const colW = (frameW - labelW) / 4;
    LUGARES.forEach(([clave, texto], i) => {
      const fila = Math.floor(i / 4), col = i % 4;
      dibujarCheckbox(doc, mL + labelW + 3 + col * colW, y + 4.8 + fila * 5.2, informe.lugarTipos.includes(clave), texto);
    });
    y += h; }

  // ---------- Vehiculos involucrados ----------
  checkPageBreak(6.3);
  rectAt(mL, y, frameW, 6);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
  doc.text('VEHÍCULOS INVOLUCRADOS', pageWidth / 2, y + 4.2, { align: 'center' });
  y += 6;
  for (let n = 0; n < 3; n++) {
    const v = informe.vehiculos[n] || { tipo: '', marca: '', modelo: '', color: '', chapaNo: '', conductor: '', ci: '', edad: '', registroNo: '', municipio: '', domicilio: '' };
    const sh = 5.6;
    checkPageBreak(sh * 5);
    { const w1 = frameW * 0.34, w2 = frameW * 0.33;
      fieldCell(mL, y, w1, sh, 'Tipo', v.tipo);
      fieldCell(mL + w1, y, w2, sh, 'Marca', v.marca);
      fieldCell(mL + w1 + w2, y, frameW - w1 - w2, sh, 'Modelo', v.modelo);
      y += sh; }
    { const w1 = frameW * 0.5;
      fieldCell(mL, y, w1, sh, 'Color', v.color);
      fieldCell(mL + w1, y, frameW - w1, sh, 'Chapa N°', v.chapaNo);
      y += sh; }
    { const w1 = frameW * 0.65;
      fieldCell(mL, y, w1, sh, 'Nombre del Conductor', v.conductor);
      fieldCell(mL + w1, y, frameW - w1, sh, 'C.I. N°', v.ci);
      y += sh; }
    { const w1 = frameW * 0.34, w2 = frameW * 0.33;
      fieldCell(mL, y, w1, sh, 'Edad', v.edad);
      fieldCell(mL + w1, y, w2, sh, 'Registro N°', v.registroNo);
      fieldCell(mL + w1 + w2, y, frameW - w1 - w2, sh, 'Municipio', v.municipio);
      y += sh; }
    fieldCell(mL, y, frameW, sh, 'Domicilio', v.domicilio);
    y += sh;
  }

  // ---------- Heridos / Muertos ----------
  { const vacio = [{ nombre: '-', ci: '-', edad: '-', nacionalidad: '-' }];
    const filasHeridos = informe.heridos.length > 0 ? informe.heridos : vacio;
    const filasMuertos = informe.muertos.length > 0 ? informe.muertos : vacio;
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
      styles: { fontSize: 8, cellPadding: 1.6, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.25 },
      columnStyles: { 0: { cellWidth: 22 } },
      margin: { left: mL, right: pageWidth - mR },
    });
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    y = doc.lastAutoTable.finalY; }

  // N° total de accidentados / heridos / muertos
  checkPageBreak(rh);
  { const w = frameW / 3;
    fieldCell(mL, y, w, rh, 'Nº TOTAL DE ACCIDENTADOS', informe.totalAccidentados);
    fieldCell(mL + w, y, w, rh, 'HERIDOS', informe.totalHeridos);
    fieldCell(mL + 2 * w, y, w, rh, 'MUERTOS', informe.totalMuertos);
    y += rh; }

  // ================= PÁGINA 2 =================
  doc.addPage();
  y = 12;

  { const labelW = 33, fieldW = frameW - labelW; const subH = 6.3; const blockH = subH * 4;
    rectAt(mL, y, labelW, blockH);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('MATERIALES', mL + 2, y + blockH / 2 - 1.5);
    doc.text('UTILIZADOS:', mL + 2, y + blockH / 2 + 2.5);
    let fy = y;
    fieldCell(mL + labelW, fy, fieldW, subH, 'Móviles', informe.materialesUtilizadosMoviles); fy += subH;
    fieldCell(mL + labelW, fy, fieldW, subH, 'Menor', informe.materialesUtilizadosMenor); fy += subH;
    rectAt(mL + labelW, fy, fieldW, subH); fy += subH;
    fieldCell(mL + labelW, fy, fieldW, subH, 'Ajenos', informe.materialesUtilizadosAjenos);
    y += blockH; }

  for (const [label, valor] of [
    ['Otros de Apoyo', informe.otrosDeApoyo],
    ['Personal Policial a cargo de', informe.personalPolicialACargoDe],
    ['Ministerio Público oficiado por', informe.ministerioPublicoOficiadoPor],
    ['Otros datos de interés', informe.otrosDatosInteres],
  ] as const) {
    checkPageBreak(rh);
    fieldCell(mL, y, frameW, rh, label, valor);
    y += rh;
  }

  // Causas del accidente
  checkPageBreak(26);
  textAreaCell(mL, y, frameW, 26, 'CAUSAS DEL ACCIDENTE (breve explicación)', informe.causasAccidente);
  y += 26;

  // Desarrollo del informe
  { const h = 70;
    checkPageBreak(h);
    rectAt(mL, y, frameW, h);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('DESARROLLO DEL INFORME', pageWidth / 2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    const lineas = doc.splitTextToSize(informe.desarrolloDelInforme || '-', frameW - 5);
    let ty = y + 11;
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    for (let li = 0; ty < y + h - 2; li++) {
      doc.text(lineas[li] || '', mL + 2, ty);
      doc.line(mL + 2, ty + 1, mL + frameW - 2, ty + 1);
      ty += 6.2;
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    y += h; }

  // Nomina de Voluntarios | Croquis del Lugar
  { const hBloque = 92;
    checkPageBreak(hBloque);
    const w = frameW / 2; const startY = y;
    rectAt(mL, y, w, hBloque);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('NOMINA DE VOLUNTARIOS', mL + w / 2, y + 5, { align: 'center' });
    const tablaNomina = (startY2: number, cab: string, filas: string[][]) => autoTable(doc, {
      startY: startY2,
      head: [['Móvil', cab, 'Código']],
      body: filas.length > 0 ? filas : [['-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, lineWidth: 0.2 },
      margin: { left: mL + 2 },
      tableWidth: w - 4,
    });
    tablaNomina(y + 8, 'Conductor', informe.nominaConductores.map(c => [c.movil || '-', c.conductor || '-', c.codigo || '-']));
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    let ny = doc.lastAutoTable.finalY + 2.5;
    tablaNomina(ny, 'Combatiente', informe.nominaCombatientes.map(c => [c.movil || '-', c.combatiente || '-', c.codigo || '-']));
    // @ts-expect-error lastAutoTable se agrega dinamicamente por el plugin
    ny = doc.lastAutoTable.finalY + 4;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
    if (ny < startY + hBloque - 14) {
      doc.text(`A Cargo: ${informe.nominaACargo || '-'}`, mL + 2, ny);
      ny += 9;
      doc.line(mL + 2, ny, mL + 62, ny);
      ny += 4;
      doc.text(informe.nominaFirma || 'Firma', mL + 2, ny);
    }

    rectAt(mL + w, y, w, hBloque);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
    doc.text('CROQUIS DEL LUGAR', mL + w + w / 2, y + 5, { align: 'center' });
    const gridX = mL + w + 5, gridY = y + 9, gridW = w - 10, gap = 3;
    const cellW = (gridW - 2 * gap) / 3; const cellH = (hBloque - 13 - 2 * gap) / 3;
    for (let fila = 0; fila < 3; fila++) {
      for (let col = 0; col < 3; col++) {
        const cx = gridX + col * (cellW + gap);
        const cyBox = gridY + fila * (cellH + gap);
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.2);
        doc.rect(cx, cyBox, cellW, cellH);
        const url = informe.croquisFotos[fila * 3 + col];
        if (url) {
          const foto = await cargarImagenBase64(url);
          if (foto) {
            try {
              const props = doc.getImageProperties(foto);
              const ratio = props.width / props.height || 1;
              let w2 = cellW - 2, h2 = w2 / ratio;
              if (h2 > cellH - 2) { h2 = cellH - 2; w2 = h2 * ratio; }
              doc.addImage(foto, formatoDeDataUrl(foto), cx + (cellW - w2) / 2, cyBox + (cellH - h2) / 2, w2, h2);
            } catch { /* deja el recuadro vacio */ }
          }
        }
      }
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    y = startY + hBloque; }

  const nombreArchivo = `INFORME_DE_${(informe.tipoInforme || '10-41').replace(':', '-')}_${(informe.nServicio || 'sin_numero').replace(/[\\/]/g, '_')}_${(informe.fecha || '').replace(/\//g, '-')}.pdf`;
  doc.save(nombreArchivo);
}

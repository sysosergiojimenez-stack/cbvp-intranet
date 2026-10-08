import jsPDF from 'jspdf';
import { ORGANIZACION } from '@/config/organizacion';
import {
  CONDICION, MOTIVO, RESPIRACION, CORAZON, PIEL, ANTECEDENTES, PUPILAS, PULMONES, LESIONES,
  QUEMADURAS_PROFUNDIDAD, ASISTENCIA, MEDICACION, CIERRE, EXPLORACION, GLASGOW, LEYENDA_SIGLAS,
  SIGNOS_VITALES_FILAS, RESPONDIENTES_FILAS, clave,
  type HistoriaPrehospitalaria, type GrupoDef,
} from '@/lib/historiaPrehospitalariaDef';

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

export async function exportarHistoriaPrehospitalariaPdf(h: HistoriaPrehospitalaria) {
  const [escudo, superficie] = await Promise.all([
    cargarImagenBase64('/escudo-cbvp.png'),
    cargarImagenBase64('/quemaduras-superficie.png'),
  ]);

  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const mL = 10;
  const frameW = pageWidth - 20;
  let y = 10;

  const check = (g: string, k: string) => !!h.checks[clave(g, k)];
  const texto = (k: string) => h.textos[k] || '';

  // ---------- helpers de dibujo ----------
  const rectAt = (x: number, yTop: number, w: number, hh: number) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(x, yTop, w, hh);
  };
  const setNegrita = (size: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(0, 0, 0); };
  const setNormal = (size: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(0, 0, 0); };

  const casilla = (x: number, yBase: number, marcado: boolean, size = 3) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(x, yBase - size + 0.7, size, size);
    if (marcado) {
      const tamPrevio = doc.getFontSize();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size * 2.6);
      doc.text('X', x + size / 2, yBase - 0.1, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(tamPrevio);
    }
  };

  const titulo = (x: number, yTop: number, w: number, texto: string, hh = 5.5) => {
    rectAt(x, yTop, w, hh);
    setNegrita(8.5);
    doc.text(texto, x + w / 2, yTop + hh / 2 + 1.2, { align: 'center' });
  };

  const fieldCell = (x: number, yTop: number, w: number, hh: number, label: string, value: string) => {
    rectAt(x, yTop, w, hh);
    setNegrita(8);
    const labelTxt = label ? `${label}: ` : '';
    doc.text(labelTxt, x + 2, yTop + hh / 2 + 1.2);
    const labelW = doc.getTextWidth(labelTxt);
    setNormal(8);
    const fitted = doc.splitTextToSize(value || '', Math.max(w - labelW - 4, 8))[0] || '';
    doc.text(fitted, x + 2 + labelW, yTop + hh / 2 + 1.2);
  };

  // "Etiqueta: ......texto...... [x]" (Condicion / Motivo)
  const itemConDetalle = (x: number, yTop: number, w: number, hh: number, label: string, detalle: string, conDetalle: boolean, marcado: boolean, conCasilla: boolean) => {
    const base = yTop + hh / 2 + 1.2;
    setNormal(7.8);
    doc.text(`${label}:`, x + 2, base);
    const lw = doc.getTextWidth(`${label}: `);
    const finLinea = x + w - (conCasilla ? 7 : 2);
    if (conDetalle) {
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.15);
      doc.line(x + 2 + lw, base + 0.5, finLinea, base + 0.5);
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(detalle || '', finLinea - x - 2 - lw)[0] || '', x + 3 + lw, base - 0.2);
    }
    if (conCasilla) casilla(x + w - 5, base + 0.2, marcado);
  };

  // "Etiqueta ... [x]" (Respiracion, Corazon, Pupilas, ...)
  const itemCasillaDerecha = (x: number, yTop: number, w: number, hh: number, label: string, marcado: boolean) => {
    const base = yTop + hh / 2 + 1.2;
    setNormal(7.8);
    doc.text(label, x + 2, base);
    casilla(x + w - 5, base + 0.2, marcado);
  };

  const listaGrupo = (def: GrupoDef, x: number, yTop: number, w: number, rowH: number, filas: number) => {
    titulo(x, yTop, w, def.titulo);
    def.items.forEach((it, i) => {
      itemCasillaDerecha(x, yTop + 5.5 + i * rowH, w, rowH, it.label, check(def.grupo, it.key));
    });
    rectAt(x, yTop + 5.5, w, rowH * filas);
  };

  // ================= PÁGINA 1: HISTORIA =================
  if (escudo) {
    try {
      const props = doc.getImageProperties(escudo);
      const ratio = props.width / props.height || 1;
      doc.addImage(escudo, 'PNG', mL, y, 13 * ratio, 13);
    } catch { /* ignore */ }
  }
  setNegrita(12.5);
  doc.text(ORGANIZACION.nombreCompleto.toUpperCase(), pageWidth / 2 + 8, y + 5.5, { align: 'center' });
  setNormal(9);
  doc.text(`COMPAÑÍA: ${ORGANIZACION.compania}`, pageWidth / 2 + 8, y + 11, { align: 'center' });
  y += 16;
  setNegrita(14);
  doc.text('HISTORIA PREHOSPITALARIA', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  const rh = 6.3;
  { const w1 = 38, w2 = 36, w3 = 26;
    fieldCell(mL, y, w1, rh, 'N° Servicio', h.nServicio);
    fieldCell(mL + w1, y, w2, rh, 'Fecha', h.fecha);
    fieldCell(mL + w1 + w2, y, w3, rh, 'Móvil', h.movil);
    fieldCell(mL + w1 + w2 + w3, y, frameW - w1 - w2 - w3, rh, 'Dirección', h.direccion);
    y += rh; }
  { const w1 = 78, w2 = 24, w3 = 32;
    fieldCell(mL, y, w1, rh, 'Nombre', h.nombre);
    fieldCell(mL + w1, y, w2, rh, 'Edad', h.edad);
    rectAt(mL + w1 + w2, y, w3, rh);
    setNegrita(8);
    doc.text('Sexo:', mL + w1 + w2 + 2, y + rh / 2 + 1.2);
    setNormal(8);
    doc.text('M', mL + w1 + w2 + 13, y + rh / 2 + 1.2);
    casilla(mL + w1 + w2 + 16, y + rh / 2 + 1.7, h.sexo === 'M');
    doc.text('F', mL + w1 + w2 + 22, y + rh / 2 + 1.2);
    casilla(mL + w1 + w2 + 25, y + rh / 2 + 1.7, h.sexo === 'F');
    fieldCell(mL + w1 + w2 + w3, y, frameW - w1 - w2 - w3, rh, 'Destino', h.destino);
    y += rh; }

  // Condicion | Motivo de la llamada
  { const w = frameW / 2, rowH = 5.2, filas = MOTIVO.items.length;
    titulo(mL, y, w, CONDICION.titulo);
    titulo(mL + w, y, w, MOTIVO.titulo);
    rectAt(mL, y + 5.5, w, rowH * filas);
    rectAt(mL + w, y + 5.5, w, rowH * filas);
    CONDICION.items.forEach((it, i) => {
      itemConDetalle(mL, y + 5.5 + i * rowH, w, rowH, it.label, texto(clave(CONDICION.grupo, it.key)), !!it.detalle, check(CONDICION.grupo, it.key), !it.sinCasilla);
    });
    MOTIVO.items.forEach((it, i) => {
      itemConDetalle(mL + w, y + 5.5 + i * rowH, w, rowH, it.label, texto(clave(MOTIVO.grupo, it.key)), !!it.detalle, check(MOTIVO.grupo, it.key), !it.sinCasilla);
    });
    y += 5.5 + rowH * filas; }

  fieldCell(mL, y, frameW, rh, 'PRIORIDAD DE TRIAGE', h.prioridadTriage);
  y += rh;

  // Signos vitales | Respiracion | Corazon | Piel
  { const rowH = 5.2, filas = 7;
    const wSv = frameW * 0.4, wC = (frameW - wSv) / 3;
    titulo(mL, y, wSv, 'SIGNOS VITALES');
    const colW = wSv / 5;
    ['Hora', 'F.C.', 'F.R.', 'P.A.', 'T°'].forEach((t, i) => {
      rectAt(mL + i * colW, y + 5.5, colW, rowH);
      setNegrita(7.5);
      doc.text(t, mL + i * colW + colW / 2, y + 5.5 + rowH / 2 + 1.1, { align: 'center' });
    });
    for (let f = 0; f < SIGNOS_VITALES_FILAS; f++) {
      const s = h.signosVitales[f] || { hora: '', fc: '', fr: '', pa: '', temp: '' };
      [s.hora, s.fc, s.fr, s.pa, s.temp].forEach((v, i) => {
        rectAt(mL + i * colW, y + 5.5 + rowH * (f + 1), colW, rowH);
        setNormal(7.8);
        doc.text(v || '', mL + i * colW + colW / 2, y + 5.5 + rowH * (f + 1) + rowH / 2 + 1.1, { align: 'center' });
      });
    }
    // el bloque de signos vitales ocupa 1 + SIGNOS_VITALES_FILAS filas; completa hasta `filas`
    rectAt(mL, y + 5.5 + rowH * (SIGNOS_VITALES_FILAS + 1), wSv, rowH * (filas - SIGNOS_VITALES_FILAS - 1));
    [RESPIRACION, CORAZON, PIEL].forEach((def, i) => listaGrupo(def, mL + wSv + i * wC, y, wC, rowH, filas));
    y += 5.5 + rowH * filas; }

  // Antecedentes | Pupilas | Pulmones | Lesiones
  { const rowH = 5.2, filas = 6;
    const wA = frameW * 0.4, wC = (frameW - wA) / 3;
    titulo(mL, y, wA, 'ANTECEDENTES');
    rectAt(mL, y + 5.5, wA, rowH * filas);
    ANTECEDENTES.items.forEach((it, i) => {
      const col = i % 2, fila = Math.floor(i / 2);
      const cw = wA / 2;
      itemCasillaDerecha(mL + col * cw, y + 5.5 + fila * rowH, cw, rowH, it.label, check(ANTECEDENTES.grupo, it.key));
    });
    [PUPILAS, PULMONES, LESIONES].forEach((def, i) => listaGrupo(def, mL + wA + i * wC, y, wC, rowH, filas));
    y += 5.5 + rowH * filas; }

  // Glasgow | Exploracion corporal
  { const w = frameW / 2, rowH = 4.5, filas = 15;
    titulo(mL, y, w, 'ESCALA DE COMA GLASGOW');
    titulo(mL + w, y, w, 'EXPLORACIÓN CORPORAL');
    const top = y + 5.5;
    const labelW = 8;
    let fy = top;
    GLASGOW.forEach(g => {
      const bloqueH = g.opciones.length * rowH;
      rectAt(mL, fy, labelW, bloqueH);
      setNegrita(5.8);
      doc.text(g.titulo, mL + 5, fy + bloqueH / 2 + doc.getTextWidth(g.titulo) / 2, { angle: 90 });
      g.opciones.forEach(([etiqueta, puntos], i) => {
        const ry = fy + i * rowH;
        rectAt(mL + labelW, ry, w - labelW, rowH);
        setNormal(7.8);
        doc.text(`${etiqueta}:`, mL + labelW + 2, ry + rowH / 2 + 1.1);
        doc.text(String(puntos), mL + w - 8, ry + rowH / 2 + 1.1, { align: 'center' });
        if (h[g.campo] === puntos) {
          doc.setLineWidth(0.5);
          doc.ellipse(mL + w - 8, ry + rowH / 2, 2.4, 1.9);
          doc.setLineWidth(0.25);
        }
      });
      fy += bloqueH;
    });
    rectAt(mL, fy, w, 6);
    const total = (h.glasgowOjos ?? 0) + (h.glasgowVerbal ?? 0) + (h.glasgowMotora ?? 0);
    setNegrita(8);
    doc.text(`TOTAL:  ${total || ''} / 15`, mL + 3, fy + 4.2);
    setNormal(8);
    doc.text('No se verificó', mL + w - 30, fy + 4.2);
    casilla(mL + w - 8, fy + 4.7, check('glasgow', 'noVerifico'));

    const altoTotal = rowH * filas + 6;
    rectAt(mL + w, top, w, altoTotal);
    const paso = altoTotal / EXPLORACION.length;
    EXPLORACION.forEach((e, i) => {
      const ey = top + i * paso;
      setNegrita(7.8);
      doc.text(`${e.label}:`, mL + w + 2, ey + 4.5);
      setNormal(7.5);
      doc.text(doc.splitTextToSize(texto(clave('expl', e.key)), w - 6).slice(0, 3), mL + w + 2, ey + 8.2);
    });
    y = top + altoTotal; }

  // ================= PÁGINA 2: QUEMADURAS Y ATENCIÓN =================
  doc.addPage();
  y = 10;

  // Superficie corporal | Quemaduras
  { const hBloque = 88, w = frameW / 2;
    rectAt(mL, y, w, hBloque);
    if (superficie) {
      try {
        const props = doc.getImageProperties(superficie);
        const ratio = props.width / props.height || 1;
        let ih = hBloque - 2, iw = ih * ratio;
        if (iw > w - 2) { iw = w - 2; ih = iw / ratio; }
        doc.addImage(superficie, 'PNG', mL + (w - iw) / 2, y + (hBloque - ih) / 2, iw, ih);
      } catch { /* ignore */ }
    }
    const x2 = mL + w;
    rectAt(x2, y, w, hBloque);
    let ry = y;
    setNegrita(9);
    doc.text(QUEMADURAS_PROFUNDIDAD.titulo, x2 + 3, ry + 5.5);
    ry += 8;
    QUEMADURAS_PROFUNDIDAD.items.forEach(it => {
      setNormal(8.5);
      doc.text(`${it.label}:`, x2 + 3, ry + 4);
      casilla(x2 + 36, ry + 4.3, check('quemProf', it.key), 3.4);
      ry += 6.5;
    });
    ry += 4;
    setNegrita(9);
    doc.text('QUEMADURAS (Según su extensión)', x2 + 3, ry + 3);
    ry += 8;
    setNormal(8.5);
    doc.text('100/', x2 + 3, ry + 3);
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15);
    doc.line(x2 + 11, ry + 3.5, x2 + 50, ry + 3.5);
    doc.text(texto('quemExt_porcentaje'), x2 + 12, ry + 2.8);
    doc.text('%', x2 + 52, ry + 3);
    ry += 8;
    [['termica', 'Térmica'], ['quimica', 'Química']].forEach(([k, l], i) => {
      doc.text(`${l}:`, x2 + 3 + i * 40, ry + 3);
      casilla(x2 + 20 + i * 40, ry + 3.3, check('quemExt', k), 3.4);
    });
    ry += 6.5;
    [['electrica', 'Eléctrica'], ['radiante', 'Radiante']].forEach(([k, l], i) => {
      doc.text(`${l}:`, x2 + 3 + i * 40, ry + 3);
      casilla(x2 + 20 + i * 40, ry + 3.3, check('quemExt', k), 3.4);
    });
    ry += 8;
    doc.text('Observación:', x2 + 3, ry + 3);
    doc.setDrawColor(150, 150, 150);
    doc.line(x2 + 26, ry + 3.5, x2 + w - 3, ry + 3.5);
    doc.line(x2 + 3, ry + 9.5, x2 + w - 3, ry + 9.5);
    const lineasObs = doc.splitTextToSize(texto('quemExt_observacion'), w - 30);
    doc.setFontSize(7.5);
    doc.text(lineasObs[0] || '', x2 + 27, ry + 2.8);
    doc.text(doc.splitTextToSize(lineasObs.slice(1).join(' '), w - 8).slice(0, 1), x2 + 3, ry + 8.8);
    ry += 13;
    setNormal(8.5);
    doc.text('No se verificó:', x2 + 3, ry + 3);
    casilla(x2 + 29, ry + 3.3, check('quemExt', 'noVerifico'), 3.4);
    y += hBloque; }

  // Comentarios y DX | Asistencia
  { const hBloque = 50, w1 = frameW * 0.55, w2 = frameW - w1;
    rectAt(mL, y, w1, hBloque);
    setNegrita(9);
    doc.text('COMENTARIOS Y DX PRESUNTIVO:', mL + 2, y + 5);
    setNormal(8);
    doc.text(doc.splitTextToSize(texto('comentarios'), w1 - 5).slice(0, 10), mL + 2, y + 10.5);

    const x2 = mL + w1;
    rectAt(x2, y, w2, hBloque);
    setNegrita(9);
    doc.text(ASISTENCIA.titulo, x2 + 2, y + 5);
    let ay = y + 10;
    for (let f = 0; f < 3; f++) {
      [0, 1].forEach(c => {
        const it = ASISTENCIA.items[f * 2 + c];
        const cx = x2 + 2 + c * (w2 / 2);
        setNormal(8);
        doc.text(`${it.label}:`, cx, ay);
        casilla(cx + (w2 / 2) - 10, ay + 0.3, check(ASISTENCIA.grupo, it.key), 3.2);
      });
      ay += 5.2;
    }
    setNormal(8);
    doc.text('Desfibrilación Joules:', x2 + 2, ay);
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15);
    doc.line(x2 + 33, ay + 0.5, x2 + 50, ay + 0.5);
    doc.line(x2 + 52, ay + 0.5, x2 + 70, ay + 0.5);
    doc.text('/', x2 + 51, ay);
    doc.text(texto('asistencia_desfib1'), x2 + 34, ay - 0.3);
    doc.text(texto('asistencia_desfib2'), x2 + 53, ay - 0.3);
    ay += 5.5;
    doc.text('Otros:', x2 + 2, ay);
    const lineasOtros = doc.splitTextToSize(texto('asistencia_otros'), w2 - 14);
    for (let i = 0; i < 4; i++) {
      const ly = ay + i * 5.2;
      doc.line(x2 + 12, ly + 0.5, x2 + w2 - 2, ly + 0.5);
      doc.setFontSize(7.5);
      doc.text(lineasOtros[i] || '', x2 + 13, ly - 0.3);
    }
    y += hBloque; }

  // Medicacion | Rehusa asistencia
  { const hBloque = 42, w1 = frameW * 0.55, w2 = frameW - w1;
    rectAt(mL, y, w1, hBloque);
    setNegrita(9);
    doc.text(MEDICACION.titulo, mL + 2, y + 5);
    MEDICACION.items.forEach((it, i) => {
      const col = i % 3, fila = Math.floor(i / 3);
      const cx = mL + 2 + col * (w1 / 3);
      setNormal(8);
      doc.text(`${it.label}:`, cx, y + 11 + fila * 5.2);
      casilla(cx + 14, y + 11.3 + fila * 5.2, check(MEDICACION.grupo, it.key), 3.2);
    });
    const lineaCampo = (label: string, valor: string, ly: number, x1: number, x2: number) => {
      setNormal(8);
      doc.text(label, x1, ly);
      const lw = doc.getTextWidth(label) + 1;
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15);
      doc.line(x1 + lw, ly + 0.5, x2, ly + 0.5);
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(valor, x2 - x1 - lw)[0] || '', x1 + lw + 1, ly - 0.3);
    };
    lineaCampo('Fármacos suministrados:', texto('medicacion_farmacos'), y + 24, mL + 2, mL + w1 - 2);
    lineaCampo('Ordenado por médico:', texto('medicacion_medico'), y + 31, mL + 2, mL + w1 - 2);
    lineaCampo('Firma:', texto('medicacion_firma'), y + 38, mL + 2, mL + w1 * 0.6);
    lineaCampo('Reg. N°:', texto('medicacion_regNo'), y + 38, mL + w1 * 0.62, mL + w1 - 2);

    const x2 = mL + w1;
    rectAt(x2, y, w2, hBloque);
    casilla(x2 + 2, y + 6, check('rehusa', 'rehusa'), 3.2);
    setNormal(8);
    doc.text(doc.splitTextToSize('El paciente se rehúsa a recibir asistencia del personal bombero', w2 - 10), x2 + 7, y + 5.3);
    setNormal(8);
    doc.text('Testigo', x2 + w2 * 0.2, y + 25);
    doc.text('Paciente', x2 + w2 * 0.65, y + 25);
    lineaCampo('C.I. Nº', texto('rehusa_testigoCI'), y + 36, x2 + 2, x2 + w2 / 2 - 2);
    lineaCampo('C.I. Nº', texto('rehusa_pacienteCI'), y + 36, x2 + w2 / 2 + 1, x2 + w2 - 2);
    y += hBloque; }

  // El paciente queda en / A cargo de
  { const w1 = frameW * 0.58, w2 = frameW * 0.18;
    fieldCell(mL, y, w1, rh, 'El paciente queda en', texto('queda_en'));
    fieldCell(mL + w1, y, w2, rh, 'Hora', texto('queda_hora'));
    fieldCell(mL + w1 + w2, y, frameW - w1 - w2, rh, 'Estado', texto('queda_estado'));
    y += rh;
    fieldCell(mL, y, w1 + w2, rh, 'A cargo de (la) Dr/a.', texto('queda_aCargo'));
    fieldCell(mL + w1 + w2, y, frameW - w1 - w2, rh, 'Firma', texto('queda_firma'));
    y += rh; }

  // Dotacion de servicio | Objetos de valor
  { const hBloque = 58, w1 = frameW * 0.55, w2 = frameW - w1;
    rectAt(mL, y, w1, hBloque);
    setNegrita(9);
    doc.text('DOTACIÓN DE SERVICIO', mL + 2, y + 5);
    setNegrita(8.5);
    doc.text('Conductor', mL + 2, y + 11);
    const filaDotacion = (nombre: string, cod: string, ly: number) => {
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15);
      doc.line(mL + 2, ly + 0.5, mL + w1 * 0.66, ly + 0.5);
      setNormal(8);
      doc.text('Cód.:', mL + w1 * 0.68, ly);
      doc.line(mL + w1 * 0.68 + 9, ly + 0.5, mL + w1 - 2, ly + 0.5);
      doc.setFontSize(7.5);
      doc.text(nombre, mL + 3, ly - 0.3);
      doc.text(cod, mL + w1 * 0.68 + 10, ly - 0.3);
    };
    filaDotacion(texto('dotacion_conductor'), texto('dotacion_conductorCod'), y + 17);
    setNegrita(8.5);
    doc.text('Respondientes', mL + 2, y + 25);
    for (let i = 0; i < RESPONDIENTES_FILAS; i++) {
      const r = h.respondientes[i] || { nombre: '', cod: '' };
      filaDotacion(r.nombre, r.cod, y + 32 + i * 5.5);
    }
    // Cierre
    { const base = y + hBloque - 3;
      let cx = mL + 2;
      CIERRE.items.forEach(it => {
        setNormal(8);
        doc.text(`${it.label}:`, cx, base);
        const lw = doc.getTextWidth(`${it.label}: `);
        casilla(cx + lw + 0.5, base + 0.3, check(CIERRE.grupo, it.key), 3.2);
        cx += lw + 8;
      });
    }

    const x2 = mL + w1;
    rectAt(x2, y, w2, hBloque);
    setNormal(8);
    doc.text('Objetos de valor del Paciente (detallar):', x2 + 2, y + 5);
    const lineasObj = doc.splitTextToSize(texto('objetosValor'), w2 - 6);
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15);
    for (let i = 0; i < 4; i++) {
      const ly = y + 12 + i * 5.5;
      doc.line(x2 + 2, ly + 0.5, x2 + w2 - 2, ly + 0.5);
      doc.setFontSize(7.5);
      doc.text(lineasObj[i] || '', x2 + 3, ly - 0.3);
    }
    const campoDerecha = (label: string, valor: string, ly: number) => {
      setNormal(8.5);
      doc.text(label, x2 + 2, ly);
      const lw = doc.getTextWidth(label) + 1;
      doc.line(x2 + 2 + lw, ly + 0.5, x2 + w2 - 2, ly + 0.5);
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(valor, w2 - lw - 6)[0] || '', x2 + 3 + lw, ly - 0.3);
    };
    campoDerecha('Entregado a:', texto('entregadoA'), y + 38);
    campoDerecha('A Cargo:', texto('aCargo'), y + 46);
    campoDerecha('Firma:', texto('firma'), y + 54);
    y += hBloque; }

  // Leyenda de siglas
  { setNormal(5.6);
    const colW = frameW / 3;
    LEYENDA_SIGLAS.forEach((col, i) => {
      col.forEach((linea, j) => {
        const [sigla, ...resto] = linea.split(': ');
        const lx = mL + 2 + i * colW, ly = y + 4 + j * 2.7;
        doc.setFont('helvetica', 'bold');
        doc.text(`${sigla}:`, lx, ly);
        const sw = doc.getTextWidth(`${sigla}: `);
        doc.setFont('helvetica', 'normal');
        doc.text(resto.join(': '), lx + sw, ly);
      });
    });
  }

  const nombreArchivo = `HISTORIA_PREHOSPITALARIA_${(h.nServicio || 'sin_numero').replace(/[\\/]/g, '_')}_${(h.fecha || '').replace(/\//g, '-')}.pdf`;
  doc.save(nombreArchivo);
}

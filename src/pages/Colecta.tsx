import { useEffect, useState } from 'react';
import { PiggyBank, FileDown, Plus, Minus, Trash2, ArrowRightLeft } from 'lucide-react';
import {
  BILLETES, MONEDAS, aEntero, fechaISOHoy, filasNumeradas, formatearGs, generarId, numeroCorrelativo,
  nuevaActa, totalesConteo, totalFilasResumen,
  type Acta, type Colecta as ColectaDatos, type ConteoBloque, type FilaDistribucion, type FilaPos, type FilaTransferencia,
} from '@/lib/colecta';
import { exportarColectaPdf, FORMATOS_COLECTA, type DatosColecta, type FormatoColecta } from '@/lib/exportarColectaPdf';
import { ORGANIZACION } from '@/config/organizacion';

const STORAGE_KEY = 'cbvp_colectas_v2';
const STORAGE_KEY_V1 = 'cbvp_colecta_v1';

function colectaVacia(anio: string): ColectaDatos {
  return {
    id: generarId(),
    anio,
    general: { compania: ORGANIZACION.compania, ciudad: 'Asunción', fecha: fechaISOHoy(), local: '' },
    distribucion: filasNumeradas<FilaDistribucion>(15, n => ({ n, responsable: '', ci: '', telefono: '' })),
    conteo: { alcancia: { numero: '', cantidades: {} }, sobre: { numero: '', cantidades: {} } },
    actas: [nuevaActa(1)],
    pos: filasNumeradas<FilaPos>(5, n => ({ n, desde: '', hasta: '', monto: '' })),
    transferencias: filasNumeradas<FilaTransferencia>(5, n => ({ n, comprobante: '', banco: '', monto: '' })),
  };
}

// Los datos de la version anterior (una sola colecta sin año, con un solo
// "resumen") se migran una vez a Colecta 2026, con ese resumen como su
// primera acta de conteo, para no perder lo que ya estaba cargado.
function migrarV1(): ColectaDatos | null {
  try {
    const crudo = localStorage.getItem(STORAGE_KEY_V1);
    if (!crudo) return null;
    const v1 = JSON.parse(crudo);
    const base = colectaVacia('2026');
    return {
      ...base,
      general: v1.general ?? base.general,
      distribucion: Array.isArray(v1.distribucion) ? v1.distribucion : base.distribucion,
      conteo: v1.conteo ?? base.conteo,
      actas: [{
        id: generarId(),
        titulo: 'Acta N° 1',
        fecha: v1.general?.fecha || fechaISOHoy(),
        filas: Array.isArray(v1.resumen) ? v1.resumen : base.actas[0].filas,
      }],
      pos: Array.isArray(v1.pos) ? v1.pos : base.pos,
      transferencias: Array.isArray(v1.transferencias) ? v1.transferencias : base.transferencias,
    };
  } catch {
    return null;
  }
}

interface EstadoColectas { colectas: ColectaDatos[]; activaId: string }

// Los datos se guardan solo en este navegador (no van al servidor).
function cargarGuardadas(): EstadoColectas {
  try {
    const crudo = localStorage.getItem(STORAGE_KEY);
    if (crudo) {
      const data = JSON.parse(crudo);
      if (Array.isArray(data.colectas) && data.colectas.length > 0) {
        const activaId = data.colectas.some((c: ColectaDatos) => c.id === data.activaId) ? data.activaId : data.colectas[0].id;
        return { colectas: data.colectas, activaId };
      }
    }
  } catch {
    /* ignore */
  }
  const inicial = migrarV1() || colectaVacia('2026');
  return { colectas: [inicial], activaId: inicial.id };
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/20 focus:border-cbvp-red/50 focus:outline-none';
const thCls = 'px-2 py-2 text-left text-xs font-medium text-white/50 uppercase tracking-wider';

function formatearMonto(valor: string): string {
  const n = aEntero(valor);
  return valor.trim() === '' ? '' : formatearGs(n);
}

function ControlFilas({ cantidad, onAgregar, onQuitar }: { cantidad: number; onAgregar: () => void; onQuitar: () => void }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <button onClick={onAgregar} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs flex items-center gap-1.5 transition-colors"><Plus className="w-3.5 h-3.5" /> Agregar fila</button>
      <button onClick={onQuitar} disabled={cantidad <= 1} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/70 text-xs flex items-center gap-1.5 transition-colors"><Minus className="w-3.5 h-3.5" /> Quitar última</button>
      <span className="text-xs text-white/30">{cantidad} filas</span>
    </div>
  );
}

export default function Colecta() {
  const [estado, setEstado] = useState<EstadoColectas>(cargarGuardadas);
  const [tab, setTab] = useState<FormatoColecta>('distribucion');
  const [exportando, setExportando] = useState(false);
  const [actaDestinoId, setActaDestinoId] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); } catch { /* sin almacenamiento */ }
  }, [estado]);

  const colectas = estado.colectas;
  const colectaActiva = colectas.find(c => c.id === estado.activaId) ?? colectas[0];

  // Si la acta elegida como destino de "Pasar al Resumen" ya no existe
  // (se borro, o se cambio de colecta), cae a la ultima acta disponible.
  useEffect(() => {
    if (!colectaActiva.actas.some(a => a.id === actaDestinoId)) {
      setActaDestinoId(colectaActiva.actas[colectaActiva.actas.length - 1]?.id || '');
    }
  }, [colectaActiva, actaDestinoId]);

  const actualizarActiva = (fn: (c: ColectaDatos) => ColectaDatos) =>
    setEstado(e => ({ ...e, colectas: e.colectas.map(c => (c.id === e.activaId ? fn(c) : c)) }));

  const construirDatosColecta = (c: ColectaDatos, actasOverride?: Acta[]): DatosColecta => ({
    general: c.general,
    distribucion: c.distribucion,
    conteo: c.conteo,
    actas: (actasOverride ?? c.actas).map(a => ({ titulo: a.titulo, fecha: a.fecha, filas: a.filas })),
    pos: c.pos,
    transferencias: c.transferencias,
  });

  const exportar = async (formato: FormatoColecta | 'todos') => {
    setExportando(true);
    try {
      await exportarColectaPdf(formato, construirDatosColecta(colectaActiva));
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setExportando(false);
    }
  };

  const exportarActa = async (formato: FormatoColecta, actaId: string) => {
    const acta = colectaActiva.actas.find(a => a.id === actaId);
    if (!acta) return;
    setExportando(true);
    try {
      await exportarColectaPdf(formato, construirDatosColecta(colectaActiva, [acta]));
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setExportando(false);
    }
  };

  const limpiar = () => {
    if (!confirm(`Borrar todos los datos cargados de la Colecta ${colectaActiva.anio}?`)) return;
    actualizarActiva(c => ({ ...colectaVacia(c.anio), id: c.id }));
  };

  const crearColecta = () => {
    const anioSugerido = String(new Date().getFullYear() + 1);
    const anio = window.prompt('Año de la nueva colecta:', anioSugerido);
    if (!anio || !anio.trim()) return;
    if (colectas.some(c => c.anio === anio.trim())) { alert(`Ya existe una Colecta ${anio.trim()}.`); return; }
    const nueva = colectaVacia(anio.trim());
    setEstado(e => ({ colectas: [...e.colectas, nueva], activaId: nueva.id }));
  };

  const setGeneral = (campo: keyof ColectaDatos['general'], valor: string) =>
    actualizarActiva(c => ({ ...c, general: { ...c.general, [campo]: valor } }));

  // ---- edicion de listas (distribucion / pos / transferencias) ----
  const actualizarFila = <K extends 'distribucion' | 'pos' | 'transferencias'>(
    lista: K, idx: number, campo: string, valor: string,
  ) => actualizarActiva(c => {
    const filas = [...c[lista]] as unknown as Record<string, string>[];
    filas[idx] = { ...filas[idx], [campo]: valor };
    return { ...c, [lista]: filas };
  });
  const agregarFila = (lista: 'distribucion' | 'pos' | 'transferencias') => actualizarActiva(c => {
    const n = numeroCorrelativo(c[lista].length);
    const nueva = { distribucion: { n, responsable: '', ci: '', telefono: '' }, pos: { n, desde: '', hasta: '', monto: '' }, transferencias: { n, comprobante: '', banco: '', monto: '' } }[lista];
    return { ...c, [lista]: [...c[lista], nueva] };
  });
  const quitarFila = (lista: 'distribucion' | 'pos' | 'transferencias') =>
    actualizarActiva(c => (c[lista].length > 1 ? { ...c, [lista]: c[lista].slice(0, -1) } : c));

  // ---- actas de conteo (varias por colecta) ----
  const crearActa = () => actualizarActiva(c => ({ ...c, actas: [...c.actas, nuevaActa(c.actas.length + 1)] }));
  const quitarActa = (actaId: string) => {
    if (colectaActiva.actas.length <= 1) return;
    if (!confirm('Eliminar esta acta de conteo? Se pierden sus datos.')) return;
    actualizarActiva(c => ({ ...c, actas: c.actas.filter(a => a.id !== actaId) }));
  };
  const renombrarActa = (actaId: string, titulo: string) =>
    actualizarActiva(c => ({ ...c, actas: c.actas.map(a => (a.id === actaId ? { ...a, titulo } : a)) }));
  const setFechaActa = (actaId: string, fecha: string) =>
    actualizarActiva(c => ({ ...c, actas: c.actas.map(a => (a.id === actaId ? { ...a, fecha } : a)) }));
  const actualizarFilaActa = (actaId: string, idx: number, campo: 'n' | 'billetes' | 'monedas', valor: string) =>
    actualizarActiva(c => ({
      ...c,
      actas: c.actas.map(a => (a.id === actaId ? { ...a, filas: a.filas.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)) } : a)),
    }));
  const agregarFilaActa = (actaId: string) =>
    actualizarActiva(c => ({
      ...c,
      actas: c.actas.map(a => (a.id === actaId ? { ...a, filas: [...a.filas, { n: numeroCorrelativo(a.filas.length), billetes: '', monedas: '' }] } : a)),
    }));
  const quitarFilaActa = (actaId: string) =>
    actualizarActiva(c => ({
      ...c,
      actas: c.actas.map(a => (a.id === actaId && a.filas.length > 1 ? { ...a, filas: a.filas.slice(0, -1) } : a)),
    }));

  // ---- conteo (panel de carga de una alcancia/sobre a la vez) ----
  const setConteo = (bloque: 'alcancia' | 'sobre', cambio: Partial<ConteoBloque>) =>
    actualizarActiva(c => ({ ...c, conteo: { ...c.conteo, [bloque]: { ...c.conteo[bloque], ...cambio } } }));
  const setCantidad = (bloque: 'alcancia' | 'sobre', denom: number, valor: string) =>
    setConteo(bloque, { cantidades: { ...colectaActiva.conteo[bloque].cantidades, [String(denom)]: valor.replace(/[^\d]/g, '') } });

  // Pasa los totales de la alcancia contada a la fila del acta elegida como destino.
  const pasarAlResumen = () => {
    const numero = colectaActiva.conteo.alcancia.numero.trim();
    if (!numero) { alert('Cargá el N° de alcancía antes de pasarla al resumen.'); return; }
    if (!actaDestinoId) { alert('No hay ningún acta de conteo para recibirla.'); return; }
    const n = /^\d+$/.test(numero) ? numero.padStart(3, '0') : numero;
    const t = totalesConteo(colectaActiva.conteo.alcancia);
    const actaDestino = colectaActiva.actas.find(a => a.id === actaDestinoId);
    actualizarActiva(c => ({
      ...c,
      actas: c.actas.map(a => {
        if (a.id !== actaDestinoId) return a;
        const idx = a.filas.findIndex(f => f.n === n);
        const fila = { n, billetes: String(t.billetes), monedas: String(t.monedas) };
        const filas = idx >= 0 ? a.filas.map((f, i) => (i === idx ? fila : f)) : [...a.filas, fila];
        return { ...a, filas };
      }),
    }));
    alert(`Alcancía ${n} agregada a "${actaDestino?.titulo || 'el acta'}".`);
  };

  const panelConteo = (bloque: 'alcancia' | 'sobre', titulo: string, rotuloNumero: string) => {
    const b = colectaActiva.conteo[bloque];
    const t = totalesConteo(b);
    const seccion = (nombre: string, denoms: number[], total: number) => (
      <div className="mb-3">
        <p className="text-xs font-semibold text-cbvp-yellow mb-1">{nombre}</p>
        <table className="w-full text-sm">
          <thead><tr><th className={thCls}>Denominación</th><th className={thCls}>Cantidad</th><th className={`${thCls} text-right`}>Subtotal</th></tr></thead>
          <tbody>
            {denoms.map(dn => (
              <tr key={dn} className="border-t border-white/5">
                <td className="px-2 py-1 text-white/70 font-mono">{formatearGs(dn)}</td>
                <td className="px-2 py-1 w-28"><input type="text" inputMode="numeric" value={b.cantidades[String(dn)] || ''} onChange={e => setCantidad(bloque, dn, e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-1 text-right text-white/80 font-mono">{b.cantidades[String(dn)] ? formatearGs(dn * aEntero(b.cantidades[String(dn)])) : ''}</td>
              </tr>
            ))}
            <tr className="border-t border-white/10"><td colSpan={2} className="px-2 py-1.5 text-white/60 font-semibold">Total {nombre}</td><td className="px-2 py-1.5 text-right text-white font-mono font-semibold">{formatearGs(total)}</td></tr>
          </tbody>
        </table>
      </div>
    );
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">{titulo}</h3>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-white/50 shrink-0">{rotuloNumero}</label>
          <input type="text" value={b.numero} onChange={e => setConteo(bloque, { numero: e.target.value })} className={`${inputCls} max-w-[120px]`} />
        </div>
        {seccion('Billetes', BILLETES, t.billetes)}
        {seccion('Monedas', MONEDAS, t.monedas)}
        <div className="flex items-center justify-between rounded-lg bg-cbvp-yellow/10 border border-cbvp-yellow/20 px-3 py-2">
          <span className="text-sm text-white/70 font-semibold">{bloque === 'alcancia' ? 'Total Alcancía + Billetes' : 'Total Sobre'}</span>
          <span className="text-base text-cbvp-yellow font-mono font-bold">{formatearGs(t.total)}</span>
        </div>
        {bloque === 'alcancia' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {colectaActiva.actas.length > 1 && (
              <select value={actaDestinoId} onChange={e => setActaDestinoId(e.target.value)} className={`${inputCls} max-w-[200px]`}>
                {colectaActiva.actas.map(a => <option key={a.id} value={a.id}>{a.titulo}</option>)}
              </select>
            )}
            <button onClick={pasarAlResumen} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs flex items-center gap-2 transition-colors">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Pasar al Resumen y Acta de conteo
            </button>
          </div>
        )}
      </div>
    );
  };

  const totalActas = colectaActiva.actas.reduce((s, a) => s + totalFilasResumen(a.filas), 0);
  const totalPos = colectaActiva.pos.reduce((s, f) => s + aEntero(f.monto), 0);
  const totalTransf = colectaActiva.transferencias.reduce((s, f) => s + aEntero(f.monto), 0);
  const totalGeneral = totalActas + totalPos + totalTransf;

  const formatoActual = FORMATOS_COLECTA.find(f => f.id === tab)!;
  const colectasOrdenadas = [...colectas].sort((a, b) => b.anio.localeCompare(a.anio, undefined, { numeric: true }));

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><PiggyBank className="w-5 h-5 text-cbvp-red" /> Colecta</h1>
        <div className="flex items-center gap-2">
          <button onClick={limpiar} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/50 hover:text-cbvp-red text-xs flex items-center gap-2 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Limpiar datos</button>
          <button onClick={() => exportar('todos')} disabled={exportando} className="px-4 py-2 rounded-lg bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green text-sm flex items-center gap-2 transition-colors"><FileDown className="w-4 h-4" /> Exportar los 6 formatos</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/40 uppercase tracking-wider mr-1">Colecta:</span>
        {colectasOrdenadas.map(c => (
          <button key={c.id} onClick={() => setEstado(e => ({ ...e, activaId: c.id }))} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${c.id === estado.activaId ? 'bg-cbvp-red text-white font-semibold' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
            Colecta {c.anio}
          </button>
        ))}
        <button onClick={crearColecta} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs flex items-center gap-1.5 transition-colors"><Plus className="w-3.5 h-3.5" /> Nueva Colecta</button>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Datos generales (van en todos los formatos de esta colecta)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="text-xs text-white/40 mb-1 block">Compañía</label><input type="text" value={colectaActiva.general.compania} onChange={e => setGeneral('compania', e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Ciudad (actas)</label><input type="text" value={colectaActiva.general.ciudad} onChange={e => setGeneral('ciudad', e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Fecha (actas)</label><input type="date" value={colectaActiva.general.fecha} onChange={e => setGeneral('fecha', e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Local (actas)</label><input type="text" value={colectaActiva.general.local} onChange={e => setGeneral('local', e.target.value)} placeholder="Dejar vacío para completar a mano" className={inputCls} /></div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Total general de la Colecta {colectaActiva.anio}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
            <span className="block text-xs text-white/50 mb-1">Actas de Conteo (alcancías)</span>
            <span className="text-lg font-mono font-semibold text-white">{formatearGs(totalActas)}</span>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
            <span className="block text-xs text-white/50 mb-1">POS Upay</span>
            <span className="text-lg font-mono font-semibold text-white">{formatearGs(totalPos)}</span>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
            <span className="block text-xs text-white/50 mb-1">Transferencias</span>
            <span className="text-lg font-mono font-semibold text-white">{formatearGs(totalTransf)}</span>
          </div>
          <div className="bg-cbvp-green/10 border border-cbvp-green/30 rounded-lg px-4 py-3">
            <span className="block text-xs text-white/50 mb-1">Total General</span>
            <span className="text-lg font-mono font-semibold text-cbvp-green">{formatearGs(totalGeneral)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FORMATOS_COLECTA.map(f => (
          <button key={f.id} onClick={() => setTab(f.id)} className={`px-3 py-2 rounded-lg text-sm transition-colors ${tab === f.id ? 'bg-cbvp-red text-white font-semibold' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>{f.titulo}</button>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">{formatoActual.titulo}</h2>
          <button onClick={() => exportar(tab)} disabled={exportando} className="px-4 py-2 rounded-lg bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 transition-colors"><FileDown className="w-4 h-4" /> {exportando ? 'Generando...' : 'Exportar PDF (todas las actas)'}</button>
        </div>

        {tab === 'distribucion' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr><th className={thCls}>N° alcancía</th><th className={thCls}>Responsable</th><th className={thCls}>C.I. N°</th><th className={thCls}>Teléfono</th></tr></thead>
                <tbody>
                  {colectaActiva.distribucion.map((f, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-2 py-1 w-28"><input type="text" value={f.n} onChange={e => actualizarFila('distribucion', i, 'n', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1"><input type="text" value={f.responsable} onChange={e => actualizarFila('distribucion', i, 'responsable', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1 w-40"><input type="text" value={f.ci} onChange={e => actualizarFila('distribucion', i, 'ci', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1 w-40"><input type="text" value={f.telefono} onChange={e => actualizarFila('distribucion', i, 'telefono', e.target.value)} className={inputCls} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ControlFilas cantidad={colectaActiva.distribucion.length} onAgregar={() => agregarFila('distribucion')} onQuitar={() => quitarFila('distribucion')} />
            <p className="text-xs text-white/30 mt-3">La columna Firma se deja en blanco para firmar en el papel.</p>
          </>
        )}

        {tab === 'conteo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {panelConteo('alcancia', 'Alcancía', 'Alcancía N°')}
            {panelConteo('sobre', 'Sobre', 'Sobre N°')}
          </div>
        )}

        {(tab === 'resumen' || tab === 'acta') && (
          <>
            <p className="text-xs text-white/40 mb-3">
              La Colecta {colectaActiva.anio} puede tener varias actas de conteo (una por cada vez que se abren alcancías). El Resumen y el Acta de conteo usan la misma tabla por acta; los montos se pueden cargar a mano o con “Pasar al Resumen” desde el Conteo.
            </p>
            <div className="space-y-4">
              {colectaActiva.actas.map(acta => {
                const t = totalFilasResumen(acta.filas);
                return (
                  <div key={acta.id} className="border border-white/10 rounded-xl p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="text" value={acta.titulo} onChange={e => renombrarActa(acta.id, e.target.value)} className={`${inputCls} max-w-[160px] font-semibold`} />
                        <input type="date" value={acta.fecha} onChange={e => setFechaActa(acta.id, e.target.value)} className={`${inputCls} max-w-[150px] [color-scheme:dark]`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => exportarActa(tab, acta.id)} disabled={exportando} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/70 text-xs flex items-center gap-1.5 transition-colors"><FileDown className="w-3.5 h-3.5" /> PDF de esta acta</button>
                        {colectaActiva.actas.length > 1 && (
                          <button onClick={() => quitarActa(acta.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/50 hover:text-cbvp-red transition-colors" title="Eliminar acta"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[520px]">
                        <thead><tr><th className={thCls}>N° alcancía</th><th className={thCls}>Total billetes</th><th className={thCls}>Total monedas</th><th className={`${thCls} text-right`}>Total general</th></tr></thead>
                        <tbody>
                          {acta.filas.map((f, i) => (
                            <tr key={i} className="border-t border-white/5">
                              <td className="px-2 py-1 w-28"><input type="text" value={f.n} onChange={e => actualizarFilaActa(acta.id, i, 'n', e.target.value)} className={inputCls} /></td>
                              <td className="px-2 py-1"><input type="text" inputMode="numeric" value={f.billetes} onChange={e => actualizarFilaActa(acta.id, i, 'billetes', e.target.value.replace(/[^\d]/g, ''))} className={inputCls} /></td>
                              <td className="px-2 py-1"><input type="text" inputMode="numeric" value={f.monedas} onChange={e => actualizarFilaActa(acta.id, i, 'monedas', e.target.value.replace(/[^\d]/g, ''))} className={inputCls} /></td>
                              <td className="px-2 py-1 text-right text-white/80 font-mono">{f.billetes || f.monedas ? formatearGs(aEntero(f.billetes) + aEntero(f.monedas)) : ''}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-white/10"><td colSpan={3} className="px-2 py-2 text-white/60 font-semibold">Total guaraníes</td><td className="px-2 py-2 text-right text-white font-mono font-semibold">{formatearGs(t)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <ControlFilas cantidad={acta.filas.length} onAgregar={() => agregarFilaActa(acta.id)} onQuitar={() => quitarFilaActa(acta.id)} />
                  </div>
                );
              })}
            </div>
            <button onClick={crearActa} className="mt-4 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm flex items-center gap-2 transition-colors"><Plus className="w-4 h-4" /> Nueva Acta de conteo</button>
          </>
        )}

        {tab === 'pos' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead><tr><th className={thCls}>N° POS Upay</th><th className={thCls}>Desde</th><th className={thCls}>Hasta</th><th className={`${thCls} text-right`}>Monto</th></tr></thead>
                <tbody>
                  {colectaActiva.pos.map((f, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-2 py-1 w-28"><input type="text" value={f.n} onChange={e => actualizarFila('pos', i, 'n', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1"><input type="text" value={f.desde} onChange={e => actualizarFila('pos', i, 'desde', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1"><input type="text" value={f.hasta} onChange={e => actualizarFila('pos', i, 'hasta', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1 w-44"><input type="text" inputMode="numeric" value={formatearMonto(f.monto)} onChange={e => actualizarFila('pos', i, 'monto', e.target.value.replace(/[^\d]/g, ''))} className={`${inputCls} text-right`} /></td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/10"><td colSpan={3} className="px-2 py-2 text-white/60 font-semibold">Total guaraníes</td><td className="px-2 py-2 text-right text-white font-mono font-semibold">{formatearGs(totalPos)}</td></tr>
                </tbody>
              </table>
            </div>
            <ControlFilas cantidad={colectaActiva.pos.length} onAgregar={() => agregarFila('pos')} onQuitar={() => quitarFila('pos')} />
          </>
        )}

        {tab === 'transferencias' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr><th className={thCls}>N° transferencia</th><th className={thCls}>N° comprobante</th><th className={thCls}>Banco</th><th className={`${thCls} text-right`}>Monto</th></tr></thead>
                <tbody>
                  {colectaActiva.transferencias.map((f, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-2 py-1 w-28"><input type="text" value={f.n} onChange={e => actualizarFila('transferencias', i, 'n', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1"><input type="text" value={f.comprobante} onChange={e => actualizarFila('transferencias', i, 'comprobante', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1"><input type="text" value={f.banco} onChange={e => actualizarFila('transferencias', i, 'banco', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1 w-44"><input type="text" inputMode="numeric" value={formatearMonto(f.monto)} onChange={e => actualizarFila('transferencias', i, 'monto', e.target.value.replace(/[^\d]/g, ''))} className={`${inputCls} text-right`} /></td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/10"><td colSpan={3} className="px-2 py-2 text-white/60 font-semibold">Total guaraníes</td><td className="px-2 py-2 text-right text-white font-mono font-semibold">{formatearGs(totalTransf)}</td></tr>
                </tbody>
              </table>
            </div>
            <ControlFilas cantidad={colectaActiva.transferencias.length} onAgregar={() => agregarFila('transferencias')} onQuitar={() => quitarFila('transferencias')} />
          </>
        )}
      </div>
      <p className="text-xs text-white/30 pb-4">Los datos de esta pantalla se guardan solo en este navegador. Con las tablas vacías, el PDF sale como formato en blanco para completar a mano.</p>
    </div>
  );
}

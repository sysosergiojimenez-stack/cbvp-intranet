import { useEffect, useState } from 'react';
import { PiggyBank, FileDown, Plus, Minus, Trash2, ArrowRightLeft } from 'lucide-react';
import {
  BILLETES, MONEDAS, aEntero, fechaISOHoy, filasNumeradas, formatearGs, numeroCorrelativo, totalesConteo,
  type ConteoBloque, type FilaDistribucion, type FilaPos, type FilaResumen, type FilaTransferencia,
} from '@/lib/colecta';
import { exportarColectaPdf, FORMATOS_COLECTA, type DatosColecta, type FormatoColecta } from '@/lib/exportarColectaPdf';
import { ORGANIZACION } from '@/config/organizacion';

const STORAGE_KEY = 'cbvp_colecta_v1';

function datosIniciales(): DatosColecta {
  return {
    general: { compania: ORGANIZACION.compania, ciudad: 'Asunción', fecha: fechaISOHoy(), local: '' },
    distribucion: filasNumeradas<FilaDistribucion>(15, n => ({ n, responsable: '', ci: '', telefono: '' })),
    conteo: { alcancia: { numero: '', cantidades: {} }, sobre: { numero: '', cantidades: {} } },
    resumen: filasNumeradas<FilaResumen>(15, n => ({ n, billetes: '', monedas: '' })),
    pos: filasNumeradas<FilaPos>(5, n => ({ n, desde: '', hasta: '', monto: '' })),
    transferencias: filasNumeradas<FilaTransferencia>(5, n => ({ n, comprobante: '', banco: '', monto: '' })),
  };
}

// Los datos se guardan solo en este navegador (no van al servidor).
function cargarGuardados(): DatosColecta {
  const base = datosIniciales();
  try {
    const crudo = localStorage.getItem(STORAGE_KEY);
    if (!crudo) return base;
    return { ...base, ...JSON.parse(crudo) };
  } catch {
    return base;
  }
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
  const [datos, setDatos] = useState<DatosColecta>(cargarGuardados);
  const [tab, setTab] = useState<FormatoColecta>('distribucion');
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
  }, [datos]);

  const exportar = async (formato: FormatoColecta | 'todos') => {
    setExportando(true);
    try {
      await exportarColectaPdf(formato, datos);
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setExportando(false);
    }
  };

  const limpiar = () => {
    if (!confirm('Borrar todos los datos cargados de la colecta?')) return;
    setDatos(datosIniciales());
  };

  const setGeneral = (campo: keyof DatosColecta['general'], valor: string) =>
    setDatos(d => ({ ...d, general: { ...d.general, [campo]: valor } }));

  // ---- edicion de listas ----
  const actualizarFila = <K extends 'distribucion' | 'resumen' | 'pos' | 'transferencias'>(
    lista: K, idx: number, campo: string, valor: string,
  ) => setDatos(d => {
    const filas = [...d[lista]] as unknown as Record<string, string>[];
    filas[idx] = { ...filas[idx], [campo]: valor };
    return { ...d, [lista]: filas };
  });
  const agregarFila = (lista: 'distribucion' | 'resumen' | 'pos' | 'transferencias') => setDatos(d => {
    const n = numeroCorrelativo(d[lista].length);
    const nueva = { distribucion: { n, responsable: '', ci: '', telefono: '' }, resumen: { n, billetes: '', monedas: '' }, pos: { n, desde: '', hasta: '', monto: '' }, transferencias: { n, comprobante: '', banco: '', monto: '' } }[lista];
    return { ...d, [lista]: [...d[lista], nueva] };
  });
  const quitarFila = (lista: 'distribucion' | 'resumen' | 'pos' | 'transferencias') =>
    setDatos(d => (d[lista].length > 1 ? { ...d, [lista]: d[lista].slice(0, -1) } : d));

  // ---- conteo ----
  const setConteo = (bloque: 'alcancia' | 'sobre', cambio: Partial<ConteoBloque>) =>
    setDatos(d => ({ ...d, conteo: { ...d.conteo, [bloque]: { ...d.conteo[bloque], ...cambio } } }));
  const setCantidad = (bloque: 'alcancia' | 'sobre', denom: number, valor: string) =>
    setConteo(bloque, { cantidades: { ...datos.conteo[bloque].cantidades, [String(denom)]: valor.replace(/[^\d]/g, '') } });

  // Pasa los totales de la alcancia contada a su fila del Resumen / Acta de conteo.
  const pasarAlResumen = () => {
    const numero = datos.conteo.alcancia.numero.trim();
    if (!numero) { alert('Cargá el N° de alcancía antes de pasarla al resumen.'); return; }
    const n = /^\d+$/.test(numero) ? numero.padStart(3, '0') : numero;
    const t = totalesConteo(datos.conteo.alcancia);
    setDatos(d => {
      const idx = d.resumen.findIndex(f => f.n === n);
      const fila = { n, billetes: String(t.billetes), monedas: String(t.monedas) };
      const resumen = idx >= 0 ? d.resumen.map((f, i) => (i === idx ? fila : f)) : [...d.resumen, fila];
      return { ...d, resumen };
    });
    alert(`Alcancía ${n} agregada al Resumen y al Acta de conteo.`);
  };

  const panelConteo = (bloque: 'alcancia' | 'sobre', titulo: string, rotuloNumero: string) => {
    const b = datos.conteo[bloque];
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
          <button onClick={pasarAlResumen} className="mt-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs flex items-center gap-2 transition-colors">
            <ArrowRightLeft className="w-3.5 h-3.5" /> Pasar al Resumen y Acta de conteo
          </button>
        )}
      </div>
    );
  };

  const totalResumen = datos.resumen.reduce((s, f) => s + aEntero(f.billetes) + aEntero(f.monedas), 0);
  const totalPos = datos.pos.reduce((s, f) => s + aEntero(f.monto), 0);
  const totalTransf = datos.transferencias.reduce((s, f) => s + aEntero(f.monto), 0);

  const formatoActual = FORMATOS_COLECTA.find(f => f.id === tab)!;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><PiggyBank className="w-5 h-5 text-cbvp-red" /> Colecta</h1>
        <div className="flex items-center gap-2">
          <button onClick={limpiar} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/50 hover:text-cbvp-red text-xs flex items-center gap-2 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Limpiar datos</button>
          <button onClick={() => exportar('todos')} disabled={exportando} className="px-4 py-2 rounded-lg bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green text-sm flex items-center gap-2 transition-colors"><FileDown className="w-4 h-4" /> Exportar los 6 formatos</button>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Datos generales (van en todos los formatos)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="text-xs text-white/40 mb-1 block">Compañía</label><input type="text" value={datos.general.compania} onChange={e => setGeneral('compania', e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Ciudad (actas)</label><input type="text" value={datos.general.ciudad} onChange={e => setGeneral('ciudad', e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Fecha (actas)</label><input type="date" value={datos.general.fecha} onChange={e => setGeneral('fecha', e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Local (actas)</label><input type="text" value={datos.general.local} onChange={e => setGeneral('local', e.target.value)} placeholder="Dejar vacío para completar a mano" className={inputCls} /></div>
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
          <button onClick={() => exportar(tab)} disabled={exportando} className="px-4 py-2 rounded-lg bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 transition-colors"><FileDown className="w-4 h-4" /> {exportando ? 'Generando...' : 'Exportar PDF'}</button>
        </div>

        {tab === 'distribucion' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr><th className={thCls}>N° alcancía</th><th className={thCls}>Responsable</th><th className={thCls}>C.I. N°</th><th className={thCls}>Teléfono</th></tr></thead>
                <tbody>
                  {datos.distribucion.map((f, i) => (
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
            <ControlFilas cantidad={datos.distribucion.length} onAgregar={() => agregarFila('distribucion')} onQuitar={() => quitarFila('distribucion')} />
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
            <p className="text-xs text-white/40 mb-3">El Resumen y el Acta de conteo usan la misma tabla. Los montos de billetes y monedas se pueden cargar a mano o con “Pasar al Resumen” desde el Conteo.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead><tr><th className={thCls}>N° alcancía</th><th className={thCls}>Total billetes</th><th className={thCls}>Total monedas</th><th className={`${thCls} text-right`}>Total general</th></tr></thead>
                <tbody>
                  {datos.resumen.map((f, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-2 py-1 w-28"><input type="text" value={f.n} onChange={e => actualizarFila('resumen', i, 'n', e.target.value)} className={inputCls} /></td>
                      <td className="px-2 py-1"><input type="text" inputMode="numeric" value={f.billetes} onChange={e => actualizarFila('resumen', i, 'billetes', e.target.value.replace(/[^\d]/g, ''))} className={inputCls} /></td>
                      <td className="px-2 py-1"><input type="text" inputMode="numeric" value={f.monedas} onChange={e => actualizarFila('resumen', i, 'monedas', e.target.value.replace(/[^\d]/g, ''))} className={inputCls} /></td>
                      <td className="px-2 py-1 text-right text-white/80 font-mono">{f.billetes || f.monedas ? formatearGs(aEntero(f.billetes) + aEntero(f.monedas)) : ''}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/10"><td colSpan={3} className="px-2 py-2 text-white/60 font-semibold">Total guaraníes</td><td className="px-2 py-2 text-right text-white font-mono font-semibold">{formatearGs(totalResumen)}</td></tr>
                </tbody>
              </table>
            </div>
            <ControlFilas cantidad={datos.resumen.length} onAgregar={() => agregarFila('resumen')} onQuitar={() => quitarFila('resumen')} />
          </>
        )}

        {tab === 'pos' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead><tr><th className={thCls}>N° POS Upay</th><th className={thCls}>Desde</th><th className={thCls}>Hasta</th><th className={`${thCls} text-right`}>Monto</th></tr></thead>
                <tbody>
                  {datos.pos.map((f, i) => (
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
            <ControlFilas cantidad={datos.pos.length} onAgregar={() => agregarFila('pos')} onQuitar={() => quitarFila('pos')} />
          </>
        )}

        {tab === 'transferencias' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr><th className={thCls}>N° transferencia</th><th className={thCls}>N° comprobante</th><th className={thCls}>Banco</th><th className={`${thCls} text-right`}>Monto</th></tr></thead>
                <tbody>
                  {datos.transferencias.map((f, i) => (
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
            <ControlFilas cantidad={datos.transferencias.length} onAgregar={() => agregarFila('transferencias')} onQuitar={() => quitarFila('transferencias')} />
          </>
        )}
      </div>
      <p className="text-xs text-white/30 pb-4">Los datos de esta pantalla se guardan solo en este navegador. Con las tablas vacías, el PDF sale como formato en blanco para completar a mano.</p>
    </div>
  );
}

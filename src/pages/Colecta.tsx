import { useEffect, useState } from 'react';
import { PiggyBank, FileDown, Plus, Minus, Trash2, ArrowRightLeft, UploadCloud } from 'lucide-react';
import { trpc } from '@/providers/trpc';
import {
  BILLETES, MONEDAS, aEntero, fechaISOHoy, filasNumeradas, formatearGs, generarId, numeroCorrelativo,
  nuevaActa, totalesConteo, totalFilasResumen,
  type Acta, type Colecta as ColectaDatos, type ConteoBloque, type FilaDistribucion, type FilaPos, type FilaTransferencia,
} from '@/lib/colecta';
import { exportarColectaPdf, FORMATOS_COLECTA, type DatosColecta, type FormatoColecta } from '@/lib/exportarColectaPdf';
import { ORGANIZACION } from '@/config/organizacion';

const STORAGE_KEY_V1 = 'cbvp_colecta_v1';
const STORAGE_KEY_V2 = 'cbvp_colectas_v2';

type ColectaSinId = Omit<ColectaDatos, 'id'>;

function colectaVacia(anio: string): ColectaSinId {
  return {
    anio,
    general: { compania: ORGANIZACION.compania, ciudad: 'Asunción', fecha: fechaISOHoy(), local: '' },
    distribucion: filasNumeradas<FilaDistribucion>(15, n => ({ n, responsable: '', ci: '', telefono: '' })),
    conteo: { alcancia: { numero: '', cantidades: {} }, sobre: { numero: '', cantidades: {} } },
    actas: [nuevaActa(1)],
    pos: filasNumeradas<FilaPos>(5, n => ({ n, desde: '', hasta: '', monto: '' })),
    transferencias: filasNumeradas<FilaTransferencia>(5, n => ({ n, comprobante: '', banco: '', monto: '' })),
  };
}

// Las versiones anteriores guardaban todo solo en este navegador (nunca
// llegaba al servidor). Esto busca esos datos para poder importarlos a la
// nube a pedido del usuario, sin perder lo que ya estaba cargado ahi.
function leerColectasDelNavegador(): ColectaSinId[] {
  try {
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const data = JSON.parse(v2);
      if (Array.isArray(data.colectas) && data.colectas.length > 0) {
        return data.colectas.map((c: ColectaDatos) => {
          const { id, ...resto } = c;
          void id;
          return resto;
        });
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
      const d = JSON.parse(v1);
      const base = colectaVacia('2026');
      return [{
        ...base,
        general: d.general ?? base.general,
        distribucion: Array.isArray(d.distribucion) ? d.distribucion : base.distribucion,
        conteo: d.conteo ?? base.conteo,
        actas: [{ id: generarId(), titulo: 'Acta N° 1', fecha: d.general?.fecha || fechaISOHoy(), filas: Array.isArray(d.resumen) ? d.resumen : base.actas[0].filas }],
        pos: Array.isArray(d.pos) ? d.pos : base.pos,
        transferencias: Array.isArray(d.transferencias) ? d.transferencias : base.transferencias,
      }];
    }
  } catch {
    /* ignore */
  }
  return [];
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
  const utils = trpc.useUtils();
  const { data: listadoData, isLoading: cargandoListado } = trpc.colecta.listado.useQuery();
  const colectasListado = listadoData?.exito ? listadoData.colectas : [];

  const [colectaActivaId, setColectaActivaId] = useState('');
  useEffect(() => {
    if (!colectaActivaId && colectasListado.length > 0) setColectaActivaId(colectasListado[0].id);
  }, [colectasListado, colectaActivaId]);

  const { data: colectaData, isLoading: cargandoColecta } = trpc.colecta.obtener.useQuery(
    { id: colectaActivaId }, { enabled: !!colectaActivaId },
  );

  const [colecta, setColecta] = useState<ColectaDatos | null>(null);
  const [huboCambios, setHuboCambios] = useState(false);
  useEffect(() => {
    if (!colectaData?.exito) return;
    const { exito: _exito, ...resto } = colectaData;
    void _exito;
    setColecta(resto as ColectaDatos);
    setHuboCambios(false);
  }, [colectaData]);

  const [tab, setTab] = useState<FormatoColecta>('distribucion');
  const [exportando, setExportando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [actaDestinoId, setActaDestinoId] = useState('');

  const guardarMutation = trpc.colecta.guardar.useMutation();
  const crearMutation = trpc.colecta.crear.useMutation();
  const eliminarMutation = trpc.colecta.eliminar.useMutation();

  useEffect(() => {
    if (!colecta) return;
    if (!colecta.actas.some(a => a.id === actaDestinoId)) {
      setActaDestinoId(colecta.actas[colecta.actas.length - 1]?.id || '');
    }
  }, [colecta, actaDestinoId]);

  const mutar = (fn: (c: ColectaDatos) => ColectaDatos) => {
    setColecta(c => (c ? fn(c) : c));
    setHuboCambios(true);
  };

  const cambiarColectaActiva = (id: string) => {
    if (id === colectaActivaId) return;
    if (huboCambios && !confirm('Hay cambios sin guardar en esta colecta. ¿Cambiar igual y perderlos?')) return;
    setColectaActivaId(id);
  };

  const guardar = async () => {
    if (!colecta) return;
    setGuardando(true);
    try {
      const { id, ...resto } = colecta;
      await guardarMutation.mutateAsync({ id, colecta: resto });
      await utils.colecta.obtener.invalidate({ id });
      setHuboCambios(false);
    } catch (err: unknown) {
      alert('Error al guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  const crearColecta = async () => {
    const anioSugerido = String(new Date().getFullYear() + 1);
    const anio = window.prompt('Año de la nueva colecta:', anioSugerido);
    if (!anio || !anio.trim()) return;
    if (colectasListado.some(c => c.anio === anio.trim())) { alert(`Ya existe una Colecta ${anio.trim()}.`); return; }
    if (huboCambios && !confirm('Hay cambios sin guardar en esta colecta. ¿Crear otra igual y perderlos?')) return;
    const res = await crearMutation.mutateAsync({ colecta: colectaVacia(anio.trim()) });
    await utils.colecta.listado.invalidate();
    setColectaActivaId(res.id);
  };

  const importarDelNavegador = async () => {
    const encontradas = leerColectasDelNavegador();
    if (encontradas.length === 0) { alert('No se encontraron datos de Colecta guardados en este navegador.'); return; }
    const resumen = encontradas.map(c => `Colecta ${c.anio}: ${c.actas.length} acta(s), ${c.distribucion.filter(f => f.responsable).length} distribucion, ${c.pos.filter(f => f.monto).length} POS, ${c.transferencias.filter(f => f.monto).length} transferencias`).join('\n');
    if (!confirm(`Se encontraron estos datos en este navegador:\n\n${resumen}\n\n¿Importarlos a la nube? (se crean como colectas nuevas; si ya existe una colecta con el mismo año, se crea igual, revisa para no duplicar)`)) return;
    let ultimoId = '';
    for (const c of encontradas) {
      const res = await crearMutation.mutateAsync({ colecta: c });
      ultimoId = res.id;
    }
    await utils.colecta.listado.invalidate();
    if (ultimoId) setColectaActivaId(ultimoId);
    alert('Datos importados a la nube.');
  };

  const construirDatosColecta = (c: ColectaDatos, actasOverride?: Acta[]): DatosColecta => ({
    general: c.general,
    distribucion: c.distribucion,
    conteo: c.conteo,
    actas: (actasOverride ?? c.actas).map(a => ({ titulo: a.titulo, fecha: a.fecha, filas: a.filas })),
    pos: c.pos,
    transferencias: c.transferencias,
  });

  const exportar = async (formato: FormatoColecta | 'todos') => {
    if (!colecta) return;
    setExportando(true);
    try {
      await exportarColectaPdf(formato, construirDatosColecta(colecta));
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setExportando(false);
    }
  };

  const exportarActa = async (formato: FormatoColecta, actaId: string) => {
    if (!colecta) return;
    const acta = colecta.actas.find(a => a.id === actaId);
    if (!acta) return;
    setExportando(true);
    try {
      await exportarColectaPdf(formato, construirDatosColecta(colecta, [acta]));
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setExportando(false);
    }
  };

  const limpiar = () => {
    if (!colecta) return;
    if (!confirm(`Borrar todos los datos cargados de la Colecta ${colecta.anio}? Esto se guarda al tocar "Guardar Cambios".`)) return;
    mutar(c => ({ ...colectaVacia(c.anio), id: c.id }));
  };

  const eliminarColecta = async () => {
    if (!colecta) return;
    if (colectasListado.length <= 1) { alert('No se puede eliminar la única colecta.'); return; }
    if (!confirm(`Eliminar la Colecta ${colecta.anio} por completo? Esta acción no se puede deshacer.`)) return;
    await eliminarMutation.mutateAsync({ id: colecta.id });
    await utils.colecta.listado.invalidate();
    setColectaActivaId('');
  };

  const setGeneral = (campo: keyof ColectaDatos['general'], valor: string) =>
    mutar(c => ({ ...c, general: { ...c.general, [campo]: valor } }));

  // ---- edicion de listas (distribucion / pos / transferencias) ----
  const actualizarFila = <K extends 'distribucion' | 'pos' | 'transferencias'>(
    lista: K, idx: number, campo: string, valor: string,
  ) => mutar(c => {
    const filas = [...c[lista]] as unknown as Record<string, string>[];
    filas[idx] = { ...filas[idx], [campo]: valor };
    return { ...c, [lista]: filas };
  });
  const agregarFila = (lista: 'distribucion' | 'pos' | 'transferencias') => mutar(c => {
    const n = numeroCorrelativo(c[lista].length);
    const nueva = { distribucion: { n, responsable: '', ci: '', telefono: '' }, pos: { n, desde: '', hasta: '', monto: '' }, transferencias: { n, comprobante: '', banco: '', monto: '' } }[lista];
    return { ...c, [lista]: [...c[lista], nueva] };
  });
  const quitarFila = (lista: 'distribucion' | 'pos' | 'transferencias') =>
    mutar(c => (c[lista].length > 1 ? { ...c, [lista]: c[lista].slice(0, -1) } : c));

  // ---- actas de conteo (varias por colecta) ----
  const crearActa = () => mutar(c => ({ ...c, actas: [...c.actas, nuevaActa(c.actas.length + 1)] }));
  const quitarActa = (actaId: string) => {
    if (!colecta || colecta.actas.length <= 1) return;
    if (!confirm('Eliminar esta acta de conteo? Se pierden sus datos al guardar.')) return;
    mutar(c => ({ ...c, actas: c.actas.filter(a => a.id !== actaId) }));
  };
  const renombrarActa = (actaId: string, titulo: string) =>
    mutar(c => ({ ...c, actas: c.actas.map(a => (a.id === actaId ? { ...a, titulo } : a)) }));
  const setFechaActa = (actaId: string, fecha: string) =>
    mutar(c => ({ ...c, actas: c.actas.map(a => (a.id === actaId ? { ...a, fecha } : a)) }));
  const actualizarFilaActa = (actaId: string, idx: number, campo: 'n' | 'billetes' | 'monedas', valor: string) =>
    mutar(c => ({
      ...c,
      actas: c.actas.map(a => (a.id === actaId ? { ...a, filas: a.filas.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)) } : a)),
    }));
  const agregarFilaActa = (actaId: string) =>
    mutar(c => ({
      ...c,
      actas: c.actas.map(a => (a.id === actaId ? { ...a, filas: [...a.filas, { n: numeroCorrelativo(a.filas.length), billetes: '', monedas: '' }] } : a)),
    }));
  const quitarFilaActa = (actaId: string) =>
    mutar(c => ({
      ...c,
      actas: c.actas.map(a => (a.id === actaId && a.filas.length > 1 ? { ...a, filas: a.filas.slice(0, -1) } : a)),
    }));

  // ---- conteo (panel de carga de una alcancia/sobre a la vez) ----
  const setConteo = (bloque: 'alcancia' | 'sobre', cambio: Partial<ConteoBloque>) =>
    mutar(c => ({ ...c, conteo: { ...c.conteo, [bloque]: { ...c.conteo[bloque], ...cambio } } }));
  const setCantidad = (bloque: 'alcancia' | 'sobre', denom: number, valor: string) => {
    if (!colecta) return;
    setConteo(bloque, { cantidades: { ...colecta.conteo[bloque].cantidades, [String(denom)]: valor.replace(/[^\d]/g, '') } });
  };

  // Pasa los totales de la alcancia contada a la fila del acta elegida como destino.
  const pasarAlResumen = () => {
    if (!colecta) return;
    const numero = colecta.conteo.alcancia.numero.trim();
    if (!numero) { alert('Cargá el N° de alcancía antes de pasarla al resumen.'); return; }
    if (!actaDestinoId) { alert('No hay ningún acta de conteo para recibirla.'); return; }
    const n = /^\d+$/.test(numero) ? numero.padStart(3, '0') : numero;
    const t = totalesConteo(colecta.conteo.alcancia);
    const actaDestino = colecta.actas.find(a => a.id === actaDestinoId);
    mutar(c => ({
      ...c,
      actas: c.actas.map(a => {
        if (a.id !== actaDestinoId) return a;
        const idx = a.filas.findIndex(f => f.n === n);
        const fila = { n, billetes: String(t.billetes), monedas: String(t.monedas) };
        const filas = idx >= 0 ? a.filas.map((f, i) => (i === idx ? fila : f)) : [...a.filas, fila];
        return { ...a, filas };
      }),
      conteo: {
        alcancia: { ...c.conteo.alcancia, cantidades: {} },
        sobre: { ...c.conteo.sobre, cantidades: {} },
      },
    }));
    alert(`Alcancía ${n} agregada a "${actaDestino?.titulo || 'el acta'}". No te olvides de "Guardar Cambios".`);
  };

  const panelConteo = (bloque: 'alcancia' | 'sobre', titulo: string, rotuloNumero: string) => {
    if (!colecta) return null;
    const b = colecta.conteo[bloque];
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
            {colecta.actas.length > 1 && (
              <select value={actaDestinoId} onChange={e => setActaDestinoId(e.target.value)} className={`${inputCls} max-w-[200px]`}>
                {colecta.actas.map(a => <option key={a.id} value={a.id}>{a.titulo}</option>)}
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

  if (cargandoListado || (colectaActivaId && cargandoColecta && !colecta)) {
    return <div className="text-white/60 text-center py-12">Cargando...</div>;
  }

  if (!colecta) {
    return (
      <div className="animate-fade-in space-y-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><PiggyBank className="w-5 h-5 text-cbvp-red" /> Colecta</h1>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center text-white/60 space-y-4">
          <p>Todavía no hay ninguna Colecta cargada.</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={crearColecta} className="px-4 py-2 rounded-lg bg-cbvp-red hover:bg-cbvp-red/80 text-white text-sm font-semibold flex items-center gap-2 transition-colors mx-auto"><Plus className="w-4 h-4" /> Nueva Colecta</button>
            <button onClick={importarDelNavegador} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm flex items-center gap-2 transition-colors"><UploadCloud className="w-4 h-4" /> Importar datos de este navegador</button>
          </div>
        </div>
      </div>
    );
  }

  const totalActas = colecta.actas.reduce((s, a) => s + totalFilasResumen(a.filas), 0);
  const totalPos = colecta.pos.reduce((s, f) => s + aEntero(f.monto), 0);
  const totalTransf = colecta.transferencias.reduce((s, f) => s + aEntero(f.monto), 0);
  const totalGeneral = totalActas + totalPos + totalTransf;

  const formatoActual = FORMATOS_COLECTA.find(f => f.id === tab)!;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><PiggyBank className="w-5 h-5 text-cbvp-red" /> Colecta</h1>
        <div className="flex items-center gap-2">
          {huboCambios && <span className="text-xs text-cbvp-yellow">Cambios sin guardar</span>}
          <button onClick={limpiar} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/50 hover:text-cbvp-red text-xs flex items-center gap-2 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Limpiar datos</button>
          <button onClick={() => exportar('todos')} disabled={exportando} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/70 text-sm flex items-center gap-2 transition-colors"><FileDown className="w-4 h-4" /> Exportar los 6 formatos</button>
          <button onClick={guardar} disabled={guardando || !huboCambios} className="px-4 py-2 rounded-lg bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-40 text-white text-sm font-semibold flex items-center gap-2 transition-colors"><UploadCloud className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar Cambios'}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/40 uppercase tracking-wider mr-1">Colecta:</span>
        {colectasListado.map(c => (
          <button key={c.id} onClick={() => cambiarColectaActiva(c.id)} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${c.id === colectaActivaId ? 'bg-cbvp-red text-white font-semibold' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
            Colecta {c.anio}
          </button>
        ))}
        <button onClick={crearColecta} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs flex items-center gap-1.5 transition-colors"><Plus className="w-3.5 h-3.5" /> Nueva Colecta</button>
        <button onClick={importarDelNavegador} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs flex items-center gap-1.5 transition-colors"><UploadCloud className="w-3.5 h-3.5" /> Importar de este navegador</button>
        {colectasListado.length > 1 && (
          <button onClick={eliminarColecta} className="ml-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red text-xs flex items-center gap-1.5 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Eliminar esta colecta</button>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Datos generales (van en todos los formatos de esta colecta)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className="text-xs text-white/40 mb-1 block">Compañía</label><input type="text" value={colecta.general.compania} onChange={e => setGeneral('compania', e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Ciudad (actas)</label><input type="text" value={colecta.general.ciudad} onChange={e => setGeneral('ciudad', e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Fecha (actas)</label><input type="date" value={colecta.general.fecha} onChange={e => setGeneral('fecha', e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></div>
          <div><label className="text-xs text-white/40 mb-1 block">Local (actas)</label><input type="text" value={colecta.general.local} onChange={e => setGeneral('local', e.target.value)} placeholder="Dejar vacío para completar a mano" className={inputCls} /></div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Total general de la Colecta {colecta.anio}</h2>
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
                  {colecta.distribucion.map((f, i) => (
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
            <ControlFilas cantidad={colecta.distribucion.length} onAgregar={() => agregarFila('distribucion')} onQuitar={() => quitarFila('distribucion')} />
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
              La Colecta {colecta.anio} puede tener varias actas de conteo (una por cada vez que se abren alcancías). El Resumen y el Acta de conteo usan la misma tabla por acta; los montos se pueden cargar a mano o con “Pasar al Resumen” desde el Conteo.
            </p>
            <div className="space-y-4">
              {colecta.actas.map(acta => {
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
                        {colecta.actas.length > 1 && (
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
                  {colecta.pos.map((f, i) => (
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
            <ControlFilas cantidad={colecta.pos.length} onAgregar={() => agregarFila('pos')} onQuitar={() => quitarFila('pos')} />
          </>
        )}

        {tab === 'transferencias' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr><th className={thCls}>N° transferencia</th><th className={thCls}>N° comprobante</th><th className={thCls}>Banco</th><th className={`${thCls} text-right`}>Monto</th></tr></thead>
                <tbody>
                  {colecta.transferencias.map((f, i) => (
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
            <ControlFilas cantidad={colecta.transferencias.length} onAgregar={() => agregarFila('transferencias')} onQuitar={() => quitarFila('transferencias')} />
          </>
        )}
      </div>
      <p className="text-xs text-white/30 pb-4">Los datos de Colecta ahora se guardan en el servidor: usa "Guardar Cambios" para persistirlos. Con las tablas vacías, el PDF sale como formato en blanco para completar a mano.</p>
    </div>
  );
}

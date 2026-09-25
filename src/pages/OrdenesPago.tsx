import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { Receipt, Plus, Trash2, Save, Download, X } from 'lucide-react';
import { TIPOS_MOVIMIENTO_ORDEN_PAGO, LABEL_TIPO_MOVIMIENTO, type TipoMovimientoOrdenPago } from '@contracts/ordenesPago';
import { exportarOrdenPagoPdf } from '@/lib/exportarOrdenPagoPdf';

interface FilaDetalle {
  descripcion: string;
  bancoAlias: string;
  nroCuenta: string;
  monto: string;
}

function filaVacia(): FilaDetalle {
  return { descripcion: '', bancoAlias: '', nroCuenta: '', monto: '' };
}

function hoyDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fechaDDMMYYYYaISO(fecha: string): string {
  const partes = fecha.split('/');
  if (partes.length !== 3) return '';
  const [d, m, y] = partes;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function fechaISOaDDMMYYYY(iso: string): string {
  const partes = iso.split('-');
  if (partes.length !== 3) return '';
  const [y, m, d] = partes;
  return `${d}/${m}/${y}`;
}

// Los montos se cargan como texto (para permitir "." como separador visual
// mientras se escribe) y se limpian a entero recien al guardar/exportar.
function parseMonto(valor: string): number {
  const limpio = valor.replace(/[^\d]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

export default function OrdenesPago() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();

  const { data: listadoData, isLoading: cargandoListado } = trpc.ordenesPago.listado.useQuery();
  const ordenes = listadoData?.exito ? listadoData.ordenes : [];

  const guardarMutation = trpc.ordenesPago.guardar.useMutation();
  const eliminarMutation = trpc.ordenesPago.eliminar.useMutation();

  const [fecha, setFecha] = useState(hoyDDMMYYYY());
  const [bancoNombre, setBancoNombre] = useState('');
  const [bancoCuenta, setBancoCuenta] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoOrdenPago | ''>('');
  const [detalle, setDetalle] = useState<FilaDetalle[]>([filaVacia()]);
  const [observaciones, setObservaciones] = useState('');
  const [comandanteNombre, setComandanteNombre] = useState('');
  const [directorNombre, setDirectorNombre] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [exportandoId, setExportandoId] = useState<string | null>(null);

  const totalDetalle = detalle.reduce((acc, d) => acc + parseMonto(d.monto), 0);

  const actualizarFila = (idx: number, campo: keyof FilaDetalle, valor: string) => {
    setDetalle((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
  };
  const agregarFila = () => setDetalle((prev) => [...prev, filaVacia()]);
  const quitarFila = (idx: number) => setDetalle((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleGuardar = async () => {
    setError('');
    setExito('');
    if (!fecha) { setError('Completa la fecha.'); return; }
    if (!bancoNombre.trim() || !bancoCuenta.trim()) { setError('Completa el banco y el numero de cuenta de la compania.'); return; }
    if (!tipoMovimiento) { setError('Selecciona el tipo de movimiento.'); return; }
    const detalleValido = detalle.filter((d) => d.descripcion.trim() && parseMonto(d.monto) > 0);
    if (detalleValido.length === 0) { setError('Agrega al menos un concepto con descripcion y monto.'); return; }

    setGuardando(true);
    try {
      const anioOrden = parseInt(fecha.split('/')[2], 10) || new Date().getFullYear();
      const res = await guardarMutation.mutateAsync({
        anio: anioOrden,
        fecha,
        bancoNombre: bancoNombre.trim(),
        bancoCuenta: bancoCuenta.trim(),
        tipoMovimiento,
        detalle: detalleValido.map((d) => ({
          descripcion: d.descripcion.trim(),
          bancoAlias: d.bancoAlias.trim(),
          nroCuenta: d.nroCuenta.trim(),
          monto: parseMonto(d.monto),
        })),
        observaciones: observaciones.trim(),
        comandanteNombre: comandanteNombre.trim(),
        directorNombre: directorNombre.trim(),
        creadoPor: usuario?.codigo || '',
      });
      setExito(`Orden de Pago N° ${res.numero}/${anioOrden} guardada correctamente.`);
      setFecha(hoyDDMMYYYY());
      setTipoMovimiento('');
      setDetalle([filaVacia()]);
      setObservaciones('');
      utils.ordenesPago.listado.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar esta orden de pago?')) return;
    await eliminarMutation.mutateAsync({ id });
    utils.ordenesPago.listado.invalidate();
  };

  const handleExportar = async (orden: (typeof ordenes)[number]) => {
    setExportandoId(orden.id);
    try {
      await exportarOrdenPagoPdf({
        numero: orden.numero,
        anio: orden.anio,
        fecha: orden.fecha,
        bancoNombre: orden.bancoNombre,
        bancoCuenta: orden.bancoCuenta,
        tipoMovimiento: orden.tipoMovimiento as TipoMovimientoOrdenPago,
        detalle: orden.detalle,
        total: orden.total,
        observaciones: orden.observaciones,
        comandanteNombre: orden.comandanteNombre,
        directorNombre: orden.directorNombre,
      });
    } finally {
      setExportandoId(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-cbvp-red" /> Nueva Orden de Pago
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Fecha</label>
            <input
              type="date"
              value={fechaDDMMYYYYaISO(fecha)}
              onChange={(e) => setFecha(fechaISOaDDMMYYYY(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Banco de la Compania</label>
            <input type="text" value={bancoNombre} onChange={(e) => setBancoNombre(e.target.value)} placeholder="Ej. UENO BANK" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Nr. de Cuenta</label>
            <input type="text" value={bancoCuenta} onChange={(e) => setBancoCuenta(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Tipo de Movimiento</label>
          <div className="flex flex-wrap gap-4">
            {TIPOS_MOVIMIENTO_ORDEN_PAGO.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="radio" name="tipoMovimiento" checked={tipoMovimiento === t} onChange={() => setTipoMovimiento(t)} className="accent-cbvp-red w-4 h-4" />
                {LABEL_TIPO_MOVIMIENTO[t]}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Detalle del Concepto / Objeto de Pago</label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50 w-8">N°</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Descripcion / Concepto</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Banco / Alias</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nr. Cuenta</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Monto (Gs.)</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((f, idx) => (
                  <tr key={idx} className="border-b border-white/5">
                    <td className="px-2 py-1.5 text-white/40">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={f.descripcion} onChange={(e) => actualizarFila(idx, 'descripcion', e.target.value)} className="w-full min-w-[160px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={f.bancoAlias} onChange={(e) => actualizarFila(idx, 'bancoAlias', e.target.value)} className="w-full min-w-[100px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={f.nroCuenta} onChange={(e) => actualizarFila(idx, 'nroCuenta', e.target.value)} className="w-full min-w-[100px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={f.monto} onChange={(e) => actualizarFila(idx, 'monto', e.target.value)} className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => quitarFila(idx)} disabled={detalle.length === 1} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={4} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                  <td className="px-2 py-2 text-white">{totalDetalle.toLocaleString('es-PY')}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={agregarFila} type="button" className="mt-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs flex items-center gap-2 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Agregar fila
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none resize-none" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Comandante o Presidente</label>
            <input type="text" value={comandanteNombre} onChange={(e) => setComandanteNombre(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Director Administrativo o Tesorero</label>
            <input type="text" value={directorNombre} onChange={(e) => setDirectorNombre(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        {exito && <p className="text-sm text-cbvp-green mb-3">{exito}</p>}

        <button onClick={handleGuardar} disabled={guardando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar Orden de Pago'}
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Historial de Ordenes de Pago</h3>
        {cargandoListado ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : ordenes.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay ordenes de pago registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">OP N°</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Tipo</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Concepto</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Total (Gs.)</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50"></th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{o.numero}/{o.anio}</td>
                    <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{o.fecha}</td>
                    <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{LABEL_TIPO_MOVIMIENTO[o.tipoMovimiento as TipoMovimientoOrdenPago] || o.tipoMovimiento}</td>
                    <td className="px-2 py-1.5 text-white/60 max-w-[220px] truncate" title={o.detalle.map((d) => d.descripcion).join(', ')}>
                      {o.detalle.map((d) => d.descripcion).join(', ') || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{o.total.toLocaleString('es-PY')}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleExportar(o)} disabled={exportandoId === o.id} className="p-1.5 rounded-lg hover:bg-cbvp-green/20 text-white/40 hover:text-cbvp-green disabled:opacity-50 transition-colors" title="Exportar PDF">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleEliminar(o.id)} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

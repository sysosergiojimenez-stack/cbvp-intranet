import { Fragment, useState } from 'react';
import { trpc } from '@/providers/trpc';
import { PiggyBank, Plus, Trash2, Save } from 'lucide-react';

function formatearGs(valor: number): string {
  return valor.toLocaleString('es-PY');
}

// El monto se carga como texto (para permitir "." como separador visual
// mientras se escribe) y se limpia a entero recien al guardar.
function parseMonto(valor: string): number {
  const limpio = valor.replace(/[^\d-]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EditForm {
  fecha: string;
  saldoAnterior: string;
  ingresos: string;
  gastos: string;
  observaciones: string;
}

function editFormVacio(): EditForm {
  return { fecha: hoyISO(), saldoAnterior: '', ingresos: '', gastos: '', observaciones: '' };
}

export default function CajaChica() {
  const utils = trpc.useUtils();
  const { data: listadoData, isLoading: cargandoListado } = trpc.cajaChica.listado.useQuery();
  const movimientos = listadoData?.exito ? listadoData.movimientos : [];
  const ultimoSaldo = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : 0;

  const guardarMutation = trpc.cajaChica.guardar.useMutation();
  const editarMutation = trpc.cajaChica.editar.useMutation();
  const eliminarMutation = trpc.cajaChica.eliminar.useMutation();

  const [fecha, setFecha] = useState(hoyISO());
  const [saldoAnterior, setSaldoAnterior] = useState(String(ultimoSaldo || ''));
  const [ingresos, setIngresos] = useState('');
  const [gastos, setGastos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(editFormVacio());
  const [editGuardando, setEditGuardando] = useState(false);
  const [editError, setEditError] = useState('');

  const handleGuardar = async () => {
    setError('');
    setExito('');
    if (!fecha.trim()) { setError('Completa la fecha del movimiento.'); return; }

    setGuardando(true);
    try {
      await guardarMutation.mutateAsync({
        fecha: fecha.trim(),
        saldoAnterior: parseMonto(saldoAnterior),
        ingresos: parseMonto(ingresos),
        gastos: parseMonto(gastos),
        observaciones: observaciones.trim(),
      });
      setExito('Movimiento agregado correctamente.');
      setFecha(hoyISO());
      setSaldoAnterior('');
      setIngresos('');
      setGastos('');
      setObservaciones('');
      utils.cajaChica.listado.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar este movimiento de caja chica?')) return;
    await eliminarMutation.mutateAsync({ id });
    if (editandoId === id) setEditandoId(null);
    utils.cajaChica.listado.invalidate();
  };

  const iniciarEdicion = (m: (typeof movimientos)[number]) => {
    setEditError('');
    setEditandoId(m.id);
    setEditForm({
      fecha: m.fecha,
      saldoAnterior: String(m.saldoAnterior),
      ingresos: String(m.ingresos),
      gastos: String(m.gastos),
      observaciones: m.observaciones,
    });
  };

  const guardarEdicion = async () => {
    if (editandoId === null) return;
    setEditError('');
    if (!editForm.fecha.trim()) { setEditError('Completa la fecha del movimiento.'); return; }

    setEditGuardando(true);
    try {
      await editarMutation.mutateAsync({
        id: editandoId,
        fecha: editForm.fecha.trim(),
        saldoAnterior: parseMonto(editForm.saldoAnterior),
        ingresos: parseMonto(editForm.ingresos),
        gastos: parseMonto(editForm.gastos),
        observaciones: editForm.observaciones.trim(),
      });
      setEditandoId(null);
      utils.cajaChica.listado.invalidate();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setEditGuardando(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-cbvp-red" /> Agregar Movimiento de Caja Chica
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Saldo Anterior (Gs.)</label>
            <input type="text" value={saldoAnterior} onChange={(e) => setSaldoAnterior(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Ingresos (Gs.)</label>
            <input type="text" value={ingresos} onChange={(e) => setIngresos(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Gastos (Gs.)</label>
            <input type="text" value={gastos} onChange={(e) => setGastos(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Observaciones</label>
            <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        {exito && <p className="text-sm text-cbvp-green mb-3">{exito}</p>}

        <button onClick={handleGuardar} disabled={guardando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Agregar Movimiento'}
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Caja Chica</h3>
        {cargandoListado ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : movimientos.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay movimientos registrados todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Saldo Anterior</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Ingresos</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Gastos</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const editandoEstaFila = editandoId === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr
                        onClick={() => (editandoEstaFila ? setEditandoId(null) : iniciarEdicion(m))}
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                      >
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{m.fecha}</td>
                        <td className="px-2 py-1.5 text-white/60 text-right whitespace-nowrap">{formatearGs(m.saldoAnterior)}</td>
                        <td className="px-2 py-1.5 text-cbvp-green text-right whitespace-nowrap">{formatearGs(m.ingresos)}</td>
                        <td className="px-2 py-1.5 text-cbvp-red-light text-right whitespace-nowrap">{formatearGs(m.gastos)}</td>
                        <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${m.saldo < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(m.saldo)}</td>
                      </tr>
                      {editandoEstaFila && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={5} className="px-3 pb-4 pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Fecha</label>
                                <input type="date" value={editForm.fecha} onChange={(e) => setEditForm((prev) => ({ ...prev, fecha: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Saldo Anterior (Gs.)</label>
                                <input type="text" value={editForm.saldoAnterior} onChange={(e) => setEditForm((prev) => ({ ...prev, saldoAnterior: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Ingresos (Gs.)</label>
                                <input type="text" value={editForm.ingresos} onChange={(e) => setEditForm((prev) => ({ ...prev, ingresos: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Gastos (Gs.)</label>
                                <input type="text" value={editForm.gastos} onChange={(e) => setEditForm((prev) => ({ ...prev, gastos: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Observaciones</label>
                                <input type="text" value={editForm.observaciones} onChange={(e) => setEditForm((prev) => ({ ...prev, observaciones: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                            </div>

                            {editError && <p className="text-sm text-red-400 mb-3">{editError}</p>}

                            <div className="flex gap-2">
                              <button onClick={guardarEdicion} disabled={editGuardando} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                <Save className="w-4 h-4" /> {editGuardando ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
                              <button onClick={() => handleEliminar(m.id)} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                <Trash2 className="w-4 h-4" /> Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={4} className="px-2 py-2 text-right text-white/70">SALDO ACTUAL:</td>
                  <td className={`px-2 py-2 text-right ${ultimoSaldo < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(ultimoSaldo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

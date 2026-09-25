import { Fragment, useState } from 'react';
import { trpc } from '@/providers/trpc';
import { Landmark, Plus, Trash2, Save } from 'lucide-react';

function formatearGs(valor: number): string {
  return valor.toLocaleString('es-PY');
}

// El monto se carga como texto (para permitir "." como separador visual
// mientras se escribe) y se limpia a entero recien al guardar.
function parseMonto(valor: string): number {
  const limpio = valor.replace(/[^\d-]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

interface EditForm {
  nombre: string;
  cuenta: string;
  saldoInicial: string;
  observaciones: string;
}

function editFormVacio(): EditForm {
  return { nombre: '', cuenta: '', saldoInicial: '', observaciones: '' };
}

export default function CuentasEntidades() {
  const utils = trpc.useUtils();
  const { data: listadoData, isLoading: cargandoListado } = trpc.cuentasEntidades.listado.useQuery();
  const cuentas = listadoData?.exito ? listadoData.cuentas : [];

  const guardarMutation = trpc.cuentasEntidades.guardar.useMutation();
  const editarMutation = trpc.cuentasEntidades.editar.useMutation();
  const eliminarMutation = trpc.cuentasEntidades.eliminar.useMutation();

  const [nombre, setNombre] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');
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
    if (!nombre.trim() || !cuenta.trim()) { setError('Completa el nombre de la entidad y el numero de cuenta.'); return; }

    setGuardando(true);
    try {
      await guardarMutation.mutateAsync({
        nombre: nombre.trim(),
        cuenta: cuenta.trim(),
        saldoInicial: parseMonto(saldoInicial),
        observaciones: observaciones.trim(),
      });
      setExito('Cuenta agregada correctamente.');
      setNombre('');
      setCuenta('');
      setSaldoInicial('');
      setObservaciones('');
      utils.cuentasEntidades.listado.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar esta cuenta? No se borran las Ordenes de Pago ya cargadas con este banco.')) return;
    await eliminarMutation.mutateAsync({ id });
    if (editandoId === id) setEditandoId(null);
    utils.cuentasEntidades.listado.invalidate();
  };

  const iniciarEdicion = (c: (typeof cuentas)[number]) => {
    setEditError('');
    setEditandoId(c.id);
    setEditForm({ nombre: c.nombre, cuenta: c.cuenta, saldoInicial: String(c.saldoInicial), observaciones: c.observaciones });
  };

  const guardarEdicion = async () => {
    if (editandoId === null) return;
    setEditError('');
    if (!editForm.nombre.trim() || !editForm.cuenta.trim()) { setEditError('Completa el nombre de la entidad y el numero de cuenta.'); return; }

    setEditGuardando(true);
    try {
      await editarMutation.mutateAsync({
        id: editandoId,
        nombre: editForm.nombre.trim(),
        cuenta: editForm.cuenta.trim(),
        saldoInicial: parseMonto(editForm.saldoInicial),
        observaciones: editForm.observaciones.trim(),
      });
      setEditandoId(null);
      utils.cuentasEntidades.listado.invalidate();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setEditGuardando(false);
    }
  };

  const totalSaldo = cuentas.reduce((acc, c) => acc + c.saldo, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-cbvp-red" /> Agregar Cuenta en Entidad
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Entidad Financiera</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. UENO BANK" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Nr. de Cuenta</label>
            <input type="text" value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Saldo Inicial (Gs.)</label>
            <input type="text" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Observaciones</label>
            <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        {exito && <p className="text-sm text-cbvp-green mb-3">{exito}</p>}

        <button onClick={handleGuardar} disabled={guardando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Agregar Cuenta'}
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Cuentas en Entidades</h3>
        <p className="text-xs text-white/30 mb-4">
          Los debitos se calculan a partir de las Ordenes de Pago cargadas con esa cuenta. Los creditos todavia no tienen un modulo que los registre, por eso figuran en 0.
        </p>
        {cargandoListado ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : cuentas.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay cuentas registradas todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Entidad</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nr. Cuenta</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Saldo Inicial</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Creditos</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Debitos</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => {
                  const editandoEstaFila = editandoId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => (editandoEstaFila ? setEditandoId(null) : iniciarEdicion(c))}
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                      >
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{c.nombre}</td>
                        <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{c.cuenta}</td>
                        <td className="px-2 py-1.5 text-white/60 text-right whitespace-nowrap">{formatearGs(c.saldoInicial)}</td>
                        <td className="px-2 py-1.5 text-cbvp-green text-right whitespace-nowrap" title="Todavia no hay un modulo que registre creditos">{formatearGs(c.creditos)}</td>
                        <td className="px-2 py-1.5 text-cbvp-red-light text-right whitespace-nowrap">{formatearGs(c.debitos)}</td>
                        <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${c.saldo < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(c.saldo)}</td>
                      </tr>
                      {editandoEstaFila && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={6} className="px-3 pb-4 pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Entidad Financiera</label>
                                <input type="text" value={editForm.nombre} onChange={(e) => setEditForm((prev) => ({ ...prev, nombre: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Nr. de Cuenta</label>
                                <input type="text" value={editForm.cuenta} onChange={(e) => setEditForm((prev) => ({ ...prev, cuenta: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Saldo Inicial (Gs.)</label>
                                <input type="text" value={editForm.saldoInicial} onChange={(e) => setEditForm((prev) => ({ ...prev, saldoInicial: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
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
                              <button onClick={() => handleEliminar(c.id)} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
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
                  <td colSpan={5} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                  <td className={`px-2 py-2 text-right ${totalSaldo < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(totalSaldo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


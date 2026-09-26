import { Fragment, useState } from 'react';
import { trpc } from '@/providers/trpc';
import { LayoutDashboard, Plus, Trash2, Save, Pencil } from 'lucide-react';

function formatearGs(valor: number): string {
  return valor.toLocaleString('es-PY');
}

// El monto se carga como texto (para permitir "." como separador visual
// mientras se escribe) y se limpia a entero recien al guardar.
function parseMonto(valor: string): number {
  const limpio = valor.replace(/[^\d-]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

interface EditFormCuenta {
  nombre: string;
  cuenta: string;
  saldoInicial: string;
  observaciones: string;
}

function editFormCuentaVacio(): EditFormCuenta {
  return { nombre: '', cuenta: '', saldoInicial: '', observaciones: '' };
}

export default function ResumenFinanciero() {
  const utils = trpc.useUtils();

  const { data: cajaChicaData, isLoading: cargandoCajaChica } = trpc.cajaChica.listado.useQuery();
  const actualizarCajaChicaMutation = trpc.cajaChica.actualizar.useMutation();

  const { data: cuentasData, isLoading: cargandoCuentas } = trpc.cuentasEntidades.listado.useQuery();
  const cuentas = cuentasData?.exito ? cuentasData.cuentas : [];
  const guardarCuentaMutation = trpc.cuentasEntidades.guardar.useMutation();
  const editarCuentaMutation = trpc.cuentasEntidades.editar.useMutation();
  const eliminarCuentaMutation = trpc.cuentasEntidades.eliminar.useMutation();

  const cargando = cargandoCajaChica || cargandoCuentas;

  // --- Edicion de Caja Chica (fila especial dentro de la tabla combinada) ---
  const [editandoCajaChica, setEditandoCajaChica] = useState(false);
  const [saldoAnteriorForm, setSaldoAnteriorForm] = useState('');
  const [observacionesForm, setObservacionesForm] = useState('');
  const [guardandoCajaChica, setGuardandoCajaChica] = useState(false);
  const [errorCajaChica, setErrorCajaChica] = useState('');

  const iniciarEdicionCajaChica = () => {
    if (!cajaChicaData?.exito) return;
    setSaldoAnteriorForm(String(cajaChicaData.saldoAnterior));
    setObservacionesForm(cajaChicaData.observaciones);
    setErrorCajaChica('');
    setEditandoCajaChica(true);
  };

  const guardarCajaChica = async () => {
    setErrorCajaChica('');
    setGuardandoCajaChica(true);
    try {
      await actualizarCajaChicaMutation.mutateAsync({
        saldoAnterior: parseMonto(saldoAnteriorForm),
        observaciones: observacionesForm.trim(),
      });
      setEditandoCajaChica(false);
      utils.cajaChica.listado.invalidate();
    } catch (err: unknown) {
      setErrorCajaChica(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardandoCajaChica(false);
    }
  };

  // --- Alta de Cuenta en Entidad ---
  const [nombre, setNombre] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [errorCuenta, setErrorCuenta] = useState('');
  const [exitoCuenta, setExitoCuenta] = useState('');

  const handleGuardarCuenta = async () => {
    setErrorCuenta('');
    setExitoCuenta('');
    if (!nombre.trim() || !cuenta.trim()) { setErrorCuenta('Completa el nombre de la entidad y el numero de cuenta.'); return; }

    setGuardandoCuenta(true);
    try {
      await guardarCuentaMutation.mutateAsync({
        nombre: nombre.trim(),
        cuenta: cuenta.trim(),
        saldoInicial: parseMonto(saldoInicial),
        observaciones: observaciones.trim(),
      });
      setExitoCuenta('Cuenta agregada correctamente.');
      setNombre('');
      setCuenta('');
      setSaldoInicial('');
      setObservaciones('');
      utils.cuentasEntidades.listado.invalidate();
    } catch (err: unknown) {
      setErrorCuenta(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardandoCuenta(false);
    }
  };

  // --- Edicion / baja de Cuenta en Entidad ---
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormCuenta>(editFormCuentaVacio());
  const [editGuardando, setEditGuardando] = useState(false);
  const [editError, setEditError] = useState('');

  const iniciarEdicionCuenta = (c: (typeof cuentas)[number]) => {
    setEditError('');
    setEditandoCajaChica(false);
    setEditandoId(c.id);
    setEditForm({ nombre: c.nombre, cuenta: c.cuenta, saldoInicial: String(c.saldoInicial), observaciones: c.observaciones });
  };

  const guardarEdicionCuenta = async () => {
    if (editandoId === null) return;
    setEditError('');
    if (!editForm.nombre.trim() || !editForm.cuenta.trim()) { setEditError('Completa el nombre de la entidad y el numero de cuenta.'); return; }

    setEditGuardando(true);
    try {
      await editarCuentaMutation.mutateAsync({
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

  const handleEliminarCuenta = async (id: string) => {
    if (!confirm('Eliminar esta cuenta? No se borran las Ordenes de Pago ya cargadas con este banco.')) return;
    await eliminarCuentaMutation.mutateAsync({ id });
    if (editandoId === id) setEditandoId(null);
    utils.cuentasEntidades.listado.invalidate();
  };

  const ingresosCajaChica = cajaChicaData?.exito ? cajaChicaData.ingresos : 0;
  const gastosCajaChica = cajaChicaData?.exito ? cajaChicaData.gastos : 0;
  const saldoCajaChica = cajaChicaData?.exito ? cajaChicaData.saldo : 0;
  const ordenesCajaChica = cajaChicaData?.exito ? cajaChicaData.ordenes : [];
  const facturasCajaChica = cajaChicaData?.exito ? cajaChicaData.facturas : [];

  const totalGeneral = saldoCajaChica + cuentas.reduce((acc, c) => acc + c.saldo, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1 flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-cbvp-red" /> Resumen Financiero
        </h2>
        <p className="text-xs text-white/30 mb-4">
          Caja Chica y Cuentas en Entidades en una sola vista. Hace click en una fila para editarla.
        </p>

        {cargando ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
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
                <Fragment>
                  <tr
                    onClick={() => (editandoCajaChica ? setEditandoCajaChica(false) : iniciarEdicionCajaChica())}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                  >
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">Caja Chica</td>
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">-</td>
                    <td className="px-2 py-1.5 text-white/60 text-right whitespace-nowrap">{formatearGs(cajaChicaData?.exito ? cajaChicaData.saldoAnterior : 0)}</td>
                    <td className="px-2 py-1.5 text-cbvp-green text-right whitespace-nowrap">{formatearGs(ingresosCajaChica)}</td>
                    <td className="px-2 py-1.5 text-cbvp-red-light text-right whitespace-nowrap">{formatearGs(gastosCajaChica)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${saldoCajaChica < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(saldoCajaChica)}</td>
                  </tr>
                  {editandoCajaChica && (
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td colSpan={6} className="px-3 pb-4 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Saldo Anterior (Gs.)</label>
                            <input type="text" value={saldoAnteriorForm} onChange={(e) => setSaldoAnteriorForm(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Observaciones</label>
                            <input type="text" value={observacionesForm} onChange={(e) => setObservacionesForm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                          </div>
                        </div>
                        <p className="text-xs text-white/30 mb-3">Creditos se calcula sumando las Ordenes de Pago con tipo de movimiento "Caja Chica". Debitos se calcula sumando las Facturas de Gastos con Pagado Desde = Caja Chica.</p>

                        {errorCajaChica && <p className="text-sm text-red-400 mb-3">{errorCajaChica}</p>}

                        <div className="flex gap-2">
                          <button onClick={guardarCajaChica} disabled={guardandoCajaChica} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                            <Save className="w-4 h-4" /> {guardandoCajaChica ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button onClick={() => setEditandoCajaChica(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>

                {cuentas.map((c) => {
                  const editandoEstaFila = editandoId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => (editandoEstaFila ? setEditandoId(null) : iniciarEdicionCuenta(c))}
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                      >
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{c.nombre}</td>
                        <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{c.cuenta}</td>
                        <td className="px-2 py-1.5 text-white/60 text-right whitespace-nowrap">{formatearGs(c.saldoInicial)}</td>
                        <td className="px-2 py-1.5 text-cbvp-green text-right whitespace-nowrap">{formatearGs(c.creditos)}</td>
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
                              <button onClick={guardarEdicionCuenta} disabled={editGuardando} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                <Save className="w-4 h-4" /> {editGuardando ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
                              <button onClick={() => handleEliminarCuenta(c.id)} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
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
                  <td colSpan={5} className="px-2 py-2 text-right text-white/70">TOTAL GENERAL:</td>
                  <td className={`px-2 py-2 text-right ${totalGeneral < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(totalGeneral)}</td>
                </tr>
              </tfoot>
            </table>
            {cajaChicaData?.exito && cajaChicaData.observaciones && (
              <p className="text-xs text-white/40 mt-3">Caja Chica: {cajaChicaData.observaciones}</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-cbvp-red" /> Agregar Cuenta en Entidad
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

        {errorCuenta && <p className="text-sm text-red-400 mb-3">{errorCuenta}</p>}
        {exitoCuenta && <p className="text-sm text-cbvp-green mb-3">{exitoCuenta}</p>}

        <button onClick={handleGuardarCuenta} disabled={guardandoCuenta} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> {guardandoCuenta ? 'Guardando...' : 'Agregar Cuenta'}
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1 flex items-center gap-2">
          <Pencil className="w-3.5 h-3.5 text-cbvp-red" /> Ingresos de Caja Chica por Ordenes de Pago
        </h3>
        <p className="text-xs text-white/30 mb-4">
          Ordenes de Pago cargadas con tipo de movimiento "Caja Chica". Se suman automaticamente a los Creditos de Caja Chica arriba.
        </p>
        {cargandoCajaChica ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : ordenesCajaChica.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay Ordenes de Pago de Caja Chica todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nro.</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Banco</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Total</th>
                </tr>
              </thead>
              <tbody>
                {ordenesCajaChica.map((o) => (
                  <tr key={o.id} className="border-b border-white/5">
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{o.numero}/{o.anio}</td>
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{o.fecha}</td>
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{o.bancoNombre}</td>
                    <td className="px-2 py-1.5 text-cbvp-green text-right whitespace-nowrap">{formatearGs(o.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={3} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                  <td className="px-2 py-2 text-right text-cbvp-green">{formatearGs(ingresosCajaChica)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1 flex items-center gap-2">
          <Pencil className="w-3.5 h-3.5 text-cbvp-red" /> Gastos de Caja Chica por Facturas
        </h3>
        <p className="text-xs text-white/30 mb-4">
          Facturas de Gastos cargadas con Pagado Desde = Caja Chica. Se suman automaticamente a los Debitos de Caja Chica arriba.
        </p>
        {cargandoCajaChica ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : facturasCajaChica.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay Facturas de Gastos pagadas desde Caja Chica todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nro Factura</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Proveedor</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Monto</th>
                </tr>
              </thead>
              <tbody>
                {facturasCajaChica.map((f) => (
                  <tr key={f.id} className="border-b border-white/5">
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{f.nroFactura || '-'}</td>
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{f.fecha}</td>
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{f.proveedor}</td>
                    <td className="px-2 py-1.5 text-cbvp-red-light text-right whitespace-nowrap">{formatearGs(f.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={3} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                  <td className="px-2 py-2 text-right text-cbvp-red-light">{formatearGs(gastosCajaChica)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

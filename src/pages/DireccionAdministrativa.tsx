import { Fragment, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { trpc } from '@/providers/trpc';
import {
  Building2, Landmark, Plus, Trash2, Save, ChartColumn, Wallet, TrendingUp, TrendingDown,
  Fuel, Receipt, FileText, HandCoins, ChevronRight,
} from 'lucide-react';

function formatearGs(valor: number): string {
  return valor.toLocaleString('es-PY');
}

// El monto se carga como texto (para permitir "." como separador visual
// mientras se escribe) y se limpia a entero recien al guardar.
function parseMonto(valor: string): number {
  const limpio = valor.replace(/[^\d-]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Acepta fechas en "DD/MM/YYYY" o "YYYY-MM-DD" y devuelve una clave
// "YYYY-MM" para agrupar por mes.
function mesKeyDeFecha(fecha: string): string {
  if (!fecha) return '';
  if (fecha.includes('/')) {
    const partes = fecha.split('/');
    if (partes.length !== 3) return '';
    const [, mes, anio] = partes;
    return anio && mes ? `${anio}-${mes.padStart(2, '0')}` : '';
  }
  const partes = fecha.split('-');
  if (partes.length !== 3) return '';
  const [anio, mes] = partes;
  return anio && mes ? `${anio}-${mes.padStart(2, '0')}` : '';
}

interface GraficoTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>;
}

function GraficoTooltip({ active, label, payload }: GraficoTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-cbvp-dark-light border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white/70 font-medium mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-white/50">{item.name}:</span>
            <span className="text-white font-medium ml-auto">{formatearGs(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
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

const SUBMODULOS = [
  {
    title: 'Rendiciones de Combustible',
    description: 'Carga y seguimiento de rendiciones de combustible de los moviles.',
    icon: Fuel,
    path: '/rendiciones-combustible',
    color: 'text-cbvp-orange',
    bg: 'bg-cbvp-orange/8',
    border: 'border-cbvp-orange/15 hover:border-cbvp-orange/30',
  },
  {
    title: 'Cuotas de Bomberos',
    description: 'Control de cuotas societarias al dia por bombero.',
    icon: Wallet,
    path: '/cuotas-bomberos',
    color: 'text-cbvp-yellow',
    bg: 'bg-cbvp-yellow/8',
    border: 'border-cbvp-yellow/15 hover:border-cbvp-yellow/30',
  },
  {
    title: 'Ordenes de Pago',
    description: 'Emision y seguimiento de ordenes de pago de la compania.',
    icon: Receipt,
    path: '/ordenes-pago',
    color: 'text-cbvp-red',
    bg: 'bg-cbvp-red/8',
    border: 'border-cbvp-red/15 hover:border-cbvp-red/30',
  },
  {
    title: 'Facturas de Gastos',
    description: 'Registro de facturas pagadas desde Caja Chica u Ordenes de Pago.',
    icon: FileText,
    path: '/facturas-gastos',
    color: 'text-cbvp-green',
    bg: 'bg-cbvp-green/8',
    border: 'border-cbvp-green/15 hover:border-cbvp-green/30',
  },
  {
    title: 'Campaña de Socios',
    description: 'Reportes de campaña de socios y depositos en Ueno Bank.',
    icon: HandCoins,
    path: '/campana-socios',
    color: 'text-cbvp-purple',
    bg: 'bg-cbvp-purple/8',
    border: 'border-cbvp-purple/15 hover:border-cbvp-purple/30',
  },
];

export default function DireccionAdministrativa() {
  const utils = trpc.useUtils();

  // --- Saldos: Caja Chica + Cuentas en Entidades ---
  const { data: cajaChicaData, isLoading: cargandoCajaChica } = trpc.cajaChica.listado.useQuery();
  const actualizarCajaChicaMutation = trpc.cajaChica.actualizar.useMutation();

  const { data: cuentasData, isLoading: cargandoCuentas } = trpc.cuentasEntidades.listado.useQuery();
  const cuentas = cuentasData?.exito ? cuentasData.cuentas : [];
  const guardarCuentaMutation = trpc.cuentasEntidades.guardar.useMutation();
  const editarCuentaMutation = trpc.cuentasEntidades.editar.useMutation();
  const eliminarCuentaMutation = trpc.cuentasEntidades.eliminar.useMutation();

  const cargandoSaldos = cargandoCajaChica || cargandoCuentas;

  // --- Ingresos y egresos anuales de toda la compania ---
  const { data: cuotasData, isLoading: cargandoCuotas } = trpc.cuotasBomberos.listado.useQuery();
  const { data: campanaData, isLoading: cargandoCampana } = trpc.campanaSocios.listado.useQuery();
  const { data: facturasTodasData, isLoading: cargandoFacturasTodas } = trpc.facturasGastos.listado.useQuery();
  const { data: ordenesTodasData, isLoading: cargandoOrdenesTodas } = trpc.ordenesPago.listado.useQuery();
  const cargandoGrafico = cargandoCuotas || cargandoCampana || cargandoFacturasTodas || cargandoOrdenesTodas;

  const anioActual = new Date().getFullYear();
  const [anioSeleccionado, setAnioSeleccionado] = useState(anioActual);
  const aniosDisponibles = [anioActual, anioActual - 1, anioActual - 2, anioActual - 3];

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
  const [mostrarAgregarCuenta, setMostrarAgregarCuenta] = useState(false);
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

  const totalGeneral = saldoCajaChica + cuentas.reduce((acc, c) => acc + c.saldo, 0);

  // Ingresos = Cuotas de Bomberos + Campaña de Socios.
  // Egresos = Facturas de Gastos + Ordenes de Pago que NO sean reposicion de
  // Caja Chica (esas son un traspaso interno banco -> caja chica, no un gasto real).
  const datosAnuales = useMemo(() => {
    const porMes = new Map<string, { ingresos: number; egresos: number }>();
    for (let m = 1; m <= 12; m++) {
      porMes.set(`${anioSeleccionado}-${String(m).padStart(2, '0')}`, { ingresos: 0, egresos: 0 });
    }

    const sumar = (key: string, campo: 'ingresos' | 'egresos', valor: number) => {
      const actual = porMes.get(key);
      if (!actual) return;
      actual[campo] += valor;
    };

    if (cuotasData?.exito) {
      for (const p of cuotasData.pagos) sumar(mesKeyDeFecha(p.fechaEmision), 'ingresos', p.monto);
    }
    if (campanaData?.exito) {
      for (const r of campanaData.reportes) sumar(r.mes, 'ingresos', r.totalDepositado);
    }
    if (facturasTodasData?.exito) {
      for (const f of facturasTodasData.facturas) sumar(mesKeyDeFecha(f.fecha), 'egresos', f.monto);
    }
    if (ordenesTodasData?.exito) {
      for (const o of ordenesTodasData.ordenes) {
        if (o.tipoMovimiento === 'CAJA_CHICA') continue;
        sumar(mesKeyDeFecha(o.fecha), 'egresos', o.total);
      }
    }

    return Array.from(porMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, valores]) => {
        const mesNum = parseInt(key.split('-')[1], 10);
        return { mes: MESES_ABREV[mesNum - 1], ingresos: valores.ingresos, egresos: valores.egresos };
      });
  }, [cuotasData, campanaData, facturasTodasData, ordenesTodasData, anioSeleccionado]);

  const totalIngresosAnio = datosAnuales.reduce((acc, d) => acc + d.ingresos, 0);
  const totalEgresosAnio = datosAnuales.reduce((acc, d) => acc + d.egresos, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-cbvp-red/8 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-cbvp-red" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Direccion Administrativa</h1>
          <p className="text-xs text-white/40">Saldos, ingresos y egresos, y acceso rapido a cada submodulo.</p>
        </div>
      </div>

      {/* Estadisticas rapidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="relative overflow-hidden glass rounded-xl p-4 border border-white/10 card-hover">
          <div className="absolute top-0 left-0 right-0 h-1 bg-cbvp-blue" />
          <div className="flex items-center gap-3 mt-1">
            <div className="w-11 h-11 rounded-xl bg-cbvp-blue/8 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-cbvp-blue" />
            </div>
            <div>
              <span className={`text-2xl font-bold ${totalGeneral < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(totalGeneral)}</span>
              <p className="text-[11px] text-white/40 mt-0.5">Saldo General (Caja Chica + Cuentas)</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden glass rounded-xl p-4 border border-white/10 card-hover">
          <div className="absolute top-0 left-0 right-0 h-1 bg-cbvp-green" />
          <div className="flex items-center gap-3 mt-1">
            <div className="w-11 h-11 rounded-xl bg-cbvp-green/8 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-cbvp-green" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white">{formatearGs(totalIngresosAnio)}</span>
              <p className="text-[11px] text-white/40 mt-0.5">Ingresos {anioSeleccionado}</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden glass rounded-xl p-4 border border-white/10 card-hover">
          <div className="absolute top-0 left-0 right-0 h-1 bg-cbvp-red" />
          <div className="flex items-center gap-3 mt-1">
            <div className="w-11 h-11 rounded-xl bg-cbvp-red/8 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-cbvp-red" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white">{formatearGs(totalEgresosAnio)}</span>
              <p className="text-[11px] text-white/40 mt-0.5">Egresos {anioSeleccionado}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Saldos en Cuentas y Cajas */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Landmark className="w-4 h-4 text-cbvp-red" /> Saldos en Cuentas y Cajas
          </h2>
          <button
            onClick={() => setMostrarAgregarCuenta((v) => !v)}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Cuenta
          </button>
        </div>
        <p className="text-xs text-white/30 mb-4">
          Caja Chica y Cuentas en Entidades en una sola vista. Hace click en una fila para editarla.
        </p>

        {mostrarAgregarCuenta && (
          <div className="mb-4 p-4 bg-white/[0.02] border border-white/10 rounded-lg">
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

            <div className="flex gap-2">
              <button onClick={handleGuardarCuenta} disabled={guardandoCuenta} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> {guardandoCuenta ? 'Guardando...' : 'Agregar Cuenta'}
              </button>
              <button onClick={() => setMostrarAgregarCuenta(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {cargandoSaldos ? (
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

      {/* Ingresos vs Egresos anuales */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <ChartColumn className="w-4 h-4 text-cbvp-red" /> Ingresos vs Egresos por Mes
          </h2>
          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cbvp-red/50 focus:outline-none"
          >
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-white/30 mb-4">
          Ingresos: Cuotas de Bomberos + Campaña de Socios. Egresos: Facturas de Gastos + Ordenes de Pago (excepto reposiciones de Caja Chica, que son un traspaso interno).
        </p>
        {cargandoGrafico ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosAnuales} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={(v) => formatearGs(Number(v))} width={70} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<GraficoTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 12 }} formatter={(value) => <span className="text-white/60 text-xs">{value}</span>} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#008300" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="egresos" name="Egresos" fill="#e66767" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Acceso rapido a submodulos */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Submodulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUBMODULOS.map((mod) => (
            <NavLink key={mod.path} to={mod.path} className={`glass rounded-xl p-4 border ${mod.border} card-hover cursor-pointer block`}>
              <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}>
                  <mod.icon className={`w-5 h-5 ${mod.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white mb-1">{mod.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{mod.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 shrink-0 mt-1" />
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

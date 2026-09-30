import { Fragment, useRef, useState } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { Receipt, Plus, Trash2, Save, Download, X, Upload, Brain, Loader2, ExternalLink, FileText } from 'lucide-react';
import { TIPOS_MOVIMIENTO_ORDEN_PAGO, LABEL_TIPO_MOVIMIENTO, type TipoMovimientoOrdenPago } from '@contracts/ordenesPago';
import { exportarOrdenPagoPdf } from '@/lib/exportarOrdenPagoPdf';

const ACCEPT_ARCHIVO_ANTIGUO = '.pdf,application/pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const MAX_ARCHIVO_ANTIGUO_BYTES = 10 * 1024 * 1024;

function mimeArchivoAntiguo(file: File): string | null {
  const raw = (file.type || '').toLowerCase();
  if (raw === 'application/pdf' || raw === 'image/jpeg' || raw === 'image/png' || raw === 'image/webp') return raw;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}

function archivoAntiguoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

interface FilaDetalle {
  descripcion: string;
  bancoAlias: string;
  nroCuenta: string;
  monto: string;
}

function filaVacia(): FilaDetalle {
  return { descripcion: '', bancoAlias: '', nroCuenta: '', monto: '' };
}

interface EditForm {
  fecha: string;
  mesaEntrada: string;
  bancoNombre: string;
  bancoCuenta: string;
  tipoMovimiento: TipoMovimientoOrdenPago | '';
  detalle: FilaDetalle[];
  observaciones: string;
  comandanteNombre: string;
  directorNombre: string;
}

function editFormVacio(): EditForm {
  return { fecha: '', mesaEntrada: '', bancoNombre: '', bancoCuenta: '', tipoMovimiento: '', detalle: [filaVacia()], observaciones: '', comandanteNombre: '', directorNombre: '' };
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

const DURACION_LONG_PRESS_MS = 450;

export default function OrdenesPago() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();

  const { data: listadoData, isLoading: cargandoListado } = trpc.ordenesPago.listado.useQuery();
  const ordenes = listadoData?.exito ? listadoData.ordenes : [];

  const { data: cuentasData } = trpc.cuentasEntidades.listado.useQuery();
  const bancosSugeridos = cuentasData?.exito ? cuentasData.cuentas.map((c) => ({ nombre: c.nombre, cuenta: c.cuenta })) : [];

  const guardarMutation = trpc.ordenesPago.guardar.useMutation();
  const editarMutation = trpc.ordenesPago.editar.useMutation();
  const eliminarMutation = trpc.ordenesPago.eliminar.useMutation();
  const extraerMutation = trpc.ordenesPago.extraer.useMutation();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(editFormVacio());
  const [editGuardando, setEditGuardando] = useState(false);
  const [editError, setEditError] = useState('');

  const [fecha, setFecha] = useState(hoyDDMMYYYY());
  const [mesaEntrada, setMesaEntrada] = useState('');
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

  const [mostrarCargaAntigua, setMostrarCargaAntigua] = useState(false);
  const [archivoAntiguo, setArchivoAntiguo] = useState<File | null>(null);
  const [procesandoExtraccion, setProcesandoExtraccion] = useState(false);
  const [urlDocumentoExtraido, setUrlDocumentoExtraido] = useState('');
  const [errorExtraccion, setErrorExtraccion] = useState('');

  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [eliminandoSeleccion, setEliminandoSeleccion] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActivado = useRef(false);

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const iniciarLongPress = (id: string) => {
    longPressActivado.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressActivado.current = true;
      setEditandoId(null);
      setModoSeleccion(true);
      toggleSeleccion(id);
    }, DURACION_LONG_PRESS_MS);
  };

  const cancelarLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClickFila = (orden: (typeof ordenes)[number]) => {
    if (longPressActivado.current) {
      longPressActivado.current = false;
      return;
    }
    if (modoSeleccion) {
      toggleSeleccion(orden.id);
      return;
    }
    if (editandoId === orden.id) setEditandoId(null);
    else iniciarEdicion(orden);
  };

  const salirModoSeleccion = () => {
    setModoSeleccion(false);
    setSeleccionados(new Set());
  };

  const handleEliminarSeleccionados = async () => {
    if (seleccionados.size === 0) return;
    if (!confirm(`Eliminar ${seleccionados.size} ordenes de pago seleccionadas?`)) return;
    setEliminandoSeleccion(true);
    try {
      await Promise.all(Array.from(seleccionados).map((id) => eliminarMutation.mutateAsync({ id })));
      utils.ordenesPago.listado.invalidate();
      salirModoSeleccion();
    } finally {
      setEliminandoSeleccion(false);
    }
  };

  const totalDetalle = detalle.reduce((acc, d) => acc + parseMonto(d.monto), 0);

  const actualizarFila = (idx: number, campo: keyof FilaDetalle, valor: string) => {
    setDetalle((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
  };
  const agregarFila = () => setDetalle((prev) => [...prev, filaVacia()]);

  const handleBancoNombreChange = (valor: string) => {
    setBancoNombre(valor);
    const sugerido = bancosSugeridos.find((b) => b.nombre.toLowerCase() === valor.trim().toLowerCase());
    if (sugerido) setBancoCuenta(sugerido.cuenta);
  };
  const quitarFila = (idx: number) => setDetalle((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleArchivoAntiguoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setErrorExtraccion('');
    if (!f) { setArchivoAntiguo(null); return; }
    if (f.size > MAX_ARCHIVO_ANTIGUO_BYTES) { setErrorExtraccion('El archivo supera el tamano maximo de 10MB.'); return; }
    if (!mimeArchivoAntiguo(f)) { setErrorExtraccion('Formato no admitido. Usa PDF, JPG, PNG o WEBP.'); return; }
    setArchivoAntiguo(f);
  };

  const handleExtraerAntigua = async () => {
    if (!archivoAntiguo) return;
    const mimeType = mimeArchivoAntiguo(archivoAntiguo);
    if (!mimeType) { setErrorExtraccion('Formato no admitido. Usa PDF, JPG, PNG o WEBP.'); return; }
    setProcesandoExtraccion(true);
    setErrorExtraccion('');
    try {
      const base64 = await archivoAntiguoABase64(archivoAntiguo);
      const res = await extraerMutation.mutateAsync({ base64, mimeType });
      setFecha(res.fecha || hoyDDMMYYYY());
      handleBancoNombreChange(res.bancoNombre);
      if (res.bancoCuenta) setBancoCuenta(res.bancoCuenta);
      if (res.detalle.length > 0) {
        setDetalle(res.detalle.map((d) => ({ descripcion: d.descripcion, bancoAlias: d.bancoAlias, nroCuenta: d.nroCuenta, monto: d.monto ? String(d.monto) : '' })));
      }
      setObservaciones(res.observaciones);
      setComandanteNombre(res.comandanteNombre);
      setDirectorNombre(res.directorNombre);
      setUrlDocumentoExtraido(res.urlDocumento);
      if (res.uploadError) setErrorExtraccion(`No se pudo guardar el archivo adjunto: ${res.uploadError}`);
    } catch (err: unknown) {
      setErrorExtraccion(err instanceof Error ? err.message : 'Error al procesar el documento');
    } finally {
      setProcesandoExtraccion(false);
    }
  };

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
        mesaEntrada: mesaEntrada.trim(),
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
        urlDocumento: urlDocumentoExtraido,
      });
      setExito(`Orden de Pago N° ${res.numero}/${anioOrden} guardada correctamente.`);
      setFecha(hoyDDMMYYYY());
      setMesaEntrada('');
      setTipoMovimiento('');
      setDetalle([filaVacia()]);
      setObservaciones('');
      setMostrarCargaAntigua(false);
      setArchivoAntiguo(null);
      setUrlDocumentoExtraido('');
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
    if (editandoId === id) setEditandoId(null);
    utils.ordenesPago.listado.invalidate();
  };

  const iniciarEdicion = (orden: (typeof ordenes)[number]) => {
    setEditError('');
    setEditandoId(orden.id);
    setEditForm({
      fecha: orden.fecha,
      mesaEntrada: orden.mesaEntrada,
      bancoNombre: orden.bancoNombre,
      bancoCuenta: orden.bancoCuenta,
      tipoMovimiento: orden.tipoMovimiento as TipoMovimientoOrdenPago,
      detalle: orden.detalle.map((d) => ({ descripcion: d.descripcion, bancoAlias: d.bancoAlias, nroCuenta: d.nroCuenta, monto: String(d.monto) })),
      observaciones: orden.observaciones,
      comandanteNombre: orden.comandanteNombre,
      directorNombre: orden.directorNombre,
    });
  };

  const handleBancoNombreChangeEdit = (valor: string) => {
    const sugerido = bancosSugeridos.find((b) => b.nombre.toLowerCase() === valor.trim().toLowerCase());
    setEditForm((prev) => ({ ...prev, bancoNombre: valor, bancoCuenta: sugerido ? sugerido.cuenta : prev.bancoCuenta }));
  };

  const actualizarFilaEdit = (idx: number, campo: keyof FilaDetalle, valor: string) => {
    setEditForm((prev) => ({ ...prev, detalle: prev.detalle.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)) }));
  };
  const agregarFilaEdit = () => setEditForm((prev) => ({ ...prev, detalle: [...prev.detalle, filaVacia()] }));
  const quitarFilaEdit = (idx: number) => setEditForm((prev) => (prev.detalle.length > 1 ? { ...prev, detalle: prev.detalle.filter((_, i) => i !== idx) } : prev));

  const guardarEdicion = async () => {
    if (editandoId === null) return;
    setEditError('');
    if (!editForm.fecha) { setEditError('Completa la fecha.'); return; }
    if (!editForm.bancoNombre.trim() || !editForm.bancoCuenta.trim()) { setEditError('Completa el banco y el numero de cuenta de la compania.'); return; }
    if (!editForm.tipoMovimiento) { setEditError('Selecciona el tipo de movimiento.'); return; }
    const detalleValido = editForm.detalle.filter((d) => d.descripcion.trim() && parseMonto(d.monto) > 0);
    if (detalleValido.length === 0) { setEditError('Agrega al menos un concepto con descripcion y monto.'); return; }

    setEditGuardando(true);
    try {
      await editarMutation.mutateAsync({
        id: editandoId,
        fecha: editForm.fecha,
        mesaEntrada: editForm.mesaEntrada.trim(),
        bancoNombre: editForm.bancoNombre.trim(),
        bancoCuenta: editForm.bancoCuenta.trim(),
        tipoMovimiento: editForm.tipoMovimiento,
        detalle: detalleValido.map((d) => ({
          descripcion: d.descripcion.trim(),
          bancoAlias: d.bancoAlias.trim(),
          nroCuenta: d.nroCuenta.trim(),
          monto: parseMonto(d.monto),
        })),
        observaciones: editForm.observaciones.trim(),
        comandanteNombre: editForm.comandanteNombre.trim(),
        directorNombre: editForm.directorNombre.trim(),
      });
      setEditandoId(null);
      utils.ordenesPago.listado.invalidate();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setEditGuardando(false);
    }
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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-cbvp-red" /> Nueva Orden de Pago
          </h2>
          <button
            onClick={() => { setMostrarCargaAntigua((v) => !v); setErrorExtraccion(''); }}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Cargar Orden Antigua (con IA)
          </button>
        </div>

        {mostrarCargaAntigua && (
          <div className="mb-4 p-4 bg-white/[0.02] border border-white/10 rounded-lg">
            <p className="text-xs text-white/30 mb-3">
              Subi una foto o PDF de una Orden de Pago vieja, de antes de este sistema. La IA completa los campos de abajo (revisalos antes de guardar) y despues se guarda igual que una orden nueva.
            </p>
            <div className="mb-3">
              <input type="file" accept={ACCEPT_ARCHIVO_ANTIGUO} onChange={handleArchivoAntiguoChange} className="hidden" id="orden-antigua-archivo" />
              <label htmlFor="orden-antigua-archivo" className="w-full max-w-md flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" /> {archivoAntiguo ? archivoAntiguo.name : 'Seleccionar archivo'}
              </label>
            </div>
            <button
              onClick={handleExtraerAntigua}
              disabled={!archivoAntiguo || procesandoExtraccion}
              className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 disabled:opacity-50 text-cbvp-red-light rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              {procesandoExtraccion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {procesandoExtraccion ? 'Leyendo documento...' : 'Extraer datos con IA'}
            </button>
            {urlDocumentoExtraido && !procesandoExtraccion && (
              <p className="text-xs text-cbvp-green mt-2">Documento adjuntado. Los campos de abajo se completaron automaticamente.</p>
            )}
            {errorExtraccion && <p className="text-sm text-red-400 mt-2">{errorExtraccion}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Mesa de Entrada</label>
            <input
              type="text"
              value={mesaEntrada}
              onChange={(e) => setMesaEntrada(e.target.value)}
              placeholder="Se completa despues de enviar"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Banco de la Compania</label>
            <input
              type="text"
              list="bancos-sugeridos-op"
              value={bancoNombre}
              onChange={(e) => handleBancoNombreChange(e.target.value)}
              placeholder="Ej. UENO BANK"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
            />
            <datalist id="bancos-sugeridos-op">
              {bancosSugeridos.map((b) => (
                <option key={b.nombre} value={b.nombre} />
              ))}
            </datalist>
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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Historial de Ordenes de Pago</h3>
          {modoSeleccion && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">{seleccionados.size} seleccionada{seleccionados.size === 1 ? '' : 's'}</span>
              <button
                onClick={handleEliminarSeleccionados}
                disabled={seleccionados.size === 0 || eliminandoSeleccion}
                className="px-3 py-1.5 bg-cbvp-red/10 hover:bg-cbvp-red/20 disabled:opacity-50 text-cbvp-red-light rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> {eliminandoSeleccion ? 'Eliminando...' : 'Eliminar seleccionadas'}
              </button>
              <button onClick={salirModoSeleccion} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs transition-colors">Cancelar</button>
            </div>
          )}
        </div>
        {!modoSeleccion && <p className="text-xs text-white/30 mb-4">Manten presionado el click en una fila para seleccionar varias y eliminarlas juntas.</p>}
        {cargandoListado ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : ordenes.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay ordenes de pago registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {modoSeleccion && <th className="w-8"></th>}
                  <th className="text-left px-2 py-2 font-medium text-white/50">OP N°</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Mesa Entrada</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Tipo</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Concepto</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Total (Gs.)</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Doc.</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50"></th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => {
                  const editandoEstaFila = editandoId === o.id;
                  const editTotalDetalle = editForm.detalle.reduce((acc, d) => acc + parseMonto(d.monto), 0);
                  const seleccionada = seleccionados.has(o.id);
                  return (
                    <Fragment key={o.id}>
                      <tr
                        onMouseDown={() => iniciarLongPress(o.id)}
                        onMouseUp={cancelarLongPress}
                        onMouseLeave={cancelarLongPress}
                        onTouchStart={() => iniciarLongPress(o.id)}
                        onTouchEnd={cancelarLongPress}
                        onClick={() => handleClickFila(o)}
                        className={`border-b border-white/5 hover:bg-white/[0.02] cursor-pointer select-none ${seleccionada ? 'bg-cbvp-red/10' : ''}`}
                      >
                        {modoSeleccion && (
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={seleccionada} onChange={() => toggleSeleccion(o.id)} onClick={(e) => e.stopPropagation()} className="accent-cbvp-red w-4 h-4" />
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{o.numero}/{o.anio}</td>
                        <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{o.fecha}</td>
                        <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{o.mesaEntrada || '-'}</td>
                        <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{LABEL_TIPO_MOVIMIENTO[o.tipoMovimiento as TipoMovimientoOrdenPago] || o.tipoMovimiento}</td>
                        <td className="px-2 py-1.5 text-white/60 max-w-[220px] truncate" title={o.detalle.map((d) => d.descripcion).join(', ')}>
                          {o.detalle.map((d) => d.descripcion).join(', ') || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{o.total.toLocaleString('es-PY')}</td>
                        <td className="px-2 py-1.5">
                          {o.urlDocumento ? (
                            <a href={o.urlDocumento} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="text-cbvp-red-light hover:text-cbvp-red-light/80 inline-flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExportar(o); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            disabled={exportandoId === o.id}
                            className="p-1.5 rounded-lg hover:bg-cbvp-green/20 text-white/40 hover:text-cbvp-green disabled:opacity-50 transition-colors"
                            title="Exportar PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {editandoEstaFila && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={8} className="px-3 pb-4 pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Fecha</label>
                                <input
                                  type="date"
                                  value={fechaDDMMYYYYaISO(editForm.fecha)}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, fecha: fechaISOaDDMMYYYY(e.target.value) }))}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none [color-scheme:dark]"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Mesa de Entrada</label>
                                <input
                                  type="text"
                                  value={editForm.mesaEntrada}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, mesaEntrada: e.target.value }))}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Banco de la Compania</label>
                                <input
                                  type="text"
                                  list="bancos-sugeridos-op"
                                  value={editForm.bancoNombre}
                                  onChange={(e) => handleBancoNombreChangeEdit(e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Nr. de Cuenta</label>
                                <input
                                  type="text"
                                  value={editForm.bancoCuenta}
                                  onChange={(e) => setEditForm((prev) => ({ ...prev, bancoCuenta: e.target.value }))}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="mb-3">
                              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Tipo de Movimiento</label>
                              <div className="flex flex-wrap gap-4">
                                {TIPOS_MOVIMIENTO_ORDEN_PAGO.map((t) => (
                                  <label key={t} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                                    <input type="radio" name={`tipoMovimientoEdit-${o.id}`} checked={editForm.tipoMovimiento === t} onChange={() => setEditForm((prev) => ({ ...prev, tipoMovimiento: t }))} className="accent-cbvp-red w-4 h-4" />
                                    {LABEL_TIPO_MOVIMIENTO[t]}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="mb-3">
                              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Detalle del Concepto / Objeto de Pago</label>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                  <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                      <th className="text-left px-2 py-2 font-medium text-white/50">Descripcion / Concepto</th>
                                      <th className="text-left px-2 py-2 font-medium text-white/50">Banco / Alias</th>
                                      <th className="text-left px-2 py-2 font-medium text-white/50">Nr. Cuenta</th>
                                      <th className="text-left px-2 py-2 font-medium text-white/50">Monto (Gs.)</th>
                                      <th className="w-8"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {editForm.detalle.map((f, idx) => (
                                      <tr key={idx} className="border-b border-white/5">
                                        <td className="px-2 py-1.5">
                                          <input type="text" value={f.descripcion} onChange={(e) => actualizarFilaEdit(idx, 'descripcion', e.target.value)} className="w-full min-w-[160px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <input type="text" value={f.bancoAlias} onChange={(e) => actualizarFilaEdit(idx, 'bancoAlias', e.target.value)} className="w-full min-w-[100px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <input type="text" value={f.nroCuenta} onChange={(e) => actualizarFilaEdit(idx, 'nroCuenta', e.target.value)} className="w-full min-w-[100px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <input type="text" value={f.monto} onChange={(e) => actualizarFilaEdit(idx, 'monto', e.target.value)} className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <button onClick={() => quitarFilaEdit(idx)} disabled={editForm.detalle.length === 1} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-white/5 font-semibold">
                                      <td colSpan={3} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                                      <td className="px-2 py-2 text-white">{editTotalDetalle.toLocaleString('es-PY')}</td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                              <button onClick={agregarFilaEdit} type="button" className="mt-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs flex items-center gap-2 transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Agregar fila
                              </button>
                            </div>

                            <div className="mb-3">
                              <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Observaciones</label>
                              <textarea value={editForm.observaciones} onChange={(e) => setEditForm((prev) => ({ ...prev, observaciones: e.target.value }))} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none resize-none" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Comandante o Presidente</label>
                                <input type="text" value={editForm.comandanteNombre} onChange={(e) => setEditForm((prev) => ({ ...prev, comandanteNombre: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Director Administrativo o Tesorero</label>
                                <input type="text" value={editForm.directorNombre} onChange={(e) => setEditForm((prev) => ({ ...prev, directorNombre: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                            </div>

                            {editError && <p className="text-sm text-red-400 mb-3">{editError}</p>}

                            <div className="flex gap-2">
                              <button onClick={guardarEdicion} disabled={editGuardando} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                <Save className="w-4 h-4" /> {editGuardando ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
                              <button onClick={() => handleEliminar(o.id)} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
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
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

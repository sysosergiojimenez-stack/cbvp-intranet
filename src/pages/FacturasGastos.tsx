import { Fragment, useState } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { FileText, Upload, Brain, Save, Trash2, ExternalLink, Loader2 } from 'lucide-react';

const ACCEPT_ARCHIVO = '.pdf,application/pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;

function mimeArchivo(file: File): string | null {
  const raw = (file.type || '').toLowerCase();
  if (raw === 'application/pdf' || raw === 'image/jpeg' || raw === 'image/png' || raw === 'image/webp') return raw;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function formatearGs(valor: number): string {
  return valor.toLocaleString('es-PY');
}

interface OrdenPagoResumen {
  id: string;
  numero: number;
  anio: number;
  bancoNombre: string;
  total: number;
}

const VALOR_CAJA_CHICA = 'CAJA_CHICA';

function labelOrden(o: OrdenPagoResumen): string {
  return `OP ${o.numero}/${o.anio} - ${o.bancoNombre} (${formatearGs(o.total)} Gs)`;
}

function valorDeOrden(ordenId: string): string {
  return `ORDEN:${ordenId}`;
}

// El desplegable de "Pagado Desde" codifica en un solo valor si se eligio
// Caja Chica o una Orden de Pago especifica; esta funcion lo separa en los
// 3 campos que se guardan (tipo, id de la orden y una etiqueta legible que
// no depende de que la orden siga existiendo despues).
function parsePagadoDesde(valor: string, ordenes: OrdenPagoResumen[]): { tipo: 'CAJA_CHICA' | 'ORDEN_PAGO'; ordenId: string; label: string } | null {
  if (!valor) return null;
  if (valor === VALOR_CAJA_CHICA) return { tipo: 'CAJA_CHICA', ordenId: '', label: 'Caja Chica' };
  const ordenId = valor.replace(/^ORDEN:/, '');
  const orden = ordenes.find((o) => o.id === ordenId);
  if (!orden) return null;
  return { tipo: 'ORDEN_PAGO', ordenId, label: labelOrden(orden) };
}

function SelectPagadoDesde({ value, onChange, ordenes }: { value: string; onChange: (v: string) => void; ordenes: OrdenPagoResumen[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
      <option value="">Seleccionar...</option>
      <option value={VALOR_CAJA_CHICA}>Caja Chica</option>
      {ordenes.length > 0 && (
        <optgroup label="Ordenes de Pago">
          {ordenes.map((o) => (
            <option key={o.id} value={valorDeOrden(o.id)}>{labelOrden(o)}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

interface DatosExtraidos {
  nroFactura: string;
  fecha: string;
  proveedor: string;
  detalle: string;
  monto: number;
  pagadoDesdeValor: string;
  urlDocumento: string;
  uploadError?: string;
}

interface EditForm {
  nroFactura: string;
  fecha: string;
  proveedor: string;
  detalle: string;
  monto: string;
  pagadoDesdeValor: string;
}

export default function FacturasGastos() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();

  const { data: ordenesData } = trpc.ordenesPago.listado.useQuery();
  const ordenes: OrdenPagoResumen[] = ordenesData?.exito
    ? ordenesData.ordenes.map((o) => ({ id: o.id, numero: o.numero, anio: o.anio, bancoNombre: o.bancoNombre, total: o.total }))
    : [];

  const { data: listadoData, isLoading: cargandoListado } = trpc.facturasGastos.listado.useQuery();
  const facturas = listadoData?.exito ? listadoData.facturas : [];

  const extraerMutation = trpc.facturasGastos.extraer.useMutation();
  const guardarMutation = trpc.facturasGastos.guardar.useMutation();
  const editarMutation = trpc.facturasGastos.editar.useMutation();
  const eliminarMutation = trpc.facturasGastos.eliminar.useMutation();

  const [archivo, setArchivo] = useState<File | null>(null);
  const [datos, setDatos] = useState<DatosExtraidos | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editGuardando, setEditGuardando] = useState(false);
  const [editError, setEditError] = useState('');

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setError('');
    setDatos(null);
    if (!f) { setArchivo(null); return; }
    if (f.size > MAX_ARCHIVO_BYTES) { setError('El archivo supera el tamano maximo de 10MB.'); return; }
    if (!mimeArchivo(f)) { setError('Formato no admitido. Usa PDF, JPG, PNG o WEBP.'); return; }
    setArchivo(f);
  };

  const handleExtraer = async () => {
    if (!archivo) return;
    const mimeType = mimeArchivo(archivo);
    if (!mimeType) { setError('Formato no admitido. Usa PDF, JPG, PNG o WEBP.'); return; }
    setProcesando(true); setError('');
    try {
      const base64 = await fileToBase64(archivo);
      const res = await extraerMutation.mutateAsync({ base64, mimeType });
      setDatos({
        nroFactura: res.nroFactura,
        fecha: res.fecha,
        proveedor: res.proveedor,
        detalle: res.detalle,
        monto: res.monto,
        pagadoDesdeValor: '',
        urlDocumento: res.urlDocumento,
        uploadError: res.uploadError,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar el documento');
    } finally {
      setProcesando(false);
    }
  };

  const handleGuardar = async () => {
    if (!datos) return;
    const pagadoDesde = parsePagadoDesde(datos.pagadoDesdeValor, ordenes);
    if (!pagadoDesde) { setError('Selecciona desde donde se pago esta factura.'); return; }
    setGuardando(true); setError('');
    try {
      await guardarMutation.mutateAsync({
        nroFactura: datos.nroFactura,
        fecha: datos.fecha,
        proveedor: datos.proveedor,
        detalle: datos.detalle,
        monto: datos.monto,
        pagadoDesdeTipo: pagadoDesde.tipo,
        pagadoDesdeOrdenId: pagadoDesde.ordenId,
        pagadoDesdeLabel: pagadoDesde.label,
        urlDocumento: datos.urlDocumento,
        cargadoPor: usuario?.codigo || '',
      });
      setArchivo(null); setDatos(null);
      utils.facturasGastos.listado.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar esta factura de gastos?')) return;
    await eliminarMutation.mutateAsync({ id });
    if (editandoId === id) setEditandoId(null);
    utils.facturasGastos.listado.invalidate();
  };

  const iniciarEdicion = (f: (typeof facturas)[number]) => {
    setEditError('');
    setEditandoId(f.id);
    setEditForm({
      nroFactura: f.nroFactura,
      fecha: f.fecha,
      proveedor: f.proveedor,
      detalle: f.detalle,
      monto: String(f.monto),
      pagadoDesdeValor: f.pagadoDesdeTipo === 'ORDEN_PAGO' ? valorDeOrden(f.pagadoDesdeOrdenId) : VALOR_CAJA_CHICA,
    });
  };

  const guardarEdicion = async () => {
    if (editandoId === null || !editForm) return;
    setEditError('');
    const pagadoDesde = parsePagadoDesde(editForm.pagadoDesdeValor, ordenes);
    if (!editForm.proveedor.trim() || !editForm.fecha.trim() || !pagadoDesde) {
      setEditError('Completa proveedor, fecha y pagado desde.');
      return;
    }
    setEditGuardando(true);
    try {
      await editarMutation.mutateAsync({
        id: editandoId,
        nroFactura: editForm.nroFactura.trim(),
        fecha: editForm.fecha.trim(),
        proveedor: editForm.proveedor.trim(),
        detalle: editForm.detalle.trim(),
        monto: Number(editForm.monto) || 0,
        pagadoDesdeTipo: pagadoDesde.tipo,
        pagadoDesdeOrdenId: pagadoDesde.ordenId,
        pagadoDesdeLabel: pagadoDesde.label,
      });
      setEditandoId(null);
      utils.facturasGastos.listado.invalidate();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setEditGuardando(false);
    }
  };

  const totalMonto = facturas.reduce((acc, f) => acc + f.monto, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-cbvp-red" /> Facturas de Gastos
        </h2>

        <div className="mb-4">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Factura o recibo (foto o PDF)</label>
          <input type="file" accept={ACCEPT_ARCHIVO} onChange={handleArchivoChange} className="hidden" id="factura-archivo" />
          <label htmlFor="factura-archivo" className="w-full max-w-md flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" /> {archivo ? archivo.name : 'Seleccionar archivo'}
          </label>
        </div>

        {!datos ? (
          <button
            onClick={handleExtraer}
            disabled={!archivo || procesando}
            className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 disabled:opacity-50 text-cbvp-red-light rounded-lg text-sm flex items-center gap-2 transition-colors"
          >
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {procesando ? 'Leyendo documento...' : 'Extraer datos con IA'}
          </button>
        ) : (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Nro Factura</label>
                <input type="text" value={datos.nroFactura} onChange={(e) => setDatos({ ...datos, nroFactura: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Fecha</label>
                <input type="date" value={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Proveedor</label>
                <input type="text" value={datos.proveedor} onChange={(e) => setDatos({ ...datos, proveedor: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Detalle</label>
                <input type="text" value={datos.detalle} onChange={(e) => setDatos({ ...datos, detalle: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Monto (Gs)</label>
                <input type="number" value={datos.monto} onChange={(e) => setDatos({ ...datos, monto: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Pagado Desde</label>
                <SelectPagadoDesde value={datos.pagadoDesdeValor} onChange={(v) => setDatos({ ...datos, pagadoDesdeValor: v })} ordenes={ordenes} />
              </div>
            </div>

            {datos.uploadError && <p className="text-xs text-amber-400">No se pudo guardar el archivo adjunto: {datos.uploadError}</p>}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button onClick={handleGuardar} disabled={guardando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Confirmar y Guardar'}
              </button>
              <button onClick={() => { setDatos(null); setArchivo(null); }} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!datos && error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Historial de Facturas</h3>
        {cargandoListado ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : facturas.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay facturas de gastos registradas todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nro Factura</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Proveedor</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Detalle</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Monto</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Pagado Desde</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Doc.</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => {
                  const editandoEstaFila = editandoId === f.id && editForm;
                  return (
                    <Fragment key={f.id}>
                      <tr
                        onClick={() => (editandoId === f.id ? setEditandoId(null) : iniciarEdicion(f))}
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                      >
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{f.nroFactura || '-'}</td>
                        <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{f.fecha}</td>
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{f.proveedor}</td>
                        <td className="px-2 py-1.5 text-white/60">{f.detalle || '-'}</td>
                        <td className="px-2 py-1.5 text-white/70 text-right whitespace-nowrap">{formatearGs(f.monto)}</td>
                        <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{f.pagadoDesdeLabel}</td>
                        <td className="px-2 py-1.5">
                          {f.urlDocumento ? (
                            <a href={f.urlDocumento} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-cbvp-red-light hover:text-cbvp-red-light/80 inline-flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                      {editandoEstaFila && editForm && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={7} className="px-3 pb-4 pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Nro Factura</label>
                                <input type="text" value={editForm.nroFactura} onChange={(e) => setEditForm((prev) => prev && ({ ...prev, nroFactura: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Fecha</label>
                                <input type="date" value={editForm.fecha} onChange={(e) => setEditForm((prev) => prev && ({ ...prev, fecha: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none [color-scheme:dark]" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Proveedor</label>
                                <input type="text" value={editForm.proveedor} onChange={(e) => setEditForm((prev) => prev && ({ ...prev, proveedor: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Detalle</label>
                                <input type="text" value={editForm.detalle} onChange={(e) => setEditForm((prev) => prev && ({ ...prev, detalle: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Monto (Gs)</label>
                                <input type="number" value={editForm.monto} onChange={(e) => setEditForm((prev) => prev && ({ ...prev, monto: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Pagado Desde</label>
                                <SelectPagadoDesde value={editForm.pagadoDesdeValor} onChange={(v) => setEditForm((prev) => prev && ({ ...prev, pagadoDesdeValor: v }))} ordenes={ordenes} />
                              </div>
                            </div>

                            {editError && <p className="text-sm text-red-400 mb-3">{editError}</p>}

                            <div className="flex gap-2">
                              <button onClick={guardarEdicion} disabled={editGuardando} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                <Save className="w-4 h-4" /> {editGuardando ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
                              <button onClick={() => handleEliminar(f.id)} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
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
                  <td colSpan={4} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                  <td className="px-2 py-2 text-right text-white">{formatearGs(totalMonto)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

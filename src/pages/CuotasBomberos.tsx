import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { Wallet, Upload, Brain, Save, Trash2, FileText, ExternalLink, Loader2 } from 'lucide-react';

const ACCEPT_ARCHIVO = '.pdf,application/pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;
const MONTO_POR_MES = 5000;

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

function formatearMesAnio(mesAnio: string): string {
  if (!mesAnio) return '-';
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const [anio, mes] = mesAnio.split('-');
  const idx = parseInt(mes, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return mesAnio;
  return `${MESES[idx]} ${anio}`;
}

interface DatosExtraidos {
  fechaEmision: string;
  nroFactura: string;
  monto: number;
  meses: number;
  cuotaActual: string;
  cuotaNueva: string;
  urlDocumento: string;
  uploadError?: string;
}

export default function CuotasBomberos() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();

  const { data: personalData } = trpc.personal.list.useQuery();
  const personal = personalData?.exito ? personalData.personal : [];

  const { data: listadoData, isLoading: cargandoListado } = trpc.cuotasBomberos.listado.useQuery();
  const pagos = listadoData?.exito ? listadoData.pagos : [];

  const extraerMutation = trpc.cuotasBomberos.extraer.useMutation();
  const guardarMutation = trpc.cuotasBomberos.guardar.useMutation();
  const eliminarMutation = trpc.cuotasBomberos.eliminar.useMutation();

  const [codigo, setCodigo] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [datos, setDatos] = useState<DatosExtraidos | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const bomberoSeleccionado = personal.find((p) => p.codigo === codigo);

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
    if (!codigo || !archivo) return;
    const mimeType = mimeArchivo(archivo);
    if (!mimeType) { setError('Formato no admitido. Usa PDF, JPG, PNG o WEBP.'); return; }
    setProcesando(true); setError('');
    try {
      const base64 = await fileToBase64(archivo);
      const res = await extraerMutation.mutateAsync({ codigo, base64, mimeType });
      setDatos({
        fechaEmision: res.fechaEmision,
        nroFactura: res.nroFactura,
        monto: res.monto,
        meses: res.meses,
        cuotaActual: res.cuotaActual,
        cuotaNueva: res.cuotaNueva,
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
    if (!datos || !codigo) return;
    setGuardando(true); setError('');
    try {
      const res = await guardarMutation.mutateAsync({
        codigo,
        fechaEmision: datos.fechaEmision,
        nroFactura: datos.nroFactura,
        monto: datos.monto,
        meses: datos.meses,
        cuotaAnterior: datos.cuotaActual,
        cuotaNueva: datos.cuotaNueva,
        urlDocumento: datos.urlDocumento,
        cargadoPor: usuario?.codigo || '',
      });
      if (!res.exito) { setError(res.error); return; }
      setCodigo(''); setArchivo(null); setDatos(null);
      utils.cuotasBomberos.listado.invalidate();
      utils.personal.list.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar este registro de pago? Esto no revierte la cuota del bombero.')) return;
    await eliminarMutation.mutateAsync({ id });
    utils.cuotasBomberos.listado.invalidate();
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-cbvp-red" /> Cuotas de Bomberos
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Bombero</label>
            <select
              value={codigo}
              onChange={(e) => { setCodigo(e.target.value); setDatos(null); }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
            >
              <option value="">Seleccionar...</option>
              {[...personal].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)).map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.nombreCompleto} ({p.codigo})</option>
              ))}
            </select>
            {bomberoSeleccionado && (
              <p className="text-xs text-white/40 mt-1">
                {bomberoSeleccionado.nombreCompleto} · Cuota al dia hasta: {formatearMesAnio(bomberoSeleccionado.cuota)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Factura o recibo (PDF o foto)</label>
            <input type="file" accept={ACCEPT_ARCHIVO} onChange={handleArchivoChange} className="hidden" id="cuota-archivo" />
            <label htmlFor="cuota-archivo" className="w-full flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" /> {archivo ? archivo.name : 'Seleccionar archivo'}
            </label>
          </div>
        </div>

        {!datos ? (
          <button
            onClick={handleExtraer}
            disabled={!codigo || !archivo || procesando}
            className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 disabled:opacity-50 text-cbvp-red-light rounded-lg text-sm flex items-center gap-2 transition-colors"
          >
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {procesando ? 'Leyendo documento...' : 'Extraer datos con IA'}
          </button>
        ) : (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Fecha emision</label>
                <input type="text" value={datos.fechaEmision} onChange={(e) => setDatos({ ...datos, fechaEmision: e.target.value })} placeholder="DD/MM/AAAA" className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Nro Factura/Recibo</label>
                <input type="text" value={datos.nroFactura} onChange={(e) => setDatos({ ...datos, nroFactura: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Monto (Gs)</label>
                <input
                  type="number"
                  value={datos.monto}
                  onChange={(e) => {
                    const monto = Number(e.target.value) || 0;
                    const meses = Math.floor(monto / MONTO_POR_MES);
                    setDatos({ ...datos, monto, meses });
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Meses (5.000 Gs c/u)</label>
                <input type="number" value={datos.meses} onChange={(e) => setDatos({ ...datos, meses: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm bg-white/[0.02] rounded-lg p-3">
              <span className="text-white/40">Cuota anterior: <span className="text-white/70">{formatearMesAnio(datos.cuotaActual)}</span></span>
              <span className="text-white/40">→</span>
              <div className="flex items-center gap-2">
                <span className="text-white/40">Cuota nueva (hasta):</span>
                <input type="month" value={datos.cuotaNueva} onChange={(e) => setDatos({ ...datos, cuotaNueva: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:border-cbvp-red/50 focus:outline-none [color-scheme:dark]" />
              </div>
            </div>

            {datos.uploadError && <p className="text-xs text-amber-400">No se pudo guardar el archivo adjunto: {datos.uploadError}</p>}

            {!datos.cuotaActual && (
              <p className="text-xs text-amber-400">Este bombero no tiene una cuota previa registrada — completa manualmente hasta que mes queda pagada antes de guardar.</p>
            )}

            <div className="flex gap-2">
              <button onClick={handleGuardar} disabled={guardando || !datos.cuotaNueva} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Confirmar y Guardar'}
              </button>
              <button onClick={() => { setDatos(null); setArchivo(null); }} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Historial de Pagos</h3>
        {cargandoListado ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : pagos.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay pagos de cuota registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Bombero</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha emision</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nro Factura</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Monto (Gs)</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Meses</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Cuota hasta</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Doc.</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50"></th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{p.nombreBombero || p.codigo}</td>
                    <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{p.fechaEmision}</td>
                    <td className="px-2 py-1.5 text-white/70">{p.nroFactura || '-'}</td>
                    <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{p.monto.toLocaleString('es-PY')}</td>
                    <td className="px-2 py-1.5 text-white/70">{p.meses}</td>
                    <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{formatearMesAnio(p.cuotaAnterior)} → {formatearMesAnio(p.cuotaNueva)}</td>
                    <td className="px-2 py-1.5">
                      {p.urlDocumento ? (
                        <a href={p.urlDocumento} target="_blank" rel="noopener noreferrer" className="text-cbvp-red-light hover:text-cbvp-red-light/80 inline-flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => handleEliminar(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors" title="Eliminar registro">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

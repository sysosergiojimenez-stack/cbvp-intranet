import { Fragment, useState } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { HandCoins, Upload, Brain, Save, Trash2, ExternalLink, Loader2, FileText } from 'lucide-react';

const ACCEPT_ARCHIVO = '.pdf,application/pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;

// Mismo reparto fijo que calcula el backend al guardar -- se recalcula aca
// solo para mostrar la vista previa en vivo mientras se editan los montos.
const PORCENTAJE_COMPANIA = { cobranza: 0.6, primerAporte: 0, reasociacion: 0.5, aporteUnico: 0.5 };
const PORCENTAJE_ADMINISTRACION = { cobranza: 0.4, primerAporte: 1, reasociacion: 0.5, aporteUnico: 0.5 };

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
  return Math.round(valor).toLocaleString('es-PY');
}

function formatearMes(mesAnio: string): string {
  if (!mesAnio) return '-';
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const [anio, mes] = mesAnio.split('-');
  const idx = parseInt(mes, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return mesAnio;
  return `${MESES[idx]} ${anio}`;
}

interface MontosBase {
  mes: string;
  totalDepositado: number;
  totalCobranzasMensuales: number;
  totalPrimerAporte: number;
  reasociacion: number;
  aporteUnico: number;
  directorAdministrativo: string;
  administradorCampana: string;
}

function calcularGanancias(montos: MontosBase) {
  const gananciaCompania = {
    cobranzasMensuales: montos.totalCobranzasMensuales * PORCENTAJE_COMPANIA.cobranza,
    primerAporte: montos.totalPrimerAporte * PORCENTAJE_COMPANIA.primerAporte,
    reasociacion: montos.reasociacion * PORCENTAJE_COMPANIA.reasociacion,
    aporteUnico: montos.aporteUnico * PORCENTAJE_COMPANIA.aporteUnico,
  };
  const gananciaAdministrativa = {
    cobranzasMensuales: montos.totalCobranzasMensuales * PORCENTAJE_ADMINISTRACION.cobranza,
    primerAporte: montos.totalPrimerAporte * PORCENTAJE_ADMINISTRACION.primerAporte,
    reasociacion: montos.reasociacion * PORCENTAJE_ADMINISTRACION.reasociacion,
    aporteUnico: montos.aporteUnico * PORCENTAJE_ADMINISTRACION.aporteUnico,
  };
  const netoCuartelGral = gananciaCompania.cobranzasMensuales + gananciaCompania.primerAporte + gananciaCompania.reasociacion + gananciaCompania.aporteUnico;
  const netoAdministrativo = gananciaAdministrativa.cobranzasMensuales + gananciaAdministrativa.primerAporte + gananciaAdministrativa.reasociacion + gananciaAdministrativa.aporteUnico;
  return { gananciaCompania, gananciaAdministrativa, netoCuartelGral, netoAdministrativo };
}

interface DatosExtraidos extends MontosBase {
  urlDocumento: string;
  uploadError?: string;
}

function VistaPreviaCalculo({ montos }: { montos: MontosBase }) {
  const { gananciaCompania, gananciaAdministrativa, netoCuartelGral, netoAdministrativo } = calcularGanancias(montos);
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="bg-white/5 border-b border-white/10">
            <th className="text-left px-2 py-2 font-medium text-white/50">Rubro</th>
            <th className="text-right px-2 py-2 font-medium text-white/50">Ganancia Compañía (60/50/-)</th>
            <th className="text-right px-2 py-2 font-medium text-white/50">Ganancia Administrativa (40/50/100)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-white/5">
            <td className="px-2 py-1.5 text-white/70">Cobranzas Mensuales</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaCompania.cobranzasMensuales)}</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaAdministrativa.cobranzasMensuales)}</td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="px-2 py-1.5 text-white/70">Primer Aporte</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaCompania.primerAporte)}</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaAdministrativa.primerAporte)}</td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="px-2 py-1.5 text-white/70">Reasociacion</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaCompania.reasociacion)}</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaAdministrativa.reasociacion)}</td>
          </tr>
          <tr>
            <td className="px-2 py-1.5 text-white/70">Aporte Unico</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaCompania.aporteUnico)}</td>
            <td className="px-2 py-1.5 text-right text-white/80">{formatearGs(gananciaAdministrativa.aporteUnico)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-white/5 font-semibold">
            <td className="px-2 py-2 text-white/70">Neto</td>
            <td className="px-2 py-2 text-right text-cbvp-red-light">{formatearGs(netoCuartelGral)} <span className="font-normal text-white/40">(Cuartel Gral.)</span></td>
            <td className="px-2 py-2 text-right text-cbvp-red-light">{formatearGs(netoAdministrativo)} <span className="font-normal text-white/40">(Administrativo)</span></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CamposMontos({ montos, onChange }: { montos: MontosBase; onChange: (m: MontosBase) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Mes</label>
        <input type="month" value={montos.mes} onChange={(e) => onChange({ ...montos, mes: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none [color-scheme:dark]" />
      </div>
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Total Depositado (Gs)</label>
        <input type="number" value={montos.totalDepositado} onChange={(e) => onChange({ ...montos, totalDepositado: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
      </div>
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Total Cobranzas Mensuales (Gs)</label>
        <input type="number" value={montos.totalCobranzasMensuales} onChange={(e) => onChange({ ...montos, totalCobranzasMensuales: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
      </div>
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Total Primer Aporte (Gs)</label>
        <input type="number" value={montos.totalPrimerAporte} onChange={(e) => onChange({ ...montos, totalPrimerAporte: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
      </div>
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Reasociacion (Gs)</label>
        <input type="number" value={montos.reasociacion} onChange={(e) => onChange({ ...montos, reasociacion: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
      </div>
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Aporte Unico (Gs)</label>
        <input type="number" value={montos.aporteUnico} onChange={(e) => onChange({ ...montos, aporteUnico: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
      </div>
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Director/a Administrativo</label>
        <input type="text" value={montos.directorAdministrativo} onChange={(e) => onChange({ ...montos, directorAdministrativo: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
      </div>
      <div>
        <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Administrador de Campaña</label>
        <input type="text" value={montos.administradorCampana} onChange={(e) => onChange({ ...montos, administradorCampana: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
      </div>
    </div>
  );
}

export default function CampanaSocios() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();

  const { data: listadoData, isLoading: cargandoListado } = trpc.campanaSocios.listado.useQuery();
  const reportes = listadoData?.exito ? listadoData.reportes : [];

  const extraerMutation = trpc.campanaSocios.extraer.useMutation();
  const guardarMutation = trpc.campanaSocios.guardar.useMutation();
  const editarMutation = trpc.campanaSocios.editar.useMutation();
  const eliminarMutation = trpc.campanaSocios.eliminar.useMutation();

  const [archivo, setArchivo] = useState<File | null>(null);
  const [datos, setDatos] = useState<DatosExtraidos | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MontosBase | null>(null);
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
        mes: res.mes,
        totalDepositado: res.totalDepositado,
        totalCobranzasMensuales: res.totalCobranzasMensuales,
        totalPrimerAporte: res.totalPrimerAporte,
        reasociacion: res.reasociacion,
        aporteUnico: res.aporteUnico,
        directorAdministrativo: res.directorAdministrativo,
        administradorCampana: res.administradorCampana,
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
    if (!datos.mes) { setError('Completa el mes del reporte.'); return; }
    setGuardando(true); setError('');
    try {
      await guardarMutation.mutateAsync({
        mes: datos.mes,
        totalDepositado: datos.totalDepositado,
        totalCobranzasMensuales: datos.totalCobranzasMensuales,
        totalPrimerAporte: datos.totalPrimerAporte,
        reasociacion: datos.reasociacion,
        aporteUnico: datos.aporteUnico,
        directorAdministrativo: datos.directorAdministrativo,
        administradorCampana: datos.administradorCampana,
        urlDocumento: datos.urlDocumento,
        cargadoPor: usuario?.codigo || '',
      });
      setArchivo(null); setDatos(null);
      utils.campanaSocios.listado.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar este reporte de Campaña de Socios?')) return;
    await eliminarMutation.mutateAsync({ id });
    if (editandoId === id) setEditandoId(null);
    utils.campanaSocios.listado.invalidate();
  };

  const iniciarEdicion = (r: (typeof reportes)[number]) => {
    setEditError('');
    setEditandoId(r.id);
    setEditForm({
      mes: r.mes,
      totalDepositado: r.totalDepositado,
      totalCobranzasMensuales: r.totalCobranzasMensuales,
      totalPrimerAporte: r.totalPrimerAporte,
      reasociacion: r.reasociacion,
      aporteUnico: r.aporteUnico,
      directorAdministrativo: r.directorAdministrativo,
      administradorCampana: r.administradorCampana,
    });
  };

  const guardarEdicion = async () => {
    if (editandoId === null || !editForm) return;
    setEditError('');
    if (!editForm.mes) { setEditError('Completa el mes del reporte.'); return; }
    setEditGuardando(true);
    try {
      await editarMutation.mutateAsync({ id: editandoId, ...editForm });
      setEditandoId(null);
      utils.campanaSocios.listado.invalidate();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setEditGuardando(false);
    }
  };

  const totalNetoCuartelGral = reportes.reduce((acc, r) => acc + r.netoCuartelGral, 0);
  const totalNetoAdministrativo = reportes.reduce((acc, r) => acc + r.netoAdministrativo, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-cbvp-red" /> Campaña de Socios
        </h2>

        <div className="mb-4">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Resumen de movimiento (foto o PDF)</label>
          <input type="file" accept={ACCEPT_ARCHIVO} onChange={handleArchivoChange} className="hidden" id="campana-socios-archivo" />
          <label htmlFor="campana-socios-archivo" className="w-full max-w-md flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 cursor-pointer transition-colors">
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
            <CamposMontos montos={datos} onChange={(m) => setDatos({ ...datos, ...m })} />

            <VistaPreviaCalculo montos={datos} />

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
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Historial de Reportes</h3>
        {cargandoListado ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : reportes.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay reportes de Campaña de Socios registrados todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Mes</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Total Depositado</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Neto Cuartel Gral.</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Neto Administrativo</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Doc.</th>
                </tr>
              </thead>
              <tbody>
                {reportes.map((r) => {
                  const editandoEstaFila = editandoId === r.id && editForm;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => (editandoId === r.id ? setEditandoId(null) : iniciarEdicion(r))}
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                      >
                        <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{formatearMes(r.mes)}</td>
                        <td className="px-2 py-1.5 text-white/70 text-right whitespace-nowrap">{formatearGs(r.totalDepositado)}</td>
                        <td className="px-2 py-1.5 text-white/70 text-right whitespace-nowrap">{formatearGs(r.netoCuartelGral)}</td>
                        <td className="px-2 py-1.5 text-white/70 text-right whitespace-nowrap">{formatearGs(r.netoAdministrativo)}</td>
                        <td className="px-2 py-1.5">
                          {r.urlDocumento ? (
                            <a href={r.urlDocumento} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-cbvp-red-light hover:text-cbvp-red-light/80 inline-flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                      {editandoEstaFila && editForm && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={5} className="px-3 pb-4 pt-3 space-y-3">
                            <CamposMontos montos={editForm} onChange={(m) => setEditForm(m)} />

                            <VistaPreviaCalculo montos={editForm} />

                            {editError && <p className="text-sm text-red-400">{editError}</p>}

                            <div className="flex gap-2">
                              <button onClick={guardarEdicion} disabled={editGuardando} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                <Save className="w-4 h-4" /> {editGuardando ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
                              <button onClick={() => handleEliminar(r.id)} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
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
                  <td colSpan={2} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                  <td className="px-2 py-2 text-right text-white">{formatearGs(totalNetoCuartelGral)}</td>
                  <td className="px-2 py-2 text-right text-white">{formatearGs(totalNetoAdministrativo)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

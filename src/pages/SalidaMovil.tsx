import { useState, Fragment } from 'react';
import { trpc } from '@/providers/trpc';
import { compressImage } from '@/lib/imageCompress';
import { Truck, Upload, X, FileText, Clock, Zap, AlertTriangle, CheckCircle, ExternalLink, Edit3, RotateCcw, Save, Trash2, Plus, Camera, Image as ImageIcon } from 'lucide-react';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface RegistroMovil {
  movil: string;
  conductor: string;
  oficialACargo: string;
  nroTripulantes: string;
  tipoServicio: string;
  fechaSalida: string;
  horaSalida: string;
  kilometrajeSalida: string;
  direccion: string;
  fechaLlegada: string;
  horaLlegada: string;
  kilometrajeLlegada: string;
}

const registroVacio: RegistroMovil = {
  movil: '', conductor: '', oficialACargo: '', nroTripulantes: '', tipoServicio: '',
  fechaSalida: '', horaSalida: '', kilometrajeSalida: '', direccion: '',
  fechaLlegada: '', horaLlegada: '', kilometrajeLlegada: '',
};

const MAX_SIZE = 15 * 1024 * 1024;

export default function SalidaMovil() {
  const utils = trpc.useUtils();
  const extraerMutation = trpc.salidaMovil.extraer.useMutation();
  const guardarMutation = trpc.salidaMovil.guardar.useMutation();
  const { data: listadoData, isLoading: listadoLoading } = trpc.salidaMovil.listado.useQuery();
  const editarMutation = trpc.salidaMovil.editar.useMutation();
  const eliminarMutation = trpc.salidaMovil.eliminar.useMutation();
  const [editandoRowIndex, setEditandoRowIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RegistroMovil>({ ...registroVacio });

  const iniciarEdicion = (r: NonNullable<typeof listadoData>['registros'][number]) => {
    setEditandoRowIndex(r.rowIndex);
    setEditForm({
      movil: r.movil, conductor: r.conductor, oficialACargo: r.oficialACargo,
      nroTripulantes: r.nroTripulantes, tipoServicio: r.tipoServicio,
      fechaSalida: r.fechaSalida, horaSalida: r.horaSalida, kilometrajeSalida: r.kilometrajeSalida,
      direccion: r.direccion, fechaLlegada: r.fechaLlegada, horaLlegada: r.horaLlegada,
      kilometrajeLlegada: r.kilometrajeLlegada,
    });
  };

  const guardarEdicion = async () => {
    if (editandoRowIndex === null) return;
    try {
      const resp = await editarMutation.mutateAsync({ rowIndex: editandoRowIndex, ...editForm });
      if (!resp.exito) throw new Error('Error al guardar');
      setEditandoRowIndex(null);
      utils.salidaMovil.listado.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const eliminarFila = async (rowIndex: number) => {
    if (!confirm('Eliminar este registro?')) return;
    try {
      const resp = await eliminarMutation.mutateAsync({ rowIndex });
      if (!resp.exito) throw new Error('Error al eliminar');
      utils.salidaMovil.listado.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const [files, setFiles] = useState<Array<{ file: File; preview: string | null }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ idPlanilla: string; totalRegistros: number; imageUrls: string[] } | null>(null);
  const [extraccion, setExtraccion] = useState<{ imageUrls: string[]; uploadError?: string; registros: RegistroMovil[] } | null>(null);

  const handleFiles = async (fileList: FileList | File[]) => {
    setError(''); setResult(null);
    const originales = Array.from(fileList);
    const nuevos = await Promise.all(originales.map(f => compressImage(f)));
    const muyGrande = nuevos.find(f => f.size > MAX_SIZE);
    if (muyGrande) {
      setError(`Maximo ${MAX_SIZE / 1024 / 1024}MB permitido (archivo: ${muyGrande.name}).`);
      return;
    }
    nuevos.forEach(f => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => setFiles(prev => [...prev, { file: f, preview: e.target?.result as string }]);
        reader.readAsDataURL(f);
      } else {
        setFiles(prev => [...prev, { file: f, preview: null }]);
      }
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const procesarPlanilla = async () => {
    if (files.length === 0) return;
    setIsProcessing(true); setError(''); setExtraccion(null);
    try {
      const imagesData = await Promise.all(files.map(async ({ file }) => {
        const buffer = await file.arrayBuffer();
        return { base64: arrayBufferToBase64(buffer), mimeType: file.type || 'image/jpeg' };
      }));

      const resp = await extraerMutation.mutateAsync({ images: imagesData });

      if (resp.exito) {
        const registros = (resp.registros as RegistroMovil[]) || [];
        setExtraccion({
          imageUrls: resp.imageUrls || [],
          uploadError: resp.uploadError,
          registros: registros.length > 0 ? registros : [{ ...registroVacio }],
        });
      } else {
        setError('Error al procesar la planilla');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  const actualizarRegistro = (idx: number, campo: keyof RegistroMovil, valor: string) => {
    if (!extraccion) return;
    const nuevos = [...extraccion.registros];
    nuevos[idx] = { ...nuevos[idx], [campo]: valor };
    setExtraccion({ ...extraccion, registros: nuevos });
  };

  const eliminarRegistro = (idx: number) => {
    if (!extraccion) return;
    setExtraccion({ ...extraccion, registros: extraccion.registros.filter((_, i) => i !== idx) });
  };

  const agregarRegistro = () => {
    if (!extraccion) return;
    setExtraccion({ ...extraccion, registros: [...extraccion.registros, { ...registroVacio }] });
  };

  const confirmarGuardar = async () => {
    if (!extraccion) return;
    if (extraccion.registros.length === 0) {
      setError('Agrega al menos un registro antes de guardar.');
      return;
    }
    setIsProcessing(true); setError('');
    try {
      const resp = await guardarMutation.mutateAsync({
        imageUrls: extraccion.imageUrls,
        registros: extraccion.registros,
      });
      if (resp.exito) {
        setResult({ idPlanilla: resp.idPlanilla, totalRegistros: resp.totalRegistros, imageUrls: extraccion.imageUrls });
        setExtraccion(null);
        setFiles([]);
        utils.salidaMovil.listado.invalidate();
      } else {
        setError('Error al guardar');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? 'border-cbvp-red bg-cbvp-red/5' : 'border-white/10'}`}
        >
          <Upload className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm mb-3">Subi una o varias imagenes de la planilla</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button type="button" onClick={() => document.getElementById('file-input-salida-movil-camara')?.click()} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red rounded-lg text-sm flex items-center gap-2 transition-colors">
              <Camera className="w-4 h-4" /> Tomar Foto
            </button>
            <button type="button" onClick={() => document.getElementById('file-input-salida-movil-galeria')?.click()} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <ImageIcon className="w-4 h-4" /> Galeria
            </button>
          </div>
          <input
            id="file-input-salida-movil-camara"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            id="file-input-salida-movil-galeria"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((f, idx) => (
              <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-3">
                {f.preview ? (
                  <img src={f.preview} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-white/10 shrink-0" />
                ) : (
                  <FileText className="w-8 h-8 text-cbvp-red shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{f.file.name}</p>
                  <p className="text-white/30 text-xs">({(f.file.size / 1024 / 1024).toFixed(2)} MB)</p>
                </div>
                <button onClick={() => removeFile(idx)} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={procesarPlanilla}
              disabled={isProcessing}
              className="w-full py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isProcessing ? (
                <><Clock className="w-4 h-4 animate-spin" /> Procesando con IA...</>
              ) : (
                <><Zap className="w-4 h-4" /> Procesar Planilla ({files.length} imagen{files.length > 1 ? 'es' : ''})</>
              )}
            </button>
          </div>
        )}

        {extraccion && (
          <div className="mt-3 bg-white/[0.03] border border-cbvp-yellow/20 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cbvp-yellow flex items-center gap-2"><Edit3 className="w-4 h-4" /> Revisa los registros antes de guardar</h3>
              {extraccion.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {extraccion.imageUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-cbvp-blue hover:underline flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> Imagen {extraccion.imageUrls.length > 1 ? idx + 1 : ''}</a>
                  ))}
                </div>
              )}
            </div>
            {extraccion.uploadError && (
              <div className="p-2 bg-cbvp-yellow/10 border border-cbvp-yellow/20 rounded text-xs text-cbvp-yellow">
                <span className="font-semibold">Advertencia:</span> No se pudo subir el archivo. Error: {extraccion.uploadError}
              </div>
            )}

            <div className="space-y-3">
              {extraccion.registros.map((r, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/40 uppercase">Registro {idx + 1}</span>
                    <button onClick={() => eliminarRegistro(idx)} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><label className="text-xs text-white/40 mb-1 block">Movil</label><input type="text" value={r.movil} onChange={e => actualizarRegistro(idx, 'movil', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Conductor</label><input type="text" value={r.conductor} onChange={e => actualizarRegistro(idx, 'conductor', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Oficial a Cargo</label><input type="text" value={r.oficialACargo} onChange={e => actualizarRegistro(idx, 'oficialACargo', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Nro Tripulantes</label><input type="text" value={r.nroTripulantes} onChange={e => actualizarRegistro(idx, 'nroTripulantes', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                  </div>
                  <div><label className="text-xs text-white/40 mb-1 block">Tipo de Servicio</label><input type="text" value={r.tipoServicio} onChange={e => actualizarRegistro(idx, 'tipoServicio', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>

                  <div className="border-t border-white/5 pt-3">
                    <p className="text-xs font-semibold text-white/30 uppercase mb-2">Datos de Salida</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><label className="text-xs text-white/40 mb-1 block">Fecha</label><input type="text" value={r.fechaSalida} onChange={e => actualizarRegistro(idx, 'fechaSalida', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                      <div><label className="text-xs text-white/40 mb-1 block">Hora</label><input type="text" value={r.horaSalida} onChange={e => actualizarRegistro(idx, 'horaSalida', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                      <div><label className="text-xs text-white/40 mb-1 block">Kilometraje</label><input type="text" value={r.kilometrajeSalida} onChange={e => actualizarRegistro(idx, 'kilometrajeSalida', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                      <div><label className="text-xs text-white/40 mb-1 block">Direccion</label><input type="text" value={r.direccion} onChange={e => actualizarRegistro(idx, 'direccion', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <p className="text-xs font-semibold text-white/30 uppercase mb-2">Datos de Llegada</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><label className="text-xs text-white/40 mb-1 block">Fecha</label><input type="text" value={r.fechaLlegada} onChange={e => actualizarRegistro(idx, 'fechaLlegada', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                      <div><label className="text-xs text-white/40 mb-1 block">Hora</label><input type="text" value={r.horaLlegada} onChange={e => actualizarRegistro(idx, 'horaLlegada', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                      <div><label className="text-xs text-white/40 mb-1 block">Kilometraje</label><input type="text" value={r.kilometrajeLlegada} onChange={e => actualizarRegistro(idx, 'kilometrajeLlegada', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={agregarRegistro} type="button" className="w-full py-2 border border-dashed border-white/20 hover:border-white/40 rounded-lg text-sm text-white/50 hover:text-white/80 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Agregar otro registro
            </button>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setExtraccion(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Cancelar</button>
              <button onClick={confirmarGuardar} disabled={isProcessing} className="flex-1 py-2.5 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                {isProcessing ? <><Clock className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Confirmar y Guardar</>}
              </button>
            </div>
          </div>
        )}

        {error && <div className="mt-3 p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}

        {result && (
          <div className="mt-3 p-4 bg-cbvp-green/10 border border-cbvp-green/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-cbvp-green" />
              <span className="text-cbvp-green font-semibold text-sm">Registros guardados correctamente</span>
            </div>
            <div className="text-xs text-white/60">
              <span className="text-white/30">ID:</span> {result.idPlanilla} - <span className="text-white/30">Registros:</span> {result.totalRegistros}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Registro de Salidas (mas reciente primero)</h3>
        </div>
        {listadoLoading ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : !listadoData?.registros || listadoData.registros.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay registros todavia</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm block sm:table">
              <thead className="hidden sm:table-header-group">
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-3 py-2 font-medium text-white/50 whitespace-nowrap">Fecha y Hora Salida</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Movil</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Tipo Servicio</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Direccion</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Conductor</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">A Cargo</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50 whitespace-nowrap">Km Llegada</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Acciones</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group">
                {listadoData.registros.map(r => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors block sm:table-row mb-2 sm:mb-0 bg-white/[0.02] sm:bg-transparent rounded-lg sm:rounded-none p-2 sm:p-0">
                      <td className="px-3 py-2 text-white/70 whitespace-nowrap block sm:table-cell font-medium text-white">{r.fechaSalida} {r.horaSalida}</td>
                      <td className="px-3 py-2 text-white block sm:table-cell"><span className="text-white/30 sm:hidden">Movil: </span>{r.movil || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Servicio: </span>{r.tipoServicio || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Direccion: </span>{r.direccion || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Conductor: </span>{r.conductor || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">A cargo: </span>{r.oficialACargo || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Km llegada: </span>{r.kilometrajeLlegada || '-'}</td>
                      <td className="px-3 py-2 block sm:table-cell">
                        <div className="flex items-center gap-2 pt-1.5 sm:pt-0 mt-1 sm:mt-0 border-t border-white/5 sm:border-0">
                          <button onClick={() => iniciarEdicion(r)} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => eliminarFila(r.rowIndex)} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          {r.imageUrls.length > 0 && (
                            <a href={r.imageUrls[0]} target="_blank" rel="noopener noreferrer" className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-cbvp-blue transition-colors" title="Ver imagen"><ExternalLink className="w-3.5 h-3.5" /></a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editandoRowIndex === r.rowIndex && (
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <td colSpan={8} className="px-3 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div><label className="text-xs text-white/40 mb-1 block">Movil</label><input type="text" value={editForm.movil} onChange={e => setEditForm({ ...editForm, movil: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Conductor</label><input type="text" value={editForm.conductor} onChange={e => setEditForm({ ...editForm, conductor: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">A Cargo</label><input type="text" value={editForm.oficialACargo} onChange={e => setEditForm({ ...editForm, oficialACargo: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Tripulantes</label><input type="text" value={editForm.nroTripulantes} onChange={e => setEditForm({ ...editForm, nroTripulantes: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div className="col-span-2 md:col-span-4"><label className="text-xs text-white/40 mb-1 block">Tipo Servicio</label><input type="text" value={editForm.tipoServicio} onChange={e => setEditForm({ ...editForm, tipoServicio: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Fecha Salida</label><input type="text" value={editForm.fechaSalida} onChange={e => setEditForm({ ...editForm, fechaSalida: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Hora Salida</label><input type="text" value={editForm.horaSalida} onChange={e => setEditForm({ ...editForm, horaSalida: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Km Salida</label><input type="text" value={editForm.kilometrajeSalida} onChange={e => setEditForm({ ...editForm, kilometrajeSalida: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Direccion</label><input type="text" value={editForm.direccion} onChange={e => setEditForm({ ...editForm, direccion: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Fecha Llegada</label><input type="text" value={editForm.fechaLlegada} onChange={e => setEditForm({ ...editForm, fechaLlegada: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Hora Llegada</label><input type="text" value={editForm.horaLlegada} onChange={e => setEditForm({ ...editForm, horaLlegada: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                            <div><label className="text-xs text-white/40 mb-1 block">Km Llegada</label><input type="text" value={editForm.kilometrajeLlegada} onChange={e => setEditForm({ ...editForm, kilometrajeLlegada: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={guardarEdicion} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
                            <button onClick={() => setEditandoRowIndex(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DetalleSalidaMovil({ idPlanilla }: { idPlanilla: string }) {
  const { data, isLoading } = trpc.salidaMovil.detalle.useQuery({ idPlanilla });

  if (isLoading) return <div className="px-4 pb-3 text-xs text-white/40">Cargando detalle...</div>;
  if (!data?.registros || data.registros.length === 0) return <div className="px-4 pb-3 text-xs text-white/40">Sin registros</div>;

  return (
    <div className="px-4 pb-3 space-y-2">
      {data.registros.map(r => (
        <div key={r.id} className="bg-white/[0.03] rounded-lg p-3 text-xs text-white/60 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div><span className="text-white/30">Movil:</span> {r.movil || '-'}</div>
          <div><span className="text-white/30">Conductor:</span> {r.conductor || '-'}</div>
          <div><span className="text-white/30">Servicio:</span> {r.tipoServicio || '-'}</div>
          <div><span className="text-white/30">Salida:</span> {r.fechaSalida} {r.horaSalida}</div>
          <div><span className="text-white/30">Km Salida:</span> {r.kilometrajeSalida || '-'}</div>
          <div><span className="text-white/30">Direccion:</span> {r.direccion || '-'}</div>
          <div><span className="text-white/30">Llegada:</span> {r.fechaLlegada} {r.horaLlegada}</div>
          <div><span className="text-white/30">Km Llegada:</span> {r.kilometrajeLlegada || '-'}</div>
        </div>
      ))}
    </div>
  );
}

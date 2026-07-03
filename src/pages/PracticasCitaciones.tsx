import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermiso } from '@/hooks/usePermiso';
import { trpc } from '@/providers/trpc';
import type { AsistenciaEncabezado, AsistenciaPersonal } from '@/types';
import {
  Upload, FileText, CheckCircle, AlertTriangle, X,
  Clock, Calendar, Users, MapPin, UserCheck,
  ChevronDown, ChevronUp, Eye, BookOpen, Zap,
  Edit3, Trash2, ExternalLink, Save, RotateCcw
} from 'lucide-react';

export default function PracticasCitaciones() {
  const { puedeCargarPlanillas } = usePermiso();
  const { usuario } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    idPlanilla: string;
    tipoActividad: string;
    fechaActividad: string;
    totalPersonnel: number;
    presentes: number;
    imageUrl?: string;
    uploadError?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedPlanilla, setSelectedPlanilla] = useState<string | null>(null);

  // Edit modal state
  const [editingPlanilla, setEditingPlanilla] = useState<AsistenciaEncabezado | null>(null);
  const [editForm, setEditForm] = useState({
    fechaActividad: '',
    tipoActividad: '',
    inicioActividad: '',
    finalizaActividad: '',
    acargoActividad: '',
    detalles: '',
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const procesarMutation = trpc.asistencia.procesar.useMutation();
  const { data: historialData, isLoading: historialLoading } = trpc.asistencia.historial.useQuery(
    { page: 1, limit: 50 },
    { enabled: showHistory }
  );
  const { data: detalleData } = trpc.asistencia.detalle.useQuery(
    { idPlanilla: selectedPlanilla || '' },
    { enabled: !!selectedPlanilla }
  );

  const eliminarMutation = trpc.asistencia.eliminar.useMutation({
    onSuccess: () => {
      utils.asistencia.historial.invalidate();
      setDeletingId(null);
      setSelectedPlanilla(null);
    },
  });

  const editarMutation = trpc.asistencia.editar.useMutation({
    onSuccess: () => {
      utils.asistencia.historial.invalidate();
      setEditingPlanilla(null);
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleFile = (selectedFile: File) => {
    setError('');
    setResult(null);
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Maximo 10MB permitido.');
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const procesarPlanilla = async () => {
    if (!file || !usuario) return;
    setIsProcessing(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Full = e.target?.result as string;
      const base64Data = base64Full.split(',')[1] || base64Full;

      try {
        const resp = await procesarMutation.mutateAsync({
          imageBase64: base64Data,
          mimeType: file.type || 'image/jpeg',
          usuarioId: usuario.codigo,
          usuarioNombre: usuario.nombreCompleto,
        });

        if (resp.exito) {
          setResult({
            idPlanilla: resp.idPlanilla,
            tipoActividad: resp.tipoActividad,
            fechaActividad: resp.fechaActividad,
            totalPersonnel: resp.totalPersonnel,
            presentes: resp.presentes,
            imageUrl: resp.imageUrl,
            uploadError: resp.uploadError,
          });
          setFile(null);
          setFilePreview(null);
          utils.asistencia.historial.invalidate();
        } else {
          setError(resp.error || 'Error al procesar');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const openEdit = (p: AsistenciaEncabezado) => {
    setEditingPlanilla(p);
    setEditForm({
      fechaActividad: p.fechaActividad,
      tipoActividad: p.tipoActividad,
      inicioActividad: p.inicioActividad,
      finalizaActividad: p.finalizaActividad,
      acargoActividad: p.acargoActividad,
      detalles: p.detalles,
    });
  };

  const saveEdit = async () => {
    if (!editingPlanilla) return;
    await editarMutation.mutateAsync({
      idPlanilla: editingPlanilla.idPlanilla,
      ...editForm,
    });
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await eliminarMutation.mutateAsync({ idPlanilla: deletingId });
  };

  const getTipoBadge = (tipo: string) => {
    const upper = tipo.toUpperCase();
    if (upper.includes('PRACTICA')) return 'bg-cbvp-green/20 text-cbvp-green';
    if (upper.includes('CITACION')) return 'bg-cbvp-orange/20 text-cbvp-orange';
    if (upper.includes('REUNION')) return 'bg-cbvp-blue/20 text-cbvp-blue';
    return 'bg-cbvp-purple/20 text-cbvp-purple';
  };

  const getAsistenciaBadge = (asistencia: string) => {
    switch (asistencia) {
      case 'PRESENTE': return 'bg-cbvp-green/20 text-cbvp-green';
      case 'COMISIONADO': return 'bg-cbvp-blue/20 text-cbvp-blue';
      default: return 'bg-cbvp-red/20 text-cbvp-red-light';
    }
  };

  if (!puedeCargarPlanillas) {
    return (
      <div className="animate-fade-in">
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-cbvp-orange mx-auto mb-4" />
          <p className="text-white/60">No tienes permisos para acceder a este modulo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Upload Area */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-cbvp-red" /> Cargar Planilla de Asistencia
        </h2>

        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-cbvp-red bg-cbvp-red/5' : 'border-white/10 hover:border-white/20'
            }`}
            onClick={() => document.getElementById('file-input-asistencia')?.click()}
          >
            <Upload className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-1">Arrastra una imagen o PDF aqui</p>
            <p className="text-white/20 text-xs">O haz clic para seleccionar</p>
            <input
              id="file-input-asistencia"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-cbvp-red" />
                <span className="text-white text-sm">{file.name}</span>
                <span className="text-white/30 text-xs">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <button onClick={() => { setFile(null); setFilePreview(null); setResult(null); setError(''); }} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {filePreview && (
              <img src={filePreview} alt="Preview" className="max-h-48 rounded-lg mb-3 border border-white/10" />
            )}
            <button
              onClick={procesarPlanilla}
              disabled={isProcessing}
              className="w-full py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isProcessing ? (
                <><Clock className="w-4 h-4 animate-spin" /> Procesando con IA...</>
              ) : (
                <><Zap className="w-4 h-4" /> Procesar Planilla</>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="mt-3 p-4 bg-cbvp-green/10 border border-cbvp-green/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-cbvp-green" />
              <span className="text-cbvp-green font-semibold text-sm">Planilla procesada correctamente</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
              <div><span className="text-white/30">ID:</span> {result.idPlanilla}</div>
              <div><span className="text-white/30">Tipo:</span> <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getTipoBadge(result.tipoActividad)}`}>{result.tipoActividad}</span></div>
              <div><span className="text-white/30">Fecha:</span> {result.fechaActividad}</div>
              <div><span className="text-white/30">Presentes:</span> {result.presentes}/{result.totalPersonnel}</div>
            </div>
            {result.uploadError && (
              <div className="mt-2 p-2 bg-cbvp-yellow/10 border border-cbvp-yellow/20 rounded text-xs text-cbvp-yellow">
                <span className="font-semibold">Advertencia:</span> La planilla se guardo pero el archivo no se pudo subir. Error: {result.uploadError}
              </div>
            )}
            {result.imageUrl && (
              <div className="mt-2">
                <a href={result.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cbvp-blue hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver archivo subido
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 mb-4 w-full">
          {showHistory ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cbvp-blue" /> Historial de Asistencias
          </h2>
          {historialData?.total !== undefined && (
            <span className="text-xs text-white/30 ml-auto">{historialData.total} registros</span>
          )}
        </button>

        {showHistory && (
          <>
            {historialLoading && (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-cbvp-red/30 border-t-cbvp-red rounded-full animate-spin" />
                <span className="ml-2 text-sm text-white/40">Cargando...</span>
              </div>
            )}

            {historialData?.planillas && historialData.planillas.length > 0 ? (
              <div className="space-y-3">
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase">
                        <th className="px-3 py-2 text-left rounded-tl-lg">Fecha</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">A Cargo</th>
                        <th className="px-3 py-2 text-center rounded-tr-lg">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {historialData.planillas.map((p: AsistenciaEncabezado) => (
                        <tr key={p.idPlanilla} className="hover:bg-cbvp-red/5 transition-colors group">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-white/30" />
                              <span className="text-white/80 text-xs">{p.fechaActividad}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTipoBadge(p.tipoActividad)}`}>
                              {p.tipoActividad}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-white/60 text-xs">{p.acargoActividad || '-'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              {p.urlImagen && (
                                <a
                                  href={p.urlImagen}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-green/20 text-white/40 hover:text-cbvp-green transition-colors"
                                  title="Ver archivo"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => openEdit(p)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-yellow/20 text-white/40 hover:text-cbvp-yellow transition-colors"
                                title="Editar"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSelectedPlanilla(selectedPlanilla === p.idPlanilla ? null : p.idPlanilla)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-blue/20 text-white/40 hover:text-cbvp-blue transition-colors"
                                title="Ver detalle"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(p.idPlanilla)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Detail Panel */}
                {selectedPlanilla && detalleData?.personal && (
                  <div className="mt-3 bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-cbvp-red" /> Personal
                      </h3>
                      <button onClick={() => setSelectedPlanilla(null)} className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {detalleData.personal.map((person: AsistenciaPersonal, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-white/30" />
                            <div>
                              <p className="text-xs text-white">{person.nombre}</p>
                              {person.codigo && <p className="text-[10px] text-white/30">{person.codigo}</p>}
                            </div>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getAsistenciaBadge(person.asistencia)}`}>
                            {person.asistencia}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-white/30 text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No hay planillas de asistencia registradas.
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingPlanilla && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cbvp-yellow" /> Editar Planilla
              </h3>
              <button onClick={() => setEditingPlanilla(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Fecha de Actividad</label>
                <input
                  type="text"
                  value={editForm.fechaActividad}
                  onChange={e => setEditForm({ ...editForm, fechaActividad: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Tipo de Actividad</label>
                <input
                  type="text"
                  value={editForm.tipoActividad}
                  onChange={e => setEditForm({ ...editForm, tipoActividad: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Hora Inicio</label>
                  <input
                    type="text"
                    value={editForm.inicioActividad}
                    onChange={e => setEditForm({ ...editForm, inicioActividad: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Hora Finaliza</label>
                  <input
                    type="text"
                    value={editForm.finalizaActividad}
                    onChange={e => setEditForm({ ...editForm, finalizaActividad: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">A Cargo</label>
                <input
                  type="text"
                  value={editForm.acargoActividad}
                  onChange={e => setEditForm({ ...editForm, acargoActividad: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Detalles</label>
                <textarea
                  value={editForm.detalles}
                  onChange={e => setEditForm({ ...editForm, detalles: e.target.value })}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setEditingPlanilla(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={editarMutation.isPending}
                className="flex-1 py-2.5 bg-cbvp-yellow hover:bg-cbvp-yellow/80 disabled:opacity-50 text-black font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                {editarMutation.isPending ? (
                  <><Clock className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-4 h-4" /> Guardar Cambios</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] border border-white/10 rounded-xl w-full max-w-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-cbvp-red/10 rounded-full">
                <Trash2 className="w-5 h-5 text-cbvp-red" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Eliminar Planilla</h3>
                <p className="text-white/40 text-xs">Esta accion no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={eliminarMutation.isPending}
                className="flex-1 py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                {eliminarMutation.isPending ? (
                  <><Clock className="w-4 h-4 animate-spin" /> Eliminando...</>
                ) : (
                  <><Trash2 className="w-4 h-4" /> Eliminar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

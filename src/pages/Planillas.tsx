import { useState, useCallback } from 'react';
import { usePermiso } from '@/hooks/usePermiso';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import type { GuardiaPersonal, PlanillaEncabezado } from '@/types';
import {
  Upload, FileText, Zap, CheckCircle, AlertTriangle,
  X, Clock, Calendar, User, Users, Radio, Shield,
  ChevronDown, ChevronUp, Eye, BookOpen,
  Edit3, Trash2, ExternalLink, Save, RotateCcw
} from 'lucide-react';

export default function Planillas() {
  const { puedeCargarPlanillas, esVoluntario } = usePermiso();
  const { usuario } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    idPlanilla: string;
    fechaGuardia: string;
    grupo: string;
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
  const [editingPlanilla, setEditingPlanilla] = useState<PlanillaEncabezado | null>(null);
  const [editForm, setEditForm] = useState({
    fechaGuardia: '',
    grupo: '',
    inicioGuardia: '',
    finalizaGuardia: '',
    directorSem: '',
    comandanteSemana: '',
    oficialK20: '',
    novedades: '',
  });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const procesarMutation = trpc.planillas.procesar.useMutation();
  const { data: historialData, isLoading: historialLoading } = trpc.planillas.historial.useQuery(
    {},
    { enabled: showHistory }
  );
  const { data: detalleData } = trpc.planillas.detalle.useQuery(
    { idPlanilla: selectedPlanilla || '' },
    { enabled: !!selectedPlanilla }
  );

  const eliminarMutation = trpc.planillas.eliminar.useMutation({
    onSuccess: () => {
      utils.planillas.historial.invalidate();
      setDeletingId(null);
      setSelectedPlanilla(null);
    },
  });

  const editarMutation = trpc.planillas.editar.useMutation({
    onSuccess: () => {
      utils.planillas.historial.invalidate();
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

  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const MAX_SIZE = isMobile ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

  const handleFile = (selectedFile: File) => {
    setError('');
    setResult(null);
    if (selectedFile.size > MAX_SIZE) {
      setError(`Maximo ${MAX_SIZE / 1024 / 1024}MB permitido${isMobile ? ' en movil' : ''}.`);
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

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const len = bytes.length;
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  };

  const procesarPlanilla = async () => {
    if (!file || !usuario) return;
    setIsProcessing(true);
    setError('');

    try {
      const buffer = await file.arrayBuffer();
      const base64Data = arrayBufferToBase64(buffer);

      const resp = await procesarMutation.mutateAsync({
        base64Data,
        fileName: file.name,
        fileType: file.type,
        user: { identificador: usuario.identificador, nombreCompleto: usuario.nombreCompleto },
      });

      if (resp.exito && resp.datos) {
        const datos = resp.datos as {
          fechaGuardia: string;
          grupo: string;
          personal: Array<{ asistencia?: string }>;
          inicioGuardia?: string;
        };
        const personal = datos.personal || [];
        setResult({
          idPlanilla: resp.idPlanilla || 'unknown',
          fechaGuardia: datos.fechaGuardia || '',
          grupo: datos.grupo || '',
          totalPersonnel: personal.length,
          presentes: personal.filter((p: { asistencia?: string }) => p.asistencia === 'PRESENTE').length,
        });
        setFile(null);
        setFilePreview(null);
        utils.planillas.historial.invalidate();
      } else {
        setError(resp.mensaje || 'Error al procesar la planilla');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de conexion con el servidor');
    } finally {
      setIsProcessing(false);
    }
  };

  const openEdit = (p: PlanillaEncabezado) => {
    setEditingPlanilla(p);
    setEditForm({
      fechaGuardia: p.fechaGuardia,
      grupo: p.grupo,
      inicioGuardia: p.inicioGuardia,
      finalizaGuardia: p.finalizaGuardia,
      directorSem: p.directorSem,
      comandanteSemana: p.comandanteSemana,
      oficialK20: p.oficialK20,
      novedades: p.novedades,
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

  const getAsistenciaBadge = (asistencia: string) => {
    switch (asistencia) {
      case 'PRESENTE': return 'bg-cbvp-green/20 text-cbvp-green';
      case 'ACACR': return 'bg-cbvp-orange/20 text-cbvp-orange';
      case 'ACASR': return 'bg-cbvp-yellow/20 text-cbvp-yellow';
      case 'ASASR': return 'bg-cbvp-red/20 text-cbvp-red-light';
      default: return 'bg-white/10 text-white/40';
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'GUARDIA NORMAL': return 'bg-cbvp-red/10 text-cbvp-red';
      case 'GUARDIA ESPECIAL': return 'bg-cbvp-orange/10 text-cbvp-orange';
      case 'REFUERZO': return 'bg-cbvp-purple/10 text-cbvp-purple';
      case 'RADIO OPERADOR': return 'bg-cbvp-blue/10 text-cbvp-blue';
      case 'MOVIL': return 'bg-cbvp-teal/10 text-cbvp-teal';
      default: return 'bg-white/10 text-white/40';
    }
  };

  const groupByTipo = (personal: GuardiaPersonal[]) => {
    const groups: Record<string, GuardiaPersonal[]> = {};
    for (const p of personal) {
      const tipo = p.tipo || 'GUARDIA NORMAL';
      if (!groups[tipo]) groups[tipo] = [];
      groups[tipo].push(p);
    }
    return groups;
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
          <Upload className="w-4 h-4 text-cbvp-red" /> Cargar Planilla de Guardia
        </h2>

        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-cbvp-red bg-cbvp-red/5' : 'border-white/10 hover:border-white/20'
            }`}
            onClick={() => document.getElementById('file-input-guardia')?.click()}
          >
            <Upload className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-1">Arrastra una imagen o PDF aqui</p>
            <p className="text-white/20 text-xs">O haz clic para seleccionar</p>
            <input
              id="file-input-guardia"
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
              <div><span className="text-white/30">Grupo:</span> {result.grupo}</div>
              <div><span className="text-white/30">Fecha:</span> {result.fechaGuardia}</div>
              <div><span className="text-white/30">Presentes:</span> {result.presentes}/{result.totalPersonnel}</div>
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 mb-4 w-full">
          {showHistory ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-cbvp-red" /> Historial de Guardias
          </h2>
          {historialData?.planillas && (
            <span className="text-xs text-white/30 ml-auto">{historialData.planillas.length} registros</span>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase">
                        <th className="px-3 py-2 text-left rounded-tl-lg">Fecha</th>
                        <th className="px-3 py-2 text-left">Grupo</th>
                        <th className="px-3 py-2 text-left">Horario</th>
                        <th className="px-3 py-2 text-left">K20</th>
                        <th className="px-3 py-2 text-center rounded-tr-lg">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {historialData.planillas.map((p: PlanillaEncabezado) => (
                        <tr key={p.idPlanilla} className="hover:bg-cbvp-red/5 transition-colors group">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-white/30" />
                              <span className="text-white/80 text-xs">{p.fechaGuardia}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-white/60 text-xs">{p.grupo || '-'}</td>
                          <td className="px-3 py-2.5 text-white/60 text-xs">{p.inicioGuardia || '-'} - {p.finalizaGuardia || '-'}</td>
                          <td className="px-3 py-2.5 text-white/60 text-xs">{p.oficialK20 || '-'}</td>
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
                              {!esVoluntario && (
                                <button
                                  onClick={() => openEdit(p)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-yellow/20 text-white/40 hover:text-cbvp-yellow transition-colors"
                                  title="Editar"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedPlanilla(selectedPlanilla === p.idPlanilla ? null : p.idPlanilla)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-blue/20 text-white/40 hover:text-cbvp-blue transition-colors"
                                title="Ver detalle"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {!esVoluntario && (
                                <button
                                  onClick={() => setDeletingId(p.idPlanilla)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
                    {(() => {
                      const groups = groupByTipo(detalleData.personal);
                      return Object.entries(groups).map(([tipo, personas]) => (
                        <div key={tipo} className="mb-3 last:mb-0">
                          <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-2 px-2 py-1 rounded ${getTipoBadge(tipo)}`}>
                            {tipo} ({personas.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {personas.map((person: GuardiaPersonal, idx: number) => (
                              <div key={idx} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <User className="w-3.5 h-3.5 text-white/30 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs text-white truncate">{person.nombre}</p>
                                    {person.codigo && <p className="text-[10px] text-white/30">{person.codigo}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  {person.asignacion && (
                                    <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{person.asignacion}</span>
                                  )}
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getAsistenciaBadge(person.asistencia)}`}>
                                    {person.asistencia || '-'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-white/30 text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No hay planillas de guardia registradas.
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
                <label className="text-xs text-white/40 mb-1 block">Fecha de Guardia</label>
                <input type="text" value={editForm.fechaGuardia} onChange={e => setEditForm({ ...editForm, fechaGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Grupo</label>
                <input type="text" value={editForm.grupo} onChange={e => setEditForm({ ...editForm, grupo: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Hora Inicio</label>
                  <input type="text" value={editForm.inicioGuardia} onChange={e => setEditForm({ ...editForm, inicioGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Hora Finaliza</label>
                  <input type="text" value={editForm.finalizaGuardia} onChange={e => setEditForm({ ...editForm, finalizaGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Director de Semana</label>
                <input type="text" value={editForm.directorSem} onChange={e => setEditForm({ ...editForm, directorSem: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Comandante de Semana</label>
                <input type="text" value={editForm.comandanteSemana} onChange={e => setEditForm({ ...editForm, comandanteSemana: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Oficial K20</label>
                <input type="text" value={editForm.oficialK20} onChange={e => setEditForm({ ...editForm, oficialK20: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Novedades</label>
                <textarea value={editForm.novedades} onChange={e => setEditForm({ ...editForm, novedades: e.target.value })} rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none resize-none" />
              </div>
            </div>
            <div className="p-5 border-t border-white/10 flex gap-3">
              <button onClick={() => setEditingPlanilla(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" /> Cancelar
              </button>
              <button onClick={saveEdit} disabled={editarMutation.isPending} className="flex-1 py-2.5 bg-cbvp-yellow hover:bg-cbvp-yellow/80 disabled:opacity-50 text-black font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                {editarMutation.isPending ? <><Clock className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar Cambios</>}
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
              <div className="p-2 bg-cbvp-red/10 rounded-full"><Trash2 className="w-5 h-5 text-cbvp-red" /></div>
              <div>
                <h3 className="text-white font-semibold text-sm">Eliminar Planilla</h3>
                <p className="text-white/40 text-xs">Esta accion no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm">Cancelar</button>
              <button onClick={confirmDelete} disabled={eliminarMutation.isPending} className="flex-1 py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                {eliminarMutation.isPending ? <><Clock className="w-4 h-4 animate-spin" /> Eliminando...</> : <><Trash2 className="w-4 h-4" /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

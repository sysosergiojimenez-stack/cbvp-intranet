import { useState, useCallback, Fragment } from "react";
import { usePermiso } from "@/hooks/usePermiso";
import { compressImage } from "@/lib/imageCompress";
import { useAuth } from "@/context/AuthContext";
import { trpc } from "@/providers/trpc";
import type { GuardiaPersonal, PlanillaEncabezado } from "@/types";
import {
  Upload, FileText, Zap, CheckCircle, AlertTriangle,
  X, Clock, Calendar, User, Users, Shield,
  ChevronDown, ChevronUp, Eye, BookOpen,
  Edit3, Trash2, ExternalLink, Save, RotateCcw, Check,
  Camera, Image as ImageIcon
} from "lucide-react";

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
  } | null>(null);
  const [extraccion, setExtraccion] = useState<{
    urlImagen: string;
    fechaGuardia: string; grupo: string; inicioGuardia: string; finalizaGuardia: string;
    directorSem: string; comandanteSemana: string; oficialK20: string; novedades: string;
    personal: Array<{ codigo: string; nombre: string; asignacion: string; asistencia: string }>;
    guardiasEspeciales: Array<{ codigo: string; nombre: string; asignacion: string }>;
    refuerzos: Array<{ codigo: string; nombre: string; asignacion: string }>;
  } | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedPlanilla, setSelectedPlanilla] = useState<string | null>(null);

  const [editingPlanilla, setEditingPlanilla] = useState<PlanillaEncabezado | null>(null);
  const [editForm, setEditForm] = useState({
    fechaGuardia: "", grupo: "", inicioGuardia: "", finalizaGuardia: "",
    directorSem: "", comandanteSemana: "", oficialK20: "", novedades: "",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<{ codigo: string; nombre: string; asistencia: string } | null>(null);
  const [personAsistencia, setPersonAsistencia] = useState<"PRESENTE" | "AUSENTE" | "AUSENTE CON REEMPLAZO">("PRESENTE");

  const utils = trpc.useUtils();
  const extraerMutation = trpc.planillas.extraer.useMutation();
  const guardarMutation = trpc.planillas.guardar.useMutation();
  const { data: historialData, isLoading: historialLoading } = trpc.planillas.historial.useQuery(
    {}, { enabled: showHistory }
  );
  const { data: detalleData } = trpc.planillas.detalle.useQuery(
    { idPlanilla: selectedPlanilla || "" },
    { enabled: !!selectedPlanilla }
  );

  const eliminarMutation = trpc.planillas.eliminar.useMutation({
    onSuccess: () => { utils.planillas.historial.invalidate(); setDeletingId(null); setSelectedPlanilla(null); },
  });
  const editarMutation = trpc.planillas.editar.useMutation({
    onSuccess: () => { utils.planillas.historial.invalidate(); setEditingPlanilla(null); },
  });
  const editarPersonMutation = trpc.planillas.editarPersonal.useMutation({
    onSuccess: () => { utils.planillas.detalle.invalidate(); setEditingPerson(null); },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  }, []);

  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const MAX_SIZE = isMobile ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

  const handleFile = async (selectedFile: File) => {
    setError(""); setResult(null);
    const comprimido = await compressImage(selectedFile);
    if (comprimido.size > MAX_SIZE) {
      setError(`Maximo ${MAX_SIZE / 1024 / 1024}MB permitido${isMobile ? " en movil" : ""}.`);
      return;
    }
    setFile(comprimido);
    if (comprimido.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(comprimido);
    } else {
      setFilePreview(null);
    }
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  };

  const procesarPlanilla = async () => {
    if (!file) return;
    setIsProcessing(true); setError(""); setExtraccion(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64Data = arrayBufferToBase64(buffer);
      const resp = await extraerMutation.mutateAsync({
        base64Data, fileName: file.name, fileType: file.type,
      });
      if (resp.exito) {
        const datos = resp.datos as {
          fechaGuardia?: string; grupo?: string; inicioGuardia?: string; finalizaGuardia?: string;
          directorSem?: string; comandanteSemana?: string; oficialK20?: string; novedades?: string;
          personal?: Array<{ codigo?: string; nombre?: string; asignacion?: string; asistencia?: string }>;
          guardiasEspeciales?: Array<{ codigo?: string; nombre?: string; asignacion?: string }>;
          refuerzos?: Array<{ codigo?: string; nombre?: string; asignacion?: string }>;
        };
        setExtraccion({
          urlImagen: resp.urlImagen || "",
          fechaGuardia: datos.fechaGuardia || "",
          grupo: datos.grupo || "",
          inicioGuardia: datos.inicioGuardia || "",
          finalizaGuardia: datos.finalizaGuardia || "",
          directorSem: datos.directorSem || "",
          comandanteSemana: datos.comandanteSemana || "",
          oficialK20: datos.oficialK20 || "",
          novedades: datos.novedades || "",
          personal: (datos.personal || []).map(p => ({ codigo: p.codigo || "", nombre: p.nombre || "", asignacion: p.asignacion || "", asistencia: p.asistencia || "PRESENTE" })),
          guardiasEspeciales: (datos.guardiasEspeciales || []).map(p => ({ codigo: p.codigo || "", nombre: p.nombre || "", asignacion: p.asignacion || "" })),
          refuerzos: (datos.refuerzos || []).map(p => ({ codigo: p.codigo || "", nombre: p.nombre || "", asignacion: p.asignacion || "" })),
        });
      } else {
        setError(resp.mensaje || "Error al procesar");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexion");
    } finally { setIsProcessing(false); }
  };

  const confirmarGuardar = async () => {
    if (!extraccion || !usuario) return;
    setIsProcessing(true); setError("");
    try {
      const resp = await guardarMutation.mutateAsync({
        urlImagen: extraccion.urlImagen,
        datos: {
          fechaGuardia: extraccion.fechaGuardia, grupo: extraccion.grupo,
          inicioGuardia: extraccion.inicioGuardia, finalizaGuardia: extraccion.finalizaGuardia,
          directorSem: extraccion.directorSem, comandanteSemana: extraccion.comandanteSemana,
          oficialK20: extraccion.oficialK20, novedades: extraccion.novedades,
          personal: extraccion.personal, guardiasEspeciales: extraccion.guardiasEspeciales,
          refuerzos: extraccion.refuerzos,
        },
        user: { identificador: usuario.identificador, nombreCompleto: usuario.nombreCompleto },
      });
      if (resp.exito) {
        setResult({
          idPlanilla: resp.idPlanilla || "unknown",
          fechaGuardia: extraccion.fechaGuardia,
          grupo: extraccion.grupo,
          totalPersonnel: extraccion.personal.length,
          presentes: extraccion.personal.filter(p => p.asistencia === "PRESENTE").length,
        });
        setExtraccion(null);
        setFile(null); setFilePreview(null);
        utils.planillas.historial.invalidate();
      } else {
        setError(resp.mensaje || "Error al guardar");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexion");
    } finally { setIsProcessing(false); }
  };

  const updateListField = (
    lista: "personal" | "guardiasEspeciales" | "refuerzos",
    idx: number,
    campo: string,
    valor: string
  ) => {
    if (!extraccion) return;
    const nuevaLista = [...(extraccion[lista] as Array<Record<string, string>>)];
    nuevaLista[idx] = { ...nuevaLista[idx], [campo]: valor };
    setExtraccion({ ...extraccion, [lista]: nuevaLista });
  };

  const toggleRow = (p: PlanillaEncabezado) => {
    if (selectedPlanilla === p.idPlanilla) {
      setSelectedPlanilla(null);
      return;
    }
    setSelectedPlanilla(p.idPlanilla);
    setEditForm({
      fechaGuardia: p.fechaGuardia, grupo: p.grupo, inicioGuardia: p.inicioGuardia,
      finalizaGuardia: p.finalizaGuardia, directorSem: p.directorSem,
      comandanteSemana: p.comandanteSemana, oficialK20: p.oficialK20, novedades: p.novedades,
    });
  };
  const saveEdit = async () => {
    if (!selectedPlanilla) return;
    await editarMutation.mutateAsync({ idPlanilla: selectedPlanilla, ...editForm });
  };
  const confirmDelete = async () => {
    if (!deletingId) return;
    await eliminarMutation.mutateAsync({ idPlanilla: deletingId });
  };

  const startEditPerson = (person: GuardiaPersonal) => {
    setEditingPerson({ codigo: person.codigo, nombre: person.nombre, asistencia: person.asistencia });
    setPersonAsistencia((person.asistencia === "AUSENTE" || person.asistencia === "AUSENTE CON REEMPLAZO") ? person.asistencia as "PRESENTE" | "AUSENTE" | "AUSENTE CON REEMPLAZO" : "PRESENTE");
  };
  const savePersonEdit = async (idPlanilla: string, codigo: string) => {
    await editarPersonMutation.mutateAsync({ idPlanilla, codigo, nuevaAsistencia: personAsistencia });
  };

  const getAsistenciaBadge = (a: string) => {
    switch (a) {
      case "PRESENTE": return "bg-cbvp-green/20 text-cbvp-green";
      case "AUSENTE CON REEMPLAZO": return "bg-cbvp-orange/20 text-cbvp-orange";
      case "AUSENTE": return "bg-cbvp-red/20 text-cbvp-red-light";
      default: return "bg-white/10 text-white/40";
    }
  };
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "GUARDIA NORMAL": return "bg-cbvp-red/10 text-cbvp-red";
      case "GUARDIA ESPECIAL": return "bg-cbvp-orange/10 text-cbvp-orange";
      case "REFUERZO": return "bg-cbvp-purple/10 text-cbvp-purple";
      case "RADIO OPERADOR": return "bg-cbvp-blue/10 text-cbvp-blue";
      case "MOVIL": return "bg-cbvp-teal/10 text-cbvp-teal";
      default: return "bg-white/10 text-white/40";
    }
  };
  const groupByTipo = (personal: GuardiaPersonal[]) => {
    const groups: Record<string, GuardiaPersonal[]> = {};
    for (const p of personal) { const t = p.tipo || "GUARDIA NORMAL"; if (!groups[t]) groups[t] = []; groups[t].push(p); }
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
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-cbvp-red" /> Cargar Planilla de Guardia
        </h2>
        {!file ? (
          <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? "border-cbvp-red bg-cbvp-red/5" : "border-white/10"}`}>
            <Upload className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-3">Subi una imagen de la planilla</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button type="button" onClick={() => document.getElementById("file-input-guardia-camara")?.click()} className="px-4 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Camera className="w-4 h-4" /> Tomar Foto
              </button>
              <button type="button" onClick={() => document.getElementById("file-input-guardia-galeria")?.click()} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm flex items-center gap-2 transition-colors">
                <ImageIcon className="w-4 h-4" /> Galeria
              </button>
            </div>
            <input id="file-input-guardia-camara" type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="hidden" />
            <input id="file-input-guardia-galeria" type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
          </div>
        ) : (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-cbvp-red" />
                <span className="text-white text-sm">{file.name}</span>
                <span className="text-white/30 text-xs">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <button onClick={() => { setFile(null); setFilePreview(null); setResult(null); setError(""); }} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            {filePreview && <img src={filePreview} alt="Preview" className="max-h-48 rounded-lg mb-3 border border-white/10" />}
            <button onClick={procesarPlanilla} disabled={isProcessing}
              className="w-full py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm">
              {isProcessing ? <><Clock className="w-4 h-4 animate-spin" /> Procesando con IA...</> : <><Zap className="w-4 h-4" /> Procesar Planilla</>}
            </button>
          </div>
        )}
        {extraccion && (
          <div className="mt-3 bg-white/[0.03] border border-cbvp-yellow/20 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cbvp-yellow flex items-center gap-2"><Edit3 className="w-4 h-4" /> Revisa los datos antes de guardar</h3>
              {extraccion.urlImagen && (
                <a href={extraccion.urlImagen} target="_blank" rel="noopener noreferrer" className="text-xs text-cbvp-blue hover:underline flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> Ver imagen subida</a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/40 mb-1 block">Grupo</label><input type="text" value={extraccion.grupo} onChange={e => setExtraccion({ ...extraccion, grupo: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Fecha Guardia</label><input type="text" value={extraccion.fechaGuardia} onChange={e => setExtraccion({ ...extraccion, fechaGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Hora Inicio</label><input type="text" value={extraccion.inicioGuardia} onChange={e => setExtraccion({ ...extraccion, inicioGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Hora Finaliza</label><input type="text" value={extraccion.finalizaGuardia} onChange={e => setExtraccion({ ...extraccion, finalizaGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Director de Semana</label><input type="text" value={extraccion.directorSem} onChange={e => setExtraccion({ ...extraccion, directorSem: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Comandante de Semana</label><input type="text" value={extraccion.comandanteSemana} onChange={e => setExtraccion({ ...extraccion, comandanteSemana: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Oficial K20</label><input type="text" value={extraccion.oficialK20} onChange={e => setExtraccion({ ...extraccion, oficialK20: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
            </div>
            <div><label className="text-xs text-white/40 mb-1 block">Novedades</label><textarea value={extraccion.novedades} onChange={e => setExtraccion({ ...extraccion, novedades: e.target.value })} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none resize-none" /></div>

            <div>
              <h4 className="text-xs font-semibold text-white/60 uppercase mb-2">Guardia Normal ({extraccion.personal.length})</h4>
              <div className="space-y-2">
                {extraccion.personal.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/[0.03] rounded-lg p-2">
                    <input type="text" value={p.codigo} onChange={e => updateListField("personal", idx, "codigo", e.target.value)} placeholder="Codigo" className="col-span-2 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                    <input type="text" value={p.nombre} onChange={e => updateListField("personal", idx, "nombre", e.target.value)} placeholder="Nombre" className="col-span-4 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                    <input type="text" value={p.asignacion} onChange={e => updateListField("personal", idx, "asignacion", e.target.value)} placeholder="Asignacion" className="col-span-3 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                    <select value={p.asistencia} onChange={e => updateListField("personal", idx, "asistencia", e.target.value)} className="col-span-3 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none">
                      <option value="PRESENTE">Presente</option>
                      <option value="AUSENTE">Ausente</option>
                      <option value="AUSENTE CON REEMPLAZO">Ausente c/reemplazo</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {extraccion.guardiasEspeciales.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-white/60 uppercase mb-2">Guardias Especiales ({extraccion.guardiasEspeciales.length})</h4>
                <div className="space-y-2">
                  {extraccion.guardiasEspeciales.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/[0.03] rounded-lg p-2">
                      <input type="text" value={p.codigo} onChange={e => updateListField("guardiasEspeciales", idx, "codigo", e.target.value)} placeholder="Codigo" className="col-span-3 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                      <input type="text" value={p.nombre} onChange={e => updateListField("guardiasEspeciales", idx, "nombre", e.target.value)} placeholder="Nombre" className="col-span-5 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                      <input type="text" value={p.asignacion} onChange={e => updateListField("guardiasEspeciales", idx, "asignacion", e.target.value)} placeholder="Asignacion" className="col-span-4 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extraccion.refuerzos.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-white/60 uppercase mb-2">Refuerzos ({extraccion.refuerzos.length})</h4>
                <div className="space-y-2">
                  {extraccion.refuerzos.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/[0.03] rounded-lg p-2">
                      <input type="text" value={p.codigo} onChange={e => updateListField("refuerzos", idx, "codigo", e.target.value)} placeholder="Codigo" className="col-span-3 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                      <input type="text" value={p.nombre} onChange={e => updateListField("refuerzos", idx, "nombre", e.target.value)} placeholder="Nombre" className="col-span-5 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                      <input type="text" value={p.asignacion} onChange={e => updateListField("refuerzos", idx, "asignacion", e.target.value)} placeholder="Asignacion" className="col-span-4 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-5 h-5 text-cbvp-green" /><span className="text-cbvp-green font-semibold text-sm">Planilla procesada correctamente</span></div>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
              <div><span className="text-white/30">ID:</span> {result.idPlanilla}</div>
              <div><span className="text-white/30">Grupo:</span> {result.grupo}</div>
              <div><span className="text-white/30">Fecha:</span> {result.fechaGuardia}</div>
              <div><span className="text-white/30">Presentes:</span> {result.presentes}/{result.totalPersonnel}</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 mb-4 w-full">
          {showHistory ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2"><Shield className="w-4 h-4 text-cbvp-red" /> Historial de Guardias</h2>
          {historialData?.planillas && <span className="text-xs text-white/30 ml-auto">{historialData.planillas.length} registros</span>}
        </button>

        {showHistory && (
          <>
            {historialLoading && <div className="flex items-center justify-center py-6"><div className="w-5 h-5 border-2 border-cbvp-red/30 border-t-cbvp-red rounded-full animate-spin" /><span className="ml-2 text-sm text-white/40">Cargando...</span></div>}

            {historialData?.planillas && historialData.planillas.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm block sm:table">
                    <thead className="hidden sm:table-header-group">
                      <tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase">
                        <th className="px-3 py-2 text-left rounded-tl-lg">Fecha Guardia</th>
                        <th className="px-3 py-2 text-left">Fecha Carga</th>
                        <th className="px-3 py-2 text-left">Grupo</th>
                        <th className="px-3 py-2 text-left">Horario</th>
                        <th className="px-3 py-2 text-center rounded-tr-lg">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 block sm:table-row-group">
                      {historialData.planillas.map((p: PlanillaEncabezado) => (
                        <Fragment key={p.idPlanilla}>
                        <tr onClick={() => toggleRow(p)} className="hover:bg-cbvp-red/5 transition-colors group block sm:table-row mb-2 sm:mb-0 bg-white/[0.02] sm:bg-transparent rounded-lg sm:rounded-none border border-white/5 sm:border-0 cursor-pointer">
                          <td className="px-3 py-2.5 block sm:table-cell"><div className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-white/30" /><span className="text-white/80 text-xs">{p.fechaGuardia}</span></div></td>
                          <td className="px-3 py-2.5 text-white/60 text-xs block sm:table-cell"><span className="text-white/30 sm:hidden">Carga: </span>{p.fechaCarga}</td>
                          <td className="px-3 py-2.5 text-white/60 text-xs block sm:table-cell"><span className="text-white/30 sm:hidden">Grupo: </span>{p.grupo || "-"}</td>
                          <td className="px-3 py-2.5 text-white/60 text-xs block sm:table-cell"><span className="text-white/30 sm:hidden">Horario: </span>{p.inicioGuardia || "-"} - {p.finalizaGuardia || "-"}</td>
                          <td className="px-3 py-2.5 block sm:table-cell" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1 pt-1.5 sm:pt-0 mt-1 sm:mt-0 border-t border-white/5 sm:border-0">
                              {p.urlImagen && (
                                <a href={p.urlImagen} target="_blank" rel="noopener noreferrer" className="p-2.5 sm:p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-green/20 text-white/40 hover:text-cbvp-green transition-colors" title="Ver archivo"><ExternalLink className="w-3.5 h-3.5" /></a>
                              )}
                              {!esVoluntario && (
                                <button onClick={() => setDeletingId(p.idPlanilla)} className="p-2.5 sm:p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {selectedPlanilla === p.idPlanilla && detalleData?.personal && (
                          <tr>
                            <td colSpan={5} className="px-3 pb-3 pt-1 bg-white/[0.02]">
                              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    {!esVoluntario ? <Edit3 className="w-4 h-4 text-cbvp-yellow" /> : <Eye className="w-4 h-4 text-cbvp-blue" />}
                                    Detalle de la Planilla
                                  </h3>
                                  <button onClick={() => setSelectedPlanilla(null)} className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
                                </div>

                                {!esVoluntario ? (
                                  <div className="mb-4 pb-4 border-b border-white/10">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div><label className="text-xs text-white/40 mb-1 block">Fecha de Guardia</label><input type="text" value={editForm.fechaGuardia} onChange={e => setEditForm({ ...editForm, fechaGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                                      <div><label className="text-xs text-white/40 mb-1 block">Grupo</label><input type="text" value={editForm.grupo} onChange={e => setEditForm({ ...editForm, grupo: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                                      <div><label className="text-xs text-white/40 mb-1 block">Hora Inicio</label><input type="text" value={editForm.inicioGuardia} onChange={e => setEditForm({ ...editForm, inicioGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                                      <div><label className="text-xs text-white/40 mb-1 block">Hora Finaliza</label><input type="text" value={editForm.finalizaGuardia} onChange={e => setEditForm({ ...editForm, finalizaGuardia: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                                      <div><label className="text-xs text-white/40 mb-1 block">Director de Semana</label><input type="text" value={editForm.directorSem} onChange={e => setEditForm({ ...editForm, directorSem: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                                      <div><label className="text-xs text-white/40 mb-1 block">Comandante de Semana</label><input type="text" value={editForm.comandanteSemana} onChange={e => setEditForm({ ...editForm, comandanteSemana: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                                      <div><label className="text-xs text-white/40 mb-1 block">Oficial K20</label><input type="text" value={editForm.oficialK20} onChange={e => setEditForm({ ...editForm, oficialK20: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" /></div>
                                      <div className="sm:col-span-2"><label className="text-xs text-white/40 mb-1 block">Novedades</label><textarea value={editForm.novedades} onChange={e => setEditForm({ ...editForm, novedades: e.target.value })} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none resize-none" /></div>
                                    </div>
                                    <button onClick={saveEdit} disabled={editarMutation.isPending} className="mt-3 w-full sm:w-auto px-5 py-2.5 bg-cbvp-yellow hover:bg-cbvp-yellow/80 disabled:opacity-50 text-black font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">{editarMutation.isPending ? <><Clock className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar Cambios</>}</button>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pb-4 border-b border-white/10 text-xs">
                                    <div><span className="text-white/30">Fecha</span><p className="text-white mt-0.5">{p.fechaGuardia}</p></div>
                                    <div><span className="text-white/30">Grupo</span><p className="text-white mt-0.5">{p.grupo || "-"}</p></div>
                                    <div><span className="text-white/30">Horario</span><p className="text-white mt-0.5">{p.inicioGuardia || "-"} - {p.finalizaGuardia || "-"}</p></div>
                                    <div><span className="text-white/30">Director</span><p className="text-white mt-0.5">{p.directorSem || "-"}</p></div>
                                    <div><span className="text-white/30">Comandante</span><p className="text-white mt-0.5">{p.comandanteSemana || "-"}</p></div>
                                    <div><span className="text-white/30">Oficial K20</span><p className="text-white mt-0.5">{p.oficialK20 || "-"}</p></div>
                                    {p.novedades && <div className="col-span-2 sm:col-span-4"><span className="text-white/30">Novedades</span><p className="text-white mt-0.5">{p.novedades}</p></div>}
                                  </div>
                                )}

                                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-cbvp-red" /> Personal</h3>
                                {(() => {
                                  const groups = groupByTipo(detalleData.personal);
                                  return Object.entries(groups).map(([tipo, personas]) => (
                                    <div key={tipo} className="mb-3 last:mb-0">
                                      <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-2 px-2 py-1 rounded ${getTipoBadge(tipo)}`}>{tipo} ({personas.length})</h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {personas.map((person: GuardiaPersonal, idx: number) => {
                                          const isEditing = editingPerson?.codigo === person.codigo;
                                          return (
                                            <div key={idx} className="bg-white/[0.03] rounded-lg p-2">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <User className="w-3.5 h-3.5 text-white/30 shrink-0" />
                                                  <div className="min-w-0">
                                                    <p className="text-xs text-white truncate">{person.nombre}</p>
                                                    {person.codigo && <p className="text-[10px] text-white/30">{person.codigo}</p>}
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                  {isEditing ? (
                                                    <>
                                                      <select value={personAsistencia} onChange={e => setPersonAsistencia(e.target.value as "PRESENTE" | "AUSENTE" | "AUSENTE CON REEMPLAZO")}
                                                        className="bg-white/5 border border-white/10 rounded text-[10px] text-white px-1 py-0.5 focus:border-cbvp-red/50 focus:outline-none">
                                                        <option value="PRESENTE">Presente</option>
                                                        <option value="AUSENTE">Ausente</option>
                                                        <option value="AUSENTE CON REEMPLAZO">Ausente con reemplazo</option>
                                                      </select>
                                                      <button onClick={() => savePersonEdit(selectedPlanilla!, person.codigo)} disabled={editarPersonMutation.isPending}
                                                        className="p-1 rounded bg-cbvp-green/20 text-cbvp-green hover:bg-cbvp-green/30 transition-colors" title="Guardar"><Check className="w-3 h-3" /></button>
                                                      <button onClick={() => setEditingPerson(null)} className="p-1 rounded bg-white/5 text-white/40 hover:text-white transition-colors" title="Cancelar"><X className="w-3 h-3" /></button>
                                                    </>
                                                  ) : (
                                                    <>
                                                      {person.asignacion && <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{person.asignacion}</span>}
                                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getAsistenciaBadge(person.asistencia)}`}>{person.asistencia || "-"}</span>
                                                      {!esVoluntario && (
                                                        <button onClick={() => startEditPerson(person)} className="p-1 rounded hover:bg-cbvp-yellow/20 text-white/30 hover:text-cbvp-yellow transition-colors" title="Editar asistencia"><Edit3 className="w-3 h-3" /></button>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </td>
                          </tr>
                        )}
</Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-white/30 text-sm"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />No hay planillas de guardia registradas.</div>
            )}
          </>
        )}
      </div>

      {deletingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] border border-white/10 rounded-xl w-full max-w-sm p-5">
            <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-cbvp-red/10 rounded-full"><Trash2 className="w-5 h-5 text-cbvp-red" /></div><div><h3 className="text-white font-semibold text-sm">Eliminar Planilla</h3><p className="text-white/40 text-xs">Esta accion no se puede deshacer.</p></div></div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm">Cancelar</button>
              <button onClick={confirmDelete} disabled={eliminarMutation.isPending} className="flex-1 py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">{eliminarMutation.isPending ? <><Clock className="w-4 h-4 animate-spin" /> Eliminando...</> : <><Trash2 className="w-4 h-4" /> Eliminar</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

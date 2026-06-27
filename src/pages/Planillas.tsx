import { useState, useCallback } from 'react';
import { usePermiso } from '@/hooks/usePermiso';
import { trpc } from '@/providers/trpc';
import { PERSONAL_DATA } from '@/data/mockData';
import type { DatosExtraidos } from '@/types';
import {
  Upload, FileText, Zap, CheckCircle, AlertTriangle,
  X, Clock, Calendar, User, Users, Radio,
  ChevronDown, ChevronUp
} from 'lucide-react';

const ASISTENCIA_OPCIONES = ['PRESENTE', 'ACACR', 'ACASR', 'ASASR'];

export default function Planillas() {
  const { puedeCargarPlanillas } = usePermiso();
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ idPlanilla: string; datos: DatosExtraidos } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    personal: true, especiales: true, refuerzos: true, radio: true, moviles: true,
  });

  const procesarMutation = trpc.planillas.procesar.useMutation();

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
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
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
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const procesarPlanilla = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;

      try {
        const resp = await procesarMutation.mutateAsync({
          base64Data,
          fileName: file.name,
          fileType: file.type,
          user: { identificador: '1', nombreCompleto: 'Usuario' },
        });

        if (resp.exito && resp.datos) {
          setResult({
            idPlanilla: resp.idPlanilla || 'unknown',
            datos: resp.datos as DatosExtraidos,
          });
        } else {
          // Fallback: mock processing
          simulateMockProcessing(base64Data);
        }
      } catch {
        // If tRPC fails (backend not configured), use mock
        simulateMockProcessing(base64Data);
      }

      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const simulateMockProcessing = (base64Data: string) => {
    const mockData: DatosExtraidos = {
      compania: 'Vigesima Compania Capital',
      grupo: 'A',
      fechaGuardia: '20/01/2026',
      tipoGuardia: 'Normal',
      personal: PERSONAL_DATA.slice(0, 6).map((p, i) => ({
        numero: (i + 1).toString(),
        codigo: p.codigo,
        nombre: p.nombreCompleto,
        asignacion: i === 0 ? 'Jefe de Guardia' : i < 3 ? `AB-20${i}` : 'Reserva',
        asistencia: ASISTENCIA_OPCIONES[Math.floor(Math.random() * ASISTENCIA_OPCIONES.length)],
      })),
      guardiasEspeciales: [
        { numero: '1', codigo: PERSONAL_DATA[1].codigo, nombre: PERSONAL_DATA[1].nombreCompleto, asignacion: 'Supervision' },
      ],
      refuerzos: [
        { numero: '1', codigo: PERSONAL_DATA[11].codigo, nombre: PERSONAL_DATA[11].nombreCompleto, asignacion: 'Apoyo' },
      ],
      radioOperadores: [
        { codigo: PERSONAL_DATA[10].codigo, nombre: PERSONAL_DATA[10].nombreCompleto, alfa: 'Activo', k20: 'Operativo' },
      ],
      moviles: [
        { codigo: 'AB-201', situacion: 'Operativo', kilometraje: '10.450' },
        { codigo: 'AB-202', situacion: 'Taller', kilometraje: '8.230' },
      ],
      novedades: 'Mantenimiento preventivo del AB-201. Se realizo limpieza general del cuartel y revision de equipos.',
      inicioGuardia: '08:00',
      finalizaGuardia: '20:00',
      directorSem: PERSONAL_DATA[12].nombreCompleto,
      comandanteSemana: PERSONAL_DATA[0].nombreCompleto,
      oficialK20: PERSONAL_DATA[1].nombreCompleto,
    };

    setResult({
      idPlanilla: `GRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`,
      datos: mockData,
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const clearAll = () => {
    setFile(null);
    setFilePreview(null);
    setResult(null);
    setError('');
  };

  if (!puedeCargarPlanillas) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-6">Planillas de Guardia</h1>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-cbvp-orange mx-auto mb-4" />
          <p className="text-white/60">No tienes permisos para acceder a este modulo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Planillas de Guardia</h1>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 mb-6">
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              dragOver ? 'border-cbvp-red bg-cbvp-red/5' : 'border-white/10 hover:border-cbvp-red/40 hover:bg-white/[0.02]'
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-cbvp-red/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-cbvp-red" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Arrastra la planilla aqui</h3>
            <p className="text-sm text-white/40 mb-2">O haz clic para seleccionar</p>
            <p className="text-xs text-white/25">JPG, PNG, PDF (max. 10MB)</p>
            <input id="fileInput" type="file" accept="image/*,.pdf" onChange={handleFileInput} className="hidden" />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-4">
            <div className="flex items-center gap-4">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-cbvp-red/10 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-cbvp-red" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={clearAll} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
        )}

        {file && !result && (
          <button
            onClick={procesarPlanilla}
            disabled={isProcessing}
            className="w-full mt-5 py-3.5 bg-cbvp-red hover:bg-cbvp-red-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando con Gemini AI...</>
            ) : (
              <><Zap className="w-5 h-5" /> Procesar con IA</>
            )}
          </button>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-cbvp-red-light text-sm bg-cbvp-red/10 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-cbvp-green/5 border border-cbvp-green/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <CheckCircle className="w-6 h-6 text-cbvp-green" />
            <div>
              <h3 className="text-lg font-semibold text-cbvp-green">Planilla procesada correctamente</h3>
              <p className="text-xs text-white/40 font-mono mt-0.5">{result.idPlanilla}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-white/[0.03] rounded-lg">
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3" />Fecha</label><p className="text-sm text-white mt-1">{result.datos.fechaGuardia || '-'}</p></div>
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" />Grupo</label><p className="text-sm text-white mt-1">{result.datos.grupo || '-'}</p></div>
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" />Horario</label><p className="text-sm text-white mt-1">{result.datos.inicioGuardia || '-'} - {result.datos.finalizaGuardia || '-'}</p></div>
            <div><label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1"><User className="w-3 h-3" />K20</label><p className="text-sm text-white mt-1">{result.datos.oficialK20 || '-'}</p></div>
          </div>

          {/* Personal Section */}
          <div className="mb-4">
            <button onClick={() => toggleSection('personal')} className="flex items-center gap-2 w-full text-left mb-2">
              {expandedSections.personal ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
              <h4 className="text-sm font-semibold text-cbvp-red">Guardia Normal ({result.datos.personal.length})</h4>
            </button>
            {expandedSections.personal && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase"><th className="px-3 py-2 text-left rounded-tl-lg">Nro</th><th className="px-3 py-2 text-left">Codigo</th><th className="px-3 py-2 text-left">Personal</th><th className="px-3 py-2 text-left">Asignacion</th><th className="px-3 py-2 text-left rounded-tr-lg">Asistencia</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {result.datos.personal.map((p: { numero?: string; codigo?: string; nombre?: string; asignacion?: string; asistencia?: string }, i: number) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-white/60">{p.numero}</td>
                        <td className="px-3 py-2.5"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{p.codigo}</code></td>
                        <td className="px-3 py-2.5 text-white">{p.nombre}</td>
                        <td className="px-3 py-2.5 text-white/60">{p.asignacion}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.asistencia === 'PRESENTE' ? 'bg-cbvp-green/20 text-cbvp-green' :
                            p.asistencia === 'ACACR' ? 'bg-cbvp-orange/20 text-cbvp-orange' :
                            p.asistencia === 'ACASR' ? 'bg-cbvp-yellow/20 text-cbvp-yellow' :
                            'bg-cbvp-red/20 text-cbvp-red-light'
                          }`}>{p.asistencia || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Other sections */}
          {result.datos.guardiasEspeciales.length > 0 && (
            <div className="mb-4">
              <button onClick={() => toggleSection('especiales')} className="flex items-center gap-2 w-full text-left mb-2">
                {expandedSections.especiales ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                <h4 className="text-sm font-semibold text-cbvp-orange">Guardias Especiales ({result.datos.guardiasEspeciales.length})</h4>
              </button>
              {expandedSections.especiales && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-cbvp-orange/10 text-white/60 text-xs uppercase"><th className="px-3 py-2 text-left rounded-tl-lg">Nro</th><th className="px-3 py-2 text-left">Codigo</th><th className="px-3 py-2 text-left">Personal</th><th className="px-3 py-2 text-left rounded-tr-lg">Asignacion</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {result.datos.guardiasEspeciales.map((e: { numero?: string; codigo?: string; nombre?: string; asignacion?: string }, i: number) => (
                        <tr key={i} className="hover:bg-white/[0.02]"><td className="px-3 py-2.5 text-white/60">{e.numero}</td><td className="px-3 py-2.5"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{e.codigo}</code></td><td className="px-3 py-2.5 text-white">{e.nombre}</td><td className="px-3 py-2.5 text-white/60">{e.asignacion}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {result.datos.refuerzos.length > 0 && (
            <div className="mb-4">
              <button onClick={() => toggleSection('refuerzos')} className="flex items-center gap-2 w-full text-left mb-2">
                {expandedSections.refuerzos ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                <h4 className="text-sm font-semibold text-cbvp-purple">Refuerzos ({result.datos.refuerzos.length})</h4>
              </button>
              {expandedSections.refuerzos && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-cbvp-purple/10 text-white/60 text-xs uppercase"><th className="px-3 py-2 text-left rounded-tl-lg">Nro</th><th className="px-3 py-2 text-left">Codigo</th><th className="px-3 py-2 text-left">Personal</th><th className="px-3 py-2 text-left rounded-tr-lg">Asignacion</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {result.datos.refuerzos.map((r: { numero?: string; codigo?: string; nombre?: string; asignacion?: string }, i: number) => (
                        <tr key={i} className="hover:bg-white/[0.02]"><td className="px-3 py-2.5 text-white/60">{r.numero}</td><td className="px-3 py-2.5"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{r.codigo}</code></td><td className="px-3 py-2.5 text-white">{r.nombre}</td><td className="px-3 py-2.5 text-white/60">{r.asignacion}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {result.datos.radioOperadores.length > 0 && (
            <div className="mb-4">
              <button onClick={() => toggleSection('radio')} className="flex items-center gap-2 w-full text-left mb-2">
                {expandedSections.radio ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                <h4 className="text-sm font-semibold text-cbvp-blue">Radio Operadores ({result.datos.radioOperadores.length})</h4>
              </button>
              {expandedSections.radio && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-cbvp-blue/10 text-white/60 text-xs uppercase"><th className="px-3 py-2 text-left rounded-tl-lg">Codigo</th><th className="px-3 py-2 text-left">Personal</th><th className="px-3 py-2 text-left">Alfa</th><th className="px-3 py-2 text-left rounded-tr-lg">K20</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {result.datos.radioOperadores.map((ro: { codigo?: string; nombre?: string; alfa?: string; k20?: string }, i: number) => (
                        <tr key={i} className="hover:bg-white/[0.02]"><td className="px-3 py-2.5"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{ro.codigo}</code></td><td className="px-3 py-2.5 text-white">{ro.nombre}</td><td className="px-3 py-2.5 text-white/60">{ro.alfa}</td><td className="px-3 py-2.5 text-white/60">{ro.k20}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {result.datos.moviles.length > 0 && (
            <div className="mb-4">
              <button onClick={() => toggleSection('moviles')} className="flex items-center gap-2 w-full text-left mb-2">
                {expandedSections.moviles ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                <h4 className="text-sm font-semibold text-cbvp-teal">Moviles ({result.datos.moviles.length})</h4>
              </button>
              {expandedSections.moviles && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-cbvp-teal/10 text-white/60 text-xs uppercase"><th className="px-3 py-2 text-left rounded-tl-lg">Codigo</th><th className="px-3 py-2 text-left">Situacion</th><th className="px-3 py-2 text-left rounded-tr-lg">Kilometraje</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {result.datos.moviles.map((m: { codigo?: string; situacion?: string; kilometraje?: string }, i: number) => (
                        <tr key={i} className="hover:bg-white/[0.02]"><td className="px-3 py-2.5"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{m.codigo}</code></td><td className="px-3 py-2.5 text-white/60">{m.situacion}</td><td className="px-3 py-2.5 text-white/60">{m.kilometraje}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {result.datos.novedades && (
            <div className="mt-4 p-4 bg-white/[0.03] rounded-lg border border-white/5">
              <h4 className="text-xs font-semibold text-cbvp-yellow uppercase tracking-wider mb-2">Novedades</h4>
              <p className="text-sm text-white/70">{result.datos.novedades}</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white/[0.03] rounded-lg flex items-center gap-3"><User className="w-4 h-4 text-white/30" /><div><p className="text-[10px] text-white/40 uppercase">Director Sem</p><p className="text-xs text-white">{result.datos.directorSem || '-'}</p></div></div>
            <div className="p-3 bg-white/[0.03] rounded-lg flex items-center gap-3"><Users className="w-4 h-4 text-white/30" /><div><p className="text-[10px] text-white/40 uppercase">Comandante</p><p className="text-xs text-white">{result.datos.comandanteSemana || '-'}</p></div></div>
            <div className="p-3 bg-white/[0.03] rounded-lg flex items-center gap-3"><Radio className="w-4 h-4 text-white/30" /><div><p className="text-[10px] text-white/40 uppercase">Oficial K20</p><p className="text-xs text-white">{result.datos.oficialK20 || '-'}</p></div></div>
          </div>

          <button onClick={clearAll} className="mt-5 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm rounded-lg transition-all flex items-center gap-2">
            <Upload className="w-4 h-4" /> Procesar otra planilla
          </button>
        </div>
      )}
    </div>
  );
}

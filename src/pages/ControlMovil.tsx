import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { ClipboardCheck, Plus, Save, Trash2, Pencil, X, Truck, Package, CheckCircle2, XCircle, History, ChevronDown, ChevronUp, Boxes } from 'lucide-react';
import type { EstadoChecklist } from '@contracts/controlMovil';

function detalleMaterial(m: { marca?: string; modelo?: string; serialCodigo?: string }): string {
  const marcaModelo = [m.marca, m.modelo].filter(Boolean).join(' ');
  const partes = [marcaModelo, m.serialCodigo ? `S/N: ${m.serialCodigo}` : ''].filter(Boolean);
  return partes.join(' · ');
}

interface RespuestaChecklist {
  estado: EstadoChecklist | null;
  observacion: string;
}

function FilaChecklistMaterial({
  material, respuesta, onMarcar, onObservacion, indentado,
}: {
  material: { id: string; item?: string; marca?: string; modelo?: string; serialCodigo?: string };
  respuesta: RespuestaChecklist | undefined;
  onMarcar: (materialId: string, estado: EstadoChecklist) => void;
  onObservacion: (materialId: string, observacion: string) => void;
  indentado?: boolean;
}) {
  const detalle = detalleMaterial(material);
  return (
    <div className={`px-2 py-1.5 rounded-lg hover:bg-white/[0.03] ${indentado ? 'ml-5 border-l border-white/10 pl-3' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-sm text-white/80 truncate">{String(material.item || '')}</span>
          {detalle && <span className="block text-xs text-white/40 truncate">{detalle}</span>}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onMarcar(material.id, 'conforme')}
            title="Conforme"
            className={`p-1.5 rounded-lg transition-colors ${respuesta?.estado === 'conforme' ? 'bg-cbvp-green/20 text-cbvp-green' : 'text-white/30 hover:bg-white/10 hover:text-cbvp-green'}`}
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMarcar(material.id, 'no_conforme')}
            title="No conforme"
            className={`p-1.5 rounded-lg transition-colors ${respuesta?.estado === 'no_conforme' ? 'bg-cbvp-red/20 text-cbvp-red-light' : 'text-white/30 hover:bg-white/10 hover:text-cbvp-red-light'}`}
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
      {respuesta?.estado === 'no_conforme' && (
        <input
          type="text"
          value={respuesta.observacion}
          onChange={(e) => onObservacion(material.id, e.target.value)}
          placeholder="Detalle del problema (opcional)"
          className="mt-1.5 w-full bg-white/5 border border-cbvp-red/20 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/30 focus:border-cbvp-red/50 focus:outline-none"
        />
      )}
    </div>
  );
}

export default function ControlMovil() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();
  const { data: movilesData, isLoading: cargandoMoviles } = trpc.moviles.listado.useQuery();
  const { data: sitiosData, isLoading: cargandoSitios } = trpc.controlMovil.listadoSitios.useQuery();
  const { data: materialData } = trpc.materialMenor.listado.useQuery();
  const crearSitioMutation = trpc.controlMovil.crearSitio.useMutation();
  const editarSitioMutation = trpc.controlMovil.editarSitio.useMutation();
  const eliminarSitioMutation = trpc.controlMovil.eliminarSitio.useMutation();
  const guardarChecklistMutation = trpc.controlMovil.guardarChecklist.useMutation();

  const moviles = (movilesData?.moviles || []).filter((m) => m.condicion !== 'De Baja');
  const [movilActivo, setMovilActivo] = useState<string | null>(null);
  const movilId = movilActivo ?? moviles[0]?.id ?? null;
  const movilSeleccionado = moviles.find((m) => m.id === movilId);

  const { data: historialData, isLoading: cargandoHistorial } = trpc.controlMovil.historialChecklists.useQuery(
    { movilId: movilId || '' },
    { enabled: !!movilId }
  );

  const [creando, setCreando] = useState(false);
  const [nuevaDenominacion, setNuevaDenominacion] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editDenominacion, setEditDenominacion] = useState('');
  const [error, setError] = useState('');
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [checklistExpandido, setChecklistExpandido] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState('');

  const [respuestas, setRespuestas] = useState<Record<string, RespuestaChecklist>>({});
  const [kitsExpandidos, setKitsExpandidos] = useState<Record<string, boolean>>({});

  const sitiosMovil = (sitiosData?.sitios || []).filter((s) => s.movilId === movilId);

  const cambiarTab = (id: string) => {
    setMovilActivo(id);
    setCreando(false);
    setEditandoId(null);
    setRespuestas({});
    setKitsExpandidos({});
    setMostrarHistorial(false);
    setMensajeGuardado('');
  };

  const confirmarCrear = async () => {
    if (!movilId) return;
    if (!nuevaDenominacion.trim()) {
      setError('La denominacion es obligatoria.');
      return;
    }
    setError('');
    try {
      const resp = await crearSitioMutation.mutateAsync({ movilId, denominacion: nuevaDenominacion.trim() });
      if (!resp.exito) throw new Error('Error al crear');
      setCreando(false);
      setNuevaDenominacion('');
      utils.controlMovil.listadoSitios.invalidate();
    } catch (err: unknown) {
      setError('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const iniciarEdicion = (id: string, denominacionActual: string) => {
    setEditandoId(id);
    setEditDenominacion(denominacionActual);
  };

  const guardarEdicion = async () => {
    if (!editandoId || !editDenominacion.trim()) return;
    try {
      const resp = await editarSitioMutation.mutateAsync({ id: editandoId, denominacion: editDenominacion.trim() });
      if (!resp.exito) throw new Error('Error al guardar');
      setEditandoId(null);
      utils.controlMovil.listadoSitios.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const eliminarSitio = async (id: string) => {
    if (!confirm('Eliminar este sitio? Los materiales asignados quedaran sin ubicacion.')) return;
    try {
      const resp = await eliminarSitioMutation.mutateAsync({ id });
      if (!resp.exito) throw new Error('Error al eliminar');
      utils.controlMovil.listadoSitios.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const materiales = materialData?.items || [];
  // Los materiales dentro de un kit no se listan sueltos en el sitio: el
  // kit aparece como un grupo y sus items se listan adentro de el.
  const materialesDelSitio = (sitioId: string) => materiales.filter((m) => m.ubicacion === sitioId && !m.kitPadreId);
  const materialesDelKit = (kitId: string) => materiales.filter((m) => m.kitPadreId === kitId);

  const toggleKitExpandido = (kitId: string) => {
    setKitsExpandidos((prev) => ({ ...prev, [kitId]: !prev[kitId] }));
  };

  const marcarEstado = (materialId: string, estado: EstadoChecklist) => {
    setRespuestas((prev) => {
      const actual = prev[materialId];
      // Tocar el mismo estado de nuevo lo deselecciona.
      if (actual?.estado === estado) {
        return { ...prev, [materialId]: { estado: null, observacion: '' } };
      }
      return { ...prev, [materialId]: { estado, observacion: actual?.observacion || '' } };
    });
  };

  const cambiarObservacion = (materialId: string, observacion: string) => {
    setRespuestas((prev) => ({
      ...prev,
      [materialId]: { estado: prev[materialId]?.estado ?? null, observacion },
    }));
  };

  const totalRespondidos = Object.values(respuestas).filter((r) => r.estado).length;

  const guardarChecklist = async () => {
    if (!movilId || !movilSeleccionado) return;
    const items = Object.entries(respuestas)
      .filter(([, r]) => r.estado)
      .map(([materialId, r]) => {
        const material = materiales.find((m) => m.id === materialId);
        const sitio = sitiosMovil.find((s) => s.id === material?.ubicacion);
        const kit = material?.kitPadreId ? materiales.find((m) => m.id === material.kitPadreId) : undefined;
        const item = kit ? `${String(kit.item || 'Kit')} — ${String(material?.item || '')}` : String(material?.item || '');
        return {
          materialId,
          item,
          detalle: material ? detalleMaterial(material) : '',
          sitioId: String(material?.ubicacion || ''),
          sitioDenominacion: String(sitio?.denominacion || ''),
          estado: r.estado as EstadoChecklist,
          observacion: r.observacion.trim(),
        };
      });

    if (items.length === 0) {
      setMensajeGuardado('Marca al menos un material como conforme o no conforme antes de guardar.');
      return;
    }

    try {
      await guardarChecklistMutation.mutateAsync({
        movilId,
        movilCodificacion: String(movilSeleccionado.codificacion || movilId),
        usuario: usuario?.nombreCompleto || '',
        items,
      });
      setRespuestas({});
      setMensajeGuardado(`Checklist guardado (${items.length} material(es) revisado(s)).`);
      utils.controlMovil.historialChecklists.invalidate({ movilId });
    } catch (err: unknown) {
      setMensajeGuardado('Error al guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  if (cargandoMoviles) {
    return <div className="animate-fade-in p-4 text-sm text-white/40">Cargando...</div>;
  }

  if (moviles.length === 0) {
    return (
      <div className="animate-fade-in bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
        <Truck className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <p className="text-white/40 text-sm">No hay moviles en servicio todavia. Anda a Primer Oficial &gt; Material Mayor para agregar uno.</p>
      </div>
    );
  }

  const checklists = historialData?.checklists || [];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap gap-1 bg-white/[0.03] border border-white/10 rounded-2xl p-2">
        {moviles.map((m) => (
          <button
            key={m.id}
            onClick={() => cambiarTab(m.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${movilId === m.id ? 'bg-cbvp-red text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            {String(m.codificacion || m.id)}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-cbvp-red" /> Sitios del Movil
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMostrarHistorial((v) => !v)}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg text-xs flex items-center gap-2 transition-colors"
            >
              <History className="w-3.5 h-3.5" /> Historial
            </button>
            {!creando && (
              <button onClick={() => { setCreando(true); setNuevaDenominacion(''); setError(''); }} className="px-3 py-2 bg-cbvp-blue/10 hover:bg-cbvp-blue/20 text-cbvp-blue rounded-lg text-xs flex items-center gap-2 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar Sitio
              </button>
            )}
          </div>
        </div>

        {mostrarHistorial && (
          <div className="border border-white/10 rounded-xl p-4 mb-4 bg-white/[0.02]">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Checklists guardados</h3>
            {cargandoHistorial ? (
              <p className="text-sm text-white/40">Cargando...</p>
            ) : checklists.length === 0 ? (
              <p className="text-sm text-white/40">Todavia no se guardo ningun checklist para este movil.</p>
            ) : (
              <div className="space-y-2">
                {checklists.map((c) => {
                  const expandido = checklistExpandido === c.id;
                  return (
                    <div key={c.id} className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setChecklistExpandido(expandido ? null : c.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                      >
                        <span className="text-sm text-white/80 min-w-0 truncate">
                          {String(c.fechaLegible || '')} <span className="text-white/40">— {String(c.usuario || 'Sin usuario')}</span>
                        </span>
                        <span className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="flex items-center gap-1 text-cbvp-green"><CheckCircle2 className="w-3.5 h-3.5" /> {Number(c.totalConforme || 0)}</span>
                          <span className="flex items-center gap-1 text-cbvp-red-light"><XCircle className="w-3.5 h-3.5" /> {Number(c.totalNoConforme || 0)}</span>
                          {expandido ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
                        </span>
                      </button>
                      {expandido && (
                        <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
                          {(c.items as Array<Record<string, unknown>> || []).map((it, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                              {it.estado === 'conforme' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-cbvp-green shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-cbvp-red-light shrink-0 mt-0.5" />
                              )}
                              <span className="min-w-0">
                                <span className="text-white/70">{String(it.item || '')}</span>
                                <span className="text-white/30"> · {String(it.sitioDenominacion || '')}</span>
                                {!!it.observacion && (
                                  <span className="block text-white/40 italic">{String(it.observacion)}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {creando && (
          <div className="border border-white/10 rounded-xl p-4 mb-4 bg-white/[0.02]">
            <label className="text-xs text-white/40 mb-1 block">Denominacion</label>
            <input
              type="text"
              autoFocus
              value={nuevaDenominacion}
              onChange={(e) => setNuevaDenominacion(e.target.value)}
              placeholder="Ej: Compartimento lateral derecho"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none mb-3"
            />
            {error && <div className="text-sm text-cbvp-red-light mb-3">{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setCreando(false); setError(''); }} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm">Cancelar</button>
              <button onClick={confirmarCrear} disabled={crearSitioMutation.isPending} className="flex-1 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        )}

        {cargandoSitios ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : sitiosMovil.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay sitios registrados para este movil todavia.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sitiosMovil.map((s) => {
              const materialesSitio = materialesDelSitio(s.id);
              return (
                <div key={s.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                  {editandoId === s.id ? (
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        autoFocus
                        value={editDenominacion}
                        onChange={(e) => setEditDenominacion(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={guardarEdicion} className="flex-1 p-1.5 bg-cbvp-green/20 hover:bg-cbvp-green/30 text-cbvp-green rounded-lg transition-colors flex items-center justify-center"><Save className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditandoId(null)} className="flex-1 p-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/5">
                      <span className="text-sm text-white font-medium truncate">{String(s.denominacion || '')}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => iniciarEdicion(s.id, String(s.denominacion || ''))} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => eliminarSitio(s.id)} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}

                  {materialesSitio.length === 0 ? (
                    <p className="text-xs text-white/30 flex items-center gap-2"><Package className="w-3.5 h-3.5" /> Sin materiales asignados a este sitio.</p>
                  ) : (
                    <div className="space-y-2">
                      {materialesSitio.map((m) => {
                        if (!m.esKit) {
                          return (
                            <FilaChecklistMaterial
                              key={m.id}
                              material={m}
                              respuesta={respuestas[m.id]}
                              onMarcar={marcarEstado}
                              onObservacion={cambiarObservacion}
                            />
                          );
                        }
                        const contenido = materialesDelKit(m.id);
                        const expandido = !!kitsExpandidos[m.id];
                        return (
                          <div key={m.id} className="border border-cbvp-blue/10 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleKitExpandido(m.id)}
                              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-cbvp-blue/5 hover:bg-cbvp-blue/10 transition-colors text-left"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <Boxes className="w-4 h-4 text-cbvp-blue shrink-0" />
                                <span className="text-sm text-white/80 truncate">{String(m.item || '')}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cbvp-blue/10 text-cbvp-blue shrink-0">{contenido.length} item(s)</span>
                              </span>
                              {expandido ? <ChevronUp className="w-3.5 h-3.5 text-white/40 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" />}
                            </button>
                            {expandido && (
                              <div className="p-2 space-y-2">
                                {contenido.length === 0 ? (
                                  <p className="text-xs text-white/30 pl-3">Este kit todavia no tiene materiales cargados.</p>
                                ) : (
                                  contenido.map((h) => (
                                    <FilaChecklistMaterial
                                      key={h.id}
                                      material={h}
                                      respuesta={respuestas[h.id]}
                                      onMarcar={marcarEstado}
                                      onObservacion={cambiarObservacion}
                                      indentado
                                    />
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sitiosMovil.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-3">
            <span className="text-xs text-white/40">
              {totalRespondidos > 0 ? `${totalRespondidos} material(es) marcado(s)` : 'Marca conforme o no conforme en los materiales revisados'}
            </span>
            <div className="flex items-center gap-3">
              {mensajeGuardado && <span className="text-xs text-white/50">{mensajeGuardado}</span>}
              <button
                onClick={guardarChecklist}
                disabled={guardarChecklistMutation.isPending || totalRespondidos === 0}
                className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Guardar Checklist
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

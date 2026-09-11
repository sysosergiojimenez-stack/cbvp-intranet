import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { ClipboardCheck, Plus, Save, Trash2, Pencil, X, Truck, Package } from 'lucide-react';

export default function ControlMovil() {
  const utils = trpc.useUtils();
  const { data: movilesData, isLoading: cargandoMoviles } = trpc.moviles.listado.useQuery();
  const { data: sitiosData, isLoading: cargandoSitios } = trpc.controlMovil.listadoSitios.useQuery();
  const { data: materialData } = trpc.materialMenor.listado.useQuery();
  const crearSitioMutation = trpc.controlMovil.crearSitio.useMutation();
  const editarSitioMutation = trpc.controlMovil.editarSitio.useMutation();
  const eliminarSitioMutation = trpc.controlMovil.eliminarSitio.useMutation();
  const marcarVerificadoMutation = trpc.materialMenor.marcarVerificado.useMutation();

  const moviles = movilesData?.moviles || [];
  const [movilActivo, setMovilActivo] = useState<string | null>(null);
  const movilId = movilActivo ?? moviles[0]?.id ?? null;

  const [creando, setCreando] = useState(false);
  const [nuevaDenominacion, setNuevaDenominacion] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editDenominacion, setEditDenominacion] = useState('');
  const [error, setError] = useState('');

  const sitiosMovil = (sitiosData?.sitios || []).filter((s) => s.movilId === movilId);

  const cambiarTab = (id: string) => {
    setMovilActivo(id);
    setCreando(false);
    setEditandoId(null);
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
  const materialesDelSitio = (sitioId: string) => materiales.filter((m) => m.ubicacion === sitioId);

  const toggleVerificado = async (id: string, verificadoActual: boolean) => {
    try {
      await marcarVerificadoMutation.mutateAsync({ id, verificado: !verificadoActual });
      utils.materialMenor.listado.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  if (cargandoMoviles) {
    return <div className="animate-fade-in p-4 text-sm text-white/40">Cargando...</div>;
  }

  if (moviles.length === 0) {
    return (
      <div className="animate-fade-in bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
        <Truck className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <p className="text-white/40 text-sm">No hay moviles cargados todavia. Anda a Primer Oficial &gt; Material Mayor para agregar uno.</p>
      </div>
    );
  }

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
          {!creando && (
            <button onClick={() => { setCreando(true); setNuevaDenominacion(''); setError(''); }} className="px-3 py-2 bg-cbvp-blue/10 hover:bg-cbvp-blue/20 text-cbvp-blue rounded-lg text-xs flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar Sitio
            </button>
          )}
        </div>

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
                    <div className="space-y-1.5">
                      {materialesSitio.map((m) => (
                        <label key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!m.verificado}
                            onChange={() => toggleVerificado(m.id, !!m.verificado)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-cbvp-red focus:ring-cbvp-red/50 shrink-0"
                          />
                          <span className={`text-sm truncate ${m.verificado ? 'text-white/40 line-through' : 'text-white/80'}`}>{String(m.item || '')}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { FileSpreadsheet, Plus, Trash2, ChevronRight } from 'lucide-react';

export default function Comparativos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: listadoData, isLoading } = trpc.comparativos.listado.useQuery();
  const comparativos = listadoData?.exito ? listadoData.comparativos : [];

  const crearMutation = trpc.comparativos.crear.useMutation();
  const eliminarMutation = trpc.comparativos.eliminar.useMutation();

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [nombrePrimeraHoja, setNombrePrimeraHoja] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const handleCrear = async () => {
    setError('');
    if (!nombre.trim()) { setError('Completa el nombre del comparativo.'); return; }
    if (!nombrePrimeraHoja.trim()) { setError('Completa el nombre de la primera pestaña.'); return; }

    setGuardando(true);
    try {
      const res = await crearMutation.mutateAsync({
        nombre: nombre.trim(),
        nombrePrimeraHoja: nombrePrimeraHoja.trim(),
        creadoPor: usuario?.codigo || '',
      });
      utils.comparativos.listado.invalidate();
      navigate(`/comparativos/${res.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string, nombreComparativo: string) => {
    if (!confirm(`Eliminar el comparativo "${nombreComparativo}"? Se borran todas sus pestañas e items.`)) return;
    await eliminarMutation.mutateAsync({ id });
    utils.comparativos.listado.invalidate();
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cbvp-red" /> Comparativos de Compras
          </h2>
          <button
            onClick={() => setMostrarNuevo((v) => !v)}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Comparativo
          </button>
        </div>
        <p className="text-xs text-white/30 mb-4">
          Compara precios de items entre distintos proveedores, organizados por pestañas (ej. "Desembolso MASU2026").
        </p>

        {mostrarNuevo && (
          <div className="mb-4 p-4 bg-white/[0.02] border border-white/10 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Nombre del Comparativo</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Desembolso MASU2026" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Nombre de la Primera Pestaña</label>
                <input type="text" value={nombrePrimeraHoja} onChange={(e) => setNombrePrimeraHoja(e.target.value)} placeholder="Ej. Mangas y Accesorios" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
            </div>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button onClick={handleCrear} disabled={guardando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> {guardando ? 'Creando...' : 'Crear Comparativo'}
              </button>
              <button onClick={() => setMostrarNuevo(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : comparativos.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Todavia no hay comparativos. Crea el primero con el boton de arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nombre</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha de Creacion</th>
                  <th className="text-center px-2 py-2 font-medium text-white/50">Pestañas</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {comparativos.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/comparativos/${c.id}`)}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                  >
                    <td className="px-2 py-2 text-white/80 whitespace-nowrap">{c.nombre}</td>
                    <td className="px-2 py-2 text-white/50 whitespace-nowrap">{c.fechaCreacion ? new Date(c.fechaCreacion).toLocaleDateString('es-PY') : '-'}</td>
                    <td className="px-2 py-2 text-white/60 text-center whitespace-nowrap">{c.cantidadHojas}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleEliminar(c.id, c.nombre); }} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/30 hover:text-cbvp-red transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-white/20" />
                      </div>
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

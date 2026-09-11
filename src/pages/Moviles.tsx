import { useState, Fragment } from 'react';
import { trpc } from '@/providers/trpc';
import { Truck, Plus, Save, Trash2, RotateCcw, ExternalLink } from 'lucide-react';
import { CONDICIONES_MOVIL_VALIDAS } from '@contracts/condicionMovil';

interface MovilForm {
  codificacion: string;
  tipo: string;
  procedencia: string;
  anioAdquisicion: string;
  marca: string;
  modelo: string;
  anio: string;
  chasis: string;
  matricula: string;
  foto: string;
  condicion: string;
  tipoCombustible: string;
}

const movilVacio: MovilForm = {
  codificacion: '', tipo: '', procedencia: '', anioAdquisicion: '', marca: '', modelo: '',
  anio: '', chasis: '', matricula: '', foto: '', condicion: '', tipoCombustible: '',
};

const CAMPOS: { key: keyof MovilForm; label: string }[] = [
  { key: 'codificacion', label: 'Codificacion' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'procedencia', label: 'Procedencia' },
  { key: 'anioAdquisicion', label: 'Anio de Adquisicion' },
  { key: 'marca', label: 'Marca' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'anio', label: 'Anio' },
  { key: 'chasis', label: 'Chasis' },
  { key: 'matricula', label: 'Matricula' },
  { key: 'tipoCombustible', label: 'Tipo de Combustible' },
  { key: 'foto', label: 'Foto (URL)' },
];

function FormularioMovil({ valor, onChange }: { valor: MovilForm; onChange: (campo: keyof MovilForm, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div>
        <label className="text-xs text-white/40 mb-1 block">Condicion</label>
        <select
          value={valor.condicion}
          onChange={(e) => onChange('condicion', e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
        >
          <option value="">-- Seleccionar --</option>
          {!(CONDICIONES_MOVIL_VALIDAS as readonly string[]).includes(valor.condicion) && valor.condicion && (
            <option value={valor.condicion}>{valor.condicion} (anterior)</option>
          )}
          {CONDICIONES_MOVIL_VALIDAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {CAMPOS.map(({ key, label }) => (
        <div key={key} className={key === 'foto' ? 'col-span-2 md:col-span-4' : ''}>
          <label className="text-xs text-white/40 mb-1 block">{label}</label>
          <input
            type="text"
            value={valor[key]}
            onChange={(e) => onChange(key, e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
          />
        </div>
      ))}
    </div>
  );
}

export default function Moviles() {
  const utils = trpc.useUtils();
  const { data: listadoData, isLoading } = trpc.moviles.listado.useQuery();
  const crearMutation = trpc.moviles.crear.useMutation();
  const editarMutation = trpc.moviles.editar.useMutation();
  const eliminarMutation = trpc.moviles.eliminar.useMutation();

  const [creando, setCreando] = useState(false);
  const [nuevoMovil, setNuevoMovil] = useState<MovilForm>({ ...movilVacio });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MovilForm>({ ...movilVacio });
  const [error, setError] = useState('');

  const iniciarEdicion = (m: MovilForm & { id: string }) => {
    setEditandoId(m.id);
    setEditForm({
      codificacion: m.codificacion, tipo: m.tipo, procedencia: m.procedencia,
      anioAdquisicion: m.anioAdquisicion, marca: m.marca, modelo: m.modelo, anio: m.anio,
      chasis: m.chasis, matricula: m.matricula, foto: m.foto, condicion: m.condicion,
      tipoCombustible: m.tipoCombustible,
    });
  };

  const confirmarCrear = async () => {
    if (!nuevoMovil.codificacion.trim()) {
      setError('La codificacion es obligatoria.');
      return;
    }
    if (!nuevoMovil.condicion) {
      setError('Selecciona la condicion del movil antes de guardar.');
      return;
    }
    setError('');
    try {
      const resp = await crearMutation.mutateAsync({ ...nuevoMovil, condicion: nuevoMovil.condicion as (typeof CONDICIONES_MOVIL_VALIDAS)[number] });
      if (!resp.exito) throw new Error('Error al crear');
      setCreando(false);
      setNuevoMovil({ ...movilVacio });
      utils.moviles.listado.invalidate();
    } catch (err: unknown) {
      setError('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const guardarEdicion = async () => {
    if (editandoId === null) return;
    if (!editForm.condicion) {
      alert('Selecciona la condicion del movil antes de guardar.');
      return;
    }
    try {
      const resp = await editarMutation.mutateAsync({ id: editandoId, ...editForm, condicion: editForm.condicion as (typeof CONDICIONES_MOVIL_VALIDAS)[number] });
      if (!resp.exito) throw new Error('Error al guardar');
      setEditandoId(null);
      utils.moviles.listado.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const eliminarMovil = async (id: string) => {
    if (!confirm('Eliminar este movil?')) return;
    try {
      const resp = await eliminarMutation.mutateAsync({ id });
      if (!resp.exito) throw new Error('Error al eliminar');
      utils.moviles.listado.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-cbvp-red" /> Material Mayor
          </h2>
          {!creando && (
            <button onClick={() => setCreando(true)} className="px-3 py-2 bg-cbvp-blue/10 hover:bg-cbvp-blue/20 text-cbvp-blue rounded-lg text-xs flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar Movil
            </button>
          )}
        </div>

        {creando && (
          <div className="border border-white/10 rounded-xl p-4 mb-4 bg-white/[0.02] space-y-4">
            <FormularioMovil valor={nuevoMovil} onChange={(campo, v) => setNuevoMovil({ ...nuevoMovil, [campo]: v })} />
            {error && <div className="text-sm text-cbvp-red-light">{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setCreando(false); setNuevoMovil({ ...movilVacio }); setError(''); }} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Cancelar</button>
              <button onClick={confirmarCrear} disabled={crearMutation.isPending} className="flex-1 py-2.5 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Guardar Movil
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : !listadoData?.moviles || listadoData.moviles.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay moviles registrados todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm block sm:table">
              <thead className="hidden sm:table-header-group">
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-3 py-2 font-medium text-white/50">Codificacion</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Marca / Modelo</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Anio</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Condicion</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Combustible</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Acciones</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group">
                {listadoData.moviles.map((m) => (
                  <Fragment key={m.id}>
                    <tr onClick={() => iniciarEdicion(m)} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer block sm:table-row mb-2 sm:mb-0 bg-white/[0.02] sm:bg-transparent rounded-lg sm:rounded-none p-2 sm:p-0">
                      <td className="px-3 py-2 text-white font-medium block sm:table-cell">{m.codificacion || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Tipo: </span>{m.tipo || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Marca/Modelo: </span>{[m.marca, m.modelo].filter(Boolean).join(' ') || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Anio: </span>{m.anio || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Condicion: </span>{m.condicion || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Combustible: </span>{m.tipoCombustible || '-'}</td>
                      <td className="px-3 py-2 block sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 pt-1.5 sm:pt-0 mt-1 sm:mt-0 border-t border-white/5 sm:border-0">
                          <button onClick={() => eliminarMovil(m.id)} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          {m.foto && (
                            <a href={m.foto} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-cbvp-blue transition-colors" title="Ver foto"><ExternalLink className="w-3.5 h-3.5" /></a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editandoId === m.id && (
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <td colSpan={7} className="px-3 py-4">
                          <FormularioMovil valor={editForm} onChange={(campo, v) => setEditForm({ ...editForm, [campo]: v })} />
                          <div className="flex gap-2 mt-3">
                            <button onClick={guardarEdicion} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
                            <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
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

import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { Shield, Plus, X } from 'lucide-react';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function RolesGuardia() {
  const hoy = new Date();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mesInicio, setMesInicio] = useState(hoy.getMonth() + 1);
  const [anioInicio, setAnioInicio] = useState(hoy.getFullYear());
  const [creando, setCreando] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.rolesGuardia.listar.useQuery();
  const crearMutation = trpc.rolesGuardia.crear.useMutation({
    onSuccess: () => {
      utils.rolesGuardia.listar.invalidate();
      setMostrarForm(false);
      setCreando(false);
    },
    onError: () => setCreando(false),
  });

  const handleCrear = () => {
    setCreando(true);
    crearMutation.mutate({ mesInicio, anioInicio });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-cbvp-red" /> Roles de Guardia
          </h2>
          <button onClick={() => setMostrarForm(true)} className="px-4 py-2 bg-cbvp-red hover:bg-cbvp-red/80 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo Rol de Guardia
          </button>
        </div>

        {mostrarForm && (
          <div className="mb-6 p-4 bg-white/[0.02] border border-white/10 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/80">Crear nuevo Rol de Guardia</h3>
              <button onClick={() => setMostrarForm(false)} className="p-1 rounded-lg hover:bg-white/10 text-white/50">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-white/40 text-xs mb-3">El rol abarca el mes elegido y el siguiente (bimensual).</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Mes de inicio</label>
                <select value={mesInicio} onChange={e => setMesInicio(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
                  {MESES.map((nombre, idx) => (
                    <option key={idx} value={idx + 1}>{nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Año de inicio</label>
                <select value={anioInicio} onChange={e => setAnioInicio(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
                  {Array.from({ length: 3 }, (_, i) => hoy.getFullYear() - 1 + i).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleCrear} disabled={creando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm transition-colors">
                {creando ? 'Creando...' : 'Crear Rol de Guardia'}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-6 text-white/40 text-sm">Cargando...</div>
        ) : !data?.roles || data.roles.length === 0 ? (
          <div className="text-center py-6 text-white/40 text-sm">Todavia no hay Roles de Guardia creados.</div>
        ) : (
          <div className="space-y-2">
            {data.roles.map((rol) => (
              <div key={rol.id} className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer">
                <div>
                  <div className="text-white font-medium text-sm">{rol.etiqueta}</div>
                  <div className="text-white/40 text-xs">Creado el {rol.fechaCreacion}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

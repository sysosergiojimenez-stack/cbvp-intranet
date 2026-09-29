import { NavLink } from 'react-router-dom';
import { ShieldCheck, Flame, ChevronRight } from 'lucide-react';

const SUBMODULOS = [
  {
    title: 'Informe de Servicios',
    description: 'Carga y seguimiento de informes de incendios y servicios de la compania.',
    icon: Flame,
    path: '/informe-servicios',
    color: 'text-cbvp-red',
    bg: 'bg-cbvp-red/8',
    border: 'border-cbvp-red/15 hover:border-cbvp-red/30',
  },
];

export default function ComandanteCompania() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-cbvp-red/8 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-cbvp-red" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Comandante de Compania</h1>
          <p className="text-xs text-white/40">Elegi un submodulo para continuar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUBMODULOS.map((mod) => (
          <NavLink key={mod.path} to={mod.path} className={`glass rounded-xl p-4 border ${mod.border} card-hover cursor-pointer block`}>
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}>
                <mod.icon className={`w-5 h-5 ${mod.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">{mod.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{mod.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 shrink-0 mt-1" />
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

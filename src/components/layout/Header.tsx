import { useLocation } from 'react-router-dom';
import { Bell, UserCircle, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Resumen general del sistema' },
  '/planillas': { title: 'Planillas de Guardia', subtitle: 'Carga y procesamiento de planillas' },
  '/historial': { title: 'Historial de Planillas', subtitle: 'Registro historico de guardias' },
  '/personal': { title: 'Personal', subtitle: 'Listado de bomberos voluntarios' },
  '/configuracion': { title: 'Configuracion', subtitle: 'Ajustes del sistema' },
};

export default function Header() {
  const location = useLocation();
  const { usuario } = useAuth();
  const page = PAGE_TITLES[location.pathname] || { title: 'CBVP', subtitle: '' };

  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
      <div>
        <h1 className="text-xl font-bold text-white">{page.title}</h1>
        <p className="text-xs text-white/40 mt-0.5">{page.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cbvp-red rounded-full" />
        </button>

        {/* User pill */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5">
          <div className="w-7 h-7 rounded-full bg-cbvp-red/10 flex items-center justify-center">
            <UserCircle className="w-4 h-4 text-cbvp-red/70" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-white leading-tight">{usuario?.nombreCompleto}</span>
            <span className="text-[10px] text-white/30 leading-tight flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              {usuario?.rango}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

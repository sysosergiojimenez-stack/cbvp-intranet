import { NavLink } from 'react-router-dom';
import { usePermiso } from '@/hooks/usePermiso';
import { PERSONAL_DATA } from '@/data/mockData';
import {
  Users, ClipboardList, Truck, CalendarDays,
  Flame, TrendingUp, Activity, AlertTriangle,
  ChevronRight
} from 'lucide-react';

const stats = [
  { label: 'Bomberos Activos', value: PERSONAL_DATA.length.toString(), icon: Users, color: 'text-cbvp-red', bg: 'bg-cbvp-red/10' },
  { label: 'Planillas Hoy', value: '2', icon: ClipboardList, color: 'text-cbvp-green', bg: 'bg-cbvp-green/10' },
  { label: 'Moviles en Servicio', value: '3/5', icon: Truck, color: 'text-cbvp-blue', bg: 'bg-cbvp-blue/10' },
  { label: 'Guardias del Mes', value: '42', icon: CalendarDays, color: 'text-cbvp-orange', bg: 'bg-cbvp-orange/10' },
];

const modules = [
  {
    title: 'Planillas de Guardia',
    description: 'Carga y procesamiento automatico de planillas mediante IA (Gemini).',
    icon: ClipboardList,
    path: '/planillas',
    color: 'text-cbvp-red',
    bg: 'bg-cbvp-red/10',
    border: 'hover:border-cbvp-red/30',
  },
  {
    title: 'Gestion de Personal',
    description: 'Directorio completo, historial de guardias y documentacion.',
    icon: Users,
    path: '/personal',
    color: 'text-cbvp-red',
    bg: 'bg-cbvp-red/10',
    border: 'hover:border-cbvp-red/30',
  },
  {
    title: 'Control de Moviles',
    description: 'Seguimiento de vehiculos, kilometraje y mantenimientos.',
    icon: Truck,
    path: '/moviles',
    color: 'text-white/40',
    bg: 'bg-white/5',
    border: 'hover:border-white/10',
    disabled: true,
  },
  {
    title: 'Reportes',
    description: 'Informes mensuales y estadisticas operativas.',
    icon: TrendingUp,
    path: '/reportes',
    color: 'text-white/40',
    bg: 'bg-white/5',
    border: 'hover:border-white/10',
    disabled: true,
  },
];

const recentActivity = [
  { title: 'Planilla procesada', desc: 'Grupo A - 19/01/2026', time: 'Hace 2h', type: 'success' },
  { title: 'Servicio de emergencia', desc: 'Incendio residencial - Zona Norte', time: 'Hace 5h', type: 'alert' },
  { title: 'Mantenimiento preventivo', desc: 'AB-201 - Revision completa', time: 'Hace 8h', type: 'info' },
  { title: 'Nuevo bombero registrado', desc: 'C-1016/25 - Juan Carlos Paez', time: 'Ayer', type: 'success' },
];

export default function Dashboard() {
  const permisos = usePermiso();

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-PY', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const accessibleModules = modules.filter(m => {
    if (m.disabled) return false;
    if (m.path === '/planillas') return permisos.puedeCargarPlanillas;
    if (m.path === '/personal') return permisos.puedeVerPersonal;
    return permisos.puedeVerTodo;
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-white/40 mt-1 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cbvp-red/10 border border-cbvp-red/20">
          <Flame className="w-4 h-4 text-cbvp-red" />
          <span className="text-xs text-cbvp-red font-medium">20ma Compania - Mercado 4</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <Activity className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
              </div>
              <h3 className="text-xs text-white/40 uppercase tracking-wide mb-1">{stat.label}</h3>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ChevronRight className="w-5 h-5 text-cbvp-red" />
            Modulos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accessibleModules.map(mod => {
              const Icon = mod.icon;
              return (
                <NavLink
                  key={mod.path}
                  to={mod.path}
                  className={`bg-white/[0.03] border border-white/5 rounded-xl p-6 transition-all hover:bg-white/[0.05] ${mod.border} group`}
                >
                  <div className={`w-11 h-11 rounded-lg ${mod.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${mod.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1.5 group-hover:text-cbvp-red transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-white/40 leading-relaxed">{mod.description}</p>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ChevronRight className="w-5 h-5 text-cbvp-red" />
            Actividad Reciente
          </h2>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl divide-y divide-white/5">
            {recentActivity.map((act, i) => (
              <div key={i} className="p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    act.type === 'success' ? 'bg-cbvp-green' :
                    act.type === 'alert' ? 'bg-cbvp-red-light' : 'bg-cbvp-blue'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{act.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{act.desc}</p>
                    <p className="text-[10px] text-white/25 mt-1">{act.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Alert */}
          <div className="mt-4 bg-cbvp-orange/5 border border-cbvp-orange/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-cbvp-orange shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-cbvp-orange">Recordatorio</p>
              <p className="text-xs text-white/40 mt-1">
                Proxima capacitacion: Manejo de materiales peligrosos - 25/01/2026 a las 09:00.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

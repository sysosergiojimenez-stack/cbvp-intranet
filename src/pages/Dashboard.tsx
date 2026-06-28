import { NavLink } from 'react-router-dom';
import { usePermiso } from '@/hooks/usePermiso';
import { trpc } from '@/providers/trpc';
import {
  Users, ClipboardList, Truck, CalendarDays,
  Flame, TrendingUp, ChevronRight, Shield,
  Clock, Award, Zap
} from 'lucide-react';

export default function Dashboard() {
  const { puedeCargarPlanillas, puedeVerPersonal, puedeVerHistorial } = usePermiso();

  const { data: personalData } = trpc.personal.listado.useQuery(undefined, {
    retry: 1, refetchOnWindowFocus: false,
  });
  const { data: historialData } = trpc.planillas.historial.useQuery(undefined, {
    retry: 1, refetchOnWindowFocus: false,
  });

  const totalPersonal = personalData?.personal?.length || 0;
  const totalPlanillas = historialData?.exito ? historialData.planillas.length : 0;

  // Count planillas this month
  const now = new Date();
  const thisMonth = historialData?.exito
    ? historialData.planillas.filter(p => {
        try {
          const [d, m, y] = p.fechaGuardia.split('/');
          return parseInt(m) === (now.getMonth() + 1) && parseInt(y) === now.getFullYear();
        } catch { return false; }
      }).length
    : 0;

  const activos = personalData?.personal?.filter(p => p.categoria?.toUpperCase() === 'ACTIVO').length || 0;
  const combatientes = personalData?.personal?.filter(p => p.categoria?.toUpperCase() === 'COMBATIENTE').length || 0;

  const stats = [
    { label: 'Total de Bomberos', value: totalPersonal.toString(), icon: Users, color: 'text-cbvp-yellow', bg: 'bg-cbvp-yellow/8', border: 'border-cbvp-yellow/20', bar: 'bg-cbvp-yellow' },
    { label: 'Categoria Activo', value: activos.toString(), icon: Shield, color: 'text-cbvp-green', bg: 'bg-cbvp-green/8', border: 'border-cbvp-green/20', bar: 'bg-cbvp-green' },
    { label: 'Categoria Combatiente', value: combatientes.toString(), icon: Flame, color: 'text-cbvp-red', bg: 'bg-cbvp-red/8', border: 'border-cbvp-red/20', bar: 'bg-cbvp-red' },
  ];

  const modules = [
    {
      title: 'Planillas de Guardia',
      description: 'Carga y procesamiento automatico de planillas mediante IA (Gemini).',
      icon: ClipboardList,
      path: '/planillas',
      access: puedeCargarPlanillas,
      color: 'text-cbvp-red',
      bg: 'bg-cbvp-red/8',
      border: 'border-cbvp-red/15 hover:border-cbvp-red/30',
      badge: 'IA Powered',
      badgeColor: 'bg-cbvp-red/15 text-cbvp-red',
    },
    {
      title: 'Gestion de Personal',
      description: 'Directorio completo de bomberos voluntarios con filtros y busqueda.',
      icon: Users,
      path: '/personal',
      access: puedeVerPersonal,
      color: 'text-cbvp-green',
      bg: 'bg-cbvp-green/8',
      border: 'border-cbvp-green/15 hover:border-cbvp-green/30',
      badge: `${totalPersonal} activos`,
      badgeColor: 'bg-cbvp-green/15 text-cbvp-green',
    },
    {
      title: 'Historial',
      description: 'Registro historico completo de todas las guardias procesadas.',
      icon: CalendarDays,
      path: '/historial',
      access: puedeVerHistorial,
      color: 'text-cbvp-orange',
      bg: 'bg-cbvp-orange/8',
      border: 'border-cbvp-orange/15 hover:border-cbvp-orange/30',
      badge: `${totalPlanillas} registros`,
      badgeColor: 'bg-cbvp-orange/15 text-cbvp-orange',
    },
    {
      title: 'Reportes',
      description: 'Informes mensuales, estadisticas operativas y analisis de asistencia.',
      icon: TrendingUp,
      path: '/reportes',
      access: false,
      color: 'text-white/30',
      bg: 'bg-white/5',
      border: 'border-white/5',
      badge: 'Proximamente',
      badgeColor: 'bg-white/5 text-white/30',
      disabled: true,
    },
  ];

  const recentActivity = historialData?.exito
    ? historialData.planillas.slice(0, 5).map(p => ({
        id: p.idPlanilla,
        fecha: p.fechaGuardia,
        grupo: p.grupo,
        time: p.fechaCarga,
      }))
    : [];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s, i) => (
          <div key={i} className={`relative overflow-hidden glass rounded-xl p-4 border ${s.border} card-hover`}>
            {/* Color bar at top */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${s.bar}`} />
            <div className="flex items-center gap-3 mt-1">
              <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <span className="text-3xl font-bold text-white">{s.value}</span>
                <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Modules */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Modulos</h2>
          {modules.map((mod, i) => {
            const content = (
              <div
                key={i}
                className={`glass rounded-xl p-4 border ${mod.border} card-hover ${mod.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}>
                    <mod.icon className={`w-5 h-5 ${mod.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white">{mod.title}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mod.badgeColor}`}>{mod.badge}</span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{mod.description}</p>
                  </div>
                  {!mod.disabled && <ChevronRight className="w-4 h-4 text-white/20 shrink-0 mt-1" />}
                </div>
              </div>
            );

            if (mod.disabled || !mod.access) return <div key={i}>{content}</div>;
            return <NavLink key={i} to={mod.path}>{content}</NavLink>;
          })}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Recent activity */}
          <div className="glass rounded-xl p-4 border border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cbvp-red/60" />
              Actividad Reciente
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4">No hay actividad reciente</p>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-cbvp-red/8 flex items-center justify-center shrink-0">
                      <Shield className="w-3.5 h-3.5 text-cbvp-red/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">Guardia {act.grupo}</p>
                      <p className="text-[10px] text-white/30">{act.fecha}</p>
                    </div>
                    <span className="text-[10px] text-white/20 shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick info */}
          <div className="glass rounded-xl p-4 border border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-cbvp-orange/60" />
              20ma Compania
            </h3>
            <div className="space-y-2.5 text-xs text-white/40">
              <div className="flex justify-between">
                <span>Sede</span>
                <span className="text-white/60">Mercado 4, Asuncion</span>
              </div>
              <div className="flex justify-between">
                <span>Fundacion</span>
                <span className="text-white/60">15 de Agosto de 1985</span>
              </div>
              <div className="flex justify-between">
                <span>Jurisdiccion</span>
                <span className="text-white/60">Mercado 4 y zonas aledanas</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="glass rounded-xl p-4 border border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cbvp-green/60" />
              Estado del Sistema
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cbvp-green" />
                <span className="text-xs text-white/50">API Backend</span>
                <span className="text-[10px] text-cbvp-green ml-auto">Online</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cbvp-green" />
                <span className="text-xs text-white/50">Google Sheets</span>
                <span className="text-[10px] text-cbvp-green ml-auto">Conectado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cbvp-green" />
                <span className="text-xs text-white/50">Gemini AI</span>
                <span className="text-[10px] text-cbvp-green ml-auto">Activo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermiso } from '@/hooks/usePermiso';
import {
  Flame, LayoutDashboard, ClipboardList, History,
  Users, Truck, CalendarDays, BarChart3, Settings,
  LogOut, ChevronLeft, ChevronRight, Shield, UserCircle
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  checkAccess: (permisos: ReturnType<typeof usePermiso>) => boolean;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, checkAccess: p => p.puedeVerTodo },
  { path: '/planillas', label: 'Planillas de Guardia', icon: ClipboardList, checkAccess: p => p.puedeCargarPlanillas },
  { path: '/historial', label: 'Historial', icon: History, checkAccess: p => p.puedeVerHistorial },
  { path: '/personal', label: 'Personal', icon: Users, checkAccess: p => p.puedeVerPersonal },
  { path: '/moviles', label: 'Moviles', icon: Truck, checkAccess: () => false, disabled: true },
  { path: '/guardias', label: 'Guardias', icon: CalendarDays, checkAccess: () => false, disabled: true },
  { path: '/reportes', label: 'Reportes', icon: BarChart3, checkAccess: () => false, disabled: true },
  { path: '/configuracion', label: 'Configuracion', icon: Settings, checkAccess: p => p.puedeConfiguracion },
];

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const permisos = usePermiso();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.disabled) return false;
    return item.checkAccess(permisos);
  });

  return (
    <div className="flex min-h-screen bg-cbvp-dark">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 bg-cbvp-dark-light border-r border-white/5 flex flex-col transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-[260px]'
        }`}
      >
        {/* Brand */}
        <div className={`flex items-center border-b border-white/5 ${collapsed ? 'justify-center px-2 py-5' : 'px-6 py-5'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cbvp-red/10 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-cbvp-red" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight leading-tight">CBVP</h2>
                <p className="text-[10px] text-white/40 leading-tight">20ma Compania - Mercado 4</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                  isActive
                    ? 'bg-cbvp-red/10 text-white border-l-2 border-cbvp-red'
                    : 'text-white/50 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-2 mb-2 flex items-center justify-center py-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* User info */}
        <div className={`border-t border-white/5 bg-cbvp-dark/50 ${collapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-cbvp-red/10 flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5 text-cbvp-red/70" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{usuario?.nombreCompleto}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Shield className="w-3 h-3 text-cbvp-red/60" />
                  <p className="text-[10px] text-white/40 truncate">
                    {usuario?.rango} | Nv.{usuario?.nivelPermiso}
                  </p>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className={`mt-3 flex items-center gap-2 text-xs text-cbvp-red-light/70 hover:text-cbvp-red-light transition-colors ${collapsed ? 'justify-center w-full' : ''}`}
          >
            <LogOut className="w-3.5 h-3.5" />
            {!collapsed && 'Cerrar Sesion'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-[260px]'}`}>
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

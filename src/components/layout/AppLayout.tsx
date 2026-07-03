import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermiso } from '@/hooks/usePermiso';
import Header from './Header';
import {
  LayoutDashboard, ClipboardList,
  Users, Settings, LogOut, Shield, Menu, X,
  ChevronLeft, ChevronRight, Flame, Crown,
  UserCircle, UserPlus, Lock, BookOpen
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  checkAccess: (permisos: ReturnType<typeof usePermiso>, usuario: ReturnType<typeof useAuth>['usuario']) => boolean;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, checkAccess: (p, u) => p.puedeVerTodo && u?.cargo?.trim().toUpperCase() !== 'VOLUNTARIO(A)' },
  { path: '/mi-dashboard', label: 'Mi Dashboard', icon: UserCircle, checkAccess: p => p.puedeVerPerfilPropio },
  { path: '/planillas', label: 'Planillas de Guardia', icon: ClipboardList, checkAccess: p => p.puedeCargarPlanillas },
  { path: '/practicas-citaciones', label: 'Practicas y Citaciones', icon: BookOpen, checkAccess: p => p.puedeCargarPlanillas },
  { path: '/personal', label: 'Personal', icon: Users, checkAccess: (p, u) => p.puedeVerPersonal && u?.cargo?.trim().toUpperCase() !== 'VOLUNTARIO(A)' },
  { path: '/agregar-bombero', label: 'Agregar Bombero', icon: UserPlus, checkAccess: (p, u) => p.puedeVerPersonal && u?.cargo?.trim().toUpperCase() !== 'VOLUNTARIO(A)' },
  { path: '/configuracion', label: 'Configuracion', icon: Settings, checkAccess: p => p.puedeConfiguracion },
  { path: '/configurar-acceso', label: 'Configurar Acceso', icon: Lock, checkAccess: () => true },
];

function CbvpLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Shield background */}
      <path d="M20 2L4 10V19C4 29 11 37 20 38C29 37 36 29 36 19V10L20 2Z" fill="#c0392b" opacity="0.15" stroke="#c0392b" strokeWidth="1.5"/>
      {/* Maltese cross */}
      <path d="M20 8L22 15H29L23.5 19.5L25.5 27L20 22.5L14.5 27L16.5 19.5L11 15H18L20 8Z" fill="#c0392b" opacity="0.9"/>
      {/* Center flame */}
      <path d="M20 13C20 13 17 17 17 19.5C17 21.5 18.5 23 20 23C21.5 23 23 21.5 23 19.5C23 17 20 13 20 13Z" fill="#e74c3c"/>
      <circle cx="20" cy="20.5" r="1" fill="#f39c12" opacity="0.8"/>
    </svg>
  );
}

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const permisos = usePermiso();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.disabled) return false;
    return item.checkAccess(permisos, usuario);
  });

  return (
    <div className="flex min-h-screen bg-cbvp-dark">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 bg-cbvp-dark-light border-r border-white/[0.04] flex flex-col transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-[260px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand */}
        <div className={`flex items-center border-b border-white/[0.04] ${collapsed ? 'justify-center px-2 py-4' : 'px-5 py-4'}`}>
          <div className="flex items-center gap-3">
            <CbvpLogo className="w-9 h-9 shrink-0" />
            {!collapsed && (
              <div className="overflow-hidden">
                <h2 className="text-sm font-bold text-white tracking-tight leading-tight flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-cbvp-red" />
                  CBVP
                </h2>
                <p className="text-[10px] text-white/40 leading-tight truncate">20ma Cia. - Mercado 4</p>
              </div>
            )}
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-5 p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm mx-1 ${
                  isActive
                    ? 'bg-cbvp-red/10 text-white shadow-glow'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className={`p-1 rounded-md ${isActive ? 'bg-cbvp-red/20' : 'bg-transparent'}`}>
                  <Icon className="w-[16px] h-[16px] shrink-0" />
                </div>
                {!collapsed && <span className="truncate font-medium">{item.label}</span>}
                {isActive && !collapsed && <div className="ml-auto w-1 h-1 rounded-full bg-cbvp-red" />}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex mx-3 mb-2 items-center justify-center py-2 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.03] transition-all text-xs"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5 mr-1" />}
          {!collapsed && 'Colapsar'}
        </button>

        {/* User info */}
        <div className={`border-t border-white/[0.04] bg-gradient-to-t from-black/20 to-transparent ${collapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-cbvp-red/10 border border-cbvp-red/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-cbvp-red/70" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{usuario?.nombreCompleto}</p>
                <p className="text-[10px] text-white/30 truncate">{usuario?.rango}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className={`mt-3 flex items-center gap-2 text-xs text-cbvp-red-light/50 hover:text-cbvp-red-light transition-colors ${collapsed ? 'justify-center w-full' : ''}`}
          >
            <LogOut className="w-3 h-3" />
            {!collapsed && 'Cerrar Sesion'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 min-w-0 ${collapsed ? 'lg:ml-16' : 'lg:ml-[260px]'}`}>
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-cbvp-dark-light border-b border-white/[0.04]">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <CbvpLogo className="w-6 h-6" />
            <span className="text-sm font-bold text-white">CBVP</span>
          </div>
          <div className="w-9" /> {/* spacer */}
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Header />
          <Outlet />
        </div>
      </main>
    </div>
  );
}

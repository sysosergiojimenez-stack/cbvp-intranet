import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, BellOff, BellRing, Circle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import { formatearTiempoRelativo } from '@/lib/fechas';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Resumen general del sistema' },
  '/mi-dashboard': { title: 'Mi Dashboard', subtitle: 'Mis datos y metricas de asistencia' },
  '/planillas': { title: 'Planillas de Guardia', subtitle: 'Carga y procesamiento de planillas' },
  '/control-movil': { title: 'Control de Movil', subtitle: 'Checklist de materiales asignados por movil' },
  '/practicas-citaciones': { title: 'Practicas y Citaciones', subtitle: 'Asistencia a practicas, citaciones y reuniones' },
  '/salida-movil': { title: 'Salidas de Movil', subtitle: 'Registro de movimientos de la flota de vehiculos' },
  '/historial': { title: 'Historial de Planillas', subtitle: 'Registro historico de guardias' },
  '/personal': { title: 'Personal', subtitle: 'Listado de bomberos voluntarios' },
  '/moviles': { title: 'Material Mayor', subtitle: 'Ficha tecnica de la flota de vehiculos' },
  '/material-menor': { title: 'Material Menor', subtitle: 'Inventario de equipos y herramientas por categoria' },
  '/configuracion': { title: 'Configuracion', subtitle: 'Roles, permisos y ajustes del sistema' },
  '/configurar-acceso': { title: 'Configurar Acceso', subtitle: '' },
  '/notificaciones': { title: 'Notificaciones', subtitle: 'Avisos y novedades del sistema' },
  '/informe-servicios': { title: 'Informes de Servicio', subtitle: 'Informes generados a partir de las salidas de movil' },
  '/cuotas-bomberos': { title: 'Cuotas de Bomberos', subtitle: 'Registro de pagos de cuota mensual' },
};

function getPageTitle(pathname: string): { title: string; subtitle: string } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/editar-bombero/')) {
    return { title: 'Editar Bombero', subtitle: 'Modificar datos del bombero' };
  }
  return { title: 'Fire Intranet', subtitle: '' };
}

function NotificationBell() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const codigo = usuario?.codigo || '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: countData } = trpc.notificaciones.contarNoLeidas.useQuery(
    { codigo },
    { enabled: !!codigo }
  );
  const { data: listaData } = trpc.notificaciones.listar.useQuery(
    { codigo, limite: 8 },
    { enabled: !!codigo }
  );

  const marcarLeida = trpc.notificaciones.marcarLeida.useMutation({
    onSuccess: () => {
      utils.notificaciones.listar.invalidate();
      utils.notificaciones.contarNoLeidas.invalidate();
    },
  });

  const noLeidas = countData?.exito ? countData.cantidad : 0;
  const notificaciones = listaData?.exito ? listaData.notificaciones : [];

  const { soportado: pushSoportado, suscrito: pushSuscrito, cargando: pushCargando, activar: activarPush, desactivar: desactivarPush } = usePushNotifications(codigo);

  const abrir = (n: { id: string; leida: boolean; link: string }) => {
    if (!n.leida) marcarLeida.mutate({ id: n.id, codigo });
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-cbvp-red text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-cbvp-dark-light border border-white/10 rounded-xl shadow-glow z-[100] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            {noLeidas > 0 && (
              <span className="text-[10px] text-cbvp-red-light">{noLeidas} sin leer</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notificaciones.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-8">No hay notificaciones</p>
            ) : (
              notificaciones.map((n) => (
                <button
                  key={n.id}
                  onClick={() => abrir(n)}
                  className={`w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors ${
                    !n.leida ? 'bg-cbvp-red/[0.04]' : ''
                  }`}
                >
                  {!n.leida ? (
                    <Circle className="w-2 h-2 fill-cbvp-red text-cbvp-red shrink-0 mt-1.5" />
                  ) : (
                    <span className="w-2 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${!n.leida ? 'text-white' : 'text-white/60'}`}>
                      {n.titulo}
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5 line-clamp-2">{n.mensaje}</p>
                    <p className="text-[10px] text-white/25 mt-1">{formatearTiempoRelativo(n.fechaCreacion)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {pushSoportado && (
            <button
              onClick={() => (pushSuscrito ? desactivarPush() : activarPush())}
              disabled={pushCargando}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-white/50 hover:text-white border-t border-white/5 transition-colors disabled:opacity-50"
            >
              {pushSuscrito ? <BellRing className="w-3.5 h-3.5 text-cbvp-red-light" /> : <BellOff className="w-3.5 h-3.5" />}
              {pushCargando ? 'Un momento...' : pushSuscrito ? 'Notificaciones push activadas' : 'Activar notificaciones push'}
            </button>
          )}

          <button
            onClick={() => { setOpen(false); navigate('/notificaciones'); }}
            className="w-full text-center text-xs text-cbvp-red-light hover:text-cbvp-red-light/80 py-2.5 border-t border-white/5 transition-colors"
          >
            Ver todas las notificaciones
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const location = useLocation();
  const page = getPageTitle(location.pathname);

  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
      <div>
        <h1 className="text-xl font-bold text-white">{page.title}</h1>
        <p className="text-xs text-white/40 mt-0.5">{page.subtitle}</p>
      </div>

      <NotificationBell />
    </header>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import { formatearTiempoRelativo } from '@/lib/fechas';
import { Bell, Shield, Flame, Megaphone, CheckCheck, Circle } from 'lucide-react';
import type { TipoNotificacion } from '@contracts/notificaciones';

const ICONOS_TIPO: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  rol_guardia: { icon: Shield, color: 'text-cbvp-blue', bg: 'bg-cbvp-blue/10' },
  informe_incendio: { icon: Flame, color: 'text-cbvp-red', bg: 'bg-cbvp-red/10' },
  anuncio: { icon: Megaphone, color: 'text-cbvp-yellow', bg: 'bg-cbvp-yellow/10' },
  sistema: { icon: Bell, color: 'text-white/50', bg: 'bg-white/5' },
};

function iconoPara(tipo: string) {
  return ICONOS_TIPO[tipo] || ICONOS_TIPO.sistema;
}

export default function Notificaciones() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const codigo = usuario?.codigo || '';
  const [filtro, setFiltro] = useState<'todas' | 'no_leidas'>('todas');

  const { data, isLoading } = trpc.notificaciones.listar.useQuery(
    { codigo, limite: 100 },
    { enabled: !!codigo }
  );

  const marcarLeida = trpc.notificaciones.marcarLeida.useMutation({
    onSuccess: () => {
      utils.notificaciones.listar.invalidate();
      utils.notificaciones.contarNoLeidas.invalidate();
    },
  });

  const marcarTodasLeidas = trpc.notificaciones.marcarTodasLeidas.useMutation({
    onSuccess: () => {
      utils.notificaciones.listar.invalidate();
      utils.notificaciones.contarNoLeidas.invalidate();
    },
  });

  const notificaciones = data?.exito ? data.notificaciones : [];
  const noLeidas = notificaciones.filter((n) => !n.leida);
  const visibles = filtro === 'no_leidas' ? noLeidas : notificaciones;

  const abrir = (n: { id: string; leida: boolean; link: string }) => {
    if (!n.leida) marcarLeida.mutate({ id: n.id, codigo });
    if (n.link) navigate(n.link);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-xl w-fit">
          <button
            onClick={() => setFiltro('todas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === 'todas' ? 'bg-cbvp-red/20 text-white' : 'text-white/50 hover:text-white'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFiltro('no_leidas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === 'no_leidas' ? 'bg-cbvp-red/20 text-white' : 'text-white/50 hover:text-white'
            }`}
          >
            No leidas {noLeidas.length > 0 && <span className="ml-1 text-cbvp-red-light">({noLeidas.length})</span>}
          </button>
        </div>

        {noLeidas.length > 0 && (
          <button
            onClick={() => marcarTodasLeidas.mutate({ codigo })}
            disabled={marcarTodasLeidas.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como leidas
          </button>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-white/40 text-sm">
            <div className="w-5 h-5 border-2 border-cbvp-red/30 border-t-cbvp-red rounded-full animate-spin mr-3" />
            Cargando notificaciones...
          </div>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Bell className="w-10 h-10 text-white/15 mb-3" />
            <p className="text-white/40 text-sm">
              {filtro === 'no_leidas' ? 'No tenes notificaciones sin leer.' : 'Todavia no tenes notificaciones.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {visibles.map((n) => {
              const { icon: Icon, color, bg } = iconoPara(n.tipo as TipoNotificacion);
              return (
                <button
                  key={n.id}
                  onClick={() => abrir(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] ${
                    !n.leida ? 'bg-cbvp-red/[0.03]' : ''
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${!n.leida ? 'text-white' : 'text-white/70'}`}>
                        {n.titulo}
                      </p>
                      {!n.leida && <Circle className="w-2 h-2 fill-cbvp-red text-cbvp-red shrink-0" />}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{n.mensaje}</p>
                    <p className="text-[11px] text-white/25 mt-1">{formatearTiempoRelativo(n.fechaCreacion)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

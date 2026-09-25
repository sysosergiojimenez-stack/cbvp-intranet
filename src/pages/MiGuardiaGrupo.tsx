import { useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import { ArrowLeft } from 'lucide-react';
import { DIAS_SEMANA, generarSemanasCalendario } from '@/lib/calendario';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function MiGuardiaGrupo() {
  const { idRol, idGrupo } = useParams<{ idRol: string; idGrupo: string }>();
  const [searchParams] = useSearchParams();
  const { usuario } = useAuth();
  const codigo = usuario?.codigo || '';

  const fechaParam = searchParams.get('fecha') || '';
  const fechaMatch = fechaParam.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const fechaNotificada = fechaMatch
    ? { anio: Number(fechaMatch[1]), mes: Number(fechaMatch[2]), dia: Number(fechaMatch[3]) }
    : null;

  const { data, isLoading } = trpc.rolesGuardia.obtenerParaMiGuardia.useQuery(
    { idRol: idRol || '', idGrupo: idGrupo || '', codigo },
    { enabled: !!idRol && !!idGrupo && !!codigo }
  );

  const semanas = useMemo(
    () => (data?.exito ? generarSemanasCalendario(data.anio, data.mes) : []),
    [data]
  );

  const diaResaltado =
    data?.exito && fechaNotificada && fechaNotificada.anio === data.anio && fechaNotificada.mes === data.mes
      ? fechaNotificada.dia
      : null;

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        {isLoading ? (
          <div className="text-center py-6 text-white/40 text-sm">Cargando...</div>
        ) : !data?.exito ? (
          <div className="text-center py-6 text-white/40 text-sm">
            No se encontró tu guardia. Es posible que ya no estés asignado a este grupo.
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-white mb-6">Mi Guardia — {data.nombreGrupo}</h2>

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 min-w-0">
                {data.personal.length === 0 ? (
                  <div className="text-white/30 text-xs py-2">Sin personal asignado todavía.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full table-fixed">
                      <thead>
                        <tr className="border-b border-white/5 text-white/40">
                          <th className="text-left py-1.5 pr-1 font-medium w-11">Codigo</th>
                          <th className="text-left py-1.5 pr-1 font-medium w-28">Nombre</th>
                          <th className="text-left py-1.5 pr-1 font-medium w-11">Radial</th>
                          <th className="text-left py-1.5 pr-1 font-medium w-24">Asignacion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.personal.map((p) => (
                          <tr key={p.id} className="border-b border-white/5">
                            <td className="py-1.5 pr-1 text-white/60 truncate" title={p.codigo}>{p.codigo}</td>
                            <td className="py-1.5 pr-1 text-white/80 truncate" title={p.nombre}>{p.nombre}</td>
                            <td className="py-1.5 pr-1 text-white/50 truncate" title={p.radial || '-'}>{p.radial || '-'}</td>
                            <td className="py-1.5 pr-1 text-white/50 truncate" title={p.asignacion || '-'}>{p.asignacion || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-[220px] lg:w-[210px] shrink-0 bg-transparent sm:bg-white/[0.02] sm:border border-white/10 rounded-lg p-3 sm:p-2.5">
                <div className="mb-2">
                  <span className="text-xs sm:text-[11px] font-semibold text-white/70">{MESES[data.mes - 1]} {data.anio}</span>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-0.5 mb-1">
                  {DIAS_SEMANA.map((d) => (
                    <div key={d} className="text-center text-[10px] sm:text-[8px] font-semibold text-white/30">{d}</div>
                  ))}
                </div>
                {semanas.map((semana, i) => (
                  <div key={i} className="grid grid-cols-7 gap-1 sm:gap-0.5 mb-1">
                    {semana.map((dia, j) => {
                      if (dia === null) return <div key={j} className="h-8 sm:h-7" />;
                      const esGuardia = data.diasGuardia.includes(dia);
                      const esResaltado = dia === diaResaltado;
                      const clase = esResaltado
                        ? 'bg-amber-400 text-cbvp-dark ring-2 ring-amber-300 font-bold'
                        : esGuardia
                          ? 'bg-cbvp-green/20 text-cbvp-green border border-cbvp-green/30'
                          : 'bg-white/5 text-white/50';
                      return (
                        <div
                          key={j}
                          className={`w-full h-8 sm:h-7 rounded text-xs sm:text-[9px] font-medium flex items-center justify-center ${clase}`}
                        >
                          {dia}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[9px] text-white/40">
                    <span className="w-2.5 h-2.5 rounded-sm bg-cbvp-green/20 border border-cbvp-green/30 inline-block" /> Guardia del grupo
                  </div>
                  {diaResaltado !== null && (
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[9px] text-white/40">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Guardia notificada
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

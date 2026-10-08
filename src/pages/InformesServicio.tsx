import { useNavigate } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { FileText, Trash2, ClipboardList } from 'lucide-react';
import { normalizarFechaISO } from '@/lib/fechas';

type TipoInforme = '10:40' | '10:41' | '10:42';

interface InformeTarjeta {
  id: string;
  origen: 'incendio' | 'accidente';
  tipo: TipoInforme;
  nServicio: string;
  fecha: string;
  movil: string;
  direccion: string;
}

function numeroDe(valor: string): number {
  const n = parseInt(valor.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

// Submodulo unico de Informes de Servicio: junta los informes de incendio
// (10:40) y los de accidente/rescate (10:41 / 10:42) en una sola lista.
export default function InformesServicio() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: incendiosData, isLoading: cargandoIncendios } = trpc.informeIncendio.listado.useQuery();
  const { data: accidentesData, isLoading: cargandoAccidentes } = trpc.informeAccidente.listado.useQuery();
  const eliminarIncendio = trpc.informeIncendio.eliminar.useMutation();
  const eliminarAccidente = trpc.informeAccidente.eliminar.useMutation();

  const informes: InformeTarjeta[] = [
    ...(incendiosData?.informes || []).map(i => ({
      id: i.id, origen: 'incendio' as const, tipo: '10:40' as TipoInforme,
      nServicio: i.nServicio, fecha: i.fecha, movil: i.movil, direccion: i.direccion,
    })),
    ...(accidentesData?.informes || []).map(i => ({
      id: i.id, origen: 'accidente' as const, tipo: (i.tipoInforme === '10:42' ? '10:42' : '10:41') as TipoInforme,
      nServicio: i.nServicio, fecha: i.fecha, movil: i.movil, direccion: i.direccion,
    })),
  ].sort((a, b) => numeroDe(b.nServicio) - numeroDe(a.nServicio));

  const abrir = async (i: InformeTarjeta) => {
    if (i.origen === 'incendio') {
      const resp = await utils.client.informeIncendio.obtener.query({ id: i.id });
      if (!resp.exito) { alert('No se pudo cargar el informe.'); return; }
      const informe = resp.informe as { fecha?: string };
      navigate('/informe-incendio', { state: { form: { ...resp.informe, id: i.id, fecha: normalizarFechaISO(String(informe.fecha || '')) } } });
    } else {
      const resp = await utils.client.informeAccidente.obtener.query({ id: i.id });
      if (!resp.exito) { alert('No se pudo cargar el informe.'); return; }
      const informe = resp.informe as { fecha?: string };
      navigate('/informe-accidentes', { state: { form: { ...resp.informe, id: i.id, fecha: normalizarFechaISO(String(informe.fecha || '')) } } });
    }
  };

  const eliminar = async (i: InformeTarjeta) => {
    if (!confirm('Eliminar este informe?')) return;
    try {
      if (i.origen === 'incendio') {
        await eliminarIncendio.mutateAsync({ id: i.id });
        utils.informeIncendio.listado.invalidate();
        utils.informeIncendio.salidasPendientes.invalidate();
      } else {
        await eliminarAccidente.mutateAsync({ id: i.id });
        utils.informeAccidente.listado.invalidate();
      }
    } catch (err: unknown) {
      alert('Error al eliminar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const cargando = cargandoIncendios || cargandoAccidentes;

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-cbvp-red" /> Informe de Servicios</h1>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Informes cargados</h2>
        {cargando ? (
          <p className="text-sm text-white/40">Cargando...</p>
        ) : informes.length === 0 ? (
          <p className="text-sm text-white/40">Todavia no hay informes. Se cargan desde el menu de cada salida 10:40, 10:41 o 10:42 en Salidas de Movil.</p>
        ) : (
          <div className="space-y-2">
            {informes.map(i => (
              <div
                key={`${i.origen}-${i.id}`}
                onClick={() => abrir(i)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white">N° {i.nServicio || '—'} — {i.tipo} · {i.fecha} · {i.movil}</p>
                  <p className="text-xs text-white/40 truncate">{i.direccion}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); eliminar(i); }}
                  className="p-2 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

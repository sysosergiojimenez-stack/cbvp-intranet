import { useState, useEffect } from 'react';
import { trpc } from '@/providers/trpc';
import { Fuel, FileDown, Save, Truck } from 'lucide-react';
import { MOVILES_VALIDOS } from '@contracts/moviles';
import { exportarRendicionCombustiblePdf } from '@/lib/exportarRendicionCombustiblePdf';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface EdicionFila {
  factura: string;
  litros: string;
  importe: string;
  ciManual: string;
  kmSalidaManual: string;
}

// Igual que en el router: los km de odometro vienen con "." como separador
// de miles, nunca con decimales.
function parseKm(valor: string): number | null {
  const limpio = String(valor || '').replace(/[^\d]/g, '');
  return limpio ? parseInt(limpio, 10) : null;
}

export default function RendicionesCombustible() {
  const hoy = new Date();
  const [movil, setMovil] = useState<(typeof MOVILES_VALIDOS)[number]>(MOVILES_VALIDOS[0]);
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [exportando, setExportando] = useState(false);
  const [ediciones, setEdiciones] = useState<Record<string, EdicionFila>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading, isFetching } = trpc.rendicionCombustible.datos.useQuery({ movil, mes, anio });
  const guardarCargaMutation = trpc.rendicionCombustible.guardarCarga.useMutation();

  const filas = data?.filas || [];

  // Al cambiar de movil/mes, o al llegar datos frescos del servidor, arranca
  // la edicion local desde los valores ya guardados (si los hay).
  useEffect(() => {
    const inicial: Record<string, EdicionFila> = {};
    filas.forEach((f) => {
      inicial[f.salidaId] = { factura: f.factura, litros: f.litros, importe: f.importe, ciManual: f.ci, kmSalidaManual: f.kilometrajeSalida };
    });
    setEdiciones(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movil, mes, anio, data?.filas.length]);

  const actualizarEdicion = (salidaId: string, campo: keyof EdicionFila, valor: string) => {
    setEdiciones((prev) => ({
      ...prev,
      [salidaId]: { ...(prev[salidaId] || { factura: '', litros: '', importe: '', ciManual: '', kmSalidaManual: '' }), [campo]: valor },
    }));
  };

  const guardarFila = async (salidaId: string) => {
    const ed = ediciones[salidaId];
    if (!ed) return;
    setGuardandoId(salidaId);
    try {
      await guardarCargaMutation.mutateAsync({ salidaId, factura: ed.factura, litros: ed.litros, importe: ed.importe, ciManual: ed.ciManual, kmSalidaManual: ed.kmSalidaManual });
      utils.rendicionCombustible.datos.invalidate({ movil, mes, anio });
    } catch (err: unknown) {
      alert('Error al guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setGuardandoId(null);
    }
  };

  const handleExportar = async () => {
    if (!data) return;
    setExportando(true);
    try {
      await exportarRendicionCombustiblePdf(
        data.movil,
        mes,
        anio,
        filas.map((f) => {
          const ed = ediciones[f.salidaId];
          if (!ed) return f;
          const kilometrajeSalida = ed.kmSalidaManual || f.kilometrajeSalida;
          const kmSalidaNum = parseKm(kilometrajeSalida);
          const kmLlegadaNum = parseKm(f.kilometrajeLlegada);
          const kmRecorridos = kmSalidaNum !== null && kmLlegadaNum !== null ? Math.max(0, kmLlegadaNum - kmSalidaNum) : f.kmRecorridos;
          return { ...f, ci: ed.ciManual || f.ci, factura: ed.factura, litros: ed.litros, importe: ed.importe, kilometrajeSalida, kmRecorridos };
        })
      );
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Fuel className="w-4 h-4 text-cbvp-red" /> Rendiciones de Combustible
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          <select value={movil} onChange={(e) => setMovil(e.target.value as (typeof MOVILES_VALIDOS)[number])} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
            {MOVILES_VALIDOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
            {MESES.map((nombre, idx) => <option key={idx} value={idx + 1}>{nombre}</option>)}
          </select>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
            {Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - 2 + i).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={handleExportar}
            disabled={exportando || isLoading || filas.length === 0}
            className="ml-auto px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors"
          >
            <FileDown className="w-4 h-4" /> {exportando ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>

        {data?.movil && (
          <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
            <Truck className="w-3.5 h-3.5" />
            {[data.movil.tipo, data.movil.codificacion].filter(Boolean).join(' ') || movil}
            {data.movil.numeroTarjetaFlota && <span> · Tarjeta flota: {data.movil.numeroTarjetaFlota}</span>}
            {data.movil.proveedorCombustible && <span> · Proveedor: {data.movil.proveedorCombustible}</span>}
            {(!data.movil.numeroTarjetaFlota || !data.movil.proveedorCombustible) && (
              <span className="text-amber-400/70"> — Faltan datos del movil, completalos en Primer Oficial &gt; Material Mayor</span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : filas.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay salidas registradas para {MESES[mes - 1]} {anio} con este movil.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">CI</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Conductor</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Km salida</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Destino</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Km llegada</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Km rec.</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Motivo</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Factura N°</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Litros</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Importe (Gs)</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50"></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const ed = ediciones[f.salidaId] || { factura: '', litros: '', importe: '', ciManual: f.ci, kmSalidaManual: f.kilometrajeSalida };
                  const huboCambios = ed.factura !== f.factura || ed.litros !== f.litros || ed.importe !== f.importe || ed.ciManual !== f.ci || ed.kmSalidaManual !== f.kilometrajeSalida;
                  return (
                    <tr key={f.salidaId} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{f.fechaSalida}</td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={ed.ciManual} onChange={(e) => actualizarEdicion(f.salidaId, 'ciManual', e.target.value)} className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                      </td>
                      <td className="px-2 py-1.5 text-white/80">{f.conductor}</td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={ed.kmSalidaManual} onChange={(e) => actualizarEdicion(f.salidaId, 'kmSalidaManual', e.target.value)} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                      </td>
                      <td className="px-2 py-1.5 text-white/70 max-w-[180px] truncate" title={f.direccion}>{f.direccion}</td>
                      <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{f.kilometrajeLlegada}</td>
                      <td className="px-2 py-1.5 text-white/70">{f.kmRecorridos !== null ? f.kmRecorridos : '-'}</td>
                      <td className="px-2 py-1.5 text-white/50 max-w-[160px] truncate" title={f.tipoServicio}>{f.tipoServicio}</td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={ed.factura} onChange={(e) => actualizarEdicion(f.salidaId, 'factura', e.target.value)} className="w-28 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={ed.litros} onChange={(e) => actualizarEdicion(f.salidaId, 'litros', e.target.value)} className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={ed.importe} onChange={(e) => actualizarEdicion(f.salidaId, 'importe', e.target.value)} className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:border-cbvp-red/50 focus:outline-none" />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => guardarFila(f.salidaId)}
                          disabled={!huboCambios || guardandoId === f.salidaId}
                          className="p-1.5 rounded-lg hover:bg-cbvp-green/20 text-white/40 hover:text-cbvp-green disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title="Guardar fila"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isFetching && <p className="text-xs text-white/30 mt-2">Actualizando...</p>}
          </div>
        )}
      </div>
    </div>
  );
}

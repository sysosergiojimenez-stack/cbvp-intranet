import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { PiggyBank, Pencil, Save } from 'lucide-react';

function formatearGs(valor: number): string {
  return valor.toLocaleString('es-PY');
}

// El monto se carga como texto (para permitir "." como separador visual
// mientras se escribe) y se limpia a entero recien al guardar.
function parseMonto(valor: string): number {
  const limpio = valor.replace(/[^\d-]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

export default function CajaChica() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.cajaChica.listado.useQuery();
  const actualizarMutation = trpc.cajaChica.actualizar.useMutation();

  const [editando, setEditando] = useState(false);
  const [saldoAnterior, setSaldoAnterior] = useState('');
  const [gastos, setGastos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const iniciarEdicion = () => {
    if (!data?.exito) return;
    setSaldoAnterior(String(data.saldoAnterior));
    setGastos(String(data.gastos));
    setObservaciones(data.observaciones);
    setError('');
    setEditando(true);
  };

  const guardar = async () => {
    setError('');
    setGuardando(true);
    try {
      await actualizarMutation.mutateAsync({
        saldoAnterior: parseMonto(saldoAnterior),
        gastos: parseMonto(gastos),
        observaciones: observaciones.trim(),
      });
      setEditando(false);
      utils.cajaChica.listado.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const ingresos = data?.exito ? data.ingresos : 0;
  const saldo = data?.exito ? data.saldo : 0;
  const ordenes = data?.exito ? data.ordenes : [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-cbvp-red" /> Caja Chica
          </h2>
          {!editando && !isLoading && (
            <button onClick={iniciarEdicion} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded-lg transition-colors flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : editando ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Saldo Anterior (Gs.)</label>
                <input type="text" value={saldoAnterior} onChange={(e) => setSaldoAnterior(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Gastos (Gs.)</label>
                <input type="text" value={gastos} onChange={(e) => setGastos(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">Observaciones</label>
              <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none" />
            </div>
            <p className="text-xs text-white/30">Ingresos se calcula automaticamente sumando las Ordenes de Pago con tipo de movimiento "Caja Chica".</p>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button onClick={guardar} disabled={guardando} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditando(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-right px-2 py-2 font-medium text-white/50">Saldo Anterior</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Ingresos</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Gastos</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1.5 text-white/60 text-right whitespace-nowrap">{formatearGs(data?.exito ? data.saldoAnterior : 0)}</td>
                  <td className="px-2 py-1.5 text-cbvp-green text-right whitespace-nowrap">{formatearGs(ingresos)}</td>
                  <td className="px-2 py-1.5 text-cbvp-red-light text-right whitespace-nowrap">{formatearGs(data?.exito ? data.gastos : 0)}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${saldo < 0 ? 'text-cbvp-red-light' : 'text-white'}`}>{formatearGs(saldo)}</td>
                </tr>
              </tbody>
            </table>
            {data?.exito && data.observaciones && (
              <p className="text-xs text-white/40 mt-3">{data.observaciones}</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Ingresos por Ordenes de Pago</h3>
        <p className="text-xs text-white/30 mb-4">
          Ordenes de Pago cargadas con tipo de movimiento "Caja Chica". Se suman automaticamente al Ingresos de arriba.
        </p>
        {isLoading ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : ordenes.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay Ordenes de Pago de Caja Chica todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">Nro.</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Banco</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Total</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id} className="border-b border-white/5">
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{o.numero}/{o.anio}</td>
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{o.fecha}</td>
                    <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{o.bancoNombre}</td>
                    <td className="px-2 py-1.5 text-cbvp-green text-right whitespace-nowrap">{formatearGs(o.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-semibold">
                  <td colSpan={3} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                  <td className="px-2 py-2 text-right text-cbvp-green">{formatearGs(ingresos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { ClipboardList } from 'lucide-react';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

type FilaAsistencia = {
  codigo: string;
  nombre: string;
  situ: string;
  dias: string[];
  totalGuardias: number;
  presentes: number;
  porcentaje: number;
};

function TablaAsistencia({ titulo, filas, diasDelMes }: { titulo: string; filas: FilaAsistencia[]; diasDelMes: number }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{titulo}</h3>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left px-2 py-2 font-medium text-white/50 sticky left-0 bg-[#14141c]">Codigo</th>
              <th className="text-left px-2 py-2 font-medium text-white/50 sticky left-[70px] bg-[#14141c] min-w-[160px]">Nombre</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">SITU</th>
              {Array.from({ length: diasDelMes }, (_, i) => (
                <th key={i} className="text-center px-1.5 py-2 font-medium text-white/50">{i + 1}</th>
              ))}
              <th className="text-center px-2 py-2 font-medium text-white/50">%</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-2 py-1.5 text-white/60 whitespace-nowrap sticky left-0 bg-[#14141c]">{p.codigo}</td>
                <td className="px-2 py-1.5 text-white/80 whitespace-nowrap sticky left-[70px] bg-[#14141c]">{p.nombre}</td>
                <td className="px-2 py-1.5 text-center text-white/50">{p.situ}</td>
                {p.dias.map((d, i) => (
                  <td key={i} className={`text-center px-1.5 py-1.5 ${d === 'P' ? 'bg-cbvp-green/20 text-cbvp-green font-semibold' : d === 'A' ? 'bg-cbvp-red/20 text-cbvp-red font-semibold' : ''}`}>{d}</td>
                ))}
                <td className="px-2 py-1.5 text-center font-semibold text-white">{p.porcentaje}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InformesAsistencia() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [categoria, setCategoria] = useState<'COMBATIENTE' | 'ACTIVO'>('COMBATIENTE');

  const { data, isLoading } = trpc.planillas.asistenciaMensualDetallada.useQuery({ mes, anio, categoria });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-cbvp-red" /> Informes de Asistencia
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
            {MESES.map((nombre, idx) => (
              <option key={idx} value={idx + 1}>{nombre}</option>
            ))}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none">
            {Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - 2 + i).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            <button onClick={() => setCategoria('COMBATIENTE')} className={`px-4 py-2 text-sm transition-colors ${categoria === 'COMBATIENTE' ? 'bg-cbvp-red text-white' : 'text-white/60 hover:text-white'}`}>Combatientes</button>
            <button onClick={() => setCategoria('ACTIVO')} className={`px-4 py-2 text-sm transition-colors ${categoria === 'ACTIVO' ? 'bg-cbvp-red text-white' : 'text-white/60 hover:text-white'}`}>Activos</button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-6 text-white/40 text-sm">Cargando...</div>
        ) : !data?.normales || data.normales.length === 0 ? (
          <div className="text-center py-6 text-white/40 text-sm">No hay personal en esta categoria.</div>
        ) : categoria === 'ACTIVO' ? (
          <TablaAsistencia titulo="Asistencia Activos" filas={data.normales} diasDelMes={data.diasDelMes} />
        ) : (
          <>
            <TablaAsistencia titulo="Guardias Normales" filas={data.normales} diasDelMes={data.diasDelMes} />
            <TablaAsistencia titulo="Guardias Especiales" filas={data.especiales} diasDelMes={data.diasDelMes} />
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { ClipboardList } from 'lucide-react';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

type FilaAsistencia = {
  codigo: string;
  nombre: string;
  situ?: string;
  dias: string[];
  totalGuardias?: number;
  total?: number;
  presentes: number;
  porcentaje: number;
};

function TablaAsistencia({ titulo, filas, columnas, mostrarSitu }: { titulo: string; filas: FilaAsistencia[]; columnas: number[]; mostrarSitu?: boolean }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{titulo}</h3>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left px-2 py-2 font-medium text-white/50 sticky left-0 bg-[#14141c]">Codigo</th>
              <th className="text-left px-2 py-2 font-medium text-white/50 sticky left-[70px] bg-[#14141c] min-w-[160px]">Nombre</th>
              {mostrarSitu && <th className="text-center px-2 py-2 font-medium text-white/50">SITU</th>}
              {columnas.map((dia) => (
                <th key={dia} className="text-center px-1.5 py-2 font-medium text-white/50">{dia}</th>
              ))}
              <th className="text-center px-2 py-2 font-medium text-white/50">%</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-2 py-1.5 text-white/60 whitespace-nowrap sticky left-0 bg-[#14141c]">{p.codigo}</td>
                <td className="px-2 py-1.5 text-white/80 whitespace-nowrap sticky left-[70px] bg-[#14141c]">{p.nombre}</td>
                {mostrarSitu && <td className="px-2 py-1.5 text-center text-white/50">{p.situ}</td>}
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

type FilaTotal = {
  codigo: string;
  nombre: string;
  situ: string;
  cuota: string;
  guardiasPercent: number;
  practicasPercent: number | null;
  citacionesPercent: number | null;
  acumulado: number | string;
};

function TablaTotalAcumulado({ filas }: { filas: FilaTotal[] }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Total Acumulado</h3>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left px-2 py-2 font-medium text-white/50">Codigo</th>
              <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[160px]">Nombre</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">SITU</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Guardias</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Practicas</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Citaciones</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Acumulado</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Cuota</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, idx) => {
              const esTexto = typeof p.acumulado === 'string';
              return (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{p.codigo}</td>
                  <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{p.nombre}</td>
                  <td className="px-2 py-1.5 text-center text-white/50">{p.situ}</td>
                  <td className="px-2 py-1.5 text-center text-white/70">{p.guardiasPercent}%</td>
                  <td className="px-2 py-1.5 text-center text-white/70">{p.practicasPercent === null ? '-' : `${p.practicasPercent}%`}</td>
                  <td className="px-2 py-1.5 text-center text-white/70">{p.citacionesPercent === null ? '-' : `${p.citacionesPercent}%`}</td>
                  <td className={`px-2 py-1.5 text-center font-semibold ${esTexto ? 'text-cbvp-orange' : 'text-white'}`}>{esTexto ? p.acumulado : `${p.acumulado}%`}</td>
                  <td className="px-2 py-1.5 text-center text-white/50">{p.cuota || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResumenCuadroServicio() {
  const { data, isLoading } = trpc.personal.resumenCuadroServicio.useQuery();
  if (isLoading || !data) return null;
  const fila = (etiqueta: string, valor: number) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-white/70">{etiqueta}</span>
      <span className="text-white font-semibold">{valor}</span>
    </div>
  );
  return (
    <div className="mb-6 space-y-3">
      <div className="bg-white/[0.02] border border-white/10 rounded-lg overflow-hidden">
        {fila('Voluntarios en Cuadro de Servicio Regimen Normal', data.regimenNormal)}
        {fila('Voluntarios en Cuadro de Servicio Regimen Especial', data.regimenEspecial)}
        {fila('Con Beneficios - 10 años', data.b10a)}
        {fila('Con Beneficios - 15 años', data.b15a)}
        {fila('Con Beneficios - 20 años', data.b20a)}
        {fila('Comisionados', data.comisionados)}
        <div className="flex items-center justify-between px-3 py-2 bg-white/5 font-semibold">
          <span className="text-white/80">Total en Cuadro de Servicio</span>
          <span className="text-cbvp-green">{data.enCuadro}</span>
        </div>
      </div>
      <div className="bg-white/[0.02] border border-white/10 rounded-lg overflow-hidden">
        {fila('Voluntarios con Licencia', data.licencia)}
      </div>
      <div className="bg-white/[0.02] border border-white/10 rounded-lg overflow-hidden">
        {fila('Voluntarios fuera del Cuadro de Servicio', data.fueraDeCuadro)}
      </div>
      <div className="flex items-center gap-3 px-4 py-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg">
        <span className="text-xl font-bold text-cbvp-red">{data.total}</span>
        <span className="text-white/80 text-sm">Voluntarios en Nomina del Cuartel</span>
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
  const { data: dataPC, isLoading: isLoadingPC } = trpc.asistencia.mensualDetallada.useQuery({ mes, anio, categoria });
  const { data: dataTotal, isLoading: isLoadingTotal } = trpc.planillas.totalAcumulado.useQuery({ mes, anio, categoria });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-cbvp-red" /> Informes de Asistencia
        </h2>

        <ResumenCuadroServicio />

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
          <TablaAsistencia titulo="Asistencia Activos" filas={data.normales} columnas={Array.from({ length: data.diasDelMes }, (_, i) => i + 1)} mostrarSitu />
        ) : (
          <>
            <TablaAsistencia titulo="Guardias Normales" filas={data.normales} columnas={Array.from({ length: data.diasDelMes }, (_, i) => i + 1)} mostrarSitu />
            <TablaAsistencia titulo="Guardias Especiales" filas={data.especiales} columnas={Array.from({ length: data.diasDelMes }, (_, i) => i + 1)} mostrarSitu />
          </>
        )}

        {isLoadingPC ? (
          <div className="text-center py-6 text-white/40 text-sm">Cargando practicas y citaciones...</div>
        ) : dataPC && (
          <>
            {categoria === 'COMBATIENTE' && (
              <TablaAsistencia titulo="Practicas (sabados del mes)" filas={dataPC.practicas} columnas={dataPC.sabados} />
            )}

            {dataPC.sinCitaciones ? (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Citaciones</h3>
                <div className="text-center py-4 text-white/40 text-sm bg-white/[0.02] rounded-lg border border-white/5">NO HUBO</div>
              </div>
            ) : (
              <TablaAsistencia titulo="Citaciones" filas={dataPC.citaciones} columnas={dataPC.fechasCitacion} />
            )}
          </>
        )}

        {isLoadingTotal ? (
          <div className="text-center py-6 text-white/40 text-sm">Cargando total acumulado...</div>
        ) : dataTotal?.filas && dataTotal.filas.length > 0 && (
          <TablaTotalAcumulado filas={dataTotal.filas} />
        )}
      </div>
    </div>
  );
}

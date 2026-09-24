// Tablas compartidas entre el Informe Mensual (todo el personal) y Mi
// Dashboard (la fila de un solo bombero), para que ambas vistas se vean
// exactamente igual.

const MESES_CUOTA = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatearCuota(cuota: string): string {
  if (!cuota) return '-';
  const partes = cuota.split('-');
  if (partes.length !== 2) return cuota;
  const anio = partes[0];
  const mesIdx = parseInt(partes[1], 10) - 1;
  if (isNaN(mesIdx) || mesIdx < 0 || mesIdx > 11) return cuota;
  return `${MESES_CUOTA[mesIdx]}-${anio}`;
}

export type FilaAsistencia = {
  codigo: string;
  nombre: string;
  situ?: string;
  dias: string[];
  totalGuardias?: number;
  total?: number;
  presentes: number;
  porcentaje: number;
};

export function TablaAsistencia({ titulo, filas, columnas, mostrarSitu }: { titulo: string; filas: FilaAsistencia[]; columnas: number[]; mostrarSitu?: boolean }) {
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
                  <td key={i} className={`text-center px-1.5 py-1.5 ${
                    d === 'P' ? 'bg-cbvp-green/20 text-cbvp-green font-semibold' :
                    d === 'A' ? 'bg-cbvp-red/20 text-cbvp-red font-semibold' :
                    d === 'E' ? 'bg-cbvp-blue/20 text-cbvp-blue font-semibold' :
                    d === 'R' ? 'bg-cbvp-purple/20 text-cbvp-purple font-semibold' : ''
                  }`}>{d}</td>
                ))}
                <td className="px-2 py-1.5 text-center font-semibold text-white">{columnas.length === 0 ? '-' : `${p.porcentaje}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type FilaTotal = {
  codigo: string;
  nombre: string;
  situ: string;
  cuota: string;
  guardiasPercent: number;
  practicasPercent: number | null;
  citacionesPercent: number | null;
  acumulado: number | string;
  enCuadro: boolean;
};

export function TablaTotalAcumulado({ filas, categoria }: { filas: FilaTotal[]; categoria: 'COMBATIENTE' | 'ACTIVO' }) {
  const esActivo = categoria === 'ACTIVO';
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
              <th className="text-center px-2 py-2 font-medium text-white/50">{esActivo ? 'Asistencia' : 'Guardias'}</th>
              {!esActivo && <th className="text-center px-2 py-2 font-medium text-white/50">Practicas</th>}
              <th className="text-center px-2 py-2 font-medium text-white/50">Citaciones</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Acumulado</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Cuota</th>
              <th className="text-center px-2 py-2 font-medium text-white/50">Cuadro de Servicio</th>
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
                  {!esActivo && <td className="px-2 py-1.5 text-center text-white/70">{p.practicasPercent === null ? '-' : `${p.practicasPercent}%`}</td>}
                  <td className="px-2 py-1.5 text-center text-white/70">{p.citacionesPercent === null ? '-' : `${p.citacionesPercent}%`}</td>
                  <td className={`px-2 py-1.5 text-center font-semibold ${esTexto ? 'text-cbvp-orange' : 'text-white'}`}>{esTexto ? p.acumulado : `${p.acumulado}%`}</td>
                  <td className="px-2 py-1.5 text-center text-white/50">{formatearCuota(p.cuota)}</td>
                  <td className={`px-2 py-1.5 text-center font-semibold ${p.enCuadro ? 'text-cbvp-green' : 'text-cbvp-red'}`}>{p.enCuadro ? 'EN CUADRO' : 'FUERA DE CUADRO'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

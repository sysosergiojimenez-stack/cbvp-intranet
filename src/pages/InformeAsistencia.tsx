import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { ClipboardList, Download, FileText } from 'lucide-react';
import { exportarInformeCombinado } from '@/lib/exportarInformePdf';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function VistaEstadisticasServicios({ mes, anio }: { mes: number; anio: number }) {
  const { data, isLoading } = trpc.salidaMovil.estadisticasServicios.useQuery({ mes, anio });

  if (isLoading) return <div className="text-center py-6 text-white/40 text-sm">Cargando...</div>;
  if (!data?.tipos || data.tipos.length === 0) return <div className="text-center py-6 text-white/40 text-sm">No hay salidas registradas ese mes.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 border-b border-white/10">
            <th className="text-left px-3 py-2 font-medium text-white/50">Tipo de Servicio</th>
            <th className="text-right px-3 py-2 font-medium text-white/50">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {data.tipos.map((t, idx) => (
            <tr key={idx} className="border-b border-white/5">
              <td className="px-3 py-2 text-white/80">{t.tipo}</td>
              <td className="px-3 py-2 text-right text-white font-mono">{t.cantidad}</td>
            </tr>
          ))}
          <tr className="bg-white/5 font-semibold">
            <td className="px-3 py-2 text-white">Total</td>
            <td className="px-3 py-2 text-right text-white font-mono">{data.total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

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
                  <td key={i} className={`text-center px-1.5 py-1.5 ${
                    d === 'P' ? 'bg-cbvp-green/20 text-cbvp-green font-semibold' :
                    d === 'A' ? 'bg-cbvp-red/20 text-cbvp-red font-semibold' :
                    d === 'E' ? 'bg-cbvp-blue/20 text-cbvp-blue font-semibold' : ''
                  }`}>{d}</td>
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
  enCuadro: boolean;
};

function TablaTotalAcumulado({ filas, categoria }: { filas: FilaTotal[]; categoria: 'COMBATIENTE' | 'ACTIVO' }) {
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
                  <td className="px-2 py-1.5 text-center text-white/50">{p.cuota || '-'}</td>
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

export default function InformesAsistencia() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [vista, setVista] = useState<'COMBATIENTE' | 'ACTIVO' | 'ESTADISTICAS'>('COMBATIENTE');
  const categoria = vista === 'ESTADISTICAS' ? 'COMBATIENTE' : vista;
  const [exportando, setExportando] = useState(false);

  // Datos de la categoria que se esta viendo en pantalla
  const { data, isLoading } = trpc.planillas.asistenciaMensualDetallada.useQuery(
    { mes, anio, categoria },
    { enabled: vista !== 'ESTADISTICAS' }
  );
  const { data: dataPC, isLoading: isLoadingPC } = trpc.asistencia.mensualDetallada.useQuery(
    { mes, anio, categoria },
    { enabled: vista !== 'ESTADISTICAS' }
  );
  const { data: dataTotal, isLoading: isLoadingTotal } = trpc.planillas.totalAcumulado.useQuery(
    { mes, anio, categoria },
    { enabled: vista !== 'ESTADISTICAS' }
  );

  // Datos de ambas categorias (para el PDF combinado) + resumen + estadisticas de servicios
  const { data: dataResumen } = trpc.personal.resumenCuadroServicio.useQuery();
  const { data: dataCombatiente } = trpc.planillas.asistenciaMensualDetallada.useQuery({ mes, anio, categoria: 'COMBATIENTE' });
  const { data: dataActivo } = trpc.planillas.asistenciaMensualDetallada.useQuery({ mes, anio, categoria: 'ACTIVO' });
  const { data: dataPCCombatiente } = trpc.asistencia.mensualDetallada.useQuery({ mes, anio, categoria: 'COMBATIENTE' });
  const { data: dataPCActivo } = trpc.asistencia.mensualDetallada.useQuery({ mes, anio, categoria: 'ACTIVO' });
  const { data: dataTotalCombatiente } = trpc.planillas.totalAcumulado.useQuery({ mes, anio, categoria: 'COMBATIENTE' });
  const { data: dataTotalActivo } = trpc.planillas.totalAcumulado.useQuery({ mes, anio, categoria: 'ACTIVO' });
  const { data: dataEstadisticas } = trpc.salidaMovil.estadisticasServicios.useQuery({ mes, anio });

  const todoListo = dataCombatiente?.normales && dataActivo?.normales && dataPCCombatiente && dataPCActivo && dataTotalCombatiente && dataTotalActivo && dataEstadisticas;

  const handleExportar = async () => {
    if (!todoListo || !dataCombatiente || !dataActivo || !dataPCCombatiente || !dataPCActivo || !dataTotalCombatiente || !dataTotalActivo || !dataEstadisticas) return;
    setExportando(true);
    try {
      await exportarInformeCombinado({
        mes, anio,
        resumen: dataResumen ? {
          regimenNormal: dataResumen.regimenNormal,
          regimenEspecial: dataResumen.regimenEspecial,
          b10a: dataResumen.b10a,
          b15a: dataResumen.b15a,
          b20a: dataResumen.b20a,
          comisionados: dataResumen.comisionados,
          enCuadro: dataResumen.enCuadro,
          licencia: dataResumen.licencia,
          fueraDeCuadro: dataResumen.fueraDeCuadro,
          total: dataResumen.total,
        } : null,
        combatiente: {
          guardiasNormales: dataCombatiente.normales,
          guardiasEspeciales: dataCombatiente.especiales,
          diasDelMes: dataCombatiente.diasDelMes,
          practicas: dataPCCombatiente.practicas,
          sabados: dataPCCombatiente.sabados,
          citaciones: dataPCCombatiente.citaciones,
          fechasCitacion: dataPCCombatiente.fechasCitacion,
          sinCitaciones: dataPCCombatiente.sinCitaciones,
          totalAcumulado: dataTotalCombatiente.filas,
        },
        activo: {
          guardiasNormales: dataActivo.normales,
          guardiasEspeciales: dataActivo.especiales,
          diasDelMes: dataActivo.diasDelMes,
          practicas: dataPCActivo.practicas,
          sabados: dataPCActivo.sabados,
          citaciones: dataPCActivo.citaciones,
          fechasCitacion: dataPCActivo.fechasCitacion,
          sinCitaciones: dataPCActivo.sinCitaciones,
          totalAcumulado: dataTotalActivo.filas,
        },
        estadisticasServicios: dataEstadisticas.tipos,
        totalServicios: dataEstadisticas.total,
      });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-cbvp-red" /> Informe Mensual
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
            <button onClick={() => setVista('COMBATIENTE')} className={`px-4 py-2 text-sm transition-colors ${vista === 'COMBATIENTE' ? 'bg-cbvp-red text-white' : 'text-white/60 hover:text-white'}`}>Combatientes</button>
            <button onClick={() => setVista('ACTIVO')} className={`px-4 py-2 text-sm transition-colors ${vista === 'ACTIVO' ? 'bg-cbvp-red text-white' : 'text-white/60 hover:text-white'}`}>Activos</button>
            <button onClick={() => setVista('ESTADISTICAS')} className={`px-4 py-2 text-sm transition-colors ${vista === 'ESTADISTICAS' ? 'bg-cbvp-red text-white' : 'text-white/60 hover:text-white'}`}>Estadisticas</button>
          </div>
          {vista !== 'ESTADISTICAS' && (
            <button onClick={handleExportar} disabled={exportando || !todoListo} className="ml-auto px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" /> {exportando ? 'Generando PDF...' : 'Exportar PDF Completo'}
            </button>
          )}
        </div>

        {vista === 'ESTADISTICAS' ? (
          <>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cbvp-red" /> Estadisticas de Servicios
            </h3>
            <VistaEstadisticasServicios mes={mes} anio={anio} />
          </>
        ) : (
          <>
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
                <TablaAsistencia titulo={`Citaciones${dataPC.sinCitaciones ? ' (NO HUBO)' : ''}`} filas={dataPC.citaciones} columnas={dataPC.fechasCitacion} />
              </>
            )}

            {isLoadingTotal ? (
              <div className="text-center py-6 text-white/40 text-sm">Cargando total acumulado...</div>
            ) : dataTotal?.filas && dataTotal.filas.length > 0 && (
              <TablaTotalAcumulado filas={dataTotal.filas} categoria={categoria} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getGuardiasByBombero, PERSONAL_DATA } from '@/data/mockData';
import type { Personal, GuardiaHistorial, EstadisticasGuardias } from '@/types';
import {
  User, Shield, Award, Calendar, Radio, FileText, Mail, Hash,
  Clock, ChevronDown, ChevronUp
} from 'lucide-react';

export default function Perfil() {
  const { usuario } = useAuth();
  const [fichaData, setFichaData] = useState<{ guardias: GuardiaHistorial[]; stats: EstadisticasGuardias } | null>(null);
  const [expandedStats, setExpandedStats] = useState(true);

  const personal = PERSONAL_DATA.find((p: Personal) => p.codigo === usuario?.codigo);

  useEffect(() => {
    if (usuario?.codigo) {
      const data = getGuardiasByBombero(usuario.codigo);
      setFichaData(data);
    }
  }, [usuario]);

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'GUARDIA NORMAL': return 'bg-cbvp-red/20 text-cbvp-red';
      case 'GUARDIA ESPECIAL': return 'bg-cbvp-orange/20 text-cbvp-orange';
      case 'REFUERZO': return 'bg-cbvp-purple/20 text-cbvp-purple';
      default: return 'bg-white/10 text-white/60';
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Mi Perfil</h1>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
          <div className="w-16 h-16 rounded-full bg-cbvp-red/10 flex items-center justify-center">
            <User className="w-8 h-8 text-cbvp-red" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{usuario?.nombreCompleto}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Shield className="w-3.5 h-3.5 text-cbvp-red/60" />
              <span className="text-sm text-white/50">{usuario?.rango} - {usuario?.cargo}</span>
            </div>
            <span className="inline-block mt-2 text-[10px] bg-cbvp-red/10 text-cbvp-red px-2 py-0.5 rounded-full">
              Nivel {usuario?.nivelPermiso} - {usuario?.descripcionPermiso}
            </span>
          </div>
        </div>

        {personal && (
          <>
            {/* Datos Personales */}
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Datos Personales</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <Hash className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Codigo</p><p className="text-sm text-white">{personal.codigo}</p></div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <Shield className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Categoria</p><p className="text-sm text-white">{personal.categoria}</p></div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <Award className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Rango</p><p className="text-sm text-white">{personal.rango}</p></div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Anio Juramento</p><p className="text-sm text-white">{personal.anioJuramento}</p></div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <Radio className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Codigo Radial</p><p className="text-sm text-white">{personal.codigoRadial || '-'}</p></div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <FileText className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Nro Documento</p><p className="text-sm text-white">{personal.nroDoc || '-'}</p></div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Fecha Nac.</p><p className="text-sm text-white">{personal.fechaNacimiento || '-'}</p></div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-cbvp-red/50" />
                <div><p className="text-[10px] text-white/40 uppercase">Correo</p><p className="text-sm text-white">{personal.correo || '-'}</p></div>
              </div>
            </div>

            {/* Estadisticas */}
            {fichaData && (
              <div className="mb-6">
                <button onClick={() => setExpandedStats(!expandedStats)} className="flex items-center gap-2 mb-3">
                  {expandedStats ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                  <h3 className="text-sm font-semibold text-cbvp-red">Estadisticas de Guardias</h3>
                </button>
                {expandedStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/5">
                      <p className="text-2xl font-bold text-cbvp-red">{fichaData.stats.totalGuardias}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Total</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-cbvp-green/20">
                      <p className="text-2xl font-bold text-cbvp-green">{fichaData.stats.presentes}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Presentes</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-cbvp-orange/20">
                      <p className="text-2xl font-bold text-cbvp-orange">{fichaData.stats.acacr}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">ACACR</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-cbvp-red/20">
                      <p className="text-2xl font-bold text-cbvp-red-light">{fichaData.stats.asasr}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">ASASR</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Historial */}
            {fichaData && fichaData.guardias.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-cbvp-red mb-3">Historial de Guardias</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase"><th className="px-3 py-2 text-left rounded-tl-lg">Fecha</th><th className="px-3 py-2 text-left">Grupo</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Asignacion</th><th className="px-3 py-2 text-left rounded-tr-lg">Asistencia</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {fichaData.guardias.map((g, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2.5 text-white/80">{g.fechaGuardia}</td>
                          <td className="px-3 py-2.5"><span className="text-xs bg-white/5 px-2 py-0.5 rounded">{g.grupo}</span></td>
                          <td className="px-3 py-2.5"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTipoBadge(g.tipo)}`}>{g.tipo}</span></td>
                          <td className="px-3 py-2.5 text-white/60">{g.asignacion || '-'}</td>
                          <td className="px-3 py-2.5">
                            {g.asistencia ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                g.asistencia === 'PRESENTE' ? 'bg-cbvp-green/20 text-cbvp-green' :
                                g.asistencia === 'ACACR' ? 'bg-cbvp-orange/20 text-cbvp-orange' :
                                g.asistencia === 'ACASR' ? 'bg-cbvp-yellow/20 text-cbvp-yellow' :
                                'bg-cbvp-red/20 text-cbvp-red-light'
                              }`}>{g.asistencia}</span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm">No hay guardias registradas.</p>
              </div>
            )}
          </>
        )}

        {!personal && (
          <div className="text-center py-8">
            <User className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/40 text-sm">No se encontraron datos adicionales.</p>
          </div>
        )}
      </div>
    </div>
  );
}

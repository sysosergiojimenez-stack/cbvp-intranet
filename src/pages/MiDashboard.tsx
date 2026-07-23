import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import {
  User, Shield, Award, Calendar, Hash, Radio,
  ClipboardCheck, TrendingUp, Flame, Star,
  ChevronRight, Clock, AlertTriangle, FileText,
  CheckCircle, Briefcase, HelpCircle, Zap, X
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MiDashboard() {
  const { usuario } = useAuth();

  const { data: personalData } = trpc.personal.list.useQuery(undefined, {
    retry: 1, refetchOnWindowFocus: false,
  });

  const { data: historialData } = trpc.planillas.historial.useQuery(undefined, {
    retry: 1, refetchOnWindowFocus: false,
  });

  // Find current user in personal list to get extra fields
  const miData = useMemo(() => {
    if (!personalData?.personal || !usuario) return null;
    return personalData.personal.find(
      p => p.codigo?.trim().toUpperCase() === usuario.codigo?.trim().toUpperCase()
    );
  }, [personalData, usuario]);

  // Fetch metrics for current user
  const { data: metricasData } = trpc.planillas.misMetricas.useQuery(
    { codigo: usuario?.codigo || "" },
    { enabled: !!usuario?.codigo, retry: 1, refetchOnWindowFocus: false }
  );

  const metricas = metricasData?.exito ? metricasData.stats : null;
  const guardiasList = metricasData?.exito ? metricasData.guardias : [];
  const [filtroActivo, setFiltroActivo] = useState<{ key: string; label: string } | null>(null);
  const filtrarGuardias = (key: string) => {
    switch (key) {
      case 'total': return guardiasList;
      case 'normales': return guardiasList.filter(g => g.tipo === 'GUARDIA NORMAL');
      case 'especiales': return guardiasList.filter(g => g.tipo === 'GUARDIA ESPECIAL');
      case 'refuerzos': return guardiasList.filter(g => g.tipo === 'REFUERZO');
      case 'presentes': return guardiasList.filter(g => g.asistencia === 'PRESENTE');
      case 'ausentes': return guardiasList.filter(g => g.asistencia === 'AUSENTE');
      case 'ausenteReemplazo': return guardiasList.filter(g => g.asistencia === 'AUSENTE CON REEMPLAZO');
      default: return [];
    }
  };

  // Use auth user data as primary, fallback to personal data
  const anioJuramento = miData?.anioJuramento || usuario?.anioJuramento || '-';
  const codigoRadial = miData?.codigoRadial || '-';
  const categoria = usuario?.categoria || miData?.categoria || '-';
  const cargo = usuario?.cargo || '-';
  const rango = usuario?.rango || '-';
  const codigo = usuario?.codigo || '-';
  const nombreCompleto = usuario?.nombreCompleto || '-';
  const correo = usuario?.correo || '-';
  const nivelPermiso = usuario?.nivelPermiso || '-';

  // Asistencia stats cards
  const totalGuardiasCard = { key: 'total', label: 'Total Guardias', value: metricas?.totalGuardias ?? 0, icon: ClipboardCheck, color: 'text-cbvp-red', bg: 'bg-cbvp-red/8', border: 'border-cbvp-red/20', bar: 'bg-cbvp-red' };
  const filaSecundaria = [
    { key: 'normales', label: 'Guardias Normales', value: metricas?.guardiasNormales ?? 0, icon: Shield, color: 'text-cbvp-blue', bg: 'bg-cbvp-blue/8', border: 'border-cbvp-blue/20', bar: 'bg-cbvp-blue' },
    { key: 'presentes', label: 'Presentes', value: metricas?.presentes ?? 0, icon: CheckCircle, color: 'text-cbvp-green', bg: 'bg-cbvp-green/8', border: 'border-cbvp-green/20', bar: 'bg-cbvp-green' },
    { key: 'ausentes', label: 'Ausentes', value: metricas?.ausentes ?? 0, icon: AlertTriangle, color: 'text-cbvp-red-light', bg: 'bg-cbvp-red/8', border: 'border-cbvp-red-light/20', bar: 'bg-cbvp-red-light' },
    { key: 'ausenteReemplazo', label: 'Ausente c/Reemplazo', value: metricas?.ausentesConReemplazo ?? 0, icon: Clock, color: 'text-cbvp-orange', bg: 'bg-cbvp-orange/8', border: 'border-cbvp-orange/20', bar: 'bg-cbvp-orange' },
  ];
  const filaTerciaria = [
    { key: 'especiales', label: 'Guardias Especiales', value: metricas?.guardiasEspeciales ?? 0, icon: Star, color: 'text-cbvp-orange', bg: 'bg-cbvp-orange/8', border: 'border-cbvp-orange/20', bar: 'bg-cbvp-orange' },
    { key: 'refuerzos', label: 'Refuerzos', value: metricas?.refuerzos ?? 0, icon: Zap, color: 'text-cbvp-purple', bg: 'bg-cbvp-purple/8', border: 'border-cbvp-purple/20', bar: 'bg-cbvp-purple' },
  ];

  if (!usuario) {
    return (
      <div className="animate-fade-in text-center py-12">
        <p className="text-white/40">Inicia sesion para ver tu dashboard.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Profile Card */}
      <div className="glass rounded-xl border border-white/[0.04] overflow-hidden">
        <div className="bg-cbvp-red/5 px-6 py-4 border-b border-white/[0.04] flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-cbvp-red/10 border-2 border-cbvp-red/20 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-cbvp-red" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{nombreCompleto}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-cbvp-red-light font-medium bg-cbvp-red/10 px-2 py-0.5 rounded-full">{rango}</span>
              <span className="text-xs text-white/30">|</span>
              <span className="text-xs text-white/40">Codigo: <span className="text-white/60 font-mono">{codigo}</span></span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Cargo */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-red/8 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-cbvp-red/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Cargo</p>
                <p className="text-sm text-white">{cargo}</p>
              </div>
            </div>

            {/* Categoria */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-orange/8 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-cbvp-orange/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Categoria</p>
                <p className="text-sm text-white">{categoria}</p>
              </div>
            </div>

            {/* Anio de Juramento */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-green/8 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-cbvp-green/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Ano de Juramento</p>
                <p className="text-sm text-white">{anioJuramento}</p>
              </div>
            </div>

            {/* Codigo Radial */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-blue/8 flex items-center justify-center shrink-0">
                <Hash className="w-4 h-4 text-cbvp-blue/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Codigo Radial</p>
                <p className="text-sm text-white font-mono">{codigoRadial}</p>
              </div>
            </div>

            {/* Nivel de Permiso */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-purple/8 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-cbvp-purple/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Nivel de Permiso</p>
                <p className="text-sm text-white">{nivelPermiso}</p>
              </div>
            </div>

            {/* Correo */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-yellow/8 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-cbvp-yellow/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Correo</p>
                <p className="text-sm text-white truncate">{correo}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asistencia Stats */}
      <div>
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Metricas de Asistencia</h3>

        {/* Total Guardias destacado */}
        <div onClick={() => setFiltroActivo({ key: totalGuardiasCard.key, label: totalGuardiasCard.label })} className={`relative overflow-hidden glass rounded-xl p-5 border ${totalGuardiasCard.border} card-hover mb-4 cursor-pointer`}>
          <div className={`absolute top-0 left-0 right-0 h-1 ${totalGuardiasCard.bar}`} />
          <div className="flex items-center gap-3 mt-1">
            <div className={`w-12 h-12 rounded-xl ${totalGuardiasCard.bg} flex items-center justify-center shrink-0`}>
              <totalGuardiasCard.icon className={`w-6 h-6 ${totalGuardiasCard.color}`} />
            </div>
            <div>
              <span className="text-4xl font-bold text-white">{totalGuardiasCard.value}</span>
              <p className="text-xs text-white/40 mt-0.5">{totalGuardiasCard.label}</p>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/10 mb-4" />

        {/* Guardias Normales, Presentes, Ausentes, Ausente c/Reemplazo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {filaSecundaria.map((s, i) => (
            <div key={i} onClick={() => setFiltroActivo({ key: s.key, label: s.label })} className={`relative overflow-hidden glass rounded-xl p-4 border ${s.border} card-hover cursor-pointer`}>
              <div className={`absolute top-0 left-0 right-0 h-1 ${s.bar}`} />
              <div className="flex items-center gap-3 mt-1">
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <span className="text-3xl font-bold text-white">{s.value}</span>
                  <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Guardias Especiales, Refuerzos */}
        <div className="grid grid-cols-2 gap-3">
          {filaTerciaria.map((s, i) => (
            <div key={i} onClick={() => setFiltroActivo({ key: s.key, label: s.label })} className={`relative overflow-hidden glass rounded-xl p-4 border ${s.border} card-hover cursor-pointer`}>
              <div className={`absolute top-0 left-0 right-0 h-1 ${s.bar}`} />
              <div className="flex items-center gap-3 mt-1">
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <span className="text-3xl font-bold text-white">{s.value}</span>
                  <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

{/* Configurar Acceso */}
      <Link to="/configurar-acceso" className="glass rounded-xl p-4 border border-white/[0.04] card-hover flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
          <Briefcase className="w-6 h-6 text-white/60" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white">Configurar Acceso</h4>
          <p className="text-xs text-white/40 mt-0.5">Gestionar accesos y permisos</p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20" />
      </Link>

      {filtroActivo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setFiltroActivo(null)}>
          <div className="bg-[#1a1a24] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1a1a24]">
              <h3 className="font-semibold text-white">{filtroActivo.label} ({filtrarGuardias(filtroActivo.key).length})</h3>
              <button onClick={() => setFiltroActivo(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              {filtrarGuardias(filtroActivo.key).length === 0 ? (
                <p className="text-sm text-white/40 text-center py-8">No hay guardias en esta categoria.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm block sm:table">
                    <thead className="hidden sm:table-header-group">
                      <tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase">
                        <th className="px-3 py-2 text-left rounded-tl-lg">Fecha</th>
                        <th className="px-3 py-2 text-left">Grupo</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Asignacion</th>
                        <th className="px-3 py-2 text-left rounded-tr-lg">Asistencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 block sm:table-row-group">
                      {filtrarGuardias(filtroActivo.key).map((g, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] block sm:table-row mb-2 sm:mb-0 bg-white/[0.02] sm:bg-transparent rounded-lg sm:rounded-none border border-white/5 sm:border-0">
                          <td className="px-3 py-2.5 text-white/80 block sm:table-cell font-medium">{g.fechaGuardia}</td>
                          <td className="px-3 py-2.5 block sm:table-cell"><span className="text-xs bg-white/5 px-2 py-0.5 rounded">{g.grupo}</span></td>
                          <td className="px-3 py-2.5 text-white/60 text-xs block sm:table-cell"><span className="text-white/30 sm:hidden">Tipo: </span>{g.tipo}</td>
                          <td className="px-3 py-2.5 text-white/60 block sm:table-cell"><span className="text-white/30 sm:hidden">Asignacion: </span>{g.asignacion || '-'}</td>
                          <td className="px-3 py-2.5 block sm:table-cell">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              g.asistencia === 'PRESENTE' ? 'bg-cbvp-green/20 text-cbvp-green' :
                              g.asistencia === 'AUSENTE CON REEMPLAZO' ? 'bg-cbvp-orange/20 text-cbvp-orange' :
                              'bg-cbvp-red/20 text-cbvp-red-light'
                            }`}>{g.asistencia || '-'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    );
}

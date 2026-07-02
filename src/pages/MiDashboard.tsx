import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import {
  User, Shield, Award, Calendar, Hash, Radio,
  ClipboardCheck, TrendingUp, Flame, Star,
  ChevronRight, Clock, AlertTriangle, FileText,
  CheckCircle, Briefcase, HelpCircle, Zap
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

  const metricas = metricasData?.exito ? metricasData.metricas : null;

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
  const asistenciaStats = [
    { label: 'Guardias Registradas', value: metricas?.guardiasRegistradas ?? 0, icon: ClipboardCheck, color: 'text-cbvp-blue', bg: 'bg-cbvp-blue/8', border: 'border-cbvp-blue/20', bar: 'bg-cbvp-blue' },
    { label: 'Presente', value: metricas?.presente ?? 0, icon: CheckCircle, color: 'text-cbvp-green', bg: 'bg-cbvp-green/8', border: 'border-cbvp-green/20', bar: 'bg-cbvp-green' },
    { label: 'ACACR', value: metricas?.acacr ?? 0, icon: AlertTriangle, color: 'text-cbvp-orange', bg: 'bg-cbvp-orange/8', border: 'border-cbvp-orange/20', bar: 'bg-cbvp-orange' },
    { label: 'ACASR', value: metricas?.acasr ?? 0, icon: Clock, color: 'text-cbvp-red', bg: 'bg-cbvp-red/8', border: 'border-cbvp-red/20', bar: 'bg-cbvp-red' },
    { label: 'ASASR', value: metricas?.asasr ?? 0, icon: HelpCircle, color: 'text-cbvp-red-light', bg: 'bg-cbvp-red/8', border: 'border-cbvp-red-light/20', bar: 'bg-cbvp-red-light' },
    { label: 'Refuerzos', value: metricas?.refuerzos ?? 0, icon: Zap, color: 'text-cbvp-purple', bg: 'bg-cbvp-purple/8', border: 'border-cbvp-purple/20', bar: 'bg-cbvp-purple' },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {asistenciaStats.map((s, i) => (
            <div key={i} className={`relative overflow-hidden glass rounded-xl p-4 border ${s.border} card-hover`}>
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

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Acciones Rapidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/planillas" className="glass rounded-xl p-4 border border-white/[0.04] card-hover flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cbvp-red/8 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6 text-cbvp-red" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white">Planillas de Guardia</h4>
              <p className="text-xs text-white/40 mt-0.5">Cargar o ver planillas</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20" />
          </Link>

          <Link to="/historial" className="glass rounded-xl p-4 border border-white/[0.04] card-hover flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cbvp-orange/8 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-cbvp-orange" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white">Historial</h4>
              <p className="text-xs text-white/40 mt-0.5">Ver historial de guardias</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20" />
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div className="glass rounded-xl p-4 border border-cbvp-yellow/10 flex items-start gap-3">
        <Flame className="w-5 h-5 text-cbvp-yellow shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-white/70">
            Las metricas de asistencia se calcularan automaticamente a partir de las planillas de guardia procesadas. Proximamente estaran disponibles.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import {
  User, Shield, Award, Calendar, Hash, Radio,
  ClipboardCheck, TrendingUp, Flame, Star,
  ChevronRight, Clock, AlertTriangle
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

  // Find current user in personal list
  const miData = useMemo(() => {
    if (!personalData?.personal || !usuario) return null;
    return personalData.personal.find(
      p => p.correo?.toLowerCase().trim() === usuario.correo?.toLowerCase().trim()
    );
  }, [personalData, usuario]);

  // Calculate my guardia stats
  const misGuardias = useMemo(() => {
    if (!historialData?.exito || !miData) return [];

    return historialData.planillas.filter(planilla => {
      // Check if my codigo appears in the planilla (we'd need detalle, but for now estimate)
      return true; // placeholder - we'd need to check personal detail
    });
  }, [historialData, miData]);

  // Get my codigo from personal data
  const miCodigo = miData?.codigo || usuario?.identificador || '-';

  // Asistencia summary cards
  const asistenciaStats = [
    { label: 'Guardias Registradas', value: '-', icon: ClipboardCheck, color: 'text-cbvp-red', bg: 'bg-cbvp-red/8', bar: 'bg-cbvp-red', sub: 'Total' },
    { label: 'Presentes', value: '-', icon: Shield, color: 'text-cbvp-green', bg: 'bg-cbvp-green/8', bar: 'bg-cbvp-green', sub: 'Asistencia' },
    { label: 'ACACR', value: '-', icon: AlertTriangle, color: 'text-cbvp-orange', bg: 'bg-cbvp-orange/8', bar: 'bg-cbvp-orange', sub: 'Licencia' },
    { label: 'ACASR', value: '-', icon: Clock, color: 'text-cbvp-yellow', bg: 'bg-cbvp-yellow/8', bar: 'bg-cbvp-yellow', sub: 'Licencia' },
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
            <h2 className="text-lg font-bold text-white">{usuario.nombreCompleto}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-cbvp-red-light font-medium bg-cbvp-red/10 px-2 py-0.5 rounded-full">{usuario.rango}</span>
              <span className="text-xs text-white/30">|</span>
              <span className="text-xs text-white/40">Codigo: <span className="text-white/60 font-mono">{miCodigo}</span></span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Info fields */}
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-red/8 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-cbvp-red/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Cargo</p>
                <p className="text-sm text-white">{usuario.cargo || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-orange/8 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-cbvp-orange/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Categoria</p>
                <p className="text-sm text-white">{miData?.categoria || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-green/8 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-cbvp-green/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Ano de Juramento</p>
                <p className="text-sm text-white">{miData?.anioJuramento || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-blue/8 flex items-center justify-center shrink-0">
                <Hash className="w-4 h-4 text-cbvp-blue/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Codigo Radial</p>
                <p className="text-sm text-white font-mono">{miData?.codigoRadial || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-purple/8 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-cbvp-purple/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Nivel de Permiso</p>
                <p className="text-sm text-white">{usuario.nivelPermiso || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/[0.02] rounded-lg p-3">
              <div className="w-8 h-8 rounded-lg bg-cbvp-yellow/8 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-cbvp-yellow/60" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase">Correo</p>
                <p className="text-sm text-white truncate">{usuario.correo || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asistencia Stats */}
      <div>
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Metricas de Asistencia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {asistenciaStats.map((s, i) => (
            <div key={i} className="relative overflow-hidden glass rounded-xl p-4 border border-white/[0.04] card-hover">
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

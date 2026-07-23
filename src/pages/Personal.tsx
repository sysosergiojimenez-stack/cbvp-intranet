import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermiso } from '@/hooks/usePermiso';
import { trpc } from '@/providers/trpc';
import type { Personal, GuardiaHistorial, EstadisticasGuardias } from '@/types';
import {
  Search, User, Shield, Award, Calendar, Hash, Radio,
  Mail, FileText, X, Flame,
  Clock, Users, AlertTriangle, ChevronDown, ChevronUp, Pencil
} from 'lucide-react';

export default function PersonalPage() {
  const navigate = useNavigate();
  const { puedeVerPersonal } = usePermiso();
  const [search, setSearch] = useState('');
  const [selectedBombero, setSelectedBombero] = useState<Personal | null>(null);
  const { data: metricasData } = trpc.planillas.misMetricas.useQuery(
    { codigo: selectedBombero?.codigo || '' },
    { enabled: !!selectedBombero }
  );
  const fichaData: { guardias: GuardiaHistorial[]; stats: EstadisticasGuardias } | null =
    metricasData?.exito ? { guardias: metricasData.guardias, stats: metricasData.stats } : null;
  const [expandedStats, setExpandedStats] = useState(true);

  const { data: rpcData, isLoading: rpcLoading, error: rpcError } = trpc.personal.list.useQuery(
    undefined,
    { retry: 1, refetchOnWindowFocus: false }
  );

  const sortedPersonal = useMemo<Personal[]>(() => {
    if (!rpcData?.exito) return [];
    return rpcData.personal.map((p) => ({
      identificador: p.identificador,
      codigo: p.codigo,
      anioJuramento: p.anioJuramento,
      categoria: p.categoria,
      cargo: p.cargo,
      rango: p.rango,
      codigoRadial: p.codigoRadial,
      nombreCompleto: p.nombreCompleto,
      segundoNombre: '',
      segundoApellido: '',
      nroDoc: '',
      fechaNacimiento: '',
      correo: '',
      primerNombre: p.nombreCompleto.split(' ')[0] || '',
      primerApellido: p.nombreCompleto.split(' ').slice(1).join(' ') || '',
    })) as Personal[];
  }, [rpcData]);

  const filtered = useMemo<Personal[]>(() => {
    return sortedPersonal.filter((p: Personal) =>
      p.nombreCompleto.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria.toLowerCase().includes(search.toLowerCase()) ||
      p.rango.toLowerCase().includes(search.toLowerCase()) ||
      p.anioJuramento.includes(search)
    );
  }, [sortedPersonal, search]);

  const handleVerFicha = (bombero: Personal) => {
    setSelectedBombero(bombero);
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'GUARDIA NORMAL': return 'bg-cbvp-red/20 text-cbvp-red';
      case 'GUARDIA ESPECIAL': return 'bg-cbvp-orange/20 text-cbvp-orange';
      case 'REFUERZO': return 'bg-cbvp-purple/20 text-cbvp-purple';
      default: return 'bg-white/10 text-white/60';
    }
  };

  if (!puedeVerPersonal) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-6">Gestion del Personal</h1>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-cbvp-orange mx-auto mb-4" />
          <p className="text-white/60">No tienes permisos para acceder a este modulo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, codigo, categoria o rango..."
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cbvp-red/50 text-sm"
          />
        </div>

        {/* Error from backend */}
        {rpcError && (
          <div className="mb-4 p-4 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-cbvp-red shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-cbvp-red-light font-medium">Error al conectar con Google Sheets</p>
              <p className="text-xs text-white/40 mt-1">{rpcError.message}</p>
            </div>
          </div>
        )}

        {rpcLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-cbvp-red/30 border-t-cbvp-red rounded-full animate-spin" />
            <span className="ml-3 text-sm text-white/40">Cargando desde Google Sheets...</span>
          </div>
        )}

        {!rpcLoading && !rpcError && rpcData?.exito && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="relative overflow-hidden glass rounded-xl p-4 border border-cbvp-yellow/20 card-hover">
                <div className="absolute top-0 left-0 right-0 h-1 bg-cbvp-yellow" />
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-11 h-11 rounded-xl bg-cbvp-yellow/8 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-cbvp-yellow" />
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-white">{sortedPersonal.length}</span>
                    <p className="text-[11px] text-white/40 mt-0.5">Total de Bomberos</p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden glass rounded-xl p-4 border border-cbvp-green/20 card-hover">
                <div className="absolute top-0 left-0 right-0 h-1 bg-cbvp-green" />
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-11 h-11 rounded-xl bg-cbvp-green/8 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-cbvp-green" />
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-white">{sortedPersonal.filter((p: Personal) => p.categoria?.trim().toUpperCase() === 'ACTIVO').length}</span>
                    <p className="text-[11px] text-white/40 mt-0.5">Categoria Activo</p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden glass rounded-xl p-4 border border-cbvp-red/20 card-hover">
                <div className="absolute top-0 left-0 right-0 h-1 bg-cbvp-red" />
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-11 h-11 rounded-xl bg-cbvp-red/8 flex items-center justify-center shrink-0">
                    <Flame className="w-5 h-5 text-cbvp-red" />
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-white">{sortedPersonal.filter((p: Personal) => p.categoria?.trim().toUpperCase() === 'COMBATIENTE').length}</span>
                    <p className="text-[11px] text-white/40 mt-0.5">Categoria Combatiente</p>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden glass rounded-xl p-4 border border-cbvp-blue/20 card-hover">
                <div className="absolute top-0 left-0 right-0 h-1 bg-cbvp-blue" />
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-11 h-11 rounded-xl bg-cbvp-blue/8 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-cbvp-blue" />
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-white">{sortedPersonal.filter((p: Personal) => p.rango?.trim().toUpperCase() !== 'VOLUNTARIO(A)').length}</span>
                    <p className="text-[11px] text-white/40 mt-0.5">Oficiales</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vista tarjetas (movil) */}
            <div className="sm:hidden space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center text-white/40 py-12">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No hay bomberos registrados.
                </div>
              ) : (
                filtered.map((bombero: Personal) => (
                  <div
                    key={bombero.identificador}
                    onClick={() => handleVerFicha(bombero)}
                    className="bg-white/[0.03] border border-white/5 rounded-xl p-3 active:bg-cbvp-red/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{bombero.nombreCompleto}</p>
                        <p className="text-xs text-white/40">{bombero.categoria}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/editar-bombero/${bombero.codigo}`); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-cbvp-blue/20 text-white/40 hover:text-cbvp-blue transition-colors shrink-0"
                        title="Editar bombero"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                        <Award className="w-3 h-3 text-cbvp-red/60" />
                        {bombero.rango}
                      </span>
                      <code className="bg-white/5 px-1.5 py-0.5 rounded text-white/70">{bombero.codigo}</code>
                      <span className="text-white/40">Ano {bombero.anioJuramento}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Vista tabla (desktop) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase">
                    <th className="px-3 py-3 text-left rounded-tl-lg">Rango</th>
                    <th className="px-3 py-3 text-left">Categoria</th>
                    <th className="px-3 py-3 text-left">Codigo</th>
                    <th className="px-3 py-3 text-left">Anio</th>
                    <th className="px-3 py-3 text-left">Nombre Completo</th>
                    <th className="px-3 py-3 text-left rounded-tr-lg">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-12 text-center text-white/40">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No hay bomberos registrados.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((bombero: Personal) => (
                      <tr
                        key={bombero.identificador}
                        onClick={() => handleVerFicha(bombero)}
                        className="hover:bg-cbvp-red/5 cursor-pointer transition-colors group"
                      >
                        <td className="px-3 py-3">
                          <span className="text-xs bg-white/5 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                            <Award className="w-3 h-3 text-cbvp-red/60" />
                            {bombero.rango}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-white/60">{bombero.categoria}</td>
                        <td className="px-3 py-3"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/70">{bombero.codigo}</code></td>
                        <td className="px-3 py-3 text-white/60">{bombero.anioJuramento}</td>
                        <td className="px-3 py-3">
                          <span className="text-white font-medium group-hover:text-cbvp-red transition-colors">{bombero.nombreCompleto}</span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/editar-bombero/${bombero.codigo}`); }}
                            className="p-2.5 sm:p-1.5 rounded-lg bg-white/5 hover:bg-cbvp-blue/20 text-white/40 hover:text-cbvp-blue transition-colors"
                            title="Editar bombero"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-white/30 mt-3 text-center">Mostrando {filtered.length} bombero(s) desde Google Sheets</p>
          </>
        )}
      </div>

      {/* Ficha Modal */}
      {selectedBombero && fichaData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedBombero(null)}>
          <div className="bg-cbvp-dark-light border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-cbvp-red/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-cbvp-red" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedBombero.nombreCompleto}</h2>
                  <p className="text-xs text-white/40">{selectedBombero.rango} - {selectedBombero.cargo}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBombero(null)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <Hash className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Codigo</p><p className="text-sm text-white">{selectedBombero.codigo}</p></div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <Shield className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Categoria</p><p className="text-sm text-white">{selectedBombero.categoria}</p></div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <Award className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Rango</p><p className="text-sm text-white">{selectedBombero.rango}</p></div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Anio Juramento</p><p className="text-sm text-white">{selectedBombero.anioJuramento}</p></div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <Radio className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Codigo Radial</p><p className="text-sm text-white">{selectedBombero.codigoRadial || '-'}</p></div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Nro Documento</p><p className="text-sm text-white">{selectedBombero.nroDoc || '-'}</p></div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Fecha Nac.</p><p className="text-sm text-white">{selectedBombero.fechaNacimiento || '-'}</p></div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-cbvp-red/50" />
                  <div><p className="text-[10px] text-white/40 uppercase">Correo</p><p className="text-sm text-white">{selectedBombero.correo || '-'}</p></div>
                </div>
              </div>

              <div className="mb-4">
                <button onClick={() => setExpandedStats(!expandedStats)} className="flex items-center gap-2 mb-3">
                  {expandedStats ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                  <h3 className="text-sm font-semibold text-cbvp-red">Estadisticas de Guardias</h3>
                </button>
                {expandedStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/5">
                      <p className="text-2xl font-bold text-cbvp-red">{fichaData.stats.totalGuardias}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Total Guardias</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/5">
                      <p className="text-2xl font-bold text-cbvp-red-light">{fichaData.stats.guardiasNormales}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Guardias Normales</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/5">
                      <p className="text-2xl font-bold text-cbvp-orange">{fichaData.stats.guardiasEspeciales}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Guardias Especiales</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/5">
                      <p className="text-2xl font-bold text-cbvp-purple">{fichaData.stats.refuerzos}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Refuerzos</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-cbvp-green/20">
                      <p className="text-2xl font-bold text-cbvp-green">{fichaData.stats.presentes}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Presentes</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-cbvp-orange/20">
                      <p className="text-2xl font-bold text-cbvp-orange">{fichaData.stats.ausentesConReemplazo}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Ausente c/Reemplazo</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center border border-cbvp-red/20">
                      <p className="text-2xl font-bold text-cbvp-red-light">{fichaData.stats.ausentes}</p>
                      <p className="text-[10px] text-white/40 uppercase mt-1">Ausentes</p>
                    </div>
                  </div>
                )}
              </div>

              {fichaData.guardias.length > 0 ? (
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
                                  g.asistencia === 'AUSENTE CON REEMPLAZO' ? 'bg-cbvp-orange/20 text-cbvp-orange' :
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
                  <p className="text-white/40 text-sm">No hay guardias registradas para este bombero.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

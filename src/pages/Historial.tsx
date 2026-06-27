import { useState, useMemo } from 'react';
import { usePermiso } from '@/hooks/usePermiso';
import { PLANILLAS_MOCK, getGuardiasByPlanilla } from '@/data/mockData';
import type { PlanillaEncabezado, GuardiaPersonal } from '@/types';
import {
  Search, Eye, Pencil, Trash2, ExternalLink, X, Save,
  ChevronLeft, ChevronRight, FileText, AlertTriangle
} from 'lucide-react';

export default function Historial() {
  const { puedeVerHistorial, puedeEditarPlanillas, puedeEliminarPlanillas } = usePermiso();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewPlanilla, setViewPlanilla] = useState<string | null>(null);
  const [editPlanilla, setEditPlanilla] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [detalleData, setDetalleData] = useState<GuardiaPersonal[]>([]);
  const [planillas, setPlanillas] = useState<PlanillaEncabezado[]>(PLANILLAS_MOCK);
  const [editForm, setEditForm] = useState<Partial<PlanillaEncabezado>>({});
  const itemsPerPage = 5;

  const filtered = useMemo(() => {
    return planillas.filter(p =>
      p.idPlanilla.toLowerCase().includes(search.toLowerCase()) ||
      p.fechaGuardia.toLowerCase().includes(search.toLowerCase()) ||
      p.grupo.toLowerCase().includes(search.toLowerCase()) ||
      p.fechaCarga.toLowerCase().includes(search.toLowerCase())
    );
  }, [planillas, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleVer = (id: string) => {
    setDetalleData(getGuardiasByPlanilla(id));
    setViewPlanilla(id);
  };

  const handleEditar = (id: string) => {
    const planilla = planillas.find(p => p.idPlanilla === id);
    if (planilla) {
      setEditForm({ ...planilla });
      setEditPlanilla(id);
    }
  };

  const handleGuardarEdicion = () => {
    if (!editPlanilla) return;
    setPlanillas(prev => prev.map(p =>
      p.idPlanilla === editPlanilla ? { ...p, ...editForm } as PlanillaEncabezado : p
    ));
    setEditPlanilla(null);
    setEditForm({});
  };

  const handleEliminar = (id: string) => {
    setPlanillas(prev => prev.filter(p => p.idPlanilla !== id));
    setDeleteConfirm(null);
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'GUARDIA NORMAL': return 'bg-cbvp-red/20 text-cbvp-red';
      case 'GUARDIA ESPECIAL': return 'bg-cbvp-orange/20 text-cbvp-orange';
      case 'REFUERZO': return 'bg-cbvp-purple/20 text-cbvp-purple';
      case 'RADIO OPERADOR': return 'bg-cbvp-blue/20 text-cbvp-blue';
      case 'MOVIL': return 'bg-cbvp-teal/20 text-cbvp-teal';
      default: return 'bg-white/10 text-white/60';
    }
  };

  if (!puedeVerHistorial) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-6">Historial de Planillas</h1>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-cbvp-orange mx-auto mb-4" />
          <p className="text-white/60">No tienes permisos para acceder a este modulo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Historial de Planillas</h1>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por grupo, fecha o ID..."
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cbvp-red/50 text-sm"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase">
                <th className="px-3 py-3 text-left rounded-tl-lg">ID Planilla</th>
                <th className="px-3 py-3 text-left">Fecha Guardia</th>
                <th className="px-3 py-3 text-left">Grupo</th>
                <th className="px-3 py-3 text-left">Inicio</th>
                <th className="px-3 py-3 text-left">Finaliza</th>
                <th className="px-3 py-3 text-left">Cargado el</th>
                <th className="px-3 py-3 text-left rounded-tr-lg">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-white/40">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay planillas registradas.
                  </td>
                </tr>
              ) : (
                paginated.map(planilla => (
                  <tr key={planilla.idPlanilla} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/70">{planilla.idPlanilla}</code></td>
                    <td className="px-3 py-3 text-white/80">{planilla.fechaGuardia || '-'}</td>
                    <td className="px-3 py-3"><span className="text-xs font-medium bg-white/5 px-2 py-0.5 rounded">{planilla.grupo || '-'}</span></td>
                    <td className="px-3 py-3 text-white/60">{planilla.inicioGuardia || '-'}</td>
                    <td className="px-3 py-3 text-white/60">{planilla.finalizaGuardia || '-'}</td>
                    <td className="px-3 py-3 text-white/50 text-xs">{planilla.fechaCarga}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleVer(planilla.idPlanilla)} className="p-1.5 rounded-lg bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red transition-colors" title="Ver">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {puedeEditarPlanillas && (
                          <button onClick={() => handleEditar(planilla.idPlanilla)} className="p-1.5 rounded-lg bg-cbvp-orange/10 hover:bg-cbvp-orange/20 text-cbvp-orange transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {planilla.urlImagen && (
                          <a href={planilla.urlImagen} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-cbvp-blue/10 hover:bg-cbvp-blue/20 text-cbvp-blue transition-colors" title="Ver imagen">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {puedeEliminarPlanillas && (
                          <button onClick={() => setDeleteConfirm(planilla.idPlanilla)} className="p-1.5 rounded-lg bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light transition-colors" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-white/40">Mostrando {filtered.length} planilla(s)</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-white/60">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === page ? 'bg-cbvp-red text-white' : 'text-white/50 hover:bg-white/5'}`}>
                  {page}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-white/60">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewPlanilla && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPlanilla(null)}>
          <div className="bg-cbvp-dark-light border border-white/10 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h2 className="text-lg font-semibold text-cbvp-red">Detalle de Planilla</h2>
                <p className="text-xs text-white/40 font-mono mt-0.5">{viewPlanilla}</p>
              </div>
              <button onClick={() => setViewPlanilla(null)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {detalleData.length === 0 ? (
                <p className="text-white/40 text-center py-8">No hay personal registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase"><th className="px-3 py-2 text-left rounded-tl-lg">Tipo</th><th className="px-3 py-2 text-left">Codigo</th><th className="px-3 py-2 text-left">Nombre</th><th className="px-3 py-2 text-left">Asignacion</th><th className="px-3 py-2 text-left rounded-tr-lg">Asistencia</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {detalleData.map((p, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTipoBadge(p.tipo)}`}>{p.tipo}</span></td>
                          <td className="px-3 py-2"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{p.codigo || '-'}</code></td>
                          <td className="px-3 py-2 text-white">{p.nombre || '-'}</td>
                          <td className="px-3 py-2 text-white/60">{p.asignacion || '-'}</td>
                          <td className="px-3 py-2">
                            {p.asistencia ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                p.asistencia === 'PRESENTE' ? 'bg-cbvp-green/20 text-cbvp-green' :
                                p.asistencia === 'ACACR' ? 'bg-cbvp-orange/20 text-cbvp-orange' :
                                p.asistencia === 'ACASR' ? 'bg-cbvp-yellow/20 text-cbvp-yellow' :
                                'bg-cbvp-red/20 text-cbvp-red-light'
                              }`}>{p.asistencia}</span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-white/30 mt-3 text-right">Total: {detalleData.length} registro(s)</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPlanilla && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditPlanilla(null)}>
          <div className="bg-cbvp-dark-light border border-white/10 rounded-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-cbvp-orange">Editar Planilla</h2>
              <button onClick={() => setEditPlanilla(null)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Fecha Guardia</label><input value={editForm.fechaGuardia || ''} onChange={e => setEditForm(f => ({ ...f, fechaGuardia: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Grupo</label><input value={editForm.grupo || ''} onChange={e => setEditForm(f => ({ ...f, grupo: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Inicio</label><input value={editForm.inicioGuardia || ''} onChange={e => setEditForm(f => ({ ...f, inicioGuardia: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Finaliza</label><input value={editForm.finalizaGuardia || ''} onChange={e => setEditForm(f => ({ ...f, finalizaGuardia: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Director Sem</label><input value={editForm.directorSem || ''} onChange={e => setEditForm(f => ({ ...f, directorSem: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Comandante</label><input value={editForm.comandanteSemana || ''} onChange={e => setEditForm(f => ({ ...f, comandanteSemana: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
              </div>
              <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Oficial K20</label><input value={editForm.oficialK20 || ''} onChange={e => setEditForm(f => ({ ...f, oficialK20: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
              <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Novedades</label><textarea value={editForm.novedades || ''} onChange={e => setEditForm(f => ({ ...f, novedades: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50 resize-vertical" /></div>
              <button onClick={handleGuardarEdicion} className="w-full py-3 bg-cbvp-green hover:bg-cbvp-green/80 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cbvp-dark-light border border-white/10 rounded-2xl max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-cbvp-red mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Eliminar Planilla</h3>
            <p className="text-sm text-white/50 mb-6">Estas seguro de eliminar la planilla <code className="text-cbvp-red-light">{deleteConfirm}</code>? Esta accion no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm">Cancelar</button>
              <button onClick={() => handleEliminar(deleteConfirm)} className="flex-1 py-2.5 bg-cbvp-red hover:bg-cbvp-red-light text-white rounded-lg transition-colors text-sm font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

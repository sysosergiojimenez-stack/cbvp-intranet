import { useState, useMemo } from 'react';
import { usePermiso } from '@/hooks/usePermiso';
import { trpc } from '@/providers/trpc';
import type { PlanillaEncabezado, GuardiaPersonal } from '@/types';
import {
  Search, Eye, Pencil, Trash2, ExternalLink, X, Save,
  ChevronLeft, ChevronRight, FileText, AlertTriangle,
  ChevronDown, ChevronUp
} from 'lucide-react';

export default function Historial() {
  const { puedeVerHistorial, puedeEditarPlanillas, puedeEliminarPlanillas } = usePermiso();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewPlanilla, setViewPlanilla] = useState<string | null>(null);
  const [editPlanilla, setEditPlanilla] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlanillaEncabezado>>({});
  const [editPersonal, setEditPersonal] = useState<GuardiaPersonal[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    normal: true, especial: true, refuerzo: true,
  });
  const [editError, setEditError] = useState('');
  const itemsPerPage = 5;

  const { data: rpcData, isLoading: rpcLoading, error: rpcError, refetch } = trpc.planillas.historial.useQuery(
    undefined,
    { retry: 1, refetchOnWindowFocus: false }
  );

  const deleteMutation = trpc.planillas.eliminar.useMutation({
    onSuccess: () => { refetch(); setDeleteConfirm(null); },
    onError: (err) => { setEditError(err.message); },
  });

  const updateMutation = trpc.planillas.actualizarEncabezado.useMutation({
    onSuccess: () => { setEditError(''); },
    onError: (err) => { setEditError(err.message); },
  });

  const updatePersonalMutation = trpc.planillas.actualizarPersonal.useMutation({
    onSuccess: () => { setEditError(''); },
    onError: (err) => { setEditError(err.message); },
  });

  // View detail query
  const detalleQuery = trpc.planillas.detalle.useQuery(
    { idPlanilla: viewPlanilla || "" },
    { enabled: !!viewPlanilla, retry: 1 }
  );

  // Edit detail query
  const detalleEditQuery = trpc.planillas.detalle.useQuery(
    { idPlanilla: editPlanilla || "" },
    { enabled: !!editPlanilla, retry: 1 }
  );

  const listPlanillas: PlanillaEncabezado[] = useMemo(() => {
    if (!rpcData?.exito) return [];
    return rpcData.planillas;
  }, [rpcData]);

  const filtered = useMemo(() => {
    return listPlanillas.filter(p =>
      p.idPlanilla.toLowerCase().includes(search.toLowerCase()) ||
      p.fechaGuardia.toLowerCase().includes(search.toLowerCase()) ||
      p.grupo.toLowerCase().includes(search.toLowerCase()) ||
      p.fechaCarga.toLowerCase().includes(search.toLowerCase())
    );
  }, [listPlanillas, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // View detail lists
  const detalleList: GuardiaPersonal[] = detalleQuery.data?.personal || [];
  const guardiasNormalesView = detalleList.filter(p => p.tipo === 'GUARDIA NORMAL');
  const guardiasEspecialesView = detalleList.filter(p => p.tipo === 'GUARDIA ESPECIAL');
  const refuerzosView = detalleList.filter(p => p.tipo === 'REFUERZO');

  // Edit detail lists
  const guardiasNormalesEdit = editPersonal.filter(p => p.tipo === 'GUARDIA NORMAL');
  const guardiasEspecialesEdit = editPersonal.filter(p => p.tipo === 'GUARDIA ESPECIAL');
  const refuerzosEdit = editPersonal.filter(p => p.tipo === 'REFUERZO');

  const handleVer = (id: string) => {
    setViewPlanilla(id);
  };

  const handleEditar = (planilla: PlanillaEncabezado) => {
    setEditPlanilla(planilla.idPlanilla);
    setEditForm({ ...planilla });
    setEditPersonal([]);
    setEditError('');
  };

  // Load edit personal when detail query returns
  useMemo(() => {
    if (detalleEditQuery.data?.exito && editPlanilla) {
      setEditPersonal(detalleEditQuery.data.personal);
    }
  }, [detalleEditQuery.data, editPlanilla]);

  const handleGuardarEdicion = async () => {
    if (!editPlanilla) return;
    setEditError('');

    // 1. Update header
    await updateMutation.mutateAsync({
      idPlanilla: editPlanilla,
      datos: {
        fechaGuardia: editForm.fechaGuardia,
        grupo: editForm.grupo,
        inicioGuardia: editForm.inicioGuardia,
        finalizaGuardia: editForm.finalizaGuardia,
        directorSem: editForm.directorSem,
        comandanteSemana: editForm.comandanteSemana,
        oficialK20: editForm.oficialK20,
        novedades: editForm.novedades,
      },
    });

    // 2. Update personal (only changed fields)
    const personalToUpdate = editPersonal
      .filter(p => p.tipo === 'GUARDIA NORMAL' || p.tipo === 'GUARDIA ESPECIAL' || p.tipo === 'REFUERZO')
      .map(p => ({
        idFila: p.idFila,
        asignacion: p.asignacion,
        asistencia: p.asistencia,
      }));

    if (personalToUpdate.length > 0) {
      await updatePersonalMutation.mutateAsync({
        idPlanilla: editPlanilla,
        personal: personalToUpdate,
      });
    }

    // Close and refresh
    setEditPlanilla(null);
    setEditForm({});
    setEditPersonal([]);
    refetch();
  };

  const handleEliminar = async (id: string) => {
    setEditError('');
    try {
      await deleteMutation.mutateAsync({ idPlanilla: id });
    } catch {
      // error handled by onError
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updatePersonalField = (idFila: string, field: 'asignacion' | 'asistencia', value: string) => {
    setEditPersonal(prev => prev.map(p =>
      p.idFila === idFila ? { ...p, [field]: value } : p
    ));
  };

  const renderViewSection = (title: string, tipo: string, data: GuardiaPersonal[], key: string) => {
    if (data.length === 0) return null;
    return (
      <div className="mb-4">
        <button onClick={() => toggleSection(key)} className="flex items-center gap-2 w-full text-left mb-2">
          {expandedSections[key] ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          <h4 className={`text-sm font-semibold ${tipo === 'GUARDIA NORMAL' ? 'text-cbvp-red' : tipo === 'GUARDIA ESPECIAL' ? 'text-cbvp-orange' : 'text-cbvp-purple'}`}>
            {title} ({data.length})
          </h4>
        </button>
        {expandedSections[key] && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-white/60 text-xs uppercase ${tipo === 'GUARDIA NORMAL' ? 'bg-cbvp-red/10' : tipo === 'GUARDIA ESPECIAL' ? 'bg-cbvp-orange/10' : 'bg-cbvp-purple/10'}`}>
                  <th className="px-3 py-2 text-left rounded-tl-lg">Nro</th>
                  <th className="px-3 py-2 text-left">Codigo</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Asignacion</th>
                  <th className="px-3 py-2 text-left rounded-tr-lg">Asistencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((p, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-white/60">{i + 1}</td>
                    <td className="px-3 py-2.5"><code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{p.codigo || '-'}</code></td>
                    <td className="px-3 py-2.5 text-white">{p.nombre || '-'}</td>
                    <td className="px-3 py-2.5 text-white/60">{p.asignacion || '-'}</td>
                    <td className="px-3 py-2.5">
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
          </div>
        )}
      </div>
    );
  };

  const renderEditSection = (title: string, tipo: string, data: GuardiaPersonal[], key: string) => {
    if (data.length === 0) return null;
    return (
      <div className="mb-4">
        <button onClick={() => toggleSection(key)} className="flex items-center gap-2 w-full text-left mb-2">
          {expandedSections[key] ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          <h4 className={`text-sm font-semibold ${tipo === 'GUARDIA NORMAL' ? 'text-cbvp-red' : tipo === 'GUARDIA ESPECIAL' ? 'text-cbvp-orange' : 'text-cbvp-purple'}`}>
            {title} ({data.length})
          </h4>
        </button>
        {expandedSections[key] && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.map((p, i) => (
              <div key={p.idFila} className="flex items-center gap-2 bg-white/[0.02] rounded-lg p-2">
                <span className="text-xs text-white/30 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{p.nombre}</div>
                  <div className="text-[10px] text-white/40">{p.codigo}</div>
                </div>
                <input
                  value={p.asignacion || ''}
                  onChange={e => updatePersonalField(p.idFila, 'asignacion', e.target.value)}
                  placeholder="Asignacion"
                  className="w-32 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cbvp-orange/50"
                />
                <select
                  value={p.asistencia || ''}
                  onChange={e => updatePersonalField(p.idFila, 'asistencia', e.target.value)}
                  className="w-28 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cbvp-orange/50"
                >
                  <option value="">Asistencia</option>
                  <option value="PRESENTE">PRESENTE</option>
                  <option value="ACACR">ACACR</option>
                  <option value="ACASR">ACASR</option>
                  <option value="ASASR">ASASR</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
                            <button onClick={() => handleVer(planilla.idPlanilla)} className="p-1.5 rounded-lg bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red transition-colors" title="Ver"><Eye className="w-3.5 h-3.5" /></button>
                            {puedeEditarPlanillas && (
                              <button onClick={() => handleEditar(planilla)} className="p-1.5 rounded-lg bg-cbvp-orange/10 hover:bg-cbvp-orange/20 text-cbvp-orange transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                            {planilla.urlImagen && (
                              <a href={planilla.urlImagen} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-cbvp-blue/10 hover:bg-cbvp-blue/20 text-cbvp-blue transition-colors" title="Ver imagen"><ExternalLink className="w-3.5 h-3.5" /></a>
                            )}
                            {puedeEliminarPlanillas && (
                              <button onClick={() => setDeleteConfirm(planilla.idPlanilla)} className="p-1.5 rounded-lg bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <p className="text-xs text-white/40">Mostrando {filtered.length} planilla(s)</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-white/60"><ChevronLeft className="w-4 h-4" /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} onClick={() => setCurrentPage(page)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === page ? 'bg-cbvp-red text-white' : 'text-white/50 hover:bg-white/5'}`}>{page}</button>
                  ))}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-white/60"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </>
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
              <button onClick={() => setViewPlanilla(null)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {detalleQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-cbvp-red/30 border-t-cbvp-red rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-white/40">Cargando personal...</span>
                </div>
              )}
              {!detalleQuery.isLoading && detalleList.length === 0 && (
                <p className="text-white/40 text-center py-8">No hay personal registrado en esta planilla.</p>
              )}
              {detalleList.length > 0 && (
                <>
                  <p className="text-xs text-white/30 mb-4">Total: {detalleList.length} registro(s)</p>
                  {renderViewSection('Guardia Normal', 'GUARDIA NORMAL', guardiasNormalesView, 'normal')}
                  {renderViewSection('Guardias Especiales', 'GUARDIA ESPECIAL', guardiasEspecialesView, 'especial')}
                  {renderViewSection('Refuerzos', 'REFUERZO', refuerzosView, 'refuerzo')}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPlanilla && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditPlanilla(null)}>
          <div className="bg-cbvp-dark-light border border-white/10 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-cbvp-orange">Editar Planilla</h2>
              <button onClick={() => setEditPlanilla(null)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {editError && (
                <div className="p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light mb-4">
                  {editError}
                </div>
              )}

              {/* Encabezado */}
              <h3 className="text-sm font-semibold text-white mb-3">Encabezado</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Fecha Guardia</label><input value={editForm.fechaGuardia || ''} onChange={e => setEditForm(f => ({ ...f, fechaGuardia: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Grupo</label><input value={editForm.grupo || ''} onChange={e => setEditForm(f => ({ ...f, grupo: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Inicio</label><input value={editForm.inicioGuardia || ''} onChange={e => setEditForm(f => ({ ...f, inicioGuardia: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Finaliza</label><input value={editForm.finalizaGuardia || ''} onChange={e => setEditForm(f => ({ ...f, finalizaGuardia: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Director Sem</label><input value={editForm.directorSem || ''} onChange={e => setEditForm(f => ({ ...f, directorSem: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
                <div><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Comandante</label><input value={editForm.comandanteSemana || ''} onChange={e => setEditForm(f => ({ ...f, comandanteSemana: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
              </div>
              <div className="mb-4"><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Oficial K20</label><input value={editForm.oficialK20 || ''} onChange={e => setEditForm(f => ({ ...f, oficialK20: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50" /></div>
              <div className="mb-4"><label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Novedades</label><textarea value={editForm.novedades || ''} onChange={e => setEditForm(f => ({ ...f, novedades: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-orange/50 resize-vertical" /></div>

              {/* Personal */}
              <h3 className="text-sm font-semibold text-white mb-3 border-t border-white/5 pt-4">Personal</h3>
              {detalleEditQuery.isLoading && (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-cbvp-orange/30 border-t-cbvp-orange rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-white/40">Cargando personal...</span>
                </div>
              )}
              {editPersonal.length === 0 && !detalleEditQuery.isLoading && (
                <p className="text-white/40 text-center py-4 text-sm">No hay personal en esta planilla.</p>
              )}
              {editPersonal.length > 0 && (
                <>
                  {renderEditSection('Guardia Normal', 'GUARDIA NORMAL', guardiasNormalesEdit, 'normal')}
                  {renderEditSection('Guardias Especiales', 'GUARDIA ESPECIAL', guardiasEspecialesEdit, 'especial')}
                  {renderEditSection('Refuerzos', 'REFUERZO', refuerzosEdit, 'refuerzo')}
                </>
              )}

              <button
                onClick={handleGuardarEdicion}
                disabled={updateMutation.isPending || updatePersonalMutation.isPending}
                className="w-full mt-4 py-3 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending || updatePersonalMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cbvp-dark-light border border-white/10 rounded-2xl max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-cbvp-red mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Eliminar Planilla</h3>
            <p className="text-sm text-white/50 mb-6">Estas seguro de eliminar la planilla <code className="text-cbvp-red-light">{deleteConfirm}</code>? Esta accion no se puede deshacer.</p>
            {editError && <p className="text-xs text-cbvp-red-light mb-4">{editError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm">Cancelar</button>
              <button onClick={() => handleEliminar(deleteConfirm)} disabled={deleteMutation.isPending} className="flex-1 py-2.5 bg-cbvp-red hover:bg-cbvp-red-light disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium">
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

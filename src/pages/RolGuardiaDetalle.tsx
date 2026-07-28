import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { ArrowLeft, Plus, X, UserPlus, Trash2, Download } from 'lucide-react';
import { exportarRolGuardiaPdf } from '@/lib/exportarRolGuardiaPdf';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function AgregarPersonalForm({ idRol, idGrupo, onCerrar }: { idRol: string; idGrupo: string; onCerrar: () => void }) {
  const [busqueda, setBusqueda] = useState('');
  const [codigoSel, setCodigoSel] = useState('');
  const [radial, setRadial] = useState('');
  const [asignacion, setAsignacion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const utils = trpc.useUtils();
  const { data: personalResp } = trpc.personal.list.useQuery();
  const personalData = personalResp?.personal;
  const agregarMutation = trpc.rolesGuardia.agregarPersonal.useMutation({
    onSuccess: () => {
      utils.rolesGuardia.obtenerDetalle.invalidate({ idRol });
      onCerrar();
    },
    onError: () => setGuardando(false),
  });

  const resultados = useMemo(() => {
    if (!personalData || busqueda.trim().length < 2) return [];
    const b = busqueda.trim().toLowerCase();
    return personalData
      .filter(p => p.nombreCompleto.toLowerCase().includes(b) || p.codigo.toLowerCase().includes(b))
      .slice(0, 8);
  }, [personalData, busqueda]);

  const handleAgregar = () => {
    if (!codigoSel) return;
    setGuardando(true);
    agregarMutation.mutate({ idRol, idGrupo, codigo: codigoSel, radial, asignacion });
  };

  return (
    <div className="mt-2 p-3 bg-white/[0.03] border border-white/10 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white/70">Agregar personal al grupo</span>
        <button onClick={onCerrar} className="p-1 rounded hover:bg-white/10 text-white/40"><X className="w-3.5 h-3.5" /></button>
      </div>
      {!codigoSel ? (
        <div>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar bombero por nombre o codigo..."
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50"
          />
          {resultados.length > 0 && (
            <div className="mt-2 border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5">
              {resultados.map(p => (
                <button
                  key={p.codigo}
                  onClick={() => { setCodigoSel(p.codigo); setBusqueda(''); }}
                  className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 transition-colors"
                >
                  {p.codigo} — {p.nombreCompleto}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-white/80">
            Seleccionado: <span className="font-medium">{personalData?.find(p => p.codigo === codigoSel)?.nombreCompleto || codigoSel}</span>
            <button onClick={() => setCodigoSel('')} className="ml-2 text-xs text-cbvp-red/80 hover:text-cbvp-red">cambiar</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="text" value={radial} onChange={e => setRadial(e.target.value)} placeholder="Radial (opcional)" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 w-32" />
            <input type="text" value={asignacion} onChange={e => setAsignacion(e.target.value)} placeholder="Asignacion (ej: Combatiente)" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 flex-1 min-w-[180px]" />
            <button onClick={handleAgregar} disabled={guardando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm transition-colors">
              {guardando ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarioGrupo({ idGrupo, anio, mes, diasIniciales }: { idGrupo: string; anio: number; mes: number; diasIniciales: number[] }) {
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set(diasIniciales));
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const numDias = new Date(anio, mes, 0).getDate();

  const guardarMutation = trpc.rolesGuardia.guardarCalendario.useMutation({
    onSuccess: () => {
      setGuardando(false);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    },
    onError: () => setGuardando(false),
  });

  const toggleDia = (dia: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(dia)) next.delete(dia); else next.add(dia);
      return next;
    });
  };

  const handleGuardar = () => {
    setGuardando(true);
    guardarMutation.mutate({ idGrupo, anio, mes, dias: Array.from(seleccionados) });
  };

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white/70">{MESES[mes - 1]} {anio}</span>
        <button onClick={handleGuardar} disabled={guardando} className="px-2.5 py-1 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded text-[11px] transition-colors">
          {guardando ? 'Guardando...' : guardado ? 'Guardado' : 'Guardar'}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: numDias }, (_, i) => i + 1).map(dia => (
          <button
            key={dia}
            onClick={() => toggleDia(dia)}
            className={`aspect-square rounded text-[11px] font-medium transition-colors ${seleccionados.has(dia) ? 'bg-cbvp-green text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
          >
            {dia}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListaSeccion({ titulo, items, mostrarAsignacion, onAgregar, onQuitar, guardando }: {
  titulo: string;
  items: Array<{ id: string; codigo: string; nombre: string; radial: string; asignacion: string; observaciones: string }>;
  mostrarAsignacion: boolean;
  onAgregar: (codigo: string, radial: string, asignacion: string, observaciones: string) => void;
  onQuitar: (id: string) => void;
  guardando: boolean;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [codigoSel, setCodigoSel] = useState('');
  const [radial, setRadial] = useState('');
  const [asignacion, setAsignacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const { data: personalResp } = trpc.personal.list.useQuery();
  const personalData = personalResp?.personal;

  const resultados = useMemo(() => {
    if (!personalData || busqueda.trim().length < 2) return [];
    const b = busqueda.trim().toLowerCase();
    return personalData.filter(p => p.nombreCompleto.toLowerCase().includes(b) || p.codigo.toLowerCase().includes(b)).slice(0, 8);
  }, [personalData, busqueda]);

  const handleAgregar = () => {
    if (!codigoSel) return;
    onAgregar(codigoSel, radial, asignacion, observaciones);
    setMostrarForm(false);
    setCodigoSel('');
    setBusqueda('');
    setRadial('');
    setAsignacion('');
    setObservaciones('');
  };

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
        <button onClick={() => setMostrarForm(!mostrarForm)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-xs flex items-center gap-1.5 transition-colors">
          <UserPlus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-white/30 text-xs py-2">Sin personal en esta lista.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-white/5 text-white/40">
                <th className="text-left py-1.5 pr-3 font-medium">Codigo</th>
                <th className="text-left py-1.5 pr-3 font-medium">Nombre</th>
                <th className="text-left py-1.5 pr-3 font-medium">Radial</th>
                {mostrarAsignacion && <th className="text-left py-1.5 pr-3 font-medium">Asignacion</th>}
                <th className="text-left py-1.5 pr-3 font-medium">Observaciones</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-1.5 pr-3 text-white/60">{p.codigo}</td>
                  <td className="py-1.5 pr-3 text-white/80">{p.nombre}</td>
                  <td className="py-1.5 pr-3 text-white/50">{p.radial || '-'}</td>
                  {mostrarAsignacion && <td className="py-1.5 pr-3 text-white/50">{p.asignacion || '-'}</td>}
                  <td className="py-1.5 pr-3 text-white/50">{p.observaciones || '-'}</td>
                  <td className="py-1.5 text-right">
                    <button onClick={() => onQuitar(p.id)} className="p-1 rounded hover:bg-cbvp-red/10 text-white/30 hover:text-cbvp-red transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarForm && (
        <div className="mt-2 p-3 bg-white/[0.03] border border-white/10 rounded-lg">
          {!codigoSel ? (
            <div>
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar bombero por nombre o codigo..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50" />
              {resultados.length > 0 && (
                <div className="mt-2 border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5">
                  {resultados.map(p => (
                    <button key={p.codigo} onClick={() => { setCodigoSel(p.codigo); setBusqueda(''); }} className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 transition-colors">
                      {p.codigo} - {p.nombreCompleto}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-white/80">
                Seleccionado: <span className="font-medium">{personalData?.find(p => p.codigo === codigoSel)?.nombreCompleto || codigoSel}</span>
                <button onClick={() => setCodigoSel('')} className="ml-2 text-xs text-cbvp-red/80 hover:text-cbvp-red">cambiar</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <input type="text" value={radial} onChange={e => setRadial(e.target.value)} placeholder="Radial (opcional)" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 w-32" />
                {mostrarAsignacion && (
                  <input type="text" value={asignacion} onChange={e => setAsignacion(e.target.value)} placeholder="Asignacion" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 flex-1 min-w-[140px]" />
                )}
                <input type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Observaciones" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 flex-1 min-w-[140px]" />
                <button onClick={handleAgregar} disabled={guardando} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm transition-colors">
                  {guardando ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RolGuardiaDetalle() {
  const { id } = useParams<{ id: string }>();
  const idRol = id || '';
  const [mostrarAgregar, setMostrarAgregar] = useState<string | null>(null);
  const [mostrarNuevoGrupo, setMostrarNuevoGrupo] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [creandoGrupo, setCreandoGrupo] = useState(false);
  const [exportando, setExportando] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.rolesGuardia.obtenerDetalle.useQuery({ idRol }, { enabled: !!idRol });

  const crearGrupoMutation = trpc.rolesGuardia.crearGrupo.useMutation({
    onSuccess: () => {
      utils.rolesGuardia.obtenerDetalle.invalidate({ idRol });
      setMostrarNuevoGrupo(false);
      setNombreGrupo('');
      setCreandoGrupo(false);
    },
    onError: () => setCreandoGrupo(false),
  });

  const eliminarGrupoMutation = trpc.rolesGuardia.eliminarGrupo.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });

  const quitarPersonalMutation = trpc.rolesGuardia.quitarPersonal.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });

  const agregarEspecialMutation = trpc.rolesGuardia.agregarEspecial.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });
  const quitarEspecialMutation = trpc.rolesGuardia.quitarEspecial.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });
  const agregarLicenciaMutation = trpc.rolesGuardia.agregarLicencia.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });
  const quitarLicenciaMutation = trpc.rolesGuardia.quitarLicencia.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });
  const agregarActivoMutation = trpc.rolesGuardia.agregarActivo.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });
  const quitarActivoMutation = trpc.rolesGuardia.quitarActivo.useMutation({
    onSuccess: () => utils.rolesGuardia.obtenerDetalle.invalidate({ idRol }),
  });

  const handleCrearGrupo = () => {
    if (!nombreGrupo.trim()) return;
    setCreandoGrupo(true);
    crearGrupoMutation.mutate({ idRol, nombreGrupo: nombreGrupo.trim() });
  };

  const etiqueta = data?.cabecera
    ? `${MESES[data.cabecera.mesInicio - 1]} - ${MESES[data.cabecera.mesFin - 1]} ${data.cabecera.anioFin}`
    : '';

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/roles-guardia" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver a Roles de Guardia
      </Link>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        {isLoading ? (
          <div className="text-center py-6 text-white/40 text-sm">Cargando...</div>
        ) : !data?.exito ? (
          <div className="text-center py-6 text-white/40 text-sm">No se encontro el Rol de Guardia.</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Rol de Guardia — {etiqueta}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!data.cabecera) return;
                    setExportando(true);
                    try {
                      await exportarRolGuardiaPdf({
                        mesInicio: data.cabecera.mesInicio,
                        anioInicio: data.cabecera.anioInicio,
                        mesFin: data.cabecera.mesFin,
                        anioFin: data.cabecera.anioFin,
                        grupos: data.grupos || [],
                        especiales: data.especiales || [],
                        licencias: data.licencias || [],
                        activos: data.activos || [],
                      });
                    } finally {
                      setExportando(false);
                    }
                  }}
                  disabled={exportando}
                  className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> {exportando ? 'Generando PDF...' : 'Exportar PDF'}
                </button>
                <button onClick={() => setMostrarNuevoGrupo(true)} className="px-4 py-2 bg-cbvp-red hover:bg-cbvp-red/80 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
                  <Plus className="w-4 h-4" /> Nuevo Grupo
                </button>
              </div>
            </div>

            {mostrarNuevoGrupo && (
              <div className="mb-6 p-4 bg-white/[0.02] border border-white/10 rounded-lg flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Nombre del grupo</label>
                  <input type="text" value={nombreGrupo} onChange={e => setNombreGrupo(e.target.value)} placeholder="Ej: Grupo Nº 5" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50" />
                </div>
                <button onClick={handleCrearGrupo} disabled={creandoGrupo} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 disabled:opacity-50 text-cbvp-green rounded-lg text-sm transition-colors">
                  {creandoGrupo ? 'Creando...' : 'Crear Grupo'}
                </button>
                <button onClick={() => setMostrarNuevoGrupo(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/50">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {(!data.grupos || data.grupos.length === 0) ? (
              <div className="text-center py-6 text-white/40 text-sm">Todavia no hay grupos. Creá el primero con el boton de arriba.</div>
            ) : (
              <div className="space-y-4">
                {data.grupos.map((grupo) => (
                  <div key={grupo.id} className="bg-white/[0.02] border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">{grupo.nombreGrupo}</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setMostrarAgregar(mostrarAgregar === grupo.id ? null : grupo.id)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-xs flex items-center gap-1.5 transition-colors">
                          <UserPlus className="w-3.5 h-3.5" /> Agregar Personal
                        </button>
                        <button onClick={() => { if (confirm(`¿Eliminar "${grupo.nombreGrupo}" y todo su personal?`)) eliminarGrupoMutation.mutate({ idGrupo: grupo.id }); }} className="p-1.5 rounded-lg hover:bg-cbvp-red/10 text-white/30 hover:text-cbvp-red transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {grupo.personal.length === 0 ? (
                      <div className="text-white/30 text-xs py-2">Sin personal asignado todavia.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="border-b border-white/5 text-white/40">
                              <th className="text-left py-1.5 pr-3 font-medium">Codigo</th>
                              <th className="text-left py-1.5 pr-3 font-medium">Nombre</th>
                              <th className="text-left py-1.5 pr-3 font-medium">Radial</th>
                              <th className="text-left py-1.5 pr-3 font-medium">Asignacion</th>
                              <th className="w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.personal.map((p) => (
                              <tr key={p.id} className="border-b border-white/5">
                                <td className="py-1.5 pr-3 text-white/60">{p.codigo}</td>
                                <td className="py-1.5 pr-3 text-white/80">{p.nombre}</td>
                                <td className="py-1.5 pr-3 text-white/50">{p.radial || '-'}</td>
                                <td className="py-1.5 pr-3 text-white/50">{p.asignacion || '-'}</td>
                                <td className="py-1.5 text-right">
                                  <button onClick={() => quitarPersonalMutation.mutate({ idPersonal: p.id })} className="p-1 rounded hover:bg-cbvp-red/10 text-white/30 hover:text-cbvp-red transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Calendario de guardia</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <CalendarioGrupo idGrupo={grupo.id} anio={data.cabecera!.anioInicio} mes={data.cabecera!.mesInicio} diasIniciales={grupo.diasInicio} />
                        <CalendarioGrupo idGrupo={grupo.id} anio={data.cabecera!.anioFin} mes={data.cabecera!.mesFin} diasIniciales={grupo.diasFin} />
                      </div>
                    </div>

                    {mostrarAgregar === grupo.id && (
                      <AgregarPersonalForm idRol={idRol} idGrupo={grupo.id} onCerrar={() => setMostrarAgregar(null)} />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4 mt-6">
              <ListaSeccion
                titulo="Guardias Especiales"
                items={data.especiales || []}
                mostrarAsignacion={true}
                onAgregar={(codigo, radial, asignacion, observaciones) => agregarEspecialMutation.mutate({ idRol, codigo, radial, asignacion, observaciones })}
                onQuitar={(id) => quitarEspecialMutation.mutate({ id })}
                guardando={agregarEspecialMutation.isPending}
              />
              <ListaSeccion
                titulo="Licencias"
                items={data.licencias || []}
                mostrarAsignacion={false}
                onAgregar={(codigo, radial, _asignacion, observaciones) => agregarLicenciaMutation.mutate({ idRol, codigo, radial, observaciones })}
                onQuitar={(id) => quitarLicenciaMutation.mutate({ id })}
                guardando={agregarLicenciaMutation.isPending}
              />
              <ListaSeccion
                titulo="Activos"
                items={data.activos || []}
                mostrarAsignacion={true}
                onAgregar={(codigo, radial, asignacion, observaciones) => agregarActivoMutation.mutate({ idRol, codigo, radial, asignacion, observaciones })}
                onQuitar={(id) => quitarActivoMutation.mutate({ id })}
                guardando={agregarActivoMutation.isPending}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

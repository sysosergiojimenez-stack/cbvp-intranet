import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import { usePermiso } from '@/hooks/usePermiso';
import { Switch } from '@/components/ui/switch';
import { ACCIONES_PERMISO, type AccionPermiso } from '@contracts/permisos';
import { setAdminCredentials, clearAdminCredentials } from '@/lib/adminAuth';
import {
  AlertTriangle, CheckCircle, Save, Search, Shield, SlidersHorizontal, Users, Lock,
} from 'lucide-react';

type PermisoFlags = Record<AccionPermiso, boolean>;

const PERMISO_LABELS: Record<AccionPermiso, string> = {
  ver_todo: 'Ver dashboard completo',
  editar_planillas: 'Editar planillas',
  eliminar_planillas: 'Eliminar planillas',
  ver_personal: 'Ver modulo de personal',
  ver_historial: 'Ver historial',
  cargar_planillas: 'Cargar planillas',
  ver_perfil_propio: 'Ver perfil propio',
  configuracion: 'Acceso a configuracion',
  ver_informes: 'Ver informes de asistencia',
  gestionar_roles_guardia: 'Gestionar roles de guardia',
  crear_bombero: 'Agregar bomberos',
};

const PERMISO_KEYS = ACCIONES_PERMISO;

const CARGOS = [
  'Voluntario(a)',
  'COMANDANTE',
  'PRIMER OFICIAL',
  'SEGUNDO OFICIAL',
  'DESARROLLADOR',
];

const NIVEL_LABELS: Record<number, string> = {
  1: 'Basico',
  2: 'Operativo',
  3: 'Supervisor',
  4: 'Administrador',
  5: 'Total',
};

function flagsFromRecord(record: Record<string, boolean>): PermisoFlags {
  return PERMISO_KEYS.reduce((acc, key) => {
    acc[key] = !!record[key];
    return acc;
  }, {} as PermisoFlags);
}

export default function Configuracion() {
  const { usuario, syncUsuario } = useAuth();
  const { puedeConfiguracion } = usePermiso();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<'permisos' | 'usuarios'>('permisos');
  const [nivelSeleccionado, setNivelSeleccionado] = useState(5);
  const [permisosEdit, setPermisosEdit] = useState<PermisoFlags | null>(null);
  const [permisosMsg, setPermisosMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<string, { cargo: string; nivelPermiso: number }>>({});
  const [savingCodigo, setSavingCodigo] = useState<string | null>(null);
  const [usuarioMsg, setUsuarioMsg] = useState<{ codigo: string; type: 'ok' | 'err'; text: string } | null>(null);
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    if (adminPassword && usuario?.correo) {
      setAdminCredentials(usuario.correo, adminPassword);
    } else {
      clearAdminCredentials();
    }
    return () => clearAdminCredentials();
  }, [adminPassword, usuario?.correo]);

  const { data: nivelesData, isLoading: loadingNiveles } = trpc.permisos.obtenerNiveles.useQuery(
    undefined,
    { enabled: puedeConfiguracion }
  );

  const { data: personalData, isLoading: loadingPersonal } = trpc.personal.list.useQuery(
    undefined,
    { enabled: puedeConfiguracion }
  );

  const actualizarNivel = trpc.permisos.actualizarNivel.useMutation({
    onSuccess: async () => {
      await utils.permisos.obtenerNiveles.invalidate();
      setPermisosMsg({ type: 'ok', text: `Permisos del Nivel ${nivelSeleccionado} guardados` });
      setTimeout(() => setPermisosMsg(null), 3000);
    },
    onError: (err) => {
      setPermisosMsg({ type: 'err', text: err.message });
      if (err.message?.toLowerCase().includes('autorizado') || err.message?.includes('prohibido')) {
        setAdminPassword('');
        clearAdminCredentials();
      }
    },
  });

  const actualizarRol = trpc.personal.actualizarRolPermiso.useMutation({
    onSuccess: async (res, vars) => {
      setSavingCodigo(null);
      if (res.exito) {
        await utils.personal.list.invalidate();
        if (usuario?.codigo === vars.codigo) {
          syncUsuario({ cargo: vars.cargo, nivelPermiso: vars.nivelPermiso });
        }
        setUsuarioMsg({ codigo: vars.codigo, type: 'ok', text: 'Guardado' });
        setTimeout(() => setUsuarioMsg(null), 2500);
      } else {
        setUsuarioMsg({ codigo: vars.codigo, type: 'err', text: res.error || 'Error al guardar' });
      }
    },
    onError: (err, vars) => {
      setSavingCodigo(null);
      setUsuarioMsg({ codigo: vars.codigo, type: 'err', text: err.message });
      if (err.message?.toLowerCase().includes('autorizado') || err.message?.includes('prohibido')) {
        setAdminPassword('');
        clearAdminCredentials();
      }
    },
  });

  useEffect(() => {
    if (!nivelesData?.niveles) return;
    const nivel = nivelesData.niveles[nivelSeleccionado];
    if (nivel) setPermisosEdit(flagsFromRecord(nivel));
  }, [nivelesData, nivelSeleccionado]);

  const personal = useMemo(() => {
    if (!personalData?.exito) return [];
    return personalData.personal;
  }, [personalData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return personal.filter(p =>
      p.nombreCompleto.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      (p.cargo || '').toLowerCase().includes(q)
    );
  }, [personal, search]);

  const getEdit = (codigo: string, cargo: string, nivelPermiso: number) =>
    edits[codigo] ?? { cargo: cargo || 'Voluntario(a)', nivelPermiso };

  const setEdit = (codigo: string, patch: Partial<{ cargo: string; nivelPermiso: number }>) => {
    setEdits(prev => {
      const base = prev[codigo] ?? {
        cargo: personal.find(p => p.codigo === codigo)?.cargo || 'Voluntario(a)',
        nivelPermiso: personal.find(p => p.codigo === codigo)?.nivelPermiso ?? 1,
      };
      return { ...prev, [codigo]: { ...base, ...patch } };
    });
  };

  const guardarPermisosNivel = () => {
    if (!permisosEdit) return;
    const tieneAlMenosUno = Object.values(permisosEdit).some(Boolean);
    if (!tieneAlMenosUno) {
      setPermisosMsg({ type: 'err', text: 'Cada nivel debe tener al menos un permiso activo' });
      return;
    }
    setPermisosMsg(null);
    actualizarNivel.mutate({ nivel: nivelSeleccionado, ...permisosEdit });
  };

  const guardarUsuario = (codigo: string) => {
    const edit = getEdit(
      codigo,
      personal.find(p => p.codigo === codigo)?.cargo || '',
      personal.find(p => p.codigo === codigo)?.nivelPermiso ?? 1
    );
    setSavingCodigo(codigo);
    setUsuarioMsg(null);
    actualizarRol.mutate({ codigo, cargo: edit.cargo, nivelPermiso: edit.nivelPermiso });
  };

  if (!puedeConfiguracion) {
    return (
      <div className="animate-fade-in">
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-cbvp-orange mx-auto mb-4" />
          <p className="text-white/60">No tienes permisos para acceder a este modulo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Tu nivel</span>
          <p className="text-sm font-medium text-white">
            Nivel {usuario?.nivelPermiso || 1} — {NIVEL_LABELS[usuario?.nivelPermiso || 1]}
          </p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
        <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-2">
          Confirmar identidad para guardar cambios
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="password"
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            placeholder="Tu contrasena de acceso actual"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cbvp-red/50 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-xl w-fit">
        <button
          onClick={() => setTab('permisos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'permisos' ? 'bg-cbvp-red/20 text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Permisos por Nivel
        </button>
        <button
          onClick={() => setTab('usuarios')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'usuarios' ? 'bg-cbvp-red/20 text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Roles de Usuarios
        </button>
      </div>

      {tab === 'permisos' && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <p className="text-sm text-white/50 mb-4">
            Define que puede hacer cada nivel de permiso (1 a 5). Los cambios aplican a todos los usuarios con ese nivel.
          </p>

          <div className="flex flex-wrap gap-2 mb-5">
            {[5, 4, 3, 2, 1].map(n => (
              <button
                key={n}
                onClick={() => setNivelSeleccionado(n)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  nivelSeleccionado === n
                    ? 'bg-cbvp-red/15 border-cbvp-red/40 text-white'
                    : 'bg-white/[0.02] border-white/10 text-white/50 hover:text-white'
                }`}
              >
                Nivel {n}
                <span className="block text-[10px] font-normal text-white/40">{NIVEL_LABELS[n]}</span>
              </button>
            ))}
          </div>

          {permisosMsg && (
            <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              permisosMsg.type === 'ok'
                ? 'bg-cbvp-green/10 border border-cbvp-green/20 text-cbvp-green'
                : 'bg-cbvp-red/10 border border-cbvp-red/20 text-cbvp-red-light'
            }`}>
              {permisosMsg.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {permisosMsg.text}
            </div>
          )}

          {loadingNiveles || !permisosEdit ? (
            <div className="flex items-center justify-center py-10 text-white/40 text-sm">
              <div className="w-5 h-5 border-2 border-cbvp-red/30 border-t-cbvp-red rounded-full animate-spin mr-3" />
              Cargando permisos...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {PERMISO_KEYS.map(key => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/5"
                  >
                    <span className="text-sm text-white/80">{PERMISO_LABELS[key]}</span>
                    <Switch
                      checked={permisosEdit[key]}
                      onCheckedChange={checked =>
                        setPermisosEdit(prev => prev ? { ...prev, [key]: checked } : prev)
                      }
                      className="data-[state=checked]:bg-cbvp-red"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={guardarPermisosNivel}
                disabled={actualizarNivel.isPending || !adminPassword}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cbvp-red hover:bg-cbvp-red-light text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {actualizarNivel.isPending ? 'Guardando...' : `Guardar Nivel ${nivelSeleccionado}`}
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <p className="text-sm text-white/50 mb-4">
            Asigna el cargo y el nivel de permiso de cada bombero. El usuario debe volver a iniciar sesion para aplicar cambios en su sesion actual.
          </p>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, codigo o cargo..."
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cbvp-red/50 text-sm"
            />
          </div>

          {loadingPersonal ? (
            <div className="flex items-center justify-center py-10 text-white/40 text-sm">
              <div className="w-5 h-5 border-2 border-cbvp-red/30 border-t-cbvp-red rounded-full animate-spin mr-3" />
              Cargando personal...
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {filtered.map(p => {
                  const edit = getEdit(p.codigo, p.cargo, p.nivelPermiso);
                  const msg = usuarioMsg?.codigo === p.codigo ? usuarioMsg : null;
                  const dirty = edit.cargo !== (p.cargo || 'Voluntario(a)') || edit.nivelPermiso !== p.nivelPermiso;
                  return (
                    <div key={p.codigo} className="border border-white/5 rounded-xl p-3 bg-white/[0.02]">
                      <p className="text-white font-medium text-sm">{p.nombreCompleto}</p>
                      <p className="text-xs text-white/40 mb-3">{p.codigo}</p>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] text-white/40 uppercase">Cargo</label>
                          <select
                            value={edit.cargo}
                            onChange={e => setEdit(p.codigo, { cargo: e.target.value })}
                            className="w-full mt-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs"
                          >
                            {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 uppercase">Nivel</label>
                          <select
                            value={edit.nivelPermiso}
                            onChange={e => setEdit(p.codigo, { nivelPermiso: Number(e.target.value) })}
                            className="w-full mt-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs"
                          >
                            {[5, 4, 3, 2, 1].map(n => (
                              <option key={n} value={n}>Nivel {n} — {NIVEL_LABELS[n]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {msg && (
                        <p className={`text-xs mb-2 ${msg.type === 'ok' ? 'text-cbvp-green' : 'text-cbvp-red-light'}`}>
                          {msg.text}
                        </p>
                      )}
                      <button
                        onClick={() => guardarUsuario(p.codigo)}
                        disabled={!dirty || savingCodigo === p.codigo || !adminPassword}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cbvp-red/80 text-white text-xs disabled:opacity-40"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingCodigo === p.codigo ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cbvp-red/10 text-white/60 text-xs uppercase">
                      <th className="px-3 py-3 text-left rounded-tl-lg">Bombero</th>
                      <th className="px-3 py-3 text-left">Codigo</th>
                      <th className="px-3 py-3 text-left">Cargo</th>
                      <th className="px-3 py-3 text-left">Nivel</th>
                      <th className="px-3 py-3 text-left rounded-tr-lg">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-white/40">
                          No se encontraron bomberos.
                        </td>
                      </tr>
                    ) : (
                      filtered.map(p => {
                        const edit = getEdit(p.codigo, p.cargo, p.nivelPermiso);
                        const msg = usuarioMsg?.codigo === p.codigo ? usuarioMsg : null;
                        const dirty = edit.cargo !== (p.cargo || 'Voluntario(a)') || edit.nivelPermiso !== p.nivelPermiso;
                        return (
                          <tr key={p.codigo} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-cbvp-red/50 shrink-0" />
                                <span className="text-white font-medium">{p.nombreCompleto}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/70">{p.codigo}</code>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={edit.cargo}
                                onChange={e => setEdit(p.codigo, { cargo: e.target.value })}
                                className="w-full max-w-[180px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cbvp-red/50"
                              >
                                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={edit.nivelPermiso}
                                onChange={e => setEdit(p.codigo, { nivelPermiso: Number(e.target.value) })}
                                className="w-full max-w-[160px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cbvp-red/50"
                              >
                                {[5, 4, 3, 2, 1].map(n => (
                                  <option key={n} value={n}>{n} — {NIVEL_LABELS[n]}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => guardarUsuario(p.codigo)}
                                  disabled={!dirty || savingCodigo === p.codigo || !adminPassword}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cbvp-red/80 hover:bg-cbvp-red text-white text-xs disabled:opacity-40 transition-colors"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  {savingCodigo === p.codigo ? '...' : 'Guardar'}
                                </button>
                                {msg && (
                                  <span className={`text-xs ${msg.type === 'ok' ? 'text-cbvp-green' : 'text-cbvp-red-light'}`}>
                                    {msg.text}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-white/30 mt-3 text-center">
                {filtered.length} bombero(s) — cambios se guardan en Google Sheets
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

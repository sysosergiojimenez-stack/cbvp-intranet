import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { Flame, Plus, Save, Trash2, X, ArrowLeft, FileDown, Pencil, ClipboardList } from 'lucide-react';
import { exportarInformeIncendioPdf } from '@/lib/exportarInformeIncendioPdf';

interface Persona { nombre: string; ci: string; edad: string; nacionalidad: string }
interface VoluntarioConductor { movil: string; conductor: string; codigo: string }
interface VoluntarioCombatiente { movil: string; combatiente: string; codigo: string }

interface InformeForm {
  id?: string;
  salidaId: string;
  nServicio: string;
  movil: string;
  fecha: string;
  ordenDeSalida: string;
  horaSalida: string;
  horaLlegada: string;
  horaRetirada: string;
  direccion: string;
  frenteAlNo: string;
  entreCalle1: string;
  entreCalle2: string;
  ciudad: string;
  barrio: string;
  zona: string;
  alMandoDelActo: string;
  aCargoDeLaCompania: string;
  seguro: string;
  seguroEmpresa: string;
  seguroValor: string;
  magnitud: string;
  transporteAereoTipo: string;
  transporteTerrestreTipo: string;
  transporteAcuaticoTipo: string;
  edificioTipos: string[];
  edificioComercialTipoDetalle: string;
  edificioPublicoTipoDetalle: string;
  edificioMatConstruccion: string;
  edificioEspecificarTipo: string;
  forestalBosqueTipo: string;
  forestalPastizalTipo: string;
  forestalOtrosEspecificar: string;
  propietarioChofer: string;
  identCI: string;
  identEdad: string;
  identNacionalidad: string;
  identEstadoCivil: string;
  identRegNo: string;
  identTelPart: string;
  identDireccionPart: string;
  identTelLab: string;
  identDireccionLab: string;
  identMaterialContenidoRamo: string;
  vehiculoTipo: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoChapaNo: string;
  posibleCausa: string;
  posibleOrigen: string;
  estadoFuego: number | null;
  factoresPropagacion: string;
  accesoLocal: string;
  accesoViolentadoPor: string;
  colorLlamas: string;
  colorHumo: string;
  oloresIdentificados: string;
  materialesExplosivos: boolean;
  materialesInflamables: boolean;
  materialesToxicos: boolean;
  materialesOtros: boolean;
  inmueblesAfectadosFuego: string;
  inmueblesAfectadosExtincion: string;
  objetosAfectadosFuego: string;
  objetosAfectadosExtincion: string;
  heridos: Persona[];
  muertos: Persona[];
  materialesUtilizadosMoviles: string;
  materialesUtilizadosMenor: string;
  materialesUtilizadosAjenos: string;
  otrosDeApoyo: string;
  personalPolicialACargoDe: string;
  ministerioPublicoOficiadoPor: string;
  otrosDatosInteres: string;
  desarrolloDelInforme: string;
  nominaConductores: VoluntarioConductor[];
  nominaCombatientes: VoluntarioCombatiente[];
  nominaACargo: string;
  nominaFirma: string;
}

const formVacio: InformeForm = {
  salidaId: '', nServicio: '', movil: '', fecha: '', ordenDeSalida: '',
  horaSalida: '', horaLlegada: '', horaRetirada: '', direccion: '', frenteAlNo: '',
  entreCalle1: '', entreCalle2: '', ciudad: '', barrio: '', zona: '',
  alMandoDelActo: '', aCargoDeLaCompania: '',
  seguro: '', seguroEmpresa: '', seguroValor: '', magnitud: '',
  transporteAereoTipo: '', transporteTerrestreTipo: '', transporteAcuaticoTipo: '',
  edificioTipos: [], edificioComercialTipoDetalle: '', edificioPublicoTipoDetalle: '',
  edificioMatConstruccion: '', edificioEspecificarTipo: '',
  forestalBosqueTipo: '', forestalPastizalTipo: '', forestalOtrosEspecificar: '',
  propietarioChofer: '', identCI: '', identEdad: '', identNacionalidad: '', identEstadoCivil: '',
  identRegNo: '', identTelPart: '', identDireccionPart: '', identTelLab: '', identDireccionLab: '',
  identMaterialContenidoRamo: '',
  vehiculoTipo: '', vehiculoMarca: '', vehiculoModelo: '', vehiculoChapaNo: '',
  posibleCausa: '', posibleOrigen: '', estadoFuego: null, factoresPropagacion: '',
  accesoLocal: '', accesoViolentadoPor: '', colorLlamas: '', colorHumo: '', oloresIdentificados: '',
  materialesExplosivos: false, materialesInflamables: false, materialesToxicos: false, materialesOtros: false,
  inmueblesAfectadosFuego: '', inmueblesAfectadosExtincion: '', objetosAfectadosFuego: '', objetosAfectadosExtincion: '',
  heridos: [], muertos: [],
  materialesUtilizadosMoviles: '', materialesUtilizadosMenor: '', materialesUtilizadosAjenos: '',
  otrosDeApoyo: '', personalPolicialACargoDe: '', ministerioPublicoOficiadoPor: '', otrosDatosInteres: '',
  desarrolloDelInforme: '',
  nominaConductores: [], nominaCombatientes: [],
  nominaACargo: '', nominaFirma: '',
};

const EDIFICIO_TIPOS = ['Vivienda', 'Edificio', 'Comercial', 'Deposito', 'Industrial', 'Publico'];
const MAGNITUDES = ['Grande', 'Mediana', 'Pequena', 'No se trabajo', 'Falsa Alarma', 'Otros'];
const ESTADOS_FUEGO = [
  { n: 1, label: 'No se ve nada / Se investiga' },
  { n: 2, label: 'Se ve humo — Ataque interior rapido y agresivo' },
  { n: 3, label: 'Se ve humo y poco fuego — Ataque interior rapido y agresivo' },
  { n: 4, label: 'Fuego en desarrollo — Ataque interior cauteloso' },
  { n: 5, label: 'Fuego Activo — Ataque interior cauteloso' },
  { n: 6, label: 'Fuego Marginal — Ataque interior y cauteloso' },
  { n: 7, label: 'Total en llamas — Operaciones exteriores defensivas' },
  { n: 8, label: 'Inicio Descendente — Op. Ext. Defensivos, previendo colapso' },
  { n: 9, label: 'Descendente — Op. Ext. Defensivos, previendo colapso' },
  { n: 10, label: 'Remocion' },
];

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none [color-scheme:dark]';
const labelCls = 'text-xs text-white/40 mb-1 block';

function Campo({ label, value, onChange, type = 'text', placeholder, list }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; list?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} list={list} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{titulo}</h3>
      {children}
    </div>
  );
}

export default function InformeIncendio() {
  const [vista, setVista] = useState<'lista' | 'formulario'>('lista');
  const [form, setForm] = useState<InformeForm>({ ...formVacio });
  const [error, setError] = useState('');

  const utils = trpc.useUtils();
  const { data: pendientesData, isLoading: cargandoPendientes } = trpc.informeIncendio.salidasPendientes.useQuery(undefined, { enabled: vista === 'lista' });
  const { data: informesData, isLoading: cargandoInformes } = trpc.informeIncendio.listado.useQuery(undefined, { enabled: vista === 'lista' });
  const { data: personalData } = trpc.personal.list.useQuery();
  const guardarMutation = trpc.informeIncendio.guardar.useMutation();
  const eliminarMutation = trpc.informeIncendio.eliminar.useMutation();

  const sugerenciasPersonal = (personalData?.personal || [])
    .map(p => ({ value: `${p.primerNombre} ${p.primerApellido}`.trim(), label: p.nombreCompleto, codigo: p.codigoRadial }))
    .filter(p => p.value)
    .sort((a, b) => a.label.localeCompare(b.label));

  const iniciarNuevoInforme = async (salidaId: string, movil: string) => {
    setError('');
    const resp = await utils.client.informeIncendio.datosDesdeSalida.query({ salidaId });
    if (!resp.exito) { setError('No se pudo cargar la salida seleccionada.'); return; }
    setForm({
      ...formVacio,
      salidaId,
      movil,
      fecha: resp.datos.fecha,
      horaSalida: resp.datos.horaSalida,
      horaLlegada: resp.datos.horaLlegada,
      direccion: resp.datos.direccion,
      aCargoDeLaCompania: resp.datos.aCargoDeLaCompania,
      nominaConductores: resp.datos.conductor
        ? [{ movil, conductor: resp.datos.conductor, codigo: resp.datos.codigoConductor }]
        : [],
    });
    setVista('formulario');
  };

  const abrirInformeExistente = async (id: string) => {
    setError('');
    const resp = await utils.client.informeIncendio.obtener.query({ id });
    if (!resp.exito) { setError('No se pudo cargar el informe.'); return; }
    setForm({ ...formVacio, ...(resp.informe as Partial<InformeForm>), id });
    setVista('formulario');
  };

  const toggleEdificioTipo = (tipo: string) => {
    setForm(f => ({
      ...f,
      edificioTipos: f.edificioTipos.includes(tipo) ? f.edificioTipos.filter(t => t !== tipo) : [...f.edificioTipos, tipo],
    }));
  };

  const agregarPersona = (campo: 'heridos' | 'muertos') => {
    setForm(f => ({ ...f, [campo]: [...f[campo], { nombre: '', ci: '', edad: '', nacionalidad: '' }] }));
  };
  const actualizarPersona = (campo: 'heridos' | 'muertos', idx: number, clave: keyof Persona, valor: string) => {
    setForm(f => {
      const arr = [...f[campo]];
      arr[idx] = { ...arr[idx], [clave]: valor };
      return { ...f, [campo]: arr };
    });
  };
  const quitarPersona = (campo: 'heridos' | 'muertos', idx: number) => {
    setForm(f => ({ ...f, [campo]: f[campo].filter((_, i) => i !== idx) }));
  };

  const agregarConductor = () => setForm(f => ({ ...f, nominaConductores: [...f.nominaConductores, { movil: f.movil, conductor: '', codigo: '' }] }));
  const actualizarConductor = (idx: number, clave: keyof VoluntarioConductor, valor: string) => {
    setForm(f => {
      const arr = [...f.nominaConductores];
      arr[idx] = { ...arr[idx], [clave]: valor };
      if (clave === 'conductor') {
        const match = sugerenciasPersonal.find(p => p.value === valor);
        if (match) arr[idx].codigo = match.codigo;
      }
      return { ...f, nominaConductores: arr };
    });
  };
  const quitarConductor = (idx: number) => setForm(f => ({ ...f, nominaConductores: f.nominaConductores.filter((_, i) => i !== idx) }));

  const agregarCombatiente = () => setForm(f => ({ ...f, nominaCombatientes: [...f.nominaCombatientes, { movil: f.movil, combatiente: '', codigo: '' }] }));
  const actualizarCombatiente = (idx: number, clave: keyof VoluntarioCombatiente, valor: string) => {
    setForm(f => {
      const arr = [...f.nominaCombatientes];
      arr[idx] = { ...arr[idx], [clave]: valor };
      if (clave === 'combatiente') {
        const match = sugerenciasPersonal.find(p => p.value === valor);
        if (match) arr[idx].codigo = match.codigo;
      }
      return { ...f, nominaCombatientes: arr };
    });
  };
  const quitarCombatiente = (idx: number) => setForm(f => ({ ...f, nominaCombatientes: f.nominaCombatientes.filter((_, i) => i !== idx) }));

  const guardar = async () => {
    setError('');
    try {
      const resp = await guardarMutation.mutateAsync(form as any);
      if (!resp.exito) throw new Error('Error al guardar');
      setForm(f => ({ ...f, id: resp.id }));
      utils.informeIncendio.listado.invalidate();
      utils.informeIncendio.salidasPendientes.invalidate();
      alert('Informe guardado.');
    } catch (err: unknown) {
      setError('Error al guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm('Eliminar este informe de incendio?')) return;
    try {
      await eliminarMutation.mutateAsync({ id });
      utils.informeIncendio.listado.invalidate();
      utils.informeIncendio.salidasPendientes.invalidate();
    } catch (err: unknown) {
      alert('Error al eliminar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const exportar = async () => {
    try {
      await exportarInformeIncendioPdf(form);
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const pendientes = pendientesData?.salidas || [];
  const informes = informesData?.informes || [];

  if (vista === 'lista') {
    return (
      <div className="animate-fade-in space-y-6">
        <datalist id="informe-incendio-personal">
          {sugerenciasPersonal.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </datalist>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Flame className="w-5 h-5 text-cbvp-red" /> Informe de Servicios — Incendios</h1>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Salidas pendientes de informe</h2>
          {cargandoPendientes ? (
            <p className="text-sm text-white/40">Cargando...</p>
          ) : pendientes.length === 0 ? (
            <p className="text-sm text-white/40">No hay salidas de tipo incendio sin informe generado.</p>
          ) : (
            <div className="space-y-2">
              {pendientes.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="text-sm text-white">{s.fechaSalida} {s.horaSalida} · {s.movil} · <span className="text-cbvp-red-light">{s.tipoServicio}</span></p>
                    <p className="text-xs text-white/40 truncate">{s.direccion} — Conductor: {s.conductor || '-'}</p>
                  </div>
                  <button onClick={() => iniciarNuevoInforme(s.id, s.movil)} className="px-3 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red-light rounded-lg text-xs flex items-center gap-2 transition-colors shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Generar Informe
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Informes generados</h2>
          {cargandoInformes ? (
            <p className="text-sm text-white/40">Cargando...</p>
          ) : informes.length === 0 ? (
            <p className="text-sm text-white/40">Todavia no se genero ningun Informe de Incendio.</p>
          ) : (
            <div className="space-y-2">
              {informes.map(i => (
                <div key={i.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="text-sm text-white">{i.nServicio || 'Sin N° de Servicio'} — {i.fecha} · {i.movil}</p>
                    <p className="text-xs text-white/40 truncate">{i.direccion} {i.magnitud && `· Magnitud: ${i.magnitud}`}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => abrirInformeExistente(i.id)} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => eliminar(i.id)} className="p-2 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <datalist id="informe-incendio-personal">
        {sugerenciasPersonal.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </datalist>
      <div className="flex items-center justify-between">
        <button onClick={() => setVista('lista')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex items-center gap-2">
          {form.id && (
            <button onClick={exportar} className="px-4 py-2 bg-cbvp-green/10 hover:bg-cbvp-green/20 text-cbvp-green rounded-lg text-sm flex items-center gap-2 transition-colors">
              <FileDown className="w-4 h-4" /> Exportar PDF
            </button>
          )}
          <button onClick={guardar} disabled={guardarMutation.isPending} className="px-4 py-2 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-colors">
            <Save className="w-4 h-4" /> {guardarMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light">{error}</div>}

      <Seccion titulo="Encabezado">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="N° Servicio" value={form.nServicio} onChange={v => setForm({ ...form, nServicio: v })} />
          <div>
            <label className={labelCls}>Movil</label>
            <input type="text" value={form.movil} disabled className={`${inputCls} opacity-60`} />
          </div>
          <Campo label="Fecha" type="date" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} />
          <Campo label="Orden de Salida" value={form.ordenDeSalida} onChange={v => setForm({ ...form, ordenDeSalida: v })} />
          <Campo label="Hora de salida" type="time" value={form.horaSalida} onChange={v => setForm({ ...form, horaSalida: v })} />
          <Campo label="Hora de llegada" type="time" value={form.horaLlegada} onChange={v => setForm({ ...form, horaLlegada: v })} />
          <Campo label="Hora de retirada" type="time" value={form.horaRetirada} onChange={v => setForm({ ...form, horaRetirada: v })} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2"><Campo label="Direccion" value={form.direccion} onChange={v => setForm({ ...form, direccion: v })} /></div>
          <Campo label="Frente al N°" value={form.frenteAlNo} onChange={v => setForm({ ...form, frenteAlNo: v })} />
          <Campo label="Ciudad" value={form.ciudad} onChange={v => setForm({ ...form, ciudad: v })} />
          <Campo label="Entre calle" value={form.entreCalle1} onChange={v => setForm({ ...form, entreCalle1: v })} />
          <Campo label="y calle" value={form.entreCalle2} onChange={v => setForm({ ...form, entreCalle2: v })} />
          <Campo label="Barrio" value={form.barrio} onChange={v => setForm({ ...form, barrio: v })} />
          <Campo label="Zona" value={form.zona} onChange={v => setForm({ ...form, zona: v })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Campo label="Al mando del Acto" value={form.alMandoDelActo} onChange={v => setForm({ ...form, alMandoDelActo: v })} list="informe-incendio-personal" />
          <Campo label="A cargo de la Compania" value={form.aCargoDeLaCompania} onChange={v => setForm({ ...form, aCargoDeLaCompania: v })} list="informe-incendio-personal" />
        </div>
      </Seccion>

      <Seccion titulo="Seguro, magnitud y transporte">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Seguro</label>
            <select value={form.seguro} onChange={e => setForm({ ...form, seguro: e.target.value })} className={inputCls}>
              <option value="">-- Seleccionar --</option>
              <option value="SI">SI</option>
              <option value="NO">NO</option>
            </select>
          </div>
          <Campo label="Empresa" value={form.seguroEmpresa} onChange={v => setForm({ ...form, seguroEmpresa: v })} />
          <Campo label="Valor" value={form.seguroValor} onChange={v => setForm({ ...form, seguroValor: v })} />
        </div>
        <div>
          <label className={labelCls}>Magnitud</label>
          <div className="flex flex-wrap gap-2">
            {MAGNITUDES.map(m => (
              <button key={m} type="button" onClick={() => setForm({ ...form, magnitud: form.magnitud === m ? '' : m })} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${form.magnitud === m ? 'bg-cbvp-red text-white border-cbvp-red' : 'bg-white/5 text-white/60 border-white/10 hover:text-white'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Campo label="Transporte Aereo — Tipo" value={form.transporteAereoTipo} onChange={v => setForm({ ...form, transporteAereoTipo: v })} />
          <Campo label="Transporte Terrestre — Tipo" value={form.transporteTerrestreTipo} onChange={v => setForm({ ...form, transporteTerrestreTipo: v })} />
          <Campo label="Transporte Acuatico — Tipo" value={form.transporteAcuaticoTipo} onChange={v => setForm({ ...form, transporteAcuaticoTipo: v })} />
        </div>
      </Seccion>

      <Seccion titulo="Edificio y forestal">
        <div>
          <label className={labelCls}>Edificio</label>
          <div className="flex flex-wrap gap-2">
            {EDIFICIO_TIPOS.map(t => (
              <label key={t} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors ${form.edificioTipos.includes(t) ? 'bg-cbvp-red/10 border-cbvp-red/40 text-cbvp-red-light' : 'bg-white/5 border-white/10 text-white/60'}`}>
                <input type="checkbox" checked={form.edificioTipos.includes(t)} onChange={() => toggleEdificioTipo(t)} className="w-3.5 h-3.5" /> {t}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Campo label="Comercial — Tipo" value={form.edificioComercialTipoDetalle} onChange={v => setForm({ ...form, edificioComercialTipoDetalle: v })} />
          <Campo label="Publico — Tipo" value={form.edificioPublicoTipoDetalle} onChange={v => setForm({ ...form, edificioPublicoTipoDetalle: v })} />
          <Campo label="Material de Construccion" value={form.edificioMatConstruccion} onChange={v => setForm({ ...form, edificioMatConstruccion: v })} />
        </div>
        <Campo label="Especificar tipo" value={form.edificioEspecificarTipo} onChange={v => setForm({ ...form, edificioEspecificarTipo: v })} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Campo label="Bosque — Tipo" value={form.forestalBosqueTipo} onChange={v => setForm({ ...form, forestalBosqueTipo: v })} />
          <Campo label="Pastizal — Tipo" value={form.forestalPastizalTipo} onChange={v => setForm({ ...form, forestalPastizalTipo: v })} />
          <Campo label="Otros — Especificar" value={form.forestalOtrosEspecificar} onChange={v => setForm({ ...form, forestalOtrosEspecificar: v })} />
        </div>
      </Seccion>

      <Seccion titulo="Identificacion del local / transporte">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-2"><Campo label="Propietario / Chofer" value={form.propietarioChofer} onChange={v => setForm({ ...form, propietarioChofer: v })} /></div>
          <Campo label="C.I. N°" value={form.identCI} onChange={v => setForm({ ...form, identCI: v })} />
          <Campo label="Edad" value={form.identEdad} onChange={v => setForm({ ...form, identEdad: v })} />
          <Campo label="Nacionalidad" value={form.identNacionalidad} onChange={v => setForm({ ...form, identNacionalidad: v })} />
          <Campo label="Estado Civil" value={form.identEstadoCivil} onChange={v => setForm({ ...form, identEstadoCivil: v })} />
          <Campo label="Reg. N°" value={form.identRegNo} onChange={v => setForm({ ...form, identRegNo: v })} />
          <Campo label="Tel. Part." value={form.identTelPart} onChange={v => setForm({ ...form, identTelPart: v })} />
          <div className="col-span-2"><Campo label="Direccion Part." value={form.identDireccionPart} onChange={v => setForm({ ...form, identDireccionPart: v })} /></div>
          <Campo label="Tel. Lab." value={form.identTelLab} onChange={v => setForm({ ...form, identTelLab: v })} />
          <div className="col-span-2"><Campo label="Direccion Lab." value={form.identDireccionLab} onChange={v => setForm({ ...form, identDireccionLab: v })} /></div>
          <div className="col-span-2 md:col-span-4"><Campo label="Material contenido / ramo" value={form.identMaterialContenidoRamo} onChange={v => setForm({ ...form, identMaterialContenidoRamo: v })} /></div>
        </div>
      </Seccion>

      <Seccion titulo="Vehiculo (si aplica)">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Campo label="Tipo" value={form.vehiculoTipo} onChange={v => setForm({ ...form, vehiculoTipo: v })} />
          <Campo label="Marca" value={form.vehiculoMarca} onChange={v => setForm({ ...form, vehiculoMarca: v })} />
          <Campo label="Modelo" value={form.vehiculoModelo} onChange={v => setForm({ ...form, vehiculoModelo: v })} />
          <Campo label="Chapa N°" value={form.vehiculoChapaNo} onChange={v => setForm({ ...form, vehiculoChapaNo: v })} />
        </div>
      </Seccion>

      <Seccion titulo="Causa, origen y estado del fuego">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Posible Causa (fenomeno originario)</label>
            <textarea value={form.posibleCausa} onChange={e => setForm({ ...form, posibleCausa: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Posible Origen (objeto por donde comenzo)</label>
            <textarea value={form.posibleOrigen} onChange={e => setForm({ ...form, posibleOrigen: e.target.value })} rows={2} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Estado del fuego a la llegada de la dotacion</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ESTADOS_FUEGO.map(e => (
              <label key={e.n} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors ${form.estadoFuego === e.n ? 'bg-cbvp-red/10 border-cbvp-red/40 text-cbvp-red-light' : 'bg-white/5 border-white/10 text-white/60'}`}>
                <input type="radio" name="estadoFuego" checked={form.estadoFuego === e.n} onChange={() => setForm({ ...form, estadoFuego: e.n })} className="w-3.5 h-3.5" />
                <span><b>{e.n}.</b> {e.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Factores que han contribuido a la propagacion de las llamas</label>
          <textarea value={form.factoresPropagacion} onChange={e => setForm({ ...form, factoresPropagacion: e.target.value })} rows={2} className={inputCls} />
        </div>
      </Seccion>

      <Seccion titulo="Acceso, colores y materiales peligrosos">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Acceso al local</label>
            <select value={form.accesoLocal} onChange={e => setForm({ ...form, accesoLocal: e.target.value })} className={inputCls}>
              <option value="">-- Seleccionar --</option>
              <option value="Abierto">Abierto</option>
              <option value="Cerrado">Cerrado</option>
            </select>
          </div>
          <div className="md:col-span-2"><Campo label="Violentado por" value={form.accesoViolentadoPor} onChange={v => setForm({ ...form, accesoViolentadoPor: v })} /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Campo label="Color de las llamas" value={form.colorLlamas} onChange={v => setForm({ ...form, colorLlamas: v })} />
          <Campo label="Color del Humo" value={form.colorHumo} onChange={v => setForm({ ...form, colorHumo: v })} />
          <Campo label="Olores identificados" value={form.oloresIdentificados} onChange={v => setForm({ ...form, oloresIdentificados: v })} />
        </div>
        <div>
          <label className={labelCls}>Existencia de Materiales</label>
          <div className="flex flex-wrap gap-2">
            {([
              ['materialesExplosivos', 'Explosivos'], ['materialesInflamables', 'Inflamables'],
              ['materialesToxicos', 'Toxicos'], ['materialesOtros', 'Otros'],
            ] as const).map(([campo, label]) => (
              <label key={campo} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors ${form[campo] ? 'bg-cbvp-red/10 border-cbvp-red/40 text-cbvp-red-light' : 'bg-white/5 border-white/10 text-white/60'}`}>
                <input type="checkbox" checked={form[campo]} onChange={e => setForm({ ...form, [campo]: e.target.checked })} className="w-3.5 h-3.5" /> {label}
              </label>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Inmuebles y objetos afectados">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Campo label="Inmuebles afectados — Fuego" value={form.inmueblesAfectadosFuego} onChange={v => setForm({ ...form, inmueblesAfectadosFuego: v })} />
          <Campo label="Inmuebles afectados — Extincion" value={form.inmueblesAfectadosExtincion} onChange={v => setForm({ ...form, inmueblesAfectadosExtincion: v })} />
          <Campo label="Objetos afectados — Fuego" value={form.objetosAfectadosFuego} onChange={v => setForm({ ...form, objetosAfectadosFuego: v })} />
          <Campo label="Objetos afectados — Extincion" value={form.objetosAfectadosExtincion} onChange={v => setForm({ ...form, objetosAfectadosExtincion: v })} />
        </div>
      </Seccion>

      <Seccion titulo="Heridos">
        <TablaPersonas personas={form.heridos} onAgregar={() => agregarPersona('heridos')} onActualizar={(i, c, v) => actualizarPersona('heridos', i, c, v)} onQuitar={i => quitarPersona('heridos', i)} />
      </Seccion>

      <Seccion titulo="Muertos">
        <TablaPersonas personas={form.muertos} onAgregar={() => agregarPersona('muertos')} onActualizar={(i, c, v) => actualizarPersona('muertos', i, c, v)} onQuitar={i => quitarPersona('muertos', i)} />
      </Seccion>

      <Seccion titulo="Materiales utilizados y apoyo">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Campo label="Moviles" value={form.materialesUtilizadosMoviles} onChange={v => setForm({ ...form, materialesUtilizadosMoviles: v })} />
          <Campo label="Menor" value={form.materialesUtilizadosMenor} onChange={v => setForm({ ...form, materialesUtilizadosMenor: v })} />
          <Campo label="Ajenos" value={form.materialesUtilizadosAjenos} onChange={v => setForm({ ...form, materialesUtilizadosAjenos: v })} />
        </div>
        <Campo label="Otros de Apoyo" value={form.otrosDeApoyo} onChange={v => setForm({ ...form, otrosDeApoyo: v })} />
        <Campo label="Personal Policial a cargo de" value={form.personalPolicialACargoDe} onChange={v => setForm({ ...form, personalPolicialACargoDe: v })} />
        <Campo label="Ministerio Publico oficiado por" value={form.ministerioPublicoOficiadoPor} onChange={v => setForm({ ...form, ministerioPublicoOficiadoPor: v })} />
        <Campo label="Otros datos de interes" value={form.otrosDatosInteres} onChange={v => setForm({ ...form, otrosDatosInteres: v })} />
      </Seccion>

      <Seccion titulo="Desarrollo del informe">
        <textarea value={form.desarrolloDelInforme} onChange={e => setForm({ ...form, desarrolloDelInforme: e.target.value })} rows={8} className={inputCls} placeholder="Relato cronologico de la intervencion..." />
      </Seccion>

      <Seccion titulo="Nomina de voluntarios">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls}>Conductores</label>
            <button type="button" onClick={agregarConductor} className="text-xs text-cbvp-blue hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {form.nominaConductores.map((c, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                <input type="text" value={c.movil} onChange={e => actualizarConductor(idx, 'movil', e.target.value)} placeholder="Movil" className={inputCls} />
                <input type="text" list="informe-incendio-personal" value={c.conductor} onChange={e => actualizarConductor(idx, 'conductor', e.target.value)} placeholder="Conductor" className={`${inputCls} col-span-2`} />
                <div className="flex gap-2">
                  <input type="text" value={c.codigo} onChange={e => actualizarConductor(idx, 'codigo', e.target.value)} placeholder="Codigo" className={inputCls} />
                  <button type="button" onClick={() => quitarConductor(idx)} className="text-white/40 hover:text-cbvp-red shrink-0"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2 mt-2">
            <label className={labelCls}>Combatientes</label>
            <button type="button" onClick={agregarCombatiente} className="text-xs text-cbvp-blue hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {form.nominaCombatientes.map((c, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                <input type="text" value={c.movil} onChange={e => actualizarCombatiente(idx, 'movil', e.target.value)} placeholder="Movil" className={inputCls} />
                <input type="text" list="informe-incendio-personal" value={c.combatiente} onChange={e => actualizarCombatiente(idx, 'combatiente', e.target.value)} placeholder="Combatiente" className={`${inputCls} col-span-2`} />
                <div className="flex gap-2">
                  <input type="text" value={c.codigo} onChange={e => actualizarCombatiente(idx, 'codigo', e.target.value)} placeholder="Codigo" className={inputCls} />
                  <button type="button" onClick={() => quitarCombatiente(idx)} className="text-white/40 hover:text-cbvp-red shrink-0"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Campo label="A Cargo" value={form.nominaACargo} onChange={v => setForm({ ...form, nominaACargo: v })} list="informe-incendio-personal" />
          <Campo label="Firma (aclaracion)" value={form.nominaFirma} onChange={v => setForm({ ...form, nominaFirma: v })} />
        </div>
        <p className="text-xs text-white/30 italic">El Croquis del Lugar y la Prioridad de Rescate se completan a mano sobre el PDF impreso — son campos de dibujo, no de texto.</p>
      </Seccion>

      {error && <div className="p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light">{error}</div>}
      <div className="flex justify-end gap-2 pb-6">
        <button onClick={guardar} disabled={guardarMutation.isPending} className="px-5 py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-colors">
          <Save className="w-4 h-4" /> {guardarMutation.isPending ? 'Guardando...' : 'Guardar Informe'}
        </button>
      </div>
    </div>
  );
}

function TablaPersonas({ personas, onAgregar, onActualizar, onQuitar }: {
  personas: Persona[];
  onAgregar: () => void;
  onActualizar: (idx: number, campo: keyof Persona, valor: string) => void;
  onQuitar: (idx: number) => void;
}) {
  return (
    <div className="space-y-2">
      {personas.map((p, idx) => (
        <div key={idx} className="grid grid-cols-5 gap-2 items-center">
          <input type="text" value={p.nombre} onChange={e => onActualizar(idx, 'nombre', e.target.value)} placeholder="Nombre" className={`${inputCls} col-span-2`} />
          <input type="text" value={p.ci} onChange={e => onActualizar(idx, 'ci', e.target.value)} placeholder="C.I. N°" className={inputCls} />
          <input type="text" value={p.edad} onChange={e => onActualizar(idx, 'edad', e.target.value)} placeholder="Edad" className={inputCls} />
          <div className="flex gap-2">
            <input type="text" value={p.nacionalidad} onChange={e => onActualizar(idx, 'nacionalidad', e.target.value)} placeholder="Nacionalidad" className={inputCls} />
            <button type="button" onClick={() => onQuitar(idx)} className="text-white/40 hover:text-cbvp-red shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={onAgregar} className="text-xs text-cbvp-blue hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
    </div>
  );
}

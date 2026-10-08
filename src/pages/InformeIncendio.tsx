import { Fragment, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { Flame, Plus, Save, Trash2, X, ArrowLeft, FileDown, Pencil, ClipboardList } from 'lucide-react';
import { exportarInformeIncendioPdf } from '@/lib/exportarInformeIncendioPdf';
import { normalizarFechaISO } from '@/lib/fechas';
import { ORGANIZACION } from '@/config/organizacion';

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
  croquisFotos: string[];
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
  croquisFotos: [],
};

const EDIFICIO_TIPOS: [string, string][] = [
  ['Vivienda', 'Vivienda'], ['Edificio', 'Edificio'], ['Comercial', 'Comercial Tipo'],
  ['Deposito', 'Depósito'], ['Industrial', 'Industrial'], ['Publico', 'Público Tipo'],
];
const MAGNITUDES: [string, string][] = [
  ['Grande', 'Grande'], ['Mediana', 'Mediana'], ['Pequena', 'Pequeña'],
  ['No se trabajo', 'No se trabajó'], ['Falsa Alarma', 'Falsa Alarma'], ['Otros', 'Otros'],
];
const ESTADOS_FUEGO = [
  { n: 1, titulo: 'No se ve nada', sub: 'Se investiga' },
  { n: 2, titulo: 'Se ve humo', sub: 'Ataque interior rápido y agresivo' },
  { n: 3, titulo: 'Se ve humo y poco fuego', sub: 'Ataque interior rápido y agresivo' },
  { n: 4, titulo: 'Fuego en desarrollo', sub: 'Ataque interior cauteloso' },
  { n: 5, titulo: 'Fuego Activo', sub: 'Ataque interior cauteloso' },
  { n: 6, titulo: 'Fuego Marginal', sub: 'Ataque interior y cauteloso' },
  { n: 7, titulo: 'Total en llamas', sub: 'Operaciones exteriores Defensivas' },
  { n: 8, titulo: 'Inicio Descendente', sub: 'Op. Ext. Defensivos, previendo colapso' },
  { n: 9, titulo: 'Descendente', sub: 'Op. Ext. Defensivos, previendo colapso' },
  { n: 10, titulo: 'Remoción', sub: '' },
];

function fechaParaInput(valor: string): string {
  return normalizarFechaISO(valor);
}

function fechaParaGuardar(valor: string): string {
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return valor;
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

const ACCEPT_FOTO_CROQUIS = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

function mimeFotoCroquis(file: File): string {
  const raw = (file.type || '').toLowerCase();
  if (raw === 'image/jpeg' || raw === 'image/png' || raw === 'image/webp') return raw;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// ========================================================================
// Estilo "hoja de papel": blanco, texto negro, recuadros, como el
// formulario oficial impreso del CBVP.
// ========================================================================
const papelInputCls = 'bg-transparent border-none outline-none text-black text-[13px] flex-1 min-w-0 placeholder:text-gray-400 py-1 disabled:text-gray-500';

function CampoPapel({ label, value, onChange, type = 'text', placeholder, list, disabled, flex }: {
  label: string; value: string; onChange?: (v: string) => void; type?: string; placeholder?: string; list?: string; disabled?: boolean; flex?: number;
}) {
  return (
    <div className="flex items-center gap-1 px-2 min-w-0" style={{ flex: flex ?? 1 }}>
      <span className="text-[12.5px] font-bold text-black shrink-0 whitespace-nowrap">{label}:</span>
      <input type={type} list={list} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} className={papelInputCls} />
    </div>
  );
}

function FilaCampos({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap divide-x divide-black border-b border-black">{children}</div>;
}

function CasillaPapel({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-1 text-[12.5px] text-black cursor-pointer whitespace-nowrap">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-3.5 h-3.5 accent-black shrink-0" />
      {label}
    </label>
  );
}

function FilaCheckboxes({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 py-2 border-b border-black">
      <span className="text-[12.5px] font-bold text-black shrink-0">{label}</span>
      {children}
    </div>
  );
}

function CeldaEncabezadoValor({ header, value, onChange }: { header: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 min-w-[120px] px-2 py-1">
      <p className="text-[10.5px] font-bold text-black text-center uppercase">{header}</p>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full bg-transparent border-none outline-none text-black text-[13px] text-center placeholder:text-gray-400" />
    </div>
  );
}

function BloqueEtiqueta({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-black">
      <div className="w-24 sm:w-32 shrink-0 flex items-center px-2 py-1 border-r border-black">
        <span className="text-[11px] font-bold italic text-black leading-tight">{etiqueta}</span>
      </div>
      <div className="flex-1 min-w-0 divide-y divide-black">{children}</div>
    </div>
  );
}

function TituloSeccionPapel({ children }: { children: React.ReactNode }) {
  return <div className="text-center font-bold text-black text-sm py-2 border-b border-black bg-gray-50">{children}</div>;
}

export default function InformeIncendio() {
  const navigate = useNavigate();
  const location = useLocation();
  const llegada = location.state as { form?: InformeForm; desdeSalida?: boolean } | null;
  const desdeSalida = !!llegada?.desdeSalida;
  const [vista, setVista] = useState<'lista' | 'formulario'>(llegada?.form ? 'formulario' : 'lista');
  const [form, setForm] = useState<InformeForm>(llegada?.form ? { ...formVacio, ...llegada.form } : { ...formVacio });
  const [error, setError] = useState('');

  const utils = trpc.useUtils();
  const { data: informesData, isLoading: cargandoInformes } = trpc.informeIncendio.listado.useQuery(undefined, { enabled: vista === 'lista' });
  const { data: personalData } = trpc.personal.list.useQuery();
  const guardarMutation = trpc.informeIncendio.guardar.useMutation();
  const eliminarMutation = trpc.informeIncendio.eliminar.useMutation();
  const subirCroquisFotoMutation = trpc.informeIncendio.subirCroquisFoto.useMutation();
  const [subiendoCroquisIdx, setSubiendoCroquisIdx] = useState<number | null>(null);

  const sugerenciasPersonal = (personalData?.personal || [])
    .map(p => ({ value: `${p.primerNombre} ${p.primerApellido}`.trim(), label: p.nombreCompleto, codigo: p.codigoRadial }))
    .filter(p => p.value)
    .sort((a, b) => a.label.localeCompare(b.label));

  const abrirInformeExistente = async (id: string) => {
    setError('');
    const resp = await utils.client.informeIncendio.obtener.query({ id });
    if (!resp.exito) { setError('No se pudo cargar el informe.'); return; }
    const informe = resp.informe as Partial<InformeForm>;
    setForm({ ...formVacio, ...informe, id, fecha: fechaParaInput(String(informe.fecha || '')) });
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

  const subirFotoCroquis = async (idx: number, file: File) => {
    setError('');
    setSubiendoCroquisIdx(idx);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = mimeFotoCroquis(file);
      const resp = await subirCroquisFotoMutation.mutateAsync({ base64, mimeType });
      if (!resp.exito) throw new Error(resp.error || 'Error al subir la foto');
      setForm(f => {
        const fotos = [...f.croquisFotos];
        fotos[idx] = resp.url;
        return { ...f, croquisFotos: fotos };
      });
    } catch (err: unknown) {
      setError('Error al subir la foto: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSubiendoCroquisIdx(null);
    }
  };
  const quitarFotoCroquis = (idx: number) => {
    setForm(f => {
      const fotos = [...f.croquisFotos];
      fotos[idx] = '';
      return { ...f, croquisFotos: fotos };
    });
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
      const resp = await guardarMutation.mutateAsync({ ...form, fecha: fechaParaGuardar(form.fecha) } as any);
      if (!resp.exito) throw new Error('Error al guardar');
      setForm(f => ({ ...f, id: resp.id, nServicio: resp.nServicio }));
      utils.informeIncendio.listado.invalidate();
      utils.informeIncendio.salidasPendientes.invalidate();
      alert(`Informe N° ${resp.nServicio} guardado.`);
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
      await exportarInformeIncendioPdf({ ...form, fecha: fechaParaGuardar(form.fecha) });
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

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
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Informes cargados</h2>
          {cargandoInformes ? (
            <p className="text-sm text-white/40">Cargando...</p>
          ) : informes.length === 0 ? (
            <p className="text-sm text-white/40">Todavia no hay informes. Se cargan desde el boton Informe de cada salida 10:40 en Salidas de Movil.</p>
          ) : (
            <div className="space-y-2">
              {informes.map(i => (
                <div key={i.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="text-sm text-white">N° {i.nServicio || '—'} — {i.fecha} · {i.movil}</p>
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
        <button onClick={() => desdeSalida ? navigate('/salida-movil') : setVista('lista')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> {desdeSalida ? 'Volver a Salidas' : 'Volver'}
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

      {/* ================= HOJA ================= */}
      <div className="bg-white text-black rounded-lg overflow-hidden border border-black shadow-lg">
        {/* Encabezado del formulario */}
        <div className="flex items-center gap-3 p-3 border-b border-black">
          <img src="/escudo-cbvp.png" alt="" className="h-12 w-auto shrink-0" />
          <div className="flex-1 text-center">
            <p className="font-bold text-sm uppercase">{ORGANIZACION.nombreCompleto}</p>
            <p className="text-xs">COMPAÑÍA: {ORGANIZACION.compania}</p>
            <p className="font-bold text-lg mt-1">INFORME DE INCENDIO</p>
          </div>
        </div>

        <FilaCampos>
          <CampoPapel label="N° Servicio" value={form.nServicio || 'Se asigna al guardar'} disabled flex={1} />
          <CampoPapel label="Móvil" value={form.movil} disabled flex={1} />
          <CampoPapel label="Fecha" type="date" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} flex={1} />
          <CampoPapel label="Orden de Salida" value={form.ordenDeSalida} onChange={v => setForm({ ...form, ordenDeSalida: v })} flex={1.3} />
        </FilaCampos>

        <FilaCampos>
          <CampoPapel label="Hora de salida" type="time" value={form.horaSalida} onChange={v => setForm({ ...form, horaSalida: v })} />
          <CampoPapel label="Hora de llegada" type="time" value={form.horaLlegada} onChange={v => setForm({ ...form, horaLlegada: v })} />
          <CampoPapel label="Hora de retirada" type="time" value={form.horaRetirada} onChange={v => setForm({ ...form, horaRetirada: v })} />
        </FilaCampos>

        <FilaCampos>
          <CampoPapel label="Dirección" value={form.direccion} onChange={v => setForm({ ...form, direccion: v })} flex={2.2} />
          <CampoPapel label="Frente al N°" value={form.frenteAlNo} onChange={v => setForm({ ...form, frenteAlNo: v })} />
        </FilaCampos>

        <FilaCampos>
          <CampoPapel label="Entre" value={form.entreCalle1} onChange={v => setForm({ ...form, entreCalle1: v })} flex={1.6} />
          <CampoPapel label="y" value={form.entreCalle2} onChange={v => setForm({ ...form, entreCalle2: v })} />
        </FilaCampos>

        <FilaCampos>
          <CampoPapel label="Ciudad" value={form.ciudad} onChange={v => setForm({ ...form, ciudad: v })} flex={1.3} />
          <CampoPapel label="Barrio" value={form.barrio} onChange={v => setForm({ ...form, barrio: v })} />
          <CampoPapel label="Zona" value={form.zona} onChange={v => setForm({ ...form, zona: v })} />
        </FilaCampos>

        <FilaCampos>
          <CampoPapel label="Al mando del Acto" value={form.alMandoDelActo} onChange={v => setForm({ ...form, alMandoDelActo: v })} list="informe-incendio-personal" />
          <CampoPapel label="A cargo de la Compañía" value={form.aCargoDeLaCompania} onChange={v => setForm({ ...form, aCargoDeLaCompania: v })} list="informe-incendio-personal" />
        </FilaCampos>

        <div className="flex flex-wrap divide-x divide-black border-b border-black">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="text-[12.5px] font-bold text-black shrink-0">Seguro:</span>
            <CasillaPapel checked={form.seguro === 'SI'} onChange={() => setForm({ ...form, seguro: form.seguro === 'SI' ? '' : 'SI' })} label="SI" />
            <CasillaPapel checked={form.seguro === 'NO'} onChange={() => setForm({ ...form, seguro: form.seguro === 'NO' ? '' : 'NO' })} label="NO" />
          </div>
          <CampoPapel label="Empresa" value={form.seguroEmpresa} onChange={v => setForm({ ...form, seguroEmpresa: v })} flex={1.6} />
          <CampoPapel label="Valor" value={form.seguroValor} onChange={v => setForm({ ...form, seguroValor: v })} />
        </div>

        <FilaCheckboxes label="Magnitud:">
          {MAGNITUDES.map(([clave, texto]) => (
            <CasillaPapel key={clave} checked={form.magnitud === clave} onChange={() => setForm({ ...form, magnitud: form.magnitud === clave ? '' : clave })} label={texto} />
          ))}
        </FilaCheckboxes>

        <div className="flex border-b border-black">
          <div className="w-24 shrink-0 flex items-center px-2 py-1 border-r border-black">
            <span className="text-[12.5px] font-bold text-black">Transporte:</span>
          </div>
          <div className="flex-1 flex divide-x divide-black">
            <CeldaEncabezadoValor header="Aéreo - Tipo" value={form.transporteAereoTipo} onChange={v => setForm({ ...form, transporteAereoTipo: v })} />
            <CeldaEncabezadoValor header="Terrestre - Tipo" value={form.transporteTerrestreTipo} onChange={v => setForm({ ...form, transporteTerrestreTipo: v })} />
            <CeldaEncabezadoValor header="Acuático - Tipo" value={form.transporteAcuaticoTipo} onChange={v => setForm({ ...form, transporteAcuaticoTipo: v })} />
          </div>
        </div>

        <div className="flex border-b border-black">
          <div className="flex-[1.6] px-2 py-1.5 border-r border-black">
            <span className="text-[12.5px] font-bold text-black block mb-1">Edificio:</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {EDIFICIO_TIPOS.map(([clave, texto]) => (
                <CasillaPapel key={clave} checked={form.edificioTipos.includes(clave)} onChange={() => toggleEdificioTipo(clave)} label={texto} />
              ))}
            </div>
          </div>
          <CampoPapel label="Mat. Construcción" value={form.edificioMatConstruccion} onChange={v => setForm({ ...form, edificioMatConstruccion: v })} flex={1} />
        </div>
        <FilaCampos>
          <CampoPapel label="Comercial - Tipo" value={form.edificioComercialTipoDetalle} onChange={v => setForm({ ...form, edificioComercialTipoDetalle: v })} />
          <CampoPapel label="Público - Tipo" value={form.edificioPublicoTipoDetalle} onChange={v => setForm({ ...form, edificioPublicoTipoDetalle: v })} />
          <CampoPapel label="Especificar tipo" value={form.edificioEspecificarTipo} onChange={v => setForm({ ...form, edificioEspecificarTipo: v })} flex={1.6} />
        </FilaCampos>

        <div className="flex border-b border-black">
          <div className="w-24 shrink-0 flex items-center px-2 py-1 border-r border-black">
            <span className="text-[12.5px] font-bold text-black">Forestal:</span>
          </div>
          <div className="flex-1 flex divide-x divide-black">
            <CeldaEncabezadoValor header="Bosque - Tipo" value={form.forestalBosqueTipo} onChange={v => setForm({ ...form, forestalBosqueTipo: v })} />
            <CeldaEncabezadoValor header="Pastizal - Tipo" value={form.forestalPastizalTipo} onChange={v => setForm({ ...form, forestalPastizalTipo: v })} />
            <CeldaEncabezadoValor header="Otros - Especificar" value={form.forestalOtrosEspecificar} onChange={v => setForm({ ...form, forestalOtrosEspecificar: v })} />
          </div>
        </div>

        <BloqueEtiqueta etiqueta="Identificación del local / transporte">
          <FilaCampos><CampoPapel label="Propietario/Chofer" value={form.propietarioChofer} onChange={v => setForm({ ...form, propietarioChofer: v })} /></FilaCampos>
          <FilaCampos>
            <CampoPapel label="C.I. N°" value={form.identCI} onChange={v => setForm({ ...form, identCI: v })} />
            <CampoPapel label="Edad" value={form.identEdad} onChange={v => setForm({ ...form, identEdad: v })} />
            <CampoPapel label="Nacionalidad" value={form.identNacionalidad} onChange={v => setForm({ ...form, identNacionalidad: v })} />
          </FilaCampos>
          <FilaCampos>
            <CampoPapel label="E. Civil" value={form.identEstadoCivil} onChange={v => setForm({ ...form, identEstadoCivil: v })} />
            <CampoPapel label="Reg. N°" value={form.identRegNo} onChange={v => setForm({ ...form, identRegNo: v })} />
            <CampoPapel label="Tel. Part." value={form.identTelPart} onChange={v => setForm({ ...form, identTelPart: v })} />
          </FilaCampos>
          <FilaCampos>
            <CampoPapel label="Dirección part." value={form.identDireccionPart} onChange={v => setForm({ ...form, identDireccionPart: v })} flex={1.5} />
            <CampoPapel label="Tel. Lab." value={form.identTelLab} onChange={v => setForm({ ...form, identTelLab: v })} />
          </FilaCampos>
          <FilaCampos>
            <CampoPapel label="Dirección lab." value={form.identDireccionLab} onChange={v => setForm({ ...form, identDireccionLab: v })} />
            <CampoPapel label="Material contenido/ramo" value={form.identMaterialContenidoRamo} onChange={v => setForm({ ...form, identMaterialContenidoRamo: v })} flex={1.5} />
          </FilaCampos>
        </BloqueEtiqueta>

        <FilaCampos>
          <CampoPapel label="Vehículo tipo" value={form.vehiculoTipo} onChange={v => setForm({ ...form, vehiculoTipo: v })} />
          <CampoPapel label="Marca" value={form.vehiculoMarca} onChange={v => setForm({ ...form, vehiculoMarca: v })} />
          <CampoPapel label="Modelo" value={form.vehiculoModelo} onChange={v => setForm({ ...form, vehiculoModelo: v })} />
          <CampoPapel label="Chapa N°" value={form.vehiculoChapaNo} onChange={v => setForm({ ...form, vehiculoChapaNo: v })} />
        </FilaCampos>

        <div className="flex divide-x divide-black border-b border-black">
          <div className="flex-1 p-2">
            <p className="text-[12px] font-bold text-black text-center mb-1">Posible Causa (fenómeno originario)</p>
            <textarea value={form.posibleCausa} onChange={e => setForm({ ...form, posibleCausa: e.target.value })} rows={2} className="w-full bg-transparent border-none outline-none text-black text-[13px] resize-none" />
          </div>
          <div className="flex-1 p-2">
            <p className="text-[12px] font-bold text-black text-center mb-1">Posible Origen (objeto por donde comenzó)</p>
            <textarea value={form.posibleOrigen} onChange={e => setForm({ ...form, posibleOrigen: e.target.value })} rows={2} className="w-full bg-transparent border-none outline-none text-black text-[13px] resize-none" />
          </div>
        </div>

        <TituloSeccionPapel>Estado del Fuego a la llegada de la dotación</TituloSeccionPapel>
        <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-black">
          {ESTADOS_FUEGO.map((e, i) => (
            <label key={e.n} className={`flex flex-col items-center gap-1 p-2 border-black cursor-pointer ${(i % 5 !== 4) ? 'sm:border-r' : ''} ${i % 2 === 0 ? 'max-sm:border-r' : ''} ${i < 8 ? 'max-sm:border-b sm:border-b-0' : ''} ${i < 5 ? 'sm:border-b' : ''} ${form.estadoFuego === e.n ? 'bg-cbvp-red/10' : ''}`}>
              <img src={`/estado-fuego/${e.n}.png`} alt="" className="h-10 object-contain" />
              <div className="flex items-center gap-1">
                <input type="radio" name="estadoFuego" checked={form.estadoFuego === e.n} onChange={() => setForm({ ...form, estadoFuego: e.n })} className="w-3 h-3 accent-black shrink-0" />
                <span className="text-[10px] font-bold text-black text-center leading-tight">{e.n}- {e.titulo}</span>
              </div>
              {e.sub && <span className="text-[9px] text-gray-600 text-center leading-tight">{e.sub}</span>}
            </label>
          ))}
        </div>

        <div className="p-2 border-b border-black">
          <p className="text-[12.5px] font-bold text-black mb-1">Factores que han contribuido a la propagación de las llamas:</p>
          <textarea value={form.factoresPropagacion} onChange={e => setForm({ ...form, factoresPropagacion: e.target.value })} rows={2} className="w-full bg-transparent border-none outline-none text-black text-[13px] resize-none" />
        </div>

        <div className="flex flex-wrap items-center gap-3 px-2 py-2 border-b border-black">
          <span className="text-[12.5px] font-bold text-black">Acceso al local:</span>
          <CasillaPapel checked={form.accesoLocal === 'Abierto'} onChange={() => setForm({ ...form, accesoLocal: form.accesoLocal === 'Abierto' ? '' : 'Abierto' })} label="Abierto" />
          <CasillaPapel checked={form.accesoLocal === 'Cerrado'} onChange={() => setForm({ ...form, accesoLocal: form.accesoLocal === 'Cerrado' ? '' : 'Cerrado' })} label="Cerrado" />
          <div className="flex items-center gap-1 flex-1 min-w-[160px]">
            <span className="text-[12.5px] font-bold text-black whitespace-nowrap">Violentado por:</span>
            <input type="text" value={form.accesoViolentadoPor} onChange={e => setForm({ ...form, accesoViolentadoPor: e.target.value })} className={papelInputCls} />
          </div>
        </div>

        <FilaCampos>
          <CampoPapel label="Color de las llamas" value={form.colorLlamas} onChange={v => setForm({ ...form, colorLlamas: v })} />
          <CampoPapel label="Color del Humo" value={form.colorHumo} onChange={v => setForm({ ...form, colorHumo: v })} />
          <CampoPapel label="Olores identificados" value={form.oloresIdentificados} onChange={v => setForm({ ...form, oloresIdentificados: v })} />
        </FilaCampos>

        <FilaCheckboxes label="Existencia de Materiales:">
          <CasillaPapel checked={form.materialesExplosivos} onChange={() => setForm({ ...form, materialesExplosivos: !form.materialesExplosivos })} label="Explosivos" />
          <CasillaPapel checked={form.materialesInflamables} onChange={() => setForm({ ...form, materialesInflamables: !form.materialesInflamables })} label="Inflamables" />
          <CasillaPapel checked={form.materialesToxicos} onChange={() => setForm({ ...form, materialesToxicos: !form.materialesToxicos })} label="Tóxicos" />
          <CasillaPapel checked={form.materialesOtros} onChange={() => setForm({ ...form, materialesOtros: !form.materialesOtros })} label="Otros" />
        </FilaCheckboxes>

        <BloqueEtiqueta etiqueta="Inmuebles afectados">
          <FilaCampos><CampoPapel label="Fuego" value={form.inmueblesAfectadosFuego} onChange={v => setForm({ ...form, inmueblesAfectadosFuego: v })} /></FilaCampos>
          <FilaCampos><CampoPapel label="Extinción" value={form.inmueblesAfectadosExtincion} onChange={v => setForm({ ...form, inmueblesAfectadosExtincion: v })} /></FilaCampos>
        </BloqueEtiqueta>
        <BloqueEtiqueta etiqueta="Objetos afectados">
          <FilaCampos><CampoPapel label="Fuego" value={form.objetosAfectadosFuego} onChange={v => setForm({ ...form, objetosAfectadosFuego: v })} /></FilaCampos>
          <FilaCampos><CampoPapel label="Extinción" value={form.objetosAfectadosExtincion} onChange={v => setForm({ ...form, objetosAfectadosExtincion: v })} /></FilaCampos>
        </BloqueEtiqueta>

        {/* ---- Heridos / Muertos ---- */}
        <table className="w-full border-b border-black text-[12.5px]">
          <thead>
            <tr className="border-b border-black">
              <th className="w-20"></th>
              <th className="font-bold text-black py-1.5 border-l border-black">Nombres</th>
              <th className="font-bold text-black py-1.5 border-l border-black w-28">C.I. N°</th>
              <th className="font-bold text-black py-1.5 border-l border-black w-16">Edad</th>
              <th className="font-bold text-black py-1.5 border-l border-black w-32">Nacionalidad</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {(['heridos', 'muertos'] as const).map((campo) => {
              const personas = form[campo];
              const etiqueta = campo === 'heridos' ? 'HERIDOS' : 'MUERTOS';
              return (
                <Fragment key={campo}>
                  {personas.length === 0 ? (
                    <tr className="border-t border-black">
                      <td className="font-bold italic text-black text-center py-1.5">{etiqueta}</td>
                      <td colSpan={5} className="text-center text-gray-400 py-1.5 border-l border-black">Sin registros</td>
                    </tr>
                  ) : personas.map((p, idx) => (
                    <tr key={idx} className="border-t border-black">
                      {idx === 0 && <td rowSpan={personas.length} className="font-bold italic text-black text-center align-middle border-r border-black">{etiqueta}</td>}
                      <td className="border-l border-black px-1"><input type="text" value={p.nombre} onChange={e => actualizarPersona(campo, idx, 'nombre', e.target.value)} className="w-full bg-transparent border-none outline-none text-black text-[12.5px] py-1" /></td>
                      <td className="border-l border-black px-1"><input type="text" value={p.ci} onChange={e => actualizarPersona(campo, idx, 'ci', e.target.value)} className="w-full bg-transparent border-none outline-none text-black text-[12.5px] py-1" /></td>
                      <td className="border-l border-black px-1"><input type="text" value={p.edad} onChange={e => actualizarPersona(campo, idx, 'edad', e.target.value)} className="w-full bg-transparent border-none outline-none text-black text-[12.5px] py-1" /></td>
                      <td className="border-l border-black px-1"><input type="text" value={p.nacionalidad} onChange={e => actualizarPersona(campo, idx, 'nacionalidad', e.target.value)} className="w-full bg-transparent border-none outline-none text-black text-[12.5px] py-1" /></td>
                      <td className="text-center"><button type="button" onClick={() => quitarPersona(campo, idx)} className="text-gray-400 hover:text-cbvp-red"><X className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={6} className="text-right pr-2 py-1">
                      <button type="button" onClick={() => agregarPersona(campo)} className="text-[11px] text-cbvp-blue hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar {campo === 'heridos' ? 'herido' : 'muerto'}</button>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <BloqueEtiqueta etiqueta="Materiales Utilizados">
          <FilaCampos><CampoPapel label="Móviles" value={form.materialesUtilizadosMoviles} onChange={v => setForm({ ...form, materialesUtilizadosMoviles: v })} /></FilaCampos>
          <FilaCampos><CampoPapel label="Menor" value={form.materialesUtilizadosMenor} onChange={v => setForm({ ...form, materialesUtilizadosMenor: v })} /></FilaCampos>
          <FilaCampos><CampoPapel label="Ajenos" value={form.materialesUtilizadosAjenos} onChange={v => setForm({ ...form, materialesUtilizadosAjenos: v })} /></FilaCampos>
        </BloqueEtiqueta>

        <FilaCampos><CampoPapel label="Otros de Apoyo" value={form.otrosDeApoyo} onChange={v => setForm({ ...form, otrosDeApoyo: v })} /></FilaCampos>
        <FilaCampos><CampoPapel label="Personal Policial a cargo de" value={form.personalPolicialACargoDe} onChange={v => setForm({ ...form, personalPolicialACargoDe: v })} /></FilaCampos>
        <FilaCampos><CampoPapel label="Ministerio Público oficiado por" value={form.ministerioPublicoOficiadoPor} onChange={v => setForm({ ...form, ministerioPublicoOficiadoPor: v })} /></FilaCampos>
        <FilaCampos><CampoPapel label="Otros datos de interés" value={form.otrosDatosInteres} onChange={v => setForm({ ...form, otrosDatosInteres: v })} /></FilaCampos>

        {/* ---- Desarrollo | Prioridad de Rescate ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-black">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>Desarrollo del Informe</TituloSeccionPapel>
            <textarea value={form.desarrolloDelInforme} onChange={e => setForm({ ...form, desarrolloDelInforme: e.target.value })} rows={10} placeholder="Relato cronológico de la intervención..." className="w-full bg-transparent border-none outline-none text-black text-[13px] p-2 resize-none" />
          </div>
          <div>
            <TituloSeccionPapel>Prioridad de Rescate</TituloSeccionPapel>
            <div className="p-2">
              <img src="/prioridad-rescate.png" alt="Diagrama de prioridad de rescate" className="w-full" />
            </div>
          </div>
        </div>

        {/* ---- Nomina de Voluntarios | Croquis del Lugar ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>Nómina de Voluntarios</TituloSeccionPapel>
            <div className="p-2 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-bold text-black uppercase">Conductores</p>
                  <button type="button" onClick={agregarConductor} className="text-[11px] text-cbvp-blue hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
                </div>
                <div className="space-y-1">
                  {form.nominaConductores.map((c, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-1 items-center border-b border-gray-300">
                      <input type="text" value={c.movil} onChange={e => actualizarConductor(idx, 'movil', e.target.value)} placeholder="Móvil" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <input type="text" list="informe-incendio-personal" value={c.conductor} onChange={e => actualizarConductor(idx, 'conductor', e.target.value)} placeholder="Conductor" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <input type="text" value={c.codigo} onChange={e => actualizarConductor(idx, 'codigo', e.target.value)} placeholder="Código" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <button type="button" onClick={() => quitarConductor(idx)} className="text-gray-400 hover:text-cbvp-red shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-bold text-black uppercase">Combatientes</p>
                  <button type="button" onClick={agregarCombatiente} className="text-[11px] text-cbvp-blue hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
                </div>
                <div className="space-y-1">
                  {form.nominaCombatientes.map((c, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-1 items-center border-b border-gray-300">
                      <input type="text" value={c.movil} onChange={e => actualizarCombatiente(idx, 'movil', e.target.value)} placeholder="Móvil" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <input type="text" list="informe-incendio-personal" value={c.combatiente} onChange={e => actualizarCombatiente(idx, 'combatiente', e.target.value)} placeholder="Combatiente" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <input type="text" value={c.codigo} onChange={e => actualizarCombatiente(idx, 'codigo', e.target.value)} placeholder="Código" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <button type="button" onClick={() => quitarCombatiente(idx)} className="text-gray-400 hover:text-cbvp-red shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 space-y-2">
                <CampoPapel label="A Cargo" value={form.nominaACargo} onChange={v => setForm({ ...form, nominaACargo: v })} list="informe-incendio-personal" />
                <CampoPapel label="Firma (aclaración)" value={form.nominaFirma} onChange={v => setForm({ ...form, nominaFirma: v })} />
              </div>
            </div>
          </div>
          <div>
            <TituloSeccionPapel>Croquis del Lugar</TituloSeccionPapel>
            <div className="p-2">
              <p className="text-[11px] text-gray-500 mb-2">Hasta 9 fotos del lugar del siniestro.</p>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }, (_, idx) => form.croquisFotos[idx] || '').map((foto, idx) => (
                  <div key={idx} className="aspect-square border border-gray-400 overflow-hidden relative bg-gray-50">
                    {foto ? (
                      <>
                        <img src={foto} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => quitarFotoCroquis(idx)} className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-cbvp-red text-white rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                      </>
                    ) : (
                      <label className="w-full h-full flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 transition-colors">
                        {subiendoCroquisIdx === idx ? (
                          <span className="text-[10px]">...</span>
                        ) : (
                          <Plus className="w-5 h-5" />
                        )}
                        <input type="file" accept={ACCEPT_FOTO_CROQUIS} className="hidden" disabled={subiendoCroquisIdx !== null} onChange={e => { const file = e.target.files?.[0]; if (file) subirFotoCroquis(idx, file); e.target.value = ''; }} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light">{error}</div>}
      <div className="flex justify-end gap-2 pb-6">
        <button onClick={guardar} disabled={guardarMutation.isPending} className="px-5 py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-colors">
          <Save className="w-4 h-4" /> {guardarMutation.isPending ? 'Guardando...' : 'Guardar Informe'}
        </button>
      </div>
    </div>
  );
}

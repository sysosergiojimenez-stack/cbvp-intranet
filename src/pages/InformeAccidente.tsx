import { Fragment, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { Plus, Save, X, ArrowLeft, FileDown } from 'lucide-react';
import { exportarInformeAccidentePdf, NATURALEZAS, LUGARES } from '@/lib/exportarInformeAccidentePdf';
import { ORGANIZACION } from '@/config/organizacion';
import { CampoPapel, FilaCampos, CasillaPapel, BloqueEtiqueta, TituloSeccionPapel } from '@/pages/InformeIncendio';
import { ACCEPT_FOTO_CROQUIS, mimeFotoCroquis, fileToBase64 } from '@/lib/fotosCroquis';

interface Persona { nombre: string; ci: string; edad: string; nacionalidad: string }
interface Vehiculo {
  tipo: string; marca: string; modelo: string; color: string; chapaNo: string;
  conductor: string; ci: string; edad: string; registroNo: string; municipio: string; domicilio: string;
}
interface VoluntarioConductor { movil: string; conductor: string; codigo: string }
interface VoluntarioCombatiente { movil: string; combatiente: string; codigo: string }

interface InformeForm {
  id?: string;
  salidaId: string;
  tipoInforme: string;
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
  naturalezaTipos: string[];
  naturalezaOtros: string;
  lugarTipos: string[];
  vehiculos: Vehiculo[];
  heridos: Persona[];
  muertos: Persona[];
  totalAccidentados: string;
  totalHeridos: string;
  totalMuertos: string;
  materialesUtilizadosMoviles: string;
  materialesUtilizadosMenor: string;
  materialesUtilizadosAjenos: string;
  otrosDeApoyo: string;
  personalPolicialACargoDe: string;
  ministerioPublicoOficiadoPor: string;
  otrosDatosInteres: string;
  causasAccidente: string;
  desarrolloDelInforme: string;
  nominaConductores: VoluntarioConductor[];
  nominaCombatientes: VoluntarioCombatiente[];
  nominaACargo: string;
  nominaFirma: string;
  croquisFotos: string[];
}

const vehiculoVacio: Vehiculo = {
  tipo: '', marca: '', modelo: '', color: '', chapaNo: '',
  conductor: '', ci: '', edad: '', registroNo: '', municipio: '', domicilio: '',
};

const formVacio: InformeForm = {
  salidaId: '', tipoInforme: '10:41', nServicio: '', movil: '', fecha: '', ordenDeSalida: '',
  horaSalida: '', horaLlegada: '', horaRetirada: '', direccion: '', frenteAlNo: '',
  entreCalle1: '', entreCalle2: '', ciudad: '', barrio: '', zona: '',
  alMandoDelActo: '', aCargoDeLaCompania: '',
  naturalezaTipos: [], naturalezaOtros: '', lugarTipos: [],
  vehiculos: [{ ...vehiculoVacio }, { ...vehiculoVacio }, { ...vehiculoVacio }],
  heridos: [], muertos: [], totalAccidentados: '', totalHeridos: '', totalMuertos: '',
  materialesUtilizadosMoviles: '', materialesUtilizadosMenor: '', materialesUtilizadosAjenos: '',
  otrosDeApoyo: '', personalPolicialACargoDe: '', ministerioPublicoOficiadoPor: '', otrosDatosInteres: '',
  causasAccidente: '', desarrolloDelInforme: '',
  nominaConductores: [], nominaCombatientes: [],
  nominaACargo: '', nominaFirma: '',
  croquisFotos: [],
};

function fechaParaGuardar(valor: string): string {
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return valor;
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

// Siempre 3 recuadros de vehiculo, como el formulario impreso.
function conTresVehiculos(vehiculos: Vehiculo[] | undefined): Vehiculo[] {
  const base = [...(vehiculos || [])];
  while (base.length < 3) base.push({ ...vehiculoVacio });
  return base;
}

const celdaInputCls = 'w-full bg-transparent border-none outline-none text-black text-[12.5px] py-1';

export default function InformeAccidente() {
  const navigate = useNavigate();
  const location = useLocation();
  const llegada = location.state as { form?: Partial<InformeForm>; desdeSalida?: boolean } | null;
  const desdeSalida = !!llegada?.desdeSalida;
  const [form, setForm] = useState<InformeForm>(
    llegada?.form ? { ...formVacio, ...llegada.form, vehiculos: conTresVehiculos(llegada.form.vehiculos) } : { ...formVacio }
  );
  const [error, setError] = useState('');

  const utils = trpc.useUtils();
  const { data: personalData } = trpc.personal.list.useQuery();
  const guardarMutation = trpc.informeAccidente.guardar.useMutation();
  const subirCroquisFotoMutation = trpc.informeIncendio.subirCroquisFoto.useMutation();
  const [subiendoCroquisIdx, setSubiendoCroquisIdx] = useState<number | null>(null);

  const sugerenciasPersonal = (personalData?.personal || [])
    .map(p => ({ value: `${p.primerNombre} ${p.primerApellido}`.trim(), label: p.nombreCompleto, codigo: p.codigoRadial }))
    .filter(p => p.value)
    .sort((a, b) => a.label.localeCompare(b.label));

  const toggleEn = (campo: 'naturalezaTipos' | 'lugarTipos', clave: string) => {
    setForm(f => ({
      ...f,
      [campo]: f[campo].includes(clave) ? f[campo].filter(t => t !== clave) : [...f[campo], clave],
    }));
  };

  const actualizarVehiculo = (idx: number, clave: keyof Vehiculo, valor: string) => {
    setForm(f => {
      const arr = [...f.vehiculos];
      arr[idx] = { ...arr[idx], [clave]: valor };
      return { ...f, vehiculos: arr };
    });
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
      const resp = await subirCroquisFotoMutation.mutateAsync({ base64, mimeType: mimeFotoCroquis(file) });
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
      const resp = await guardarMutation.mutateAsync({ ...form, fecha: fechaParaGuardar(form.fecha) });
      if (!resp.exito) throw new Error('Error al guardar');
      setForm(f => ({ ...f, id: resp.id, nServicio: resp.nServicio }));
      utils.informeAccidente.listado.invalidate();
      alert(`Informe N° ${resp.nServicio} guardado.`);
    } catch (err: unknown) {
      setError('Error al guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const exportar = async () => {
    try {
      await exportarInformeAccidentePdf({ ...form, fecha: fechaParaGuardar(form.fecha) });
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  // Sin un informe cargado (entrada directa a la URL) se vuelve a la lista.
  if (!llegada?.form) return <Navigate to="/informe-servicios" replace />;

  return (
    <div className="animate-fade-in space-y-4">
      <datalist id="informe-accidente-personal">
        {sugerenciasPersonal.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </datalist>
      <div className="flex items-center justify-between">
        <button onClick={() => desdeSalida ? navigate('/salida-movil') : navigate('/informe-servicios')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
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
        <div className="flex items-center gap-3 p-3 border-b border-black">
          <img src="/escudo-cbvp.png" alt="" className="h-12 w-auto shrink-0" />
          <div className="flex-1 text-center">
            <p className="font-bold text-sm uppercase">{ORGANIZACION.nombreCompleto}</p>
            <p className="text-xs">COMPAÑÍA: {ORGANIZACION.compania}</p>
            <div className="flex items-center justify-center gap-4 mt-1">
              <p className="font-bold text-lg">INFORME DE</p>
              <CasillaPapel checked={form.tipoInforme === '10:41'} onChange={() => setForm({ ...form, tipoInforme: '10:41' })} label="10:41" />
              <CasillaPapel checked={form.tipoInforme === '10:42'} onChange={() => setForm({ ...form, tipoInforme: '10:42' })} label="10:42" />
            </div>
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
          <CampoPapel label="Al mando del Acto" value={form.alMandoDelActo} onChange={v => setForm({ ...form, alMandoDelActo: v })} list="informe-accidente-personal" />
          <CampoPapel label="A cargo de la Compañía" value={form.aCargoDeLaCompania} onChange={v => setForm({ ...form, aCargoDeLaCompania: v })} list="informe-accidente-personal" />
        </FilaCampos>

        <BloqueEtiqueta etiqueta="Naturaleza de intervención">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 px-2 py-2">
            {NATURALEZAS.map(([clave, texto]) => (
              <CasillaPapel key={clave} checked={form.naturalezaTipos.includes(clave)} onChange={() => toggleEn('naturalezaTipos', clave)} label={texto} />
            ))}
          </div>
          <FilaCampos><CampoPapel label="Otros (especificar)" value={form.naturalezaOtros} onChange={v => setForm({ ...form, naturalezaOtros: v })} /></FilaCampos>
        </BloqueEtiqueta>

        <BloqueEtiqueta etiqueta="Lugar">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 px-2 py-2">
            {LUGARES.map(([clave, texto]) => (
              <CasillaPapel key={clave} checked={form.lugarTipos.includes(clave)} onChange={() => toggleEn('lugarTipos', clave)} label={texto} />
            ))}
          </div>
        </BloqueEtiqueta>

        <TituloSeccionPapel>VEHÍCULOS INVOLUCRADOS</TituloSeccionPapel>
        {form.vehiculos.map((v, idx) => (
          <div key={idx} className="border-b border-black">
            <FilaCampos>
              <CampoPapel label="Tipo" value={v.tipo} onChange={val => actualizarVehiculo(idx, 'tipo', val)} />
              <CampoPapel label="Marca" value={v.marca} onChange={val => actualizarVehiculo(idx, 'marca', val)} />
              <CampoPapel label="Modelo" value={v.modelo} onChange={val => actualizarVehiculo(idx, 'modelo', val)} />
            </FilaCampos>
            <FilaCampos>
              <CampoPapel label="Color" value={v.color} onChange={val => actualizarVehiculo(idx, 'color', val)} />
              <CampoPapel label="Chapa N°" value={v.chapaNo} onChange={val => actualizarVehiculo(idx, 'chapaNo', val)} />
            </FilaCampos>
            <FilaCampos>
              <CampoPapel label="Nombre del Conductor" value={v.conductor} onChange={val => actualizarVehiculo(idx, 'conductor', val)} flex={2} />
              <CampoPapel label="C.I. N°" value={v.ci} onChange={val => actualizarVehiculo(idx, 'ci', val)} />
            </FilaCampos>
            <FilaCampos>
              <CampoPapel label="Edad" value={v.edad} onChange={val => actualizarVehiculo(idx, 'edad', val)} />
              <CampoPapel label="Registro N°" value={v.registroNo} onChange={val => actualizarVehiculo(idx, 'registroNo', val)} />
              <CampoPapel label="Municipio" value={v.municipio} onChange={val => actualizarVehiculo(idx, 'municipio', val)} />
            </FilaCampos>
            <div className="flex"><CampoPapel label="Domicilio" value={v.domicilio} onChange={val => actualizarVehiculo(idx, 'domicilio', val)} /></div>
          </div>
        ))}

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
                      {(['nombre', 'ci', 'edad', 'nacionalidad'] as const).map(clave => (
                        <td key={clave} className="border-l border-black px-1"><input type="text" value={p[clave]} onChange={e => actualizarPersona(campo, idx, clave, e.target.value)} className={celdaInputCls} /></td>
                      ))}
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

        <FilaCampos>
          <CampoPapel label="Nº TOTAL DE ACCIDENTADOS" value={form.totalAccidentados} onChange={v => setForm({ ...form, totalAccidentados: v })} flex={1.6} />
          <CampoPapel label="HERIDOS" value={form.totalHeridos} onChange={v => setForm({ ...form, totalHeridos: v })} />
          <CampoPapel label="MUERTOS" value={form.totalMuertos} onChange={v => setForm({ ...form, totalMuertos: v })} />
        </FilaCampos>

        <BloqueEtiqueta etiqueta="Materiales Utilizados">
          <FilaCampos><CampoPapel label="Móviles" value={form.materialesUtilizadosMoviles} onChange={v => setForm({ ...form, materialesUtilizadosMoviles: v })} /></FilaCampos>
          <FilaCampos><CampoPapel label="Menor" value={form.materialesUtilizadosMenor} onChange={v => setForm({ ...form, materialesUtilizadosMenor: v })} /></FilaCampos>
          <FilaCampos><CampoPapel label="Ajenos" value={form.materialesUtilizadosAjenos} onChange={v => setForm({ ...form, materialesUtilizadosAjenos: v })} /></FilaCampos>
        </BloqueEtiqueta>

        <FilaCampos><CampoPapel label="Otros de Apoyo" value={form.otrosDeApoyo} onChange={v => setForm({ ...form, otrosDeApoyo: v })} /></FilaCampos>
        <FilaCampos><CampoPapel label="Personal Policial a cargo de" value={form.personalPolicialACargoDe} onChange={v => setForm({ ...form, personalPolicialACargoDe: v })} /></FilaCampos>
        <FilaCampos><CampoPapel label="Ministerio Público oficiado por" value={form.ministerioPublicoOficiadoPor} onChange={v => setForm({ ...form, ministerioPublicoOficiadoPor: v })} /></FilaCampos>
        <FilaCampos><CampoPapel label="Otros datos de interés" value={form.otrosDatosInteres} onChange={v => setForm({ ...form, otrosDatosInteres: v })} /></FilaCampos>

        <div className="border-b border-black">
          <TituloSeccionPapel>CAUSAS DEL ACCIDENTE (breve explicación)</TituloSeccionPapel>
          <textarea value={form.causasAccidente} onChange={e => setForm({ ...form, causasAccidente: e.target.value })} rows={4} className="w-full bg-transparent border-none outline-none text-black text-[13px] p-2 resize-none" />
        </div>

        <div className="border-b border-black">
          <TituloSeccionPapel>DESARROLLO DEL INFORME</TituloSeccionPapel>
          <textarea value={form.desarrolloDelInforme} onChange={e => setForm({ ...form, desarrolloDelInforme: e.target.value })} rows={10} placeholder="Relato cronológico de la intervención..." className="w-full bg-transparent border-none outline-none text-black text-[13px] p-2 resize-none" />
        </div>

        {/* ---- Nomina de Voluntarios | Croquis del Lugar ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>NÓMINA DE VOLUNTARIOS</TituloSeccionPapel>
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
                      <input type="text" list="informe-accidente-personal" value={c.conductor} onChange={e => actualizarConductor(idx, 'conductor', e.target.value)} placeholder="Conductor" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
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
                      <input type="text" list="informe-accidente-personal" value={c.combatiente} onChange={e => actualizarCombatiente(idx, 'combatiente', e.target.value)} placeholder="Combatiente" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <input type="text" value={c.codigo} onChange={e => actualizarCombatiente(idx, 'codigo', e.target.value)} placeholder="Código" className="bg-transparent border-none outline-none text-black text-[12px] py-1 min-w-0" />
                      <button type="button" onClick={() => quitarCombatiente(idx)} className="text-gray-400 hover:text-cbvp-red shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 space-y-2">
                <CampoPapel label="A Cargo" value={form.nominaACargo} onChange={v => setForm({ ...form, nominaACargo: v })} list="informe-accidente-personal" />
                <CampoPapel label="Firma (aclaración)" value={form.nominaFirma} onChange={v => setForm({ ...form, nominaFirma: v })} />
              </div>
            </div>
          </div>
          <div>
            <TituloSeccionPapel>CROQUIS DEL LUGAR</TituloSeccionPapel>
            <div className="p-2">
              <p className="text-[11px] text-gray-500 mb-2">Hasta 9 fotos del lugar.</p>
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
                        {subiendoCroquisIdx === idx ? <span className="text-[10px]">...</span> : <Plus className="w-5 h-5" />}
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

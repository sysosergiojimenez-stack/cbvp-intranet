import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { Save, ArrowLeft, FileDown } from 'lucide-react';
import { exportarHistoriaPrehospitalariaPdf } from '@/lib/exportarHistoriaPrehospitalariaPdf';
import { ORGANIZACION } from '@/config/organizacion';
import { CampoPapel, FilaCampos, CasillaPapel, TituloSeccionPapel, BloqueEtiqueta } from '@/pages/InformeIncendio';
import {
  clave, normalizarHistoria, type HistoriaPrehospitalaria, type GrupoDef, type SignoVital,
  CONDICION, MOTIVO, RESPIRACION, CORAZON, PIEL, ANTECEDENTES, PUPILAS, PULMONES, LESIONES,
  QUEMADURAS_PROFUNDIDAD, QUEMADURAS_EXTENSION, ASISTENCIA, MEDICACION, CIERRE,
  EXPLORACION, GLASGOW, SIGNOS_VITALES_FILAS,
} from '@/lib/historiaPrehospitalariaDef';

function fechaParaGuardar(valor: string): string {
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return valor;
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

const lineaCls = 'bg-transparent border-b border-gray-400 outline-none text-black text-[13px] min-w-0 py-0.5';

export default function InformePrehospitalario() {
  const navigate = useNavigate();
  const location = useLocation();
  const llegada = location.state as { form?: Partial<HistoriaPrehospitalaria>; desdeSalida?: boolean } | null;
  const desdeSalida = !!llegada?.desdeSalida;
  const [form, setForm] = useState<HistoriaPrehospitalaria>(normalizarHistoria(llegada?.form || {}));
  const [error, setError] = useState('');

  const utils = trpc.useUtils();
  const { data: personalData } = trpc.personal.list.useQuery();
  const guardarMutation = trpc.informePrehospitalario.guardar.useMutation();

  const sugerenciasPersonal = (personalData?.personal || [])
    .map(p => ({ value: `${p.primerNombre} ${p.primerApellido}`.trim(), label: p.nombreCompleto, codigo: p.codigoRadial }))
    .filter(p => p.value)
    .sort((a, b) => a.label.localeCompare(b.label));

  // Sin un informe cargado (entrada directa a la URL) se vuelve a la lista.
  if (!llegada?.form) return <Navigate to="/informe-servicios" replace />;

  const check = (g: string, k: string) => !!form.checks[clave(g, k)];
  const toggle = (g: string, k: string) => setForm(f => ({ ...f, checks: { ...f.checks, [clave(g, k)]: !f.checks[clave(g, k)] } }));
  const texto = (k: string) => form.textos[k] || '';
  const setTexto = (k: string, v: string) => setForm(f => ({ ...f, textos: { ...f.textos, [k]: v } }));

  const setSigno = (idx: number, campo: keyof SignoVital, v: string) => {
    setForm(f => {
      const arr = [...f.signosVitales];
      arr[idx] = { ...arr[idx], [campo]: v };
      return { ...f, signosVitales: arr };
    });
  };

  const setRespondiente = (idx: number, campo: 'nombre' | 'cod', v: string) => {
    setForm(f => {
      const arr = [...f.respondientes];
      arr[idx] = { ...arr[idx], [campo]: v };
      if (campo === 'nombre') {
        const match = sugerenciasPersonal.find(p => p.value === v);
        if (match) arr[idx].cod = match.codigo;
      }
      return { ...f, respondientes: arr };
    });
  };

  const guardar = async () => {
    setError('');
    try {
      const resp = await guardarMutation.mutateAsync({ ...form, fecha: fechaParaGuardar(form.fecha) });
      if (!resp.exito) throw new Error('Error al guardar');
      setForm(f => ({ ...f, id: resp.id, nServicio: resp.nServicio }));
      utils.informePrehospitalario.listado.invalidate();
      alert(`Informe N° ${resp.nServicio} guardado.`);
    } catch (err: unknown) {
      setError('Error al guardar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const exportar = async () => {
    try {
      await exportarHistoriaPrehospitalariaPdf({ ...form, fecha: fechaParaGuardar(form.fecha) });
    } catch (err: unknown) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  // Lista vertical de casillas de un grupo (Respiracion, Corazon, Pupilas...)
  const listaChecks = (def: GrupoDef) => (
    <div className="px-2 py-1.5 space-y-1">
      {def.items.map(it => (
        <div key={it.key}><CasillaPapel checked={check(def.grupo, it.key)} onChange={() => toggle(def.grupo, it.key)} label={it.label} /></div>
      ))}
    </div>
  );

  // Items "Etiqueta: ______ [x]" (Condicion y Motivo de la llamada)
  const listaConDetalle = (def: GrupoDef) => (
    <div className="px-2 py-1.5 space-y-1">
      {def.items.map(it => (
        <div key={it.key} className="flex items-center gap-1.5">
          <span className="text-[12.5px] text-black shrink-0">{it.label}:</span>
          {it.detalle && <input type="text" value={texto(clave(def.grupo, it.key))} onChange={e => setTexto(clave(def.grupo, it.key), e.target.value)} className={`${lineaCls} flex-1`} />}
          {!it.sinCasilla && <input type="checkbox" checked={check(def.grupo, it.key)} onChange={() => toggle(def.grupo, it.key)} className="w-3.5 h-3.5 accent-black shrink-0 ml-auto" />}
        </div>
      ))}
    </div>
  );

  const filaChecksEnLinea = (def: GrupoDef) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5">
      {def.items.map(it => (
        <CasillaPapel key={it.key} checked={check(def.grupo, it.key)} onChange={() => toggle(def.grupo, it.key)} label={it.label} />
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4">
      <datalist id="informe-prehosp-personal">
        {sugerenciasPersonal.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </datalist>
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(desdeSalida ? '/salida-movil' : '/informe-servicios')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
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
            <p className="font-bold text-lg mt-1">HISTORIA PREHOSPITALARIA <span className="text-sm font-normal">({form.tipoInforme})</span></p>
          </div>
        </div>

        <FilaCampos>
          <CampoPapel label="N° Servicio" value={form.nServicio || 'Se asigna al guardar'} disabled flex={1} />
          <CampoPapel label="Móvil" value={form.movil} disabled flex={0.8} />
          <CampoPapel label="Fecha" type="date" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} flex={1} />
          <CampoPapel label="Dirección" value={form.direccion} onChange={v => setForm({ ...form, direccion: v })} flex={2} />
        </FilaCampos>
        <FilaCampos>
          <CampoPapel label="Nombre" value={form.nombre} onChange={v => setForm({ ...form, nombre: v })} flex={2} />
          <CampoPapel label="Edad" value={form.edad} onChange={v => setForm({ ...form, edad: v })} flex={0.6} />
          <div className="flex items-center gap-2 px-2">
            <span className="text-[12.5px] font-bold text-black">Sexo:</span>
            <CasillaPapel checked={form.sexo === 'M'} onChange={() => setForm({ ...form, sexo: form.sexo === 'M' ? '' : 'M' })} label="M" />
            <CasillaPapel checked={form.sexo === 'F'} onChange={() => setForm({ ...form, sexo: form.sexo === 'F' ? '' : 'F' })} label="F" />
          </div>
          <CampoPapel label="Destino" value={form.destino} onChange={v => setForm({ ...form, destino: v })} flex={1.5} />
        </FilaCampos>

        {/* Condicion | Motivo de la llamada */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-black">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>{CONDICION.titulo}</TituloSeccionPapel>
            {listaConDetalle(CONDICION)}
          </div>
          <div>
            <TituloSeccionPapel>{MOTIVO.titulo}</TituloSeccionPapel>
            {listaConDetalle(MOTIVO)}
          </div>
        </div>

        <FilaCampos><CampoPapel label="PRIORIDAD DE TRIAGE" value={form.prioridadTriage} onChange={v => setForm({ ...form, prioridadTriage: v })} /></FilaCampos>

        {/* Signos vitales | Respiracion | Corazon | Piel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-black">
          <div className="border-b lg:border-b-0 lg:border-r border-black">
            <TituloSeccionPapel>SIGNOS VITALES</TituloSeccionPapel>
            <div className="grid grid-cols-5 text-[11px] font-bold text-black text-center border-b border-black">
              {['Hora', 'F.C.', 'F.R.', 'P.A.', 'T°'].map(h => <div key={h} className="py-1 border-r last:border-r-0 border-black">{h}</div>)}
            </div>
            {Array.from({ length: SIGNOS_VITALES_FILAS }, (_, idx) => (
              <div key={idx} className="grid grid-cols-5 border-b last:border-b-0 border-black">
                {(['hora', 'fc', 'fr', 'pa', 'temp'] as const).map(campo => (
                  <input key={campo} type={campo === 'hora' ? 'time' : 'text'} value={form.signosVitales[idx][campo]} onChange={e => setSigno(idx, campo, e.target.value)} className="min-w-0 w-full bg-transparent border-r last:border-r-0 border-black outline-none text-black text-[12.5px] text-center py-1.5" />
                ))}
              </div>
            ))}
          </div>
          {[RESPIRACION, CORAZON, PIEL].map((def, i) => (
            <div key={def.grupo} className={`border-b lg:border-b-0 border-black ${i < 2 ? 'lg:border-r' : ''}`}>
              <TituloSeccionPapel>{def.titulo}</TituloSeccionPapel>
              {listaChecks(def)}
            </div>
          ))}
        </div>

        {/* Antecedentes | Pupilas | Pulmones | Lesiones */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-black">
          <div className="border-b lg:border-b-0 lg:border-r border-black">
            <TituloSeccionPapel>ANTECEDENTES</TituloSeccionPapel>
            <div className="px-2 py-1.5 grid grid-cols-2 gap-y-1">
              {ANTECEDENTES.items.map(it => (
                <CasillaPapel key={it.key} checked={check(ANTECEDENTES.grupo, it.key)} onChange={() => toggle(ANTECEDENTES.grupo, it.key)} label={it.label} />
              ))}
            </div>
          </div>
          {[PUPILAS, PULMONES, LESIONES].map((def, i) => (
            <div key={def.grupo} className={`border-b lg:border-b-0 border-black ${i < 2 ? 'lg:border-r' : ''}`}>
              <TituloSeccionPapel>{def.titulo}</TituloSeccionPapel>
              {listaChecks(def)}
            </div>
          ))}
        </div>

        {/* Glasgow | Exploracion corporal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-black">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>ESCALA DE COMA GLASGOW</TituloSeccionPapel>
            <div className="px-2 py-1.5 space-y-2">
              {GLASGOW.map(g => (
                <div key={g.campo}>
                  <p className="text-[10.5px] font-bold text-black">{g.titulo}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {g.opciones.map(([etiqueta, puntos]) => (
                      <CasillaPapel key={etiqueta} checked={form[g.campo] === puntos} onChange={() => setForm({ ...form, [g.campo]: form[g.campo] === puntos ? null : puntos })} label={`${etiqueta} (${puntos})`} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-1 border-t border-gray-300">
                <span className="text-[12.5px] font-bold text-black">TOTAL: {(form.glasgowOjos ?? 0) + (form.glasgowVerbal ?? 0) + (form.glasgowMotora ?? 0) || '—'} / 15</span>
                <CasillaPapel checked={check('glasgow', 'noVerifico')} onChange={() => toggle('glasgow', 'noVerifico')} label="No se verificó" />
              </div>
            </div>
          </div>
          <div>
            <TituloSeccionPapel>EXPLORACIÓN CORPORAL</TituloSeccionPapel>
            <div className="px-2 py-1.5 space-y-1.5">
              {EXPLORACION.map(e => (
                <div key={e.key}>
                  <p className="text-[10.5px] font-bold text-black">{e.label}:</p>
                  <input type="text" value={texto(clave('expl', e.key))} onChange={ev => setTexto(clave('expl', e.key), ev.target.value)} className={`${lineaCls} w-full`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= DORSO ================= */}
        <TituloSeccionPapel>QUEMADURAS Y ATENCIÓN</TituloSeccionPapel>
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-black">
          <div className="border-b sm:border-b-0 sm:border-r border-black p-2">
            <img src="/quemaduras-superficie.png" alt="Superficie corporal quemada: adulto y menor" className="w-full max-w-sm mx-auto" />
          </div>
          <div>
            <TituloSeccionPapel>{QUEMADURAS_PROFUNDIDAD.titulo}</TituloSeccionPapel>
            {filaChecksEnLinea(QUEMADURAS_PROFUNDIDAD)}
            <TituloSeccionPapel>{QUEMADURAS_EXTENSION.titulo}</TituloSeccionPapel>
            <div className="px-2 py-1.5 space-y-2">
              <div className="flex items-center gap-1.5 text-[12.5px] text-black">100/ <input type="text" value={texto('quemExt_porcentaje')} onChange={e => setTexto('quemExt_porcentaje', e.target.value)} className={`${lineaCls} w-24`} /> %</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {QUEMADURAS_EXTENSION.items.filter(i => i.key !== 'noVerifico').map(it => (
                  <CasillaPapel key={it.key} checked={check('quemExt', it.key)} onChange={() => toggle('quemExt', it.key)} label={it.label} />
                ))}
              </div>
              <div>
                <p className="text-[12.5px] text-black">Observación:</p>
                <textarea value={texto('quemExt_observacion')} onChange={e => setTexto('quemExt_observacion', e.target.value)} rows={2} className="w-full bg-transparent border border-gray-300 rounded outline-none text-black text-[13px] p-1 resize-none" />
              </div>
              <CasillaPapel checked={check('quemExt', 'noVerifico')} onChange={() => toggle('quemExt', 'noVerifico')} label="No se verificó" />
            </div>
          </div>
        </div>

        {/* Comentarios y DX | Asistencia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-black">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>COMENTARIOS Y DX PRESUNTIVO</TituloSeccionPapel>
            <textarea value={texto('comentarios')} onChange={e => setTexto('comentarios', e.target.value)} rows={8} className="w-full bg-transparent border-none outline-none text-black text-[13px] p-2 resize-none" />
          </div>
          <div>
            <TituloSeccionPapel>{ASISTENCIA.titulo}</TituloSeccionPapel>
            <div className="px-2 py-1.5 space-y-2">
              <div className="grid grid-cols-2 gap-y-1">
                {ASISTENCIA.items.map(it => (
                  <CasillaPapel key={it.key} checked={check(ASISTENCIA.grupo, it.key)} onChange={() => toggle(ASISTENCIA.grupo, it.key)} label={it.label} />
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[12.5px] text-black">
                Desfibrilación Joules: <input type="text" value={texto('asistencia_desfib1')} onChange={e => setTexto('asistencia_desfib1', e.target.value)} className={`${lineaCls} w-16`} /> / <input type="text" value={texto('asistencia_desfib2')} onChange={e => setTexto('asistencia_desfib2', e.target.value)} className={`${lineaCls} w-16`} />
              </div>
              <div>
                <p className="text-[12.5px] text-black">Otros:</p>
                <textarea value={texto('asistencia_otros')} onChange={e => setTexto('asistencia_otros', e.target.value)} rows={3} className="w-full bg-transparent border border-gray-300 rounded outline-none text-black text-[13px] p-1 resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Medicacion | Rehusa asistencia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-black">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>{MEDICACION.titulo}</TituloSeccionPapel>
            <div className="px-2 py-1.5 space-y-1">
              <div className="grid grid-cols-3 gap-y-1">
                {MEDICACION.items.map(it => (
                  <CasillaPapel key={it.key} checked={check(MEDICACION.grupo, it.key)} onChange={() => toggle(MEDICACION.grupo, it.key)} label={it.label} />
                ))}
              </div>
              <CampoPapel label="Fármacos suministrados" value={texto('medicacion_farmacos')} onChange={v => setTexto('medicacion_farmacos', v)} />
              <CampoPapel label="Ordenado por médico" value={texto('medicacion_medico')} onChange={v => setTexto('medicacion_medico', v)} />
              <div className="flex">
                <CampoPapel label="Firma" value={texto('medicacion_firma')} onChange={v => setTexto('medicacion_firma', v)} />
                <CampoPapel label="Reg. N°" value={texto('medicacion_regNo')} onChange={v => setTexto('medicacion_regNo', v)} />
              </div>
            </div>
          </div>
          <div className="px-2 py-2 space-y-2">
            <CasillaPapel checked={check('rehusa', 'rehusa')} onChange={() => toggle('rehusa', 'rehusa')} label="El paciente se rehúsa a recibir asistencia del personal bombero" />
            <div className="flex">
              <CampoPapel label="Testigo C.I. N°" value={texto('rehusa_testigoCI')} onChange={v => setTexto('rehusa_testigoCI', v)} />
              <CampoPapel label="Paciente C.I. N°" value={texto('rehusa_pacienteCI')} onChange={v => setTexto('rehusa_pacienteCI', v)} />
            </div>
          </div>
        </div>

        <FilaCampos>
          <CampoPapel label="El paciente queda en" value={texto('queda_en')} onChange={v => setTexto('queda_en', v)} flex={2} />
          <CampoPapel label="Hora" type="time" value={texto('queda_hora')} onChange={v => setTexto('queda_hora', v)} />
          <CampoPapel label="Estado" value={texto('queda_estado')} onChange={v => setTexto('queda_estado', v)} />
        </FilaCampos>
        <FilaCampos>
          <CampoPapel label="A cargo de (la) Dr/a." value={texto('queda_aCargo')} onChange={v => setTexto('queda_aCargo', v)} flex={2} />
          <CampoPapel label="Firma" value={texto('queda_firma')} onChange={v => setTexto('queda_firma', v)} />
        </FilaCampos>

        {/* Dotacion de servicio | Objetos de valor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-black">
          <div className="border-b sm:border-b-0 sm:border-r border-black">
            <TituloSeccionPapel>DOTACIÓN DE SERVICIO</TituloSeccionPapel>
            <div className="px-2 py-1.5 space-y-1.5">
              <p className="text-[12px] font-bold text-black">Conductor</p>
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <input type="text" list="informe-prehosp-personal" value={texto('dotacion_conductor')} onChange={e => {
                  const v = e.target.value;
                  const match = sugerenciasPersonal.find(p => p.value === v);
                  setForm(f => ({ ...f, textos: { ...f.textos, dotacion_conductor: v, ...(match ? { dotacion_conductorCod: match.codigo } : {}) } }));
                }} placeholder="Nombre" className={lineaCls} />
                <input type="text" value={texto('dotacion_conductorCod')} onChange={e => setTexto('dotacion_conductorCod', e.target.value)} placeholder="Cód." className={lineaCls} />
              </div>
              <p className="text-[12px] font-bold text-black pt-1">Respondientes</p>
              {form.respondientes.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr] gap-2">
                  <input type="text" list="informe-prehosp-personal" value={r.nombre} onChange={e => setRespondiente(idx, 'nombre', e.target.value)} placeholder="Nombre" className={lineaCls} />
                  <input type="text" value={r.cod} onChange={e => setRespondiente(idx, 'cod', e.target.value)} placeholder="Cód." className={lineaCls} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <TituloSeccionPapel>OBJETOS DE VALOR DEL PACIENTE (detallar)</TituloSeccionPapel>
            <div className="px-2 py-1.5 space-y-1">
              <textarea value={texto('objetosValor')} onChange={e => setTexto('objetosValor', e.target.value)} rows={4} className="w-full bg-transparent border border-gray-300 rounded outline-none text-black text-[13px] p-1 resize-none" />
              <CampoPapel label="Entregado a" value={texto('entregadoA')} onChange={v => setTexto('entregadoA', v)} />
              <CampoPapel label="A Cargo" value={texto('aCargo')} onChange={v => setTexto('aCargo', v)} list="informe-prehosp-personal" />
              <CampoPapel label="Firma" value={texto('firma')} onChange={v => setTexto('firma', v)} />
            </div>
          </div>
        </div>

        <BloqueEtiqueta etiqueta="Cierre">
          {filaChecksEnLinea(CIERRE)}
        </BloqueEtiqueta>
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

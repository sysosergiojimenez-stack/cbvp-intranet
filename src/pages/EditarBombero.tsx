import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import { usePermiso } from "@/hooks/usePermiso";
import { Save, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";

export default function EditarBombero() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { puedeVerPersonal } = usePermiso();
  const [form, setForm] = useState({
    codigo: "", anioJuramento: "", categoria: "COMBATIENTE",
    rango: "Voluntario(a)", codigoRadial: "",
    primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "",
    nroDocId: "", fechaNacimiento: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data, isLoading } = trpc.personal.obtenerPorCodigo.useQuery(
    { codigo: codigo || "" }, { enabled: !!codigo, retry: 1 }
  );

  useEffect(() => {
    if (data?.exito && data.bombero) {
      const b = data.bombero;
      setForm({
        codigo: b.codigo, anioJuramento: b.anioJuramento,
        categoria: b.categoria || "COMBATIENTE", rango: b.rango || "Voluntario(a)",
        codigoRadial: b.codigoRadial, primerNombre: b.primerNombre,
        segundoNombre: b.segundoNombre, primerApellido: b.primerApellido,
        segundoApellido: b.segundoApellido, nroDocId: b.nroDocId,
        fechaNacimiento: b.fechaNacimiento,
      });
    }
  }, [data]);

  const editarMutation = trpc.personal.editar.useMutation({
    onSuccess: (res) => {
      if (res.exito) { setSuccess("Bombero actualizado correctamente"); setError(""); setTimeout(() => setSuccess(""), 3000); }
      else { setError(res.error || "Error al actualizar"); }
    },
    onError: (err) => { setError(err.message); setSuccess(""); },
  });

  if (!puedeVerPersonal) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-6">Editar Bombero</h1>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-cbvp-orange mx-auto mb-4" />
          <p className="text-white/60">No tienes permisos para acceder a este modulo.</p>
        </div>
      </div>
    );
  }
  if (isLoading) return <div className="text-white/60 text-center py-12">Cargando datos del bombero...</div>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!form.codigo || !form.anioJuramento || !form.primerNombre || !form.primerApellido) {
      setError("Complete los campos obligatorios"); return;
    }
    editarMutation.mutate({ codigoOriginal: codigo || "", ...form });
  };

  const fld = (label: string, key: keyof typeof form, opts?: { t?: string; p?: string; r?: boolean }) => (
    <div>
      <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">{label}{opts?.r ? " *" : ""}</label>
      <input type={opts?.t || "text"} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={opts?.p || ""} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50" />
    </div>
  );

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <button onClick={() => navigate("/personal")} className="mb-4 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver al listado
      </button>
      {error && <div className="mb-4 p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light">{error}</div>}
      {success && <div className="mb-4 p-3 bg-cbvp-green/10 border border-cbvp-green/20 rounded-lg text-sm text-cbvp-green flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {success}</div>}
      <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2">Datos Generales</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fld("Codigo", "codigo", { p: "4852", r: true })}
          {fld("Anio Juramento", "anioJuramento", { p: "2014", r: true })}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Categoria</label>
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50">
              <option value="COMBATIENTE">COMBATIENTE</option>
              <option value="ACTIVO">ACTIVO</option>
              <option value="FUNDADOR">FUNDADOR</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Rango</label>
            <select value={form.rango} onChange={e => setForm(f => ({ ...f, rango: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50">
              <option value="Voluntario(a)">Voluntario(a)</option>
              <option value="Sub Teniente">Sub Teniente</option>
              <option value="Teniente">Teniente</option>
              <option value="Teniente Primero">Teniente Primero</option>
              <option value="Capitan">Capitan</option>
              <option value="Capitan Inspector">Capitan Inspector</option>
              <option value="Capitan Mayor">Capitan Mayor</option>
              <option value="Capitan Director">Capitan Director</option>
              <option value="Capitan Principal">Capitan Principal</option>
              <option value="Capitan General">Capitan General</option>
            </select>
          </div>
          {fld("Codigo Radial", "codigoRadial")}
        </div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2 pt-2">Datos Personales</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fld("Primer Nombre *", "primerNombre", { r: true })}
          {fld("Segundo Nombre", "segundoNombre")}
          {fld("Primer Apellido *", "primerApellido", { r: true })}
          {fld("Segundo Apellido", "segundoApellido")}
          {fld("Nro Doc ID", "nroDocId", { p: "1234567" })}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Fecha de Nacimiento</label>
            <input type="date" value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 [color-scheme:dark]" />
          </div>
        </div>
        <button type="submit" disabled={editarMutation.isPending} className="w-full mt-4 py-3 bg-cbvp-blue hover:bg-cbvp-blue/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> {editarMutation.isPending ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>
    </div>
  );
}

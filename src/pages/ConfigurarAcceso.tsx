import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { trpc } from "@/providers/trpc";
import { Lock, Mail, Eye, EyeOff, Save, AlertTriangle, CheckCircle } from "lucide-react";

export default function ConfigurarAcceso() {
  const { usuario } = useAuth();
  const [form, setForm] = useState({ correoActual: "", correoNuevo: "", contrasenaActual: "", contrasenaNueva: "", confirmarContrasena: "" });
  const [show, setShow] = useState({ actual: false, nueva: false, confirmar: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const m = trpc.personal.cambiarAcceso.useMutation({
    onSuccess: (r) => { if (r.exito) { setSuccess(r.mensaje); setError(""); setForm({ correoActual: "", correoNuevo: "", contrasenaActual: "", contrasenaNueva: "", confirmarContrasena: "" }); setTimeout(() => setSuccess(""), 4000); } else { setError(r.error || "Error"); } },
    onError: (e) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!form.correoActual || !form.correoNuevo || !form.contrasenaActual || !form.contrasenaNueva) { setError("Complete todos los campos"); return; }
    if (form.contrasenaNueva !== form.confirmarContrasena) { setError("Las contrasenas no coinciden"); return; }
    if (form.contrasenaNueva.length < 4) { setError("Minimo 4 caracteres"); return; }
    m.mutate({ codigo: usuario?.codigo || "", correoActual: form.correoActual, correoNuevo: form.correoNuevo, contrasenaActual: form.contrasenaActual, contrasenaNueva: form.contrasenaNueva });
  };

  const inp = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 transition-colors";
  const lbl = "text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="animate-fade-in max-w-lg mx-auto">
      {error && <div className="mb-4 p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="mb-4 p-3 bg-cbvp-green/10 border border-cbvp-green/20 rounded-lg text-sm text-cbvp-green flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0" />{success}</div>}
      <form onSubmit={submit} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2 mb-4 flex items-center gap-2"><Mail className="w-4 h-4 text-cbvp-red" /> Verificacion</h2>
          <div className="space-y-4">
            <div><label className={lbl}>Correo Actual *</label><input type="email" value={form.correoActual} onChange={e => setForm(f => ({ ...f, correoActual: e.target.value }))} placeholder="correo@actual.com" className={inp} /></div>
            <div className="relative"><label className={lbl}>Contrasena Actual *</label><input type={show.actual ? "text" : "password"} value={form.contrasenaActual} onChange={e => setForm(f => ({ ...f, contrasenaActual: e.target.value }))} placeholder="Tu contrasena actual" className={inp + " pr-10"} /><button type="button" onClick={() => setShow(p => ({ ...p, actual: !p.actual }))} className="absolute right-3 top-[26px] text-white/30 hover:text-white/60">{show.actual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2 mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-cbvp-blue" /> Nuevos Datos</h2>
          <div className="space-y-4">
            <div><label className={lbl}>Nuevo Correo *</label><input type="email" value={form.correoNuevo} onChange={e => setForm(f => ({ ...f, correoNuevo: e.target.value }))} placeholder="nuevo@correo.com" className={inp} /></div>
            <div className="relative"><label className={lbl}>Nueva Contrasena *</label><input type={show.nueva ? "text" : "password"} value={form.contrasenaNueva} onChange={e => setForm(f => ({ ...f, contrasenaNueva: e.target.value }))} placeholder="Minimo 4 caracteres" className={inp + " pr-10"} /><button type="button" onClick={() => setShow(p => ({ ...p, nueva: !p.nueva }))} className="absolute right-3 top-[26px] text-white/30 hover:text-white/60">{show.nueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
            <div className="relative"><label className={lbl}>Confirmar Contrasena *</label><input type={show.confirmar ? "text" : "password"} value={form.confirmarContrasena} onChange={e => setForm(f => ({ ...f, confirmarContrasena: e.target.value }))} placeholder="Repite la contrasena" className={inp + " pr-10"} /><button type="button" onClick={() => setShow(p => ({ ...p, confirmar: !p.confirmar }))} className="absolute right-3 top-[26px] text-white/30 hover:text-white/60">{show.confirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
          </div>
        </div>
        <button type="submit" disabled={m.isPending} className="w-full py-3 bg-cbvp-blue hover:bg-cbvp-blue/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"><Save className="w-4 h-4" />{m.isPending ? "Guardando..." : "Guardar Cambios"}</button>
      </form>
    </div>
  );
}
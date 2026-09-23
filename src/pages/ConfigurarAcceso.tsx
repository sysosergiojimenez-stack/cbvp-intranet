import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/providers/trpc';
import { Lock, Eye, EyeOff, Save, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ConfigurarAcceso() {
  const { usuario } = useAuth();
  const [form, setForm] = useState({
    contrasenaActual: '',
    contrasenaNueva: '',
    confirmarContrasena: '',
    correo: usuario?.correo || '',
  });
  const [showPasswords, setShowPasswords] = useState({
    actual: false,
    nueva: false,
    confirmar: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const cambiarMutation = trpc.personal.cambiarAcceso.useMutation({
    onSuccess: (res) => {
      if (res.exito) {
        setSuccess(res.mensaje);
        setError('');
        setForm(f => ({ ...f, contrasenaActual: '', contrasenaNueva: '', confirmarContrasena: '' }));
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(res.error || 'Error al actualizar');
        setSuccess('');
      }
    },
    onError: (err) => {
      setError(err.message);
      setSuccess('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!usuario?.codigo || !form.contrasenaActual || !form.contrasenaNueva) {
      setError('Complete todos los campos');
      return;
    }
    if (form.contrasenaNueva !== form.confirmarContrasena) {
      setError('La nueva contraseña no coincide con la confirmacion');
      return;
    }
    if (form.contrasenaNueva.length < 4) {
      setError('La nueva contraseña debe tener al menos 4 caracteres');
      return;
    }

    cambiarMutation.mutate({
      codigo: usuario.codigo,
      contrasenaActual: form.contrasenaActual,
      contrasenaNueva: form.contrasenaNueva,
      correo: form.correo,
    });
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50 transition-colors";
  const labelClass = "text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="animate-fade-in max-w-lg mx-auto">
      {error && (
        <div className="mb-4 p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-cbvp-green/10 border border-cbvp-green/20 rounded-lg text-sm text-cbvp-green flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-5">
        {/* Verificacion de identidad */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-cbvp-red" /> Verificacion de Identidad
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Codigo de Bombero</label>
              <input type="text" value={usuario?.codigo || ''} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
            </div>
            <div className="relative">
              <label className={labelClass}>Contrasena Actual *</label>
              <input
                type={showPasswords.actual ? 'text' : 'password'}
                value={form.contrasenaActual}
                onChange={e => setForm(f => ({ ...f, contrasenaActual: e.target.value }))}
                placeholder="Tu contrasena actual"
                className={`${inputClass} pr-10`}
              />
              <button type="button" onClick={() => setShowPasswords(p => ({ ...p, actual: !p.actual }))} className="absolute right-3 top-[26px] text-white/30 hover:text-white/60 transition-colors">
                {showPasswords.actual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Nuevos datos */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-cbvp-blue" /> Nuevos Datos
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Correo de Contacto (opcional)</label>
              <input
                type="email"
                value={form.correo}
                onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
                placeholder="tu@correo.com"
                className={inputClass}
              />
            </div>
            <div className="relative">
              <label className={labelClass}>Nueva Contrasena *</label>
              <input
                type={showPasswords.nueva ? 'text' : 'password'}
                value={form.contrasenaNueva}
                onChange={e => setForm(f => ({ ...f, contrasenaNueva: e.target.value }))}
                placeholder="Minimo 4 caracteres"
                className={`${inputClass} pr-10`}
              />
              <button type="button" onClick={() => setShowPasswords(p => ({ ...p, nueva: !p.nueva }))} className="absolute right-3 top-[26px] text-white/30 hover:text-white/60 transition-colors">
                {showPasswords.nueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <label className={labelClass}>Confirmar Nueva Contrasena *</label>
              <input
                type={showPasswords.confirmar ? 'text' : 'password'}
                value={form.confirmarContrasena}
                onChange={e => setForm(f => ({ ...f, confirmarContrasena: e.target.value }))}
                placeholder="Repite la nueva contrasena"
                className={`${inputClass} pr-10`}
              />
              <button type="button" onClick={() => setShowPasswords(p => ({ ...p, confirmar: !p.confirmar }))} className="absolute right-3 top-[26px] text-white/30 hover:text-white/60 transition-colors">
                {showPasswords.confirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={cambiarMutation.isPending}
          className="w-full py-3 bg-cbvp-blue hover:bg-cbvp-blue/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {cambiarMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </form>
    </div>
  );
}

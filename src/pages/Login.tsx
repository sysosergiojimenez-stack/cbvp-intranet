import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Flame, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { ORGANIZACION } from '@/config/organizacion';

export default function Login() {
  const { login, isLoading, error } = useAuth();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [localError, setLocalError] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!correo.trim() || !contrasena.trim()) {
      setLocalError('Complete todos los campos');
      return;
    }
    const success = await login(correo, contrasena, recordarme);
    if (!success) {
      setLocalError(error || 'Correo o contrasena incorrectos');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cbvp-dark-light via-cbvp-dark to-cbvp-dark-lighter">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-10 shadow-glow">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
              <img src="/insignia.jpg" alt="Insignia" className="w-16 h-16 rounded-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Fire Intranet</h1>
            <p className="text-sm text-white/50 mt-2">{ORGANIZACION.compania}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input
                type="email"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                placeholder="Correo electronico"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cbvp-red/50 focus:ring-1 focus:ring-cbvp-red/30 transition-all text-sm"
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                value={contrasena}
                onChange={e => setContrasena(e.target.value)}
                placeholder="Contrasena"
                className="w-full px-4 py-3.5 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cbvp-red/50 focus:ring-1 focus:ring-cbvp-red/30 transition-all text-sm"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-white/50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recordarme}
                  onChange={e => setRecordarme(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-cbvp-red focus:ring-cbvp-red/30 focus:ring-offset-0"
                />
                Recordarme
              </label>
              <button
                type="button"
                onClick={() => setMostrarAyuda(!mostrarAyuda)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                ¿Olvidaste tu contrasena?
              </button>
            </div>

            {mostrarAyuda && (
              <div className="text-xs text-white/50 bg-white/5 rounded-lg px-3 py-2.5">
                Contactate con el encargado de personal para restablecer tu contrasena.
              </div>
            )}

            {(localError || error) && (
              <div className="flex items-center gap-2 text-cbvp-red-light text-sm bg-cbvp-red/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{localError || error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-cbvp-red hover:bg-cbvp-red-light text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Flame className="w-4 h-4" />
                  Ingresar
                </>
              )}
            </button>
          </form>

        </div>
        <p className="text-center text-xs text-white/20 mt-4">Desarrollado por Sergio Jimenez</p>
      </div>
    </div>
  );
}

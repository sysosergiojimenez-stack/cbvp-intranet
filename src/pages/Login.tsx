import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Flame, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login, isLoading, error } = useAuth();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!correo.trim() || !contrasena.trim()) {
      setLocalError('Complete todos los campos');
      return;
    }
    const success = await login(correo, contrasena);
    if (!success) {
      setLocalError(error || 'Correo o contrasena incorrectos');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cbvp-dark-light via-cbvp-dark to-cbvp-dark-lighter">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-10 shadow-glow">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cbvp-red/10 mb-4">
              <Flame className="w-8 h-8 text-cbvp-red" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CBVP</h1>
            <p className="text-sm text-white/50 mt-2">Intranet - Vigesima Compania Capital Mercado 4</p>
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
            <div>
              <input
                type="password"
                value={contrasena}
                onChange={e => setContrasena(e.target.value)}
                placeholder="Contrasena"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cbvp-red/50 focus:ring-1 focus:ring-cbvp-red/30 transition-all text-sm"
                disabled={isLoading}
              />
            </div>

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

          <div className="mt-6 pt-5 border-t border-white/5">
            <p className="text-xs text-white/30 text-center mb-3">Cuentas de prueba:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 rounded-lg px-2 py-1.5 text-white/40 text-center">admin@cbvp.py</div>
              <div className="bg-white/5 rounded-lg px-2 py-1.5 text-white/40 text-center">oficial@cbvp.py</div>
              <div className="bg-white/5 rounded-lg px-2 py-1.5 text-white/40 text-center">bombero@cbvp.py</div>
              <div className="bg-white/5 rounded-lg px-2 py-1.5 text-white/40 text-center">perfil@cbvp.py</div>
            </div>
            <p className="text-[10px] text-white/20 text-center mt-2">Todas con password: la palabra antes del @ + 123</p>
          </div>
        </div>
      </div>
    </div>
  );
}

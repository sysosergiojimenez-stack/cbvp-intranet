import React, { createContext, useContext, useState, useCallback } from 'react';
import { trpc } from '@/providers/trpc';
import type { AccionPermiso } from '@/types';

const PERMISOS_POR_NIVEL: Record<number, AccionPermiso[]> = {
  5: ['ver_todo', 'editar_planillas', 'eliminar_planillas', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio', 'configuracion'],
  4: ['ver_todo', 'editar_planillas', 'eliminar_planillas', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio'],
  3: ['ver_todo', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio'],
  2: ['ver_todo', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio'],
  1: ['ver_perfil_propio'],
};

interface Usuario {
  exito: boolean;
  identificador: string;
  codigo: string;
  categoria: string;
  cargo: string;
  rango: string;
  nivelPermiso: number;
  descripcionPermiso: string;
  accesosPermiso: string;
  nombreCompleto: string;
  correo: string;
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (correo: string, contrasena: string) => Promise<boolean>;
  logout: () => void;
  tienePermiso: (accion: AccionPermiso) => boolean;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const saved = sessionStorage.getItem('cbvp_sesion');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.timestamp && (Date.now() - data.timestamp) < 8 * 60 * 60 * 1000) {
          return data.usuario;
        }
      } catch { /* ignore */ }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation();

  const login = useCallback(async (correo: string, contrasena: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginMutation.mutateAsync({
        correo: correo.trim().toLowerCase(),
        contrasena: contrasena.trim(),
      });

      if (result.exito) {
        const user: Usuario = {
          exito: true,
          identificador: result.identificador,
          codigo: result.codigo,
          categoria: result.categoria,
          cargo: result.cargo,
          rango: result.rango,
          nivelPermiso: result.nivelPermiso,
          descripcionPermiso: result.descripcionPermiso,
          accesosPermiso: result.accesosPermiso,
          nombreCompleto: result.nombreCompleto,
          correo: result.correo,
        };
        setUsuario(user);
        sessionStorage.setItem('cbvp_sesion', JSON.stringify({
          usuario: user,
          timestamp: Date.now(),
        }));
        setIsLoading(false);
        return true;
      } else {
        setError(result.mensaje || 'Correo o contrasena incorrectos');
        setIsLoading(false);
        return false;
      }
    } catch (err: unknown) {
      let message = 'Error de conexion con el servidor';
      if (err instanceof Error) {
        message = err.message;
        // Detect JSON parse error (backend returning HTML instead of JSON)
        if (message.includes('JSON') || message.includes('json') || message.includes('<') || message.includes('Unexpected token')) {
          message = 'El servidor backend no esta disponible. En desarrollo local ejecuta: npm run dev';
        }
      }
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, [loginMutation]);

  const logout = useCallback(() => {
    setUsuario(null);
    sessionStorage.removeItem('cbvp_sesion');
  }, []);

  const tienePermiso = useCallback((accion: AccionPermiso): boolean => {
    if (!usuario) return false;
    const nivel = usuario.nivelPermiso || 1;
    const accionesPermitidas = PERMISOS_POR_NIVEL[nivel] || [];
    return accionesPermitidas.includes(accion);
  }, [usuario]);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, tienePermiso, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Usuario, AccionPermiso } from '@/types';

const PERMISOS_POR_NIVEL: Record<number, AccionPermiso[]> = {
  5: ['ver_todo', 'editar_planillas', 'eliminar_planillas', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio', 'configuracion'],
  4: ['ver_todo', 'editar_planillas', 'eliminar_planillas', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio'],
  3: ['ver_todo', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio'],
  2: ['ver_todo', 'ver_personal', 'ver_historial', 'cargar_planillas', 'ver_perfil_propio'],
  1: ['ver_perfil_propio'],
};

const USUARIOS_MOCK: Record<string, { password: string; user: Usuario }> = {
  'admin@cbvp.py': {
    password: 'admin123',
    user: {
      exito: true, identificador: '1', codigo: 'C-1001/18', categoria: 'Activo',
      cargo: 'Comandante', rango: 'Capitan', nivelPermiso: 5,
      descripcionPermiso: 'Administrador Total', accesosPermiso: 'Todas las funciones',
      nombreCompleto: 'Carlos Antonio Gonzalez Rios', correo: 'admin@cbvp.py',
    },
  },
  'oficial@cbvp.py': {
    password: 'oficial123',
    user: {
      exito: true, identificador: '2', codigo: 'C-1002/19', categoria: 'Activo',
      cargo: 'Oficial', rango: 'Teniente', nivelPermiso: 4,
      descripcionPermiso: 'Oficial', accesosPermiso: 'Edicion y gestion',
      nombreCompleto: 'Maria Elena Fernandez Lopez', correo: 'oficial@cbvp.py',
    },
  },
  'bombero@cbvp.py': {
    password: 'bombero123',
    user: {
      exito: true, identificador: '6', codigo: 'C-1006/21', categoria: 'Activo',
      cargo: 'Voluntario(a)', rango: 'Distinguido', nivelPermiso: 2,
      descripcionPermiso: 'Voluntario', accesosPermiso: 'Ver y cargar',
      nombreCompleto: 'Pedro Jose Acosta Cardozo', correo: 'bombero@cbvp.py',
    },
  },
  'perfil@cbvp.py': {
    password: 'perfil123',
    user: {
      exito: true, identificador: '10', codigo: 'C-1010/23', categoria: 'Activo',
      cargo: 'Voluntario(a)', rango: 'Aspirante', nivelPermiso: 1,
      descripcionPermiso: 'Solo Perfil', accesosPermiso: 'Ver perfil propio',
      nombreCompleto: 'Roberto Alejandro Castillo Duarte', correo: 'perfil@cbvp.py',
    },
  },
};

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

  const login = useCallback(async (correo: string, contrasena: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const key = correo.trim().toLowerCase();
    const found = USUARIOS_MOCK[key];

    if (found && found.password === contrasena.trim()) {
      setUsuario(found.user);
      sessionStorage.setItem('cbvp_sesion', JSON.stringify({
        usuario: found.user,
        timestamp: Date.now(),
      }));
      setIsLoading(false);
      return true;
    }

    setError('Correo o contrasena incorrectos');
    setIsLoading(false);
    return false;
  }, []);

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

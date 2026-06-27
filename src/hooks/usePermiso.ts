import { useAuth } from '@/context/AuthContext';

export function usePermiso() {
  const { tienePermiso, usuario } = useAuth();

  return {
    puedeVerTodo: tienePermiso('ver_todo'),
    puedeEditarPlanillas: tienePermiso('editar_planillas'),
    puedeEliminarPlanillas: tienePermiso('eliminar_planillas'),
    puedeVerPersonal: tienePermiso('ver_personal'),
    puedeVerHistorial: tienePermiso('ver_historial'),
    puedeCargarPlanillas: tienePermiso('cargar_planillas'),
    puedeVerPerfilPropio: tienePermiso('ver_perfil_propio'),
    puedeConfiguracion: tienePermiso('configuracion'),
    nivel: usuario?.nivelPermiso || 0,
  };
}

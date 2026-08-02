import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermiso } from '@/hooks/usePermiso';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Planillas from '@/pages/Planillas';
import Personal from '@/pages/Personal';
import Perfil from '@/pages/Perfil';
import MiDashboard from '@/pages/MiDashboard';
import AgregarBombero from '@/pages/AgregarBombero';
import EditarBombero from '@/pages/EditarBombero';
import ConfigurarAcceso from '@/pages/ConfigurarAcceso';
import Configuracion from '@/pages/Configuracion';
import PracticasCitaciones from '@/pages/PracticasCitaciones';
import SalidaMovil from '@/pages/SalidaMovil';
import InformeAsistencia from '@/pages/InformeAsistencia';
import RolesGuardia from '@/pages/RolesGuardia';
import RolGuardiaDetalle from '@/pages/RolGuardiaDetalle';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (usuario) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const permisos = usePermiso();
  const { usuario } = useAuth();
  const isVoluntario = usuario?.cargo?.trim().toUpperCase() === 'VOLUNTARIO(A)';

  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />
      <Route element={<AppLayout />}>
        <Route path="/" element={
          <ProtectedRoute>
            {permisos.puedeVerTodo && !isVoluntario && (usuario?.cargo || '').trim().toUpperCase() === 'DESARROLLADOR'
              ? <Dashboard />
              : permisos.puedeVerPerfilPropio
                ? <MiDashboard />
                : <Navigate to="/login" replace />}
          </ProtectedRoute>
        } />
        <Route path="/mi-dashboard" element={
          <ProtectedRoute>
            <MiDashboard />
          </ProtectedRoute>
        } />
        <Route path="/planillas" element={
          <ProtectedRoute>
            {permisos.puedeCargarPlanillas ? <Planillas /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/practicas-citaciones" element={
          <ProtectedRoute>
            {permisos.puedeCargarPlanillas ? <PracticasCitaciones /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/salida-movil" element={
          <ProtectedRoute>
            {permisos.puedeCargarPlanillas ? <SalidaMovil /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/informe-asistencia" element={
          <ProtectedRoute>
            {permisos.puedeVerInformes ? <InformeAsistencia /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/roles-guardia" element={
          <ProtectedRoute>
            {permisos.puedeGestionarRolesGuardia ? <RolesGuardia /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/roles-guardia/:id" element={
          <ProtectedRoute>
            {permisos.puedeGestionarRolesGuardia ? <RolGuardiaDetalle /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/personal" element={
          <ProtectedRoute>
            {permisos.puedeVerPersonal ? <Personal /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/agregar-bombero" element={
          <ProtectedRoute>
            {permisos.puedeCrearBombero ? <AgregarBombero /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/editar-bombero/:identificador" element={
          <ProtectedRoute>
            {permisos.puedeVerPersonal ? <EditarBombero /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/configurar-acceso" element={
          <ProtectedRoute>
            <ConfigurarAcceso />
          </ProtectedRoute>
        } />
        <Route path="/configuracion" element={
          <ProtectedRoute>
            {permisos.puedeConfiguracion ? <Configuracion /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}

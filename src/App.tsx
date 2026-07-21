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
import PracticasCitaciones from '@/pages/PracticasCitaciones';
import SalidaMovil from '@/pages/SalidaMovil';

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
            {permisos.puedeVerTodo && !isVoluntario
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
        <Route path="/personal" element={
          <ProtectedRoute>
            {permisos.puedeVerPersonal ? <Personal /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/agregar-bombero" element={
          <ProtectedRoute>
            {permisos.puedeVerPersonal ? <AgregarBombero /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/editar-bombero/:codigo" element={
          <ProtectedRoute>
            {permisos.puedeVerPersonal ? <EditarBombero /> : <Navigate to="/" replace />}
          </ProtectedRoute>
        } />
        <Route path="/configurar-acceso" element={
          <ProtectedRoute>
            <ConfigurarAcceso />
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

import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';

export function ProtectedRoute() {
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}

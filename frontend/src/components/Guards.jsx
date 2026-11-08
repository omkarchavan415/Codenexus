import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoading } from './ui';

export function RequireAuth() {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <div className="p-10"><PageLoading label="Signing you in" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Students must finish onboarding (company, deadline, hours) before using the app. */
export function RequireGoal() {
  const { user } = useAuth();
  if (user && user.role === 'student' && !user.goal) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { user, booting } = useAuth();
  if (booting) return <div className="p-10"><PageLoading label="Loading" /></div>;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

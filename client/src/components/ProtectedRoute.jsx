import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDashboardPath } from '../utils/helpers.js';
import Loader from './Loader.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children ?? <Outlet />;
}

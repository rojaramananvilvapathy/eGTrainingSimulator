import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function ProtectedRoute({ requiredRole }) {
  const { user, accessToken } = useAuthStore();

  if (!accessToken || !user) return <Navigate to="/login" replace />;

  if (requiredRole) {
    const roleRank = { learner: 0, admin: 1, superadmin: 2 };
    if ((roleRank[user.role] ?? -1) < (roleRank[requiredRole] ?? 999)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}

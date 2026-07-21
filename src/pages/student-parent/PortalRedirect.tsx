import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isPortalUser } from "../../components/AppShell";

export function PortalRedirect() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!isPortalUser(user.roles)) return <Navigate to="/dashboard" replace />;

  const isParent = user.roles.includes("PARENT");
  return <Navigate to={isParent ? "/portal/parent" : "/portal/student"} replace />;
}

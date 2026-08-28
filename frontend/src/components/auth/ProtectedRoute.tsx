import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "../../types/auth";
import { LoadingSpinner } from "../common/LoadingSpinner";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
}) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F7F5]">
        <LoadingSpinner label="Authenticating session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Redirect unauthenticated user to login with memory of original path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based permissions
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "student") {
      // Students redirected to Curriculum
      return <Navigate to="/curriculum" replace />;
    }
    // Admins redirected to Cohort Heatmap
    return <Navigate to="/admin/heatmap" replace />;
  }

  return <Outlet />;
};

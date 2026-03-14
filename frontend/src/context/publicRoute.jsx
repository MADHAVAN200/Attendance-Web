import { useEffect, useState } from "react"; // useState/Effect not strictly needed anymore if only using context, but harmless
import { useAuth } from "./AuthContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const PublicRoute = ({ children }) => {
  const { user, authChecked } = useAuth();
  const location = useLocation();

  if (!authChecked) {
    return null; // or a nice loading spinner
  }

  // If user is logged in, redirect to dashboard. Otherwise render the public page (Login)
  const isMobileView = location.pathname.startsWith('/mobile-view');
  return user ? <Navigate to={isMobileView ? "/mobile-view" : "/"} replace /> : (children || <Outlet />);
};

export default PublicRoute;


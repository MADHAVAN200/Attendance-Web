import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext.jsx";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, authChecked } = useAuth();
  const [showRedirect, setShowRedirect] = useState(false);

  useEffect(() => {
    if (authChecked) {
      if (!user) {
        toast.warn("Please login first to access this page!", {
          toastId: "login-required",
        });
        setShowRedirect(true);
        return;
      }
      // Check user roles 
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        toast.error("You do not have permission to access this page.");
        setShowRedirect(true);
      }
    }
  }, [user, authChecked, allowedRoles]);

  if (!authChecked) {
    return null;
  }

  if (showRedirect) {
    return <Navigate to="/Login" replace />;
  }

  return user ? children : null;
  
};

export default ProtectedRoute;

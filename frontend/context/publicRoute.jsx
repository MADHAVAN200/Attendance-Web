import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const PublicRoute = ({ children }) => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/auth/me", { credentials: "include" });
        if (res.ok) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      } catch {
        setIsLoggedIn(false);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  if (checkingAuth) {
    return null; // or a loading spinner
  }

  return isLoggedIn ? <Navigate to="/Home" replace /> : children;
};

export default PublicRoute;

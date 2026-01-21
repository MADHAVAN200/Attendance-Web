import React, { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken } from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Move fetchUser definition OUTSIDE useEffect
  const fetchUser = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data) {
        // Normalize user_type to lowercase to ensure consistency with frontend role checks
        const normalizedUser = {
          ...res.data,
          user_type: res.data.user_type?.toLowerCase()
        };
        setUser(normalizedUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Explicitly try to refresh token on mount
        const res = await api.post("/auth/refresh");
        if (res.data?.accessToken) {
          setAccessToken(res.data.accessToken);
          // Now fetch user details
          const userRes = await api.get("/auth/me");
          if (userRes.data) {
            const normalizedUser = {
              ...userRes.data,
              user_type: userRes.data.user_type?.toLowerCase()
            };
            setUser(normalizedUser);
          }
        }
      } catch (error) {
        // Refresh failed (no cookie or invalid), just stay logged out
        console.log("Silent refresh failed:", error);
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password, captchaToken, rememberMe = false) => {
    // Construct request body for v2 recaptcha only
    const loginData = {
      user_input: email,
      user_password: password,
      rememberMe,
      captchaToken, // Backend checks for this key for v2 verification
    };

    // Axios throws on 4xx/5xx, so we just await the call
    const res = await api.post("/auth/login", loginData);

    if (res.data.accessToken) {
      setAccessToken(res.data.accessToken);
    }

    if (res.data.user) {
      const normalizedUser = {
        ...res.data.user,
        user_type: res.data.user.user_type?.toLowerCase()
      };
      setUser(normalizedUser);
      res.data.user = normalizedUser; // Update response for Login.jsx
    } else {
      await fetchUser();
    }

    return res.data; // Return data for redirect logic in Login.jsx
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, authChecked, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

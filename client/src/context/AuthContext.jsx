import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (active) setUser(me);
      } catch (error) {
        console.error("Failed to load user on init:", error);
        // Only clear token if it's an auth error, not a transient network error
        if (error.status === 401 || error.status === 403) {
          console.log("Token invalid, clearing storage");
          setToken(null);
        } else {
          console.log("Transient error, keeping token for retry");
          // Keep token for retry, don't log user out
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const loginWithToken = useCallback(async (token) => {
    try {
      setToken(token);
      setLoading(true);
      
      console.log("loginWithToken - Fetching user profile with token");
      const me = await api.me();
      console.log("loginWithToken - User profile received:", me);
      
      setUser(me);
      return me;
    } catch (error) {
      console.error("loginWithToken - Error:", error);
      setToken(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === "admin",
    loginWithToken,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

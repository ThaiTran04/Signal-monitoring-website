import { useCallback, useEffect, useState } from "react";
import { authApi } from "../services/api";
import { ApiError } from "../services/apiClient";
import { clearToken, getToken, setToken } from "../services/apiClient";

export interface UseAuthResult {
  isAuthenticated: boolean;
  username: string | null;
  checking: boolean;
  loginError: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

/**
 * Manages the login session: restores it from a stored token on mount
 * (so a page refresh doesn't kick the user back to /login), and exposes
 * login()/logout() actions.
 */
export function useAuth(): UseAuthResult {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = getToken();
      if (!token) {
        setChecking(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setIsAuthenticated(true);
          setUsername(me.username);
        }
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    setLoginError(null);
    try {
      const res = await authApi.login(u, p);
      setToken(res.access_token);
      setIsAuthenticated(true);
      setUsername(res.username);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Invalid username or password";
      setLoginError(message);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout().catch(() => {
      /* best effort - clear locally regardless */
    });
    clearToken();
    setIsAuthenticated(false);
    setUsername(null);
  }, []);

  return { isAuthenticated, username, checking, loginError, login, logout };
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, AuthUser, UserRole } from "../lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "smartflow_auth_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me(token);
        if (active) setUser(me);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login: async (email: string, password: string) => {
        const res = await api.login(email, password);
        localStorage.setItem(STORAGE_KEY, res.access_token);
        setToken(res.access_token);
        setUser(res.user);
      },
      logout: () => {
        if (token) {
          void api.logout(token).catch(() => undefined);
        }
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      },
      hasRole: (roles: UserRole[]) => !!user && roles.includes(user.role),
    }),
    [loading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

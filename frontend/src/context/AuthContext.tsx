import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAuthToken } from "@/lib/api";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string | null;
  mfa_enabled?: boolean;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerTenant: (payload: {
    tenant_name: string;
    admin_name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const TOKEN_KEY = "pp-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setTenant(null);
      setLoading(false);
      return;
    }
    setAuthToken(token);
    try {
      const { data } = await api.get("/api/auth/me");
      setUser(data.user);
      setTenant(data.tenant);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setAuthToken(data.access_token);
    setUser(data.user);
    setTenant(data.tenant);
  };

  const registerTenant = async (payload: {
    tenant_name: string;
    admin_name: string;
    email: string;
    password: string;
  }) => {
    const { data } = await api.post("/api/auth/register-tenant", payload);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setAuthToken(data.access_token);
    setUser(data.user);
    setTenant(data.tenant);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, tenant, loading, login, registerTenant, logout, refresh: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  apiRequest,
  login as loginRequest,
  loginWithGoogle,
  type LoginResult,
  type LoginUser,
} from "../lib/api";

interface AuthState {
  accessToken: string;
  user: LoginUser;
}

interface AuthContextValue {
  accessToken: string;
  user: LoginUser | null;
  login: (input: { email: string; password: string; tenantSlug?: string }) => Promise<LoginUser>;
  completeLogin: (result: LoginResult) => LoginUser;
  loginWithGoogleToken: (input: { idToken: string; tenantSlug?: string }) => Promise<LoginUser>;
  logout: () => void;
}

const STORAGE_KEY = "saas-cms-lms.auth";
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(): AuthState | null {
  try {
    // localStorage so print/report tabs opened via window.open keep the session
    // (sessionStorage is not shared across tabs/windows).
    const value =
      localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AuthState;
    if (!parsed.accessToken || !parsed.user) return null;
    return {
      ...parsed,
      user: {
        ...parsed.user,
        permissions: parsed.user.permissions ?? [],
        roles: parsed.user.roles ?? [],
        moduleSettings: parsed.user.moduleSettings ?? [],
      },
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function storeAuth(next: AuthState) {
  const raw = JSON.stringify(next);
  localStorage.setItem(STORAGE_KEY, raw);
  sessionStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<AuthState | null>(readStoredAuth);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  useEffect(() => {
    if (!auth?.accessToken) return;
    let cancelled = false;
    apiRequest<LoginUser>("/auth/me", auth.accessToken)
      .then((user) => {
        if (cancelled) return;
        const next = { accessToken: auth.accessToken, user };
        storeAuth(next);
        setAuth(next);
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.accessToken, logout]);

  const completeLogin = useCallback((result: LoginResult) => {
    const next = { accessToken: result.accessToken, user: result.user };
    storeAuth(next);
    setAuth(next);
    return result.user;
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string; tenantSlug?: string }) => {
      const result = await loginRequest(input);
      return completeLogin(result);
    },
    [completeLogin],
  );

  const loginWithGoogleToken = useCallback(
    async (input: { idToken: string; tenantSlug?: string }) => {
      const result = await loginWithGoogle(input);
      return completeLogin(result);
    },
    [completeLogin],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: auth?.accessToken ?? "",
      user: auth?.user ?? null,
      login,
      completeLogin,
      loginWithGoogleToken,
      logout,
    }),
    [auth, completeLogin, login, loginWithGoogleToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return {
    ...context,
    isAuthenticated: Boolean(context.accessToken && context.user),
    hasPermission: (permission: string) =>
      Boolean(context.user?.permissions?.includes(permission)),
  };
}

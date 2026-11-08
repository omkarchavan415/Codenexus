import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, hasSession, post, refreshSession, setAuthLostHandler, setTokens } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(hasSession());

  useEffect(() => {
    setAuthLostHandler(() => setUser(null));
    if (!hasSession()) return undefined;
    let cancelled = false;
    refreshSession()
      .then((data) => { if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setBooting(false); });
    return () => { cancelled = true; };
  }, []);

  const finish = useCallback((data) => {
    setTokens(data);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async (email, password) => finish(await api('/api/auth/login', { method: 'POST', body: { email, password }, auth: false })), [finish]);
  const register = useCallback(async (name, email, password) => finish(await api('/api/auth/register', { method: 'POST', body: { name, email, password }, auth: false })), [finish]);

  const logout = useCallback(async () => {
    const token = window.localStorage.getItem('cn_refresh_token');
    try { if (token) await post('/api/auth/logout', { refreshToken: token }); } catch { /* signing out locally anyway */ }
    clearTokens();
    setUser(null);
  }, []);

  const reloadUser = useCallback(async () => {
    const data = await api('/api/me');
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(() => ({ user, setUser, booting, login, register, logout, reloadUser }), [user, booting, login, register, logout, reloadUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

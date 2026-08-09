import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProfile } from '../services/auth';

const AuthContext = createContext(null);
const SPLASH_DURATION = 1800;

export function AuthProvider({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const splashDelay = new Promise((resolve) => setTimeout(resolve, SPLASH_DURATION));
      const token = localStorage.getItem('token');
      let restoredUser = null;
      if (token) {
        try {
          const response = await getProfile();
          restoredUser = response.data;
          localStorage.setItem('user', JSON.stringify(restoredUser));
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      await splashDelay;
      if (!active) return;
      setUser(restoredUser);
      setAuthLoading('exiting');
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (active) setAuthLoading(false);
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  const completeAuthentication = useCallback((token, nextUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ authLoading, user, completeAuthentication, logout }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

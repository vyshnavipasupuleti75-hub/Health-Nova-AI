import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProfile } from '../services/auth';
import { applyTheme } from '../utils/theme';
import { detachPushSubscription, ensurePushSubscription, notificationPermission } from '../utils/notifications';

const AuthContext = createContext(null);
export const DEFAULT_SETTINGS = { healthNotifications: false, waterReminders: { enabled: false, intervalMinutes: 120 }, language: 'en', darkMode: false };

// Browser data that belongs to one signed-in user and must not leak to the next one.
function clearUserSessionData() {
  localStorage.removeItem('currentReport');
  localStorage.removeItem('analysis');
  sessionStorage.removeItem('health-nova-chat');
}

export function AuthProvider({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
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
      if (!active) return;
      setUser(restoredUser);
      setAuthLoading(false);
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  // The theme follows the signed-in user's saved setting; signed-out pages use the light theme.
  // Skip the fade while the session is still being restored so the first paint does not animate.
  // authLoading is true only until the saved JWT has been checked; the startup intro timing lives in App.
  const darkMode = Boolean(user?.settings?.darkMode);
  useEffect(() => {
    if (authLoading) return;
    applyTheme(darkMode ? 'dark' : 'light', { animate: true });
  }, [darkMode, authLoading]);

  const completeAuthentication = useCallback((token, nextUser) => {
    clearUserSessionData();
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  // Call with the user object returned by the API after any profile/settings change.
  const updateUser = useCallback((nextUser) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    detachPushSubscription(localStorage.getItem('token'));
    // Without this, Google could silently pick the same account on the next visit.
    window.google?.accounts?.id?.disableAutoSelect?.();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearUserSessionData();
    setUser(null);
  }, []);

  // Re-attach this browser for push after login/refresh when the account has notifications on and permission
  // was already granted. Never prompts: permission is only requested from the Settings toggles.
  const wantsPush = Boolean(user?.settings?.healthNotifications || user?.settings?.waterReminders?.enabled);
  const userId = user?.id || user?._id;
  useEffect(() => {
    if (!userId || !wantsPush || notificationPermission() !== 'granted') return;
    ensurePushSubscription().catch(() => {});
  }, [userId, wantsPush]);

  const settings = { ...DEFAULT_SETTINGS, ...(user?.settings || {}) };

  return <AuthContext.Provider value={{ authLoading, user, settings, completeAuthentication, updateUser, logout }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

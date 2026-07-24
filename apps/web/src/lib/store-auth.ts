import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  region: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
}

function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp || 0;
  } catch {
    return 0;
  }
}

function isTokenExpiringSoon(token: string, thresholdSeconds = 86400): boolean {
  const exp = getTokenExpiry(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return (exp - now) < thresholdSeconds;
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function startPeriodicRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const token = localStorage.getItem('accessToken');
    const refresh = localStorage.getItem('refreshToken');
    if (token && refresh && isTokenExpiringSoon(token)) {
      api.refresh(refresh).then((res) => {
        api.setToken(res.data.accessToken);
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        useAuthStore.setState({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
        });
      }).catch(() => {});
    }
  }, 10 * 60 * 1000);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.login(email, password);
    api.setToken(res.data.accessToken);
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    set({
      user: res.data.user,
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
    });
    startPeriodicRefresh();
  },

  register: async (email, password, name) => {
    const res = await api.register(email, password, name);
    api.setToken(res.data.accessToken);
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    set({
      user: res.data.user,
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
    });
    startPeriodicRefresh();
  },

  logout: () => {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    api.setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null });
    window.location.href = '/';
  },

  restore: async () => {
    const token = localStorage.getItem('accessToken');
    const refresh = localStorage.getItem('refreshToken');
    if (token) {
      try {
        if (refresh && isTokenExpiringSoon(token)) {
          const res = await api.refresh(refresh);
          api.setToken(res.data.accessToken);
          localStorage.setItem('accessToken', res.data.accessToken);
          localStorage.setItem('refreshToken', res.data.refreshToken);
          const meRes = await api.getMe();
          set({
            user: meRes.data,
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            isLoading: false,
          });
        } else {
          api.setToken(token);
          const res = await api.getMe();
          set({
            user: res.data,
            accessToken: token,
            refreshToken: refresh,
            isLoading: false,
          });
        }
        startPeriodicRefresh();
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));

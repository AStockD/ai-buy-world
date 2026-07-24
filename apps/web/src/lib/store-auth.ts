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
  },

  logout: () => {
    api.setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null });
    window.location.href = '/';
  },

  restore: async () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        api.setToken(token);
        const res = await api.getMe();
        set({
          user: res.data,
          accessToken: token,
          refreshToken: localStorage.getItem('refreshToken'),
          isLoading: false,
        });
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

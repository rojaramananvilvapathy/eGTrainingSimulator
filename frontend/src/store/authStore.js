import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,
      error:        null,

      register: async ({ username, email, password, display_name }) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post('/auth/register', { username, email, password, display_name });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Registration failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
          return { success: true };
        } catch (err) {
          const error = err.response?.data?.error || 'Login failed';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {}
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, refreshToken: null });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const { data } = await api.post('/auth/refresh', { refreshToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          return true;
        } catch {
          set({ user: null, accessToken: null, refreshToken: null });
          return false;
        }
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.user });
        } catch {}
      },
    }),
    {
      name: 'eg-sim-auth',
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

export default useAuthStore;

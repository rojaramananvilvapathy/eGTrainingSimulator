import axios from 'axios';

const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout:         15_000,
});

// Attach stored token on startup
const stored = JSON.parse(localStorage.getItem('eg-sim-auth') || '{}');
if (stored?.state?.accessToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${stored.state.accessToken}`;
}

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve());
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry &&
        !original.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original)).catch(err => Promise.reject(err));
      }
      original._retry = true;
      isRefreshing = true;

      // Lazy import to avoid circular dependency
      const { default: useAuthStore } = await import('../store/authStore');
      const ok = await useAuthStore.getState().refreshAccessToken();
      isRefreshing = false;
      processQueue(!ok ? error : null);

      if (ok) return api(original);
    }
    return Promise.reject(error);
  }
);

export default api;

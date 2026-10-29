import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401 (without infinite loop)
let isRefreshing = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshing) {
      isRefreshing = true;
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken } = res.data;
          localStorage.setItem('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          isRefreshing = false;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          isRefreshing = false;
          return Promise.reject(error);
        }
      }
      isRefreshing = false;
    }
    return Promise.reject(error);
  }
);

export default api;

/** Wrap mock data in an axios-style response shape */
export function mockResponse<T>(data: T, delayMs = 200): Promise<{ data: T }> {
  return new Promise((resolve) => setTimeout(() => resolve({ data }), delayMs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IS_MOCK = (import.meta as any).env.VITE_MOCK === 'true';

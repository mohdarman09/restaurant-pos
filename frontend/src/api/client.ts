import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '../app/store';
import { setAccessToken, logout } from '../features/auth/authSlice';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = store.getState().auth.refreshToken;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken });
    const newToken: string = data.data.accessToken;
    store.dispatch(setAccessToken(newToken));
    return newToken;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshInFlight = refreshInFlight ?? refreshAccessToken();
      const newToken = await refreshInFlight;
      refreshInFlight = null;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

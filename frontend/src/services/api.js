import axios from 'axios';

const configuredUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const apiBaseUrl = configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`;

const api = axios.create({ baseURL: apiBaseUrl, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  },
);

export const API_ORIGIN = new URL(apiBaseUrl).origin;
// The backend stores profile photos as server-relative paths such as /uploads/avatar-123.jpg.
export function profilePhotoUrl(user) {
  const stored = user?.profilePicture;
  if (!stored) return '';
  return /^https?:\/\//i.test(stored) ? stored : `${API_ORIGIN}${stored.startsWith('/') ? '' : '/'}${stored}`;
}
export function getApiErrorMessage(error, fallback) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === 'ECONNABORTED') return `The HealthNova API at ${API_ORIGIN} did not respond in time.`;
  if (error.code === 'ERR_NETWORK') return `Cannot reach the HealthNova API at ${API_ORIGIN}. Make sure the backend is running.`;
  return import.meta.env.DEV && error.message ? `${fallback} (${error.message})` : fallback;
}
export default api;

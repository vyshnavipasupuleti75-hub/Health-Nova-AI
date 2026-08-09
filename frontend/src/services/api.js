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
export default api;

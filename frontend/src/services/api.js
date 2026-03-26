import axios from 'axios';

// Usar variável de ambiente para a URL da API, ou fallback para localhost
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (window.location.pathname !== '/login') {
         localStorage.removeItem('token');
         localStorage.removeItem('perfilUsuario');
         localStorage.removeItem('nomeLogado');
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

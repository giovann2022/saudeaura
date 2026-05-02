import axios from 'axios';

// Em produção (build), usa URL relativa para o nginx proxy (/api/ → porta 3000)
// Em desenvolvimento, acessa localhost:3000 diretamente
const api = axios.create({
  baseURL: import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3000')
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Em produção, prefixa /api/ para que o nginx encaminhe ao backend
  if (import.meta.env.PROD) {
    config.url = '/api' + config.url;
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

import axios from 'axios';

// Usar localhost para testar as novas mudanças do backend
const api = axios.create({
  baseURL: 'http://localhost:3000'
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

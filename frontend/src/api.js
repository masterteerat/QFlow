import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  registerCustomer: (data) => API.post('/auth/customer/register', data),
  loginCustomer: (data) => API.post('/auth/customer/login', data),
  registerOwner: (data) => API.post('/auth/owner/register', data),
  loginOwner: (data) => API.post('/auth/owner/login', data),
};

export default API;

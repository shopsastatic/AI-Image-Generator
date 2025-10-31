const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';

export const API_ENDPOINTS = {
  AUTH_LOGIN: `${API_BASE_URL}/api/auth/login`,
  AUTH_VERIFY: `${API_BASE_URL}/api/auth/verify`,
  AUTH_LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  AUTH_REGISTER: `${API_BASE_URL}/api/auth/register`,
};
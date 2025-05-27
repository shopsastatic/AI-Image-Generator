const getApiBaseUrl = (): string => {
  // In development, use proxy (empty string means same origin)
  if (import.meta.env.DEV) {
    return '';
  }
  
  // In production, use environment variable or fallback
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();

export const buildApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  if (API_BASE_URL) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  return `/${cleanPath}`;
};

export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: buildApiUrl('api/auth/login'),
  AUTH_VERIFY: buildApiUrl('api/auth/verify'), 
  AUTH_LOGOUT: buildApiUrl('api/auth/logout'),
  
  // AI APIs
  CLAUDE: buildApiUrl('api/claude'),
  CLAUDE_CACHED: buildApiUrl('api/claude-cached'),
  CHATGPT: buildApiUrl('api/chatgpt'),
  
  // Image Processing
  PROXY_IMAGE: buildApiUrl('api/proxy-image'),
  PROXY_IMAGE_DIRECT: buildApiUrl('api/proxy-image-direct'),
  
  // Utility
  HEALTH: buildApiUrl('api/health'),
  CACHE_STATS: buildApiUrl('api/cache-stats'),
} as const;
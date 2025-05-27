// Không cần getApiBaseUrl nữa
export const buildApiUrl = (path: string): string => {
  // Đảm bảo path bắt đầu bằng /
  return path.startsWith('/') ? path : `/${path}`;
};

export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: buildApiUrl('/api/auth/login'),
  AUTH_VERIFY: buildApiUrl('/api/auth/verify'),
  AUTH_LOGOUT: buildApiUrl('/api/auth/logout'),
  
  // AI APIs
  CLAUDE: buildApiUrl('/api/claude'),
  CLAUDE_CACHED: buildApiUrl('/api/claude-cached'),
  CHATGPT: buildApiUrl('/api/chatgpt'),
  
  // Image Processing
  PROXY_IMAGE: buildApiUrl('/api/proxy-image'),
  PROXY_IMAGE_DIRECT: buildApiUrl('/api/proxy-image-direct'),
  
  // Utility
  HEALTH: buildApiUrl('/api/health'),
  CACHE_STATS: buildApiUrl('/api/cache-stats'),
} as const;
// api-config.js - Configuration cho Rate Limiting và Error Handling
export const API_RATE_LIMITS = {
  // 🔄 Queue Management Settings
  QUEUE: {
    MAX_CONCURRENT_REQUESTS: 30, 
    DELAY_BETWEEN_REQUESTS: 1500,
    MAX_QUEUE_SIZE: 50,
    REQUEST_TIMEOUT: 6000000,
  },

  // 🔄 Retry Settings
  RETRY: {
    MAX_RETRIES: 5,
    BASE_DELAY: 1000,
    MAX_DELAY: 30000,
    JITTER_MAX: 1000,
    
    // Retry cho các loại lỗi khác nhau
    RETRY_ON_STATUS: [408, 429, 500, 502, 503, 504],
    NO_RETRY_ON_STATUS: [400, 401, 403, 404, 422],
  },

  // 🔄 API Key Management
  KEYS: {
    CONSECUTIVE_ERROR_THRESHOLD: 30,    // Số lỗi liên tiếp trước khi block key
    ERROR_BLOCK_DURATION: 600000000,       // Thời gian block key khi có lỗi liên tiếp (ms)
    RATE_LIMIT_BLOCK_DURATION: 600000, // Thời gian block khi bị rate limit (ms)
    INVALID_KEY_BLOCK_DURATION: 3600000, // Thời gian block khi key invalid (ms)
    KEY_COOLDOWN_PERIOD: 90000,        // Thời gian nghỉ giữa các lần sử dụng key (ms)
  },

  // 🔄 Different settings for HD vs Normal mode
  MODE_SPECIFIC: {
    OFFICIAL: {
      MAX_CONCURRENT: 30,
      DELAY_BETWEEN: 1000,
      MAX_RETRIES: 3,
    },
    UNOFFICIAL: {
      MAX_CONCURRENT: 30,
      DELAY_BETWEEN: 2000,
      MAX_RETRIES: 5,
    }
  }
};

// 🔄 Enhanced Error Classification
export const ERROR_TYPES = {
  RATE_LIMIT: {
    status: [429],
    action: 'WAIT_AND_RETRY',
    blockDuration: API_RATE_LIMITS.KEYS.RATE_LIMIT_BLOCK_DURATION,
    retryable: true
  },
  
  AUTH_ERROR: {
    status: [401, 403],
    action: 'BLOCK_KEY',
    blockDuration: API_RATE_LIMITS.KEYS.INVALID_KEY_BLOCK_DURATION,
    retryable: false
  },
  
  SERVER_ERROR: {
    status: [500, 502, 503, 504],
    action: 'RETRY_WITH_BACKOFF',
    blockDuration: API_RATE_LIMITS.KEYS.ERROR_BLOCK_DURATION,
    retryable: true
  },
  
  CLIENT_ERROR: {
    status: [400, 404, 422],
    action: 'NO_RETRY',
    blockDuration: 0,
    retryable: false
  },
  
  TIMEOUT: {
    status: [408],
    action: 'RETRY_WITH_BACKOFF',
    blockDuration: 30000,
    retryable: true
  }
};

// 🔄 Helper functions
export class RateLimitHelper {
  static calculateBackoffDelay(attemptNumber, baseDelay = API_RATE_LIMITS.RETRY.BASE_DELAY) {
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, attemptNumber),
      API_RATE_LIMITS.RETRY.MAX_DELAY
    );
    
    const jitter = Math.random() * API_RATE_LIMITS.RETRY.JITTER_MAX;
    return exponentialDelay + jitter;
  }

  static shouldRetry(error, attemptNumber) {
    const maxRetries = API_RATE_LIMITS.RETRY.MAX_RETRIES;
    
    if (attemptNumber >= maxRetries) {
      return false;
    }

    const status = error.response?.status || error.status;
    
    if (API_RATE_LIMITS.RETRY.NO_RETRY_ON_STATUS.includes(status)) {
      return false;
    }

    if (API_RATE_LIMITS.RETRY.RETRY_ON_STATUS.includes(status)) {
      return true;
    }

    // Network errors, timeouts, etc.
    if (!status && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
      return true;
    }

    return false;
  }

  static classifyError(error) {
    const status = error.response?.status || error.status;
    
    for (const [type, config] of Object.entries(ERROR_TYPES)) {
      if (config.status.includes(status)) {
        return { type, config };
      }
    }

    // Default for unknown errors
    return {
      type: 'UNKNOWN',
      config: {
        action: 'RETRY_WITH_BACKOFF',
        blockDuration: 60000,
        retryable: true
      }
    };
  }

  static getConfigForMode(isHDMode) {
    return isHDMode 
      ? API_RATE_LIMITS.MODE_SPECIFIC.UNOFFICIAL
      : API_RATE_LIMITS.MODE_SPECIFIC.OFFICIAL;
  }
}

// 🔄 Usage example trong JobManager
export const applyRateLimitConfig = (jobManager, isHDMode = false) => {
  const config = RateLimitHelper.getConfigForMode(isHDMode);
  
  // Update queue settings
  if (jobManager.apiManager?.requestQueue) {
    jobManager.apiManager.requestQueue.maxConcurrency = config.MAX_CONCURRENT;
    jobManager.apiManager.requestQueue.delayBetweenRequests = config.DELAY_BETWEEN;
  }
  
  console.log(`🔧 Applied rate limit config for ${isHDMode ? 'HD' : 'Normal'} mode:`, config);
};
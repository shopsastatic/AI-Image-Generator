import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ FIX: NOW we can use __dirname safely  
const subcategoriesFilePath = path.join(__dirname, 'static', 'subcategories.json');

// Load environment variables FIRST
dotenv.config();


// Now import and create JobManager AFTER env vars are loaded
import { createJobManager } from './JobManager.js';
import { getInstructionsManager, createInstructionsManager } from './InstructionsManager.js';

console.log('🔍 Environment variables loaded:');
console.log('OPENAI_API_KEY_1:', process.env.OPENAI_API_KEY_1 ? 'SET' : 'NOT SET');
console.log('OPENAI_API_KEY_2:', process.env.OPENAI_API_KEY_2 ? 'SET' : 'NOT SET');
console.log('CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? 'SET' : 'NOT SET');

// Create JobManager instance after environment variables are loaded
const jobManager = createJobManager();
const instructionsManager = createInstructionsManager();

const app = express();
const port = process.env.PORT || 3001;

const frontendBuildPath = path.join(__dirname, 'dist');
app.use(express.static(frontendBuildPath));

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'https://ai.miseninc.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

const AUTH_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_EXPIRES_IN: '7d',
  COOKIE_NAME: 'ai_image_auth',
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
};

const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
};

const verifyPassword = (inputPassword, storedHash, salt) => {
  const inputHash = hashPassword(inputPassword, salt);
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(inputHash, 'hex'));
};

const generateSalt = () => {
  return crypto.randomBytes(32).toString('hex');
};

let authCredentials = null;
if (process.env.LOGIN_PASSWORD_HASH && process.env.LOGIN_PASSWORD_SALT) {
  authCredentials = {
    salt: process.env.LOGIN_PASSWORD_SALT,
    hashedPassword: process.env.LOGIN_PASSWORD_HASH,
    email: process.env.LOGIN_EMAIL || 'admin@aiimage.com'
  };
} else if (process.env.LOGIN_PASSWORD) {
  const salt = generateSalt();
  const hashedPassword = hashPassword(process.env.LOGIN_PASSWORD, salt);
  authCredentials = {
    salt: salt,
    hashedPassword: hashedPassword,
    email: process.env.LOGIN_EMAIL || 'admin@aiimage.com'
  };
}

const generateToken = (payload) => {
  return jwt.sign(payload, AUTH_CONFIG.JWT_SECRET, {
    expiresIn: AUTH_CONFIG.JWT_EXPIRES_IN
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, AUTH_CONFIG.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

app.use((req, res, next) => {
  req.cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      req.cookies[name] = decodeURIComponent(value || '');
    });
  }
  next();
});

const requireAuth = (req, res, next) => {
  const token = req.cookies?.[AUTH_CONFIG.COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie(AUTH_CONFIG.COOKIE_NAME);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
};

app.post('/api/image-generation/submit', requireAuth, async (req, res) => {
  try {
    const {
      sessionId,
      userPrompt,
      numberOfImages,
      imageSizesString,
      selectedQuality = 'low',
      selectedCategory,
      selectedModel = 'claude-sonnet',  // ✅ ADD: Extract selectedModel
      isHDMode = false               // ✅ ADD: Extract isHDMode
    } = req.body;

    if (!sessionId || !userPrompt || !numberOfImages) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, userPrompt, numberOfImages'
      });
    }

    console.log(`🔍 Creating job with model: ${selectedModel}, HD Mode: ${isHDMode}`);

    const jobId = await jobManager.createJob(
      sessionId,
      userPrompt,
      numberOfImages,
      imageSizesString || 'auto',
      selectedQuality,
      selectedCategory || { category: 'google_prompt', subcategory: '' },
      selectedModel,  // ✅ FIX: Pass selectedModel
      isHDMode        // ✅ FIX: Pass isHDMode
    );

    res.json({
      success: true,
      jobId: jobId,
      totalImages: numberOfImages,
      estimatedTime: numberOfImages * 15,
      message: 'Job submitted successfully',
      config: {
        model: selectedModel,
        hdMode: isHDMode
      }
    });

  } catch (error) {
    console.error('Job submission failed:', error);
    res.status(500).json({
      error: 'Failed to submit job',
      message: error.message
    });
  }
});

app.post('/api/system/queue-config', requireAuth, (req, res) => {
  try {
    const { maxConcurrency, delayBetweenRequests } = req.body;

    // Validate input
    if (!maxConcurrency || !delayBetweenRequests) {
      return res.status(400).json({
        error: 'Missing required fields: maxConcurrency, delayBetweenRequests'
      });
    }

    if (maxConcurrency < 1 || maxConcurrency > 5) {
      return res.status(400).json({
        error: 'maxConcurrency must be between 1 and 5'
      });
    }

    if (delayBetweenRequests < 100 || delayBetweenRequests > 10000) {
      return res.status(400).json({
        error: 'delayBetweenRequests must be between 100 and 10000 ms'
      });
    }

    // Update queue configuration
    const stats = jobManager.getStats();

    // Get current API manager and update its queue config
    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      jobManager.apiManager.requestQueue.maxConcurrency = maxConcurrency;
      jobManager.apiManager.requestQueue.delayBetweenRequests = delayBetweenRequests;

      console.log(`🔧 Queue config updated:`, {
        maxConcurrency,
        delayBetweenRequests,
        apiMode: stats.api.mode
      });

      res.json({
        success: true,
        message: 'Queue configuration updated',
        config: {
          maxConcurrency,
          delayBetweenRequests,
          apiMode: stats.api.mode
        }
      });
    } else {
      res.status(500).json({
        error: 'API Manager not initialized or no active queue'
      });
    }

  } catch (error) {
    console.error('Queue config update failed:', error);
    res.status(500).json({
      error: 'Failed to update queue configuration',
      message: error.message
    });
  }
});

app.get('/api/system/stats', requireAuth, (req, res) => {
  try {
    const jobStats = jobManager.getStats();
    const instructionsStats = instructionsManager.getStats();

    // Add detailed queue information
    let enhancedQueueStats = null;
    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      const queueStats = jobManager.apiManager.requestQueue.getStats();
      enhancedQueueStats = {
        ...queueStats,
        utilizationRate: queueStats.maxConcurrency > 0
          ? Math.round((queueStats.activeRequests / queueStats.maxConcurrency) * 100)
          : 0,
        isIdle: queueStats.activeRequests === 0 && queueStats.queueLength === 0,
        isConcurrent: queueStats.activeRequests > 1,
        isBacklogged: queueStats.queueLength > 5
      };
    }

    res.json({
      success: true,
      ...jobStats,
      api: {
        ...jobStats.api,
        queue: enhancedQueueStats
      },
      instructions: instructionsStats, // ✅ NEW: Instructions stats
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      performance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage ? process.cpuUsage() : null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system stats',
      message: error.message
    });
  }
});


app.post('/api/system/queue-process', requireAuth, (req, res) => {
  try {
    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      // Force process queue
      jobManager.apiManager.requestQueue.processQueue();

      const queueStats = jobManager.apiManager.requestQueue.getStats();

      res.json({
        success: true,
        message: 'Queue processing triggered',
        queueStats
      });
    } else {
      res.status(400).json({
        error: 'No active queue to process'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process queue',
      message: error.message
    });
  }
});


app.get('/api/system/queue-debug', requireAuth, (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      hasJobManager: !!jobManager,
      hasApiManager: !!jobManager.apiManager,
      hasRequestQueue: !!(jobManager.apiManager && jobManager.apiManager.requestQueue),
      activeJobs: Array.from(jobManager.jobs.values()).map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        model: job.selectedModel,
        hdMode: job.isHDMode,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }))
    };

    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      const queue = jobManager.apiManager.requestQueue;
      debugInfo.queueDetails = {
        ...queue.getStats(),
        queueItems: queue.queue.map(task => ({
          id: task.id,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
          addedAt: task.addedAt,
          waitTime: Date.now() - task.addedAt
        }))
      };
    }

    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get debug info',
      message: error.message
    });
  }
});


app.get('/api/system/queue-stream', requireAuth, (req, res) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial data
  const sendStats = () => {
    try {
      const stats = jobManager.getStats();
      let queueStats = null;

      if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
        queueStats = jobManager.apiManager.requestQueue.getStats();
      }

      const data = {
        timestamp: Date.now(),
        queue: queueStats,
        jobs: stats.jobs,
        api: stats.api
      };

      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };

  // Send stats immediately
  sendStats();

  // Send stats every second
  const interval = setInterval(sendStats, 1000);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });

  req.on('end', () => {
    clearInterval(interval);
    res.end();
  });
});

app.post('/api/system/key-rotation', requireAuth, (req, res) => {
  try {
    if (jobManager.apiManager && jobManager.apiManager.apiKeys) {
      const currentIndex = jobManager.apiManager.currentIndex;
      const totalKeys = jobManager.apiManager.apiKeys.length;

      if (totalKeys > 1) {
        // Force rotation to next key
        jobManager.apiManager.currentIndex = (currentIndex + 1) % totalKeys;

        console.log(`🔄 Forced key rotation: ${currentIndex} → ${jobManager.apiManager.currentIndex}`);

        res.json({
          success: true,
          message: 'Key rotation forced',
          rotation: {
            from: currentIndex,
            to: jobManager.apiManager.currentIndex,
            totalKeys: totalKeys
          }
        });
      } else {
        res.json({
          success: false,
          message: 'Only one key available, rotation not applicable'
        });
      }
    } else {
      res.status(400).json({
        error: 'No API manager or keys available'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to force key rotation',
      message: error.message
    });
  }
});

// ✅ ENHANCED: Add HD-specific key management endpoint
app.get('/api/system/key-health', requireAuth, (req, res) => {
  try {
    if (!jobManager.apiManager) {
      return res.status(400).json({
        error: 'No API manager initialized'
      });
    }

    const keyHealth = jobManager.apiManager.apiKeys.map(key => {
      const timeSinceLastUsed = key.lastUsed ? Date.now() - key.lastUsed : null;
      const isHealthy = key.consecutiveErrors < 3 && key.successCount > key.errorCount;

      return {
        id: key.id,
        status: key.status,
        health: {
          isHealthy,
          requestCount: key.requestCount,
          successCount: key.successCount,
          errorCount: key.errorCount,
          consecutiveErrors: key.consecutiveErrors,
          successRate: key.requestCount > 0 ? Math.round((key.successCount / key.requestCount) * 100) : 0,
          lastUsed: key.lastUsed,
          timeSinceLastUsed,
          rateLimitResetTime: key.rateLimitResetTime
        },
        recommendations: []
      };
    });

    // Add recommendations
    keyHealth.forEach(key => {
      if (key.health.consecutiveErrors >= 3) {
        key.recommendations.push('Consider rotating to healthier key');
      }
      if (key.health.successRate < 50) {
        key.recommendations.push('Key performance is poor, check credentials');
      }
      if (key.status === 'rate_limited') {
        const resetTime = new Date(key.health.rateLimitResetTime);
        key.recommendations.push(`Rate limit resets at ${resetTime.toLocaleTimeString()}`);
      }
      if (key.status === 'invalid') {
        key.recommendations.push('Key appears invalid, check API credentials');
      }
    });

    res.json({
      success: true,
      mode: jobManager.apiManager.config.mode,
      totalKeys: keyHealth.length,
      healthyKeys: keyHealth.filter(k => k.health.isHealthy).length,
      keyHealth,
      recommendations: {
        overall: keyHealth.every(k => k.health.isHealthy)
          ? 'All keys are healthy'
          : 'Some keys need attention',
        actions: keyHealth.filter(k => !k.health.isHealthy).length > 0
          ? ['Check unhealthy keys', 'Consider key rotation', 'Monitor error rates']
          : []
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get key health',
      message: error.message
    });
  }
});


app.post('/api/system/key-reset/:keyId', requireAuth, (req, res) => {
  try {
    const { keyId } = req.params;

    if (!jobManager.apiManager || !jobManager.apiManager.apiKeys) {
      return res.status(400).json({
        error: 'No API manager or keys available'
      });
    }

    const key = jobManager.apiManager.apiKeys.find(k => k.id === parseInt(keyId));

    if (!key) {
      return res.status(404).json({
        error: `Key ${keyId} not found`
      });
    }

    // Reset key status
    const oldStatus = {
      status: key.status,
      consecutiveErrors: key.consecutiveErrors,
      errorCount: key.errorCount,
      rateLimitResetTime: key.rateLimitResetTime
    };

    key.status = 'available';
    key.consecutiveErrors = 0;
    key.errorCount = 0;
    key.rateLimitResetTime = null;

    console.log(`🔄 Reset key ${keyId} status:`, oldStatus, '→', {
      status: key.status,
      consecutiveErrors: key.consecutiveErrors,
      errorCount: key.errorCount
    });

    res.json({
      success: true,
      message: `Key ${keyId} reset successfully`,
      keyId: parseInt(keyId),
      resetFrom: oldStatus,
      resetTo: {
        status: key.status,
        consecutiveErrors: key.consecutiveErrors,
        errorCount: key.errorCount,
        rateLimitResetTime: key.rateLimitResetTime
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset key',
      message: error.message
    });
  }
});


app.post('/api/system/queue-config', requireAuth, (req, res) => {
  try {
    const { maxConcurrency, delayBetweenRequests } = req.body;

    // Validate input
    if (!maxConcurrency || !delayBetweenRequests) {
      return res.status(400).json({
        error: 'Missing required fields: maxConcurrency, delayBetweenRequests'
      });
    }

    if (maxConcurrency < 1 || maxConcurrency > 5) {
      return res.status(400).json({
        error: 'maxConcurrency must be between 1 and 5'
      });
    }

    if (delayBetweenRequests < 100 || delayBetweenRequests > 10000) {
      return res.status(400).json({
        error: 'delayBetweenRequests must be between 100 and 10000 ms'
      });
    }

    // Update queue configuration
    const stats = jobManager.getStats();

    // Get current API manager and update its queue config
    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      jobManager.apiManager.requestQueue.maxConcurrency = maxConcurrency;
      jobManager.apiManager.requestQueue.delayBetweenRequests = delayBetweenRequests;

      console.log(`🔧 Queue config updated:`, {
        maxConcurrency,
        delayBetweenRequests,
        apiMode: stats.api.mode
      });

      res.json({
        success: true,
        message: 'Queue configuration updated',
        config: {
          maxConcurrency,
          delayBetweenRequests,
          apiMode: stats.api.mode
        }
      });
    } else {
      res.status(500).json({
        error: 'API Manager not initialized or no active queue'
      });
    }

  } catch (error) {
    console.error('Queue config update failed:', error);
    res.status(500).json({
      error: 'Failed to update queue configuration',
      message: error.message
    });
  }
});


app.get('/api/system/stats', requireAuth, (req, res) => {
  try {
    const stats = jobManager.getStats();

    // Add detailed queue information
    let enhancedQueueStats = null;
    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      const queueStats = jobManager.apiManager.requestQueue.getStats();
      enhancedQueueStats = {
        ...queueStats,
        // Add performance metrics
        utilizationRate: queueStats.maxConcurrency > 0
          ? Math.round((queueStats.activeRequests / queueStats.maxConcurrency) * 100)
          : 0,
        isIdle: queueStats.activeRequests === 0 && queueStats.queueLength === 0,
        isConcurrent: queueStats.activeRequests > 1,
        isBacklogged: queueStats.queueLength > 5
      };
    }

    res.json({
      success: true,
      ...stats,
      api: {
        ...stats.api,
        queue: enhancedQueueStats
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      // Add system performance indicators
      performance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage ? process.cpuUsage() : null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system stats',
      message: error.message
    });
  }
});

// ✅ ADD: Force queue processing endpoint (for debugging)
app.post('/api/system/queue-process', requireAuth, (req, res) => {
  try {
    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      // Force process queue
      jobManager.apiManager.requestQueue.processQueue();

      const queueStats = jobManager.apiManager.requestQueue.getStats();

      res.json({
        success: true,
        message: 'Queue processing triggered',
        queueStats
      });
    } else {
      res.status(400).json({
        error: 'No active queue to process'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process queue',
      message: error.message
    });
  }
});

// ✅ ADD: Queue debug info endpoint
app.get('/api/system/queue-debug', requireAuth, (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      hasJobManager: !!jobManager,
      hasApiManager: !!jobManager.apiManager,
      hasRequestQueue: !!(jobManager.apiManager && jobManager.apiManager.requestQueue),
      activeJobs: Array.from(jobManager.jobs.values()).map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        model: job.selectedModel,
        hdMode: job.isHDMode,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }))
    };

    if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
      const queue = jobManager.apiManager.requestQueue;
      debugInfo.queueDetails = {
        ...queue.getStats(),
        queueItems: queue.queue.map(task => ({
          id: task.id,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
          addedAt: task.addedAt,
          waitTime: Date.now() - task.addedAt
        }))
      };
    }

    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get debug info',
      message: error.message
    });
  }
});

// ✅ ADD: Real-time WebSocket-like endpoint using Server-Sent Events
app.get('/api/system/queue-stream', requireAuth, (req, res) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial data
  const sendStats = () => {
    try {
      const stats = jobManager.getStats();
      let queueStats = null;

      if (jobManager.apiManager && jobManager.apiManager.requestQueue) {
        queueStats = jobManager.apiManager.requestQueue.getStats();
      }

      const data = {
        timestamp: Date.now(),
        queue: queueStats,
        jobs: stats.jobs,
        api: stats.api
      };

      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };

  // Send stats immediately
  sendStats();

  // Send stats every second
  const interval = setInterval(sendStats, 1000);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });

  req.on('end', () => {
    clearInterval(interval);
    res.end();
  });
});


app.get('/api/image-generation/status/:jobId', requireAuth, (req, res) => {
  try {
    const { jobId } = req.params;
    const status = jobManager.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      jobId: jobId,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({
      error: 'Failed to check job status',
      message: error.message
    });
  }
});

app.post('/api/image-generation/cancel/:jobId', requireAuth, (req, res) => {
  try {
    const { jobId } = req.params;
    const cancelled = jobManager.cancelJob(jobId);

    if (!cancelled) {
      return res.status(400).json({
        error: 'Job cannot be cancelled (not found or already completed)'
      });
    }

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    console.error('Job cancellation failed:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message
    });
  }
});

app.get('/api/image-generation/results/:jobId', requireAuth, (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'Job not completed yet',
        status: job.status
      });
    }

    res.json({
      success: true,
      jobId: jobId,
      sessionId: job.sessionId,
      results: job.results,
      progress: job.progress,
      originalPrompt: job.userPrompt, // FIX: Include original user prompt
      userPrompt: job.userPrompt, // FIX: Also include as userPrompt for fallback
      claudeResponse: job.claudeResponse, // FIX: Return Claude response
      completedAt: job.updatedAt
    });

  } catch (error) {
    console.error('Failed to get results:', error);
    res.status(500).json({
      error: 'Failed to get job results',
      message: error.message
    });
  }
});

app.get('/api/system/stats', requireAuth, (req, res) => {
  try {
    const stats = jobManager.getStats();

    res.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system stats',
      message: error.message
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!authCredentials) {
      return res.status(500).json({
        error: 'Authentication not configured on server'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // ✅ CHECK: Determine user role based on email
    let userRole = 'user';
    let validCredentials = null;

    // Check admin credentials first
    const adminEmail = process.env.LOGIN_ADMIN_EMAIL || 'adminai';
    const adminPassword = process.env.LOGIN_ADMIN_PASSWORD || '66666666';
    
    if (email.toLowerCase().trim() === adminEmail.toLowerCase().trim()) {
      if (password === adminPassword) {
        userRole = 'admin';
        validCredentials = { email: adminEmail };
      }
    }
    
    // If not admin, check regular user credentials
    if (!validCredentials) {
      const isEmailValid = email.toLowerCase().trim() === authCredentials.email.toLowerCase().trim();
      const isPasswordValid = verifyPassword(password, authCredentials.hashedPassword, authCredentials.salt);
      
      if (isEmailValid && isPasswordValid) {
        userRole = 'user';
        validCredentials = authCredentials;
      }
    }

    if (!validCredentials) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // ✅ NEW: Include role in JWT payload
    const tokenPayload = {
      email: validCredentials.email,
      role: userRole, // ← Add role here
      loginTime: Date.now(),
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    const token = generateToken(tokenPayload);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: AUTH_CONFIG.COOKIE_MAX_AGE,
      path: '/'
    };

    res.cookie(AUTH_CONFIG.COOKIE_NAME, token, cookieOptions);

    console.log(`✅ Login successful: ${validCredentials.email} (${userRole})`);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        email: validCredentials.email,
        role: userRole, // ← Return role to frontend
        loginTime: tokenPayload.loginTime
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

app.get('/api/auth/verify', (req, res) => {
  const token = req.cookies?.[AUTH_CONFIG.COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      error: 'No authentication token found'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie(AUTH_CONFIG.COOKIE_NAME);
    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }

  res.json({
    success: true,
    user: {
      email: decoded.email,
      role: decoded.role || 'user', // ← Return role (fallback to 'user')
      loginTime: decoded.loginTime
    }
  });
});

const requireAdmin = (req, res, next) => {
  const token = req.cookies?.[AUTH_CONFIG.COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie(AUTH_CONFIG.COOKIE_NAME);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (decoded.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'You need admin privileges to access this resource'
    });
  }

  req.user = decoded;
  next();
};

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(AUTH_CONFIG.COOKIE_NAME);

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

app.post('/api/proxy-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      console.error('No imageUrl provided in request body');
      return res.status(400).json({
        error: 'Image URL is required',
        success: false
      });
    }

    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      timeout: 30000,
      follow: 10,
      compress: true,
    };

    if (imageUrl.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      fetchOptions.headers['Referer'] = 'https://platform.openai.com/';
      fetchOptions.headers['Origin'] = 'https://platform.openai.com';
    }

    const response = await fetch(imageUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return res.status(500).json({
        error: `Failed to fetch image: ${response.status} ${response.statusText}`,
        message: errorText,
        success: false,
        originalUrl: imageUrl,
      });
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    if (buffer.length === 0) {
      return res.status(500).json({
        error: 'Empty image data received',
        success: false,
        originalUrl: imageUrl,
      });
    }

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.json({
      success: true,
      base64: dataUrl,
      size: buffer.length,
      contentType,
      originalUrl: imageUrl,
    });

  } catch (error) {
    console.error('Proxy image error:', error);

    const errorResponse = {
      error: 'Failed to proxy image',
      message: error.message,
      success: false,
    };

    if (error.code) errorResponse.code = error.code;
    if (error.errno) errorResponse.errno = error.errno;
    if (error.type) errorResponse.type = error.type;

    res.status(500).json(errorResponse);
  }
});

app.get('/api/proxy-image-direct', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*',
        'Cache-Control': 'no-cache',
      },
      timeout: 30000,
      follow: 10,
    };

    if (url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      fetchOptions.headers['Referer'] = 'https://platform.openai.com/';
      fetchOptions.headers['Origin'] = 'https://platform.openai.com';
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });

    res.send(buffer);

  } catch (error) {
    console.error('Direct proxy error:', error.message);
    res.status(500).json({
      error: 'Failed to proxy image',
      message: error.message,
    });
  }
});

app.get('/api/health', (req, res) => {
  try {
    const systemStats = jobManager.getStats();
    const instructionsStats = instructionsManager.getStats();

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      auth_configured: !!authCredentials,
      uptime: process.uptime(),
      job_system: {
        active_jobs: systemStats.jobs.processing + systemStats.jobs.pending,
        api_mode: systemStats.api.mode,
        available_keys: systemStats.api.availableKeys
      },
      instructions_system: {
        total_projects: instructionsStats.total,
        active_projects: instructionsStats.active,
        categories: Object.keys(instructionsStats.byCategory)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});


app.get('/api/instructions/projects', requireAdmin, (req, res) => {
  try {
    const projects = instructionsManager.getAllProjects();

    console.log(`📊 Retrieved ${projects.length} instruction projects`);

    res.json({
      success: true,
      projects: projects,
      total: projects.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get instruction projects:', error);
    res.status(500).json({
      error: 'Failed to get instruction projects',
      message: error.message
    });
  }
});

// ✅ Get projects by category
app.get('/api/instructions/projects/category/:category', requireAuth, (req, res) => {
  try {
    const { category } = req.params;
    const projects = instructionsManager.getProjectsByCategory(category);

    console.log(`📊 Retrieved ${projects.length} projects for category: ${category}`);

    res.json({
      success: true,
      projects: projects,
      category: category,
      total: projects.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get projects by category:', error);
    res.status(500).json({
      error: 'Failed to get projects by category',
      message: error.message
    });
  }
});

// POST /api/instructions/load-by-config - Load content for specific configuration
app.post('/api/instructions/load-by-config', requireAuth, async (req, res) => {
  try {
    const {
      category,
      subcategory = '',
      targetModel = 'universal',
      instructionType = 'user'
    } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log('Loading content for config:', {
      category,
      subcategory,
      targetModel,
      instructionType
    });

    // Generate filename
    const filename = instructionsManager.generateFileName(
      category,
      subcategory,
      instructionType,
      targetModel
    );

    // Check if file exists
    const filePath = path.join(instructionsManager.instructionsDir, filename);
    const fileExists = fs.existsSync(filePath);

    if (fileExists) {
      // Load content from file
      const { promptContent, instructions } = await instructionsManager.loadInstructionContent(filename);
      
      // Get registry info if available
      const registryInfo = instructionsManager.registry[filename];

      console.log(`Loaded: ${filename} (${instructions.length} chars)`);

      return res.json({
        success: true,
        exists: true,
        filename: filename,
        promptContent: promptContent || '',
        instructions: instructions || '',
        project: registryInfo?.project || '',
        status: registryInfo?.status || 'active',
        lastModified: registryInfo?.lastModified
      });
    } else {
      console.log(`File not found: ${filename}`);

      return res.json({
        success: true,
        exists: false,
        filename: filename,
        promptContent: '',
        instructions: '',
        project: '',
        status: 'active'
      });
    }

  } catch (error) {
    console.error('Failed to load content:', error);
    res.status(500).json({
      error: 'Failed to load content',
      message: error.message
    });
  }
});

// ✅ Create or update instruction project
// POST /api/instructions/projects - Save content for specific subcategory
app.post('/api/instructions/projects', requireAdmin, (req, res) => {
  try {
    const {
      name, // Project display name (optional, chỉ dùng để hiển thị)
      promptContent = '',
      instructions,
      category,
      subcategory = '',
      targetModel = 'universal',
      instructionType = 'user',
      status = 'active',
      originalFilename = null // Not used anymore, kept for compatibility
    } = req.body;

    console.log('Saving subcategory content:', {
      category,
      subcategory,
      targetModel,
      instructionType
    });

    // Validate required fields
    if (!instructions || !category || !subcategory) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['instructions', 'category', 'subcategory'],
        received: { 
          instructions: !!instructions, 
          category: !!category, 
          subcategory: !!subcategory 
        }
      });
    }

    // Validate enums
    const validCategories = ['google-ads', 'facebook-ads', 'website-content', 'social', 'instructions'];
    const validModels = ['universal', 'deepseek'];
    const validInstructionTypes = ['user', 'system'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        validCategories,
        received: category
      });
    }

    if (!validModels.includes(targetModel)) {
      return res.status(400).json({
        error: 'Invalid target model',
        validModels,
        received: targetModel
      });
    }

    if (!validInstructionTypes.includes(instructionType)) {
      return res.status(400).json({
        error: 'Invalid instruction type',
        validInstructionTypes,
        received: instructionType
      });
    }

    // Generate filename for this specific subcategory
    const filename = instructionsManager.generateFileName(
      category,
      subcategory,
      instructionType,
      targetModel
    );

    // Save to file (create or update)
    const filePath = path.join(instructionsManager.instructionsDir, filename);
    const combinedContent = instructionsManager.combineFileContent(promptContent, instructions);
    fs.writeFileSync(filePath, combinedContent, 'utf8');

    // Update registry
    const now = new Date().toISOString();
    const fileExists = instructionsManager.registry[filename];

    instructionsManager.registry[filename] = {
      project: name || `${category} - ${subcategory}`,
      category: category,
      subcategory: subcategory,
      instructionType: instructionType,
      targetModel: targetModel,
      status: status,
      createdAt: fileExists ? instructionsManager.registry[filename].createdAt : now,
      lastModified: now
    };

    instructionsManager.saveRegistry();

    console.log(`Saved: ${filename}`);

    res.json({
      success: true,
      message: fileExists ? 'Content updated successfully' : 'Content created successfully',
      filename: filename,
      isUpdate: !!fileExists,
      config: {
        category,
        subcategory,
        targetModel,
        instructionType
      }
    });

  } catch (error) {
    console.error('Failed to save subcategory content:', error);
    res.status(500).json({
      error: 'Failed to save content',
      message: error.message
    });
  }
});

// ✅ NEW: Get filtered subcategories based on user role
app.get('/api/subcategories/filtered', requireAuth, (req, res) => {
  try {
    const user = req.user; // Get from JWT token
    const subcategories = loadSubcategories();
    
    console.log(`🔍 Filtering subcategories for user: ${user.email}`);
    
    // Admin sees all subcategories
    if (user.email === 'misenadminai') {
      console.log('👑 Admin user - returning all subcategories');
      return res.json({
        success: true,
        subcategories: subcategories.filter(sub => sub.status === 'active')
      });
    }
    
    // For non-admin users, filter out subcategories used only by private projects
    const projects = instructionsManager.getAllProjects();
    console.log(`📋 Found ${projects.length} total projects`);
    
    // Build subcategory usage map
    const subcategoryUsage = new Map();
    
    projects.forEach(project => {
      const subcategoryKey = `${project.category}-${project.subcategory}`;
      
      if (!subcategoryUsage.has(subcategoryKey)) {
        subcategoryUsage.set(subcategoryKey, []);
      }
      
      subcategoryUsage.get(subcategoryKey).push(project.status);
    });
    
    console.log('🗺️ Subcategory usage:', Array.from(subcategoryUsage.entries()));
    
    // Filter subcategories
    const filteredSubcategories = subcategories.filter(sub => {
      // Only show active subcategories
      if (sub.status !== 'active') {
        return false;
      }
      
      const subcategoryKey = `${sub.category}-${sub.value}`;
      const usageStatuses = subcategoryUsage.get(subcategoryKey) || [];
      
      console.log(`🔍 Subcategory ${sub.label}: used by projects with statuses [${usageStatuses.join(', ')}]`);
      
      // If not used by any project, show it
      if (usageStatuses.length === 0) {
        return true;
      }
      
      // If used ONLY by private projects, hide it from non-admin
      const uniqueStatuses = [...new Set(usageStatuses)];
      const isUsedOnlyByPrivate = uniqueStatuses.length === 1 && uniqueStatuses[0] === 'private';
      
      if (isUsedOnlyByPrivate) {
        console.log(`   → Hidden: used only by private projects`);
        return false;
      }
      
      console.log(`   → Shown: used by non-private projects`);
      return true;
    });
    
    console.log(`✅ Returning ${filteredSubcategories.length}/${subcategories.length} subcategories`);
    
    res.json({
      success: true,
      subcategories: filteredSubcategories
    });
    
  } catch (error) {
    console.error('Error filtering subcategories:', error);
    res.status(500).json({
      error: 'Failed to filter subcategories',
      message: error.message
    });
  }
});

// ✅ Get specific project by filename
app.get('/api/instructions/projects/:filename', requireAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const project = instructionsManager.getProject(filename);

    if (project) {
      res.json({
        success: true,
        project: project
      });
    } else {
      res.status(404).json({
        error: 'Project not found',
        filename: filename
      });
    }
  } catch (error) {
    console.error('Failed to get project:', error);
    res.status(500).json({
      error: 'Failed to get project',
      message: error.message
    });
  }
});

// ✅ Update project status
app.patch('/api/instructions/projects/:filename/status', requireAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const { status } = req.body;

    console.log(`🔄 Updating project status: ${filename} → ${status}`);

    const validStatuses = ['active', 'inactive', 'private'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses: validStatuses,
        received: status
      });
    }

    const result = instructionsManager.updateProjectStatus(filename, status);

    if (result.success) {
      console.log(`✅ Project status updated: ${filename} → ${status}`);

      res.json({
        success: true,
        message: 'Project status updated successfully',
        filename: filename,
        status: status
      });
    } else {
      res.status(404).json({
        error: 'Project not found',
        filename: filename
      });
    }

  } catch (error) {
    console.error('Failed to update project status:', error);
    res.status(500).json({
      error: 'Failed to update project status',
      message: error.message
    });
  }
});

// ✅ Delete instruction project
app.delete('/api/instructions/projects/:filename', requireAdmin, (req, res) => {
  try {
    const { filename } = req.params;

    console.log(`🗑️ Deleting instruction project: ${filename}`);

    // Check if project exists first
    if (!instructionsManager.projectExists(filename)) {
      return res.status(404).json({
        error: 'Project not found',
        filename: filename
      });
    }

    const result = instructionsManager.deleteProject(filename);

    if (result.success) {
      console.log(`✅ Project deleted successfully: ${filename}`);

      res.json({
        success: true,
        message: 'Project deleted successfully',
        filename: filename
      });
    } else {
      res.status(500).json({
        error: 'Failed to delete project',
        message: result.error
      });
    }

  } catch (error) {
    console.error('Failed to delete instruction project:', error);
    res.status(500).json({
      error: 'Failed to delete instruction project',
      message: error.message
    });
  }
});

// ✅ Get instruction content
// Tìm endpoint này (khoảng line 1200) và REPLACE:
app.get('/api/instructions/content/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;

    console.log(`📖 Getting instruction content: ${filename}`);

    const { promptContent, instructions } = await instructionsManager.loadInstructionContent(filename);

    res.json({
      success: true,
      filename: filename,
      promptContent: promptContent,      // ← NEW
      instructions: instructions,        // ← CHANGED
      content: instructions,             // ← Keep for backward compatibility
      lengths: {
        promptContent: promptContent.length,
        instructions: instructions.length
      }
    });

  } catch (error) {
    console.error('Failed to get instruction content:', error);
    res.status(500).json({
      error: 'Failed to get instruction content',
      message: error.message
    });
  }
});

// ✅ Get instructions statistics
app.get('/api/instructions/stats', requireAuth, (req, res) => {
  try {
    const stats = instructionsManager.getStats();

    console.log('📊 Instructions stats requested:', stats);

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get instructions stats:', error);
    res.status(500).json({
      error: 'Failed to get instructions stats',
      message: error.message
    });
  }
});

// ✅ Preview instruction filename
app.post('/api/instructions/preview-filename', requireAuth, (req, res) => {
  try {
    const {
      category,
      subcategory = '',
      instructionType = 'user',
      targetModel = 'universal'
    } = req.body;

    if (!category) {
      return res.status(400).json({
        error: 'Category is required'
      });
    }

    console.log('🔍 Previewing filename for:', { category, subcategory, instructionType, targetModel });

    const filename = instructionsManager.generateFileName(
      category,
      subcategory,
      instructionType,
      targetModel
    );

    res.json({
      success: true,
      filename: filename,
      parameters: {
        category,
        subcategory,
        instructionType,
        targetModel
      },
      exists: instructionsManager.projectExists(filename)
    });

  } catch (error) {
    console.error('Failed to preview filename:', error);
    res.status(500).json({
      error: 'Failed to preview filename',
      message: error.message
    });
  }
});

// ✅ Backup registry
app.post('/api/instructions/backup', requireAuth, (req, res) => {
  try {
    const result = instructionsManager.backupRegistry();

    if (result.success) {
      console.log(`📦 Registry backed up: ${result.backupPath}`);

      res.json({
        success: true,
        message: 'Registry backed up successfully',
        backupPath: result.backupPath
      });
    } else {
      res.status(500).json({
        error: 'Failed to backup registry',
        message: result.error
      });
    }
  } catch (error) {
    console.error('Failed to backup registry:', error);
    res.status(500).json({
      error: 'Failed to backup registry',
      message: error.message
    });
  }
});

// ✅ Reload registry (for development)
app.post('/api/instructions/reload', requireAuth, (req, res) => {
  try {
    console.log('🔄 Reloading instructions registry...');

    const registry = instructionsManager.reloadRegistry();
    const projectCount = Object.keys(registry).length;

    res.json({
      success: true,
      message: 'Registry reloaded successfully',
      projectCount: projectCount
    });
  } catch (error) {
    console.error('Failed to reload registry:', error);
    res.status(500).json({
      error: 'Failed to reload registry',
      message: error.message
    });
  }
});

const loadSubcategories = () => {
  try {
    if (!fs.existsSync(subcategoriesFilePath)) {
      // Create default subcategories file
      const defaultSubcategories = [
        // Google Ads subcategories
        {
          id: "1",
          value: "shopping-image-generator",
          label: "Shopping Image Generator",
          category: "google-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "2",
          value: "search-visual-generator",
          label: "Search Visual Generator",
          category: "google-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "3",
          value: "display-banner-generator",
          label: "Display Banner Generator",
          category: "google-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        
        {
          id: "4",
          value: "retargeting-image-generator",
          label: "Retargeting Image Generator",
          category: "google-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "5",
          value: "youtube-thumbnail-generator",
          label: "YouTube Thumbnail Generator",
          category: "google-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        // Facebook Ads subcategories
        {
          id: "6",
          value: "carousel-image-generator",
          label: "Carousel Image Generator",
          category: "facebook-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "7",
          value: "story-template-generator",
          label: "Story Template Generator",
          category: "facebook-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "8",
          value: "video-thumbnail-generator",
          label: "Video Thumbnail Generator",
          category: "facebook-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "9",
          value: "lead-form-visual-generator",
          label: "Lead Form Visual Generator",
          category: "facebook-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "10",
          value: "collection-ad-generator",
          label: "Collection Ad Generator",
          category: "facebook-ads",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "11",
          value: "hero-image-generator", 
          label: "Hero Image Generator",
          category: "website-content",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "12",
          value: "advertorial-image-generator",
          label: "Advertorial Image Generator", 
          category: "website-content",
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "13",
          value: "blog-featured-generator",
          label: "Blog Featured Generator",
          category: "website-content", 
          status: "active",
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "14", 
          value: "product-showcase-generator",
          label: "Product Showcase Generator",
          category: "website-content",
          status: "active", 
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          id: "15",
          value: "email-header-generator", 
          label: "Email Header Generator",
          category: "website-content",
          status: "active",
          createdAt: new Date().toISOString(), 
          lastModified: new Date().toISOString(),
        },
      ];

      fs.writeFileSync(subcategoriesFilePath, JSON.stringify(defaultSubcategories, null, 2));
      console.log('📁 Created default subcategories file');
      return defaultSubcategories;
    }

    const data = fs.readFileSync(subcategoriesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading subcategories:', error);
    return [];
  }
};

// ✅ Helper function to save subcategories
const saveSubcategories = (subcategories) => {
  try {
    fs.writeFileSync(subcategoriesFilePath, JSON.stringify(subcategories, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving subcategories:', error);
    return false;
  }
};

// ✅ Generate unique ID for subcategories
const generateSubcategoryId = (subcategories) => {
  const maxId = subcategories.reduce((max, sub) => {
    const numId = parseInt(sub.id);
    return numId > max ? numId : max;
  }, 0);
  return (maxId + 1).toString();
};

// GET /api/subcategories - Get all subcategories
app.get('/api/subcategories', requireAuth, (req, res) => {
  try {
    const subcategories = loadSubcategories();

    // ✅ FIX: Sort by order before returning
    const sorted = subcategories.sort((a, b) => (a.order || 0) - (b.order || 0));

    console.log(`📊 Retrieved ${sorted.length} subcategories (sorted by order)`);

    res.json({
      success: true,
      subcategories: sorted, // ✅ Return sorted
      total: sorted.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get subcategories:', error);
    res.status(500).json({
      error: 'Failed to get subcategories',
      message: error.message
    });
  }
});

// ✅ GET /api/subcategories/category/:category - Get subcategories by category
app.get('/api/subcategories/category/:category', requireAuth, (req, res) => {
  try {
    const { category } = req.params;
    const { status } = req.query; // Optional filter by status

    const allSubcategories = loadSubcategories();
    let filtered = allSubcategories.filter(sub => sub.category === category);

    // Filter by status if provided
    if (status) {
      filtered = filtered.filter(sub => sub.status === status);
    }

    console.log(`📊 Retrieved ${filtered.length} subcategories for category: ${category}`);

    res.json({
      success: true,
      subcategories: filtered,
      category: category,
      total: filtered.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get subcategories by category:', error);
    res.status(500).json({
      error: 'Failed to get subcategories by category',
      message: error.message
    });
  }
});

// ✅ POST /api/subcategories - Create or update subcategory
// POST /api/subcategories - Create or update subcategory
app.post('/api/subcategories', requireAdmin, (req, res) => {
  try {
    const {
      id, // For updates
      value,
      label,
      category,
      status = 'active'
    } = req.body;

    console.log(`🔧 ${id ? 'Updating' : 'Creating'} subcategory:`, {
      id,
      value,
      label,
      category,
      status
    });

    // Validate required fields
    if (!value || !label || !category) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['value', 'label', 'category'],
        received: { value: !!value, label: !!label, category: !!category }
      });
    }

    // Validate category
    const validCategories = ['google-ads', 'facebook-ads', 'website-content', 'social', 'instructions'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        validCategories: validCategories,
        received: category
      });
    }

    // Validate status
    const validStatuses = ['active', 'inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses: validStatuses,
        received: status
      });
    }

    // Validate value format
    const valuePattern = /^[a-z0-9-]+$/;
    if (!valuePattern.test(value)) {
      return res.status(400).json({
        error: 'Invalid value format',
        message: 'Value must contain only lowercase letters, numbers, and hyphens',
        received: value
      });
    }

    const subcategories = loadSubcategories();

    // Check for conflicts (duplicate value within same category)
    const existingIndex = subcategories.findIndex(sub =>
      sub.value === value &&
      sub.category === category &&
      sub.id !== id // Exclude current item for updates
    );

    if (existingIndex !== -1) {
      return res.status(409).json({
        error: 'Duplicate subcategory',
        message: `A subcategory with value "${value}" already exists in ${category}`,
        conflicting: subcategories[existingIndex]
      });
    }

    const now = new Date().toISOString();

    if (id) {
      // ✅ UPDATE existing subcategory
      const updateIndex = subcategories.findIndex(sub => sub.id === id);

      if (updateIndex === -1) {
        return res.status(404).json({
          error: 'Subcategory not found',
          id: id
        });
      }

      subcategories[updateIndex] = {
        ...subcategories[updateIndex], // Keep existing fields including order
        value,
        label,
        category,
        status,
        lastModified: now
      };

      console.log(`✅ Updated subcategory: ${id}`);
    } else {
      // ✅ CREATE new subcategory
      const newId = generateSubcategoryId(subcategories);

      // ✅ FIX: Calculate next order for this category
      const categorySubcategories = subcategories.filter(
        sub => sub.category === category
      );
      const maxOrder = categorySubcategories.length > 0
        ? Math.max(...categorySubcategories.map(sub => sub.order || 0))
        : -1;
      const nextOrder = maxOrder + 1;

      const newSubcategory = {
        id: newId,
        value,
        label,
        category,
        status,
        order: nextOrder, // ✅ FIX: Add order field
        createdAt: now,
        lastModified: now
      };

      subcategories.push(newSubcategory);
      console.log(`✅ Created subcategory: ${newId} with order: ${nextOrder}`);
    }

    // Save to file
    if (saveSubcategories(subcategories)) {
      res.json({
        success: true,
        message: id ? 'Subcategory updated successfully' : 'Subcategory created successfully',
        subcategory: {
          value,
          label,
          category,
          status
        }
      });
    } else {
      res.status(500).json({
        error: 'Failed to save subcategory',
        message: 'Could not write to subcategories file'
      });
    }

  } catch (error) {
    console.error('Failed to create/update subcategory:', error);
    res.status(500).json({
      error: 'Failed to create/update subcategory',
      message: error.message
    });
  }
});
// ✅ GET /api/subcategories/:id - Get specific subcategory
app.get('/api/subcategories/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const subcategories = loadSubcategories();

    const subcategory = subcategories.find(sub => sub.id === id);

    if (subcategory) {
      res.json({
        success: true,
        subcategory: subcategory
      });
    } else {
      res.status(404).json({
        error: 'Subcategory not found',
        id: id
      });
    }
  } catch (error) {
    console.error('Failed to get subcategory:', error);
    res.status(500).json({
      error: 'Failed to get subcategory',
      message: error.message
    });
  }
});

// ✅ PATCH /api/subcategories/:id/status - Update subcategory status
app.patch('/api/subcategories/:id/status', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log(`🔄 Updating subcategory status: ${id} → ${status}`);

    const validStatuses = ['active', 'inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses: validStatuses,
        received: status
      });
    }

    const subcategories = loadSubcategories();
    const updateIndex = subcategories.findIndex(sub => sub.id === id);

    if (updateIndex === -1) {
      return res.status(404).json({
        error: 'Subcategory not found',
        id: id
      });
    }

    subcategories[updateIndex].status = status;
    subcategories[updateIndex].lastModified = new Date().toISOString();

    if (saveSubcategories(subcategories)) {
      console.log(`✅ Subcategory status updated: ${id} → ${status}`);

      res.json({
        success: true,
        message: 'Subcategory status updated successfully',
        id: id,
        status: status
      });
    } else {
      res.status(500).json({
        error: 'Failed to save subcategory status update'
      });
    }

  } catch (error) {
    console.error('Failed to update subcategory status:', error);
    res.status(500).json({
      error: 'Failed to update subcategory status',
      message: error.message
    });
  }
});

// DELETE /api/subcategories/:id - Delete subcategory
app.delete('/api/subcategories/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting subcategory: ${id}`);

    const subcategories = loadSubcategories();
    const deleteIndex = subcategories.findIndex(sub => sub.id === id);

    if (deleteIndex === -1) {
      return res.status(404).json({
        error: 'Subcategory not found',
        id: id
      });
    }

    const subcategoryToDelete = subcategories[deleteIndex];

    // Find and delete all related projects
    const projects = instructionsManager.getAllProjects();
    const relatedProjects = projects.filter(
      project => 
        project.category === subcategoryToDelete.category && 
        project.subcategory === subcategoryToDelete.value
    );

    console.log(`📋 Found ${relatedProjects.length} related projects to delete`);

    // Delete all related project files
    let deletedFiles = 0;
    relatedProjects.forEach(project => {
      const result = instructionsManager.deleteProject(project.filename);
      if (result.success) {
        deletedFiles++;
        console.log(`  ✅ Deleted file: ${project.filename}`);
      } else {
        console.log(`  ❌ Failed to delete: ${project.filename}`);
      }
    });

    // Remove subcategory from array
    const deletedSubcategory = subcategories.splice(deleteIndex, 1)[0];

    // ✅ NO RE-INDEX: Keep existing orders as-is
    // This is simpler and works fine with sorting

    if (saveSubcategories(subcategories)) {
      console.log(`✅ Subcategory deleted: ${id}`);
      console.log(`✅ Deleted ${deletedFiles} related files`);

      res.json({
        success: true,
        message: `Subcategory deleted successfully. ${deletedFiles} related file(s) also deleted.`,
        deletedSubcategory: deletedSubcategory,
        deletedFilesCount: deletedFiles,
        deletedFiles: relatedProjects.map(p => p.filename)
      });
    } else {
      res.status(500).json({
        error: 'Failed to save after subcategory deletion'
      });
    }

  } catch (error) {
    console.error('Failed to delete subcategory:', error);
    res.status(500).json({
      error: 'Failed to delete subcategory',
      message: error.message
    });
  }
});

// ✅ GET /api/subcategories/stats - Get subcategories statistics
app.get('/api/subcategories/stats', requireAuth, (req, res) => {
  try {
    const subcategories = loadSubcategories();

    const stats = {
      total: subcategories.length,
      active: subcategories.filter(sub => sub.status === 'active').length,
      inactive: subcategories.filter(sub => sub.status === 'inactive').length,
      byCategory: subcategories.reduce((acc, sub) => {
        acc[sub.category] = (acc[sub.category] || 0) + 1;
        return acc;
      }, {}),
      byStatus: subcategories.reduce((acc, sub) => {
        acc[sub.status] = (acc[sub.status] || 0) + 1;
        return acc;
      }, {})
    };

    console.log('📊 Subcategories stats requested:', stats);

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get subcategories stats:', error);
    res.status(500).json({
      error: 'Failed to get subcategories stats',
      message: error.message
    });
  }
});

// ✅ GET /api/instructions/all-files - Get all instruction files with content
app.get('/api/instructions/all-files', async (req, res) => {
  try {
    const instructionsDir = path.join(__dirname, 'static', 'instructions');
    
    // Check if directory exists
    if (!fs.existsSync(instructionsDir)) {
      return res.json({ success: true, files: [] });
    }

    // Read all .txt files
    const allFiles = fs.readdirSync(instructionsDir)
      .filter(filename => filename.endsWith('.txt'));

    // Read content of each file
    const filesWithContent = allFiles.map(filename => {
      const filePath = path.join(instructionsDir, filename);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Parse content if it has prompt content section
      const parsed = instructionsManager.parseFileContent(content);
      
      return {
        filename,
        promptContent: parsed.promptContent,
        instructions: parsed.instructions,
        fullContent: content,
        size: content.length,
        lastModified: fs.statSync(filePath).mtime
      };
    });

    console.log(`📦 Returned ${filesWithContent.length} instruction files with content`);

    res.json({
      success: true,
      total: filesWithContent.length,
      files: filesWithContent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error reading instruction files:', error);
    res.status(500).json({
      error: 'Failed to read instruction files',
      message: error.message
    });
  }
});

// ✅ POST /api/subcategories/import - Import subcategories from JSON
app.post('/api/subcategories/import', requireAuth, (req, res) => {
  try {
    const { subcategories: importData, overwrite = false } = req.body;

    if (!Array.isArray(importData)) {
      return res.status(400).json({
        error: 'Invalid import data',
        message: 'Expected an array of subcategories'
      });
    }

    const existingSubcategories = loadSubcategories();
    let imported = 0;
    let skipped = 0;
    let errors = [];

    const validCategories = ['google-ads', 'facebook-ads', 'website-content','social',  'instructions'];
    const validStatuses = ['active', 'inactive'];

    for (const item of importData) {
      // Validate required fields
      if (!item.value || !item.label || !item.category) {
        errors.push(`Skipped item: missing required fields (value, label, category)`);
        skipped++;
        continue;
      }

      // Validate category and status
      if (!validCategories.includes(item.category)) {
        errors.push(`Skipped "${item.value}": invalid category "${item.category}"`);
        skipped++;
        continue;
      }

      if (item.status && !validStatuses.includes(item.status)) {
        errors.push(`Skipped "${item.value}": invalid status "${item.status}"`);
        skipped++;
        continue;
      }

      // Check for existing
      const existingIndex = existingSubcategories.findIndex(sub =>
        sub.value === item.value && sub.category === item.category
      );

      if (existingIndex !== -1 && !overwrite) {
        errors.push(`Skipped "${item.value}": already exists in ${item.category}`);
        skipped++;
        continue;
      }

      const now = new Date().toISOString();

      if (existingIndex !== -1 && overwrite) {
        // Update existing
        existingSubcategories[existingIndex] = {
          ...existingSubcategories[existingIndex],
          label: item.label,
          status: item.status || 'active',
          lastModified: now
        };
      } else {
        // Add new
        const newId = generateSubcategoryId(existingSubcategories);
        existingSubcategories.push({
          id: newId,
          value: item.value,
          label: item.label,
          category: item.category,
          status: item.status || 'active',
          createdAt: now,
          lastModified: now
        });
      }

      imported++;
    }

    if (saveSubcategories(existingSubcategories)) {
      res.json({
        success: true,
        message: `Import completed: ${imported} imported, ${skipped} skipped`,
        summary: {
          imported,
          skipped,
          total: importData.length
        },
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(500).json({
        error: 'Failed to save imported subcategories'
      });
    }

  } catch (error) {
    console.error('Failed to import subcategories:', error);
    res.status(500).json({
      error: 'Failed to import subcategories',
      message: error.message
    });
  }
});

// ✅ GET /api/subcategories/export - Export subcategories as JSON
app.get('/api/subcategories/export', requireAuth, (req, res) => {
  try {
    const { category, status } = req.query;

    let subcategories = loadSubcategories();

    // Apply filters if provided
    if (category) {
      subcategories = subcategories.filter(sub => sub.category === category);
    }

    if (status) {
      subcategories = subcategories.filter(sub => sub.status === status);
    }

    // Remove internal IDs for clean export
    const exportData = subcategories.map(sub => ({
      value: sub.value,
      label: sub.label,
      category: sub.category,
      status: sub.status,
      createdAt: sub.createdAt,
      lastModified: sub.lastModified
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="subcategories-export-${Date.now()}.json"`);

    res.json({
      exportedAt: new Date().toISOString(),
      totalCount: exportData.length,
      filters: { category, status },
      subcategories: exportData
    });

  } catch (error) {
    console.error('Failed to export subcategories:', error);
    res.status(500).json({
      error: 'Failed to export subcategories',
      message: error.message
    });
  }
});

// GET available instructions for dropdown
app.get('/api/instructions/available', requireAuth, (req, res) => {
  try {
    const instructionsDir = path.join(__dirname, 'static', 'instructions');
    
    if (!fs.existsSync(instructionsDir)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(instructionsDir)
      .filter(file => file.endsWith('.txt') && !file.includes('registry'))
      .map(file => ({
        filename: file,
        name: file.replace('.txt', '').replace(/_/g, ' ')
      }));

    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/instructions/preview', requireAuth, async (req, res) => {
  try {
    const {
      category,
      subcategory = '',
      targetModel = 'universal',
      instructionType = 'user'
    } = req.body;

    if (!category) {
      return res.status(400).json({
        error: 'Category is required'
      });
    }

    console.log('🔍 Previewing instruction content for:', {
      category,
      subcategory,
      targetModel,
      instructionType
    });

    // Generate filename
    const filename = instructionsManager.generateFileName(
      category,
      subcategory,
      instructionType,
      targetModel
    );

    // Check if file exists
    const fileExists = instructionsManager.projectExists(filename);

    if (fileExists) {
      // Load content
      const { promptContent, instructions } = await instructionsManager.loadInstructionContent(filename);
      
      console.log(`✅ Found existing file: ${filename}`);
      
      return res.json({
        success: true,
        exists: true,
        filename: filename,
        promptContent: promptContent || '',
        instructions: instructions || '',
        project: instructionsManager.getProject(filename)
      });
    } else {
      console.log(`📝 No existing file found: ${filename}`);
      
      return res.json({
        success: true,
        exists: false,
        filename: filename,
        promptContent: '',
        instructions: ''
      });
    }

  } catch (error) {
    console.error('Failed to preview instruction content:', error);
    res.status(500).json({
      error: 'Failed to preview instruction content',
      message: error.message
    });
  }
});

// GET all projects (simplified - just parent categories)
app.get('/api/instructions/projects', requireAuth, (req, res) => {
  try {
    const projects = instructionsManager.getAllProjects();
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create project (just create parent category entry)
app.post('/api/instructions/projects', requireAdmin, (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const project = instructionsManager.getOrCreateProject(category);
    
    res.json({
      success: true,
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST save subcategory content
app.post('/api/instructions/subcategory-content', requireAuth, async (req, res) => {
  try {
    const {
      category,
      subcategory,
      instructionType,
      targetModel,
      promptContent,
      instructions
    } = req.body;

    if (!category || !subcategory || !instructionType || !targetModel) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['category', 'subcategory', 'instructionType', 'targetModel']
      });
    }

    const result = instructionsManager.saveSubcategoryContent(
      category,
      subcategory,
      instructionType,
      targetModel,
      promptContent || '',
      instructions || ''
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Content saved successfully',
        filename: result.filename
      });
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET load subcategory content
app.post('/api/instructions/subcategory-content/load', requireAuth, async (req, res) => {
  try {
    const { category, subcategory, instructionType, targetModel } = req.body;

    if (!category || !subcategory || !instructionType || !targetModel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const content = await instructionsManager.loadSubcategoryContent(
      category,
      subcategory,
      instructionType,
      targetModel
    );

    res.json({
      success: true,
      ...content
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET instruction content by filename
app.get('/api/instructions/content/:filename', requireAuth, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'static', 'instructions', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/instructions/resolve - Resolve instruction content với đọc tất cả files
app.post('/api/instructions/resolve', requireAuth, (req, res) => {
  try {
    const { category, subcategory = '', selectedModel = 'claude-sonnet' } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const instructionsDir = path.join(__dirname, 'static', 'instructions');
    
    // Normalize category
    const categoryMap = {
      'google_prompt': 'google_ads',
      'facebook_prompt': 'facebook_ads',
      'website_prompt': 'website_content'
    };
    const normalizedCategory = categoryMap[category] || category.replace(/-/g, '_');
    
    // Normalize subcategory
    const normalizedSubcategory = subcategory 
      ? subcategory.replace(/-/g, '_').toLowerCase() 
      : '';

    // Determine target model
    const targetModel = selectedModel === 'deepsearch' ? 'deepseek' : 'universal';

    console.log('🔍 Resolving instructions:', { 
      category: normalizedCategory, 
      subcategory: normalizedSubcategory,
      targetModel 
    });

    // Build ALL filenames to try
    const userPromptFiles = [];
    const systemPromptFiles = [];

    if (normalizedSubcategory) {
      userPromptFiles.push(
        `user_prompt_${targetModel}_${normalizedCategory}_${normalizedSubcategory}.txt`,
        `user_prompt_universal_${normalizedCategory}_${normalizedSubcategory}.txt`
      );
      systemPromptFiles.push(
        `system_prompt_${targetModel}_${normalizedCategory}_${normalizedSubcategory}.txt`,
        `system_prompt_universal_${normalizedCategory}_${normalizedSubcategory}.txt`
      );
    }
    
    userPromptFiles.push(
      `user_prompt_${targetModel}_${normalizedCategory}.txt`,
      `user_prompt_universal_${normalizedCategory}.txt`
    );
    systemPromptFiles.push(
      `system_prompt_${targetModel}_${normalizedCategory}.txt`,
      `system_prompt_universal_${normalizedCategory}.txt`
    );

    console.log('📋 User prompt files to try:', userPromptFiles);
    console.log('📋 System prompt files to try:', systemPromptFiles);

    // ✅ KHAI BÁO BIẾN Ở ĐÂY
    let userPromptContent = null;
    let userPromptFilename = null;
    let systemPromptContent = null;
    let systemPromptFilename = null;

    // Try to find user_prompt
    for (const filename of userPromptFiles) {
      const filePath = path.join(instructionsDir, filename);
      
      if (fs.existsSync(filePath)) {
        userPromptContent = fs.readFileSync(filePath, 'utf8'); // ✅ LẤY TOÀN BỘ
        userPromptFilename = filename;
        console.log(`✅ Found user_prompt: ${filename}`);
        break;
      }
    }

    // Try to find system_prompt
    for (const filename of systemPromptFiles) {
      const filePath = path.join(instructionsDir, filename);
      
      if (fs.existsSync(filePath)) {
        systemPromptContent = fs.readFileSync(filePath, 'utf8'); // ✅ LẤY TOÀN BỘ
        systemPromptFilename = filename;
        console.log(`✅ Found system_prompt: ${filename}`);
        break;
      }
    }

    // Log final result
    console.log('📦 Final result:', {
      hasUserPrompt: !!userPromptContent,
      hasSystemPrompt: !!systemPromptContent,
      userPromptFile: userPromptFilename,
      systemPromptFile: systemPromptFilename
    });

    return res.json({
      success: true,
      user_prompt: userPromptContent,
      system_prompt: systemPromptContent,
      files: {
        user_prompt: userPromptFilename,
        system_prompt: systemPromptFilename
      },
      matched: {
        category: normalizedCategory,
        subcategory: normalizedSubcategory,
        targetModel: targetModel
      }
    });

  } catch (error) {
    console.error('❌ Error resolving instructions:', error);
    res.status(500).json({ 
      error: 'Failed to resolve instructions',
      message: error.message 
    });
  }
});

app.post('/api/subcategories/reorder', requireAuth, (req, res) => {
  try {
    const { subcategories: reorderedItems } = req.body;

    if (!Array.isArray(reorderedItems)) {
      return res.status(400).json({
        error: 'Invalid data format',
        message: 'Expected an array of subcategories'
      });
    }

    const subcategories = loadSubcategories();

    // Update order
    reorderedItems.forEach(item => {
      const index = subcategories.findIndex(sub => sub.id === item.id);
      if (index !== -1) {
        subcategories[index].order = item.order;
        subcategories[index].lastModified = new Date().toISOString();
      }
    });

    if (saveSubcategories(subcategories)) {
      res.json({
        success: true,
        message: 'Order saved successfully'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`🔄 Polling-based image generation system active`);

  const initialJobStats = jobManager.getStats();
  const initialInstructionsStats = instructionsManager.getStats();

  console.log(`🤖 API Mode: ${initialJobStats.api.mode}`);
  console.log(`🔑 Available Keys: ${initialJobStats.api.availableKeys}/${initialJobStats.api.totalKeys}`);
  console.log(`📚 Instructions Projects: ${initialInstructionsStats.total} (${initialInstructionsStats.active} active)`);

  console.log(`📡 API Endpoints:`);
  console.log(`   Image Generation:`);
  console.log(`     POST /api/image-generation/submit`);
  console.log(`     GET  /api/image-generation/status/:jobId`);
  console.log(`     GET  /api/image-generation/results/:jobId`);
  console.log(`   Instructions Management:`);
  console.log(`     GET  /api/instructions/projects`);
  console.log(`     POST /api/instructions/projects`);
  console.log(`     DELETE /api/instructions/projects/:filename`);
  console.log(`     GET  /api/instructions/stats`);
  console.log(`   System:`);
  console.log(`     GET  /api/system/stats`);
  console.log(`     GET  /api/health`);
});
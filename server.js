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

// Load environment variables FIRST
dotenv.config();

// Now import and create JobManager AFTER env vars are loaded
import { createJobManager } from './JobManager.js';

console.log('🔍 Environment variables loaded:');
console.log('OPENAI_API_KEY_1:', process.env.OPENAI_API_KEY_1 ? 'SET' : 'NOT SET');
console.log('OPENAI_API_KEY_2:', process.env.OPENAI_API_KEY_2 ? 'SET' : 'NOT SET');
console.log('CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? 'SET' : 'NOT SET');

// Create JobManager instance after environment variables are loaded
const jobManager = createJobManager();

const app = express();
const port = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      selectedCategory
    } = req.body;

    if (!sessionId || !userPrompt || !numberOfImages) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, userPrompt, numberOfImages'
      });
    }

    const jobId = await jobManager.createJob(
      sessionId,
      userPrompt,
      numberOfImages,
      imageSizesString || 'auto',
      selectedQuality,
      selectedCategory || { category: 'google_prompt', subcategory: '' }
    );

    res.json({
      success: true,
      jobId: jobId,
      totalImages: numberOfImages,
      estimatedTime: numberOfImages * 15,
      message: 'Job submitted successfully'
    });

  } catch (error) {
    console.error('Job submission failed:', error);
    res.status(500).json({
      error: 'Failed to submit job',
      message: error.message
    });
  }
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
      originalPrompt: job.userPrompt,
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

    const isEmailValid = email.toLowerCase().trim() === authCredentials.email.toLowerCase().trim();
    const isPasswordValid = verifyPassword(password, authCredentials.hashedPassword, authCredentials.salt);

    if (!isEmailValid || !isPasswordValid) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const tokenPayload = {
      email: authCredentials.email,
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

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        email: authCredentials.email,
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
      loginTime: decoded.loginTime
    }
  });
});

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
  const systemStats = jobManager.getStats();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    auth_configured: !!authCredentials,
    uptime: process.uptime(),
    job_system: {
      active_jobs: systemStats.jobs.processing + systemStats.jobs.pending,
      api_mode: systemStats.api.mode,
      available_keys: systemStats.api.availableKeys
    }
  });
});

app.get('/*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`🔄 Polling-based image generation system active`);
  
  const initialStats = jobManager.getStats();
  console.log(`🤖 API Mode: ${initialStats.api.mode}`);
  console.log(`🔑 Available Keys: ${initialStats.api.availableKeys}/${initialStats.api.totalKeys}`);
  
  console.log(`📡 Polling Endpoints:`);
  console.log(`   POST /api/image-generation/submit`);
  console.log(`   GET  /api/image-generation/status/:jobId`);
  console.log(`   POST /api/image-generation/cancel/:jobId`);
  console.log(`   GET  /api/image-generation/results/:jobId`);
  console.log(`   GET  /api/system/stats`);
});
// ===== SERVER SIDE UPDATES (server.js) =====

import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  JWT_EXPIRES_IN: '7d', // 7 days
  COOKIE_NAME: 'ai_image_auth',
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// Password hashing utilities
const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
};

const verifyPassword = (inputPassword, storedHash, salt) => {
  const inputHash = hashPassword(inputPassword, salt);
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(inputHash, 'hex'));
};

// Generate a random salt for password hashing
const generateSalt = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create hashed credentials on first run (you can remove this after setup)
const createHashedCredentials = () => {
  const plainPassword = process.env.LOGIN_PASSWORD;
  if (!plainPassword) {
    console.log('⚠️ LOGIN_PASSWORD not set in .env file');
    return null;
  }

  const salt = generateSalt();
  const hashedPassword = hashPassword(plainPassword, salt);

  console.log('🔐 Generated credentials:');
  console.log('Salt:', salt);
  console.log('Hash:', hashedPassword);
  console.log('Add these to your .env file:');
  console.log(`LOGIN_PASSWORD_SALT=${salt}`);
  console.log(`LOGIN_PASSWORD_HASH=${hashedPassword}`);

  return { salt, hashedPassword };
};

// Initialize auth credentials
let authCredentials = null;
if (process.env.LOGIN_PASSWORD_HASH && process.env.LOGIN_PASSWORD_SALT) {
  authCredentials = {
    salt: process.env.LOGIN_PASSWORD_SALT,
    hashedPassword: process.env.LOGIN_PASSWORD_HASH,
    email: process.env.LOGIN_EMAIL || 'admin@aiimage.com'
  };
  console.log('✅ Authentication credentials loaded');
} else if (process.env.LOGIN_PASSWORD) {
  console.log('🔄 First time setup - generating hashed credentials...');
  const generated = createHashedCredentials();
  if (generated) {
    authCredentials = {
      salt: generated.salt,
      hashedPassword: generated.hashedPassword,
      email: process.env.LOGIN_EMAIL || 'admin@aiimage.com'
    };
  }
} else {
  console.log('⚠️ No authentication credentials configured');
}

// JWT utilities
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

// Middleware to check authentication
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

// Add cookie parser middleware (add this after other middleware)
app.use((req, res, next) => {
  // Simple cookie parser
  req.cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      req.cookies[name] = decodeURIComponent(value || '');
    });
  }
  next();
});

// Load and cache instructions
let cachedInstructions = null;
let instructionsHash = null;

const loadInstructions = () => {
  try {
    if (!cachedInstructions) {
      const instructionsPath = path.join(process.cwd(), 'static', 'instructions.txt');
      cachedInstructions = fs.readFileSync(instructionsPath, 'utf8');
      instructionsHash = Buffer.from(cachedInstructions).toString('base64').slice(0, 16);
      console.log('📋 Instructions loaded and cached');
      console.log('📏 Instructions length:', cachedInstructions.length, 'characters');
    }
    return cachedInstructions;
  } catch (error) {
    console.error('❌ Error loading instructions:', error);
    throw new Error('Failed to load instructions');
  }
};

// Original Claude endpoint (keep for backward compatibility)
app.post('/api/claude', async (req, res) => {
  console.log('Received request for Claude API (non-cached)');

  try {
    console.log('Using API key:', process.env.CLAUDE_API_KEY ? 'API key is set' : 'API key is missing');

    const response = await axios.post('https://api.anthropic.com/v1/messages', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    console.log('Claude API response status:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Claude API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// New cached Claude endpoint
app.post('/api/claude-cached', async (req, res) => {
  console.log('Received request for Claude API with caching');

  try {
    const { model, max_tokens, user_prompt, enable_caching = true } = req.body;

    if (!process.env.CLAUDE_API_KEY) {
      throw new Error('Claude API key not configured');
    }

    const instructions = loadInstructions();

    const requestBody = {
      model: model || "claude-sonnet-4-20250514",
      max_tokens: max_tokens || 8000,
      messages: [
        {
          role: "user",
          content: user_prompt
        }
      ]
    };

    // Add caching for system instructions if enabled and instructions are long enough
    if (enable_caching && instructions.length > 1024) {
      requestBody.system = [
        {
          type: "text",
          text: instructions,
          cache_control: {
            type: "ephemeral",
            ttl: "1h"
          }
        }
      ];
      console.log('📋 Using cached system instructions');
    } else {
      requestBody.system = instructions;
      console.log('📋 Using non-cached system instructions');
    }

    console.log('🚀 Making cached API call to Claude...');
    console.log('📏 System prompt length:', instructions.length, 'chars');
    console.log('📏 User prompt length:', user_prompt.length, 'chars');

    const response = await axios.post('https://api.anthropic.com/v1/messages', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'extended-cache-ttl-2025-04-11'
      }
    });

    console.log('✅ Claude API response status:', response.status);

    // Log caching information
    const usage = response.data.usage;
    if (usage) {
      console.log('📊 Token usage:', {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: usage.cache_read_input_tokens || 0
      });

      if (usage.cache_creation_input_tokens) {
        console.log('🆕 Cache created:', usage.cache_creation_input_tokens, 'tokens');
      }
      if (usage.cache_read_input_tokens) {
        console.log('💰 Cache hit! Saved:', usage.cache_read_input_tokens, 'tokens');
      }
    }

    res.json(response.data);
  } catch (error) {
    console.error('❌ Claude Cached API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Endpoint to get caching statistics
app.get('/api/cache-stats', (req, res) => {
  res.json({
    instructions_loaded: !!cachedInstructions,
    instructions_length: cachedInstructions?.length || 0,
    instructions_hash: instructionsHash,
    caching_enabled: true,
    min_cache_size: 1024
  });
});

// Endpoint to refresh instructions cache
app.post('/api/refresh-cache', (req, res) => {
  try {
    cachedInstructions = null;
    instructionsHash = null;
    const instructions = loadInstructions();

    res.json({
      success: true,
      message: 'Instructions cache refreshed',
      length: instructions.length,
      hash: instructionsHash
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Image proxy endpoints (keep existing)
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

    console.log('Proxying image:', imageUrl.substring(0, 100) + '...');

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
      console.log('Detected OpenAI URL, using special headers');
    }

    const response = await fetch(imageUrl, fetchOptions);

    console.log(`Fetch response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);

      return res.status(500).json({
        error: `Failed to fetch image: ${response.status} ${response.statusText}`,
        message: errorText,
        success: false,
        originalUrl: imageUrl,
      });
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    console.log(`Buffer created, size: ${buffer.length} bytes, type: ${contentType}`);

    if (buffer.length === 0) {
      console.error('Empty buffer received');
      return res.status(500).json({
        error: 'Empty image data received',
        success: false,
        originalUrl: imageUrl,
      });
    }

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`Successfully converted image to base64, size: ${Math.round(base64.length / 1024)}KB`);

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

// ChatGPT endpoint (keep existing)
app.post('/api/chatgpt', async (req, res) => {
  console.log('Received request for ChatGPT API');

  try {
    console.log('Using OpenAI API key:', process.env.OPENAI_API_KEY ? 'API key is set' : 'API key is missing');

    const sizeMapping = {
      'Square': '1024x1024',
      'Portrait': '1024x1536', 
      'Landscape': '1536x1024',
      'auto': 'auto'
    };

    const qualityMapping = {
      'High': 'high',
      'Medium': 'medium', 
      'Low': 'low'
    };

    const requestedSize = req.body.selectedSize || req.body.size || 'auto';
    const requestedQuality = req.body.quality || 'Low';
    const openaiSize = sizeMapping[requestedSize] || 'auto';
    const openaiQuality = qualityMapping[requestedQuality] || 'low';

    console.log(`Size mapping: ${requestedSize} → ${openaiSize}`);
    console.log(`Quality mapping: ${requestedQuality} → ${openaiQuality}`);

    // ✅ Correct parameters for gpt-image-1
    const requestBody = {
      model: "gpt-image-1", // ✅ Correct model name
      prompt: req.body.prompt,
      n: 1,
      size: openaiSize,
      quality: openaiQuality, // ✅ Correct quality values: high, medium, low
      output_format: "png", // ✅ gpt-image-1 specific parameter
      background: "auto", // ✅ gpt-image-1 specific parameter
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await openai.images.generate(requestBody);

    console.log('OpenAI API response status: SUCCESS');
    console.log('Response keys:', Object.keys(response.data[0] || {}));
    
    // ✅ gpt-image-1 returns b64_json directly, not url
    const imageData = response.data[0];
    const base64Data = imageData?.b64_json;
    
    console.log('Base64 data available:', !!base64Data);
    console.log('Base64 data length:', base64Data?.length || 0);

    if (!base64Data) {
      console.error('No base64 data in response. Full response:', response.data);
      return res.status(500).json({
        error: 'No image data returned from OpenAI',
        debug: response.data
      });
    }

    // ✅ Convert base64 to data URL
    const dataUrl = `data:image/png;base64,${base64Data}`;
    
    console.log(`✅ Successfully generated image with gpt-image-1`);
    console.log(`📏 Base64 size: ${Math.round(base64Data.length / 1024)}KB`);

    // Return in the expected format
    res.json({
      data: [{
        url: dataUrl, // ✅ Return as data URL for compatibility
        b64_json: base64Data,
        converted: true,
        size: base64Data.length,
        contentType: 'image/png',
      }],
      original: response.data,
      usage: response.usage // ✅ gpt-image-1 includes usage info
    });

  } catch (error) {
    console.error('OpenAI Error Details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      response: error.response?.data,
      stack: error.stack
    });

    // More detailed error response
    res.status(error.status || 500).json({
      error: error.message || 'OpenAI API Error',
      details: error.response?.data || null,
      status: error.status || 500,
      code: error.code || null,
      type: error.type || null
    });
  }
});

// Direct image proxy (keep existing)
app.get('/api/proxy-image-direct', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('Direct proxying image:', url.substring(0, 100) + '...');

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

// Initialize instructions on startup
loadInstructions();

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for email:', email);

    // Check if auth is configured
    if (!authCredentials) {
      console.error('❌ Authentication not configured');
      return res.status(500).json({
        error: 'Authentication not configured on server'
      });
    }

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Check email (case insensitive)
    const isEmailValid = email.toLowerCase().trim() === authCredentials.email.toLowerCase().trim();

    // Verify password using timing-safe comparison
    const isPasswordValid = verifyPassword(password, authCredentials.hashedPassword, authCredentials.salt);

    if (!isEmailValid || !isPasswordValid) {
      console.log('❌ Invalid credentials for:', email);
      // Add delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      email: authCredentials.email,
      loginTime: Date.now(),
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    const token = generateToken(tokenPayload);

    // Set secure HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,    // Prevent XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: AUTH_CONFIG.COOKIE_MAX_AGE,
      path: '/'
    };

    // Set cookie
    res.cookie(AUTH_CONFIG.COOKIE_NAME, token, cookieOptions);

    console.log('✅ Login successful for:', email);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        email: authCredentials.email,
        loginTime: tokenPayload.loginTime
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Verify authentication endpoint
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

  console.log('✅ Authentication verified for:', decoded.email);

  res.json({
    success: true,
    user: {
      email: decoded.email,
      loginTime: decoded.loginTime
    }
  });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(AUTH_CONFIG.COOKIE_NAME);
  console.log('🔓 User logged out');

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Protect existing API endpoints (add this BEFORE existing endpoints)
app.use('/api/claude', requireAuth);
app.use('/api/claude-cached', requireAuth);
app.use('/api/chatgpt', requireAuth);

// Health check endpoint (unprotected)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    auth_configured: !!authCredentials,
    uptime: process.uptime()
  });
});

app.get('/*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  }
});

app.listen(port, () => {
  console.log(`🚀 Proxy server running at http://localhost:${port}`);
  console.log(`🌐 CORS enabled for React development servers`);
  console.log(`📝 Available endpoints:`);
  console.log(`   GET  /api/test`);
  console.log(`   POST /api/claude (original, non-cached)`);
  console.log(`   POST /api/claude-cached (with prompt caching)`);
  console.log(`   GET  /api/cache-stats`);
  console.log(`   POST /api/refresh-cache`);
  console.log(`   POST /api/chatgpt (with base64 conversion)`);
  console.log(`   POST /api/proxy-image (convert URL to base64)`);
  console.log(`   GET  /api/proxy-image-direct?url=... (direct image proxy)`);
  console.log(`🎨 OpenAI DALL-E 3 ready with size mapping`);
  console.log(`💾 Prompt caching enabled for cost optimization`);
  console.log(`📋 Instructions loaded: ${cachedInstructions ? 'YES' : 'NO'}`);
  if (cachedInstructions) {
    console.log(`📏 Instructions size: ${cachedInstructions.length} chars`);
  }
});
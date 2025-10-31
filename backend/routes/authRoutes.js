import express from 'express';
import { authService } from '../services/authService.js';
import {supabase} from '../config/supabase.js'

const router = express.Router();

// ✅ Cookie config helper
const getCookieOptions = () => ({
  httpOnly: true,
  secure: false, // ✅ Set false for localhost, true for production
  sameSite: 'lax', // ✅ Change from 'strict' to 'lax'
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/' // ✅ Ensure cookie works for all paths
});

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await authService.register(username, password);
    res.json({ success: true, message: 'Registration successful' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const usernameOrEmail = username || email;
    
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const { user, token } = await authService.login(usernameOrEmail, password);

    // ✅ Set cookie with proper config
    res.cookie('ai_image_auth', token, getCookieOptions());

    console.log('✅ Login successful, cookie set for:', user.email);

    res.json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    res.status(401).json({ error: error.message });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = req.cookies?.ai_image_auth;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token' 
      });
    }

    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    // Fetch full user data from database
    const { data: user, error } = await supabase
      .from('ms_image_users')
      .select('id, email, role, full_name, status')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,          // ✅ Include user ID
        email: user.email,
        role: user.role,
        fullName: user.full_name
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('ai_image_auth', getCookieOptions());
  res.json({ success: true });
});

export default router;
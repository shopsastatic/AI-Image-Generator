import { authService } from '../services/authService.js';

export const requireAuth = (req, res, next) => {
  try {
    const token = req.cookies?.ai_image_auth;
    
    console.log('🔐 requireAuth - checking token:', !!token);
    
    if (!token) {
      console.log('❌ No token found in cookies');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      console.log('❌ Token verification failed');
      res.clearCookie('ai_image_auth');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log('✅ Auth successful for:', decoded.email, `(${decoded.role})`);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireAdmin = (req, res, next) => {
  try {
    const token = req.cookies?.ai_image_auth;
    
    console.log('👑 requireAdmin - checking token:', !!token);
    
    if (!token) {
      console.log('❌ No token found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      console.log('❌ Token invalid');
      res.clearCookie('ai_image_auth');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log('🔍 User role:', decoded.role);
    
    if (decoded.role !== 'Admin') {
      console.log('❌ Not admin - access denied');
      return res.status(403).json({ 
        error: 'Admin access required',
        message: 'You need admin privileges to access this resource'
      });
    }

    console.log('✅ Admin access granted for:', decoded.email);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};
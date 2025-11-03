import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET;

const hashPassword = (password, salt) => 
  crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

export const authService = {
  async register(username, password) {
    // Check if username exists
    const { data: existing } = await supabase
      .from('ms_image_users')
      .select('id')
      .eq('email', username.toLowerCase().trim())
      .single();

    if (existing) {
      throw new Error('Username already taken');
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const { data, error } = await supabase
      .from('ms_image_users')
      .insert({
        email: username.toLowerCase().trim(), // Use email column for username
        password_hash: `${salt}:${passwordHash}`,
        full_name: username, // Store username as display name
        role: 'Content',
        status: 'active'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async login(username, password) {
    const { data: user, error } = await supabase
      .from('ms_image_users')
      .select('*')
      .eq('email', username.toLowerCase().trim())
      .eq('status', 'active')
      .single();

    if (error || !user) throw new Error('Invalid credentials');

    const [salt, storedHash] = user.password_hash.split(':');
    const inputHash = hashPassword(password, salt);
    
    if (!crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(inputHash, 'hex'))) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { user, token };
  },

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  },

  async registerByAdmin(username, password, role = 'Content') {
    // Check if username exists
    const { data: existing } = await supabase
      .from('ms_image_users')
      .select('id')
      .eq('email', username.toLowerCase().trim())
      .single();

    if (existing) {
      throw new Error('Username already exists');
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const { data, error } = await supabase
      .from('ms_image_users')
      .insert({
        email: username.toLowerCase().trim(),
        password_hash: `${salt}:${passwordHash}`,
        full_name: username,
        role: role, // ✅ Sử dụng role được truyền vào
        status: 'active'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};
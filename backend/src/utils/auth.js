import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ─── Token Generator ──────────────────────────────────────────────────────────
export const generateToken = (userId) => {
  return jwt.sign({ user_id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ─── protect ──────────────────────────────────────────────────────────────────
// Verifies the JWT Bearer token and attaches the full user object to req.user.
// Every protected route must use this middleware first.
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ id: decoded.user_id }).select('-__v').lean();
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }
    if (!user.is_active) {
      return res.status(401).json({ message: 'Unauthorized: Account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

// ─── adminOnly ────────────────────────────────────────────────────────────────
// Gate middleware — only admins pass. Use AFTER protect.
export const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
};

// ─── managerOrAbove ───────────────────────────────────────────────────────────
// Gate middleware — admins and managers pass. Use AFTER protect.
export const managerOrAbove = (req, res, next) => {
  if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: Manager or Admin access required' });
  }
  next();
};
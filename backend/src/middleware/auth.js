import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect: Verifies the JWT and attaches the user to the request.
 * Equivalent to FastAPI's Depends(get_current_user)
 */
export const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header (split "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // FIXED: Enforce is_active check to lock out deactivated employees
      req.user = await User.findOne({
        id: decoded.user_id,
        is_active: true
      });

      if (!req.user) {
        return res.status(401).json({ message: 'User not found or account is deactivated.' });
      }

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Admin Only: Restricts access to admin roles.
 * Equivalent to FastAPI's Depends(get_admin_user)
 */
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

// Add this to the bottom of backend/src/middleware/auth.js

/**
 * Authorize: Restricts access to specific roles.
 * Usage: router.get('/team', protect, authorize('admin', 'manager'), getTeam);
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role (${req.user?.role || 'unknown'}) is not authorized to access this route`
      });
    }
    next();
  };
};
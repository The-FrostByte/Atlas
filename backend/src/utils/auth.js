import jwt from 'jsonwebtoken';

export const generateToken = (userId) => {
  return jwt.sign({ user_id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d', // Matching your Python 'timedelta(days=7)'
  });
};
import express from 'express';
import rateLimit from 'express-rate-limit';
import { sendOTP, verifyOTP } from '../controllers/authController.js';

const router = express.Router();

// ─── Rate Limiter Configuration ───────────────────────────────────────────────
// Limits requests to 3 per minute per IP to prevent OTP spam and budget drain
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 3,
  message: { message: "Too many OTP requests from this IP, please try again after a minute." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Matches Python's @api_router.post("/auth/send-otp")
router.post('/send-otp', otpLimiter, sendOTP);
router.post('/verify-otp', verifyOTP);

export default router;
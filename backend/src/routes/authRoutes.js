import express from 'express';
import { sendOTP, verifyOTP } from '../controllers/authController.js';

const router = express.Router();

// Matches Python's @api_router.post("/auth/send-otp")
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP); // New route

// We will add verify-otp and register here next
export default router;
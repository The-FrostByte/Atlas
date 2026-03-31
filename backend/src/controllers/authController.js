import User from '../models/User.js';
import { sendWhatsApp } from '../services/whatsappService.js';
import OTP from '../models/OTP.js'; // Import the OTP model we created earlier
import { generateToken } from '../utils/auth.js';
import crypto from 'crypto'; // Built-in Node tool for random numbers

// Mock DB for OTPs (or use a dedicated collection like your Python 'otp_codes')
// For production-level, we'll use a Mongoose model for OTPs later
export const sendOTP = async (req, res) => {
  const { email, phone } = req.body;
  try {
    // Clean the input: remove accidental spaces and make the search case-insensitive
    const query = email
      ? { email: { $regex: new RegExp(`^${email.trim()}$`, 'i') } }
      : { phone: phone.trim() };

    console.log(`[AUTH] Looking up user with:`, query);

    const user = await User.findOne(query);

    if (!user) {
      console.log(`[AUTH FAILED] User not found in database.`);
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // DELETE old OTPs for this user first so only the latest works
    await OTP.deleteMany(query);

    // SAVE the new OTP to MongoDB
    await OTP.create({
      email: user.email || undefined, // use the DB's clean email
      phone: user.phone || undefined,
      otp: otp
    });

    console.log(`[DATABASE] OTP Saved for ${user.email || user.phone}: ${otp}`);

    res.json({ message: "OTP sent", otp_for_testing: otp });
  } catch (error) {
    console.error(`[AUTH ERROR]`, error);
    res.status(500).json({ message: error.message });
  }
};

export const verifyOTP = async (req, res) => {
  const { email, phone, otp } = req.body;

  try {
    // Ensure OTP is treated as a string for the database query
    const otpString = otp.toString();
    const query = email ? { email } : { phone };

    // Search for the record
    const otpRecord = await OTP.findOne({
      ...query,
      otp: otpString
    });

    if (!otpRecord) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
        debug_info: { attempted_otp: otpString, query } // Optional debug
      });
    }

    const user = await User.findOne(query);
    await OTP.deleteMany(query); // Clear all OTPs for this user after success

    const token = generateToken(user.id);

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
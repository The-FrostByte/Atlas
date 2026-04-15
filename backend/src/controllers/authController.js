import User from '../models/User.js';
import OTP from '../models/OTP.js';
import { generateToken } from '../utils/auth.js';
// NEW: Import necessary security libraries
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const sendOTP = async (req, res) => {
  const { email, phone } = req.body;

  try {
    const query = email
      ? { email: { $regex: new RegExp(`^${email.trim()}$`, 'i') } }
      : { phone: phone.trim() };

    const user = await User.findOne(query);

    if (!user) {
      // SECURITY: In an internal app, 404 is okay. For public apps, always return 200 
      // to prevent "User Enumeration" attacks.
      return res.status(404).json({ message: "User not found" });
    }

    // 1. SECURE RANDOMNESS: Replaced Math.random()
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 2. SECURE STORAGE: Hash the OTP before saving
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // 3. ATOMIC UPSERT: Replaced deleteMany() + create() to prevent race conditions
    await OTP.findOneAndUpdate(
      query,
      {
        email: user.email || undefined,
        phone: user.phone || undefined,
        otp: hashedOtp,
        createdAt: Date.now() // Reset the TTL index timer
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[DATABASE] Secure OTP generated for ${user.email || user.phone}`);

    // TODO: Actually send the OTP via WhatsApp/Email here

    // 4. PREVENT LEAKS: Only expose the OTP in development mode
    const responsePayload = { message: "OTP sent successfully" };
    if (process.env.NODE_ENV === 'development') {
      responsePayload.otp_for_testing = otp;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error(`[AUTH ERROR]`, error);
    res.status(500).json({ message: "Internal server error" }); // Don't leak error.message to client
  }
};

export const verifyOTP = async (req, res) => {
  const { email, phone, otp } = req.body;

  try {
    if (!otp) return res.status(400).json({ message: "OTP is required" });

    const otpString = otp.toString();
    const query = email ? { email } : { phone };

    // 1. Find the OTP record
    const otpRecord = await OTP.findOne(query);

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // 2. SECURE COMPARISON: Compare user input against the hashed OTP
    const isMatch = await bcrypt.compare(otpString, otpRecord.otp);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await User.findOne(query);

    // 3. CLEANUP: Clear the OTP so it cannot be reused
    await OTP.deleteMany(query);

    const token = generateToken(user.id);

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error(`[VERIFY ERROR]`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};
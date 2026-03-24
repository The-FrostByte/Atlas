import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: { type: String },
  phone: { type: String },
  otp: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Automatically deletes after 600 seconds (10 mins)
  }
});

const OTP = mongoose.model('OTP', otpSchema);
export default OTP;
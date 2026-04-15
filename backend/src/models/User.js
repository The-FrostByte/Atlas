import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    lowercase: true,
    sparse: true
  },

  phone: {
    type: String,
    sparse: true
  },

  department: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ['admin', 'manager', 'member'],
    default: 'member'
  },

  profile_picture: {
    type: String,
    default: null
  },

  // ❌ REMOVE THIS (you are using OTP)
  // password: { type: String, required: true }

  is_active: {
    type: Boolean,
    default: true
  },

  created_at: {
    type: String,
    default: () => new Date().toISOString()
  }

}, { timestamps: false });

export default mongoose.model('User', userSchema);
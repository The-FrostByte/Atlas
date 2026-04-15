import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';

// ─── createUser ───────────────────────────────────────────────────────────────
// Admin only (enforced at route level with adminOnly middleware).
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, department, role } = req.body;

    if (!name || (!email && !phone)) {
      return res.status(400).json({ message: 'Name and either email or phone are required' });
    }
    if (!department) {
      return res.status(400).json({ message: 'Department is required' });
    }
    if (email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Email already exists' });
    }
    if (phone) {
      const exists = await User.findOne({ phone });
      if (exists) return res.status(400).json({ message: 'Phone already exists' });
    }

    const newUser = await User.create({
      id: uuidv4(), name, email, phone, department, role: role || 'member'
    });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── updateUser ───────────────────────────────────────────────────────────────
// Admin only (enforced at route level).
export const updateUser = async (req, res) => {
  try {
    const { name, email, phone, department, role, is_active } = req.body;

    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update fields (only admins will reach this code)
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (department) user.department = department;
    if (role) user.role = role;
    if (is_active !== undefined) user.is_active = is_active;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── deleteUser ───────────────────────────────────────────────────────────────
// Admin only (enforced at route level).
export const deleteUser = async (req, res) => {
  try {
    const result = await User.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getAllUsers ──────────────────────────────────────────────────────────────
// Visible to all authenticated users (all roles can see the team list).
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('id name email phone role department');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getUserById ──────────────────────────────────────────────────────────────
export const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id }).select('-__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── searchMentions ───────────────────────────────────────────────────────────
export const searchMentions = async (req, res) => {
  try {
    const query = req.query.q || '';
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('id name email department').limit(5);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── uploadProfilePicture ─────────────────────────────────────────────────────
// Any user can upload a picture for themselves, Admins can upload for anyone.
export const uploadProfilePicture = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const isSelf = String(req.user.id) === String(targetUserId);
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You can only update your own profile picture' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const updatedUser = await User.findOneAndUpdate(
      { id: targetUserId },
      { profile_picture: fileUrl },
      { returnDocument: 'after' }
    ).select('-__v');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile picture updated', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
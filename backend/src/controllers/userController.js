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
// Hybrid protection (route uses protect, NOT adminOnly):
//   • Admins    — can update all fields including role and department
//   • Non-admins — can only update their OWN profile (name, email, phone)
//                  They CANNOT change role or department
//                  They CANNOT update another user's profile
export const updateUser = async (req, res) => {
  try {
    const { name, email, phone, department, role } = req.body;
    const requesterId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isSelf = String(user.id) === String(requesterId);

    // Non-admins can only edit themselves
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'Forbidden: You can only edit your own profile' });
    }

    // Validate required fields
    if (!name || (!email && !phone)) {
      return res.status(400).json({ message: 'Name and either email or phone are required' });
    }

    // Always update safe personal fields
    user.name = name;
    user.email = email || user.email;
    user.phone = phone || user.phone;

    // Only admins may change role or department
    if (isAdmin) {
      if (department) user.department = department;
      if (role) user.role = role;
    }
    // Non-admin attempting to change role/dept → silently ignore
    // (do not error, just don't apply the change)

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
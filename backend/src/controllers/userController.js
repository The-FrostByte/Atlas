import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';

// CREATE USER
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, department, role } = req.body;

    // ✅ Validation
    if (!name || (!email && !phone)) {
      return res.status(400).json({
        message: 'Name and either email or phone are required'
      });
    }

    if (!department) {
      return res.status(400).json({
        message: 'Department is required'
      });
    }

    // ✅ Prevent duplicates
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: 'Phone already exists' });
      }
    }

    const newUser = await User.create({
      id: uuidv4(),
      name,
      email,
      phone,
      department,
      role
    });

    res.status(201).json(newUser);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


// DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const result = await User.deleteOne({ id: req.params.id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: "User removed" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// GET ALL USERS
export const getAllUsers = async (req, res) => {
  try {
    const users = await User
      .find({})
      .select('id name email phone role department');

    res.json(users);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// GET USER BY ID
export const getUserById = async (req, res) => {
  try {
    const user = await User
      .findOne({ id: req.params.id })
      .select('-__v');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ✅ ADD THIS (YOU WERE MISSING IT)
export const updateUser = async (req, res) => {
  try {
    const { name, email, phone, department, role } = req.body;

    const user = await User.findOne({ id: req.params.id });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Optional validation
    if (!name || (!email && !phone)) {
      return res.status(400).json({
        message: 'Name and either email or phone are required'
      });
    }

    user.name = name;
    user.email = email;
    user.phone = phone;
    user.department = department;
    user.role = role;

    await user.save();

    res.json(user);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const searchMentions = async (req, res) => {
  try {
    const query = req.query.q || '';
    // Find users whose name or email matches the search query
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
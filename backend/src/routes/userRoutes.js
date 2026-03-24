import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';

import {
  createUser,
  deleteUser,
  getAllUsers,
  updateUser,
  getUserById,
  searchMentions
} from '../controllers/userController.js';

import User from '../models/User.js';

const router = express.Router();

// =====================
// CURRENT USER
// =====================
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User
      .findOne({ id: req.user.id })
      .select('-__v');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/mentions', protect, searchMentions);


// =====================
// USER CRUD
// =====================

// GET ALL USERS
router.get('/', protect, getAllUsers);

// GET USER BY ID (optional but useful)
router.get('/:id', protect, getUserById);

// CREATE USER (admin only)
router.post('/', protect, adminOnly, createUser);

// UPDATE USER (admin only) ✅ THIS FIXES YOUR QUESTION
router.put('/:id', protect, adminOnly, updateUser);

// DELETE USER (admin only)
router.delete('/:id', protect, adminOnly, deleteUser);


export default router;
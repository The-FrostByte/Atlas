import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadProfilePicture } from '../controllers/userController.js';

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
router.get('/me', protect, (req, res) => {
  // req.user is already populated and verified by the 'protect' middleware
  res.json(req.user);
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

// UPDATE USER (Admin only - for names, emails, roles, etc.)
router.put('/:id', protect, adminOnly, updateUser);

// DELETE USER (admin only)
router.delete('/:id', protect, adminOnly, deleteUser);

// UPLOAD PROFILE PICTURE (User can do this for themselves)
// We use upload.single('avatar') because it's just one image.
router.post('/:id/avatar', protect, upload.single('avatar'), uploadProfilePicture);

export default router;
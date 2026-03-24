import express from 'express';
import { getDepartments, createDepartment, deleteDepartment } from '../controllers/departmentController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Matches GET /api/departments
router.get('/', protect, getDepartments);

// Matches POST /api/departments (Admin only)
router.post('/', protect, adminOnly, createDepartment);

// Matches DELETE /api/departments/:id (Admin only)
router.delete('/:id', protect, adminOnly, deleteDepartment);

export default router;
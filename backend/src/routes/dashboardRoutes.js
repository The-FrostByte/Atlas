import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { getEmployeeLoadData } from '../controllers/dashboardController.js';
// ... other imports


const router = express.Router();

// Matches Python's @api_router.get("/dashboard/stats")
// We can use adminOnly if you want to restrict this view
router.get('/stats', protect, getDashboardStats);
router.get('/employee-load', protect, getEmployeeLoadData);

export default router;
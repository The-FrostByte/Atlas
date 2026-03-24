import express from 'express';
import {
  createTask,
  getTasks,
  updateTask,
  getTaskById,
  uploadTaskAttachments,
  completeTask,
  getDailySchedule,
  getTaskSchedule,
  getTaskAttachments,
  getRecurringTasks,      // Fixed name
  stopRecurringTask,      // Fixed name
  resumeRecurringTask     // Fixed name
} from '../controllers/taskController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { createComment, getTaskComments } from '../controllers/commentController.js';

const router = express.Router();

// 1. Static/Fixed routes FIRST
router.get('/daily', protect, getDailySchedule);
router.get('/schedule', protect, getTaskSchedule);
router.get('/recurring-templates', protect, getRecurringTasks);

// 2. Collection routes
router.route('/')
  .get(protect, getTasks)
  .post(protect, createTask);

// 3. Status/Toggle routes (Must be above /:task_id)
router.post('/:taskId/stop', protect, stopRecurringTask);
router.post('/:taskId/resume', protect, resumeRecurringTask);

// 4. Individual Task routes LAST
router.route('/:task_id')
  .get(protect, getTaskById)
  .put(protect, updateTask);

// Attachments
router.route('/:task_id/attachments')
  .get(protect, getTaskAttachments)
  .post(protect, upload.array('files', 5), uploadTaskAttachments);

// Comments
router.route('/:task_id/comments')
  .get(protect, getTaskComments)
  .post(protect, createComment);

// Completion
router.post('/:task_id/complete', protect, completeTask);

export default router;
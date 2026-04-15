import express from 'express';
import {
  createTask, getTasks, updateTask, deleteTask,
  getTaskById, uploadTaskAttachments, completeTask,
  getDailySchedule, getTaskSchedule, getTaskAttachments,
  getRecurringTasks, stopRecurringTask, resumeRecurringTask
} from '../controllers/taskController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { createComment, getTaskComments } from '../controllers/commentController.js';

const router = express.Router();

// ─── 1. Static / fixed routes (must be before /:task_id) ─────────────────────
router.get('/daily', protect, getDailySchedule);
router.get('/schedule', protect, getTaskSchedule);
router.get('/recurring-templates', protect, getRecurringTasks);

// ─── 2. Collection ────────────────────────────────────────────────────────────
router.route('/')
  .get(protect, getTasks)
  .post(protect, createTask);

// ─── 3. Recurring task controls ───────────────────────────────────────────────
router.post('/:task_id/stop', protect, stopRecurringTask);
router.post('/:task_id/resume', protect, resumeRecurringTask);

// ─── 4. Individual task ───────────────────────────────────────────────────────
router.route('/:task_id')
  .get(protect, getTaskById)
  .put(protect, updateTask)
  .delete(protect, adminOnly, deleteTask);

// ─── 5. Attachments ───────────────────────────────────────────────────────────
router.route('/:task_id/attachments')
  .get(protect, getTaskAttachments)
  .post(protect, upload.array('files', 5), uploadTaskAttachments);

// ─── 6. Comments (task-scoped creation/fetching) ──────────────────────────────
router.route('/:task_id/comments')
  .get(protect, getTaskComments)
  .post(protect, createComment);

// ─── 7. Completion ────────────────────────────────────────────────────────────
router.post('/:task_id/complete', protect, completeTask);

export default router;
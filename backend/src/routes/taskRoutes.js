import express from 'express';
import {
  createTask, getTasks, updateTask, deleteTask,
  getTaskById, uploadTaskAttachments, completeTask,
  getDailySchedule, getTaskSchedule, getTaskAttachments,
  getRecurringTasks, stopRecurringTask, resumeRecurringTask
} from '../controllers/taskController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  createComment, getTaskComments,
  updateComment, deleteComment
} from '../controllers/commentController.js';

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
  // DELETE is admin-only — adminOnly middleware + double-check inside controller
  .delete(protect, adminOnly, deleteTask);

// ─── 5. Attachments ───────────────────────────────────────────────────────────
router.route('/:task_id/attachments')
  .get(protect, getTaskAttachments)
  .post(protect, upload.array('files', 5), uploadTaskAttachments);

// ─── 6. Comments (task-scoped) ────────────────────────────────────────────────
router.route('/:task_id/comments')
  .get(protect, getTaskComments)
  .post(protect, createComment);

// ─── 7. Comment edit / delete
// TaskDetail.js calls PUT /api/comments/:id and DELETE /api/comments/:id.
// Mount these on the task router so they are accessible at /api/tasks/comments/:comment_id,
// OR wire a separate /api/comments router in server.js pointing to the same handlers.
// The handlers below export updateComment and deleteComment for either approach.
router.put('/comments/:comment_id', protect, updateComment);
router.delete('/comments/:comment_id', protect, deleteComment);

// ─── 8. Completion ────────────────────────────────────────────────────────────
router.post('/:task_id/complete', protect, completeTask);

export default router;

/*
 * NOTE for server.js wiring:
 * If TaskDetail.js calls PUT /api/comments/:id, you also need to mount the
 * comment routes separately in server.js:
 *
 *   import { updateComment, deleteComment } from './controllers/commentController.js';
 *   app.put('/api/comments/:comment_id',    protect, updateComment);
 *   app.delete('/api/comments/:comment_id', protect, deleteComment);
 *
 * OR create a dedicated commentRoutes.js that re-exports these handlers.
 */
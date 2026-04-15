import express from 'express';
import { updateComment, deleteComment } from '../controllers/commentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.put('/:comment_id', protect, updateComment);
router.delete('/:comment_id', protect, deleteComment);
export default router;
import express from 'express';
import { downloadAttachment, deleteAttachment } from '../controllers/attachmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/attachments/:id/download
router.get('/:id/download', protect, downloadAttachment);

// DELETE /api/attachments/:id
router.delete('/:id', protect, deleteAttachment);

export default router;
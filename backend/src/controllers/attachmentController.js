import Attachment from '../models/Attachment.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { canViewTask, canDeleteAttachment } from '../utils/permissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAssigneeUser = async (assignedToId) => {
  if (!assignedToId) return null;
  return User.findOne({ id: String(assignedToId) }).lean();
};

// ─── downloadAttachment ───────────────────────────────────────────────────────
export const downloadAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({ id: req.params.id }).lean();
    if (!attachment) return res.status(404).json({ message: 'File not found' });

    // Check that the requesting user can view the task this attachment belongs to
    const task = await Task.findOne({ id: attachment.task_id }).lean();
    if (task) {
      const assignee = await getAssigneeUser(task.assigned_to);
      if (!canViewTask(req.user, task, assignee)) {
        return res.status(403).json({ message: 'Forbidden: No access to this attachment' });
      }
    }

    const filePath = path.join(__dirname, '../../uploads', attachment.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Physical file missing from server' });
    }

    res.download(filePath, attachment.original_filename);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── deleteAttachment ─────────────────────────────────────────────────────────
export const deleteAttachment = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({ id: req.params.id }).lean();
    if (!attachment) return res.status(404).json({ message: 'File not found' });

    // Only the uploader or an admin can delete
    if (!canDeleteAttachment(req.user, attachment)) {
      return res.status(403).json({ message: 'Forbidden: Only the uploader or an admin can delete this file' });
    }

    // Remove physical file
    const filePath = path.join(__dirname, '../../uploads', attachment.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Remove DB record
    await Attachment.deleteOne({ id: req.params.id });

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import { v4 as uuidv4 } from 'uuid';
import { emitToTask } from '../socket/socketHandler.js';
import { canViewTask } from '../utils/permissions.js';

const getAssigneeUser = async (assignedToId) => {
  if (!assignedToId) return null;
  return User.findOne({ id: String(assignedToId) }).lean();
};

// ─── createComment ────────────────────────────────────────────────────────────
export const createComment = async (req, res) => {
  try {
    const { task_id } = req.params;
    const { content, parent_comment_id } = req.body;

    const task = await Task.findOne({ id: task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const assignee = await getAssigneeUser(task.assigned_to);
    if (!canViewTask(req.user, task, assignee)) {
      return res.status(403).json({ message: 'Forbidden: No access to this task\'s comments' });
    }

    // Resolve @mentions
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentionedNames = [...content.matchAll(mentionRegex)].map(m => m[1].replace(/_/g, ' '));
    let resolvedMentions = [];
    if (mentionedNames.length > 0) {
      const users = await User.find({
        name: { $in: mentionedNames.map(n => new RegExp(`^${n}$`, 'i')) }
      });
      resolvedMentions = users.map(u => u.id);
    }

    const commentId = uuidv4();
    const newComment = new Comment({
      id: commentId,
      task_id,
      author_id: req.user.id,
      parent_comment_id: parent_comment_id || null,
      content,
      mentions: resolvedMentions,
      created_at: new Date().toISOString()
    });

    await newComment.save();

    // Notify mentioned users
    if (resolvedMentions.length > 0) {
      await Promise.all(
        resolvedMentions
          .filter(uid => uid !== req.user.id)
          .map(uid =>
            Notification.create({
              id: uuidv4(),
              user_id: uid,
              task_id,
              title: 'You were mentioned',
              message: `${req.user.name}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
              type: 'mention',
              is_read: false,
              created_at: new Date().toISOString()
            })
          )
      );
    }

    const responseData = { ...newComment.toObject(), author: { name: req.user.name, id: req.user.id } };
    emitToTask(task_id, 'comment_created', { payload: responseData });

    res.status(201).json(responseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getTaskComments ──────────────────────────────────────────────────────────
export const getTaskComments = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const assignee = await getAssigneeUser(task.assigned_to);
    if (!canViewTask(req.user, task, assignee)) {
      return res.status(403).json({ message: 'Forbidden: No access to this task\'s comments' });
    }

    const comments = await Comment.find({ task_id: req.params.task_id }).lean();
    const withAuthors = await Promise.all(
      comments.map(async (c) => {
        const author = await User.findOne({ id: c.author_id }).select('name').lean();
        return { ...c, author };
      })
    );

    res.json(withAuthors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── updateComment ────────────────────────────────────────────────────────────
// Author or Admin only.
export const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findOne({ id: req.params.comment_id }).lean();
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only the author or an admin can edit this comment' });
    }

    const updated = await Comment.findOneAndUpdate(
      { id: req.params.comment_id },
      { content: req.body.content, is_edited: true },
      { returnDocument: 'after' }
    );

    emitToTask(comment.task_id, 'comment_updated', { payload: updated });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── deleteComment ────────────────────────────────────────────────────────────
// Author or Admin only.
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findOne({ id: req.params.comment_id }).lean();
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only the author or an admin can delete this comment' });
    }

    await Comment.deleteOne({ id: req.params.comment_id });
    emitToTask(comment.task_id, 'comment_deleted', { comment_id: req.params.comment_id });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
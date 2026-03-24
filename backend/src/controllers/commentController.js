import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { v4 as uuidv4 } from 'uuid';
import { emitToTask } from '../socket/socketHandler.js';

export const createComment = async (req, res) => {
  try {
    const { task_id } = req.params;
    const { content, parent_comment_id } = req.body;

    // 1. Extract Mentions (Handles @User_Name or @User)
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const matches = [...content.matchAll(mentionRegex)];
    const mentionedNames = matches.map(match => match[1].replace(/_/g, ' '));

    let resolvedMentions = [];
    if (mentionedNames.length > 0) {
      const users = await User.find({
        name: { $in: mentionedNames.map(name => new RegExp(`^${name}$`, 'i')) }
      });
      resolvedMentions = users.map(u => u.id);
    }

    // 2. Create Comment Object
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

    // 3. Save ONCE
    await newComment.save();

    // 4. Create Notifications for mentioned users
    if (resolvedMentions.length > 0) {
      const notifPromises = resolvedMentions
        .filter(userId => userId !== req.user.id)
        .map(userId => Notification.create({
          id: uuidv4(),
          user_id: userId,
          task_id: task_id, // CRITICAL: This enables clickability in Layout.js
          title: 'You were mentioned',
          message: `${req.user.name}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`, // Shows actual content
          type: 'mention',
          is_read: false,
          created_at: new Date().toISOString()
        }));
      await Promise.all(notifPromises);
    }

    // 5. Prepare Response for Frontend
    // Frontend expects { ...comment, author: { name: '...' } }
    const authorInfo = { name: req.user.name, id: req.user.id };
    const responseData = {
      ...newComment.toObject(),
      author: authorInfo
    };

    // 6. Broadcast via Socket
    // Frontend TaskDetail.js looks for event.type === 'comment_created'
    emitToTask(task_id, 'comment_created', {
      payload: responseData
    });

    res.status(201).json(responseData);

  } catch (error) {
    console.error("Comment Creation Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getTaskComments = async (req, res) => {
  try {
    // Fetch comments
    const comments = await Comment.find({ task_id: req.params.task_id }).lean();

    // Manual "join" to get author names (since we store IDs as strings)
    const commentsWithAuthors = await Promise.all(comments.map(async (c) => {
      const author = await User.findOne({ id: c.author_id }).select('name');
      return { ...c, author };
    }));

    res.json(commentsWithAuthors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
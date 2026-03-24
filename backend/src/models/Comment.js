import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  task_id: { type: String, required: true },
  author_id: { type: String, required: true },
  parent_comment_id: { type: String, default: null },
  content: { type: String, required: true },
  attachments: [String], // Array of Attachment IDs
  mentions: [String],    // Array of User IDs
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
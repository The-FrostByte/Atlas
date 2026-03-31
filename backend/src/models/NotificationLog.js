import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema({
  task_id: { type: String, required: true },
  user_id: { type: String, required: true },
  type: { type: String, required: true },
  trigger_offset_hours: { type: Number, default: null },
  sent_at: { type: String, required: true }
});

// Compound index to match Python's deduplication logic
notificationLogSchema.index({ task_id: 1, user_id: 1, type: 1, trigger_offset_hours: 1 });

export default mongoose.model('NotificationLog', notificationLogSchema);
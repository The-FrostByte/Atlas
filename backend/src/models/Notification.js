import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  task_id: { type: String },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String },
  is_read: { type: Boolean, default: false },
  created_at: { type: String, default: () => new Date().toISOString() }
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
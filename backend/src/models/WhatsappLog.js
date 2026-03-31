import mongoose from 'mongoose';

const whatsappLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, default: 'whatsapp' },
  notification_type: { type: String, required: true },
  user_id: { type: String, default: null },
  task_id: { type: String, default: null },
  phone_number: { type: String, required: true },
  message_sid: { type: String, default: null },
  status: { type: String, required: true },
  error_code: { type: Number, default: null },
  error_message: { type: String, default: null },
  sent_at: { type: String, default: () => new Date().toISOString() }
});

export default mongoose.model('WhatsappLog', whatsappLogSchema);
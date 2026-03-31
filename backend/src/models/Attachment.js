import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  task_id: { type: String, required: true },
  uploader_id: { type: String, required: true },
  filename: { type: String, required: true },
  file_url: { type: String, required: true },
  file_size: { type: Number },
  mime_type: { type: String },
  created_at: { type: String, default: () => new Date().toISOString() }
});

export default mongoose.model('Attachment', attachmentSchema);
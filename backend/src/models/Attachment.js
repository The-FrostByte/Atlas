import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  task_id: { type: String, required: true },
  uploaded_by: { type: String, required: true },
  filename: { type: String, required: true },
  original_filename: { type: String, required: true },
  file_url: { type: String, required: true },
  mime_type: { type: String, required: true },
  size: { type: Number, required: true },
  created_at: { type: String, default: () => new Date().toISOString() }
});

const Attachment = mongoose.model('Attachment', attachmentSchema);
export default Attachment;
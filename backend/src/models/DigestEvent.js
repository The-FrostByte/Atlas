import mongoose from 'mongoose';

const digestEventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  digest_type: { type: String, required: true }, // 'start_of_day' | 'end_of_day'
  display: { type: String, required: true },
  title: { type: String, required: true },
  payload: { type: Object, required: true },
  seen: { type: Boolean, default: false },
  digest_date: { type: String, required: true }, // YYYY-MM-DD
  created_at: { type: String, default: () => new Date().toISOString() }
});

digestEventSchema.index({ user_id: 1, digest_type: 1, digest_date: 1 });

export default mongoose.model('DigestEvent', digestEventSchema);
import mongoose from 'mongoose';

const schedulerExecutionSchema = new mongoose.Schema({
  job_type: { type: String, required: true },
  execution_key: { type: String, required: true },
  executed_at: { type: Date, default: Date.now }
});

// Unique compound index
schedulerExecutionSchema.index({ job_type: 1, execution_key: 1 }, { unique: true });
// TTL index: auto-delete after 24 hours (86400 seconds)
schedulerExecutionSchema.index({ executed_at: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model('SchedulerExecution', schedulerExecutionSchema);
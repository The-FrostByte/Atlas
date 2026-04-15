import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'canceled'],
    default: 'pending'
  },
  assigned_to: { type: String, required: true },

  // N+1 OPTIMIZATION: Embed department to avoid joining User collection on read
  assignee_department: { type: String, default: 'General' },

  assigned_by: { type: String, required: true },
  due_date: { type: String, required: true },

  is_recurring: { type: Boolean, default: false },
  recurrence_pattern: { type: String, default: null },

  recurrence: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    interval: { type: Number, default: 1 },
    days_of_week: [Number],
    due_in_days: { type: Number, default: 1 },
    end_date: { type: String },
    max_occurrences: { type: Number },
    occurrences_created: { type: Number, default: 0 },
    next_run_at: { type: String },
    parent_task_id: { type: String, default: null }
  },

  recurrence_override: {
    enabled: { type: Boolean, default: false },
    avoid_weekends: { type: String, enum: ['none', 'sunday_only', 'sat_sun'], default: 'none' },
    avoid_holidays: { type: Boolean, default: false }
  },

  notifications: {
    enabled: { type: Boolean, default: false },
    deadline_alerts: [{ hours_before: Number, enabled: Boolean }],
    reminder_digests: {
      start_of_day: { type: Boolean, default: true },
      end_of_day: { type: Boolean, default: true }
    },
    overdue_escalation: {
      enabled: { type: Boolean, default: true },
      notify_creator: { type: Boolean, default: true },
      notify_admin: { type: Boolean, default: false }
    }
  },

  resolution: {
    text: String,
    completed_by: String,
    completed_at: String,
    attachments: [String]
  },

  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
});

export default mongoose.model('Task', taskSchema);
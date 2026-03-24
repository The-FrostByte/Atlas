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
  assigned_to: { type: String, required: true }, // User ID
  assigned_by: { type: String, required: true }, // User ID
  due_date: { type: String, required: true },

  // Recurrence logic from your Python TaskRecurrence class
  is_recurring: { type: Boolean, default: false },
  recurrence: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    interval: { type: Number, default: 1 },
    // In Task.js Schema
    is_recurring_active: {
      type: Boolean,
      default: true
    },
    // Ensure this field exists to group a "Series" of tasks together
    parent_recurring_id: {
      type: String,
      default: null
    },
    days_of_week: [Number], // 0-6
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

  // Task-level notification overrides
  notifications: {
    enabled: { type: Boolean, default: false },
    deadline_alerts: [{
      hours_before: Number,
      enabled: Boolean
    }],
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

  // Completion Data
  resolution: {
    text: String,
    completed_by: String,
    completed_at: String,
    attachments: [String] // Array of Attachment IDs
  },

  

  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
});

const Task = mongoose.model('Task', taskSchema);
export default Task;
import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Notification Settings
  deadline_alerts: [{ hours_before: Number, enabled: Boolean }],
  overdue_alert: {
    enabled: { type: Boolean, default: true },
    repeat_every_hours: { type: Number, default: 24 },
    notify_assignee: { type: Boolean, default: true },
    notify_creator: { type: Boolean, default: true },
    notify_admin: { type: Boolean, default: false }
  },
  channels: {
    in_app: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false }
  },
  reminder_digests: {
    enabled: { type: Boolean, default: true },
    start_of_day: { time: String, enabled: Boolean, due_soon_threshold_hours: Number, include: Object },
    end_of_day: { time: String, enabled: Boolean, include: Object }
  },
  // Recurrence Settings
  avoid_weekends: { type: String, default: 'none' },
  avoid_holidays: { type: Boolean, default: false },
  holiday_list: [String] // Array of YYYY-MM-DD
});

export default mongoose.model('Settings', settingsSchema);
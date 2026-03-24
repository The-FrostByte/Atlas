import Settings from '../models/Settings.js';

export const getSettings = async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({ id: 'global' }); // Initialize defaults
  res.json(settings);
};

export const updateSettings = async (req, res) => {
  try {
    const updated = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// WhatsApp Placeholder (To prevent frontend 404s)
export const getWhatsAppSettings = async (req, res) => {
  res.json({
    enabled: false,
    twilio_configured: !!process.env.TWILIO_SID,
    notification_types: { otp: true, task_assigned: true }
  });
};

// Add this function
export const getNotificationDefaults = async (req, res) => {
  try {
    // We return the standard defaults the frontend expects
    res.json({
      deadline_alerts: [
        { hours_before: 1, enabled: true },
        { hours_before: 24, enabled: true }
      ],
      overdue_alert: {
        enabled: true,
        repeat_every_hours: 24,
        notify_assignee: true,
        notify_creator: true,
        notify_admin: false
      },
      channels: {
        in_app: true,
        email: false,
        whatsapp: false
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
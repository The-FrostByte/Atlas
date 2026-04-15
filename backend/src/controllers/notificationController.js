import Notification from '../models/Notification.js';

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.id })
      .sort({ created_at: -1 })
      .lean(); // .lean() makes it a plain JS object

    // Ensure every notification has an 'id' property matching the frontend expectation
    const formattedNotifications = notifications.map(n => ({
      ...n,
      id: n.id || n._id.toString()
    }));

    res.json(formattedNotifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    // Use id (UUID) to find the notification
    const notification = await Notification.findOneAndUpdate(
      { id: req.params.id },
      { is_read: true },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
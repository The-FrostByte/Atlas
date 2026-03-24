import Task from '../models/Task.js';

export const getPopups = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Fetch uncompleted tasks for the user
    const tasks = await Task.find({
      assigned_to: userId,
      status: { $ne: 'completed' }
    }).lean();

    if (tasks.length === 0) return res.json([]);

    // Categorize into the sections expected by the frontend
    const overdue = tasks.filter(t => new Date(t.due_date) < now);
    const dueToday = tasks.filter(t => t.due_date.startsWith(todayStr));
    const dueSoon = tasks.filter(t => {
      const due = new Date(t.due_date);
      const hoursDiff = (due - now) / (1000 * 60 * 60);
      return hoursDiff > 0 && hoursDiff <= 48 && !t.due_date.startsWith(todayStr);
    });

    const sections = [];
    if (overdue.length > 0) sections.push({ type: 'overdue', count: overdue.length, tasks: overdue });
    if (dueToday.length > 0) sections.push({ type: 'due_today', count: dueToday.length, tasks: dueToday });
    if (dueSoon.length > 0) sections.push({ type: 'due_soon', count: dueSoon.length, tasks: dueSoon });

    // Structure follows DigestPopup.js: digest.payload.sections
    res.json([{
      id: `digest-${todayStr}`,
      title: now.getHours() < 12 ? 'Morning Summary' : 'Evening Wrap-up',
      digest_type: now.getHours() < 12 ? 'start_of_day' : 'end_of_day',
      payload: {
        total_tasks: tasks.length,
        sections: sections
      }
    }]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markDigestSeen = async (req, res) => {
  // Logic to store that user has seen this specific digest ID
  res.json({ success: true });
};
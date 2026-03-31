import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import NotificationLog from '../models/NotificationLog.js';
import SchedulerExecution from '../models/SchedulerExecution.js';
import DigestEvent from '../models/DigestEvent.js';
import Settings from '../models/Settings.js';
import { sendWhatsApp } from './whatsappService.js';
import { findNextValidDate } from '../utils/dateHelper.js'; // Assuming you have this from Python logic

// ─── Distributed Lock Mechanism ───────────────────────────────────────────────
const acquireLock = async (jobType, executionKey) => {
  try {
    await SchedulerExecution.create({ job_type: jobType, execution_key: executionKey });
    return true; // Lock acquired
  } catch (error) {
    if (error.code === 11000) return false; // 11000 is MongoDB's duplicate key error
    console.error(`[LOCK ERROR] ${error.message}`);
    return false;
  }
};

// ─── Main Scheduler Initialization ────────────────────────────────────────────
export const startScheduler = () => {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[SCHEDULER] Running 5-minute cycle...');
    await processDeadlineAlerts();
    await processRecurringTasks();
  });

  // Run digests at specific times (e.g., 09:00 and 18:00 UTC)
  // For simplicity here, we run a check every 15 mins to generate them if missing
  cron.schedule('*/15 * * * *', async () => {
    console.log('[SCHEDULER] Checking Digest generation...');
    await processReminderDigests();
  });

  console.log('🚀 Background Scheduler Started with Distributed Locks');
};

// ─── 1. Deadline Alerts ───────────────────────────────────────────────────────
const processDeadlineAlerts = async () => {
  const now = new Date();

  // Find pending or in-progress tasks
  const tasks = await Task.find({ status: { $in: ['pending', 'in_progress'] } }).lean();

  for (const task of tasks) {
    if (!task.due_date || !task.assigned_to) continue;

    const dueDate = new Date(task.due_date);
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

    // Skip if already overdue
    if (hoursUntilDue < 0) continue;

    // Use task overrides if enabled, else fallback to global (mocked logic here for brevity)
    const alerts = task.notifications?.enabled
      ? task.notifications.deadline_alerts
      : [{ hours_before: 24, enabled: true }, { hours_before: 1, enabled: true }]; // Fetch from Settings normally

    for (const alert of alerts) {
      if (!alert.enabled) continue;

      // If we are within a 30-minute window of the alert threshold
      if (hoursUntilDue <= alert.hours_before + 0.5 && hoursUntilDue >= alert.hours_before - 0.5) {

        // IDEMPOTENCY CHECK: Did we already send this exact alert?
        const alreadySent = await NotificationLog.findOne({
          task_id: task.id,
          user_id: task.assigned_to,
          type: 'deadline_warning',
          trigger_offset_hours: alert.hours_before
        });

        if (alreadySent) continue; // Skip, already notified

        const title = "Deadline Approaching";
        const message = `Task '${task.title}' is due in ${alert.hours_before} hours`;

        // 1. Create In-App Notification
        await Notification.create({
          id: uuidv4(),
          user_id: task.assigned_to,
          task_id: task.id,
          title,
          message,
          type: 'deadline_warning',
          created_at: new Date().toISOString()
        });

        // 2. Log it so we don't send it again
        await NotificationLog.create({
          task_id: task.id,
          user_id: task.assigned_to,
          type: 'deadline_warning',
          trigger_offset_hours: alert.hours_before,
          sent_at: new Date().toISOString()
        });

        console.log(`[ALERT] Sent ${alert.hours_before}h warning for task ${task.id}`);
      }
    }
  }
};

// ─── 2. Recurring Tasks ───────────────────────────────────────────────────────
const processRecurringTasks = async () => {
  const now = new Date().toISOString();

  // Find parents where next_run_at <= now
  const recurringParents = await Task.find({
    is_recurring: true,
    'recurrence.enabled': true,
    'recurrence.next_run_at': { $lte: now },
    'recurrence.parent_task_id': null
  });

  for (const parent of recurringParents) {
    const occurrences = parent.recurrence.occurrences_created || 0;
    const executionKey = `${parent.id}_${occurrences}`;

    // Prevent double-firing across multiple Node servers
    const locked = await acquireLock('recurring_task', executionKey);
    if (!locked) continue;

    // Calculate due date for the child task
    const childDueDate = new Date();
    childDueDate.setDate(childDueDate.getDate() + (parent.recurrence.due_in_days || 1));

    // Create Child Task
    const childTaskId = uuidv4();
    await Task.create({
      id: childTaskId,
      title: parent.title,
      description: parent.description,
      priority: parent.priority,
      status: 'pending',
      assigned_to: parent.assigned_to,
      assigned_by: parent.assigned_by,
      due_date: childDueDate.toISOString(),
      is_recurring: false,
      recurrence: {
        enabled: false,
        parent_task_id: parent.id
      }
    });

    // Calculate next run for the parent
    const nextRun = new Date();
    if (parent.recurrence.frequency === 'daily') {
      nextRun.setDate(nextRun.getDate() + (parent.recurrence.interval || 1));
    } else if (parent.recurrence.frequency === 'weekly') {
      nextRun.setDate(nextRun.getDate() + (7 * (parent.recurrence.interval || 1)));
    } else if (parent.recurrence.frequency === 'monthly') {
      nextRun.setMonth(nextRun.getMonth() + (parent.recurrence.interval || 1));
    }

    // Update parent
    parent.recurrence.occurrences_created += 1;
    parent.recurrence.next_run_at = nextRun.toISOString();

    // Stop if max occurrences reached
    if (parent.recurrence.max_occurrences && parent.recurrence.occurrences_created >= parent.recurrence.max_occurrences) {
      parent.recurrence.enabled = false;
    }

    await parent.save();
    console.log(`[RECURRENCE] Spawned child ${childTaskId} from parent ${parent.id}`);
  }
};

// ─── 3. Reminder Digests ──────────────────────────────────────────────────────
const processReminderDigests = async () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const users = await User.find({ is_active: true }).lean();

  for (const user of users) {
    const executionKey = `start_of_day_${user.id}_${todayStr}`;

    // Check lock
    const locked = await acquireLock('digest', executionKey);
    if (!locked) continue;

    // Check if digest already exists for today
    const existing = await DigestEvent.findOne({
      user_id: user.id,
      digest_type: 'start_of_day',
      digest_date: todayStr
    });

    if (existing) continue;

    // Gather basic stats for the user's morning popup
    const tasks = await Task.find({ assigned_to: user.id, status: { $ne: 'completed' } }).lean();
    if (tasks.length === 0) continue; // No tasks, no popup

    await DigestEvent.create({
      id: uuidv4(),
      user_id: user.id,
      digest_type: 'start_of_day',
      display: 'popup',
      title: "Good Morning! Here's your day ahead",
      payload: { total_tasks: tasks.length }, // Simplify payload for now
      seen: false,
      digest_date: todayStr
    });

    console.log(`[DIGEST] Created morning digest for user ${user.id}`);
  }
};
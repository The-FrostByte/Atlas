import cron from 'node-cron';
import Task from '../models/Task.js';
import { v4 as uuidv4 } from 'uuid';
import { sendWhatsApp } from './whatsappService.js';

export const startScheduler = () => {
  // 1. Every 5 minutes: Check for Deadline Alerts
  // Matches Python's: trigger=IntervalTrigger(minutes=5)
  cron.schedule('*/5 * * * *', async () => {
    console.log('[SCHEDULER] Checking for deadline alerts...');
    await processDeadlineAlerts();
  });

  // 2. Every 10 minutes: Process Recurring Tasks
  cron.schedule('*/10 * * * *', async () => {
    console.log('[SCHEDULER] Processing recurring tasks...');
    await processRecurringTasks();
  });

  console.log('🚀 Background Scheduler Started');
};

const processDeadlineAlerts = async () => {
  const now = new Date();
  // Logic: Find tasks where due_date is close and status is 'pending'
  // You would port your Python 'hours_until_due' logic here
};

const processRecurringTasks = async () => {
  const now = new Date().toISOString();
  // 1. Find parent tasks where recurrence.enabled is true and next_run_at <= now
  const recurringParents = await Task.find({
    'is_recurring': true,
    'recurrence.enabled': true,
    'recurrence.next_run_at': { $lte: now },
    'recurrence.parent_task_id': null
  });

  for (const parent of recurringParents) {
    // 2. Create the child task instance (Clone of parent)
    const childTaskId = uuidv4();
    await Task.create({
      id: childTaskId,
      title: parent.title,
      description: parent.description,
      priority: parent.priority,
      assigned_to: parent.assigned_to,
      assigned_by: parent.assigned_by,
      due_date: new Date(Date.now() + 86400000).toISOString(), // Example: Due in 24h
      is_recurring: false,
      'recurrence.parent_task_id': parent.id
    });

    // 3. Update parent with next_run_at (Logic for daily/weekly/monthly)
    // This is where you calculate the next date
    parent.recurrence.occurrences_created += 1;
    // Simple logic: add 1 day for 'daily'
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    parent.recurrence.next_run_at = nextDate.toISOString();

    await parent.save();
    console.log(`[SCHEDULER] Created child task for parent: ${parent.title}`);
  }
};
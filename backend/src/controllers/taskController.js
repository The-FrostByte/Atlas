import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { v4 as uuidv4 } from 'uuid';
import { sendWhatsApp } from '../services/whatsappService.js';
import Attachment from '../models/Attachment.js';
import {
  canViewTask,
  canEditTask,
  canChangeTaskStatus,
  canCompleteTask,
  canDeleteTask,
  canModifyRecurrence,
} from '../utils/permissions.js';

// ─── Helper: build the correct task query for a given role ───────────────────
const buildTaskQuery = async (role, id, department) => {
  if (role === 'admin') return {};

  if (role === 'manager') {
    // N+1 OPTIMIZATION: We no longer need to query the User collection here.
    // We filter directly on the denormalized assignee_department.
    return {
      $or: [
        { assignee_department: department },
        { assigned_by: id }
      ]
    };
  }
  return { $or: [{ assigned_to: id }, { assigned_by: id }] };
};

// ─── createTask ───────────────────────────────────────────────────────────────
export const createTask = async (req, res) => {
  try {
    const {
      title, description, priority, assigned_to,
      due_date, is_recurring, recurrence, notifications, recurrence_override
    } = req.body;

    const taskId = uuidv4();
    const now = new Date().toISOString();

    // Fetch the assignee once during creation to embed their department
    const assigneeUser = await User.findOne({ id: assigned_to }).lean();

    const newTask = new Task({
      id: taskId,
      title,
      description,
      priority: priority || 'medium',
      status: 'pending',
      assigned_to,
      assignee_department: assigneeUser?.department || 'General', // Embedded
      assigned_by: req.user.id,
      due_date,
      is_recurring: is_recurring || false,
      created_at: now,
      updated_at: now
    });

    if (notifications?.enabled) {
      newTask.notifications = notifications;
    }

    if (is_recurring && recurrence?.enabled) {
      newTask.recurrence = {
        ...recurrence,
        parent_task_id: null,
        occurrences_created: 0,
        next_run_at: due_date
      };
    }

    if (recurrence_override) {
      newTask.recurrence_override = recurrence_override;
    }

    await newTask.save();

    if (assigned_to !== req.user.id) {
      await Notification.create({
        id: uuidv4(),
        user_id: assigned_to,
        task_id: taskId,
        title: 'New Task Assigned',
        message: `You have been assigned: ${title}`,
        type: 'task_assigned',
        created_at: now
      });

      sendWhatsApp(assigned_to, 'task_assigned', {
        title,
        priority: (priority || 'medium').toUpperCase(),
        due_date,
        assigned_by: req.user.name
      }).catch(err => console.error('WhatsApp Notify Error:', err));
    }

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getTasks ────────────────────────────────────────────────────────────────
export const getTasks = async (req, res) => {
  try {
    const {
      status, statuses, priorities, assigned_to, assigned_by, search,
      due_from, due_to, overdue, parent_recurring_only, my_tasks,
      page = 1, limit = 50, sort, is_recurring_parent
    } = req.query;

    let query = { $and: [] };
    const now = new Date().toISOString();

    // ── 1. RBAC visibility scope ─────────────────────────────────────────────
    if (req.user.role === 'admin') {
      // Sees all
    } else if (req.user.role === 'manager') {
      // N+1 Optimized Check
      query.$and.push({
        $or: [
          { assigned_to: req.user.id },
          { assignee_department: req.user.department },
          { assigned_by: req.user.id }
        ]
      });
    } else {
      query.$and.push({
        $or: [{ assigned_to: req.user.id }, { assigned_by: req.user.id }]
      });
    }

    // ── 2. Additional filters ─────────────────────────────────────────────────
    if (my_tasks === 'true') query.$and.push({ assigned_to: req.user.id });
    if (statuses) query.$and.push({ status: { $in: statuses.split(',') } });
    else if (status && status !== 'all') query.$and.push({ status });
    if (priorities) query.$and.push({ priority: { $in: priorities.split(',') } });
    if (assigned_to) query.$and.push({ assigned_to });
    if (assigned_by) query.$and.push({ assigned_by });
    if (overdue === 'true') query.$and.push({ status: { $ne: 'completed' }, due_date: { $lt: now } });
    if (parent_recurring_only === 'true' || is_recurring_parent === 'true') {
      query.$and.push({ is_recurring: true, 'recurrence.parent_task_id': null });
    }
    if (search) {
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }
    if (due_from || due_to) {
      const dueFilter = {};
      if (due_from) dueFilter.$gte = due_from;
      if (due_to) dueFilter.$lte = due_to;
      query.$and.push({ due_date: dueFilter });
    }

    if (query.$and.length === 0) delete query.$and;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ── 3. Sorting ────────────────────────────────────────────────────────────
    const isPrioritySort = sort === 'priority_high' || sort === 'priority_low';

    let tasks, total;

    if (isPrioritySort) {
      const rankDir = sort === 'priority_high' ? 1 : -1;
      const pipeline = [
        { $match: query.$and ? { $and: query.$and } : {} },
        {
          $addFields: {
            priority_rank: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'critical'] }, then: 0 },
                  { case: { $eq: ['$priority', 'high'] }, then: 1 },
                  { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                  { case: { $eq: ['$priority', 'low'] }, then: 3 },
                ],
                default: 4
              }
            }
          }
        },
        { $sort: { priority_rank: rankDir, created_at: -1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: parseInt(limit) }],
            count: [{ $count: 'total' }]
          }
        }
      ];
      const [result] = await Task.aggregate(pipeline);
      tasks = result.data;
      total = result.count[0]?.total || 0;
    } else {
      let sortOrder = {};
      switch (sort) {
        case 'created_at_asc': sortOrder = { created_at: 1 }; break;
        case 'due_date_asc': sortOrder = { due_date: 1 }; break;
        case 'due_date_desc': sortOrder = { due_date: -1 }; break;
        case 'updated_at_desc': sortOrder = { updated_at: -1 }; break;
        default: sortOrder = { created_at: -1 }; break;
      }
      [tasks, total] = await Promise.all([
        Task.find(query).sort(sortOrder).skip(skip).limit(parseInt(limit)).lean(),
        Task.countDocuments(query)
      ]);
    }

    res.json({
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getTaskById ──────────────────────────────────────────────────────────────
export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Mock assignee using embedded data for the permission checker
    const mockAssignee = { id: task.assigned_to, department: task.assignee_department };
    if (!canViewTask(req.user, task, mockAssignee)) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this task' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── updateTask ───────────────────────────────────────────────────────────────
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const mockAssignee = { id: task.assigned_to, department: task.assignee_department };

    const isStatusOnlyUpdate = Object.keys(req.body).length === 1 && req.body.status !== undefined;

    if (isStatusOnlyUpdate) {
      if (!canChangeTaskStatus(req.user, task, mockAssignee)) {
        return res.status(403).json({ message: 'Forbidden: You cannot change the status of this task' });
      }
    } else {
      if (!canEditTask(req.user, task, mockAssignee)) {
        return res.status(403).json({ message: 'Forbidden: You cannot edit this task' });
      }
    }

    const updatePayload = { ...req.body, updated_at: new Date().toISOString() };

    // If reassigned, update the embedded department
    if (req.body.assigned_to && req.body.assigned_to !== task.assigned_to) {
      const newAssigneeUser = await User.findOne({ id: req.body.assigned_to }).lean();
      updatePayload.assignee_department = newAssigneeUser?.department || 'General';
    }

    const updated = await Task.findOneAndUpdate(
      { id: req.params.task_id },
      updatePayload,
      { returnDocument: 'after' }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── deleteTask ───────────────────────────────────────────────────────────────
export const deleteTask = async (req, res) => {
  try {
    if (!canDeleteTask(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Only admins can delete tasks' });
    }

    const result = await Task.deleteOne({ id: req.params.task_id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Task not found' });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── completeTask ─────────────────────────────────────────────────────────────
export const completeTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    const task = await Task.findOne({ id: task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!canCompleteTask(req.user, task)) {
      return res.status(403).json({
        message: 'Forbidden: Only the task creator or assignee can complete this task'
      });
    }

    const { resolution_text, attachment_ids } = req.body;
    if (!resolution_text?.trim()) {
      return res.status(400).json({ message: 'resolution_text is required' });
    }
    if (!attachment_ids?.length) {
      return res.status(400).json({ message: 'At least one attachment is required to complete a task' });
    }

    const completed = await Task.findOneAndUpdate(
      { id: task_id },
      {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolution: {
          text: resolution_text,
          completed_by: req.user.id,
          completed_at: new Date().toISOString(),
          attachments: attachment_ids
        }
      },
      { returnDocument: 'after' }
    );

    if (completed.is_recurring && completed.is_recurring_active) {
      await generateNextOccurrence(completed);
    }

    res.json({ message: 'Task completed', task: completed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── stopRecurringTask ────────────────────────────────────────────────────────
export const stopRecurringTask = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Recurring task not found' });

    if (!canModifyRecurrence(req.user, task)) {
      return res.status(403).json({
        message: 'Forbidden: Only the task creator or an admin can stop this recurring schedule'
      });
    }

    const updated = await Task.findOneAndUpdate(
      { id: req.params.task_id },
      { 'recurrence.enabled': false, updated_at: new Date().toISOString() },
      { returnDocument: 'after' }
    );

    res.json({ message: 'Recurring schedule stopped successfully', task: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── resumeRecurringTask ──────────────────────────────────────────────────────
export const resumeRecurringTask = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Recurring task not found' });

    if (!canModifyRecurrence(req.user, task)) {
      return res.status(403).json({
        message: 'Forbidden: Only the task creator or an admin can resume this recurring schedule'
      });
    }

    const updated = await Task.findOneAndUpdate(
      { id: req.params.task_id },
      { is_recurring_active: true, updated_at: new Date().toISOString() },
      { returnDocument: 'after' }
    );

    res.json({ message: 'Recurring schedule resumed successfully', task: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getRecurringTasks ────────────────────────────────────────────────────────
export const getRecurringTasks = async (req, res) => {
  try {
    const templates = await Task.find({
      is_recurring: true,
      'recurrence.parent_task_id': null
    }).lean();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRecurringTemplates = getRecurringTasks;

// ─── toggleRecurrence ─────────────────────────────────────────────────────────
export const toggleRecurrence = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!canModifyRecurrence(req.user, task)) {
      return res.status(403).json({ message: 'Forbidden: Only the creator or admin can toggle recurrence' });
    }

    const updated = await Task.findOneAndUpdate(
      { id: req.params.task_id },
      { is_recurring_active: !task.is_recurring_active },
      { returnDocument: 'after' }
    );

    res.json({ is_active: updated.is_recurring_active });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── deleteRecurringTask ──────────────────────────────────────────────────────
export const deleteRecurringTask = async (req, res) => {
  try {
    if (!canDeleteTask(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Only admins can delete recurring tasks' });
    }
    await Task.deleteOne({ id: req.params.task_id });
    res.json({ message: 'Recurring task removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { getTaskById as getTask };

// ─── getTaskAttachments ───────────────────────────────────────────────────────
export const getTaskAttachments = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const mockAssignee = { id: task.assigned_to, department: task.assignee_department };
    if (!canViewTask(req.user, task, mockAssignee)) {
      return res.status(403).json({ message: 'Forbidden: No access to this task' });
    }

    const attachments = await Attachment.find({ task_id: req.params.task_id })
      .sort({ created_at: -1 });
    res.json(attachments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── uploadTaskAttachments ────────────────────────────────────────────────────
export const uploadTaskAttachments = async (req, res) => {
  try {
    const taskId = req.params.task_id;
    const task = await Task.findOne({ id: taskId }).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const mockAssignee = { id: task.assigned_to, department: task.assignee_department };

    if (task.status === 'completed' && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden: Only admins can upload attachments to completed tasks'
      });
    }

    if (!canViewTask(req.user, task, mockAssignee)) {
      return res.status(403).json({ message: 'Forbidden: No access to this task' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const uploaded = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const att = await Attachment.create({
          id: uuidv4(),
          task_id: taskId,
          uploaded_by: req.user.id,
          filename: file.filename,
          original_filename: file.originalname,
          file_url: `/uploads/${file.filename}`,
          mime_type: file.mimetype,
          size: file.size
        });
        uploaded.push(att);
      } catch (err) {
        errors.push({ filename: file.originalname, error: err.message });
      }
    }

    res.status(201).json({
      uploaded,
      errors,
      total_uploaded: uploaded.length,
      total_failed: errors.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getTaskSchedule ──────────────────────────────────────────────────────────
export const getTaskSchedule = async (req, res) => {
  try {
    const { role, id, department } = req.user;
    const { start_date, end_date } = req.query;

    let query = await buildTaskQuery(role, id, department);

    if (start_date && end_date) {
      query.due_date = { $gte: start_date, $lte: end_date };
    }

    const tasks = await Task.find(query).sort({ due_date: 1 }).lean();

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getDailySchedule ────────────────────────────────────────────────────────
export const getDailySchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setDate(today.getDate() + 7);

    const tasks = await Task.find({
      $or: [{ assigned_to: userId }, { assigned_by: userId }],
      $or: [
        { due_date: { $gte: today.toISOString(), $lte: end.toISOString() } },
        { status: { $ne: 'completed' }, due_date: { $lt: today.toISOString() } }
      ]
    }).sort({ due_date: 1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── generateNextOccurrence (internal) ───────────────────────────────────────
const generateNextOccurrence = async (parentTask) => {
  if (!parentTask.is_recurring_active) return;
  const nextDueDate = new Date(parentTask.due_date);
  const freq = parentTask.recurrence?.frequency || 'daily';
  if (freq === 'daily') nextDueDate.setDate(nextDueDate.getDate() + 1);
  else if (freq === 'weekly') nextDueDate.setDate(nextDueDate.getDate() + 7);
  else if (freq === 'monthly') nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  const newTask = new Task({
    id: uuidv4(),
    title: parentTask.title,
    description: parentTask.description,
    assigned_to: parentTask.assigned_to,
    assignee_department: parentTask.assignee_department, // Propagate to new task
    assigned_by: parentTask.assigned_by,
    priority: parentTask.priority,
    due_date: nextDueDate.toISOString(),
    status: 'pending',
    is_recurring: true,
    is_recurring_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Fixed duplicate assignment bug here:
    recurrence: { ...parentTask.recurrence, parent_task_id: parentTask.id, occurrences_created: 0 }
  });
  await newTask.save();
};
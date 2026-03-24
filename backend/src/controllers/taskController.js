import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { v4 as uuidv4 } from 'uuid';
import { sendWhatsApp } from '../services/whatsappService.js';
import Attachment from '../models/Attachment.js';

export const createTask = async (req, res) => {
  try {
    const {
      title, description, priority, assigned_to,
      due_date, is_recurring, recurrence, notifications, recurrence_override
    } = req.body;

    const taskId = uuidv4();
    const now = new Date().toISOString();

    const newTask = new Task({
      id: taskId,
      title,
      description,
      priority: priority || 'medium',
      status: 'pending',
      assigned_to,
      assigned_by: req.user.id,
      due_date,
      is_recurring: is_recurring || false,
      is_recurring_active: true,
      created_at: now,
      updated_at: now
    });

    if (notifications && notifications.enabled) {
      newTask.notifications = notifications;
    }

    if (is_recurring && recurrence && recurrence.enabled) {
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
      const notifId = uuidv4();
      await Notification.create({
        id: notifId,
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
      }).catch(err => console.error("WhatsApp Notify Error:", err));
    }

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTasks = async (req, res) => {
  try {
    const {
      status, statuses, priorities, assigned_to, assigned_by, search,
      due_from, due_to, created_from, created_to,
      overdue, parent_recurring_only, my_tasks,
      page = 1, limit = 50, sort, is_recurring_parent
    } = req.query;

    let query = { $and: [] };
    const now = new Date().toISOString();

    // --- 1. RBAC & Ownership ---
    if (req.user.role === 'admin') {
      // Sees all
    } else if (req.user.role === 'manager') {
      const deptUsers = await User.find({ department: req.user.department }).select('id');
      const deptUserIds = deptUsers.map(u => u.id);
      query.$and.push({
        $or: [
          { assigned_to: req.user.id },
          { assigned_to: { $in: deptUserIds } },
          { assigned_by: req.user.id }
        ]
      });
    } else {
      query.$and.push({
        $or: [{ assigned_to: req.user.id }, { assigned_by: req.user.id }]
      });
    }

    // --- 2. Filters ---
    if (my_tasks === 'true') query.$and.push({ assigned_to: req.user.id });
    if (statuses) query.$and.push({ status: { $in: statuses.split(',') } });
    else if (status && status !== 'all') query.$and.push({ status });
    if (priorities) query.$and.push({ priority: { $in: priorities.split(',') } });
    if (assigned_to) query.$and.push({ assigned_to });
    if (assigned_by) query.$and.push({ assigned_by });
    if (overdue === 'true') query.$and.push({ status: { $ne: 'completed' }, due_date: { $lt: now } });
    if (parent_recurring_only === 'true' || is_recurring_parent === 'true') {
      query.$and.push({ is_recurring: true, "recurrence.parent_task_id": null });
    }

    if (search) {
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Date Ranges
    if (due_from || due_to) {
      let dueFilter = {};
      if (due_from) dueFilter.$gte = due_from;
      if (due_to) dueFilter.$lte = due_to;
      query.$and.push({ due_date: dueFilter });
    }

    if (query.$and.length === 0) delete query.$and;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // --- 3. Sorting ---
    // Priority sort needs a numeric rank because priority values are strings.
    // Alphabetical sort gives: critical → high → low → medium (wrong).
    // We use an aggregation pipeline to inject a numeric rank field first.
    const isPrioritySort = sort === 'priority_high' || sort === 'priority_low';

    // The $switch adds priority_rank: critical=0, high=1, medium=2, low=3
    const priorityRankStage = {
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
    };

    let tasks;
    let total;

    if (isPrioritySort) {
      // priority_high → rank ASC  (0=critical first)
      // priority_low  → rank DESC (3=low first)
      const rankDirection = sort === 'priority_high' ? 1 : -1;

      const pipeline = [
        { $match: query.$and ? { $and: query.$and } : {} },
        priorityRankStage,
        { $sort: { priority_rank: rankDirection, created_at: -1 } },
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
      // All non-priority sorts use the regular find path
      let sortOrder = {};
      switch (sort) {
        case 'created_at_asc': sortOrder = { created_at: 1 }; break;
        case 'due_date_asc': sortOrder = { due_date: 1 }; break;
        case 'due_date_desc': sortOrder = { due_date: -1 }; break;
        case 'updated_at_desc': sortOrder = { updated_at: -1 }; break;
        case 'created_at_desc':
        default: sortOrder = { created_at: -1 }; break;
      }

      [tasks, total] = await Promise.all([
        Task.find(query)
          .populate('assigned_to', 'name email')
          .sort(sortOrder)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
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

export const getRecurringTasks = async (req, res) => {
  try {
    const templates = await Task.find({
      is_recurring: true,
      "recurrence.parent_task_id": null
    })
      .populate('assigned_to', 'name email')
      .lean();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRecurringTemplates = getRecurringTasks;

export const stopRecurringTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { id: req.params.taskId },
      { is_recurring_active: false, updated_at: new Date().toISOString() },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: "Recurring task not found" });
    res.json({ message: "Recurring schedule stopped successfully", task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resumeRecurringTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { id: req.params.taskId },
      { is_recurring_active: true, updated_at: new Date().toISOString() },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: "Recurring task not found" });
    res.json({ message: "Recurring schedule resumed successfully", task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleRecurrence = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id });
    if (!task) return res.status(404).json({ message: "Task not found" });
    task.is_recurring_active = !task.is_recurring_active;
    await task.save();
    res.json({ is_active: task.is_recurring_active });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { id: req.params.task_id },
      { ...req.body, updated_at: new Date().toISOString() },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const completeTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    const task = await Task.findOne({ id: task_id });
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.status = 'completed';
    task.completed_at = new Date().toISOString();
    await task.save();

    if (task.is_recurring && task.is_recurring_active) {
      await generateNextOccurrence(task);
    }
    res.json({ message: "Task completed", task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateNextOccurrence = async (parentTask) => {
  if (parentTask.is_recurring_active === false) return;
  const nextDueDate = new Date(parentTask.due_date);
  const freq = parentTask.recurrence?.frequency || 'daily';
  if (freq === 'daily') nextDueDate.setDate(nextDueDate.getDate() + 1);
  else if (freq === 'weekly') nextDueDate.setDate(nextDueDate.getDate() + 7);
  else if (freq === 'monthly') nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  const newTask = new Task({
    id: uuidv4(),
    title: parentTask.title,
    description: parentTask.description,
    department: parentTask.department,
    assigned_to: parentTask.assigned_to,
    assigned_by: parentTask.assigned_by,
    priority: parentTask.priority,
    due_date: nextDueDate.toISOString(),
    status: 'pending',
    is_recurring: true,
    is_recurring_active: true,
    recurrence: { ...parentTask.recurrence, parent_task_id: parentTask.id },
    parent_recurring_id: parentTask.parent_recurring_id || parentTask.id
  });
  await newTask.save();
};

export const deleteTask = async (req, res) => {
  try {
    const result = await Task.deleteOne({ id: req.params.taskId });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteRecurringTask = async (req, res) => {
  try {
    await Task.deleteOne({ id: req.params.taskId });
    res.json({ message: "Recurring task removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({ id: req.params.task_id });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTaskAttachments = async (req, res) => {
  try {
    const attachments = await Attachment.find({ task_id: req.params.task_id }).sort({ created_at: -1 });
    res.json(attachments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadTaskAttachments = async (req, res) => {
  try {
    const taskId = req.params.task_id;
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: "No files" });
    const uploaded = [];
    for (const file of req.files) {
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
    }
    res.status(201).json(uploaded);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTaskSchedule = async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [{ assigned_to: req.user.id }, { assigned_by: req.user.id }],
      status: { $ne: 'completed' }
    }).sort({ due_date: 1 });

    const scheduleData = tasks.reduce((acc, task) => {
      const dateKey = task.due_date.split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(task);
      return acc;
    }, {});
    res.json(scheduleData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDailySchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(today.getDate() + 7);
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

import Task from '../models/Task.js';
import User from '../models/User.js';

export const getDashboardStats = async (req, res) => {
  try {
    const { role, id, department } = req.user;
    const { start_date, end_date } = req.query;
    const now = new Date().toISOString();

    let taskQuery = {};
    if (role === 'manager') {
      taskQuery = { $or: [{ department: department }, { assigned_by: id }] };
    } else if (role === 'member') {
      taskQuery = { $or: [{ assigned_to: id }, { assigned_by: id }] };
    }

    // created_at is stored as an ISO string in the schema, so we compare
    // strings directly. ISO 8601 strings sort lexicographically, so $gte/$lte
    // comparisons are accurate without any Date conversion.
    if (start_date && end_date) {
      taskQuery.created_at = {
        $gte: start_date,
        $lte: end_date
      };
    }

    const allTasks = await Task.find(taskQuery).lean();

    const total_users = role === 'admin' ? await User.countDocuments() : 1;

    const summary = {
      total_tasks: allTasks.length,
      overdue_tasks: allTasks.filter(t => t.status !== 'completed' && t.due_date < now).length,
      total_users: total_users
    };

    const status_distribution = [
      { _id: 'completed', count: allTasks.filter(t => t.status === 'completed').length },
      { _id: 'overdue', count: allTasks.filter(t => t.status !== 'completed' && t.due_date < now).length },
      { _id: 'in_progress', count: allTasks.filter(t => t.status === 'in_progress' && t.due_date >= now).length },
      { _id: 'pending', count: allTasks.filter(t => t.status === 'pending' && t.due_date >= now).length }
    ].filter(item => item.count > 0);

    let usersQuery = {};
    if (role === 'manager') usersQuery = { department: department };
    else if (role === 'member') usersQuery = { id: id };

    const scopedUsers = await User.find(usersQuery).lean();
    const departments = [...new Set(scopedUsers.map(u => u.department || 'General'))];

    const department_performance = departments.map(deptName => {
      const deptTasks = allTasks.filter(t => {
        if (t.department) return t.department === deptName;
        const assignedUser = scopedUsers.find(u =>
          (u._id && u._id.toString() === t.assigned_to?.toString()) ||
          (u.id && u.id === t.assigned_to)
        );
        return (assignedUser?.department || 'General') === deptName;
      });

      return {
        name: deptName,
        completed: deptTasks.filter(t => t.status === 'completed').length,
        overdue: deptTasks.filter(t => t.status !== 'completed' && t.due_date < now).length,
        in_progress: deptTasks.filter(t => t.status === 'in_progress' && t.due_date >= now).length,
        pending: deptTasks.filter(t => t.status === 'pending' && t.due_date >= now).length
      };
    });

    res.json({ summary, status_distribution, department_performance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeLoadData = async (req, res) => {
  try {
    const { role, id, department } = req.user;
    const { start_date, end_date } = req.query;
    const now = new Date().toISOString();

    let taskQuery = {};
    let usersQuery = {};

    if (role === 'manager') {
      taskQuery = { $or: [{ department: department }, { assigned_by: id }] };
      usersQuery = { department: department };
    } else if (role === 'member') {
      taskQuery = { $or: [{ assigned_to: id }, { assigned_by: id }] };
      usersQuery = { id: id };
    }

    // Same string-based comparison for created_at
    if (start_date && end_date) {
      taskQuery.created_at = {
        $gte: start_date,
        $lte: end_date
      };
    }

    const [allTasks, scopedUsers] = await Promise.all([
      Task.find(taskQuery).lean(),
      User.find(usersQuery).lean()
    ]);

    const employee_data = scopedUsers.map(user => {
      const uTasks = allTasks.filter(t => t.assigned_to === user.id);
      const total = uTasks.length;
      const completed = uTasks.filter(t => t.status === 'completed').length;
      const overdue = uTasks.filter(t => t.status !== 'completed' && t.due_date < now).length;

      return {
        name: user.name,
        department: user.department || 'General',
        total,
        completed,
        overdue,
        in_progress: uTasks.filter(t => t.status === 'in_progress' && t.due_date >= now).length,
        pending: uTasks.filter(t => t.status === 'pending' && t.due_date >= now).length,
        on_time_rate: total > 0 ? Math.round((completed / total) * 100) : 100
      };
    });

    const maxOverdue = Math.max(...employee_data.map(e => e.overdue), 0);
    res.json(employee_data.map(e => ({
      ...e,
      has_most_overdue: e.overdue === maxOverdue && maxOverdue > 0
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
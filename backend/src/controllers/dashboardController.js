import Task from '../models/Task.js';
import User from '../models/User.js';

// ─── Helper: build the correct task query for a given role ───────────────────
// Manager visibility = tasks assigned to USERS IN THEIR DEPT + tasks they created.
// Uses User lookup because tasks don't reliably carry a department field.
const buildTaskQuery = async (role, id, department) => {
  if (role === 'admin') return {};

  if (role === 'manager') {
    const deptUsers = await User.find({ department }).select('id').lean();
    const deptUserIds = deptUsers.map(u => u.id);
    return {
      $or: [
        { assigned_to: { $in: deptUserIds } }, // assigned to anyone in dept
        { assigned_by: id }                    // created by this manager
      ]
    };
  }

  // member
  return { $or: [{ assigned_to: id }, { assigned_by: id }] };
};

// ─── getDashboardStats ────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const { role, id, department } = req.user;
    const { start_date, end_date } = req.query;
    const now = new Date().toISOString();

    let taskQuery = await buildTaskQuery(role, id, department);

    // Filter by task creation date (created_at stored as ISO string)
    if (start_date && end_date) {
      taskQuery.created_at = { $gte: start_date, $lte: end_date };
    }

    const allTasks = await Task.find(taskQuery).lean();

    // NEW — members now see their department count, not just "1"
    const total_users = role === 'admin'
      ? await User.countDocuments()
      : await User.countDocuments({ department }); // manager AND member both see dept count

    const summary = {
      total_tasks: allTasks.length,
      overdue_tasks: allTasks.filter(t => t.status !== 'completed' && t.due_date < now).length,
      total_users
    };

    const status_distribution = [
      { _id: 'completed', count: allTasks.filter(t => t.status === 'completed').length },
      { _id: 'overdue', count: allTasks.filter(t => t.status !== 'completed' && t.due_date < now).length },
      { _id: 'in_progress', count: allTasks.filter(t => t.status === 'in_progress' && t.due_date >= now).length },
      { _id: 'pending', count: allTasks.filter(t => t.status === 'pending' && t.due_date >= now).length }
    ].filter(item => item.count > 0);

    // Department performance — calculate scoped users based on role
    let scopedUsersQuery = {};
    if (role === 'manager') {
      // For managers: Include everyone in their dept, PLUS any cross-dept assignees
      const assigneeIds = [...new Set(allTasks.map(t => t.assigned_to).filter(Boolean))];
      scopedUsersQuery = {
        $or: [
          { department: department },
          { id: { $in: assigneeIds } }
        ]
      };
    } else if (role === 'member') {
      // For members: Collect unique assignee IDs from all tasks visible to this member
      const assigneeIds = [...new Set(allTasks.map(t => t.assigned_to).filter(Boolean))];
      // Also include the member themselves (for tasks assigned to them)
      if (!assigneeIds.includes(id)) assigneeIds.push(id);
      scopedUsersQuery = { id: { $in: assigneeIds } };
    }

    const scopedUsers = await User.find(scopedUsersQuery).lean();
    const departments = [...new Set(scopedUsers.map(u => u.department || 'General'))];

    const department_performance = await Promise.all(
      departments.map(async (deptName) => {
        const deptUserIds = scopedUsers
          .filter(u => (u.department || 'General') === deptName)
          .map(u => u.id);

        const deptTasks = allTasks.filter(t => deptUserIds.includes(t.assigned_to));

        return {
          name: deptName,
          completed: deptTasks.filter(t => t.status === 'completed').length,
          overdue: deptTasks.filter(t => t.status !== 'completed' && t.due_date < now).length,
          in_progress: deptTasks.filter(t => t.status === 'in_progress' && t.due_date >= now).length,
          pending: deptTasks.filter(t => t.status === 'pending' && t.due_date >= now).length
        };
      })
    );

    res.json({ summary, status_distribution, department_performance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getEmployeeLoadData ──────────────────────────────────────────────────────
export const getEmployeeLoadData = async (req, res) => {
  try {
    const { role, id, department } = req.user;
    const { start_date, end_date } = req.query;
    const now = new Date().toISOString();

    let taskQuery = await buildTaskQuery(role, id, department);

    if (start_date && end_date) {
      taskQuery.created_at = { $gte: start_date, $lte: end_date };
    }

    // ── Resolve users to show in the chart ────────────────────────────────────
    let allTasks, scopedUsers;

    if (role === 'manager') {
      // Fetch tasks first to find cross-dept assignees created by this manager
      allTasks = await Task.find(taskQuery).lean();
      const assigneeIds = [...new Set(allTasks.map(t => t.assigned_to).filter(Boolean))];

      // Fetch users who are EITHER in the manager's dept OR have a task visible to them
      scopedUsers = await User.find({
        $or: [
          { department: department },
          { id: { $in: assigneeIds } }
        ]
      }).lean();
    } else if (role === 'member') {
      // Fetch tasks first so we can find all assignees the member created tasks for
      allTasks = await Task.find(taskQuery).lean();
      const assigneeIds = [...new Set(allTasks.map(t => t.assigned_to).filter(Boolean))];
      if (!assigneeIds.includes(id)) assigneeIds.push(id);
      scopedUsers = await User.find({ id: { $in: assigneeIds } }).lean();
    } else {
      // admin
      [allTasks, scopedUsers] = await Promise.all([
        Task.find(taskQuery).lean(),
        User.find({}).lean()
      ]);
    }

    const employee_data = scopedUsers.map(u => {
      const uTasks = allTasks.filter(t => t.assigned_to === u.id);
      const total = uTasks.length;
      const completed = uTasks.filter(t => t.status === 'completed').length;
      const overdue = uTasks.filter(t => t.status !== 'completed' && t.due_date < now).length;

      return {
        name: u.name,
        department: u.department || 'General',
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
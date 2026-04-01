import Task from '../models/Task.js';
import User from '../models/User.js';

// ─── Helper: build the correct task query for a given role ───────────────────
const buildTaskQuery = async (role, id, department) => {
  if (role === 'admin') return {};
  if (role === 'manager') {
    const deptUsers = await User.find({ department }).select('id').lean();
    const deptUserIds = deptUsers.map(u => u.id);
    return {
      $or: [
        { assigned_to: { $in: deptUserIds } },
        { assigned_by: id }
      ]
    };
  }
  return { $or: [{ assigned_to: id }, { assigned_by: id }] };
};

// ─── getDashboardStats ────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const { role, id, department } = req.user;
    const { start_date, end_date, view_mode } = req.query;
    const now = new Date().toISOString();

    let taskQuery = await buildTaskQuery(role, id, department);

    // FIX: Using resolution.completed_at based on the Task schema
    if (view_mode === 'completed') {
      taskQuery.status = 'completed';
      if (start_date && end_date) taskQuery['resolution.completed_at'] = { $gte: start_date, $lte: end_date };
    } else if (view_mode === 'due_date') {
      if (start_date && end_date) taskQuery.due_date = { $gte: start_date, $lte: end_date };
    } else {
      if (start_date && end_date) taskQuery.created_at = { $gte: start_date, $lte: end_date };
    }

    // SCALABILITY REFACTOR: Database-level aggregation instead of Node.js memory arrays
    const statsPipeline = await Task.aggregate([
      { $match: taskQuery },
      {
        $facet: {
          basicCounts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "completed"] }, { $lt: ["$due_date", now] }] }, 1, 0] } }
              }
            }
          ],
          statusDist: [
            {
              $project: {
                computedStatus: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$status", "completed"] }, then: "completed" },
                      { case: { $and: [{ $ne: ["$status", "completed"] }, { $lt: ["$due_date", now] }] }, then: "overdue" },
                      { case: { $eq: ["$status", "in_progress"] }, then: "in_progress" },
                      { case: { $eq: ["$status", "pending"] }, then: "pending" }
                    ],
                    default: "pending"
                  }
                }
              }
            },
            { $group: { _id: "$computedStatus", count: { $sum: 1 } } }
          ],
          deptPerform: [
            { $lookup: { from: "users", localField: "assigned_to", foreignField: "id", as: "user" } },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
              $group: {
                _id: { $ifNull: ["$user.department", "General"] },
                completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                in_progress: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "in_progress"] }, { $gte: ["$due_date", now] }] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "pending"] }, { $gte: ["$due_date", now] }] }, 1, 0] } },
                overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "completed"] }, { $lt: ["$due_date", now] }] }, 1, 0] } }
              }
            }
          ]
        }
      }
    ]);

    const result = statsPipeline[0];

    const total_users = role === 'admin'
      ? await User.countDocuments()
      : await User.countDocuments({ department });

    const summary = {
      total_tasks: result.basicCounts[0]?.total || 0,
      overdue_tasks: result.basicCounts[0]?.overdue || 0,
      total_users
    };

    const status_distribution = result.statusDist.filter(item => item.count > 0);

    const department_performance = result.deptPerform.map(d => ({
      name: d._id,
      completed: d.completed,
      in_progress: d.in_progress,
      pending: d.pending,
      overdue: d.overdue
    }));

    res.json({ summary, status_distribution, department_performance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getEmployeeLoadData ──────────────────────────────────────────────────────
export const getEmployeeLoadData = async (req, res) => {
  try {
    const { role, id, department } = req.user;
    const { start_date, end_date, view_mode } = req.query;
    const now = new Date().toISOString();

    let taskQuery = await buildTaskQuery(role, id, department);

    if (view_mode === 'completed') {
      taskQuery.status = 'completed';
      if (start_date && end_date) taskQuery['resolution.completed_at'] = { $gte: start_date, $lte: end_date };
    } else if (view_mode === 'due_date') {
      if (start_date && end_date) taskQuery.due_date = { $gte: start_date, $lte: end_date };
    } else {
      if (start_date && end_date) taskQuery.created_at = { $gte: start_date, $lte: end_date };
    }

    // SCALABILITY REFACTOR: Database-level aggregation
    const taskStats = await Task.aggregate([
      { $match: taskQuery },
      {
        $group: {
          _id: "$assigned_to",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "in_progress"] }, { $gte: ["$due_date", now] }] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "pending"] }, { $gte: ["$due_date", now] }] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "completed"] }, { $lt: ["$due_date", now] }] }, 1, 0] } }
        }
      }
    ]);

    const statsMap = new Map(taskStats.map(s => [s._id, s]));

    let scopedUsers;
    if (role === 'manager') {
      const assigneeIds = Array.from(statsMap.keys());
      scopedUsers = await User.find({ $or: [{ department }, { id: { $in: assigneeIds } }] }).select('id name department').lean();
    } else if (role === 'member') {
      const assigneeIds = Array.from(statsMap.keys());
      if (!assigneeIds.includes(id)) assigneeIds.push(id);
      scopedUsers = await User.find({ id: { $in: assigneeIds } }).select('id name department').lean();
    } else {
      scopedUsers = await User.find({}).select('id name department').lean();
    }

    const employee_data = scopedUsers.map(u => {
      const stats = statsMap.get(u.id) || { total: 0, completed: 0, in_progress: 0, pending: 0, overdue: 0 };
      return {
        name: u.name,
        department: u.department || 'General',
        total: stats.total,
        completed: stats.completed,
        overdue: stats.overdue,
        in_progress: stats.in_progress,
        pending: stats.pending,
        on_time_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 100
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
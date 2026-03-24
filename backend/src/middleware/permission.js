/**
 * Core RBAC Logic for Atlas Dashboard
 * * IMPORTANT: For these functions to work correctly, the `task` object passed in
 * MUST have the `assignee` field populated with at least the `department` ID.
 * Example: task.assignee.department
 */

// Helper to safely check Object ID equality
const isSame = (id1, id2) => String(id1) === String(id2);

/**
 * VISIBILITY (Rules 1, 4)
 * Determines if a user can even fetch or see this task.
 */
const canViewTask = (user, task) => {
  if (user.role === 'Admin') return true;

  const isCreator = isSame(task.createdBy, user._id);
  const isAssignee = isSame(task.assignee?._id || task.assignee, user._id);

  if (user.role === 'Manager') {
    const isAssigneeInDept = isSame(task.assignee?.department, user.department);
    // Managers see tasks they are assigned to, tasks in their dept, and tasks they created.
    return isAssignee || isAssigneeInDept || isCreator;
  }

  if (user.role === 'Member') {
    // Members only see tasks they created or are assigned to.
    return isAssignee || isCreator;
  }

  return false;
};

/**
 * EDITING (Rules 1, 5, 12)
 * Determines if a user can edit title, description, priority, due date, etc.
 */
const canEditTask = (user, task) => {
  if (user.role === 'Admin') return true;

  // Rule 5: Once a task is completed, ONLY an Admin can edit it.
  if (task.isCompleted) return false;

  if (user.role === 'Manager') {
    // Rule 12: Manager authority is strictly bounded by the assignee's department.
    // Even if they created it, if they assigned it outside their dept, they lose edit rights.
    return isSame(task.assignee?.department, user.department);
  }

  if (user.role === 'Member') {
    // Members can only edit tasks they created.
    return isSame(task.createdBy, user._id);
  }

  return false;
};

/**
 * STATUS CHANGES (Rules 1, 5)
 * Pending <-> In Progress
 */
const canChangeTaskStatus = (user, task) => {
  if (user.role === 'Admin') return true;
  if (task.isCompleted) return false; // Must use completion endpoint

  const isCreator = isSame(task.createdBy, user._id);
  const isAssignee = isSame(task.assignee?._id || task.assignee, user._id);

  if (user.role === 'Manager') {
    const isAssigneeInDept = isSame(task.assignee?.department, user.department);
    // Rule 1: Can change status if assignee is in dept, OR if they are the assignee themselves.
    return isAssigneeInDept || isAssignee;
  }

  if (user.role === 'Member') {
    return isCreator || isAssignee;
  }

  return false;
};

/**
 * COMPLETING (Rule 5, 12)
 * Stricter rules than general status changes.
 */
const canCompleteTask = (user, task) => {
  if (user.role === 'Admin') return true;
  if (task.isCompleted) return false;

  const isCreator = isSame(task.createdBy, user._id);
  const isAssignee = isSame(task.assignee?._id || task.assignee, user._id);

  if (user.role === 'Manager') {
    const isAssigneeInDept = isSame(task.assignee?.department, user.department);
    // Manager must be the creator OR assignee, AND the task must still reside in their department scope.
    return isAssigneeInDept && (isCreator || isAssignee);
  }

  if (user.role === 'Member') {
    return isCreator || isAssignee;
  }

  return false;
};

/**
 * DELETING (Rule 5)
 */
const canDeleteTask = (user) => {
  // Only Admins can delete tasks.
  return user.role === 'Admin';
};

/**
 * RECURRENCE SETTINGS (Rule 5)
 */
const canModifyRecurrence = (user, task) => {
  if (user.role === 'Admin') return true;

  const isCreator = isSame(task.createdBy, user._id);

  if (user.role === 'Manager') {
    const isAssigneeInDept = isSame(task.assignee?.department, user.department);
    // Must be the creator AND the task must be in their department.
    return isCreator && isAssigneeInDept;
  }

  if (user.role === 'Member') {
    return isCreator;
  }

  return false;
};

/**
 * SYSTEM / GLOBAL CONFIG (Rules 2, 3, 9, 10, 11)
 */
const isSystemAdmin = (user) => {
  return user.role === 'Admin';
};

module.exports = {
  canViewTask,
  canEditTask,
  canChangeTaskStatus,
  canCompleteTask,
  canDeleteTask,
  canModifyRecurrence,
  isSystemAdmin
};
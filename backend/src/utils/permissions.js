/**
 * Backend RBAC Permission Helpers
 *
 * All functions are synchronous. Controllers are responsible for pre-fetching
 * the assignee User document when needed (manager dept checks require it).
 *
 * Rule summary (from RBAC documentation):
 *  - Admin        : unrestricted on everything
 *  - Manager      : visibility = assignee in dept | created by self | assigned to self
 *                   edit/delete = assignee.dept === manager.dept  (creator alone is NOT enough)
 *                   status change = assignee in dept | is assignee | is creator
 *                   complete = is creator | is assignee
 *                   recurrence modify = is CREATOR only (Section 5)
 *  - Member       : visibility = assigned to | created by
 *                   edit = created by only
 *                   status change = created by | assigned to
 *                   complete = created by | assigned to
 *                   recurrence modify = is CREATOR only
 */

const eq = (a, b) => String(a) === String(b);

// ─── canViewTask ──────────────────────────────────────────────────────────────
/**
 * @param {Object} user     - req.user { id, role, department }
 * @param {Object} task     - Task doc { assigned_to, assigned_by, ... }
 * @param {Object|null} assigneeUser - User doc for task.assigned_to (needed for manager dept check)
 */
export const canViewTask = (user, task, assigneeUser = null) => {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;

  const isCreator = eq(task.assigned_by, user.id);
  const isAssignee = eq(task.assigned_to, user.id);

  if (user.role === 'manager') {
    const assigneeDept = assigneeUser?.department ?? null;
    const isAssigneeInDept = assigneeDept !== null && assigneeDept === user.department;
    return isAssignee || isAssigneeInDept || isCreator;
  }

  if (user.role === 'member') {
    return isAssignee || isCreator;
  }

  return false;
};

// ─── canEditTask ──────────────────────────────────────────────────────────────
/**
 * Manager: only when assignee's dept === manager's dept.
 * Being the creator alone is NOT sufficient (per RBAC docs).
 * Member: creator only.
 */
export const canEditTask = (user, task, assigneeUser = null) => {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;
  if (task.status === 'completed') return false;

  if (user.role === 'manager') {
    const assigneeDept = assigneeUser?.department ?? null;
    return assigneeDept !== null && assigneeDept === user.department;
  }

  if (user.role === 'member') {
    return eq(task.assigned_by, user.id); // creator only
  }

  return false;
};

// ─── canChangeTaskStatus ──────────────────────────────────────────────────────
/**
 * Manager: assignee in dept OR is assignee OR is creator.
 * Member: creator OR assignee.
 */
export const canChangeTaskStatus = (user, task, assigneeUser = null) => {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;
  if (task.status === 'completed') return false;

  const isCreator = eq(task.assigned_by, user.id);
  const isAssignee = eq(task.assigned_to, user.id);

  if (user.role === 'manager') {
    const assigneeDept = assigneeUser?.department ?? null;
    const isAssigneeInDept = assigneeDept !== null && assigneeDept === user.department;
    return isAssigneeInDept || isAssignee || isCreator;
  }

  if (user.role === 'member') {
    return isCreator || isAssignee;
  }

  return false;
};

// ─── canCompleteTask ──────────────────────────────────────────────────────────
/**
 * All non-admin: must be creator OR assignee.
 */
export const canCompleteTask = (user, task) => {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;
  if (task.status === 'completed') return false;

  return eq(task.assigned_by, user.id) || eq(task.assigned_to, user.id);
};

// ─── canDeleteTask ────────────────────────────────────────────────────────────
/**
 * Admin ONLY — per updated RBAC rules. Managers and Members cannot delete tasks.
 */
export const canDeleteTask = (user) => {
  if (!user) return false;
  return user.role === 'admin';
};

// ─── canModifyRecurrence ──────────────────────────────────────────────────────
/**
 * Per RBAC Section 5: "both Managers and Members can only modify recurrence
 * if they are the CREATOR of the task."
 * Department scope does NOT apply here — creator only.
 */
export const canModifyRecurrence = (user, task) => {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;
  return eq(task.assigned_by, user.id);
};

// ─── canUploadAttachment ──────────────────────────────────────────────────────
/**
 * Any user who can VIEW the task can upload attachments IF the task is active.
 * Completed tasks: admin only.
 */
export const canUploadAttachment = (user, task, assigneeUser = null) => {
  if (!user || !task) return false;
  if (user.role === 'admin') return true;
  if (task.status === 'completed') return false; // non-admins blocked on completed tasks
  return canViewTask(user, task, assigneeUser);
};

// ─── canDeleteAttachment ─────────────────────────────────────────────────────
/**
 * Uploader or Admin.
 */
export const canDeleteAttachment = (user, attachment) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return eq(attachment?.uploaded_by, user.id);
};

// ─── isSystemAdmin ────────────────────────────────────────────────────────────
export const isSystemAdmin = (user) => {
  if (!user) return false;
  return user.role === 'admin';
};
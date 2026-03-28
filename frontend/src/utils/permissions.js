/**
 * Frontend RBAC Permission Helpers
 *
 * Mirror of the backend permissions with one key difference:
 * task.assigned_to on the frontend may be a populated object ({ id, name, department })
 * or a bare string ID. resolveAssigneeDept() handles both by falling back to allUsers[].
 *
 * Always pass the `users` array (loaded from /api/users) as the third argument
 * to functions that need department lookups (canEditTask, canChangeTaskStatus, etc.).
 *
 * Rule summary:
 *  Admin        → unrestricted
 *  Manager      → visibility: dept assignees | created by self | assigned to self
 *                 edit: assignee.dept === manager.dept ONLY
 *                 status: assignee in dept | is assignee | is creator
 *                 complete: is creator | is assignee
 *                 recurrence: is creator ONLY (Section 5)
 *  Member       → visibility: assigned to | created by
 *                 edit: created by only
 *                 status: created by | assigned to
 *                 complete: created by | assigned to
 *                 recurrence: is creator only
 */

const eq = (a, b) => String(a) === String(b);
const role = (user) => user?.role?.toLowerCase?.() ?? '';

// ─── Assignee resolution helpers ─────────────────────────────────────────────
// task.assigned_to can be: a populated object, or a bare string ID.

const resolveAssigneeId = (task) => {
  const at = task?.assigned_to;
  if (!at) return null;
  if (typeof at === 'object') return at._id ?? at.id ?? null;
  return at;
};

const resolveAssigneeDept = (task, allUsers = []) => {
  const at = task?.assigned_to;
  if (!at) return null;

  // Already populated with department
  if (typeof at === 'object' && at.department) return at.department;

  // Bare ID — look up in the users array
  const id = typeof at === 'object' ? (at._id ?? at.id) : at;
  const found = allUsers.find(u => eq(u.id, id) || eq(u._id, id));
  return found?.department ?? null;
};

// ─── canViewTask ──────────────────────────────────────────────────────────────
export const canViewTask = (user, task, allUsers = []) => {
  if (!user || !task) return false;
  if (role(user) === 'admin') return true;

  const isCreator = eq(task.assigned_by, user.id);
  const isAssignee = eq(resolveAssigneeId(task), user.id);

  if (role(user) === 'manager') {
    const dept = resolveAssigneeDept(task, allUsers);
    const inDept = dept !== null && eq(dept, user.department);
    return isAssignee || inDept || isCreator;
  }

  if (role(user) === 'member') {
    return isAssignee || isCreator;
  }

  return false;
};

// ─── canEditTask ──────────────────────────────────────────────────────────────
// Manager: assignee's dept must match — creator alone is NOT enough.
// Member:  creator only (NOT assignee).
export const canEditTask = (user, task, allUsers = []) => {
  if (!user || !task) return false;
  if (role(user) === 'admin') return true;
  if (task.status === 'completed') return false;

  if (role(user) === 'manager') {
    const dept = resolveAssigneeDept(task, allUsers);
    return dept !== null && eq(dept, user.department);
  }

  if (role(user) === 'member') {
    return eq(task.assigned_by, user.id); // creator only
  }

  return false;
};

// ─── canChangeTaskStatus ──────────────────────────────────────────────────────
// Manager: assignee in dept | is assignee | is creator.
// Member:  creator | assignee.
export const canChangeTaskStatus = (user, task, allUsers = []) => {
  if (!user || !task) return false;
  if (role(user) === 'admin') return true;
  if (task.status === 'completed') return false;

  const isCreator = eq(task.assigned_by, user.id);
  const isAssignee = eq(resolveAssigneeId(task), user.id);

  if (role(user) === 'manager') {
    const dept = resolveAssigneeDept(task, allUsers);
    const inDept = dept !== null && eq(dept, user.department);
    return inDept || isAssignee || isCreator;
  }

  if (role(user) === 'member') {
    return isCreator || isAssignee;
  }

  return false;
};

// ─── canCompleteTask ──────────────────────────────────────────────────────────
// All non-admin: must be creator OR assignee (no dept check needed).
export const canCompleteTask = (user, task) => {
  if (!user || !task) return false;
  if (role(user) === 'admin') return true;
  if (task.status === 'completed') return false;

  const isCreator = eq(task.assigned_by, user.id);
  const isAssignee = eq(resolveAssigneeId(task), user.id);
  return isCreator || isAssignee;
};

// ─── canDeleteTask ────────────────────────────────────────────────────────────
// Admin ONLY — Managers and Members cannot delete tasks.
export const canDeleteTask = (user) => {
  if (!user) return false;
  return role(user) === 'admin';
};

// ─── canModifyRecurrence ──────────────────────────────────────────────────────
// Per RBAC Section 5: both Manager and Member = creator only.
// Department scope does NOT apply here.
export const canModifyRecurrence = (user, task) => {
  if (!user || !task) return false;
  if (role(user) === 'admin') return true;
  return eq(task.assigned_by, user.id); // creator only for all non-admin
};

// ─── canModifyNotifications ───────────────────────────────────────────────────
// Admin: all. Manager: creator | assignee in dept. Member: creator only.
export const canModifyNotifications = (user, task, allUsers = []) => {
  if (!user || !task) return false;
  if (role(user) === 'admin') return true;
  if (task.status === 'completed') return false;

  const isCreator = eq(task.assigned_by, user.id);

  if (role(user) === 'manager') {
    const dept = resolveAssigneeDept(task, allUsers);
    const inDept = dept !== null && eq(dept, user.department);
    return isCreator || inDept;
  }

  if (role(user) === 'member') {
    return isCreator;
  }

  return false;
};

// ─── canUploadAttachment ──────────────────────────────────────────────────────
// Active task: any viewer. Completed task: admin only.
export const canUploadAttachment = (user, task) => {
  if (!user || !task) return false;
  if (role(user) === 'admin') return true;
  return task.status !== 'completed'; // non-admins blocked on completed
};

// ─── canDeleteAttachment ─────────────────────────────────────────────────────
// Uploader or Admin.
export const canDeleteAttachment = (user, attachment) => {
  if (!user) return false;
  if (role(user) === 'admin') return true;
  return eq(attachment?.uploaded_by, user.id);
};

// ─── Utility aliases ─────────────────────────────────────────────────────────
export const isAdmin = (user) => role(user) === 'admin';
export const isSystemAdmin = isAdmin; // backwards-compat alias used by NotificationSettings
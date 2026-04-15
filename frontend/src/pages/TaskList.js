import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios'; // STAFF FIX: Added for axios.isCancel check
import {
  Plus, Edit, Trash2, Bell, BellOff, AlertCircle, Info,
  Repeat, Calendar, Upload, Paperclip, Check, Lock, Eye,
  Search, X, SlidersHorizontal, ArrowUpDown, User, Save,
  ChevronDown, Clock, Flag, Filter
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { api } from '../App';
import { toast } from 'sonner';
import { localDateTimeToUTC, utcToLocalDateTimeInput, formatUTCToLocalDateTime, getRelativeTime, isOverdue } from '../utils/timezone';
import {
  canEditTask,
  canDeleteTask,
  canChangeTaskStatus,
  canCompleteTask,
  canModifyRecurrence,
  canModifyNotifications,
} from '../utils/permissions';

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKDAYS = [
  { value: 0, label: 'Mon' }, { value: 1, label: 'Tue' }, { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' }, { value: 4, label: 'Fri' }, { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' }
];

// UX UPGRADE: Synced perfectly with DailySchedule.js traffic light colors
const PRIORITY_CONFIG = {
  high: { label: 'High', border: 'border-l-red-500', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  medium: { label: 'Medium', border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  low: { label: 'Low', border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  completed: { label: 'Completed', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  delayed: { label: 'Overdue', badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonTask = () => (
  <div className="animate-pulse flex gap-4 p-5 rounded-xl border border-border/50 bg-card border-l-4 border-l-muted">
    <div className="flex-1 space-y-3">
      <div className="flex gap-2 items-center">
        <div className="h-4 bg-muted rounded w-48" />
        <div className="h-5 bg-muted rounded-full w-16" />
        <div className="h-5 bg-muted rounded-full w-20" />
      </div>
      <div className="h-3 bg-muted rounded w-3/4" />
      <div className="flex gap-4">
        <div className="h-3 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-28" />
      </div>
    </div>
    <div className="flex gap-2 items-center">
      <div className="h-8 bg-muted rounded w-28" />
      <div className="h-8 w-8 bg-muted rounded" />
      <div className="h-8 w-8 bg-muted rounded" />
    </div>
  </div>
);

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, user, users, onEdit, onDelete, onStatusChange, onEditRecurrence, onView }) {
  const assignedUser = users.find(u => u.id === (task.assigned_to?.id || task.assigned_to));
  const isCompleted = task.status === 'completed';
  const taskIsOverdue = isOverdue(task.due_date) && !isCompleted;

  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const statusCfg = STATUS_CONFIG[taskIsOverdue ? 'delayed' : task.status] || STATUS_CONFIG.pending;

  const canEdit = canEditTask(user, task, users);
  const canDelete = canDeleteTask(user);
  const canStatus = canChangeTaskStatus(user, task, users);
  const canComplete = canCompleteTask(user, task);
  const canRecurrence = canModifyRecurrence(user, task);

  const isRecurring = task.recurrence?.enabled && !task.recurrence?.parent_task_id;
  const isGeneratedInstance = !!task.recurrence?.parent_task_id;

  const getRecurrenceLabel = (recurrence) => {
    if (!recurrence?.enabled) return null;
    const interval = recurrence.interval || 1;
    if (interval === 1) return recurrence.frequency.charAt(0).toUpperCase() + recurrence.frequency.slice(1);
    return `Every ${interval} ${recurrence.frequency === 'daily' ? 'days' : recurrence.frequency === 'weekly' ? 'weeks' : 'months'}`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }} data-testid={`task-item-${task.id}`}>
      <Card className={`group relative p-0 overflow-hidden transition-all duration-200 border-l-4 ${priorityCfg.border} hover:shadow-md hover:-translate-y-0.5 ${taskIsOverdue ? 'bg-red-50/30 dark:bg-red-500/5' : ''} ${isCompleted ? 'opacity-75' : ''}`}>
        <div className="p-4 sm:p-5">
          {/* UX UPGRADE: Mobile-first wrapping for action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0 space-y-2.5 w-full">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-base font-semibold leading-tight ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {task.title}
                </h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityCfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                  {priorityCfg.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.badge}`}>
                  {statusCfg.label}
                </span>
                {isRecurring && (
                  <Badge variant="outline" className="border-blue-400/50 text-blue-600 dark:text-blue-400 text-xs">
                    <Repeat className="h-3 w-3 mr-1" />{getRecurrenceLabel(task.recurrence)}
                  </Badge>
                )}
                {isGeneratedInstance && (
                  <Badge variant="outline" className="border-violet-400/50 text-violet-600 dark:text-violet-400 text-xs">
                    <Calendar className="h-3 w-3 mr-1" />Auto-generated
                  </Badge>
                )}
                {task.notifications?.enabled && (
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                    <Bell className="h-3 w-3 mr-1" />Custom Alerts
                  </Badge>
                )}
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground/80">{assignedUser?.name || 'Unassigned'}</span>
                </span>
                <span className={`flex items-center gap-1.5 ${taskIsOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {formatUTCToLocalDateTime(task.due_date)}
                  {!isCompleted && <span>({getRelativeTime(task.due_date)})</span>}
                </span>
                {taskIsOverdue && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />Overdue
                  </span>
                )}
              </div>
            </div>

            {/* UX UPGRADE: Actions drop down cleanly on small screens */}
            <div className="flex items-center flex-wrap gap-1.5 shrink-0 w-full sm:w-auto sm:justify-end border-t border-border/50 sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
              {!isCompleted && canStatus ? (
                <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v)}>
                  <SelectTrigger className="h-8 w-full sm:w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    {canComplete && <SelectItem value="completed">Completed</SelectItem>}
                  </SelectContent>
                </Select>
              ) : isCompleted ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-xs h-8 px-2.5 w-full sm:w-auto justify-center">
                  <Lock className="h-3 w-3 mr-1" />Read-only
                </Badge>
              ) : null}

              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onView(task.id)} title="View details">
                <Eye className="h-3.5 w-3.5" />
              </Button>

              {canEdit && !isCompleted && (
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit(task)} title="Edit task">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              )}

              {canRecurrence && isCompleted && isRecurring && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onEditRecurrence(task)}>
                  <Repeat className="h-3.5 w-3.5 mr-1" />Recurrence
                </Button>
              )}

              {canDelete && (
                <Button variant="outline" size="icon"
                  className="h-8 w-8 text-destructive/60 hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
                  onClick={() => onDelete(task.id)} title="Delete task">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {isCompleted && task.resolution && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 block mb-0.5">Resolution</span>
                  <p className="text-xs text-muted-foreground line-clamp-2">{task.resolution.text}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onClear }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Flag className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        {hasFilters ? 'No tasks match your filters' : 'No work items yet'}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        {hasFilters ? 'Try adjusting or clearing your filters.' : 'Create your first work item to get started.'}
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1.5" />Clear all filters
        </Button>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TaskList({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const dueDateRef = useRef(null);

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [globalNotificationSettings, setGlobalNotificationSettings] = useState(null);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showRecurrenceSettings, setShowRecurrenceSettings] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completingTask, setCompletingTask] = useState(null);
  const [completionData, setCompletionData] = useState({ resolution_text: '', attachment_ids: [], pendingFiles: [], uploading: false });

  const [recurrenceEditModalOpen, setRecurrenceEditModalOpen] = useState(false);
  const [editingRecurrenceTask, setEditingRecurrenceTask] = useState(null);
  const [recurrenceEditForm, setRecurrenceEditForm] = useState({
    frequency: 'daily', interval: 1, due_in_days: 1, days_of_week: [],
    end_date: '', max_occurrences: null,
    recurrence_override: { enabled: false, avoid_weekends: 'none', avoid_holidays: false }
  });
  const [savingRecurrence, setSavingRecurrence] = useState(false);
  const [recurrenceFormErrors, setRecurrenceFormErrors] = useState({});

  // Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterAssignedBy, setFilterAssignedBy] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [parentRecurringOnly, setParentRecurringOnly] = useState(false);
  const [sortOption, setSortOption] = useState('created_at_desc');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, total_pages: 0 });

  const [formData, setFormData] = useState({
    title: '', description: '', priority: 'medium', assigned_to: '', due_date: '',
    notifications: {
      enabled: false, deadline_alerts: [],
      reminder_digests: { start_of_day: true, end_of_day: true },
      overdue_escalation: { enabled: true, notify_creator: true, notify_admin: false }
    },
    recurrence: { enabled: false, frequency: 'daily', interval: 1, days_of_week: [], end_date: '', max_occurrences: null, due_in_days: 1 },
    recurrence_override: { enabled: false, avoid_weekends: 'none', avoid_holidays: false }
  });

  const [globalRecurrenceSettings, setGlobalRecurrenceSettings] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const assignedToParam = params.get('assigned_to');
    const departmentParam = params.get('department');

    let filtersTriggered = false;

    if (statusParam) setFilterStatus(statusParam);

    if (assignedToParam) {
      setFilterAssignedTo(assignedToParam);
      filtersTriggered = true;
    }

    if (departmentParam) {
      setFilterDepartment(departmentParam);
      filtersTriggered = true;
    }

    if (filtersTriggered) setShowAdvancedFilters(true);

    loadUsers();
    loadGlobalRecurrenceSettings();
    loadGlobalNotificationSettings();
  }, [location]);

  // STAFF FIX: Memoize loadTasks to satisfy ESLint and prevent Race Conditions with AbortController
  const loadTasks = useCallback(async (signal) => {
    try {
      setLoading(true);
      const params = { page: pagination.page, limit: pagination.limit, sort: sortOption };
      if (myTasksOnly) params.my_tasks = 'true';
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedStatuses.length > 0) params.statuses = selectedStatuses.join(',');
      else if (filterStatus !== 'all' && filterStatus !== 'delayed') params.status = filterStatus;
      if (selectedPriorities.length > 0) params.priorities = selectedPriorities.join(',');

      if (dueDateFrom) params.due_from = new Date(dueDateFrom).toISOString();
      if (dueDateTo) params.due_to = new Date(dueDateTo).toISOString();
      if (createdFrom) params.created_from = new Date(createdFrom).toISOString();
      if (createdTo) params.created_to = new Date(createdTo).toISOString();

      if (filterAssignedTo) params.assigned_to = filterAssignedTo;
      if (filterAssignedBy) params.assigned_by = filterAssignedBy;
      if (filterDepartment) params.department = filterDepartment;
      if (overdueOnly || filterStatus === 'delayed') params.overdue = 'true';
      if (parentRecurringOnly) params.parent_recurring_only = 'true';

      const response = await api.get('/tasks', { params, signal });
      if (response.data.tasks) {
        setTasks(response.data.tasks);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      } else {
        setTasks(response.data);
      }
      setLoading(false);
    } catch (error) {
      if (!axios.isCancel(error)) {
        toast.error('Failed to load tasks');
        setLoading(false);
      }
    }
  }, [
    pagination.page, pagination.limit, sortOption, myTasksOnly, searchQuery,
    selectedStatuses, filterStatus, selectedPriorities, dueDateFrom, dueDateTo,
    createdFrom, createdTo, filterAssignedTo, filterAssignedBy, filterDepartment,
    overdueOnly, parentRecurringOnly
  ]);

  // STAFF FIX: Use AbortController on every filter change dependency
  useEffect(() => {
    const controller = new AbortController();
    loadTasks(controller.signal);
    return () => controller.abort();
  }, [loadTasks]);

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch { toast.error('Failed to load users'); }
  };

  const loadGlobalNotificationSettings = async () => {
    try {
      const { data } = await api.get('/notification-settings/defaults');
      setGlobalNotificationSettings(data);
    } catch { /* silent */ }
  };

  const loadGlobalRecurrenceSettings = async () => {
    try {
      const { data } = await api.get('/recurrence-settings');
      setGlobalRecurrenceSettings(data);
    } catch { /* silent */ }
  };

  const validateDeadlineAlerts = () => {
    const alerts = formData.notifications.deadline_alerts;
    for (let i = 0; i < alerts.length; i++) {
      const hours = alerts[i].hours_before;
      if (hours === '' || hours === null || hours === undefined) {
        return `Deadline alert ${i + 1}: Hours value is required`;
      }
      const numValue = parseInt(hours);
      if (isNaN(numValue) || numValue < 1) {
        return `Deadline alert ${i + 1}: Hours must be at least 1`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.assigned_to || !formData.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.notifications.enabled) {
      const alertError = validateDeadlineAlerts();
      if (alertError) {
        toast.error(alertError);
        return;
      }
    }

    try {
      const utcDueDate = localDateTimeToUTC(formData.due_date);
      const payload = {
        title: formData.title, description: formData.description,
        priority: formData.priority, assigned_to: formData.assigned_to, due_date: utcDueDate
      };

      if (formData.notifications.enabled) {
        payload.notifications = {
          ...formData.notifications,
          deadline_alerts: formData.notifications.deadline_alerts.map(a => ({ ...a, hours_before: parseInt(a.hours_before) || 24 }))
        };
      }

      if (formData.recurrence.enabled) {
        if (formData.recurrence.due_in_days < 1) {
          toast.error('Number of days must be at least 1');
          return;
        }
        if (formData.recurrence.interval < 1) {
          toast.error('Number of days/months must be at least 1');
          return;
        }

        const rec = { ...formData.recurrence };
        if (!rec.end_date) delete rec.end_date;
        if (!rec.max_occurrences) delete rec.max_occurrences;
        if (rec.frequency !== 'weekly') delete rec.days_of_week;
        payload.recurrence = rec;
        payload.is_recurring = true;
        if (formData.recurrence_override.enabled) payload.recurrence_override = formData.recurrence_override;
      }

      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, payload);
        toast.success('Task updated successfully');
      } else {
        await api.post('/tasks', payload);
        toast.success('Task created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      loadTasks(); // Manual refresh triggers safely without abort signal
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save task');
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assigned_to: task.assigned_to?.id || task.assigned_to,
      due_date: utcToLocalDateTimeInput(task.due_date),
      notifications: task.notifications?.enabled ? task.notifications : {
        enabled: false, deadline_alerts: [],
        reminder_digests: { start_of_day: true, end_of_day: true },
        overdue_escalation: { enabled: true, notify_creator: true, notify_admin: false }
      },
      recurrence: task.recurrence?.enabled ? {
        ...task.recurrence,
        end_date: task.recurrence.end_date ? task.recurrence.end_date.split('T')[0] : ''
      } : { enabled: false, frequency: 'daily', interval: 1, days_of_week: [], end_date: '', max_occurrences: null, due_in_days: 1 },
      recurrence_override: task.recurrence_override?.enabled ? task.recurrence_override
        : { enabled: false, avoid_weekends: 'none', avoid_holidays: false }
    });
    setShowNotificationSettings(task.notifications?.enabled || false);
    setShowRecurrenceSettings(task.recurrence?.enabled || false);
    setIsDialogOpen(true);
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted successfully');
      loadTasks();
    } catch (error) {
      if (error.response?.status === 403) toast.error('Forbidden: Only admins can delete tasks');
      else toast.error('Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    if (newStatus === 'completed') {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setCompletingTask(task);
        setCompletionData({ resolution_text: '', attachment_ids: [], pendingFiles: [], uploading: false });
        setCompletionModalOpen(true);
      }
      return;
    }
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      toast.success('Task status updated');
      loadTasks();
    } catch (error) {
      if (error.response?.status === 403) toast.error('Forbidden: You cannot change this task\'s status');
      else toast.error('Failed to update status');
    }
  };

  const handleCompletionFilesSelected = (files) => {
    const newFiles = Array.from(files).map(file => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file, name: file.name, size: file.size
    }));
    setCompletionData(prev => ({ ...prev, pendingFiles: [...prev.pendingFiles, ...newFiles] }));
  };

  const removeCompletionPendingFile = (fileId) => {
    setCompletionData(prev => ({ ...prev, pendingFiles: prev.pendingFiles.filter(f => f.id !== fileId) }));
  };

  const handleUploadCompletionFiles = async (taskId) => {
    if (!completionData.pendingFiles.length) return;
    const fd = new FormData();
    completionData.pendingFiles.forEach(pf => fd.append('files', pf.file));
    try {
      setCompletionData(prev => ({ ...prev, uploading: true }));
      const { data } = await api.post(`/tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { uploaded, errors, total_uploaded, total_failed } = data;
      if (total_uploaded > 0) {
        setCompletionData(prev => ({ ...prev, attachment_ids: [...prev.attachment_ids, ...uploaded.map(a => a.id)], pendingFiles: [], uploading: false }));
        toast.success(`${total_uploaded} file(s) uploaded`);
      }
      if (total_failed > 0) { errors.forEach(e => toast.error(`${e.filename}: ${e.error}`)); setCompletionData(prev => ({ ...prev, uploading: false })); }
    } catch (error) {
      setCompletionData(prev => ({ ...prev, uploading: false }));
      toast.error(error.response?.data?.message || 'Failed to upload files');
    }
  };

  const handleCompleteTask = async () => {
    if (!completingTask) return;
    if (!completionData.resolution_text.trim()) { toast.error('Resolution text is required'); return; }
    if (!completionData.attachment_ids.length) { toast.error('At least one attachment is required'); return; }
    try {
      await api.post(`/tasks/${completingTask.id}/complete`, {
        resolution_text: completionData.resolution_text,
        attachment_ids: completionData.attachment_ids
      });
      toast.success('Work item completed');
      setCompletionModalOpen(false);
      setCompletingTask(null);
      loadTasks();
    } catch (error) {
      if (error.response?.status === 403) toast.error('Forbidden: Only the creator or assignee can complete this task');
      else toast.error(error.response?.data?.message || 'Failed to complete task');
    }
  };

  const openRecurrenceEditModal = (task) => {
    const recurrence = task.recurrence || {};
    const override = task.recurrence_override || {};
    setEditingRecurrenceTask(task);
    setRecurrenceEditForm({
      frequency: recurrence.frequency || 'daily', interval: recurrence.interval || 1,
      due_in_days: recurrence.due_in_days || 1, days_of_week: recurrence.days_of_week || [],
      end_date: recurrence.end_date ? recurrence.end_date.split('T')[0] : '',
      max_occurrences: recurrence.max_occurrences || null,
      recurrence_override: {
        enabled: override.enabled || false,
        avoid_weekends: override.avoid_weekends || globalRecurrenceSettings?.avoid_weekends || 'none',
        avoid_holidays: override.avoid_holidays ?? globalRecurrenceSettings?.avoid_holidays ?? false
      }
    });
    setRecurrenceFormErrors({});
    setRecurrenceEditModalOpen(true);
  };

  const handleSaveRecurrenceEdit = async () => {
    if (!editingRecurrenceTask) return;
    const errors = {};
    if (recurrenceEditForm.interval < 1) errors.interval = 'Must be at least 1';
    if (recurrenceEditForm.due_in_days < 1) errors.due_in_days = 'Must be at least 1';
    setRecurrenceFormErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingRecurrence(true);
    try {
      const payload = {
        recurrence: {
          ...editingRecurrenceTask.recurrence,
          frequency: recurrenceEditForm.frequency, interval: recurrenceEditForm.interval,
          due_in_days: recurrenceEditForm.due_in_days,
          days_of_week: recurrenceEditForm.frequency === 'weekly' ? recurrenceEditForm.days_of_week : [],
          end_date: recurrenceEditForm.end_date || undefined,
          max_occurrences: recurrenceEditForm.max_occurrences || undefined
        },
        recurrence_override: recurrenceEditForm.recurrence_override
      };
      await api.put(`/tasks/${editingRecurrenceTask.id}`, payload);
      toast.success('Recurrence settings updated. Changes affect future instances only.');
      setRecurrenceEditModalOpen(false);
      loadTasks();
    } catch (error) {
      if (error.response?.status === 403) toast.error('Forbidden: Only the task creator or admin can modify recurrence');
      else toast.error(error.response?.data?.message || 'Failed to update recurrence');
    } finally { setSavingRecurrence(false); }
  };

  const handleRecurrenceToggle = (enabled) => {
    setFormData({ ...formData, recurrence: { ...formData.recurrence, enabled } });
    setShowRecurrenceSettings(enabled);
  };

  const toggleWeekday = (day) => {
    const currentDays = formData.recurrence.days_of_week || [];
    let newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);
    setFormData({ ...formData, recurrence: { ...formData.recurrence, days_of_week: newDays } });
  };

  const updateDeadlineAlert = (index, field, value) => {
    const newAlerts = [...formData.notifications.deadline_alerts];
    newAlerts[index] = { ...newAlerts[index], [field]: value };
    setFormData({ ...formData, notifications: { ...formData.notifications, deadline_alerts: newAlerts } });
  };

  const addDeadlineAlert = () => {
    setFormData({
      ...formData,
      notifications: {
        ...formData.notifications,
        deadline_alerts: [...formData.notifications.deadline_alerts, { hours_before: 24, enabled: true }]
      }
    });
  };

  const removeDeadlineAlert = (index) => {
    const newAlerts = formData.notifications.deadline_alerts.filter((_, i) => i !== index);
    setFormData({ ...formData, notifications: { ...formData.notifications, deadline_alerts: newAlerts } });
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', priority: 'medium', assigned_to: '', due_date: '',
      notifications: { enabled: false, deadline_alerts: [], reminder_digests: { start_of_day: true, end_of_day: true }, overdue_escalation: { enabled: true, notify_creator: true, notify_admin: false } },
      recurrence: { enabled: false, frequency: 'daily', interval: 1, days_of_week: [], end_date: '', max_occurrences: null, due_in_days: 1 },
      recurrence_override: { enabled: false, avoid_weekends: 'none', avoid_holidays: false }
    });
    setEditingTask(null);
    setShowNotificationSettings(false);
    setShowRecurrenceSettings(false);
  };

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setPagination(prev => ({ ...prev, page: 1 }));
    navigate(status === 'all' ? '/tasks' : `/tasks?status=${status}`);
  };

  const clearAllFilters = () => {
    setSearchInput(''); setSearchQuery('');
    setSelectedStatuses([]); setSelectedPriorities([]);
    setDueDateFrom(''); setDueDateTo('');
    setCreatedFrom(''); setCreatedTo('');
    setFilterAssignedTo(''); setFilterAssignedBy('');
    setOverdueOnly(false); setParentRecurringOnly(false); setMyTasksOnly(false);
    setFilterStatus('all'); setSortOption('created_at_desc');
    setFilterDepartment('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearchInputChange = (value) => {
    setSearchInput(value);
    if (value.length >= 3) { setSearchQuery(value); setPagination(prev => ({ ...prev, page: 1 })); }
    else if (value.length === 0) { setSearchQuery(''); setPagination(prev => ({ ...prev, page: 1 })); }
  };

  const toggleStatusFilter = (status) => {
    setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const togglePriorityFilter = (priority) => {
    setSelectedPriorities(prev => prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedStatuses.length) count++;
    if (selectedPriorities.length) count++;
    if (dueDateFrom || dueDateTo) count++;
    if (createdFrom || createdTo) count++;
    if (filterAssignedTo) count++;
    if (filterAssignedBy) count++;
    if (overdueOnly) count++;
    if (parentRecurringOnly) count++;
    return count;
  };

  const getActiveFilterChips = () => {
    const chips = [];
    if (myTasksOnly) chips.push({ key: 'myTasks', label: 'My Items', onRemove: () => setMyTasksOnly(false) });
    if (searchQuery) chips.push({ key: 'search', label: `"${searchQuery}"`, onRemove: () => { setSearchInput(''); setSearchQuery(''); } });
    selectedStatuses.forEach(s => chips.push({ key: `status-${s}`, label: `Status: ${s.replace('_', ' ')}`, onRemove: () => toggleStatusFilter(s) }));
    selectedPriorities.forEach(p => chips.push({ key: `priority-${p}`, label: `Priority: ${p}`, onRemove: () => togglePriorityFilter(p) }));
    if (dueDateFrom || dueDateTo) chips.push({ key: 'dueDate', label: 'Due date filter', onRemove: () => { setDueDateFrom(''); setDueDateTo(''); } });
    if (createdFrom || createdTo) chips.push({ key: 'createdDate', label: 'Created date filter', onRemove: () => { setCreatedFrom(''); setCreatedTo(''); } });
    if (filterAssignedTo) { const u = users.find(x => x.id === filterAssignedTo); chips.push({ key: 'assignedTo', label: `Owner: ${u?.name || 'Unknown'}`, onRemove: () => setFilterAssignedTo('') }); }
    if (filterAssignedBy) { const u = users.find(x => x.id === filterAssignedBy); chips.push({ key: 'assignedBy', label: `By: ${u?.name || 'Unknown'}`, onRemove: () => setFilterAssignedBy('') }); }
    if (overdueOnly) chips.push({ key: 'overdue', label: 'Overdue Only', onRemove: () => setOverdueOnly(false) });
    if (parentRecurringOnly) chips.push({ key: 'parentRecurring', label: 'Recurring Parents', onRemove: () => setParentRecurringOnly(false) });
    if (filterDepartment) {
      chips.push({ key: 'department', label: `Dept: ${filterDepartment}`, onRemove: () => setFilterDepartment('') });
    };
    return chips;
  };

  const handleNotificationToggle = (enabled) => {
    if (enabled && globalNotificationSettings) {
      setFormData({
        ...formData,
        notifications: {
          enabled: true,
          deadline_alerts: globalNotificationSettings.deadline_alerts || [],
          reminder_digests: {
            start_of_day: globalNotificationSettings.reminder_digests?.start_of_day?.enabled ?? true,
            end_of_day: globalNotificationSettings.reminder_digests?.end_of_day?.enabled ?? true
          },
          overdue_escalation: {
            enabled: globalNotificationSettings.overdue_alert?.enabled ?? true,
            notify_creator: globalNotificationSettings.overdue_alert?.notify_creator ?? true,
            notify_admin: globalNotificationSettings.overdue_alert?.notify_admin ?? false
          }
        }
      });
    } else {
      setFormData({ ...formData, notifications: { ...formData.notifications, enabled } });
    }
    setShowNotificationSettings(enabled);
  };

  const isTaskCreator = !editingTask || editingTask.assigned_by === user.id;
  const isChildTask = editingTask?.recurrence?.parent_task_id;
  const canEditRec = !editingTask ? true : canModifyRecurrence(user, editingTask);
  const canEditNotif = !editingTask ? true : canModifyNotifications(user, editingTask, users);

  const hasFilters = myTasksOnly || searchQuery || selectedStatuses.length > 0 || selectedPriorities.length > 0
    || dueDateFrom || dueDateTo || createdFrom || createdTo || filterAssignedTo || filterAssignedBy
    || overdueOnly || parentRecurringOnly || filterStatus !== 'all';

  const STATUS_TABS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'delayed', label: 'Overdue' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Work Items</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {loading ? 'Loading…' : `${pagination.total} total tasks`}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shrink-0">
              <Plus className="mr-2 h-4 w-4" /> Create Work Item
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTask ? "Edit Work Item" : "Create New Work Item"}</DialogTitle>
              <DialogDescription className="sr-only">Enter the details for the work item here.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label>Title *</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea value={formData.description} rows={3} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>

              {/* UX UPGRADE: Grid shifts to 1 column on very small screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Responsible Owner *</Label>
                  <Select value={formData.assigned_to} onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Due Date & Time *</Label>
                <div className="relative">
                  <Input ref={dueDateRef} type="datetime-local" value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="pr-10 cursor-pointer dark:scheme-dark dark:[&::-webkit-calendar-picker-indicator]:invert" />
                </div>
              </div>

              {/*Recurring Task Section */}
              {canEditRec && !isChildTask && (
                <div className="border-t pt-4 mt-4">
                  <div
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => handleRecurrenceToggle(!formData.recurrence.enabled)}
                  >
                    <div className="flex items-center gap-3">
                      <Repeat className={`h-5 w-5 ${formData.recurrence.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <Label className="text-sm font-medium cursor-pointer">Make this a Recurring Task</Label>
                        <p className="text-xs text-muted-foreground">
                          {formData.recurrence.enabled ? `Repeats ${formData.recurrence.frequency}` : 'Create automatic task instances on a schedule'}
                        </p>
                      </div>
                    </div>
                    <Switch checked={formData.recurrence.enabled} onCheckedChange={handleRecurrenceToggle} />
                  </div>

                  <AnimatePresence>
                    {showRecurrenceSettings && formData.recurrence.enabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-4 p-4 border rounded-lg bg-background space-y-4">
                          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              New task instances will be automatically created based on this schedule. Each instance is an independent task.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs">Frequency</Label>
                              <Select value={formData.recurrence.frequency} onValueChange={(v) => setFormData({ ...formData, recurrence: { ...formData.recurrence, frequency: v, days_of_week: [] } })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Every</Label>
                              <div className="flex items-center gap-2">
                                <Input type="number" min="1" value={formData.recurrence.interval}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setFormData({ ...formData, recurrence: { ...formData.recurrence, interval: value } });
                                  }}
                                  className={`w-20 ${formData.recurrence.interval < 1 ? 'border-red-500' : ''}`} />
                                <span className="text-xs text-muted-foreground">
                                  {formData.recurrence.frequency === 'daily' ? 'day(s)' : formData.recurrence.frequency === 'weekly' ? 'week(s)' : 'month(s)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {formData.recurrence.frequency === 'weekly' && (
                            <div>
                              <Label className="text-xs mb-2 block">Repeat on</Label>
                              <div className="flex gap-2 flex-wrap">
                                {WEEKDAYS.map((day) => (
                                  <button key={day.value} type="button" onClick={() => toggleWeekday(day.value)}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${formData.recurrence.days_of_week?.includes(day.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-secondary'}`}>
                                    {day.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs">End Date (optional)</Label>
                              <Input type="date" value={formData.recurrence.end_date} onChange={(e) => setFormData({ ...formData, recurrence: { ...formData.recurrence, end_date: e.target.value } })}
                                className="dark:scheme-dark dark:[&::-webkit-calendar-picker-indicator]:invert" />
                            </div>
                            <div>
                              <Label className="text-xs">Max Occurrences (optional)</Label>
                              <Input type="number" min="1" placeholder="No limit" value={formData.recurrence.max_occurrences || ''}
                                onChange={(e) => setFormData({ ...formData, recurrence: { ...formData.recurrence, max_occurrences: e.target.value ? parseInt(e.target.value) : null } })} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Due In (days from creation)</Label>
                            <Input type="number" min="1" value={formData.recurrence.due_in_days || 1}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, recurrence: { ...formData.recurrence, due_in_days: value } });
                              }}
                              className={`w-24 ${formData.recurrence.due_in_days < 1 ? 'border-red-500' : ''}`} />
                            <p className="text-xs text-muted-foreground">Child tasks will be due this many days after creation</p>
                          </div>

                          {/* Calendar Override Inside Form */}
                          <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <Label className="text-xs font-medium">Override Calendar Settings</Label>
                                <p className="text-[10px] text-muted-foreground">
                                  {formData.recurrence_override.enabled ? 'Using task-specific calendar settings' : 'Using global calendar settings'}
                                </p>
                              </div>
                              <Switch checked={formData.recurrence_override.enabled}
                                onCheckedChange={(checked) => setFormData({
                                  ...formData, recurrence_override: {
                                    ...formData.recurrence_override, enabled: checked,
                                    ...(checked && globalRecurrenceSettings ? { avoid_weekends: globalRecurrenceSettings.avoid_weekends, avoid_holidays: globalRecurrenceSettings.avoid_holidays } : {})
                                  }
                                })} />
                            </div>

                            {formData.recurrence_override.enabled && (
                              <div className="space-y-4 pl-2 border-l-2 border-primary/30">
                                <div>
                                  <Label className="text-xs">Weekend Avoidance</Label>
                                  <Select value={formData.recurrence_override.avoid_weekends} onValueChange={(value) => setFormData({ ...formData, recurrence_override: { ...formData.recurrence_override, avoid_weekends: value } })}>
                                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No weekend skip</SelectItem>
                                      <SelectItem value="sunday_only">Skip Sundays only</SelectItem>
                                      <SelectItem value="sat_sun">Skip Saturday & Sunday</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label className="text-xs">Avoid Holidays</Label>
                                  </div>
                                  <Switch checked={formData.recurrence_override.avoid_holidays}
                                    onCheckedChange={(checked) => setFormData({ ...formData, recurrence_override: { ...formData.recurrence_override, avoid_holidays: checked } })} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Notification Override Section */}
              {canEditNotif && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => handleNotificationToggle(!formData.notifications.enabled)}>
                    <div className="flex items-center gap-3">
                      {formData.notifications.enabled ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <Label className="text-sm font-medium cursor-pointer">Override Notification Settings</Label>
                        <p className="text-xs text-muted-foreground">{formData.notifications.enabled ? 'Using task-specific notification settings' : 'Using global notification settings'}</p>
                      </div>
                    </div>
                    <Switch checked={formData.notifications.enabled} onCheckedChange={handleNotificationToggle} />
                  </div>

                  <AnimatePresence>
                    {showNotificationSettings && formData.notifications.enabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-4 p-4 border rounded-lg bg-background space-y-4">
                          {/* Deadline Alerts */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium">Deadline Alerts</Label>
                              <Button type="button" variant="outline" size="sm" onClick={addDeadlineAlert}>
                                <Plus className="h-3 w-3 mr-1" /> Add Alert
                              </Button>
                            </div>
                            {formData.notifications.deadline_alerts.map((alert, index) => {
                              const isInvalid = alert.hours_before === '' || parseInt(alert.hours_before) < 1;
                              return (
                                <div key={index} className="space-y-1">
                                  <div className="flex items-center gap-3 p-2 bg-secondary/30 rounded">
                                    <Switch checked={alert.enabled} onCheckedChange={(checked) => updateDeadlineAlert(index, 'enabled', checked)} />
                                    <Input type="text" inputMode="numeric" pattern="[0-9]*" value={alert.hours_before}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d+$/.test(val)) updateDeadlineAlert(index, 'hours_before', val);
                                      }}
                                      className={`w-20 h-8 text-xs ${isInvalid ? 'border-red-500' : ''}`} placeholder="24" />
                                    <span className="text-xs text-muted-foreground">hrs before</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDeadlineAlert(index)} className="ml-auto text-destructive h-8 w-8 p-0">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Reminder Digests */}
                          <div className="space-y-3 pt-3 border-t">
                            <Label className="text-xs font-medium">Include in Reminder Digests</Label>
                            <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                              <Label className="text-xs">Start of Day Digest</Label>
                              <Switch checked={formData.notifications.reminder_digests.start_of_day}
                                onCheckedChange={(checked) => setFormData({ ...formData, notifications: { ...formData.notifications, reminder_digests: { ...formData.notifications.reminder_digests, start_of_day: checked } } })} />
                            </div>
                            <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                              <Label className="text-xs">End of Day Digest</Label>
                              <Switch checked={formData.notifications.reminder_digests.end_of_day}
                                onCheckedChange={(checked) => setFormData({ ...formData, notifications: { ...formData.notifications, reminder_digests: { ...formData.notifications.reminder_digests, end_of_day: checked } } })} />
                            </div>
                          </div>

                          {/* Overdue Escalation */}
                          <div className="space-y-3 pt-3 border-t">
                            <Label className="text-xs font-medium">Overdue Escalation</Label>
                            <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                              <Label className="text-xs">Enable Overdue Alerts</Label>
                              <Switch checked={formData.notifications.overdue_escalation.enabled}
                                onCheckedChange={(checked) => setFormData({ ...formData, notifications: { ...formData.notifications, overdue_escalation: { ...formData.notifications.overdue_escalation, enabled: checked } } })} />
                            </div>
                            {formData.notifications.overdue_escalation.enabled && (
                              <>
                                <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                                  <Label className="text-xs">Notify Task Creator</Label>
                                  <Switch checked={formData.notifications.overdue_escalation.notify_creator}
                                    onCheckedChange={(checked) => setFormData({ ...formData, notifications: { ...formData.notifications, overdue_escalation: { ...formData.notifications.overdue_escalation, notify_creator: checked } } })} />
                                </div>
                                <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                                  <Label className="text-xs">Notify Admin</Label>
                                  <Switch checked={formData.notifications.overdue_escalation.notify_admin}
                                    onCheckedChange={(checked) => setFormData({ ...formData, notifications: { ...formData.notifications, overdue_escalation: { ...formData.notifications.overdue_escalation, notify_admin: checked } } })} />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button className="w-full" onClick={handleSubmit}>
                  {editingTask ? "Update Work Item" : "Create Work Item"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-3">
        {/* UX UPGRADE: Fluid wrapping and flex logic for mobile spacing */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search tasks…" value={searchInput}
              onChange={e => handleSearchInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearchQuery(searchInput)}
              className="pl-9 pr-8 h-9" />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearchQuery(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant={myTasksOnly ? 'default' : 'outline'} size="sm" className="h-9"
            onClick={() => { setMyTasksOnly(!myTasksOnly); setPagination(prev => ({ ...prev, page: 1 })); }}>
            <User className="h-3.5 w-3.5 mr-1.5" />My Items
          </Button>
          <Button variant={parentRecurringOnly ? 'default' : 'outline'} size="sm" className="h-9"
            onClick={() => { setParentRecurringOnly(!parentRecurringOnly); setPagination(prev => ({ ...prev, page: 1 })); }}>
            <Repeat className="h-3.5 w-3.5 mr-1.5" />Recurring
          </Button>
          <div className="hidden sm:block flex-1" />
          <Button variant={showAdvancedFilters ? 'secondary' : 'outline'} size="sm" className="h-9 relative"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />Filters
            {getActiveFilterCount() > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                {getActiveFilterCount()}
              </span>
            )}
          </Button>
          <Select value={sortOption} onValueChange={v => { setSortOption(v); setPagination(prev => ({ ...prev, page: 1 })); }}>
            <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at_desc">Newest First</SelectItem>
              <SelectItem value="created_at_asc">Oldest First</SelectItem>
              <SelectItem value="due_date_asc">Due Date (Earliest)</SelectItem>
              <SelectItem value="due_date_desc">Due Date (Latest)</SelectItem>
              <SelectItem value="priority_high">Priority (High → Low)</SelectItem>
              <SelectItem value="priority_low">Priority (Low → High)</SelectItem>
              <SelectItem value="updated_at_desc">Recently Updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status tabs - UX UPGRADE: Swipeable on mobile */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/50 w-full sm:w-fit overflow-x-auto custom-scrollbar whitespace-nowrap">
          {STATUS_TABS.map(tab => (
            <button key={tab.value}
              onClick={() => { handleFilterChange(tab.value); setSelectedStatuses([]); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${filterStatus === tab.value && selectedStatuses.length === 0 ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {getActiveFilterChips().length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            {getActiveFilterChips().map(chip => (
              <button key={chip.key} onClick={chip.onRemove}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20 hover:bg-primary/15 transition-colors">
                {chip.label}<X className="h-3 w-3" />
              </button>
            ))}
            <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1">Clear all</button>
          </div>
        )}

        {/* Advanced filters */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-5 border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
                    <div className="space-y-2">
                      {['pending', 'in_progress', 'completed'].map(s => (
                        <div key={s} className="flex items-center gap-2">
                          <Checkbox id={`status-${s}`} checked={selectedStatuses.includes(s)} onCheckedChange={() => toggleStatusFilter(s)} />
                          <label htmlFor={`status-${s}`} className="text-sm cursor-pointer capitalize">{s.replace('_', ' ')}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Priority</Label>
                    <div className="space-y-2">
                      {/* UX UPGRADE: Removed 'critical' to match calendar */}
                      {['high', 'medium', 'low'].map(p => (
                        <div key={p} className="flex items-center gap-2">
                          <Checkbox id={`priority-${p}`} checked={selectedPriorities.includes(p)} onCheckedChange={() => togglePriorityFilter(p)} />
                          <label htmlFor={`priority-${p}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p]?.dot}`} />{PRIORITY_CONFIG[p]?.label || p}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Special</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={overdueOnly} id="overdue-toggle" onCheckedChange={checked => { setOverdueOnly(checked); setPagination(prev => ({ ...prev, page: 1 })); }} />
                        <label htmlFor="overdue-toggle" className="text-sm cursor-pointer">Overdue Only</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={parentRecurringOnly} id="recurring-toggle" onCheckedChange={checked => { setParentRecurringOnly(checked); setPagination(prev => ({ ...prev, page: 1 })); }} />
                        <label htmlFor="recurring-toggle" className="text-sm cursor-pointer">Recurring Parents Only</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Due Date Range</Label>
                    <div className="space-y-2">
                      <Input type="datetime-local" value={dueDateFrom} onChange={e => { setDueDateFrom(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }} className="dark:scheme-dark dark:[&::-webkit-calendar-picker-indicator]:invert" />
                      <Input type="datetime-local" value={dueDateTo} onChange={e => { setDueDateTo(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }} className="dark:scheme-dark dark:[&::-webkit-calendar-picker-indicator]:invert" />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Created Date Range</Label>
                    <div className="space-y-2">
                      <Input type="datetime-local" value={createdFrom} onChange={e => { setCreatedFrom(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }} className="dark:scheme-dark dark:[&::-webkit-calendar-picker-indicator]:invert" />
                      <Input type="datetime-local" value={createdTo} onChange={e => { setCreatedTo(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }} className="dark:scheme-dark dark:[&::-webkit-calendar-picker-indicator]:invert" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Responsible Owner</Label>
                      <Select value={filterAssignedTo} onValueChange={v => { setFilterAssignedTo(v === 'all' ? '' : v); setPagination(prev => ({ ...prev, page: 1 })); }}>
                        <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All users</SelectItem>
                          {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Created By</Label>
                      <Select value={filterAssignedBy} onValueChange={v => { setFilterAssignedBy(v === 'all' ? '' : v); setPagination(prev => ({ ...prev, page: 1 })); }}>
                        <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All users</SelectItem>
                          {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <SkeletonTask key={i} />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState hasFilters={!!hasFilters} onClear={clearAllFilters} />
      ) : (
        <motion.div className="space-y-2.5"
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } }, hidden: {} }}>
          <AnimatePresence mode="popLayout">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} user={user} users={users}
                onEdit={handleEdit} onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onEditRecurrence={openRecurrenceEditModal}
                onView={id => navigate(`/tasks/${id}`)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Pagination */}
      {!loading && tasks.length > 0 && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}>← Prev</Button>
            {[...Array(Math.min(5, pagination.total_pages))].map((_, i) => {
              let pageNum;
              if (pagination.total_pages <= 5) pageNum = i + 1;
              else if (pagination.page <= 3) pageNum = i + 1;
              else if (pagination.page >= pagination.total_pages - 2) pageNum = pagination.total_pages - 4 + i;
              else pageNum = pagination.page - 2 + i;
              return (
                <Button key={pageNum} variant={pagination.page === pageNum ? 'default' : 'outline'} size="sm"
                  className="w-8 h-8 p-0" onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}>
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.total_pages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}>Next →</Button>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      <Dialog open={completionModalOpen} onOpenChange={setCompletionModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Work Item</DialogTitle>
            <DialogDescription className="sr-only">Provide resolution and evidence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Required:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Resolution summary</li>
                    <li>At least one attachment (evidence)</li>
                  </ul>
                </div>
              </div>
            </div>
            {completingTask && (
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="font-medium text-sm">{completingTask.title}</p>
              </div>
            )}
            <div>
              <Label>Resolution Summary *</Label>
              <Textarea placeholder="Describe what was accomplished…" rows={4}
                value={completionData.resolution_text}
                onChange={e => setCompletionData(prev => ({ ...prev, resolution_text: e.target.value }))} />
            </div>
            <div>
              <Label>Evidence & Deliverables * ({completionData.attachment_ids.length} uploaded)</Label>
              <label className="mt-2 flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to select files</span>
                <input type="file" multiple className="hidden" disabled={completionData.uploading}
                  onChange={e => { if (e.target.files?.length > 0) { handleCompletionFilesSelected(e.target.files); e.target.value = ''; } }} />
              </label>
              {completionData.pendingFiles.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Files to Upload ({completionData.pendingFiles.length})</span>
                    <Button size="sm" onClick={() => completingTask && handleUploadCompletionFiles(completingTask.id)} disabled={completionData.uploading}>
                      {completionData.uploading ? 'Uploading…' : 'Upload Now'}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {completionData.pendingFiles.map(pf => (
                      <div key={pf.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span>📄</span>
                          <span className="truncate">{pf.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">({Math.round(pf.size / 1024)}KB)</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeCompletionPendingFile(pf.id)} className="text-red-500 hover:text-red-700 h-6 w-6 p-0">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {completionData.attachment_ids.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
                  <Check className="h-4 w-4" />{completionData.attachment_ids.length} file(s) ready
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCompletionModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCompleteTask}
                disabled={!completionData.resolution_text.trim() || completionData.attachment_ids.length === 0}>
                <Check className="h-4 w-4 mr-2" />Complete Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recurrence Edit Modal */}
      <Dialog open={recurrenceEditModalOpen} onOpenChange={setRecurrenceEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Recurrence Settings</DialogTitle>
            <DialogDescription className="sr-only">Modify the recurrence schedule.</DialogDescription>
          </DialogHeader>
          {editingRecurrenceTask && (
            <div className="space-y-5 pt-4">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <h4 className="font-medium text-sm">{editingRecurrenceTask.title}</h4>
                <p className="text-xs text-orange-600 mt-1">Changes affect future instances only.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={recurrenceEditForm.frequency} onValueChange={v => setRecurrenceEditForm(f => ({ ...f, frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Every</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="1" value={recurrenceEditForm.interval}
                      onChange={e => { const v = parseInt(e.target.value) || 0; setRecurrenceEditForm(f => ({ ...f, interval: v })); if (v >= 1) setRecurrenceFormErrors(e => ({ ...e, interval: null })); }}
                      className={`w-24 ${recurrenceFormErrors.interval ? 'border-red-500' : ''}`} />
                    <span className="text-muted-foreground text-sm">
                      {recurrenceEditForm.frequency === 'daily' ? 'day(s)' : recurrenceEditForm.frequency === 'weekly' ? 'week(s)' : 'month(s)'}
                    </span>
                  </div>
                  {recurrenceFormErrors.interval && <p className="text-xs text-red-500">{recurrenceFormErrors.interval}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={recurrenceEditForm.end_date} onChange={e => setRecurrenceEditForm(f => ({ ...f, end_date: e.target.value }))}
                    className="dark:scheme-dark dark:[&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-2">
                  <Label>Max Occurrences (optional)</Label>
                  <Input type="number" min="1" placeholder="No limit" value={recurrenceEditForm.max_occurrences || ''}
                    onChange={e => setRecurrenceEditForm(f => ({ ...f, max_occurrences: e.target.value ? parseInt(e.target.value) : null }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setRecurrenceEditModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveRecurrenceEdit} disabled={savingRecurrence}>
                  <Save className="h-4 w-4 mr-2" />{savingRecurrence ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
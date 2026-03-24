import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Edit, Trash2, Bell, BellOff, AlertCircle, Info,
  Repeat, Calendar, Upload, Paperclip, Check, Lock, Eye,
  Search, X, SlidersHorizontal, ArrowUpDown, User, Save,
  ChevronDown, Clock, Flag, MoreHorizontal, Filter
} from 'lucide-react';

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


// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKDAYS = [
  { value: 0, label: 'Mon' }, { value: 1, label: 'Tue' }, { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' }, { value: 4, label: 'Fri' }, { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' }
];

// Priority config — single source of truth for colors/labels
const PRIORITY_CONFIG = {
  critical: { label: 'Critical', border: 'border-l-rose-500', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400', dot: 'bg-rose-500' },
  high: { label: 'High', border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400', dot: 'bg-orange-500' },
  medium: { label: 'Medium', border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400', dot: 'bg-yellow-500' },
  low: { label: 'Low', border: 'border-l-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400', dot: 'bg-slate-400' },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
  in_progress: { label: 'In Progress', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  completed: { label: 'Completed', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  delayed: { label: 'Overdue', badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  canceled: { label: 'Canceled', badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-500/20 dark:text-neutral-400' },
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

// ─── Quick filter tab ─────────────────────────────────────────────────────────
function FilterTab({ label, value, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2
        ${active
          ? 'bg-background text-foreground shadow-sm border border-border/60'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        }
      `}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task, user, users,
  onEdit, onDelete, onStatusChange, onEditRecurrence, onView,
  canEdit, canDelete, canChangeStatus
}) {
  const assignedUser = users.find(u => u.id === task.assigned_to);
  const hasCustomNotifications = task.notifications?.enabled;
  const isRecurring = task.recurrence?.enabled && !task.recurrence?.parent_task_id;
  const isGeneratedInstance = task.recurrence?.parent_task_id;
  const isCompleted = task.status === 'completed';
  const taskIsOverdue = isOverdue(task.due_date) && !isCompleted;

  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const statusCfg = STATUS_CONFIG[taskIsOverdue ? 'delayed' : task.status] || STATUS_CONFIG.pending;

  const getRecurrenceLabel = (recurrence) => {
    if (!recurrence?.enabled) return null;
    const interval = recurrence.interval || 1;
    if (interval === 1) return recurrence.frequency.charAt(0).toUpperCase() + recurrence.frequency.slice(1);
    return `Every ${interval} ${recurrence.frequency === 'daily' ? 'days' : recurrence.frequency === 'weekly' ? 'weeks' : 'months'}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      data-testid={`task-item-${task.id}`}
    >
      <Card className={`
        group relative p-0 overflow-hidden transition-all duration-200
        border-l-4 ${priorityCfg.border}
        hover:shadow-md hover:-translate-y-0.5
        ${taskIsOverdue ? 'bg-red-50/30 dark:bg-red-500/5' : ''}
        ${isCompleted ? 'opacity-75' : ''}
      `}>
        <div className="p-5">
          <div className="flex items-start gap-4">

            {/* Left: Content */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Title row */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={`text-base font-semibold leading-tight ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                  data-testid="task-title"
                >
                  {task.title}
                </h3>

                {/* Priority badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityCfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                  {priorityCfg.label}
                </span>

                {/* Status badge */}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.badge}`} data-testid="task-status">
                  {statusCfg.label}
                </span>

                {/* Recurring badge */}
                {isRecurring && (
                  <Badge variant="outline" className="border-blue-400/50 text-blue-600 dark:text-blue-400 text-xs">
                    <Repeat className="h-3 w-3 mr-1" />
                    {getRecurrenceLabel(task.recurrence)}
                  </Badge>
                )}
                {isGeneratedInstance && (
                  <Badge variant="outline" className="border-violet-400/50 text-violet-600 dark:text-violet-400 text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    Auto-generated
                  </Badge>
                )}
                {hasCustomNotifications && (
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                    <Bell className="h-3 w-3 mr-1" />
                    Custom Alerts
                  </Badge>
                )}
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground/80">{assignedUser?.name || 'Unassigned'}</span>
                </span>
                <span className={`flex items-center gap-1.5 ${taskIsOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {formatUTCToLocalDateTime(task.due_date)}
                  {!isCompleted && (
                    <span className={`${taskIsOverdue ? 'font-semibold' : ''}`}>
                      ({getRelativeTime(task.due_date)})
                    </span>
                  )}
                </span>
                {taskIsOverdue && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Overdue
                  </span>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Status selector (non-completed only) */}
              {!isCompleted && canChangeStatus ? (
                <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v)}>
                  <SelectTrigger className="h-8 w-32 text-xs" data-testid="task-status-change">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              ) : isCompleted ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-xs h-8 px-2.5">
                  <Lock className="h-3 w-3 mr-1" />
                  Read-only
                </Badge>
              ) : null}

              {/* View */}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onView(task.id)}
                data-testid="view-task-button" title="View details">
                <Eye className="h-3.5 w-3.5" />
              </Button>

              {/* Edit */}
              {canEdit && !isCompleted && (
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit(task)}
                  data-testid="edit-task-button" title="Edit task">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Edit Recurrence (completed parent recurring) */}
              {canEdit && isCompleted && isRecurring && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onEditRecurrence(task)}
                  data-testid="edit-recurrence-button">
                  <Repeat className="h-3.5 w-3.5 mr-1" />
                  Recurrence
                </Button>
              )}

              {/* Delete */}
              {canDelete && (
                <Button variant="outline" size="icon"
                  className="h-8 w-8 text-destructive/60 hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
                  onClick={() => onDelete(task.id)} data-testid="delete-task-button" title="Delete task">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Resolution (completed tasks) */}
          {isCompleted && task.resolution && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 block mb-0.5">Resolution</span>
                  <p className="text-xs text-muted-foreground line-clamp-2">{task.resolution.text}</p>
                  {task.resolution.attachments?.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {task.resolution.attachments.length} attachment(s)
                    </p>
                  )}
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
      className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Flag className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        {hasFilters ? 'No tasks match your filters' : 'No work items yet'}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        {hasFilters
          ? 'Try adjusting or clearing your filters to see more results.'
          : 'Create your first work item to get started tracking tasks.'}
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1.5" />
          Clear all filters
        </Button>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TaskList({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [completionData, setCompletionData] = useState({
    resolution_text: '', attachment_ids: [], pendingFiles: [], uploading: false
  });

  // Recurrence edit modal
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
    recurrence: { enabled: false, frequency: 'daily', interval: 1, days_of_week: [], end_date: '', max_occurrences: null },
    recurrence_override: { enabled: false, avoid_weekends: 'none', avoid_holidays: false }
  });

  const [globalRecurrenceSettings, setGlobalRecurrenceSettings] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    if (statusParam) setFilterStatus(statusParam);
    loadUsers();
    loadGlobalRecurrenceSettings();
    loadGlobalNotificationSettings();
  }, [location]);

  useEffect(() => {
    loadTasks();
  }, [filterStatus, myTasksOnly, searchQuery, selectedStatuses, selectedPriorities,
    dueDateFrom, dueDateTo, createdFrom, createdTo, filterAssignedTo, filterAssignedBy,
    overdueOnly, parentRecurringOnly, sortOption, pagination.page]);

  const loadTasks = async () => {
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
      if (overdueOnly || filterStatus === 'delayed') params.overdue = 'true';
      if (parentRecurringOnly) params.parent_recurring_only = 'true';

      const response = await api.get('/tasks', { params });
      if (response.data.tasks) {
        setTasks(response.data.tasks);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      } else {
        setTasks(response.data);
      }
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const loadGlobalNotificationSettings = async () => {
    try {
      const response = await api.get('/notification-settings/defaults');
      setGlobalNotificationSettings(response.data);
    } catch { /* silent */ }
  };

  const loadGlobalRecurrenceSettings = async () => {
    try {
      const response = await api.get('/recurrence-settings');
      setGlobalRecurrenceSettings(response.data);
    } catch { /* silent */ }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.assigned_to || !formData.due_date) {
      toast.error('Please fill in all required fields (Title, Responsible Owner, Due Date)');
      return;
    }
    if (formData.notifications.enabled) {
      const alertError = validateDeadlineAlerts();
      if (alertError) { toast.error(alertError); return; }
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
          deadline_alerts: formData.notifications.deadline_alerts.map(a => ({
            ...a, hours_before: parseInt(a.hours_before) || 24
          }))
        };
      }
      if (formData.recurrence.enabled) {
        if (formData.recurrence.due_in_days < 1) { toast.error('Number of days must be at least 1'); return; }
        if (formData.recurrence.interval < 1) { toast.error('Number of days/months must be at least 1'); return; }
        const recurrence = { ...formData.recurrence };
        if (!recurrence.end_date) delete recurrence.end_date;
        if (!recurrence.max_occurrences) delete recurrence.max_occurrences;
        if (recurrence.frequency !== 'weekly') delete recurrence.days_of_week;
        payload.recurrence = recurrence;
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
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    let notificationSettings = {
      enabled: false, deadline_alerts: [],
      reminder_digests: { start_of_day: true, end_of_day: true },
      overdue_escalation: { enabled: true, notify_creator: true, notify_admin: false }
    };
    if (task.notifications?.enabled) notificationSettings = task.notifications;
    let recurrenceSettings = { enabled: false, frequency: 'daily', interval: 1, days_of_week: [], end_date: '', max_occurrences: null };
    if (task.recurrence?.enabled) {
      recurrenceSettings = {
        ...recurrenceSettings, ...task.recurrence,
        end_date: task.recurrence.end_date ? task.recurrence.end_date.split('T')[0] : ''
      };
    }
    let recurrenceOverrideSettings = { enabled: false, avoid_weekends: 'none', avoid_holidays: false };
    if (task.recurrence_override?.enabled) {
      recurrenceOverrideSettings = {
        enabled: true, avoid_weekends: task.recurrence_override.avoid_weekends || 'none',
        avoid_holidays: task.recurrence_override.avoid_holidays || false
      };
    }
    setFormData({
      title: task.title, description: task.description, priority: task.priority,
      assigned_to: task.assigned_to, due_date: utcToLocalDateTimeInput(task.due_date),
      notifications: notificationSettings, recurrence: recurrenceSettings, recurrence_override: recurrenceOverrideSettings
    });
    setShowNotificationSettings(notificationSettings.enabled);
    setShowRecurrenceSettings(recurrenceSettings.enabled);
    setIsDialogOpen(true);
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted successfully');
      loadTasks();
    } catch { toast.error('Failed to delete task'); }
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
      toast.error(error.response?.data?.detail || 'Failed to update status');
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
    if (completionData.pendingFiles.length === 0) return;
    const fd = new FormData();
    completionData.pendingFiles.forEach(pf => fd.append('files', pf.file));
    try {
      setCompletionData(prev => ({ ...prev, uploading: true }));
      const response = await api.post(`/tasks/${taskId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { uploaded, errors, total_uploaded, total_failed } = response.data;
      if (total_uploaded > 0) {
        const newIds = uploaded.map(a => a.id);
        setCompletionData(prev => ({
          ...prev, attachment_ids: [...prev.attachment_ids, ...newIds], pendingFiles: [], uploading: false
        }));
        toast.success(`${total_uploaded} file(s) uploaded`);
      }
      if (total_failed > 0) {
        errors.forEach(err => toast.error(`${err.filename}: ${err.error}`));
        setCompletionData(prev => ({ ...prev, uploading: false }));
      }
    } catch (error) {
      setCompletionData(prev => ({ ...prev, uploading: false }));
      toast.error(error.response?.data?.detail || 'Failed to upload files');
    }
  };

  const handleCompleteTask = async () => {
    if (!completingTask) return;
    if (!completionData.resolution_text.trim()) { toast.error('Resolution text is required'); return; }
    if (completionData.attachment_ids.length === 0) { toast.error('At least one attachment is required'); return; }
    try {
      await api.post(`/tasks/${completingTask.id}/complete`, {
        resolution_text: completionData.resolution_text,
        attachment_ids: completionData.attachment_ids
      });
      toast.success('Work item completed successfully');
      setCompletionModalOpen(false);
      setCompletingTask(null);
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete work item');
    }
  };

  const canEditTask = (task) => {
    if (user.role === 'admin') return true;
    if (task.assigned_by === user.id) return true;
    if (user.role === 'manager') {
      const assignee = users.find(u => u.id === task.assigned_to);
      if (assignee?.department === user.department) return true;
    }
    return false;
  };

  const canDeleteTask = (task) => {
    if (user.role === 'admin') return true;
    if (task.assigned_by === user.id) return true;
    if (user.role === 'manager') {
      const assignee = users.find(u => u.id === task.assigned_to);
      if (assignee?.department === user.department) return true;
    }
    return false;
  };

  const canChangeStatusFn = (task) => {
    if (user.role === 'admin') return true;
    if (task.assigned_by === user.id || task.assigned_to === user.id) return true;
    if (user.role === 'manager') {
      const assignee = users.find(u => u.id === task.assigned_to);
      if (assignee?.department === user.department) return true;
    }
    return false;
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

  const validateRecurrenceForm = () => {
    const errors = {};
    if (recurrenceEditForm.interval < 1) errors.interval = 'Must be at least 1';
    if (recurrenceEditForm.due_in_days < 1) errors.due_in_days = 'Must be at least 1';
    setRecurrenceFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveRecurrenceEdit = async () => {
    if (!editingRecurrenceTask || !validateRecurrenceForm()) return;
    setSavingRecurrence(true);
    try {
      const payload = {
        frequency: recurrenceEditForm.frequency, interval: recurrenceEditForm.interval,
        due_in_days: recurrenceEditForm.due_in_days,
        days_of_week: recurrenceEditForm.frequency === 'weekly' ? recurrenceEditForm.days_of_week : undefined,
        end_date: recurrenceEditForm.end_date || undefined,
        max_occurrences: recurrenceEditForm.max_occurrences || undefined,
        recurrence_override: recurrenceEditForm.recurrence_override
      };
      await api.put(`/recurring-tasks/${editingRecurrenceTask.id}/recurrence`, payload);
      toast.success('Recurrence settings updated. Changes affect future instances only.');
      setRecurrenceEditModalOpen(false);
      setEditingRecurrenceTask(null);
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update recurrence settings');
    } finally {
      setSavingRecurrence(false);
    }
  };

  const toggleRecurrenceWeekday = (day) => {
    const currentDays = recurrenceEditForm.days_of_week || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);
    setRecurrenceEditForm({ ...recurrenceEditForm, days_of_week: newDays });
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', priority: 'medium', assigned_to: '', due_date: '',
      notifications: {
        enabled: false, deadline_alerts: [],
        reminder_digests: { start_of_day: true, end_of_day: true },
        overdue_escalation: { enabled: true, notify_creator: true, notify_admin: false }
      },
      recurrence: { enabled: false, frequency: 'daily', interval: 1, days_of_week: [], end_date: '', max_occurrences: null },
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

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedStatuses.length > 0) count++;
    if (selectedPriorities.length > 0) count++;
    if (dueDateFrom || dueDateTo) count++;
    if (createdFrom || createdTo) count++;
    if (filterAssignedTo) count++;
    if (filterAssignedBy) count++;
    if (overdueOnly) count++;
    if (parentRecurringOnly) count++;
    return count;
  };

  const clearAllFilters = () => {
    setSearchInput(''); setSearchQuery('');
    setSelectedStatuses([]); setSelectedPriorities([]);
    setDueDateFrom(''); setDueDateTo(''); setCreatedFrom(''); setCreatedTo('');
    setFilterAssignedTo(''); setFilterAssignedBy('');
    setOverdueOnly(false); setParentRecurringOnly(false); setMyTasksOnly(false);
    setFilterStatus('all'); setSortOption('created_at_desc');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearchInputChange = (value) => {
    setSearchInput(value);
    if (value.length >= 3) { setSearchQuery(value); setPagination(prev => ({ ...prev, page: 1 })); }
    else if (value.length === 0) { setSearchQuery(''); setPagination(prev => ({ ...prev, page: 1 })); }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') { setSearchQuery(searchInput); setPagination(prev => ({ ...prev, page: 1 })); }
  };

  const clearSearch = () => { setSearchInput(''); setSearchQuery(''); setPagination(prev => ({ ...prev, page: 1 })); };

  const toggleStatusFilter = (status) => {
    setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const togglePriorityFilter = (priority) => {
    setSelectedPriorities(prev => prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActiveFilterChips = () => {
    const chips = [];
    if (myTasksOnly) chips.push({ key: 'myTasks', label: 'My Items', onRemove: () => setMyTasksOnly(false) });
    if (searchQuery) chips.push({ key: 'search', label: `"${searchQuery}"`, onRemove: clearSearch });
    selectedStatuses.forEach(s => chips.push({ key: `status-${s}`, label: `Status: ${s.replace('_', ' ')}`, onRemove: () => toggleStatusFilter(s) }));
    selectedPriorities.forEach(p => chips.push({ key: `priority-${p}`, label: `Priority: ${p}`, onRemove: () => togglePriorityFilter(p) }));
    if (dueDateFrom || dueDateTo) {
      const label = dueDateFrom && dueDateTo ? `Due: ${dueDateFrom.split('T')[0]} – ${dueDateTo.split('T')[0]}`
        : dueDateFrom ? `Due from: ${dueDateFrom.split('T')[0]}` : `Due to: ${dueDateTo.split('T')[0]}`;
      chips.push({ key: 'dueDate', label, onRemove: () => { setDueDateFrom(''); setDueDateTo(''); } });
    }
    if (createdFrom || createdTo) {
      const label = createdFrom && createdTo ? `Created: ${createdFrom.split('T')[0]} – ${createdTo.split('T')[0]}`
        : createdFrom ? `Created from: ${createdFrom.split('T')[0]}` : `Created to: ${createdTo.split('T')[0]}`;
      chips.push({ key: 'createdDate', label, onRemove: () => { setCreatedFrom(''); setCreatedTo(''); } });
    }
    if (filterAssignedTo) {
      const assignee = users.find(u => u.id === filterAssignedTo);
      chips.push({ key: 'assignedTo', label: `Owner: ${assignee?.name || 'Unknown'}`, onRemove: () => setFilterAssignedTo('') });
    }
    if (filterAssignedBy) {
      const creator = users.find(u => u.id === filterAssignedBy);
      chips.push({ key: 'assignedBy', label: `By: ${creator?.name || 'Unknown'}`, onRemove: () => setFilterAssignedBy('') });
    }
    if (overdueOnly) chips.push({ key: 'overdue', label: 'Overdue Only', onRemove: () => setOverdueOnly(false) });
    if (parentRecurringOnly) chips.push({ key: 'parentRecurring', label: 'Recurring Parents', onRemove: () => setParentRecurringOnly(false) });
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

  const handleRecurrenceToggle = (enabled) => {
    setFormData({ ...formData, recurrence: { ...formData.recurrence, enabled } });
    setShowRecurrenceSettings(enabled);
  };

  const toggleWeekday = (day) => {
    const currentDays = formData.recurrence.days_of_week || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);
    setFormData({ ...formData, recurrence: { ...formData.recurrence, days_of_week: newDays } });
  };

  const updateDeadlineAlert = (index, field, value) => {
    const newAlerts = [...formData.notifications.deadline_alerts];
    newAlerts[index] = { ...newAlerts[index], [field]: value };
    setFormData({ ...formData, notifications: { ...formData.notifications, deadline_alerts: newAlerts } });
  };

  const validateDeadlineAlerts = () => {
    const alerts = formData.notifications.deadline_alerts;
    for (let i = 0; i < alerts.length; i++) {
      const hours = alerts[i].hours_before;
      if (hours === '' || hours === null || hours === undefined) return `Alert ${i + 1}: Hours required`;
      if (isNaN(parseInt(hours)) || parseInt(hours) < 1) return `Alert ${i + 1}: Hours must be ≥ 1`;
    }
    return null;
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
    setFormData({
      ...formData,
      notifications: {
        ...formData.notifications,
        deadline_alerts: formData.notifications.deadline_alerts.filter((_, i) => i !== index)
      }
    });
  };

  const isTaskCreator = !editingTask || editingTask.assigned_by === user.id;
  const isManagerOfTask = () => {
    if (user.role !== 'manager' || !editingTask) return false;
    const assignee = users.find(u => u.id === editingTask.assigned_to);
    return assignee?.department === user.department;
  };
  const canEditNotifications = isTaskCreator || user.role === 'admin' || isManagerOfTask();
  const canEditRecurrence = isTaskCreator || user.role === 'admin' || isManagerOfTask();
  const isChildTask = editingTask?.recurrence?.parent_task_id;

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

      {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="tasks-heading">
            Work Items
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {loading ? 'Loading…' : `${pagination.total} total tasks`}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="create-task-button" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Create Work Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Work Item' : 'Create New Work Item'}</DialogTitle>
              <DialogDescription className="sr-only">Enter the details for the work item here.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  data-testid="task-title-input" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} rows={3}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  data-testid="task-description-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsible Owner *</Label>
                  <Select value={formData.assigned_to} onValueChange={v => setFormData({ ...formData, assigned_to: v })}>
                    <SelectTrigger data-testid="task-assignee-select"><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="due_date">Due Date & Time *</Label>
                <Input id="due_date" type="datetime-local" value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                  data-testid="task-due-date-input" />
              </div>

              {/* Recurring Task Section */}
              {canEditRecurrence && !isChildTask && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => handleRecurrenceToggle(!formData.recurrence.enabled)}
                    data-testid="task-recurrence-toggle">
                    <div className="flex items-center gap-3">
                      <Repeat className={`h-5 w-5 ${formData.recurrence.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Make this a Recurring Task</Label>
                        <p className="text-xs text-muted-foreground">
                          {formData.recurrence.enabled ? `Repeats ${formData.recurrence.frequency}` : 'Create automatic task instances on a schedule'}
                        </p>
                      </div>
                    </div>
                    <Switch checked={formData.recurrence.enabled} onCheckedChange={handleRecurrenceToggle} data-testid="task-recurrence-switch" />
                  </div>
                  <AnimatePresence>
                    {showRecurrenceSettings && formData.recurrence.enabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-4 p-4 border rounded-lg bg-background space-y-4">
                          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                            <p className="text-xs text-blue-800 dark:text-blue-200">New instances will be created automatically. Each is an independent task.</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">Frequency</Label>
                              <Select value={formData.recurrence.frequency}
                                onValueChange={v => setFormData({ ...formData, recurrence: { ...formData.recurrence, frequency: v, days_of_week: [] } })}>
                                <SelectTrigger data-testid="recurrence-frequency"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">Every</Label>
                              <div className="flex items-center gap-2">
                                <Input type="number" min="1" value={formData.recurrence.interval}
                                  onChange={e => setFormData({ ...formData, recurrence: { ...formData.recurrence, interval: parseInt(e.target.value) || 0 } })}
                                  className={`w-20 ${formData.recurrence.interval < 1 ? 'border-red-500' : ''}`}
                                  data-testid="recurrence-interval" />
                                <span className="text-sm text-muted-foreground">
                                  {formData.recurrence.frequency === 'daily' ? 'day(s)' : formData.recurrence.frequency === 'weekly' ? 'week(s)' : 'month(s)'}
                                </span>
                              </div>
                              {formData.recurrence.interval < 1 && <p className="text-xs text-red-500 mt-1">Must be at least 1</p>}
                            </div>
                          </div>
                          {formData.recurrence.frequency === 'weekly' && (
                            <div>
                              <Label className="text-sm mb-2 block">Repeat on</Label>
                              <div className="flex gap-2 flex-wrap">
                                {WEEKDAYS.map(day => (
                                  <button key={day.value} type="button" onClick={() => toggleWeekday(day.value)}
                                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${formData.recurrence.days_of_week?.includes(day.value)
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background border-input hover:bg-secondary'
                                      }`} data-testid={`weekday-${day.value}`}>
                                    {day.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">End Date (optional)</Label>
                              <Input type="date" value={formData.recurrence.end_date}
                                onChange={e => setFormData({ ...formData, recurrence: { ...formData.recurrence, end_date: e.target.value } })}
                                data-testid="recurrence-end-date" />
                            </div>
                            <div>
                              <Label className="text-sm">Max Occurrences (optional)</Label>
                              <Input type="number" min="1" placeholder="No limit" value={formData.recurrence.max_occurrences || ''}
                                onChange={e => setFormData({ ...formData, recurrence: { ...formData.recurrence, max_occurrences: e.target.value ? parseInt(e.target.value) : null } })}
                                data-testid="recurrence-max-occurrences" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm">Due In (days from creation)</Label>
                              <Input type="number" min="1" value={formData.recurrence.due_in_days || 1}
                                onChange={e => setFormData({ ...formData, recurrence: { ...formData.recurrence, due_in_days: parseInt(e.target.value) || 0 } })}
                                className={`w-24 ${formData.recurrence.due_in_days < 1 ? 'border-red-500' : ''}`}
                                data-testid="recurrence-due-in-days" />
                              {formData.recurrence.due_in_days < 1 && <p className="text-xs text-red-500">Must be at least 1</p>}
                            </div>
                          </div>
                          <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <Label className="text-sm font-medium">Override Calendar Settings</Label>
                                <p className="text-xs text-muted-foreground">
                                  {formData.recurrence_override.enabled ? 'Using task-specific settings'
                                    : globalRecurrenceSettings ? `Global: ${globalRecurrenceSettings.avoid_weekends === 'none' ? 'No weekend skip' : globalRecurrenceSettings.avoid_weekends === 'sunday_only' ? 'Skip Sundays' : 'Skip weekends'}` : 'Using global settings'}
                                </p>
                              </div>
                              <Switch checked={formData.recurrence_override.enabled}
                                onCheckedChange={checked => setFormData({
                                  ...formData,
                                  recurrence_override: {
                                    ...formData.recurrence_override, enabled: checked,
                                    ...(checked && globalRecurrenceSettings ? { avoid_weekends: globalRecurrenceSettings.avoid_weekends, avoid_holidays: globalRecurrenceSettings.avoid_holidays } : {})
                                  }
                                })} data-testid="recurrence-override-switch" />
                            </div>
                            {formData.recurrence_override.enabled && (
                              <div className="space-y-4 pl-2 border-l-2 border-primary/30">
                                <div>
                                  <Label className="text-sm">Weekend Avoidance</Label>
                                  <Select value={formData.recurrence_override.avoid_weekends}
                                    onValueChange={v => setFormData({ ...formData, recurrence_override: { ...formData.recurrence_override, avoid_weekends: v } })}>
                                    <SelectTrigger className="mt-1" data-testid="override-avoid-weekends"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No weekend skip</SelectItem>
                                      <SelectItem value="sunday_only">Skip Sundays only</SelectItem>
                                      <SelectItem value="sat_sun">Skip Saturday & Sunday</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label className="text-sm">Avoid Holidays</Label>
                                    <p className="text-xs text-muted-foreground">Skip dates in admin holiday list</p>
                                  </div>
                                  <Switch checked={formData.recurrence_override.avoid_holidays}
                                    onCheckedChange={checked => setFormData({ ...formData, recurrence_override: { ...formData.recurrence_override, avoid_holidays: checked } })}
                                    data-testid="override-avoid-holidays" />
                                </div>
                                {formData.recurrence_override.avoid_holidays && globalRecurrenceSettings?.holiday_list?.length > 0 && (
                                  <div className="p-3 bg-muted/50 rounded-lg">
                                    <Label className="text-xs text-muted-foreground mb-2 block">Admin Holiday List (read-only):</Label>
                                    <p className="text-sm">{globalRecurrenceSettings.holiday_list.sort().join(', ')}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {isChildTask && (
                <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Auto-generated instance of a recurring task</span>
                </div>
              )}

              {/* Notification Override Section */}
              {canEditNotifications && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary/70 transition-colors"
                    onClick={() => handleNotificationToggle(!formData.notifications.enabled)}
                    data-testid="task-notifications-toggle">
                    <div className="flex items-center gap-3">
                      {formData.notifications.enabled
                        ? <Bell className="h-5 w-5 text-primary" />
                        : <BellOff className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Override Notification Settings</Label>
                        <p className="text-xs text-muted-foreground">
                          {formData.notifications.enabled ? 'Using task-specific settings' : 'Using global notification settings'}
                        </p>
                      </div>
                    </div>
                    <Switch checked={formData.notifications.enabled} onCheckedChange={handleNotificationToggle} data-testid="task-notifications-switch" />
                  </div>
                  <AnimatePresence>
                    {showNotificationSettings && formData.notifications.enabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-4 p-4 border rounded-lg bg-background space-y-4">
                          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-200">Overrides global notification settings for this task only.</p>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">Deadline Alerts</Label>
                              <Button type="button" variant="outline" size="sm" onClick={addDeadlineAlert}>
                                <Plus className="h-3 w-3 mr-1" /> Add Alert
                              </Button>
                            </div>
                            {formData.notifications.deadline_alerts.length === 0 && (
                              <p className="text-sm text-muted-foreground italic">No deadline alerts configured</p>
                            )}
                            {formData.notifications.deadline_alerts.map((alert, index) => {
                              const isInvalid = alert.hours_before === '' || parseInt(alert.hours_before) < 1;
                              return (
                                <div key={index} className="space-y-1">
                                  <div className="flex items-center gap-3 p-2 bg-secondary/30 rounded">
                                    <Switch checked={alert.enabled} onCheckedChange={checked => updateDeadlineAlert(index, 'enabled', checked)} />
                                    <Input type="text" inputMode="numeric" pattern="[0-9]*" value={alert.hours_before}
                                      onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) updateDeadlineAlert(index, 'hours_before', v); }}
                                      className={`w-20 ${isInvalid ? 'border-red-500' : ''}`} placeholder="24" />
                                    <span className="text-sm text-muted-foreground">hours before</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDeadlineAlert(index)}
                                      className="ml-auto text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {isInvalid && <p className="text-xs text-red-500 ml-12">Must be at least 1 hour</p>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="space-y-3">
                            <Label className="font-medium">Include in Reminder Digests</Label>
                            <div className="space-y-2">
                              {[['start_of_day', 'Start of Day Digest'], ['end_of_day', 'End of Day Digest']].map(([key, label]) => (
                                <div key={key} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                                  <Label className="text-sm">{label}</Label>
                                  <Switch checked={formData.notifications.reminder_digests[key]}
                                    onCheckedChange={checked => setFormData({
                                      ...formData,
                                      notifications: { ...formData.notifications, reminder_digests: { ...formData.notifications.reminder_digests, [key]: checked } }
                                    })} />
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <Label className="font-medium">Overdue Escalation</Label>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                                <Label className="text-sm">Enable Overdue Alerts</Label>
                                <Switch checked={formData.notifications.overdue_escalation.enabled}
                                  onCheckedChange={checked => setFormData({ ...formData, notifications: { ...formData.notifications, overdue_escalation: { ...formData.notifications.overdue_escalation, enabled: checked } } })} />
                              </div>
                              {formData.notifications.overdue_escalation.enabled && (
                                <>
                                  {[['notify_creator', 'Notify Task Creator'], ['notify_admin', 'Notify Admin']].map(([key, label]) => (
                                    <div key={key} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                                      <Label className="text-sm">{label}</Label>
                                      <Switch checked={formData.notifications.overdue_escalation[key]}
                                        onCheckedChange={checked => setFormData({ ...formData, notifications: { ...formData.notifications, overdue_escalation: { ...formData.notifications.overdue_escalation, [key]: checked } } })} />
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <Button onClick={handleSubmit} className="w-full" data-testid="save-task-button">
                {editingTask ? 'Update Work Item' : 'Create Work Item'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── FILTER TOOLBAR ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Row 1: search + sort + advanced toggle */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks…"
              value={searchInput}
              onChange={e => handleSearchInputChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 pr-8 h-9"
              data-testid="search-input"
            />
            {searchInput && (
              <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* My Items */}
          <Button variant={myTasksOnly ? 'default' : 'outline'} size="sm" className="h-9"
            onClick={() => { setMyTasksOnly(!myTasksOnly); setPagination(prev => ({ ...prev, page: 1 })); }}
            data-testid="my-tasks-button">
            <User className="h-3.5 w-3.5 mr-1.5" />
            My Items
          </Button>

          {/* Recurring parents */}
          <Button variant={parentRecurringOnly ? 'default' : 'outline'} size="sm" className="h-9"
            onClick={() => { setParentRecurringOnly(!parentRecurringOnly); setPagination(prev => ({ ...prev, page: 1 })); }}
            data-testid="parent-recurring-button">
            <Repeat className="h-3.5 w-3.5 mr-1.5" />
            Recurring
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Advanced filters */}
          <Button variant={showAdvancedFilters ? 'secondary' : 'outline'} size="sm" className="h-9 relative"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} data-testid="advanced-filters-toggle">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Filters
            {getActiveFilterCount() > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                {getActiveFilterCount()}
              </span>
            )}
          </Button>

          {/* Sort */}
          <Select value={sortOption} onValueChange={v => { setSortOption(v); setPagination(prev => ({ ...prev, page: 1 })); }}>
            <SelectTrigger className="w-[170px] h-9 text-xs" data-testid="sort-select">
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

        {/* Row 2: Status quick-filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/50 w-fit">
          {STATUS_TABS.map(tab => (
            <FilterTab key={tab.value} value={tab.value} label={tab.label}
              active={filterStatus === tab.value && selectedStatuses.length === 0}
              onClick={() => { handleFilterChange(tab.value); setSelectedStatuses([]); }}
              data-testid={`filter-${tab.value}-button`}
            />
          ))}
        </div>

        {/* Active filter chips */}
        {getActiveFilterChips().length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            {getActiveFilterChips().map(chip => (
              <button key={chip.key} onClick={chip.onRemove}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20 hover:bg-primary/15 transition-colors">
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1">
              Clear all
            </button>
          </div>
        )}

        {/* Advanced Filters Panel */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
              <Card className="p-5 border-border/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Status */}
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
                    <div className="space-y-2">
                      {['pending', 'in_progress', 'completed'].map(s => (
                        <div key={s} className="flex items-center gap-2">
                          <Checkbox id={`status-${s}`} checked={selectedStatuses.includes(s)}
                            onCheckedChange={() => toggleStatusFilter(s)} />
                          <label htmlFor={`status-${s}`} className="text-sm cursor-pointer capitalize">
                            {s.replace('_', ' ')}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Priority */}
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Priority</Label>
                    <div className="space-y-2">
                      {['critical', 'high', 'medium', 'low'].map(p => (
                        <div key={p} className="flex items-center gap-2">
                          <Checkbox id={`priority-${p}`} checked={selectedPriorities.includes(p)}
                            onCheckedChange={() => togglePriorityFilter(p)} />
                          <label htmlFor={`priority-${p}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p]?.dot}`} />
                            {PRIORITY_CONFIG[p]?.label || p}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Special */}
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Special</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={overdueOnly} id="overdue-toggle"
                          onCheckedChange={checked => { setOverdueOnly(checked); setPagination(prev => ({ ...prev, page: 1 })); }} />
                        <label htmlFor="overdue-toggle" className="text-sm cursor-pointer">Overdue Only</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={parentRecurringOnly} id="parent-recurring-toggle"
                          data-testid="parent-recurring-toggle"
                          onCheckedChange={checked => { setParentRecurringOnly(checked); setPagination(prev => ({ ...prev, page: 1 })); }} />
                        <label htmlFor="parent-recurring-toggle" className="text-sm cursor-pointer">Recurring Parents Only</label>
                      </div>
                    </div>
                  </div>
                  {/* Due Date */}
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Due Date Range</Label>
                    <div className="space-y-2">
                      <Input type="datetime-local" value={dueDateFrom}
                        onChange={e => { setDueDateFrom(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                        data-testid="due-date-from" />
                      <Input type="datetime-local" value={dueDateTo}
                        onChange={e => { setDueDateTo(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                        data-testid="due-date-to" />
                    </div>
                  </div>
                  
                  {/* Created Date */}
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                      Created Date Range
                    </Label>

                    <div className="space-y-2">
                      <Input type="datetime-local" value={createdFrom}
                        onChange={e => { setCreatedFrom(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                        data-testid="created-date-from" />
                      <Input type="datetime-local" value={createdTo}
                        onChange={e => { setCreatedTo(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                        data-testid="created-date-to" />
                    </div>
                  </div>
                  
                  {/* User filters */}
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Responsible Owner</Label>
                      <Select value={filterAssignedTo} onValueChange={v => { setFilterAssignedTo(v === 'all' ? '' : v); setPagination(prev => ({ ...prev, page: 1 })); }}>
                        <SelectTrigger data-testid="filter-assigned-to"><SelectValue placeholder="All users" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All users</SelectItem>
                          {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Created By</Label>
                      <Select value={filterAssignedBy} onValueChange={v => { setFilterAssignedBy(v === 'all' ? '' : v); setPagination(prev => ({ ...prev, page: 1 })); }}>
                        <SelectTrigger data-testid="filter-assigned-by"><SelectValue placeholder="All users" /></SelectTrigger>
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

      {/* ── TASK LIST ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3" data-testid="task-list">
          {[...Array(5)].map((_, i) => <SkeletonTask key={i} />)}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState hasFilters={!!hasFilters} onClear={clearAllFilters} />
      ) : (
        <motion.div className="space-y-2.5" data-testid="task-list"
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } }, hidden: {} }}>
          <AnimatePresence mode="popLayout">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                user={user}
                users={users}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onEditRecurrence={openRecurrenceEditModal}
                onView={id => navigate(`/tasks/${id}`)}
                canEdit={canEditTask(task)}
                canDelete={canDeleteTask(task)}
                canChangeStatus={canChangeStatusFn(task)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── PAGINATION ────────────────────────────────────────────────────── */}
      {!loading && tasks.length > 0 && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              data-testid="prev-page-button">
              ← Prev
            </Button>
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
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              data-testid="next-page-button">
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* ── COMPLETION MODAL ──────────────────────────────────────────────── */}
      <Dialog open={completionModalOpen} onOpenChange={setCompletionModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Work Item</DialogTitle>
            <DialogDescription className="sr-only">Provide resolution details and evidence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Required to complete:</p>
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
                {completingTask.description && <p className="text-xs text-muted-foreground mt-0.5">{completingTask.description}</p>}
              </div>
            )}
            <div>
              <Label htmlFor="resolution">Resolution Summary *</Label>
              <Textarea id="resolution" placeholder="Describe what was accomplished…"
                value={completionData.resolution_text}
                onChange={e => setCompletionData(prev => ({ ...prev, resolution_text: e.target.value }))}
                rows={4} data-testid="resolution-text" />
            </div>
            <div>
              <Label>Evidence & Deliverables * ({completionData.attachment_ids.length} uploaded)</Label>
              <label className="mt-2 flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to select files (multiple allowed)</span>
                <input type="file" multiple className="hidden" disabled={completionData.uploading}
                  onChange={e => { if (e.target.files?.length > 0) { handleCompletionFilesSelected(e.target.files); e.target.value = ''; } }}
                  data-testid="completion-file-input" />
              </label>
              {completionData.pendingFiles.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Files to Upload ({completionData.pendingFiles.length})
                    </span>
                    <Button size="sm" onClick={() => completingTask && handleUploadCompletionFiles(completingTask.id)}
                      disabled={completionData.uploading} data-testid="upload-completion-files">
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
                        <Button variant="ghost" size="sm" onClick={() => removeCompletionPendingFile(pf.id)}
                          className="text-red-500 hover:text-red-700 h-6 w-6 p-0">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {completionData.attachment_ids.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
                  <Check className="h-4 w-4" />
                  {completionData.attachment_ids.length} file(s) ready
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCompletionModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCompleteTask}
                disabled={!completionData.resolution_text.trim() || completionData.attachment_ids.length === 0}
                data-testid="confirm-completion-button">
                <Check className="h-4 w-4 mr-2" />
                Complete Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── RECURRENCE EDIT MODAL ─────────────────────────────────────────── */}
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
                <p className="text-xs text-orange-600 mt-1">Parent completed. Changes affect future instances only.</p>
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={recurrenceEditForm.frequency}
                  onValueChange={v => setRecurrenceEditForm({ ...recurrenceEditForm, frequency: v })}>
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
                    onChange={e => {
                      const v = parseInt(e.target.value) || 0;
                      setRecurrenceEditForm({ ...recurrenceEditForm, interval: v });
                      if (v >= 1 && recurrenceFormErrors.interval) setRecurrenceFormErrors({ ...recurrenceFormErrors, interval: null });
                    }}
                    className={`w-24 ${recurrenceFormErrors.interval ? 'border-red-500' : ''}`}
                    data-testid="interval-input" />
                  <span className="text-muted-foreground text-sm">
                    {recurrenceEditForm.frequency === 'daily' ? 'day(s)' : recurrenceEditForm.frequency === 'weekly' ? 'week(s)' : 'month(s)'}
                  </span>
                </div>
                {recurrenceFormErrors.interval && <p className="text-xs text-red-500">{recurrenceFormErrors.interval}</p>}
              </div>
              {recurrenceEditForm.frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Days of Week</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(day => (
                      <div key={day.value} className="flex items-center gap-1">
                        <Checkbox id={`recurrence-day-${day.value}`}
                          checked={recurrenceEditForm.days_of_week.includes(day.value)}
                          onCheckedChange={checked => {
                            setRecurrenceEditForm({
                              ...recurrenceEditForm,
                              days_of_week: checked
                                ? [...recurrenceEditForm.days_of_week, day.value].sort()
                                : recurrenceEditForm.days_of_week.filter(d => d !== day.value)
                            });
                          }} />
                        <label htmlFor={`recurrence-day-${day.value}`} className="text-sm cursor-pointer">{day.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Due In (days from creation)</Label>
                <Input type="number" min="1" value={recurrenceEditForm.due_in_days}
                  onChange={e => {
                    const v = parseInt(e.target.value) || 0;
                    setRecurrenceEditForm({ ...recurrenceEditForm, due_in_days: v });
                    if (v >= 1 && recurrenceFormErrors.due_in_days) setRecurrenceFormErrors({ ...recurrenceFormErrors, due_in_days: null });
                  }}
                  className={`w-24 ${recurrenceFormErrors.due_in_days ? 'border-red-500' : ''}`}
                  data-testid="due-in-days-input" />
                {recurrenceFormErrors.due_in_days && <p className="text-xs text-red-500">{recurrenceFormErrors.due_in_days}</p>}
                <p className="text-xs text-muted-foreground">Each new instance will be due this many days after creation</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={recurrenceEditForm.end_date}
                    onChange={e => setRecurrenceEditForm({ ...recurrenceEditForm, end_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Occurrences (optional)</Label>
                  <Input type="number" min="1" placeholder="No limit" value={recurrenceEditForm.max_occurrences || ''}
                    onChange={e => setRecurrenceEditForm({ ...recurrenceEditForm, max_occurrences: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-32" />
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Override Calendar Settings</Label>
                    <p className="text-xs text-muted-foreground">
                      {recurrenceEditForm.recurrence_override.enabled ? 'Using task-specific settings'
                        : `Global: ${globalRecurrenceSettings?.avoid_weekends === 'none' ? 'No skip' : globalRecurrenceSettings?.avoid_weekends === 'sunday_only' ? 'Skip Sundays' : 'Skip weekends'}`}
                    </p>
                  </div>
                  <Switch checked={recurrenceEditForm.recurrence_override.enabled}
                    onCheckedChange={checked => setRecurrenceEditForm({
                      ...recurrenceEditForm,
                      recurrence_override: {
                        ...recurrenceEditForm.recurrence_override, enabled: checked,
                        ...(checked && globalRecurrenceSettings ? { avoid_weekends: globalRecurrenceSettings.avoid_weekends, avoid_holidays: globalRecurrenceSettings.avoid_holidays } : {})
                      }
                    })} />
                </div>
                {recurrenceEditForm.recurrence_override.enabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                    <div>
                      <Label className="text-sm">Weekend Avoidance</Label>
                      <Select value={recurrenceEditForm.recurrence_override.avoid_weekends}
                        onValueChange={v => setRecurrenceEditForm({ ...recurrenceEditForm, recurrence_override: { ...recurrenceEditForm.recurrence_override, avoid_weekends: v } })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No weekend skip</SelectItem>
                          <SelectItem value="sunday_only">Skip Sundays only</SelectItem>
                          <SelectItem value="sat_sun">Skip Saturday & Sunday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Avoid Holidays</Label>
                        <p className="text-xs text-muted-foreground">Skip dates in admin holiday list</p>
                      </div>
                      <Switch checked={recurrenceEditForm.recurrence_override.avoid_holidays}
                        onCheckedChange={checked => setRecurrenceEditForm({ ...recurrenceEditForm, recurrence_override: { ...recurrenceEditForm.recurrence_override, avoid_holidays: checked } })} />
                    </div>
                    {recurrenceEditForm.recurrence_override.avoid_holidays && globalRecurrenceSettings?.holiday_list?.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <Label className="text-xs text-muted-foreground">Admin Holiday List (read-only):</Label>
                        <p className="text-sm mt-1">{globalRecurrenceSettings.holiday_list.sort().join(', ')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setRecurrenceEditModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveRecurrenceEdit} disabled={savingRecurrence}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingRecurrence ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>

  );
}
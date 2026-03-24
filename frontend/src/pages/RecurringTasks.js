import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Repeat, Play, Pause, Edit2, Search, Clock, User, Calendar,
  AlertCircle, ChevronDown, ChevronUp, Info, X, Save
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { api } from '../App';
import { toast } from 'sonner';
import { formatUTCToLocalDateTime } from '../utils/timezone';

const WEEKDAYS = [
  { value: 0, label: 'Mon' }, { value: 1, label: 'Tue' }, { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' }, { value: 4, label: 'Fri' }, { value: 5, label: 'Sat' }, { value: 6, label: 'Sun' }
];

export default function RecurringTasks({ user }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]); // Keeps our robust user lookup
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOption, setSortOption] = useState('next_run_asc'); // Restored sorting state
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });

  // Advanced Edit modal state (Kept intact, not downgraded!)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({
    frequency: 'daily', interval: 1, due_in_days: 1, days_of_week: [], end_date: '', max_occurrences: null,
    recurrence_override: { enabled: false, avoid_weekends: 'none', avoid_holidays: false }
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [globalRecurrenceSettings, setGlobalRecurrenceSettings] = useState(null);

  useEffect(() => {
    loadTasks();
    loadUsers();
    loadGlobalSettings();
  }, [searchQuery, statusFilter, sortOption, pagination.page]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  const loadGlobalSettings = async () => {
    try {
      const response = await api.get('/recurrence-settings');
      setGlobalRecurrenceSettings(response.data);
    } catch (error) {
      console.error('Failed to load global settings');
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sort: sortOption, // Sends sort option to backend
        parent_recurring_only: 'true',
        search: searchQuery.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      const response = await api.get('/tasks', { params });

      if (response.data && Array.isArray(response.data.tasks)) {
        setTasks(response.data.tasks);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      } else if (Array.isArray(response.data)) {
        setTasks(response.data);
      } else {
        setTasks([]);
      }
    } catch (error) {
      toast.error('Failed to load recurring tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecurrence = async (task) => {
    const isCurrentlyActive = task.is_recurring_active;
    const endpoint = isCurrentlyActive ? 'stop' : 'resume';
    const url = `/recurring-tasks/${task.id}/${endpoint}`;

    try {
      const response = await api.post(url);
      toast.success(response.data.message || `Series ${isCurrentlyActive ? 'stopped' : 'resumed'}`);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_recurring_active: !isCurrentlyActive } : t));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update recurrence status');
    }
  };

  const openEditModal = (task) => {
    const recurrence = task.recurrence || {};
    const override = task.recurrence_override || {};

    setEditingTask(task);
    setEditForm({
      frequency: recurrence.frequency || 'daily',
      interval: recurrence.interval || 1,
      due_in_days: recurrence.due_in_days || 1,
      days_of_week: recurrence.days_of_week || [],
      end_date: recurrence.end_date ? recurrence.end_date.split('T')[0] : '',
      max_occurrences: recurrence.max_occurrences || null,
      recurrence_override: {
        enabled: override.enabled || false,
        avoid_weekends: override.avoid_weekends || globalRecurrenceSettings?.avoid_weekends || 'none',
        avoid_holidays: override.avoid_holidays ?? globalRecurrenceSettings?.avoid_holidays ?? false
      }
    });
    setFormErrors({});
    setEditModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (editForm.interval < 1) errors.interval = 'Number of days/months must be at least 1';
    if (editForm.due_in_days < 1) errors.due_in_days = 'Number of days must be at least 1';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveRecurrence = async () => {
    if (!editingTask || !validateForm()) return;

    setSaving(true);
    try {
      // Restructure payload to match your Task schema exactly
      const updatePayload = {
        recurrence: {
          ...editingTask.recurrence, // Preserve existing internal tracking fields
          frequency: editForm.frequency,
          interval: editForm.interval,
          due_in_days: editForm.due_in_days,
          days_of_week: editForm.frequency === 'weekly' ? editForm.days_of_week : [],
          end_date: editForm.end_date || undefined,
          max_occurrences: editForm.max_occurrences || undefined,
        },
        recurrence_override: editForm.recurrence_override
      };

      // Send to the existing standard Task update route
      await api.put(`/tasks/${editingTask.id}`, updatePayload);

      toast.success('Recurrence settings updated. Changes affect future instances only.');
      setEditModalOpen(false);
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update recurrence settings');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = (task) => {
    if (user.role === 'admin') return true;
    if (task.assigned_by === user.id) return true;
    if (user.role === 'manager') {
      const assignee = users.find(u => u.id === task.assigned_to);
      if (assignee && assignee.department === user.department) return true;
    }
    return false;
  };

  const getFrequencyLabel = (task) => {
    if (!task.recurrence) return 'Not Recurring';
    if (typeof task.recurrence === 'string') {
      if (task.recurrence === 'none') return 'Not Recurring';
      return task.recurrence.charAt(0).toUpperCase() + task.recurrence.slice(1);
    }
    const freq = task.recurrence.frequency;
    const interval = task.recurrence.interval || 1;
    if (!freq || freq === 'none') return 'Not Recurring';
    if (interval === 1) return freq.charAt(0).toUpperCase() + freq.slice(1);
    return `Every ${interval} ${freq === 'daily' ? 'days' : freq === 'weekly' ? 'weeks' : 'months'}`;
  };

  return (
   
      <div className="space-y-6" title="Recurring Work Items">

        {/* Restored Header Exact Wordings */}
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <Repeat className="h-8 w-8 text-primary" />
            Recurring Work Items
          </h1>
          <p className="text-muted-foreground mt-1">Automated scheduling for repetitive operations</p>
          <p className="text-muted-foreground">Manage parent recurring tasks and their schedules</p>
        </div>

        {/* Restored Exact Info Banner */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Task owner, department manager, or admin can edit recurrence settings.
              Changes affect future instances only - past child tasks remain unchanged.
            </div>
          </div>
        </Card>

        {/* Filters including Next Run (Soonest) Dropdown */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recurring tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="next_run_asc">Next Run (Soonest)</SelectItem>
              <SelectItem value="next_run_desc">Next Run (Latest)</SelectItem>
              <SelectItem value="created_at_desc">Newest First</SelectItem>
              <SelectItem value="created_at_asc">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
        ) : tasks.length === 0 ? (
          <Card className="p-12 text-center">
            <Repeat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No recurring tasks found</h3>
            <p className="text-muted-foreground mt-1">No templates match your current filters.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tasks.map((task) => {

              // Robust lookup for accurate names
              const assignedUser = users.find(u => u.id === task.assigned_to);
              const createdByUser = users.find(u => u.id === task.assigned_by);

              return (
                <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <Card className={`p-5 transition-all ${!task.is_recurring_active ? 'opacity-75 grayscale-[0.5] bg-muted/30' : ''}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                      {/* Task Info Restored to Match Your Needs */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg">{task.title}</h3>
                          <Badge variant={task.is_recurring_active ? "default" : "secondary"}>
                            {task.is_recurring_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="capitalize">{task.priority}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Repeat className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">{getFrequencyLabel(task)}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {task.recurrence?.next_run_at
                                ? `Next: ${formatUTCToLocalDateTime(task.recurrence.next_run_at)}`
                                : 'No next run scheduled'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Due in {task.recurrence?.due_in_days || 1} days</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>Assigned to: <strong className="text-foreground">{assignedUser?.name || 'Unassigned'}</strong></span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Created by {createdByUser?.name || 'System'} • {task.recurrence?.occurrences_created || 0} instances created
                          </span>
                          {task.recurrence_override?.enabled && (
                            <Badge variant="outline" className="text-[10px] py-0">Has Override</Badge>
                          )}
                        </div>
                      </div>

                      {/* Restored ALL Actions: Edit, Stop/Resume, Details */}
                      <div className="flex items-center gap-2 shrink-0">
                        {canEdit(task) && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openEditModal(task)}>
                              <Edit2 className="h-4 w-4 mr-2" /> Edit Recurrence
                            </Button>

                            <Button
                              variant={task.is_recurring_active ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleToggleRecurrence(task)}
                              className={task.is_recurring_active ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "bg-emerald-600 hover:bg-emerald-700"}
                            >
                              {task.is_recurring_active ? (
                                <><Pause className="h-4 w-4 mr-2" /> Stop</>
                              ) : (
                                <><Play className="h-4 w-4 mr-2" /> Resume</>
                              )}
                            </Button>
                          </>
                        )}
                        {!canEdit(task) && <span className="text-xs text-muted-foreground italic mr-2">View only</span>}
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/tasks/${task.id}`)}>
                          View Details
                        </Button>
                      </div>

                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Advanced Edit Recurrence Modal (Kept fully intact) */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent aria-describedby="dialog-description" className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Recurrence Settings</DialogTitle>
              {/* This invisible description fixes the accessibility console warning */}
              <DialogDescription id="dialog-description" className="sr-only">
                Modify the frequency and scheduling rules for this recurring task.
              </DialogDescription>
            </DialogHeader>

            {editingTask && (
              <div className="space-y-6 pt-4">
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <h4 className="font-medium">{editingTask.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {editingTask.status === 'completed' && (
                      <span className="text-orange-600">Parent task is completed. Only recurrence settings can be edited.</span>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={editForm.frequency} onValueChange={(value) => setEditForm({ ...editForm, frequency: value })}>
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
                    <Input
                      type="number" min="1" value={editForm.interval}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setEditForm({ ...editForm, interval: value });
                        if (value >= 1 && formErrors.interval) setFormErrors({ ...formErrors, interval: null });
                      }}
                      className={`w-24 ${formErrors.interval ? 'border-red-500' : ''}`}
                    />
                    <span className="text-muted-foreground">
                      {editForm.frequency === 'daily' ? 'day(s)' : editForm.frequency === 'weekly' ? 'week(s)' : 'month(s)'}
                    </span>
                  </div>
                  {formErrors.interval && <p className="text-xs text-red-500 font-medium">{formErrors.interval}</p>}
                </div>

                {editForm.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((day) => (
                        <div key={day.value} className="flex items-center gap-1">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={editForm.days_of_week.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) setEditForm({ ...editForm, days_of_week: [...editForm.days_of_week, day.value].sort() });
                              else setEditForm({ ...editForm, days_of_week: editForm.days_of_week.filter(d => d !== day.value) });
                            }}
                          />
                          <label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">{day.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Due In (days from creation)</Label>
                  <Input
                    type="number" min="1" value={editForm.due_in_days}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setEditForm({ ...editForm, due_in_days: value });
                      if (value >= 1 && formErrors.due_in_days) setFormErrors({ ...formErrors, due_in_days: null });
                    }}
                    className={`w-24 ${formErrors.due_in_days ? 'border-red-500' : ''}`}
                  />
                  {formErrors.due_in_days && <p className="text-xs text-red-500 font-medium">{formErrors.due_in_days}</p>}
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Override Calendar Settings</Label>
                      <p className="text-xs text-muted-foreground">
                        {editForm.recurrence_override.enabled ? 'Using task-specific settings' : 'Using global settings'}
                      </p>
                    </div>
                    <Switch
                      checked={editForm.recurrence_override.enabled}
                      onCheckedChange={(checked) => setEditForm({
                        ...editForm,
                        recurrence_override: {
                          ...editForm.recurrence_override,
                          enabled: checked,
                          ...(checked && globalRecurrenceSettings ? {
                            avoid_weekends: globalRecurrenceSettings.avoid_weekends,
                            avoid_holidays: globalRecurrenceSettings.avoid_holidays
                          } : {})
                        }
                      })}
                    />
                  </div>

                  {editForm.recurrence_override.enabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                      <div>
                        <Label className="text-sm">Weekend Avoidance</Label>
                        <Select
                          value={editForm.recurrence_override.avoid_weekends}
                          onValueChange={(value) => setEditForm({
                            ...editForm, recurrence_override: { ...editForm.recurrence_override, avoid_weekends: value }
                          })}
                        >
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
                        <Switch
                          checked={editForm.recurrence_override.avoid_holidays}
                          onCheckedChange={(checked) => setEditForm({
                            ...editForm, recurrence_override: { ...editForm.recurrence_override, avoid_holidays: checked }
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveRecurrence} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  
  );
}
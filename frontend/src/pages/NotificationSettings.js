import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Bell, Clock, AlertTriangle, Save, Sun, Moon, Calendar, MessageSquare, Smartphone, Check, X } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { api } from '../App';
import { toast } from 'sonner';
import { localTimeToUTCTime, utcTimeToLocalTime } from '../utils/timezone';

export default function NotificationSettings({ user }) {
  const [settings, setSettings] = useState(null);
  const [recurrenceSettings, setRecurrenceSettings] = useState(null);
  const [whatsappSettings, setWhatsappSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRecurrence, setSavingRecurrence] = useState(false);
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);
  const [newHoliday, setNewHoliday] = useState('');

  useEffect(() => {
    if (user.role !== 'admin') {
      toast.error('Access denied - Admin only');
      return;
    }
    loadSettings();
    loadRecurrenceSettings();
    loadWhatsAppSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const response = await api.get('/notification-settings');
      const data = response.data;
      
      // Convert UTC times to local for display
      if (data.reminder_digests) {
        if (data.reminder_digests.start_of_day?.time) {
          data.reminder_digests.start_of_day.time = utcTimeToLocalTime(data.reminder_digests.start_of_day.time);
        }
        if (data.reminder_digests.end_of_day?.time) {
          data.reminder_digests.end_of_day.time = utcTimeToLocalTime(data.reminder_digests.end_of_day.time);
        }
      }
      
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppSettings = async () => {
    try {
      const response = await api.get('/whatsapp-settings');
      setWhatsappSettings(response.data);
    } catch (error) {
      console.error('Failed to load WhatsApp settings:', error);
      // Set defaults if endpoint fails
      setWhatsappSettings({
        enabled: false,
        notification_types: {
          otp: true,
          task_assigned: true,
          status_update: true,
          overdue_alert: true,
          deadline_warning: true,
          recurring_digest: true,
          task_completed: true
        },
        twilio_configured: false
      });
    }
  };

  const saveWhatsAppSettings = async () => {
    setSavingWhatsApp(true);
    try {
      await api.put('/whatsapp-settings', {
        enabled: whatsappSettings.enabled,
        notification_types: whatsappSettings.notification_types
      });
      toast.success('WhatsApp settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save WhatsApp settings');
    } finally {
      setSavingWhatsApp(false);
    }
  };

  const loadRecurrenceSettings = async () => {
    try {
      const response = await api.get('/recurrence-settings');
      setRecurrenceSettings(response.data);
    } catch (error) {
      console.error('Failed to load recurrence settings');
      setRecurrenceSettings({
        avoid_weekends: 'none',
        avoid_holidays: false,
        holiday_list: []
      });
    }
  };

  const handleAddDeadlineAlert = () => {
    const newAlert = { hours_before: 1, enabled: true };
    setSettings({
      ...settings,
      deadline_alerts: [...settings.deadline_alerts, newAlert]
    });
  };

  const handleRemoveDeadlineAlert = (index) => {
    const newAlerts = settings.deadline_alerts.filter((_, i) => i !== index);
    setSettings({
      ...settings,
      deadline_alerts: newAlerts
    });
  };

  const handleDeadlineAlertChange = (index, field, value) => {
    const newAlerts = [...settings.deadline_alerts];
    newAlerts[index] = {
      ...newAlerts[index],
      [field]: field === 'hours_before' ? parseInt(value) || 0 : value
    };
    setSettings({
      ...settings,
      deadline_alerts: newAlerts
    });
  };

  const handleOverdueAlertChange = (field, value) => {
    setSettings({
      ...settings,
      overdue_alert: {
        ...settings.overdue_alert,
        [field]: field === 'repeat_every_hours' ? parseInt(value) || 0 : value
      }
    });
  };

  const handleChannelChange = (field, value) => {
    setSettings({
      ...settings,
      channels: {
        ...settings.channels,
        [field]: value
      }
    });
  };

  const validateSettings = () => {
    // Check for duplicate hours_before values
    const hours = settings.deadline_alerts.map(a => a.hours_before);
    const duplicates = hours.filter((hour, index) => hours.indexOf(hour) !== index);
    
    if (duplicates.length > 0) {
      toast.error(`Duplicate deadline alert hours: ${duplicates.join(', ')}`);
      return false;
    }

    // Check for invalid hours
    const invalidHours = settings.deadline_alerts.filter(a => a.hours_before <= 0);
    if (invalidHours.length > 0) {
      toast.error('All deadline alert hours must be greater than 0');
      return false;
    }

    // Check overdue repeat interval
    if (settings.overdue_alert.enabled && settings.overdue_alert.repeat_every_hours <= 0) {
      toast.error('Overdue repeat interval must be greater than 0');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    setSaving(true);
    try {
      // Create payload with times converted to UTC
      const reminderDigests = settings.reminder_digests ? { ...settings.reminder_digests } : null;
      
      if (reminderDigests) {
        // Convert start_of_day time from local to UTC
        if (reminderDigests.start_of_day?.time) {
          reminderDigests.start_of_day = {
            ...reminderDigests.start_of_day,
            time: localTimeToUTCTime(reminderDigests.start_of_day.time)
          };
        }
        // Convert end_of_day time from local to UTC
        if (reminderDigests.end_of_day?.time) {
          reminderDigests.end_of_day = {
            ...reminderDigests.end_of_day,
            time: localTimeToUTCTime(reminderDigests.end_of_day.time)
          };
        }
      }

      const payload = {
        deadline_alerts: settings.deadline_alerts,
        overdue_alert: settings.overdue_alert,
        channels: settings.channels,
        reminder_digests: reminderDigests
      };
      
      await api.put('/notification-settings', payload);
      toast.success('Notification settings saved successfully');
      loadSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReminderDigestsChange = (field, value) => {
    setSettings({
      ...settings,
      reminder_digests: {
        ...settings.reminder_digests,
        [field]: value
      }
    });
  };

  const handleStartOfDayChange = (field, value) => {
    setSettings({
      ...settings,
      reminder_digests: {
        ...settings.reminder_digests,
        start_of_day: {
          ...settings.reminder_digests?.start_of_day,
          [field]: value
        }
      }
    });
  };

  const handleEndOfDayChange = (field, value) => {
    setSettings({
      ...settings,
      reminder_digests: {
        ...settings.reminder_digests,
        end_of_day: {
          ...settings.reminder_digests?.end_of_day,
          [field]: value
        }
      }
    });
  };

  const handleStartIncludeChange = (field, value) => {
    setSettings({
      ...settings,
      reminder_digests: {
        ...settings.reminder_digests,
        start_of_day: {
          ...settings.reminder_digests?.start_of_day,
          include: {
            ...settings.reminder_digests?.start_of_day?.include,
            [field]: value
          }
        }
      }
    });
  };

  const handleEndIncludeChange = (field, value) => {
    setSettings({
      ...settings,
      reminder_digests: {
        ...settings.reminder_digests,
        end_of_day: {
          ...settings.reminder_digests?.end_of_day,
          include: {
            ...settings.reminder_digests?.end_of_day?.include,
            [field]: value
          }
        }
      }
    });
  };

  // Recurrence Calendar Settings Handlers
  const handleSaveRecurrenceSettings = async () => {
    setSavingRecurrence(true);
    try {
      await api.put('/recurrence-settings', recurrenceSettings);
      toast.success('Recurrence calendar settings saved successfully');
      loadRecurrenceSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save recurrence settings');
    } finally {
      setSavingRecurrence(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday) {
      toast.error('Please enter a date');
      return;
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newHoliday)) {
      toast.error('Invalid date format. Use YYYY-MM-DD');
      return;
    }
    
    try {
      await api.post(`/recurrence-settings/holidays?holiday_date=${newHoliday}`);
      setNewHoliday('');
      loadRecurrenceSettings();
      toast.success('Holiday added');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add holiday');
    }
  };

  const handleRemoveHoliday = async (date) => {
    try {
      await api.delete(`/recurrence-settings/holidays?holiday_date=${date}`);
      loadRecurrenceSettings();
      toast.success('Holiday removed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove holiday');
    }
  };

  if (user.role !== 'admin') {
    return (
   
        <div className="flex items-center justify-center h-96">
          <Card className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-heading font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">This page is only accessible to administrators.</p>
          </Card>
        </div>
      
    );
  }

  if (loading) {
    return (
    
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    
    );
  }

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight" data-testid="notification-settings-heading">
              Notification Settings
            </h1>
            <p className="text-muted-foreground mt-2">Configure automated task notifications and alerts</p>
          </div>
          <Button onClick={handleSave} disabled={saving} data-testid="save-settings-button">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Deadline Alerts Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-semibold">Deadline Alerts</h3>
                  <p className="text-sm text-muted-foreground">
                    Notify users when tasks are approaching their due date
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {settings.deadline_alerts.map((alert, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg"
                    data-testid={`deadline-alert-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.enabled}
                        onCheckedChange={(checked) => 
                          handleDeadlineAlertChange(index, 'enabled', checked)
                        }
                        data-testid={`deadline-alert-enabled-${index}`}
                      />
                      <Label className="text-sm">Enabled</Label>
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                      <Label className="text-sm whitespace-nowrap">Alert</Label>
                      <Input
                        type="number"
                        min="1"
                        value={alert.hours_before}
                        onChange={(e) => 
                          handleDeadlineAlertChange(index, 'hours_before', e.target.value)
                        }
                        className="w-24"
                        data-testid={`deadline-alert-hours-${index}`}
                      />
                      <Label className="text-sm">hours before deadline</Label>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDeadlineAlert(index)}
                      disabled={settings.deadline_alerts.length === 1}
                      data-testid={`remove-deadline-alert-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={handleAddDeadlineAlert}
                  className="w-full"
                  data-testid="add-deadline-alert-button"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deadline Alert
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Overdue Escalation Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-semibold">Overdue Task Escalation</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically notify when tasks are overdue and still in progress
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Enable Overdue Alerts</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send notifications for overdue tasks
                    </p>
                  </div>
                  <Switch
                    checked={settings.overdue_alert.enabled}
                    onCheckedChange={(checked) => 
                      handleOverdueAlertChange('enabled', checked)
                    }
                    data-testid="overdue-alert-enabled"
                  />
                </div>

                {settings.overdue_alert.enabled && (
                  <>
                    <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Repeat alerts every</Label>
                        <Input
                          type="number"
                          min="1"
                          value={settings.overdue_alert.repeat_every_hours}
                          onChange={(e) => 
                            handleOverdueAlertChange('repeat_every_hours', e.target.value)
                          }
                          className="w-24"
                          data-testid="overdue-repeat-hours"
                        />
                        <Label className="text-sm">hours</Label>
                      </div>

                      <div>
                        <Label className="text-base font-medium mb-3 block">
                          Notify Recipients
                        </Label>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                            <div>
                              <Label className="text-sm font-medium">Task Assignee</Label>
                              <p className="text-xs text-muted-foreground">
                                User assigned to the task
                              </p>
                            </div>
                            <Switch
                              checked={settings.overdue_alert.notify_assignee}
                              onCheckedChange={(checked) => 
                                handleOverdueAlertChange('notify_assignee', checked)
                              }
                              data-testid="overdue-notify-assignee"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                            <div>
                              <Label className="text-sm font-medium">Task Creator</Label>
                              <p className="text-xs text-muted-foreground">
                                User who created the task
                              </p>
                            </div>
                            <Switch
                              checked={settings.overdue_alert.notify_creator}
                              onCheckedChange={(checked) => 
                                handleOverdueAlertChange('notify_creator', checked)
                              }
                              data-testid="overdue-notify-creator"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                            <div>
                              <Label className="text-sm font-medium">System Admins</Label>
                              <p className="text-xs text-muted-foreground">
                                All users with admin role
                              </p>
                            </div>
                            <Switch
                              checked={settings.overdue_alert.notify_admin}
                              onCheckedChange={(checked) => 
                                handleOverdueAlertChange('notify_admin', checked)
                              }
                              data-testid="overdue-notify-admin"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Reminder Digests Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-100 to-indigo-100 dark:from-amber-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                  <Sun className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-semibold">Reminder Digests</h3>
                  <p className="text-sm text-muted-foreground">
                    Daily task summaries shown as pop-up reminders on app load
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Enable Reminder Digests</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Show daily task summaries as pop-up modals
                    </p>
                  </div>
                  <Switch
                    checked={settings.reminder_digests?.enabled || false}
                    onCheckedChange={(checked) => 
                      handleReminderDigestsChange('enabled', checked)
                    }
                    data-testid="reminder-digests-enabled"
                  />
                </div>

                {settings.reminder_digests?.enabled && (
                  <div className="space-y-6 pl-4 border-l-2 border-primary/20">
                    {/* Start of Day Digest */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Sun className="h-5 w-5 text-amber-500" />
                        <div className="flex-1">
                          <Label className="text-base font-medium">Start of Day Digest</Label>
                          <p className="text-xs text-muted-foreground">
                            Morning summary of tasks for the day ahead
                          </p>
                        </div>
                        <Switch
                          checked={settings.reminder_digests?.start_of_day?.enabled || false}
                          onCheckedChange={(checked) => 
                            handleStartOfDayChange('enabled', checked)
                          }
                          data-testid="start-of-day-enabled"
                        />
                      </div>

                      {settings.reminder_digests?.start_of_day?.enabled && (
                        <div className="space-y-4 ml-8 p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Show digest at</Label>
                            <Input
                              type="time"
                              value={settings.reminder_digests?.start_of_day?.time || '09:00'}
                              onChange={(e) => 
                                handleStartOfDayChange('time', e.target.value)
                              }
                              className="w-32"
                              data-testid="start-of-day-time"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Label className="text-sm">&quot;Due soon&quot; threshold</Label>
                            <Input
                              type="number"
                              min="1"
                              value={settings.reminder_digests?.start_of_day?.due_soon_threshold_hours || 48}
                              onChange={(e) => 
                                handleStartOfDayChange('due_soon_threshold_hours', parseInt(e.target.value) || 48)
                              }
                              className="w-20"
                              data-testid="start-due-soon-threshold"
                            />
                            <Label className="text-sm">hours</Label>
                          </div>

                          <div>
                            <Label className="text-sm font-medium mb-2 block">Include in digest:</Label>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-background rounded">
                                <Label className="text-sm">Overdue tasks</Label>
                                <Switch
                                  checked={settings.reminder_digests?.start_of_day?.include?.overdue !== false}
                                  onCheckedChange={(checked) => 
                                    handleStartIncludeChange('overdue', checked)
                                  }
                                  data-testid="start-include-overdue"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-background rounded">
                                <Label className="text-sm">Items due today</Label>
                                <Switch
                                  checked={settings.reminder_digests?.start_of_day?.include?.due_today !== false}
                                  onCheckedChange={(checked) => 
                                    handleStartIncludeChange('due_today', checked)
                                  }
                                  data-testid="start-include-due-today"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-background rounded">
                                <Label className="text-sm">Items due soon</Label>
                                <Switch
                                  checked={settings.reminder_digests?.start_of_day?.include?.due_soon !== false}
                                  onCheckedChange={(checked) => 
                                    handleStartIncludeChange('due_soon', checked)
                                  }
                                  data-testid="start-include-due-soon"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* End of Day Digest */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Moon className="h-5 w-5 text-indigo-500" />
                        <div className="flex-1">
                          <Label className="text-base font-medium">End of Day Digest</Label>
                          <p className="text-xs text-muted-foreground">
                            Evening summary of remaining work items
                          </p>
                        </div>
                        <Switch
                          checked={settings.reminder_digests?.end_of_day?.enabled || false}
                          onCheckedChange={(checked) => 
                            handleEndOfDayChange('enabled', checked)
                          }
                          data-testid="end-of-day-enabled"
                        />
                      </div>

                      {settings.reminder_digests?.end_of_day?.enabled && (
                        <div className="space-y-4 ml-8 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Show digest at</Label>
                            <Input
                              type="time"
                              value={settings.reminder_digests?.end_of_day?.time || '18:00'}
                              onChange={(e) => 
                                handleEndOfDayChange('time', e.target.value)
                              }
                              className="w-32"
                              data-testid="end-of-day-time"
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium mb-2 block">Include in digest:</Label>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-background rounded">
                                <Label className="text-sm">Overdue tasks</Label>
                                <Switch
                                  checked={settings.reminder_digests?.end_of_day?.include?.overdue !== false}
                                  onCheckedChange={(checked) => 
                                    handleEndIncludeChange('overdue', checked)
                                  }
                                  data-testid="end-include-overdue"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-background rounded">
                                <Label className="text-sm">In-progress tasks</Label>
                                <Switch
                                  checked={settings.reminder_digests?.end_of_day?.include?.in_progress !== false}
                                  onCheckedChange={(checked) => 
                                    handleEndIncludeChange('in_progress', checked)
                                  }
                                  data-testid="end-include-in-progress"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Notification Channels Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-semibold">Notification Channels</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose how notifications are delivered
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Show notifications in the bell icon menu
                    </p>
                  </div>
                  <Switch
                    checked={settings.channels.in_app}
                    onCheckedChange={(checked) => 
                      handleChannelChange('in_app', checked)
                    }
                    data-testid="channel-in-app"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send notifications via email (requires email service setup)
                    </p>
                  </div>
                  <Switch
                    checked={settings.channels.email}
                    onCheckedChange={(checked) => 
                      handleChannelChange('email', checked)
                    }
                    data-testid="channel-email"
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* WhatsApp Notification Settings Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-semibold">WhatsApp Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      Send notifications via WhatsApp using Twilio
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={saveWhatsAppSettings} 
                  disabled={savingWhatsApp}
                  variant="outline"
                  data-testid="save-whatsapp-settings"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingWhatsApp ? 'Saving...' : 'Save WhatsApp Settings'}
                </Button>
              </div>

              {whatsappSettings && (
                <div className="space-y-6">
                  {/* Twilio Status */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    {whatsappSettings.twilio_configured ? (
                      <>
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">
                          Twilio WhatsApp is configured and ready
                        </span>
                      </>
                    ) : (
                      <>
                        <X className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-600 dark:text-red-400">
                          Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER to enable.
                        </span>
                      </>
                    )}
                  </div>

                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Enable WhatsApp Notifications</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Send notifications to users' phone numbers via WhatsApp
                      </p>
                    </div>
                    <Switch
                      checked={whatsappSettings.enabled}
                      onCheckedChange={(checked) => setWhatsappSettings({
                        ...whatsappSettings,
                        enabled: checked
                      })}
                      disabled={!whatsappSettings.twilio_configured}
                      data-testid="whatsapp-enabled-toggle"
                    />
                  </div>

                  {/* Notification Types */}
                  {whatsappSettings.enabled && (
                    <div className="space-y-4">
                      <Label className="text-base font-medium">Notification Types</Label>
                      <p className="text-sm text-muted-foreground">
                        Select which notification types should be sent via WhatsApp
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: 'otp', label: 'OTP Login Codes', description: 'Send login verification codes' },
                          { key: 'task_assigned', label: 'Task Assignment', description: 'New task assignments' },
                          { key: 'status_update', label: 'Status Updates', description: 'Task status changes' },
                          { key: 'overdue_alert', label: 'Overdue Alerts', description: 'Overdue task notifications' },
                          { key: 'deadline_warning', label: 'Deadline Warnings', description: 'Approaching deadlines' },
                          { key: 'recurring_digest', label: 'Recurring Digests', description: 'New recurring task instances' },
                          { key: 'task_completed', label: 'Task Completed', description: 'Task completion notifications' }
                        ].map(type => (
                          <div 
                            key={type.key}
                            className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                          >
                            <div>
                              <Label className="text-sm font-medium">{type.label}</Label>
                              <p className="text-xs text-muted-foreground">{type.description}</p>
                            </div>
                            <Switch
                              checked={whatsappSettings.notification_types?.[type.key] ?? true}
                              onCheckedChange={(checked) => setWhatsappSettings({
                                ...whatsappSettings,
                                notification_types: {
                                  ...whatsappSettings.notification_types,
                                  [type.key]: checked
                                }
                              })}
                              data-testid={`whatsapp-type-${type.key}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info Banner */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> WhatsApp messages will be sent to users' phone numbers. 
                        Ensure users have valid phone numbers in their profiles. 
                        Using Twilio's WhatsApp Sandbox requires users to first opt-in by sending a message.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Recurrence Calendar Settings Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-semibold">Recurrence Calendar Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure global holiday and weekend avoidance for recurring tasks
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleSaveRecurrenceSettings} 
                  disabled={savingRecurrence}
                  variant="outline"
                  data-testid="save-recurrence-settings"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingRecurrence ? 'Saving...' : 'Save Calendar Settings'}
                </Button>
              </div>

              {recurrenceSettings && (
                <div className="space-y-6">
                  {/* Weekend Avoidance */}
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Weekend Avoidance</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Skip weekends when scheduling recurring task instances
                        </p>
                      </div>
                      <Select
                        value={recurrenceSettings.avoid_weekends}
                        onValueChange={(value) => setRecurrenceSettings({
                          ...recurrenceSettings,
                          avoid_weekends: value
                        })}
                      >
                        <SelectTrigger className="w-[200px]" data-testid="avoid-weekends-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No weekend skip</SelectItem>
                          <SelectItem value="sunday_only">Skip Sundays only</SelectItem>
                          <SelectItem value="sat_sun">Skip Saturday & Sunday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Holiday Avoidance Toggle */}
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Holiday Avoidance</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Skip dates in the holiday list when scheduling recurring tasks
                        </p>
                      </div>
                      <Switch
                        checked={recurrenceSettings.avoid_holidays}
                        onCheckedChange={(checked) => setRecurrenceSettings({
                          ...recurrenceSettings,
                          avoid_holidays: checked
                        })}
                        data-testid="avoid-holidays-switch"
                      />
                    </div>
                  </div>

                  {/* Holiday List Management */}
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <Label className="text-base font-medium mb-4 block">Holiday List</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage the list of dates to skip for recurring tasks
                    </p>
                    
                    {/* Add Holiday Input */}
                    <div className="flex gap-2 mb-4">
                      <Input
                        type="date"
                        value={newHoliday}
                        onChange={(e) => setNewHoliday(e.target.value)}
                        placeholder="Select date"
                        data-testid="new-holiday-input"
                      />
                      <Button 
                        onClick={handleAddHoliday}
                        variant="outline"
                        data-testid="add-holiday-button"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Holiday
                      </Button>
                    </div>

                    {/* Holiday List */}
                    {recurrenceSettings.holiday_list?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {recurrenceSettings.holiday_list.sort().map((date) => (
                          <Badge
                            key={date}
                            variant="secondary"
                            className="px-3 py-1 flex items-center gap-2"
                          >
                            {date}
                            <button
                              onClick={() => handleRemoveHoliday(date)}
                              className="text-muted-foreground hover:text-destructive"
                              data-testid={`remove-holiday-${date}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No holidays configured. Add dates above to skip them in recurring task schedules.
                      </p>
                    )}
                  </div>

                  {/* Info Note */}
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Note:</strong> These settings apply globally to all recurring tasks unless a task has its own calendar override enabled. 
                      When a recurring task's next run date falls on an avoided day, it will be automatically shifted to the next valid working day.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg" data-testid="save-settings-bottom-button">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
  
  );
}

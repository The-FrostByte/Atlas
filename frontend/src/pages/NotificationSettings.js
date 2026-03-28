import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, Bell, Clock, AlertTriangle, Save,
  Sun, Moon, Calendar, MessageSquare, Smartphone, Check, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { api } from '../App';
import { toast } from 'sonner';
import { localTimeToUTCTime, utcTimeToLocalTime } from '../utils/timezone';
import { isSystemAdmin } from '../utils/permissions';

// user is passed as a prop from App.js — no AuthContext needed.
// App.js already guards this route: only admins reach this component.
export default function NotificationSettings({ user }) {

  const isAdmin = isSystemAdmin(user);

  const [settings, setSettings] = useState(null);
  const [recurrenceSettings, setRecurrenceSettings] = useState(null);
  const [whatsappSettings, setWhatsappSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRecurrence, setSavingRecurrence] = useState(false);
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);
  const [newHoliday, setNewHoliday] = useState('');

  useEffect(() => {
    if (!isAdmin) return; // App.js already redirects, but belt-and-suspenders
    loadSettings();
    loadRecurrenceSettings();
    loadWhatsAppSettings();
  }, [isAdmin]);

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/notification-settings');
      if (data.reminder_digests) {
        if (data.reminder_digests.start_of_day?.time)
          data.reminder_digests.start_of_day.time = utcTimeToLocalTime(data.reminder_digests.start_of_day.time);
        if (data.reminder_digests.end_of_day?.time)
          data.reminder_digests.end_of_day.time = utcTimeToLocalTime(data.reminder_digests.end_of_day.time);
      }
      setSettings(data);
    } catch { toast.error('Failed to load notification settings'); }
    finally { setLoading(false); }
  };

  const loadWhatsAppSettings = async () => {
    try {
      const { data } = await api.get('/whatsapp-settings');
      setWhatsappSettings(data);
    } catch {
      setWhatsappSettings({
        enabled: false,
        notification_types: { otp: true, task_assigned: true, status_update: true, overdue_alert: true, deadline_warning: true, recurring_digest: true, task_completed: true },
        twilio_configured: false
      });
    }
  };

  const loadRecurrenceSettings = async () => {
    try {
      const { data } = await api.get('/recurrence-settings');
      setRecurrenceSettings(data);
    } catch {
      setRecurrenceSettings({ avoid_weekends: 'none', avoid_holidays: false, holiday_list: [] });
    }
  };

  const saveWhatsAppSettings = async () => {
    setSavingWhatsApp(true);
    try {
      await api.put('/whatsapp-settings', { enabled: whatsappSettings.enabled, notification_types: whatsappSettings.notification_types });
      toast.success('WhatsApp settings saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save WhatsApp settings'); }
    finally { setSavingWhatsApp(false); }
  };

  const validateSettings = () => {
    const hours = settings.deadline_alerts.map(a => a.hours_before);
    const dupes = hours.filter((h, i) => hours.indexOf(h) !== i);
    if (dupes.length) { toast.error(`Duplicate deadline alert hours: ${dupes.join(', ')}`); return false; }
    if (settings.deadline_alerts.some(a => a.hours_before <= 0)) { toast.error('All hours must be > 0'); return false; }
    if (settings.overdue_alert.enabled && settings.overdue_alert.repeat_every_hours <= 0) { toast.error('Repeat interval must be > 0'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;
    setSaving(true);
    try {
      const digests = settings.reminder_digests ? { ...settings.reminder_digests } : null;
      if (digests?.start_of_day?.time) digests.start_of_day = { ...digests.start_of_day, time: localTimeToUTCTime(digests.start_of_day.time) };
      if (digests?.end_of_day?.time) digests.end_of_day = { ...digests.end_of_day, time: localTimeToUTCTime(digests.end_of_day.time) };
      await api.put('/notification-settings', { deadline_alerts: settings.deadline_alerts, overdue_alert: settings.overdue_alert, channels: settings.channels, reminder_digests: digests });
      toast.success('Notification settings saved');
      loadSettings();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleSaveRecurrenceSettings = async () => {
    setSavingRecurrence(true);
    try {
      await api.put('/recurrence-settings', recurrenceSettings);
      toast.success('Recurrence calendar settings saved');
      loadRecurrenceSettings();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save recurrence settings'); }
    finally { setSavingRecurrence(false); }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday) { toast.error('Please enter a date'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) { toast.error('Use YYYY-MM-DD format'); return; }
    try {
      await api.post(`/recurrence-settings/holidays?holiday_date=${newHoliday}`);
      setNewHoliday('');
      loadRecurrenceSettings();
      toast.success('Holiday added');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to add holiday'); }
  };

  const handleRemoveHoliday = async (date) => {
    try {
      await api.delete(`/recurrence-settings/holidays?holiday_date=${date}`);
      loadRecurrenceSettings();
      toast.success('Holiday removed');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to remove holiday'); }
  };

  // Double-guard: App.js already redirects non-admins, but show a clear message just in case
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">This page is only accessible to administrators.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Settings</h1>
          <p className="text-muted-foreground mt-1">Configure automated task notifications and alerts</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Deadline Alerts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Deadline Alerts</h3>
                <p className="text-sm text-muted-foreground">Notify users when tasks are approaching their due date</p>
              </div>
            </div>
            <div className="space-y-4">
              {settings.deadline_alerts.map((alert, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Switch checked={alert.enabled}
                      onCheckedChange={checked => {
                        const n = [...settings.deadline_alerts]; n[index] = { ...n[index], enabled: checked };
                        setSettings({ ...settings, deadline_alerts: n });
                      }} />
                    <Label className="text-sm">Enabled</Label>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-sm whitespace-nowrap">Alert</Label>
                    <Input type="number" min="1" value={alert.hours_before} className="w-24"
                      onChange={e => {
                        const n = [...settings.deadline_alerts];
                        n[index] = { ...n[index], hours_before: parseInt(e.target.value) || 0 };
                        setSettings({ ...settings, deadline_alerts: n });
                      }} />
                    <Label className="text-sm">hours before deadline</Label>
                  </div>
                  <Button variant="ghost" size="icon" disabled={settings.deadline_alerts.length === 1}
                    onClick={() => setSettings({ ...settings, deadline_alerts: settings.deadline_alerts.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full"
                onClick={() => setSettings({ ...settings, deadline_alerts: [...settings.deadline_alerts, { hours_before: 24, enabled: true }] })}>
                <Plus className="mr-2 h-4 w-4" /> Add Deadline Alert
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Overdue Escalation */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Overdue Task Escalation</h3>
                <p className="text-sm text-muted-foreground">Automatically notify when tasks are overdue</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Overdue Alerts</Label>
                  <p className="text-sm text-muted-foreground mt-1">Send notifications for overdue tasks</p>
                </div>
                <Switch checked={settings.overdue_alert.enabled}
                  onCheckedChange={checked => setSettings({ ...settings, overdue_alert: { ...settings.overdue_alert, enabled: checked } })} />
              </div>
              {settings.overdue_alert.enabled && (
                <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Repeat alerts every</Label>
                    <Input type="number" min="1" value={settings.overdue_alert.repeat_every_hours} className="w-24"
                      onChange={e => setSettings({ ...settings, overdue_alert: { ...settings.overdue_alert, repeat_every_hours: parseInt(e.target.value) || 0 } })} />
                    <Label className="text-sm">hours</Label>
                  </div>
                  <div className="space-y-2">
                    {[
                      ['notify_assignee', 'Task Assignee', 'User assigned to the task'],
                      ['notify_creator', 'Task Creator', 'User who created the task'],
                      ['notify_admin', 'System Admins', 'All users with admin role'],
                    ].map(([field, label, desc]) => (
                      <div key={field} className="flex items-center justify-between p-3 bg-background rounded-lg">
                        <div>
                          <Label className="text-sm font-medium">{label}</Label>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <Switch checked={settings.overdue_alert[field]}
                          onCheckedChange={checked => setSettings({ ...settings, overdue_alert: { ...settings.overdue_alert, [field]: checked } })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Reminder Digests */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Sun className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Reminder Digests</h3>
                <p className="text-sm text-muted-foreground">Daily task summaries shown as pop-up reminders</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <Label className="text-base font-medium">Enable Reminder Digests</Label>
                  <p className="text-sm text-muted-foreground mt-1">Show daily task summaries as pop-up modals</p>
                </div>
                <Switch checked={settings.reminder_digests?.enabled || false}
                  onCheckedChange={checked => setSettings({ ...settings, reminder_digests: { ...settings.reminder_digests, enabled: checked } })} />
              </div>
              {settings.reminder_digests?.enabled && (
                <div className="space-y-6 pl-4 border-l-2 border-primary/20">
                  {/* Start of Day */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Sun className="h-5 w-5 text-amber-500" />
                      <div className="flex-1">
                        <Label className="text-base font-medium">Start of Day Digest</Label>
                        <p className="text-xs text-muted-foreground">Morning summary of tasks</p>
                      </div>
                      <Switch checked={settings.reminder_digests?.start_of_day?.enabled || false}
                        onCheckedChange={checked => setSettings({ ...settings, reminder_digests: { ...settings.reminder_digests, start_of_day: { ...settings.reminder_digests?.start_of_day, enabled: checked } } })} />
                    </div>
                    {settings.reminder_digests?.start_of_day?.enabled && (
                      <div className="space-y-3 ml-8 p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Show at</Label>
                          <Input type="time" className="w-32" value={settings.reminder_digests?.start_of_day?.time || '09:00'}
                            onChange={e => setSettings({ ...settings, reminder_digests: { ...settings.reminder_digests, start_of_day: { ...settings.reminder_digests.start_of_day, time: e.target.value } } })} />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* End of Day */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Moon className="h-5 w-5 text-indigo-500" />
                      <div className="flex-1">
                        <Label className="text-base font-medium">End of Day Digest</Label>
                        <p className="text-xs text-muted-foreground">Evening summary of remaining work</p>
                      </div>
                      <Switch checked={settings.reminder_digests?.end_of_day?.enabled || false}
                        onCheckedChange={checked => setSettings({ ...settings, reminder_digests: { ...settings.reminder_digests, end_of_day: { ...settings.reminder_digests?.end_of_day, enabled: checked } } })} />
                    </div>
                    {settings.reminder_digests?.end_of_day?.enabled && (
                      <div className="space-y-3 ml-8 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Show at</Label>
                          <Input type="time" className="w-32" value={settings.reminder_digests?.end_of_day?.time || '18:00'}
                            onChange={e => setSettings({ ...settings, reminder_digests: { ...settings.reminder_digests, end_of_day: { ...settings.reminder_digests.end_of_day, time: e.target.value } } })} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Notification Channels */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Notification Channels</h3>
                <p className="text-sm text-muted-foreground">Choose how notifications are delivered</p>
              </div>
            </div>
            <div className="space-y-4">
              {[['in_app', 'In-App Notifications', 'Show in the bell icon menu'], ['email', 'Email Notifications', 'Send via email (requires email service)']].map(([field, label, desc]) => (
                <div key={field} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">{label}</Label>
                    <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                  </div>
                  <Switch checked={settings.channels[field]}
                    onCheckedChange={checked => setSettings({ ...settings, channels: { ...settings.channels, [field]: checked } })} />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* WhatsApp Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">WhatsApp Notifications</h3>
                  <p className="text-sm text-muted-foreground">Send notifications via WhatsApp using Twilio</p>
                </div>
              </div>
              <Button variant="outline" onClick={saveWhatsAppSettings} disabled={savingWhatsApp}>
                <Save className="mr-2 h-4 w-4" />
                {savingWhatsApp ? 'Saving...' : 'Save WhatsApp Settings'}
              </Button>
            </div>
            {whatsappSettings && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  {whatsappSettings.twilio_configured
                    ? <><Check className="h-5 w-5 text-green-500" /><span className="text-sm text-green-600 dark:text-green-400">Twilio WhatsApp is configured and ready</span></>
                    : <><X className="h-5 w-5 text-red-500" /><span className="text-sm text-red-600 dark:text-red-400">Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER to .env</span></>}
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Enable WhatsApp Notifications</Label>
                    <p className="text-sm text-muted-foreground mt-1">Send notifications to users via WhatsApp</p>
                  </div>
                  <Switch checked={whatsappSettings.enabled} disabled={!whatsappSettings.twilio_configured}
                    onCheckedChange={checked => setWhatsappSettings({ ...whatsappSettings, enabled: checked })} />
                </div>
                {whatsappSettings.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'otp', label: 'OTP Login Codes', desc: 'Send login verification codes' },
                      { key: 'task_assigned', label: 'Task Assignment', desc: 'New task assignments' },
                      { key: 'status_update', label: 'Status Updates', desc: 'Task status changes' },
                      { key: 'overdue_alert', label: 'Overdue Alerts', desc: 'Overdue task notifications' },
                      { key: 'deadline_warning', label: 'Deadline Warnings', desc: 'Approaching deadlines' },
                      { key: 'recurring_digest', label: 'Recurring Digests', desc: 'New recurring task instances' },
                      { key: 'task_completed', label: 'Task Completed', desc: 'Task completion notifications' },
                    ].map(type => (
                      <div key={type.key} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                        <div>
                          <Label className="text-sm font-medium">{type.label}</Label>
                          <p className="text-xs text-muted-foreground">{type.desc}</p>
                        </div>
                        <Switch checked={whatsappSettings.notification_types?.[type.key] ?? true}
                          onCheckedChange={checked => setWhatsappSettings({ ...whatsappSettings, notification_types: { ...whatsappSettings.notification_types, [type.key]: checked } })} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Recurrence Calendar Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Recurrence Calendar Settings</h3>
                  <p className="text-sm text-muted-foreground">Configure global holiday and weekend avoidance</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleSaveRecurrenceSettings} disabled={savingRecurrence}>
                <Save className="mr-2 h-4 w-4" />
                {savingRecurrence ? 'Saving...' : 'Save Calendar Settings'}
              </Button>
            </div>
            {recurrenceSettings && (
              <div className="space-y-6">
                <div className="p-4 bg-secondary/50 rounded-lg flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Weekend Avoidance</Label>
                    <p className="text-sm text-muted-foreground mt-1">Skip weekends when scheduling recurring tasks</p>
                  </div>
                  <Select value={recurrenceSettings.avoid_weekends}
                    onValueChange={v => setRecurrenceSettings({ ...recurrenceSettings, avoid_weekends: v })}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No weekend skip</SelectItem>
                      <SelectItem value="sunday_only">Skip Sundays only</SelectItem>
                      <SelectItem value="sat_sun">Skip Saturday & Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 bg-secondary/50 rounded-lg flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Holiday Avoidance</Label>
                    <p className="text-sm text-muted-foreground mt-1">Skip holiday list dates for recurring tasks</p>
                  </div>
                  <Switch checked={recurrenceSettings.avoid_holidays}
                    onCheckedChange={checked => setRecurrenceSettings({ ...recurrenceSettings, avoid_holidays: checked })} />
                </div>
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <Label className="text-base font-medium mb-4 block">Holiday List</Label>
                  <div className="flex gap-2 mb-4">
                    <Input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} placeholder="Select date" />
                    <Button variant="outline" onClick={handleAddHoliday}><Plus className="h-4 w-4 mr-2" />Add Holiday</Button>
                  </div>
                  {recurrenceSettings.holiday_list?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {recurrenceSettings.holiday_list.sort().map(date => (
                        <span key={date} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-secondary text-foreground">
                          {date}
                          <button onClick={() => handleRemoveHoliday(date)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No holidays configured.</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
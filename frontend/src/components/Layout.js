import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, ClipboardList, Calendar, Users, Bell, LogOut,
  Settings, Repeat, X, PanelLeftClose, PanelLeftOpen,
  CheckCheck, Clock, Sun, Moon, UserCircle, Pencil,
  Mail, Phone, Building2, ShieldCheck, ChevronRight, Save, Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { api } from '../App';
import { toast } from 'sonner';
import { useWebSocket } from '../contexts/WebSocketContext';

const globalShownToastIds = new Set();

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ROLE_STYLES = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  member: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
};

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);
  return [isDark, setIsDark];
}

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({ item, isActive, isCollapsed, onNavigate }) {
  const button = (
    <button
      onClick={onNavigate}
      className={`
        relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
        transition-all duration-150 group outline-none
        ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}
        ${isCollapsed ? 'justify-center px-0' : ''}
      `}
    >
      {isActive && (
        isCollapsed ? (
          <span className="absolute left-0 inset-y-0 my-auto w-0.5 h-5 bg-primary rounded-r-full" />
        ) : (
          <motion.span
            layoutId="nav-active-bar"
            className="absolute left-0 inset-y-0 my-auto w-0.5 h-5 bg-primary rounded-r-full"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )
      )}
      <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.span key="label"
            initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden whitespace-nowrap">
            {item.name}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">{item.name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return button;
}

// ─── SidebarContent ───────────────────────────────────────────────────────────
function SidebarContent({
  isCollapsed, isMobile, menuItems, currentPath,
  onNavigate, onToggleCollapse, onCloseMobile, user, initials, roleStyle,
}) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className={`h-16 flex items-center shrink-0 border-b border-border/60 ${isCollapsed && !isMobile ? 'justify-center px-0' : 'px-3'}`}>
        {isMobile ? (
          <button onClick={onCloseMobile}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={onToggleCollapse}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                  {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">
                {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <nav className={`flex-1 overflow-y-auto py-4 space-y-0.5 ${isCollapsed && !isMobile ? 'px-2' : 'px-3'}`}>
        {menuItems.map(item => (
          <NavItem key={item.path} item={item}
            isActive={currentPath === item.path}
            isCollapsed={isCollapsed && !isMobile}
            onNavigate={() => { onNavigate(item.path); if (isMobile) onCloseMobile(); }}
          />
        ))}
      </nav>
    </div>
  );
}

function NotificationItem({ n, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${n.is_read ? 'hover:bg-muted/50 opacity-60' : 'bg-primary/5 hover:bg-primary/10 border-l-2 border-primary'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={`text-sm truncate ${n.is_read ? 'font-normal' : 'font-semibold text-foreground'}`}>{n.title}</p>
          {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
        {n.created_at && (
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {getRelativeTime(n.created_at)}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function Layout({ user, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // THE FIX: Extract 'subscribe' from WebSocketContext instead of 'socket'
  const { subscribe } = useWebSocket();

  const [isDark, setIsDark] = useDarkMode();
  const [notifications, setNotifications] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isFirstCheckDone, setIsFirstCheckDone] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const [localUser, setLocalUser] = useState(user);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', department: '', role: '' });

  useEffect(() => { setLocalUser(user); }, [user]);

  useEffect(() => {
    if (editOpen && departments.length === 0) {
      api.get('/departments').then(r => setDepartments(r.data)).catch(() => { });
    }
  }, [editOpen]);

  const openEditDialog = () => {
    setEditForm({
      name: localUser?.name || '',
      email: localUser?.email || '',
      phone: localUser?.phone || '',
      department: localUser?.department || '',
      role: localUser?.role || 'member',
    });
    setProfileOpen(false);
    setEditOpen(true);
  };

  const handleProfileSave = async () => {
    if (!editForm.name.trim()) { toast.error('Name is required'); return; }
    if (!editForm.email && !editForm.phone) { toast.error('At least email or phone is required'); return; }
    setSavingProfile(true);
    try {
      const res = await api.put(`/users/${localUser.id}`, editForm);
      setLocalUser(res.data);
      toast.success('Profile updated successfully');
      setEditOpen(false);
    } catch (err) {
      if (err.response?.status === 403) toast.error('Only admins can update user profiles');
      else toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => { if (!e.matches) setMobileSidebarOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 1. Fetch initial state ONLY ONCE on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  // 2. WebSocket Listener for real-time pushed notifications
  useEffect(() => {
    const handleNewNotification = (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);

      if (!globalShownToastIds.has(newNotif.id)) {
        globalShownToastIds.add(newNotif.id);
        toast(newNotif.title, {
          description: newNotif.message,
          duration: 4000,
          icon: <Bell className="h-4 w-4 text-primary" />,
          action: { label: 'View', onClick: () => handleNotificationClick(newNotif) },
        });
      }
    };

    // Use the subscribe method from Context
    const unsubscribe = subscribe('NEW_NOTIFICATION', handleNewNotification);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [subscribe]);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      data.forEach((n) => {
        if (!n.is_read) globalShownToastIds.add(n.id);
      });
      setNotifications(data);
      setIsFirstCheckDone(true);
    } catch { console.error('Failed to load notifications'); }
  };

  const handleNotificationClick = async (n) => {
    try {
      await api.put(`/notifications/${n.id}/read`);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      navigate(n.task_id ? `/tasks/${n.task_id}` : '/tasks');
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (!unread.length) return;
    setMarkingAll(true);
    try {
      await Promise.all(unread.map(n => api.put(`/notifications/${n.id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to mark all as read'); }
    finally { setMarkingAll(false); }
  };

  const handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/auth'; };

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Work Items', path: '/tasks', icon: ClipboardList },
    { name: 'Recurring', path: '/recurring', icon: Repeat },
    { name: 'Schedule', path: '/schedule', icon: Calendar },
    { name: 'Team', path: '/users', icon: Users },
  ];
  if (localUser?.role === 'admin') {
    menuItems.push({ name: 'Settings', path: '/settings', icon: Settings });
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const initials = getInitials(localUser?.name);
  const roleStyle = ROLE_STYLES[localUser?.role] || ROLE_STYLES.member;
  const isAdmin = localUser?.role === 'admin';

  const sidebarSharedProps = {
    menuItems,
    currentPath: location.pathname,
    onNavigate: (path) => navigate(path),
    onToggleCollapse: () => setIsCollapsed(p => {
      const next = !p;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    }),
    onCloseMobile: () => setMobileSidebarOpen(false),
    user: localUser, initials, roleStyle,
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            <button onClick={() => navigate('/')} className="flex items-baseline gap-1.5 transition-opacity focus:outline-none">
              <span className="text-[26px] font-bold text-primary tracking-tight">Atlas</span>
              <span className="text-[11px] font-medium text-muted-foreground tracking-wide">by Lyor</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full" onClick={() => setIsDark(d => !d)}>
                    <AnimatePresence mode="wait" initial={false}>
                      {isDark ? (
                        <motion.span key="sun" initial={{ rotate: -90, opacity: 0, scale: 0.8 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.8 }} transition={{ duration: 0.18 }} className="flex">
                          <Sun className="h-[18px] w-[18px]" />
                        </motion.span>
                      ) : (
                        <motion.span key="moon" initial={{ rotate: 90, opacity: 0, scale: 0.8 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: -90, opacity: 0, scale: 0.8 }} transition={{ duration: 0.18 }} className="flex">
                          <Moon className="h-[18px] w-[18px]" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs font-medium">{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground rounded-full">
                  <Bell className="h-[18px] w-[18px]" />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] p-0 overflow-hidden rounded-xl shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                    {unreadCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{unreadCount} new</span>}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} disabled={markingAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
                      <CheckCheck className="h-3.5 w-3.5" />{markingAll ? 'Marking…' : 'Mark all read'}
                    </button>
                  )}
                </div>
                <ScrollArea className="h-[320px]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center">
                        <Bell className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">All caught up</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-0.5">
                      {notifications.some(n => !n.is_read) && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-1.5 pb-1">Unread</p>
                          {notifications.filter(n => !n.is_read).map(n => <NotificationItem key={n.id} n={n} onClick={() => handleNotificationClick(n)} />)}
                        </>
                      )}
                      {notifications.some(n => n.is_read) && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-3 pb-1">Earlier</p>
                          {notifications.filter(n => n.is_read).map(n => <NotificationItem key={n.id} n={n} onClick={() => handleNotificationClick(n)} />)}
                        </>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <div className="h-5 w-px bg-border/60 mx-1" />

            <Popover open={profileOpen} onOpenChange={setProfileOpen}>
              <PopoverTrigger asChild>
                <button className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 select-none hover:bg-primary/25 hover:ring-2 hover:ring-primary/30 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                  <span className="text-[11px] font-bold text-primary">{initials}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[300px] p-0 overflow-hidden rounded-2xl shadow-2xl border border-border/60">
                <div className="relative">
                  <div className="h-16 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
                  <div className="absolute left-4 -bottom-6">
                    <div className="h-14 w-14 rounded-2xl bg-primary/20 border-4 border-background flex items-center justify-center shadow-md">
                      <span className="text-lg font-bold text-primary">{initials}</span>
                    </div>
                  </div>
                  <div className="absolute right-3 top-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize ${roleStyle}`}>{localUser?.role}</span>
                  </div>
                </div>
                <div className="pt-9 px-4 pb-3">
                  <p className="text-base font-bold text-foreground leading-tight">{localUser?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5"><Building2 className="h-3 w-3" />{localUser?.department || '—'}</p>
                </div>
                <div className="border-t border-border/50 p-2 space-y-0.5">
                  <button onClick={openEditDialog} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors group">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="flex-1 text-left">Edit Profile</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors group">
                    <div className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
                      <LogOut className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <span className="flex-1 text-left">Sign Out</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" />Edit Profile</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{isAdmin ? 'All fields are editable.' : 'Department and role changes require an admin.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-primary">{getInitials(editForm.name || localUser?.name)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{editForm.name || localUser?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{editForm.role} · {editForm.department}</p>
              </div>
            </div>
            {[['edit-name', 'Full Name *', 'name', 'text', 'Your full name'], ['edit-email', 'Email', 'email', 'email', 'email@company.com'], ['edit-phone', 'Phone', 'phone', 'tel', '+1 234 567 8900']].map(([id, label, field, type, placeholder]) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
                <Input id={id} type={type} value={editForm[field]} placeholder={placeholder} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">Department {!isAdmin && <span className="text-[10px] font-normal text-muted-foreground/60 normal-case">(admin only)</span>}</Label>
              {isAdmin ? (
                <Select value={editForm.department} onValueChange={v => setEditForm(f => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border/60 bg-muted/30 text-sm text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{editForm.department || '—'}</div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">Role {!isAdmin && <span className="text-[10px] font-normal text-muted-foreground/60 normal-case">(admin only)</span>}</Label>
              {isAdmin ? (
                <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border/60 bg-muted/30 text-sm text-muted-foreground capitalize"><ShieldCheck className="h-3.5 w-3.5" />{editForm.role || '—'}</div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={savingProfile}>Cancel</Button>
              <Button className="flex-1" onClick={handleProfileSave} disabled={savingProfile}>{savingProfile ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div key="backdrop" className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileSidebarOpen(false)} />
              <motion.div key="drawer" className="fixed inset-y-0 left-0 z-50 bg-card shadow-2xl lg:hidden flex w-72" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }}>
                <SidebarContent {...sidebarSharedProps} isCollapsed={false} isMobile={true} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <motion.aside initial={false} animate={{ width: isCollapsed ? 60 : 240 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="hidden lg:flex flex-col border-r border-border/60 bg-card/40 shrink-0 overflow-hidden">
          <SidebarContent {...sidebarSharedProps} isCollapsed={isCollapsed} isMobile={false} />
        </motion.aside>
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
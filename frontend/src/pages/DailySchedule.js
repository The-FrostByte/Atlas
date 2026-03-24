import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight,
  CalendarDays, CalendarRange, ListTodo
} from 'lucide-react';

import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { api } from '../App';
import { toast } from 'sonner';

// --- Helper Functions for robust Date Math ---
const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Color Helpers ---
const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400';
    case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400';
    case 'delayed': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400';
    case 'pending': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-500/20 dark:text-slate-400';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'low': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// New helpers specifically for the ultra-compact Week View
const getPriorityBgOnly = (priority) => {
  switch (priority) {
    case 'high': return 'bg-red-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-emerald-500';
    default: return 'bg-slate-400';
  }
};

const getStatusTextColor = (status) => {
  switch (status) {
    case 'completed': return 'text-emerald-600 dark:text-emerald-400';
    case 'in_progress': return 'text-blue-600 dark:text-blue-400';
    case 'delayed': return 'text-red-600 dark:text-red-400';
    case 'pending': return 'text-slate-500 dark:text-slate-400';
    default: return 'text-muted-foreground';
  }
};

export default function Schedule({ user }) {
  const navigate = useNavigate();
  const [tasksByDate, setTasksByDate] = useState({});
  const [loading, setLoading] = useState(true);

  // State for Calendar Views
  const [view, setView] = useState('week'); // 'month', 'week', 'day'
  const [currentDate, setCurrentDate] = useState(getToday());

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tasks/schedule');
      setTasksByDate(response.data || {});
    } catch (error) {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  // --- Navigation Handlers ---
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    if (view === 'day') newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    if (view === 'day') newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(getToday());
  };

  const jumpToDay = (date) => {
    setCurrentDate(date);
    setView('day');
  };

  // 1. MONTH VIEW
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return { date: d, key: formatDateKey(d) };
    });

    const todayKey = formatDateKey(getToday());

    return (
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-muted/30 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(100px,auto)]">
          {blanks.map(b => <div key={`blank-${b}`} className="p-2 border-r border-b bg-muted/10 min-h-[100px]"></div>)}

          {days.map(({ date, key }) => {
            const dayTasks = tasksByDate[key] || [];
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                onClick={() => jumpToDay(date)}
                className={`p-2 border-r border-b min-h-[100px] cursor-pointer transition-colors hover:bg-muted/30 group ${isToday ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground group-hover:text-primary'}`}>
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-2">
                  {dayTasks.slice(0, 3).map(task => (
                    <div key={task.id} className={`text-[10px] px-1.5 py-1 rounded truncate border ${getStatusColor(task.status)}`}>
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-muted-foreground font-medium px-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 2. WEEK VIEW (UPGRADED: Ultra-clean, un-congested horizontal layout)
  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return { date: d, key: formatDateKey(d) };
    });

    const todayKey = formatDateKey(getToday());

    return (
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="bg-card border rounded-xl shadow-sm min-w-[900px] flex flex-col">

          {/* Header Row */}
          <div className="grid grid-cols-7 border-b bg-muted/20">
            {weekDays.map(({ date, key }) => {
              const isToday = key === todayKey;
              return (
                <div key={`header-${key}`} className={`p-3 text-center border-r last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <div className={`mt-1.5 mx-auto w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold ${isToday ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-foreground'}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Content Row */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {weekDays.map(({ date, key }) => {
              const dayTasks = tasksByDate[key] || [];
              const isToday = key === todayKey;

              return (
                <div key={`content-${key}`} className={`p-2 border-r last:border-r-0 min-h-[400px] ${isToday ? 'bg-primary/[0.02]' : 'bg-transparent'}`}>
                  {dayTasks.length === 0 ? (
                    <div className="h-full pt-8 flex items-start justify-center text-xs text-muted-foreground italic opacity-50">
                      No tasks
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => navigate(`/tasks/${task.id}`)}
                          className="p-2.5 rounded-lg border bg-background hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group flex flex-col gap-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${getPriorityBgOnly(task.priority)} shrink-0`} />
                            <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${getStatusTextColor(task.status)}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <h4 className="text-xs font-medium leading-snug text-foreground group-hover:text-primary line-clamp-2">
                            {task.title}
                          </h4>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // 3. DAY VIEW
  const renderDayView = () => {
    const key = formatDateKey(currentDate);
    const dayTasks = tasksByDate[key] || [];
    const isToday = key === formatDateKey(getToday());

    return (
      <Card className="max-w-3xl mx-auto overflow-hidden shadow-md">
        <div className={`p-6 md:p-8 flex items-center justify-between border-b ${isToday ? 'bg-primary/5' : 'bg-card'}`}>
          <div className="flex items-center gap-4">
            <div className={`h-16 w-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
              <span className="text-xs font-bold uppercase tracking-widest opacity-80">{currentDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="text-2xl font-bold leading-none">{currentDate.getDate()}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <p className="text-muted-foreground">
                {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'} scheduled
              </p>
            </div>
          </div>
          {isToday && <Badge className="hidden sm:flex">Today</Badge>}
        </div>

        <div className="p-6 md:p-8 bg-muted/10 min-h-[300px]">
          {dayTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-60 py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-muted-foreground">Your schedule is clear</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {dayTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background border rounded-xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer gap-4"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">{task.title}</h4>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`px-2.5 py-0.5 border-transparent ${getPriorityColor(task.priority)}`}>{task.priority}</Badge>
                    <Badge variant="outline" className={`px-2.5 py-0.5 ${getStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  };

  // Dynamic Header Title
  const getHeaderTitle = () => {
    if (view === 'month') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (view === 'day') return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (view === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
  };

  return (
  
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* HEADER CONTROLS */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Schedule</h1>
            <p className="text-muted-foreground mt-1">Manage and track your upcoming workload</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-2 rounded-xl border shadow-sm w-full md:w-auto">

            {/* View Toggles */}
            <div className="flex p-1 bg-muted rounded-lg w-full sm:w-auto">
              <Button
                variant={view === 'day' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 sm:flex-none h-8 text-xs font-semibold px-4"
                onClick={() => setView('day')}
              >
                <ListTodo className="h-3.5 w-3.5 mr-2" /> Day
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 sm:flex-none h-8 text-xs font-semibold px-4"
                onClick={() => setView('week')}
              >
                <CalendarRange className="h-3.5 w-3.5 mr-2" /> Week
              </Button>
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 sm:flex-none h-8 text-xs font-semibold px-4"
                onClick={() => setView('month')}
              >
                <CalendarDays className="h-3.5 w-3.5 mr-2" /> Month
              </Button>
            </div>

            <div className="hidden sm:block w-px h-8 bg-border"></div>

            {/* Date Navigation */}
            <div className="flex items-center justify-between w-full sm:w-auto gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="w-40 sm:w-48 text-center px-2 cursor-pointer hover:text-primary transition-colors" onClick={handleToday}>
                <span className="text-sm font-bold truncate block">{getHeaderTitle()}</span>
              </div>

              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </div>

        {/* CALENDAR CONTENT */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${currentDate.toISOString()}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {view === 'month' && renderMonthView()}
              {view === 'week' && renderWeekView()}
              {view === 'day' && renderDayView()}
            </motion.div>
          </AnimatePresence>
        )}

      </div>

  );
}
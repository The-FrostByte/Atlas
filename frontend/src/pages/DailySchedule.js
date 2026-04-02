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

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Color Helpers ---
const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'bg-emerald-100/50 text-emerald-800/70 border-emerald-200/50 dark:bg-emerald-900/20 dark:text-emerald-500/70';
    case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400';
    case 'delayed': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400';
    case 'pending': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-500/20 dark:text-slate-400';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
    case 'completed': return 'text-emerald-600/70 dark:text-emerald-500/70';
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
  const [lastFetchedMonth, setLastFetchedMonth] = useState(null);

  // Re-fetch data ONLY when the active viewing month changes
  useEffect(() => {
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    if (lastFetchedMonth !== monthKey) {
      setLastFetchedMonth(monthKey);
      loadScheduleData(currentDate);
    }
  }, [currentDate, lastFetchedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadScheduleData = async (targetDate) => {
    try {
      setLoading(true);

      const start = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
      const end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 2, 0);

      const response = await api.get('/tasks/schedule', {
        params: {
          start_date: start.toISOString(),
          end_date: end.toISOString()
        }
      });

      let rawTasks = [];
      if (Array.isArray(response.data)) {
        rawTasks = response.data;
      } else if (response.data?.tasks && Array.isArray(response.data.tasks)) {
        rawTasks = response.data.tasks;
      } else if (typeof response.data === 'object' && response.data !== null) {
        Object.values(response.data).forEach(arr => {
          if (Array.isArray(arr)) rawTasks.push(...arr);
        });
      }

      const grouped = {};
      rawTasks.forEach(task => {
        if (!task.due_date) return;
        const dateObj = new Date(task.due_date);
        const key = formatDateKey(dateObj);

        if (!grouped[key]) grouped[key] = [];
        if (!grouped[key].some(t => t.id === task.id)) {
          grouped[key].push(task);
        }
      });

      // UX UPGRADE: Sort active tasks to top, completed tasks to bottom, then by time.
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => {
          const aCompleted = a.status === 'completed';
          const bCompleted = b.status === 'completed';

          if (aCompleted && !bCompleted) return 1;  // Push 'a' down
          if (!aCompleted && bCompleted) return -1; // Pull 'a' up

          // If both are completed or both are active, sort chronologically
          return new Date(a.due_date) - new Date(b.due_date);
        });
      });

      setTasksByDate(grouped);
    } catch (error) {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

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
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return { date: d, key: formatDateKey(d) };
    });

    const totalCells = blanks.length + days.length;
    const numRows = Math.ceil(totalCells / 7);
    const trailingBlanks = Array.from({ length: (numRows * 7) - totalCells }, (_, i) => i);

    const todayKey = formatDateKey(getToday());

    return (
      <div className="flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm h-full w-full min-h-[500px]">
        <div className="grid grid-cols-7 bg-muted/30 border-b shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1 min-h-0 bg-muted/10" style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}>
          {blanks.map(b => <div key={`blank-${b}`} className="border-r border-b border-border/50 bg-muted/10" />)}

          {days.map(({ date, key }) => {
            const dayTasks = tasksByDate[key] || [];
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                onClick={() => jumpToDay(date)}
                className={`border-r border-b border-border/50 flex flex-col min-h-0 cursor-pointer transition-colors group ${isToday ? 'bg-primary/[0.03]' : 'bg-card hover:bg-muted/30'}`}
              >
                <div className="p-1.5 sm:p-2 flex items-center justify-between shrink-0">
                  <span className={`text-[10px] sm:text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground group-hover:text-primary'}`}>
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-muted/80 text-muted-foreground">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-1 sm:px-1.5 pb-1 space-y-1 min-h-0">
                  {dayTasks.map(task => {
                    const isCompleted = task.status === 'completed';

                    return (
                      <div
                        key={task.id}
                        title={task.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/tasks/${task.id}`);
                        }}
                        className={`text-[9px] sm:text-[10px] px-1.5 py-1 rounded border shadow-sm ${getStatusColor(task.status)} flex items-center gap-1.5 transition-all hover:brightness-95 hover:shadow-md cursor-pointer ${isCompleted ? 'opacity-50' : ''}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${getPriorityBgOnly(task.priority)} shrink-0 ${isCompleted ? 'opacity-40 grayscale' : ''}`} />
                        <span className={`truncate font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {trailingBlanks.map(b => <div key={`trailing-${b}`} className="border-r border-b border-border/50 bg-muted/10" />)}
        </div>
      </div>
    );
  };

  // 2. WEEK VIEW
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
      <div className="w-full h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 lg:gap-0 lg:bg-card lg:border lg:rounded-xl lg:shadow-sm w-full h-full lg:overflow-hidden overflow-y-auto custom-scrollbar content-start lg:content-stretch">
          {weekDays.map(({ date, key }) => {
            const dayTasks = tasksByDate[key] || [];
            const isToday = key === todayKey;

            return (
              <div
                key={`day-${key}`}
                className={`flex flex-col min-h-[250px] lg:min-h-0 border rounded-xl lg:rounded-none lg:border-0 lg:border-r lg:last:border-r-0 overflow-hidden bg-card shadow-sm lg:shadow-none ${isToday ? 'lg:bg-primary/[0.02] border-primary/50' : ''}`}
              >
                <div className={`p-2 lg:p-3 text-center border-b shrink-0 ${isToday ? 'bg-primary/10' : 'bg-muted/20'}`}>
                  <p className={`text-[10px] lg:text-xs font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <div className={`mt-1 mx-auto w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-full text-base lg:text-lg font-bold ${isToday ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-foreground'}`}>
                    {date.getDate()}
                  </div>
                </div>

                <div className={`p-1.5 lg:p-2 flex-1 overflow-y-auto custom-scrollbar min-h-0 ${isToday && !dayTasks.length ? 'bg-primary/[0.02]' : 'bg-transparent'}`}>
                  {dayTasks.length === 0 ? (
                    <div className="h-full pt-4 lg:pt-8 flex justify-center text-xs text-muted-foreground italic opacity-50">
                      No tasks
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {dayTasks.map((task) => {
                        const isCompleted = task.status === 'completed';

                        return (
                          <div
                            key={task.id}
                            onClick={() => navigate(`/tasks/${task.id}`)}
                            className={`p-2 rounded-lg border hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group flex flex-col gap-1 ${isCompleted ? 'bg-muted/30 opacity-60' : 'bg-background'}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${getPriorityBgOnly(task.priority)} shrink-0 ${isCompleted ? 'opacity-40 grayscale' : ''}`} />
                              <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${getStatusTextColor(task.status)}`}>
                                {task.status.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] text-muted-foreground ml-auto font-medium">{formatTime(task.due_date)}</span>
                            </div>
                            <h4 className={`text-[11px] lg:text-xs font-medium leading-tight group-hover:text-primary line-clamp-2 ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {task.title}
                            </h4>
                          </div>
                        );
                      })}
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

  // 3. DAY VIEW
  const renderDayView = () => {
    const key = formatDateKey(currentDate);
    const dayTasks = tasksByDate[key] || [];
    const isToday = key === formatDateKey(getToday());

    return (
      <div className="h-full overflow-y-auto custom-scrollbar pb-10">
        <Card className="max-w-3xl mx-auto overflow-hidden shadow-md shrink-0">
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
                {dayTasks.map(task => {
                  const isCompleted = task.status === 'completed';

                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer gap-4 ${isCompleted ? 'bg-muted/30 opacity-60' : 'bg-background'}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold text-base transition-colors ${isCompleted ? 'line-through text-muted-foreground group-hover:text-muted-foreground' : 'text-foreground group-hover:text-primary'}`}>
                            {task.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={`text-xs font-medium flex items-center gap-1 px-2 py-0.5 rounded-full ${isCompleted ? 'bg-muted text-muted-foreground' : 'text-primary bg-primary/10'}`}>
                            <Clock className="h-3 w-3" /> {formatTime(task.due_date)}
                          </span>
                          {task.description && (
                            <p className={`text-sm line-clamp-1 ${isCompleted ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`px-2.5 py-0.5 border-transparent ${getPriorityColor(task.priority)} ${isCompleted ? 'opacity-50 grayscale' : ''}`}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className={`px-2.5 py-0.5 ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  };

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
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-140px)] max-w-[1600px] mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-6 shrink-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight text-foreground">Schedule</h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-1">Manage and track your upcoming workload</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-4 bg-card p-1.5 lg:p-2 rounded-xl border shadow-sm w-full lg:w-auto shrink-0">
          <div className="flex p-1 bg-muted rounded-lg w-full sm:w-auto">
            <Button variant={view === 'day' ? 'default' : 'ghost'} size="sm" className="flex-1 sm:flex-none h-7 lg:h-8 text-xs font-semibold px-3 lg:px-4" onClick={() => setView('day')}>
              <ListTodo className="h-3.5 w-3.5 mr-1.5 lg:mr-2" /> Day
            </Button>
            <Button variant={view === 'week' ? 'default' : 'ghost'} size="sm" className="flex-1 sm:flex-none h-7 lg:h-8 text-xs font-semibold px-3 lg:px-4" onClick={() => setView('week')}>
              <CalendarRange className="h-3.5 w-3.5 mr-1.5 lg:mr-2" /> Week
            </Button>
            <Button variant={view === 'month' ? 'default' : 'ghost'} size="sm" className="flex-1 sm:flex-none h-7 lg:h-8 text-xs font-semibold px-3 lg:px-4" onClick={() => setView('month')}>
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 lg:mr-2" /> Month
            </Button>
          </div>

          <div className="hidden sm:block w-px h-6 lg:h-8 bg-border"></div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7 lg:h-8 lg:w-8 shrink-0" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="w-40 sm:w-48 text-center px-2 cursor-pointer hover:text-primary transition-colors flex-1" onClick={handleToday}>
              <span className="text-xs lg:text-sm font-bold truncate block">{getHeaderTitle()}</span>
            </div>

            <Button variant="outline" size="icon" className="h-7 w-7 lg:h-8 lg:w-8 shrink-0" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px] z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={`${view}-${currentDate.toISOString()}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full flex flex-col min-h-0"
          >
            {view === 'month' && renderMonthView()}
            {view === 'week' && renderWeekView()}
            {view === 'day' && renderDayView()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
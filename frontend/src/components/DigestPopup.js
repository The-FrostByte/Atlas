import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Clock, AlertTriangle, CheckCircle, ArrowRight, X, ChevronDown, ChevronUp, Calendar, User } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { api } from '../App';
import { formatUTCToLocal, getRelativeTime } from '../utils/timezone';

export default function DigestPopup({ onNavigateToTasks }) {
  const [digest, setDigest] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasCheckedRef = useRef(false);
  const [expandedTasks, setExpandedTasks] = useState({});

  useEffect(() => {
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;

      const today = new Date().toDateString();
      const lastShown = localStorage.getItem('digest_last_shown');

      // EXCELLENT FIX: Throttle using local storage (Once per day)
      if (lastShown === today) return;

      const fetchDigests = async () => {
        try {
          const response = await api.get('/digest/popups');
          if (response.data && response.data.length > 0) {
            localStorage.setItem('digest_last_shown', today);
            setDigest(response.data[0]);
            setIsVisible(true);
          }
        } catch (error) {
          console.error('Failed to check for digests:', error);
        }
      };
      fetchDigests();
    }
  }, []);

  const handleDismiss = () => {
    // EXCELLENT FIX: Immediate UI closure. Never let the UI hang waiting on an API.
    setIsVisible(false);

    // Fire and forget background request
    if (digest) {
      api.put(`/digest/popups/${digest.id}/seen`).catch(() => { });
    }

    setDigest(null);
    setExpandedTasks({});
  };

  const handleViewTasks = () => {
    handleDismiss(); // Trigger instant closure and silent API call
    if (onNavigateToTasks) {
      onNavigateToTasks();
    }
  };

  const toggleTaskExpand = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const getSectionIcon = (type) => {
    switch (type) {
      case 'overdue': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'due_today': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'due_soon': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'in_progress': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSectionLabel = (type) => {
    switch (type) {
      case 'overdue': return 'Overdue Items';
      case 'due_today': return 'Due Today';
      case 'due_soon': return 'Due Soon';
      case 'in_progress': return 'In Progress';
      default: return 'Work Items';
    }
  };

  const getSectionColor = (type) => {
    switch (type) {
      case 'overdue': return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'due_today': return 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800';
      case 'due_soon': return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800';
      case 'in_progress': return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      default: return 'bg-secondary';
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colors[status] || colors.pending;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    return formatUTCToLocal(dateStr, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntilDue = (dateStr) => {
    if (!dateStr) return null;
    return getRelativeTime(dateStr);
  };

  if (!isVisible || !digest) return null;

  const isStartOfDay = digest.digest_type === 'start_of_day';
  const Icon = isStartOfDay ? Sun : Moon;
  const sections = digest.payload?.sections || [];

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={handleDismiss} />

          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-xl border-2 max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className={`p-6 rounded-t-lg flex-shrink-0 ${isStartOfDay ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30' : 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isStartOfDay ? 'bg-amber-100 dark:bg-amber-900' : 'bg-indigo-100 dark:bg-indigo-900'}`}>
                      <Icon className={`h-6 w-6 ${isStartOfDay ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-heading font-bold">{digest.title}</h2>
                      <p className="text-sm text-muted-foreground">{digest.payload?.total_tasks || 0} task{digest.payload?.total_tasks !== 1 ? 's' : ''} need your attention</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-6 space-y-4">
                  {sections.map((section, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${getSectionColor(section.type)}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getSectionIcon(section.type)}
                          <span className="font-medium text-sm">{getSectionLabel(section.type)}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{section.count} task{section.count !== 1 ? 's' : ''}</Badge>
                      </div>

                      <div className="space-y-2">
                        {section.tasks?.map((task, taskIndex) => {
                          const taskKey = `${section.type}-${taskIndex}`;
                          const isExpanded = expandedTasks[taskKey];
                          const timeUntil = getTimeUntilDue(task.due_date);

                          return (
                            <div key={taskIndex} className="bg-background/80 rounded-md overflow-hidden">
                              <div className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-background transition-colors" onClick={() => toggleTaskExpand(taskKey)}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                  <span className="text-sm truncate flex-1">{task.title}</span>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  {timeUntil && <span className={`text-xs ${timeUntil.includes('overdue') ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{timeUntil}</span>}
                                  <Badge className={`text-xs ${getPriorityBadge(task.priority)}`}>{task.priority}</Badge>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                    <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
                                      {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
                                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                        {task.due_date && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /><span>{formatDate(task.due_date)}</span></div>}
                                        {task.department && <div className="flex items-center gap-1"><User className="h-3 w-3" /><span>{task.department}</span></div>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge className={`text-xs ${getStatusBadge(task.status)}`}>{task.status?.replace('_', ' ') || 'pending'}</Badge>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                        {section.count > (section.tasks?.length || 0) && (
                          <p className="text-xs text-muted-foreground text-center pt-1">
                            +{section.count - (section.tasks?.length || 0)} more task{section.count - (section.tasks?.length || 0) !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {sections.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No pending tasks to show</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t bg-muted/30 rounded-b-lg flex-shrink-0 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Click tasks to expand details</p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleDismiss}>Dismiss</Button>
                  <Button onClick={handleViewTasks}>View All Items<ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts';
import {
  AlertCircle, Users, ClipboardList, AlertTriangle,
  Search, Calendar, ChevronDown, X,
  CheckCircle2, Loader2, Clock, TrendingUp
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { api } from '../App';

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  completed: '#10B981',
  in_progress: '#3B82F6',
  overdue: '#EF4444',
  pending: '#94A3B8',
};

const PILL_COLORS = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400'
};

// ─── Preset Filters ───────────────────────────────────────────────────────────
const PRESET_FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '14d', label: 'Last 14 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
];

function getDateRangeForPreset(key) {
  if (key === 'all' || key === 'custom') return { start_date: null, end_date: null };
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - (parseInt(key) - 1));
  start.setHours(0, 0, 0, 0);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

// ─── Animated Counter Hook ────────────────────────────────────────────────────
function useAnimatedCount(target, duration = 600) {
  const [count, setCount] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return count;
}

// ─── Skeleton Components ──────────────────────────────────────────────────────
const SkeletonBox = ({ className = '' }) => (
  <div className={`animate-pulse bg-muted/60 rounded-lg ${className}`} />
);

const SkeletonCard = ({ tall = false }) => (
  <Card className="p-6 border-border/50">
    <div className="flex items-center justify-between">
      <div className="space-y-2 flex-1">
        <SkeletonBox className="h-3 w-24" />
        <SkeletonBox className="h-8 w-16" />
        <SkeletonBox className="h-2.5 w-32 mt-1" />
      </div>
      <SkeletonBox className="h-12 w-12 rounded-full" />
    </div>
    {tall && <SkeletonBox className="h-1.5 w-full mt-5 rounded-full" />}
  </Card>
);

const SkeletonChart = ({ height = 320 }) => (
  <Card className="p-6 border-border/50">
    <SkeletonBox className="h-5 w-40 mb-6" />
    <SkeletonBox style={{ height }} className="w-full rounded-xl" />
  </Card>
);

// ─── Meta Card (Total Tasks / Active Members) ─────────────────────────────────
function MetaCard({ label, value, icon: Icon, iconBg, iconColor, onClick, subtitle }) {
  const animated = useAnimatedCount(value);
  return (
    <Card
      onClick={onClick}
      className={`p-6 border-border/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight">{animated}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </Card>
  );
}

// ─── Status Card (Completed / In Progress / Pending / Overdue) ───────────────
function StatusCard({ label, value, total, icon: Icon, iconBg, iconColor, accentColor, subtitle }) {
  const animated = useAnimatedCount(value);
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <Card className="relative p-5 border-border/50 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {/* Colored top strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: accentColor }} />

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>{animated}</p>
        </div>
        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`h-4.5 w-4.5 ${iconColor}`} style={{ height: '1.1rem', width: '1.1rem' }} />
        </div>
      </div>

      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-1.5">{subtitle}</p>
      )}

      {/* % of total bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">% of total</span>
          <span className="text-[11px] font-bold" style={{ color: accentColor }}>{pct}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>
    </Card>
  );
}

// ─── Pipeline Health Bar ──────────────────────────────────────────────────────
function PipelineBar({ completed, inProgress, pending, overdue, total }) {
  if (!total) return null;
  const segments = [
    { label: 'Completed', value: completed, color: COLORS.completed },
    { label: 'In Progress', value: inProgress, color: COLORS.in_progress },
    { label: 'Pending', value: pending, color: COLORS.pending },
    { label: 'Overdue', value: overdue, color: COLORS.overdue },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Pipeline Health
        </p>
        <p className="text-xs text-muted-foreground">{total} total tasks</p>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px bg-muted/30">
        {segments.map((seg) => (
          <motion.div
            key={seg.label}
            initial={{ flex: 0 }}
            animate={{ flex: seg.value / total }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            title={`${seg.label}: ${seg.value} (${Math.round((seg.value / total) * 100)}%)`}
            className="h-full"
            style={{ backgroundColor: seg.color, minWidth: seg.value > 0 ? '2px' : 0 }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-[11px] text-muted-foreground">
              {seg.label} <span className="font-semibold text-foreground">{Math.round((seg.value / total) * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Date Filter Bar ──────────────────────────────────────────────────────────
function DateFilterBar({ activeFilter, onFilterChange, customRange, onCustomRangeChange, onCustomApply }) {
  const [showCustom, setShowCustom] = useState(false);
  const [localStart, setLocalStart] = useState(customRange.start || '');
  const [localEnd, setLocalEnd] = useState(customRange.end || '');
  const customRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (customRef.current && !customRef.current.contains(e.target)) setShowCustom(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApply = () => {
    if (!localStart || !localEnd) return;
    const start = new Date(localStart); start.setHours(0, 0, 0, 0);
    const end = new Date(localEnd); end.setHours(23, 59, 59, 999);
    onCustomRangeChange({ start: localStart, end: localEnd });
    onCustomApply(start.toISOString(), end.toISOString());
    setShowCustom(false);
  };

  const handlePresetClick = (key) => {
    if (key === 'custom') { setShowCustom(p => !p); onFilterChange(key); return; }
    setShowCustom(false);
    onFilterChange(key);
  };

  const customDisplayLabel = customRange.start && customRange.end
    ? `${customRange.start} → ${customRange.end}` : 'Custom Range';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/50">
        {PRESET_FILTERS.filter(f => f.key !== 'custom').map((filter) => (
          <button
            key={filter.key}
            onClick={() => handlePresetClick(filter.key)}
            className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
              ${activeFilter === filter.key
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="relative" ref={customRef}>
        <button
          onClick={() => handlePresetClick('custom')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200
            ${activeFilter === 'custom'
              ? 'bg-background text-foreground border-primary/30 shadow-sm'
              : 'text-muted-foreground border-border/50 hover:text-foreground hover:border-border hover:bg-muted/40'
            }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          {activeFilter === 'custom' && customRange.start ? customDisplayLabel : 'Custom Range'}
          <ChevronDown className={`h-3 w-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full mt-2 right-0 z-50 bg-background border border-border rounded-xl shadow-xl p-4 min-w-[280px]"
            >
              <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Select Date Range
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Start Date</label>
                  <input type="date" value={localStart} max={localEnd || undefined}
                    onChange={(e) => setLocalStart(e.target.value)}
                    className="w-full text-sm bg-muted/40 border border-border/60 rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">End Date</label>
                  <input type="date" value={localEnd} min={localStart || undefined}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    className="w-full text-sm bg-muted/40 border border-border/60 rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleApply} disabled={!localStart || !localEnd}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  Apply Range
                </button>
                <button onClick={() => { setLocalStart(''); setLocalEnd(''); setShowCustom(false); onFilterChange('all'); }}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border/50 rounded-md hover:bg-muted/40 transition-all">
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {activeFilter !== 'all' && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
          <span>{activeFilter === 'custom' ? customDisplayLabel : PRESET_FILTERS.find(f => f.key === activeFilter)?.label}</span>
          <button onClick={() => { onFilterChange('all'); onCustomRangeChange({ start: '', end: '' }); }}
            className="hover:text-primary/70 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, type, pieData }) => {
  if (!active || !payload?.length) return null;

  if (type === 'bar') {
    return (
      <div className="bg-background/95 backdrop-blur p-3 rounded-lg shadow-xl border border-border text-sm">
        {label && <p className="font-semibold mb-2 text-foreground">{label}</p>}
        {payload.map((entry, i) => {
          if (entry.dataKey === 'chartTotal') return null;
          return (
            <div key={i} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.payload.fill }} />
                <span className="text-muted-foreground capitalize">{entry.name.replace('_', ' ')}</span>
              </div>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'pie') {
    return (
      <div className="bg-background/95 backdrop-blur p-4 rounded-lg shadow-xl border border-border text-sm min-w-[200px]">
        <div className="space-y-4">
          {payload.map((entry, i) => {
            const total = pieData?.reduce((s, d) => s + d.value, 0) || 0;
            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.payload.fill }} />
                  <span className="font-bold text-foreground capitalize">{entry.name.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center justify-between pl-5 text-muted-foreground">
                  <span>Tasks:</span><span className="font-semibold text-foreground">{entry.value}</span>
                </div>
                <div className="flex items-center justify-between pl-5 text-muted-foreground">
                  <span>Percentage:</span><span className="font-semibold text-foreground">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === 'employee') {
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="bg-background/95 backdrop-blur p-4 rounded-lg shadow-xl border border-border text-sm min-w-[220px]">
        <p className="font-bold text-foreground mb-1">{data.name}</p>
        <p className="text-xs text-muted-foreground mb-3 pb-2 border-b border-border">{data.department}</p>
        <div className="space-y-2">
          {[
            { label: 'Completed', val: data.completed, cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'In Progress', val: data.in_progress, cls: 'text-blue-600 dark:text-blue-400' },
            { label: 'Pending', val: data.pending, cls: 'text-muted-foreground' },
            { label: 'Overdue', val: data.overdue, cls: 'text-red-600 dark:text-red-400' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="flex justify-between items-center">
              <span className={cls}>{label}:</span>
              <span className={`font-semibold ${label === 'Overdue' ? cls : ''}`}>{val}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">On-Time Rate:</span>
              <span className={`font-bold ${data.on_time_rate >= 80 ? 'text-emerald-500' : data.on_time_rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                {data.on_time_rate}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ─── Dominant % Label ─────────────────────────────────────────────────────────
const DominantPercentageLabel = (props) => {
  const { cx, cy, payload } = props;
  if (!payload?.chartTotal) return null;
  const categories = [
    { value: payload.completed, color: COLORS.completed },
    { value: payload.in_progress, color: COLORS.in_progress },
    { value: payload.pending, color: COLORS.pending },
    { value: payload.overdue, color: COLORS.overdue },
  ].sort((a, b) => b.value - a.value);
  const dominant = categories[0];
  if (!dominant.value) return null;
  return (
    <text x={cx} y={cy - 10} fill={dominant.color} textAnchor="middle" fontSize={12} fontWeight="bold">
      {Math.round((dominant.value / payload.chartTotal) * 100)}%
    </text>
  );
};

// ─── Stat Cell (table) ────────────────────────────────────────────────────────
const StatCell = ({ value, colorClass }) => (
  <div className="flex items-center justify-center">
    {value ? (
      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
        {value}
      </span>
    ) : (
      <span className="text-muted-foreground/50 font-medium">0</span>
    )}
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyChartState = () => (
  <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-12">
    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
      <ClipboardList className="h-6 w-6 text-muted-foreground/50" />
    </div>
    <p className="text-sm font-medium text-muted-foreground">No data for this period</p>
    <p className="text-xs text-muted-foreground/60">Try a wider date range</p>
  </div>
);

// ─── Motion Variants ──────────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [activeFilter, setActiveFilter] = useState('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [activeDateRange, setActiveDateRange] = useState({ start_date: null, end_date: null });

  const [stats, setStats] = useState({
    summary: { total_tasks: 0, overdue_tasks: 0, total_users: 0 },
    statusData: [],
    departmentData: [],
    employeeData: []
  });

  useEffect(() => {
    loadStats(activeDateRange.start_date, activeDateRange.end_date);
  }, [activeDateRange]);

  const loadStats = async (start_date, end_date) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start_date) params.set('start_date', start_date);
      if (end_date) params.set('end_date', end_date);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [statsRes, employeeRes] = await Promise.all([
        api.get(`/dashboard/stats${qs}`),
        api.get(`/dashboard/employee-load${qs}`)
      ]);

      const empData = (employeeRes.data || []).map(emp => {
        const completed = emp.completed || 0;
        const in_progress = emp.in_progress || 0;
        const pending = emp.pending || 0;
        const overdue = emp.overdue || 0;
        return { ...emp, completed, in_progress, pending, overdue, chartTotal: completed + in_progress + pending + overdue };
      });

      setStats({
        summary: statsRes.data.summary || {},
        statusData: (statsRes.data.status_distribution || []).map(item => ({
          name: item._id ? item._id.charAt(0).toUpperCase() + item._id.slice(1).replace('_', ' ') : 'Unknown',
          value: item.count || 0,
          color: COLORS[item._id] || COLORS.pending
        })),
        departmentData: (statsRes.data.department_performance || []).map(item => ({
          name: item.name || 'Unassigned',
          completed: item.completed || 0,
          in_progress: item.in_progress || 0,
          overdue: item.overdue || 0,
          pending: item.pending || 0,
        })),
        employeeData: empData
      });
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key) => {
    setActiveFilter(key);
    if (key !== 'custom') {
      setActiveDateRange(getDateRangeForPreset(key));
      setCustomRange({ start: '', end: '' });
    }
  };
  const handleCustomApply = (start_date, end_date) => setActiveDateRange({ start_date, end_date });

  // Derived counts
  const getStatusCount = (key) =>
    stats.statusData.find(s => s.name.toLowerCase().replace(' ', '_') === key)?.value || 0;

  const completedCount = getStatusCount('completed');
  const inProgressCount = getStatusCount('in_progress');
  const pendingCount = getStatusCount('pending');
  const overdueCount = stats.summary.overdue_tasks || 0;
  const totalTasks = stats.summary.total_tasks || 0;
  const totalUsers = stats.summary.total_users || 0;

  const activeStatuses = Object.keys(COLORS).filter(status =>
    stats.statusData.some(e => e.name.toLowerCase().replace(' ', '_') === status && e.value > 0)
  );
  const customLegendPayload = activeStatuses.map(status => ({
    value: status.replace('_', ' '), type: 'circle', id: status, color: COLORS[status]
  }));

  const overdueEmployees = stats.employeeData.filter(e => e.has_most_overdue && e.overdue > 0);
  const hasChartData = stats.statusData.some(s => s.value > 0);
  const hasDeptData = stats.departmentData.some(d => d.completed + d.in_progress + d.pending + d.overdue > 0);
  const hasEmpData = stats.employeeData.length > 0;

  // ── Skeleton on first load ───────────────────────────────────────────────
  if (loading && totalTasks === 0) {
    return (
     
        <div className="space-y-8 max-w-7xl mx-auto">
          <div className="flex flex-col gap-2">
            <SkeletonBox className="h-9 w-72" />
            <SkeletonBox className="h-4 w-56" />
          </div>
          {/* meta row */}
          <div className="grid sm:grid-cols-2 gap-4">
            <SkeletonCard /><SkeletonCard />
          </div>
          {/* status row */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard tall /><SkeletonCard tall /><SkeletonCard tall /><SkeletonCard tall />
          </div>
          <SkeletonBox className="h-10 w-full rounded-xl" />
          <div className="grid lg:grid-cols-3 gap-6">
            <SkeletonChart /><div className="lg:col-span-2"><SkeletonChart /></div>
          </div>
        </div>
  
    );
  }

  return (
    <div>
      {/* Top progress bar for re-fetches */}
      <AnimatePresence>
        {loading && (
          <motion.div key="bar" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed top-0 left-0 right-0 h-0.5 bg-primary z-50 origin-left" />
        )}
      </AnimatePresence>

      <motion.div className="space-y-8 max-w-7xl mx-auto" variants={containerVariants} initial="hidden" animate="visible">

        {/* HEADER ─────────────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Operations Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, <span className="font-medium text-foreground">{user?.name}</span>. Here's a snapshot of current progress.
            </p>
          </div>
          <div className="shrink-0">
            <DateFilterBar
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              onCustomApply={handleCustomApply}
            />
          </div>
        </motion.div>

        {/* ROW 1 — Meta stats (2 wide cards) ─────────────────────────────── */}
        <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
          <MetaCard
            label="Total Tasks"
            value={totalTasks}
            icon={ClipboardList}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            subtitle="All tasks across the organisation"
            onClick={() => navigate('/tasks')}
          />
          <MetaCard
            label="Active Members"
            value={totalUsers}
            icon={Users}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            subtitle="Team members currently active"
          />
        </motion.div>

        {/* ROW 2 — Status breakdown (4 equal cards) ──────────────────────── */}
        <motion.div variants={itemVariants} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard
            label="Completed"
            value={completedCount}
            total={totalTasks}
            icon={CheckCircle2}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            accentColor={COLORS.completed}
            subtitle="Finished on time"
          />
          <StatusCard
            label="In Progress"
            value={inProgressCount}
            total={totalTasks}
            icon={Loader2}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            accentColor={COLORS.in_progress}
            subtitle="Currently active"
          />
          <StatusCard
            label="Pending"
            value={pendingCount}
            total={totalTasks}
            icon={Clock}
            iconBg="bg-slate-500/10"
            iconColor="text-slate-400"
            accentColor={COLORS.pending}
            subtitle="Awaiting action"
          />
          <StatusCard
            label="Overdue"
            value={overdueCount}
            total={totalTasks}
            icon={AlertCircle}
            iconBg="bg-red-500/10"
            iconColor="text-red-500"
            accentColor={COLORS.overdue}
            subtitle="Needs immediate attention"
          />
        </motion.div>

        {/* PIPELINE HEALTH BAR ────────────────────────────────────────────── */}
        {totalTasks > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="px-6 py-5 border-border/50">
              <PipelineBar
                completed={completedCount}
                inProgress={inProgressCount}
                pending={pendingCount}
                overdue={overdueCount}
                total={totalTasks}
              />
            </Card>
          </motion.div>
        )}

        {/* CHARTS ─────────────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 flex flex-col border-border/50 lg:col-span-1 overflow-hidden">
            <h3 className="font-semibold text-lg text-foreground mb-4">Status Distribution</h3>
            {hasChartData ? (
              <div className="h-[320px] w-full pb-4 [&_*]:outline-none">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart margin={{ bottom: 20 }}>
                    <Pie data={stats.statusData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} stroke="none">
                      {stats.statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip type="pie" pieData={stats.statusData} />} />
                    <Legend payload={customLegendPayload} verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(v) => <span className="text-sm font-medium text-muted-foreground capitalize mx-1.5">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[320px]"><EmptyChartState /></div>
            )}
          </Card>

          <Card className="p-6 flex flex-col border-border/50 lg:col-span-2 overflow-hidden">
            <h3 className="font-semibold text-lg text-foreground mb-4">Department Load</h3>
            {hasDeptData ? (
              <div className="h-[320px] w-full [&_*]:outline-none">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={stats.departmentData} margin={{ top: 30, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={12} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} content={<CustomTooltip type="bar" />} />
                    <Legend payload={customLegendPayload} verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(v) => <span className="text-sm font-medium text-muted-foreground capitalize mx-1.5">{v}</span>} />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill={COLORS.completed} />
                    <Bar dataKey="in_progress" name="In Progress" stackId="a" fill={COLORS.in_progress} />
                    <Bar dataKey="pending" name="Pending" stackId="a" fill={COLORS.pending} />
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill={COLORS.overdue} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[320px]"><EmptyChartState /></div>
            )}
          </Card>
        </motion.div>

        {/* INDIVIDUAL WORKLOAD ────────────────────────────────────────────── */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 border-border/50 flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Individual Workload & Performance</h3>
                <p className="text-sm text-muted-foreground mt-1">Assignments and on-time rates per team member</p>
              </div>
              {overdueEmployees.length > 0 && (
                <div className="py-2 px-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-2 shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500" />
                  <span className="text-sm text-red-800 dark:text-red-400 font-medium">
                    Attention: {overdueEmployees.map(e => e.name).join(', ')} (Most Overdue)
                  </span>
                </div>
              )}
            </div>

            {hasEmpData ? (
              <>
                <div className="h-[350px] w-full [&_*]:outline-none">
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={stats.employeeData} margin={{ top: 30, right: 10, left: -20, bottom: 20 }} barSize={32}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={12} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip cursor={false} content={<CustomTooltip type="employee" />} />
                      <Bar dataKey="completed" stackId="a" fill={COLORS.completed} />
                      <Bar dataKey="in_progress" stackId="a" fill={COLORS.in_progress} />
                      <Bar dataKey="pending" stackId="a" fill={COLORS.pending} />
                      <Bar dataKey="overdue" stackId="a" fill={COLORS.overdue} />
                      <Line type="monotone" dataKey="chartTotal" stroke="transparent" strokeWidth={0}
                        activeDot={false} isAnimationActive={false} dot={<DominantPercentageLabel />} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8 border-t border-border/50 pt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-4">Performance Highlights</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {stats.employeeData.slice(0, 6).map((emp) => {
                      let dominantBadge = null;
                      let cardStyle = 'border-border/50 bg-muted/20 hover:bg-muted/40';
                      if (emp.chartTotal > 0) {
                        const categories = [
                          { key: 'Completed', value: emp.completed, badgeColor: 'bg-emerald-500 text-white border-transparent', cardTheme: 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-500/10 dark:border-emerald-500/20 hover:bg-emerald-100/60' },
                          { key: 'In Progress', value: emp.in_progress, badgeColor: 'bg-blue-500 text-white border-transparent', cardTheme: 'border-blue-200 bg-blue-50/60 dark:bg-blue-500/10 dark:border-blue-500/20 hover:bg-blue-100/60' },
                          { key: 'Pending', value: emp.pending, badgeColor: 'bg-slate-400 text-white border-transparent', cardTheme: 'border-slate-200 bg-slate-50/60 dark:bg-slate-500/10 dark:border-slate-500/20 hover:bg-slate-100/60' },
                          { key: 'Overdue', value: emp.overdue, badgeColor: 'bg-red-500 text-white border-transparent', cardTheme: 'border-red-200 bg-red-50/60 dark:bg-red-500/10 dark:border-red-500/20 hover:bg-red-100/60' },
                        ].sort((a, b) => b.value - a.value);
                        const dominant = categories[0];
                        if (dominant.value > 0) {
                          cardStyle = dominant.cardTheme;
                          dominantBadge = (
                            <Badge className={`text-[10px] px-1.5 py-0 ${dominant.badgeColor}`}>
                              {Math.round((dominant.value / emp.chartTotal) * 100)}%
                            </Badge>
                          );
                        }
                      }
                      return (
                        <div key={emp.name} className={`p-4 rounded-xl border transition-colors ${cardStyle}`}>
                          <p className="text-sm font-bold text-foreground truncate" title={emp.name}>{emp.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{emp.department}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">{emp.chartTotal} Tasks</span>
                            {dominantBadge}
                          </div>
                          {emp.overdue > 0 && (
                            <p className="text-[11px] font-semibold text-red-500 mt-2 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                              {emp.overdue} Overdue
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No active employee data available.
              </div>
            )}
          </Card>
        </motion.div>

        {/* EXECUTION TABLE ────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 overflow-hidden">
            <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Execution Overview</h3>
                <p className="text-sm text-muted-foreground">Raw breakdown of task statuses by team member.</p>
              </div>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-9 h-9 bg-background"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Team Member</th>
                    <th className="px-6 py-4 font-medium text-center">Completed</th>
                    <th className="px-6 py-4 font-medium text-center">In Progress</th>
                    <th className="px-6 py-4 font-medium text-center">Overdue</th>
                    <th className="px-6 py-4 font-medium text-center">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {stats.employeeData
                    .filter(u => u.name.toLowerCase().includes(employeeSearch.toLowerCase()))
                    .map((u) => (
                      <tr key={u.name}
                        className={`transition-colors ${u.overdue > 0
                          ? 'bg-red-50/40 dark:bg-red-500/5 hover:bg-red-50/70 dark:hover:bg-red-500/10'
                          : 'hover:bg-muted/20'
                          }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{u.name}</span>
                            {u.overdue > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                                <AlertCircle className="h-2.5 w-2.5" />
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{u.department}</p>
                        </td>
                        <td className="px-6 py-3.5 min-w-[120px]"><StatCell value={u.completed} colorClass={PILL_COLORS.completed} /></td>
                        <td className="px-6 py-3.5 min-w-[120px]"><StatCell value={u.in_progress} colorClass={PILL_COLORS.in_progress} /></td>
                        <td className="px-6 py-3.5 min-w-[120px]"><StatCell value={u.overdue} colorClass={PILL_COLORS.overdue} /></td>
                        <td className="px-6 py-3.5 min-w-[120px]"><StatCell value={u.pending} colorClass={PILL_COLORS.pending} /></td>
                      </tr>
                    ))}
                  {stats.employeeData.filter(u => u.name.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-muted-foreground">
                        {employeeSearch ? 'No employees match your search.' : 'No active execution data available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

      </motion.div>
    </div>
  );
}
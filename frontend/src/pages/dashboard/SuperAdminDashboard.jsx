import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Users, Building, AlertCircle, MessageSquare, Briefcase, FileText, ShieldAlert, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    pendingFeedback: 0,
    openAlerts: 0,
  });
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentFeedback();
    fetchRecentAlerts();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/super-admin/dashboard-stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch super admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentFeedback = async () => {
    try {
      setFeedbackLoading(true);
      const res = await api.get('/super-admin/monitor/feedback');
      const all = Array.isArray(res.data.data) ? res.data.data : [];
      // Show only pending entries, most recent 5
      const pending = all.filter(f => f.status === 'pending').slice(0, 5);
      setRecentFeedback(pending);
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const fetchRecentAlerts = async () => {
    try {
      setAlertsLoading(true);
      const res = await api.get('/super-admin/monitor/alerts');
      const all = Array.isArray(res.data.data) ? res.data.data : [];
      // Show only open alerts, most recent 5
      const open = all.filter(a => a.status === 'open').slice(0, 5);
      setRecentAlerts(open);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  return (
    <DashboardLayout title="Super Admin Dashboard">
      <div className="space-y-6 sm:space-y-8">

        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-github-dark-text">Overview</h1>
            <p className="text-slate-500 dark:text-github-dark-muted">Welcome back, Super Admin</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/reports')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Generate System Report
            </button>
          </div>
        </div>

        {/* Stats Grid — all real data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard
            title="Total Organizations"
            value={stats.totalOrgs}
            label="Registered"
            icon={<Building className="text-blue-500" size={24} />}
            loading={loading}
          />
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            label="Active"
            icon={<Users className="text-emerald-500" size={24} />}
            loading={loading}
          />
          <StatCard
            title="Pending Feedback"
            value={stats.pendingFeedback}
            label="Awaiting Review"
            icon={<MessageSquare className="text-violet-500" size={24} />}
            loading={loading}
            onClick={() => navigate('/super-admin/feedback')}
            highlight={stats.pendingFeedback > 0}
          />
          <StatCard
            title="Open Security Alerts"
            value={stats.openAlerts}
            label="Unseen"
            icon={<ShieldAlert className="text-red-500" size={24} />}
            loading={loading}
            onClick={() => navigate('/super-admin/security-alerts')}
            highlight={stats.openAlerts > 0}
            danger
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-github-dark-muted uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <QuickLinkCard onClick={() => navigate('/organizations')} icon={<Building size={20} />} title="Add Organization" desc="Onboard new client" />
            <QuickLinkCard onClick={() => navigate('/reports')} icon={<FileText size={20} />} title="System Reports" desc="View usage analytics" />
            <QuickLinkCard onClick={() => navigate('/settings')} icon={<Briefcase size={20} />} title="Global Settings" desc="Configure system defaults" />
          </div>
        </div>

        {/* Live Preview: Pending Feedback & Open Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pending Feedback Panel */}
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-github-dark-border">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-violet-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-github-dark-text">Pending Feedback & Bugs</h2>
                {stats.pendingFeedback > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 rounded-full">
                    {stats.pendingFeedback}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/super-admin/feedback')}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800">
              {feedbackLoading ? (
                <SkeletonRows count={3} />
              ) : recentFeedback.length === 0 ? (
                <EmptyState icon={<MessageSquare size={28} className="text-slate-300 dark:text-slate-600" />} text="No pending feedback" />
              ) : (
                recentFeedback.map(item => (
                  <div key={item.feedback_id} className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <TypeBadge type={item.type} />
                        <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text truncate">{item.title}</p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400 dark:text-github-dark-muted whitespace-nowrap">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5 ml-0 truncate">
                      {item.user_name || 'Anonymous'}{item.org_name ? ` · ${item.org_name}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Unseen Security Alerts Panel */}
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-github-dark-border">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-github-dark-text">Unseen Security Alerts</h2>
                {stats.openAlerts > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                    {stats.openAlerts}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/super-admin/security-alerts')}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800">
              {alertsLoading ? (
                <SkeletonRows count={3} />
              ) : recentAlerts.length === 0 ? (
                <EmptyState icon={<ShieldAlert size={28} className="text-slate-300 dark:text-slate-600" />} text="No open security alerts" />
              ) : (
                recentAlerts.map(alert => (
                  <div key={alert.id} className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <SeverityBadge severity={alert.severity} />
                        <p className="text-sm font-medium text-slate-800 dark:text-github-dark-text truncate">{alert.alert_type}</p>
                      </div>
                      <span className="shrink-0 flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400 font-semibold">
                        <Clock size={11} /> Open
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-github-dark-muted mt-0.5 truncate">
                      {alert.user_name || 'System/Anonymous'}{alert.org_name ? ` · ${alert.org_name}` : ''}{alert.ip_address ? ` · ${alert.ip_address}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatCard = ({ title, value, label, icon, loading, onClick, highlight, danger }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border transition-all duration-200 hover:-translate-y-0.5
      ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
      ${danger && highlight
        ? 'border-red-200 dark:border-red-800/50 hover:border-red-300'
        : highlight
          ? 'border-violet-200 dark:border-violet-800/50 hover:border-violet-300'
          : 'border-slate-200 dark:border-github-dark-border hover:shadow-md'
      }`}
  >
    {loading ? (
      <div className="animate-pulse space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2 w-full">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          </div>
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        </div>
        <div className="h-4 bg-slate-100 dark:bg-github-dark-subtle rounded w-2/3"></div>
      </div>
    ) : (
      <>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-github-dark-muted">{title}</p>
            <h4 className="text-3xl font-bold text-slate-800 dark:text-github-dark-text mt-1 tracking-tight">
              {value}
            </h4>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-github-dark-border">
            {icon}
          </div>
        </div>
        <div className="text-xs text-slate-400 dark:text-github-dark-muted bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded w-fit">
          {label}
        </div>
      </>
    )}
  </div>
);

const QuickLinkCard = ({ icon, title, desc, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all cursor-pointer group"
  >
    <div className="flex items-center gap-4">
      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-github-dark-text">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-github-dark-muted">{desc}</p>
      </div>
    </div>
  </div>
);

const TypeBadge = ({ type }) => {
  const map = {
    bug: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    feature: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
    general: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  };
  const cls = map[type?.toLowerCase()] || map.general;
  return <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${cls}`}>{type || 'N/A'}</span>;
};

const SeverityBadge = ({ severity }) => {
  const map = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  };
  const cls = map[severity?.toLowerCase()] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
  return <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${cls}`}>{severity || '—'}</span>;
};

const SkeletonRows = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="px-6 py-4 animate-pulse space-y-2">
        <div className="flex gap-2">
          <div className="h-4 w-14 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded"></div>
      </div>
    ))}
  </>
);

const EmptyState = ({ icon, text }) => (
  <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-github-dark-muted gap-2">
    {icon}
    <p className="text-sm">{text}</p>
  </div>
);

export default SuperAdminDashboard;

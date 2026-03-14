import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Users, Building, AlertCircle, Activity, Briefcase, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    pendingRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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

  return (
    <DashboardLayout title="Super Admin Dashboard">
      <div className="space-y-6 sm:space-y-8">
        
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
             <p className="text-slate-500 dark:text-slate-400">Welcome back, Super Admin</p>
           </div>
           <div className="flex gap-2">
             <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium">
               Generate System Report
             </button>
           </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Total Organizations" 
            value={stats.totalOrgs} 
            total="Registered"
            icon={<Building className="text-blue-500" size={24} />} 
            loading={loading}
          />
          <StatCard 
            title="Total Users" 
            value={stats.totalUsers} 
            total="Active"
            icon={<Users className="text-emerald-500" size={24} />} 
            loading={loading}
          />
          <StatCard 
            title="Active Subscriptions" 
            value={stats.activeSubscriptions} 
            total="Paid"
            icon={<Activity className="text-violet-500" size={24} />} 
            loading={loading}
          />
          <StatCard 
            title="Pending Requests" 
            value={stats.pendingRequests} 
            total="Alerts"
            icon={<AlertCircle className="text-amber-500" size={24} />} 
            loading={loading}
          />
        </div>

        {/* Quick Actions */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <QuickLinkCard onClick={() => navigate('/organizations')} icon={<Building size={20} />} title="Add Organization" desc="Onboard new client" />
                    <QuickLinkCard onClick={() => navigate('/reports')} icon={<FileText size={20} />} title="System Reports" desc="View usage analytics" />
                    <QuickLinkCard onClick={() => navigate('/settings')} icon={<Briefcase size={20} />} title="Global Settings" desc="Configure system defaults" />
                </div>
            </div>
        </div>

        {/* Activity Feed Placeholder (Styled) */}
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent System Activity</h2>
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <Activity className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p>System activity logs will appear here.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

// Reused Components for Consistency

const StatCard = ({ title, value, total, icon, trend, trendUp, period, loading }) => (
    <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        {loading ? (
            <div className="animate-pulse space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2 w-full">
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    </div>
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                </div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-2/3"></div>
            </div>
        ) : (
            <>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                        <h4 className="text-3xl font-bold text-slate-800 dark:text-white mt-1 tracking-tight">{value} <span className="text-sm font-normal text-slate-400 dark:text-slate-500">{total}</span></h4>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
                        {icon}
                    </div>
                </div>
                <div className="flex items-center text-sm">
                    {trend && (
                        <span className={`font-semibold ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} flex items-center bg-opacity-10 px-1.5 py-0.5 rounded`}>
                            {trendUp ? '↑' : '↓'} {trend}
                        </span>
                    )}
                    {trend && (
                        <span className="text-slate-400 dark:text-slate-500 ml-2">
                             {period}
                        </span>
                    )}
                    {!trend && period && <span className="text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded">{period}</span>}
                </div>
            </>
        )}
    </div>
);

const QuickLinkCard = ({ icon, title, desc, onClick }) => (
    <div
        onClick={onClick}
        className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all cursor-pointer group"
    >
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                {icon}
            </div>
            <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
        </div>
    </div>
);

export default SuperAdminDashboard;

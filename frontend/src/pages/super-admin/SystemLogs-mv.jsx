import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { Activity, AlertTriangle, Search, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import LoadingScreen from '../../components/LoadingScreen';

const SystemLogsMobile = () => {
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' or 'errors'
  const [activityLogs, setActivityLogs] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mano-active-tab', {
      detail: { tab: activeTab }
    }));
  }, [activeTab]);

  useEffect(() => {
    fetchLogs(activeTab);
  }, [activeTab]);

  const fetchLogs = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'activity' && activityLogs.length === 0) {
        const res = await api.get('/super-admin/monitor/logs/activity');
        setActivityLogs(res.data.data || []);
      } else if (tab === 'errors' && errorLogs.length === 0) {
        const res = await api.get('/super-admin/monitor/logs/errors');
        setErrorLogs(res.data.data || []);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to fetch ${tab} logs`);
    } finally {
      setLoading(false);
    }
  };

  const logsToDisplay = activeTab === 'activity' ? activityLogs : errorLogs;

  const filteredLogs = Array.isArray(logsToDisplay) ? logsToDisplay.filter(log => {
    const query = searchQuery.toLowerCase();
    if (activeTab === 'activity') {
      return (
        (log.event_type && log.event_type.toLowerCase().includes(query)) ||
        (log.description && log.description.toLowerCase().includes(query)) ||
        (log.user_name && log.user_name.toLowerCase().includes(query)) ||
        (log.request_ip && log.request_ip.includes(query))
      );
    } else {
      return (
        (log.error_message && log.error_message.toLowerCase().includes(query)) ||
        (log.request_path && log.request_path.toLowerCase().includes(query)) ||
        (log.user_name && log.user_name.toLowerCase().includes(query))
      );
    }
  }) : [];

  return (
    <MobileDashboardLayout title="System Logs">
      <div className="space-y-4 pb-24">
        
        {/* Sticky Tabs & Search Header */}
        <div className="sticky top-16 -mx-4 px-4 py-3 bg-slate-50 dark:bg-black z-20 space-y-3 transition-all duration-300">
          
          {/* Tabs */}
          <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/5">
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-grow flex items-center justify-center gap-2 py-2 text-[10px] font-bold rounded-xl uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'activity'
                  ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-250'
              }`}
            >
              <Activity size={12} />
              Activity
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`flex-grow flex items-center justify-center gap-2 py-2 text-[10px] font-bold rounded-xl uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'errors'
                  ? 'bg-white dark:bg-slate-800 text-red-650 dark:text-red-400 shadow-sm'
                  : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-750 dark:hover:text-slate-250'
              }`}
            >
              <AlertTriangle size={12} />
              Errors
            </button>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-github-dark-subtle border border-slate-200 dark:border-github-dark-border rounded-2xl shadow-sm text-sm text-slate-800 dark:text-github-dark-text focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
            />
          </div>
        </div>

        {/* Logs List Content */}
        <div className="relative min-h-[50vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-400 animate-pulse">Syncing logs...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="grid gap-3 pb-10">
              {activeTab === 'activity' ? (
                filteredLogs.map(log => (
                  <div
                    key={log.activity_id}
                    className="bg-white dark:bg-github-dark-subtle p-4 rounded-3xl border border-slate-100 dark:border-github-dark-border shadow-sm flex flex-col gap-3 relative overflow-hidden group"
                  >
                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-indigo-500/5 blur-2xl rounded-full" />
                    
                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-white/5 pb-2.5">
                      <span className="px-2 py-0.5 text-[8px] font-black rounded bg-indigo-50 text-indigo-705 border border-indigo-200/25 dark:bg-indigo-900/40 dark:text-indigo-400 uppercase tracking-widest">{log.event_type}</span>
                      <span className="text-[9px] text-slate-400 dark:text-github-dark-muted font-mono">{new Date(log.occurred_at).toLocaleDateString()}</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-slate-655 dark:text-slate-300 leading-relaxed font-poppins">{log.description}</p>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block uppercase tracking-wider mb-0.5 text-[8px] font-black">User / Tenant</span>
                          <span className="font-bold text-slate-800 dark:text-white truncate block">{log.user_name || 'System Auto'}</span>
                          {log.org_name && <span className="text-slate-550 truncate block text-[9px] mt-0.5">ORG: {log.org_name}</span>}
                        </div>

                        <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block uppercase tracking-wider mb-0.5 text-[8px] font-black">IP Address</span>
                          <span className="font-bold font-mono text-slate-850 dark:text-white block truncate mt-0.5">{log.request_ip || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 pt-2 border-t border-slate-50 dark:border-white/5 mt-0.5 font-semibold text-right">
                      Time: {new Date(log.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              ) : (
                filteredLogs.map(err => (
                  <div
                    key={err.error_id}
                    className="bg-white dark:bg-github-dark-subtle p-4 rounded-3xl border border-red-100/50 dark:border-red-950/20 shadow-sm flex flex-col gap-3 relative overflow-hidden group"
                  >
                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-red-500/5 blur-2xl rounded-full" />

                    <div className="flex justify-between items-center border-b border-red-50/50 dark:border-white/5 pb-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 text-[8px] font-black rounded bg-slate-100 text-slate-705 dark:bg-slate-800 dark:text-slate-350 font-mono">{err.request_method || 'SYS'}</span>
                        <span className="text-[10px] text-slate-505 dark:text-github-dark-muted font-mono truncate max-w-[150px]">{err.request_path || 'Background Job'}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 dark:text-github-dark-muted font-mono">{new Date(err.occurred_at).toLocaleDateString()}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold text-red-650 dark:text-red-400 leading-snug">{err.error_message}</div>
                      
                      {err.stack_trace && (
                        <details className="text-[10px]">
                          <summary className="cursor-pointer text-slate-400 hover:text-slate-655 font-bold uppercase tracking-wider">Inspect Trace</summary>
                          <pre className="mt-2 p-3 bg-slate-900 text-red-300 rounded-xl overflow-x-auto break-all whitespace-pre-wrap font-mono text-[9px] max-h-48">{err.stack_trace.substring(0, 500)}...</pre>
                        </details>
                      )}

                      <div className="p-2.5 bg-red-50/25 dark:bg-red-950/5 rounded-xl border border-red-100/10 dark:border-white/5 text-[10px]">
                        <span className="text-slate-400 block uppercase tracking-wider mb-0.5 text-[8px] font-black">User Context</span>
                        <span className="font-bold text-slate-800 dark:text-slate-300 block truncate">{err.user_name ? `${err.user_name} (ORG: ${err.org_name || 'Global'})` : 'Anonymous Request'}</span>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 pt-2 border-t border-red-50/50 dark:border-white/5 mt-0.5 font-semibold text-right">
                      Time: {new Date(err.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-github-dark-subtle rounded-[2rem] flex items-center justify-center mb-5 border border-slate-200/50 dark:border-white/5">
                <Activity size={28} className="text-slate-300 dark:text-github-dark-muted" />
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1">No logs found</h3>
              <p className="text-xs text-slate-500">There are no matching log activities detected for this timeframe.</p>
            </div>
          )}
        </div>

      </div>
    </MobileDashboardLayout>
  );
};

export default SystemLogsMobile;

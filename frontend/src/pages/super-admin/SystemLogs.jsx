import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Activity, AlertTriangle, Code, Search, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const SystemLogs = () => {
    const [activeTab, setActiveTab] = useState('activity'); // 'activity' or 'errors'
    const [activityLogs, setActivityLogs] = useState([]);
    const [errorLogs, setErrorLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchLogs(activeTab);
    }, [activeTab]);

    const fetchLogs = async (tab) => {
        setLoading(true);
        try {
            if (tab === 'activity' && activityLogs.length === 0) {
                const res = await api.get('/super-admin/monitor/logs/activity');
                setActivityLogs(res.data.data);
            } else if (tab === 'errors' && errorLogs.length === 0) {
                const res = await api.get('/super-admin/monitor/logs/errors');
                setErrorLogs(res.data.data);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to fetch ${tab} logs`);
        } finally {
            setLoading(false);
        }
    };

    const logsToDisplay = activeTab === 'activity' ? activityLogs : errorLogs;

    // We do safe checks on properties depending on what array we are traversing 
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
        <DashboardLayout title="System Logs">
            <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Code size={28} className="text-slate-500" />
                            System & Activity Logs
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Audit trail for user actions and application crashes.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Tabs */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    activeTab === 'activity' 
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                            >
                                <Activity size={16} /> User Activity
                            </button>
                            <button
                                onClick={() => setActiveTab('errors')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    activeTab === 'errors' 
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600 dark:text-red-400' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                            >
                                <AlertTriangle size={16} /> Application Errors
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search logs..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pl-9 pr-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 sticky top-0 z-10 shadow-sm">
                                {activeTab === 'activity' ? (
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Time</th>
                                        <th className="px-6 py-4 font-semibold">User / Tenant</th>
                                        <th className="px-6 py-4 font-semibold">Action Type</th>
                                        <th className="px-6 py-4 font-semibold">Description</th>
                                        <th className="px-6 py-4 font-semibold">IP Address</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Time</th>
                                        <th className="px-6 py-4 font-semibold">Path / Method</th>
                                        <th className="px-6 py-4 font-semibold">Error Message</th>
                                        <th className="px-6 py-4 font-semibold">User Context</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center py-12"><Loader2 className="animate-spin text-slate-400 mx-auto" /></td></tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-12 text-slate-500">No logs discovered here.</td></tr>
                                ) : activeTab === 'activity' ? (
                                    filteredLogs.map(log => (
                                        <tr key={log.activity_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">{new Date(log.occurred_at).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{log.user_name || 'System Auto'}</span>
                                                    {log.org_name && <span className="text-xs text-slate-500 border border-slate-200 dark:border-slate-700 rounded px-1 mt-1 w-max">ORG: {log.org_name}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-indigo-800/30 dark:bg-indigo-900/40 dark:text-indigo-400 uppercase tracking-widest">
                                                    {log.event_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 min-w-[300px] whitespace-normal">
                                                {log.description}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                                {log.request_ip || 'N/A'}
                                            </td>
                                        </tr>
                                    ))
                                ) : ( // Error Logs Render
                                    filteredLogs.map(err => (
                                        <tr key={err.error_id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">{new Date(err.occurred_at).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-mono">
                                                        {err.request_method || 'SYS'}
                                                    </span>
                                                    <span className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate max-w-[200px]" title={err.request_path}>
                                                        {err.request_path || 'Background Job'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 min-w-[350px] whitespace-normal">
                                                <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">{err.error_message}</div>
                                                {err.stack_trace && (
                                                    <details className="text-xs">
                                                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-medium">View Stack Trace</summary>
                                                        <pre className="mt-2 p-3 bg-slate-900 text-red-300 rounded overflow-x-auto break-all whitespace-pre-wrap">{err.stack_trace.substring(0, 500)}...</pre>
                                                    </details>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                                                {err.user_name ? `${err.user_name} (ORG: ${err.org_name || 'Global'})` : 'Anonymous Request'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default SystemLogs;

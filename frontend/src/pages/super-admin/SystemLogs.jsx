import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Activity, AlertTriangle, Code, Search, Loader2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import LoadingScreen from '../../components/LoadingScreen';
import MinimalSelect from '../../components/MinimalSelect';

const SystemLogs = () => {
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

    // Filter states
    const [logModule, setLogModule] = useState('');
    const [logPlatform, setLogPlatform] = useState('');
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [organizations, setOrganizations] = useState([]);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    useEffect(() => {
        fetchLogs(activeTab);
    }, [activeTab]);

    const fetchOrganizations = async () => {
        try {
            const res = await api.get('/organizations');
            setOrganizations(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        }
    };

    const fetchLogs = async (tab) => {
        setLoading(true);
        try {
            if (tab === 'activity') {
                const res = await api.get('/super-admin/monitor/logs/activity');
                setActivityLogs(res.data.data || []);
            } else if (tab === 'errors') {
                const res = await api.get('/super-admin/monitor/logs/errors');
                setErrorLogs(res.data.data || []);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to fetch ${tab} logs`);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setLogModule('');
        setLogPlatform('');
        setSelectedOrgId('');
        setSearchQuery('');
    };

    const logsToDisplay = activeTab === 'activity' ? activityLogs : errorLogs;

    // Client-side triple filtering & text matching
    const filteredLogs = Array.isArray(logsToDisplay) ? logsToDisplay.filter(log => {
        // Module Filter
        if (logModule && log.module !== logModule) {
            return false;
        }

        // Platform Filter
        if (logPlatform && log.platform !== logPlatform) {
            return false;
        }

        // Organization Filter
        if (selectedOrgId && String(log.org_id) !== String(selectedOrgId)) {
            return false;
        }

        const query = searchQuery.toLowerCase();
        if (activeTab === 'activity') {
            return (
                (log.event_type && log.event_type.toLowerCase().includes(query)) ||
                (log.description && log.description.toLowerCase().includes(query)) ||
                (log.user_name && log.user_name.toLowerCase().includes(query)) ||
                (log.org_name && log.org_name.toLowerCase().includes(query)) ||
                (log.request_ip && log.request_ip.includes(query)) ||
                (log.module && log.module.toLowerCase().includes(query)) ||
                (log.platform && log.platform.toLowerCase().includes(query))
            );
        } else {
            return (
                (log.error_message && log.error_message.toLowerCase().includes(query)) ||
                (log.request_path && log.request_path.toLowerCase().includes(query)) ||
                (log.user_name && log.user_name.toLowerCase().includes(query)) ||
                (log.org_name && log.org_name.toLowerCase().includes(query)) ||
                (log.request_method && log.request_method.toLowerCase().includes(query)) ||
                (log.module && log.module.toLowerCase().includes(query)) ||
                (log.platform && log.platform.toLowerCase().includes(query))
            );
        }
    }) : [];

    return (
        <DashboardLayout title="System Logs">
            <div className="space-y-4">
                {/* Action Bar (Search & Tabs) */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
                    {/* Tabs on Left */}
                    <div className="flex bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-lg">
                        <button
                            onClick={() => handleTabChange('activity')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                activeTab === 'activity' 
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' 
                                : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-slate-200'
                            }`}
                        >
                            <Activity size={16} /> User Activity
                        </button>
                        <button
                            onClick={() => handleTabChange('errors')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                activeTab === 'errors' 
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600 dark:text-red-400' 
                                : 'text-slate-500 hover:text-slate-700 dark:text-github-dark-muted dark:hover:text-slate-200'
                            }`}
                        >
                            <AlertTriangle size={16} /> Application Errors
                        </button>
                    </div>

                    {/* Filters & Search on Right */}
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        {/* Organization Selector */}
                        <MinimalSelect
                            options={[
                                { label: 'All Organizations', value: '' },
                                ...organizations.map(org => ({ label: org.org_name, value: org.org_id }))
                            ]}
                            value={selectedOrgId}
                            onChange={setSelectedOrgId}
                            placeholder="All Organizations"
                            triggerClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-github-dark-border text-xs py-2 px-3 font-bold w-full sm:w-auto"
                        />

                        {/* Module Selector */}
                        <MinimalSelect
                            options={[
                                { label: 'All Modules', value: '' },
                                { label: 'Authentication', value: 'Authentication' },
                                { label: 'Attendance', value: 'Attendance' },
                                { label: 'Live Attendance', value: 'Live Attendance' },
                                { label: 'DAR (Daily Activity)', value: 'DAR (Daily Activity)' },
                                { label: 'DAR Reports & AI', value: 'DAR Reports & AI' },
                                { label: 'Leaves', value: 'Leaves' },
                                { label: 'Holidays', value: 'Holidays' },
                                { label: 'Shift Policies', value: 'Shift Policies' },
                                { label: 'Employees', value: 'Employees' },
                                { label: 'Organizations', value: 'Organizations' },
                                { label: 'Notifications', value: 'Notifications' },
                                { label: 'Profile', value: 'Profile' },
                                { label: 'Chatbot', value: 'Chatbot' },
                                { label: 'Work Locations', value: 'Work Locations' },
                                { label: 'Reports & Summaries', value: 'Reports & Summaries' },
                                { label: 'System Monitor', value: 'System Monitor' },
                                { label: 'Super Admin', value: 'Super Admin' },
                                { label: 'Admin Portal', value: 'Admin Portal' },
                                { label: 'Payments', value: 'Payments' },
                                { label: 'General', value: 'General' }
                            ]}
                            value={logModule}
                            onChange={setLogModule}
                            placeholder="All Modules"
                            triggerClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-github-dark-border text-xs py-2 px-3 font-bold w-full sm:w-auto"
                        />

                        {/* Platform Selector */}
                        <MinimalSelect
                            options={[
                                { label: 'All Platforms', value: '' },
                                { label: 'WEB', value: 'WEB' },
                                { label: 'MOBILE_APP', value: 'MOBILE_APP' },
                                { label: 'API_CLIENT', value: 'API_CLIENT' }
                            ]}
                            value={logPlatform}
                            onChange={setLogPlatform}
                            placeholder="All Platforms"
                            triggerClassName="bg-white dark:bg-slate-800 border-slate-200 dark:border-github-dark-border text-xs py-2 px-3 font-bold w-full sm:w-auto"
                        />

                        {/* Search Bar */}
                        <div className="relative flex-grow sm:flex-grow-0 w-full sm:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text" 
                                placeholder="Search logs..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-48 pl-9 pr-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-github-dark-text font-medium"
                            />
                        </div>

                        {/* Refresh Button */}
                        <button
                            type="button"
                            onClick={() => fetchLogs(activeTab)}
                            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-github-dark-border rounded-lg hover:text-indigo-600 text-slate-500 active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0"
                            title="Reload logs"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* List Content */}
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-github-dark-border relative min-h-[300px]">
                    {loading ? (
                        <LoadingScreen message="Fetching system logs..." isSuperAdmin={true} fullScreen={false} />
                    ) : (
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-github-dark-subtle/80 border-b border-slate-200 dark:border-github-dark-border text-slate-600 dark:text-github-dark-muted sticky top-0 z-10 shadow-sm font-bold text-xs">
                                {activeTab === 'activity' ? (
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Time</th>
                                        <th className="px-6 py-4 font-semibold">Module</th>
                                        <th className="px-6 py-4 font-semibold">Platform</th>
                                        <th className="px-6 py-4 font-semibold">User / Tenant</th>
                                        <th className="px-6 py-4 font-semibold">Action Type</th>
                                        <th className="px-6 py-4 font-semibold">Description</th>
                                        <th className="px-6 py-4 font-semibold">IP Address</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Time</th>
                                        <th className="px-6 py-4 font-semibold">Module</th>
                                        <th className="px-6 py-4 font-semibold">Platform</th>
                                        <th className="px-6 py-4 font-semibold">Path / Method</th>
                                        <th className="px-6 py-4 font-semibold">Error Message</th>
                                        <th className="px-6 py-4 font-semibold">User Context</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTab === 'activity' ? 7 : 6} className="text-center py-12 text-slate-500 dark:text-github-dark-muted font-bold text-sm">
                                            No logs matching filters found.
                                        </td>
                                    </tr>
                                ) : activeTab === 'activity' ? (
                                    filteredLogs.map(log => (
                                        <tr key={log.activity_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-500">{new Date(log.occurred_at).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 rounded font-black text-[10px] uppercase border bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800/30">
                                                    {log.module}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase border ${
                                                    log.platform === 'WEB'
                                                        ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/30'
                                                }`}>
                                                    {log.platform === 'MOBILE_APP' ? 'MOBILE_APP' : log.platform}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 dark:text-github-dark-text">{log.user_name || 'System Auto'}</span>
                                                    {log.org_name && <span className="text-[10px] text-slate-500 border border-slate-200 dark:border-github-dark-border rounded px-1.5 py-0.5 mt-1 w-max font-bold">ORG: {log.org_name}</span>}
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
                                            <td className="px-6 py-4 font-mono text-slate-500">
                                                {log.request_ip || 'N/A'}
                                            </td>
                                        </tr>
                                    ))
                                ) : ( // Error Logs Render
                                    filteredLogs.map(err => (
                                        <tr key={err.error_id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-500">{new Date(err.occurred_at).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 rounded font-black text-[10px] uppercase border bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800/30">
                                                    {err.module}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase border ${
                                                    err.platform === 'WEB'
                                                        ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/30'
                                                }`}>
                                                    {err.platform === 'MOBILE_APP' ? 'MOBILE_APP' : err.platform}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-mono">
                                                        {err.request_method || 'SYS'}
                                                    </span>
                                                    <span className="text-xs text-slate-600 dark:text-github-dark-muted font-mono truncate max-w-[200px]" title={err.request_path}>
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
                                            <td className="px-6 py-4 text-slate-600 dark:text-github-dark-muted font-bold">
                                                {err.user_name ? (
                                                    <div className="flex flex-col">
                                                        <span>{err.user_name}</span>
                                                        {err.org_name && <span className="text-[10px] text-slate-500 border border-slate-200 dark:border-github-dark-border rounded px-1.5 py-0.5 mt-1 w-max font-bold">ORG: {err.org_name}</span>}
                                                    </div>
                                                ) : 'Anonymous Request'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default SystemLogs;

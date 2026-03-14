import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { ShieldAlert, Search, Loader2, CheckCircle, Clock } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const SecurityAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await api.get('/super-admin/monitor/alerts');
            setAlerts(res.data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch security alerts');
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id) => {
        try {
            await api.put(`/super-admin/monitor/alerts/${id}`, { status: 'resolved' });
            toast.success('Alert marked as resolved');
            setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resolve alert');
        }
    };

    const filteredAlerts = Array.isArray(alerts) ? alerts.filter(a => 
        (a.alert_type && a.alert_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.ip_address && a.ip_address.includes(searchQuery)) ||
        (a.user_name && a.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.org_name && a.org_name.toLowerCase().includes(searchQuery.toLowerCase()))
    ) : [];

    const getSeverityBadge = (severity) => {
        switch (severity?.toLowerCase()) {
            case 'high': return <span className="px-2 py-1 text-xs font-bold rounded-md bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-widest">HIGH</span>;
            case 'medium': return <span className="px-2 py-1 text-xs font-bold rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-widest">MED</span>;
            case 'low': return <span className="px-2 py-1 text-xs font-bold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 uppercase tracking-widest">LOW</span>;
            default: return <span className="px-2 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-widest">{severity}</span>;
        }
    };

    return (
        <DashboardLayout title="Security Alerts">
            <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldAlert size={28} className="text-red-500" />
                            Security Alerts
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Monitor and resolve suspicious geographic and system activity.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search IP, User, Org..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pl-9 pr-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Severity / Type</th>
                                    <th className="px-6 py-4 font-semibold">Description</th>
                                    <th className="px-6 py-4 font-semibold">Target (User/Org)</th>
                                    <th className="px-6 py-4 font-semibold">IP Address</th>
                                    <th className="px-6 py-4 font-semibold">Time</th>
                                    <th className="px-6 py-4 font-semibold text-right">Status / Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan="6" className="text-center py-12"><Loader2 className="animate-spin text-slate-400 mx-auto" /></td></tr>
                                ) : filteredAlerts.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center py-12 text-slate-500">No security alerts found.</td></tr>
                                ) : (
                                    filteredAlerts.map(alert => (
                                        <tr key={alert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {getSeverityBadge(alert.severity)}
                                                    <span className="font-medium text-slate-800 dark:text-slate-200">{alert.alert_type}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-normal min-w-[250px]">
                                                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{alert.description || 'No description provided'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-800 dark:text-slate-200">{alert.user_name || 'System / Anonymous'}</span>
                                                    {alert.org_name && <span className="text-xs text-slate-500">{alert.org_name}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                                {alert.ip_address || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs">
                                                {new Date(alert.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {alert.status === 'resolved' ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                        <CheckCircle size={14} /> Resolved
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-3">
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                            <Clock size={14} /> Open
                                                        </span>
                                                        <button 
                                                            onClick={() => handleResolve(alert.id)}
                                                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded text-xs font-semibold transition-colors"
                                                        >
                                                            Resolve
                                                        </button>
                                                    </div>
                                                )}
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

export default SecurityAlerts;

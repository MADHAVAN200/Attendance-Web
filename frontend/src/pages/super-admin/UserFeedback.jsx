import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { MessageSquare, Search, Loader2, Paperclip, ExternalLink, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const UserFeedback = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchFeedback();
    }, []);

    const fetchFeedback = async () => {
        setLoading(true);
        try {
            const res = await api.get('/super-admin/monitor/feedback');
            setFeedback(res.data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch user feedback');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            await api.put(`/super-admin/monitor/feedback/${id}`, { status: newStatus });
            toast.success(`Feedback marked as ${newStatus}`);
            setFeedback(feedback.map(f => f.feedback_id === id ? { ...f, status: newStatus } : f));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    const filteredFeedback = Array.isArray(feedback) ? feedback.filter(f => 
        (f.title && f.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.user_name && f.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.org_name && f.org_name.toLowerCase().includes(searchQuery.toLowerCase()))
    ) : [];

    const getTypeBadge = (type) => {
        switch (type?.toLowerCase()) {
            case 'bug': return <span className="px-2 py-1 text-[10px] font-bold rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-wider">BUG REPORT</span>;
            case 'feature': return <span className="px-2 py-1 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 uppercase tracking-wider">FEATURE REQ</span>;
            case 'general': return <span className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wider">GENERAL</span>;
            default: return <span className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wider">{type}</span>;
        }
    };

    return (
        <DashboardLayout title="User Feedback">
            <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MessageSquare size={28} className="text-indigo-500" />
                            User Feedback & Bug Reports
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review feedback, feature requests, and issues reported by your tenants.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search queries..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pl-9 pr-4 py-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {loading ? (
                        <div className="flex justify-center py-12 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700"><Loader2 className="animate-spin text-slate-400" /></div>
                    ) : filteredFeedback.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500">No feedback entries found.</div>
                    ) : (
                        filteredFeedback.map(item => (
                            <div key={item.feedback_id} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-all hover:shadow-md">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-4">
                                        <div className="mt-1">{getTypeBadge(item.type)}</div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{item.user_name || 'Anonymous User'}</span>
                                                {item.org_name && <span>• {item.org_name}</span>}
                                                <span>• {new Date(item.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.status === 'resolved' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider">
                                                <CheckCircle size={14} /> Resolved
                                            </span>
                                        ) : item.status === 'reviewed' ? (
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg text-xs font-bold uppercase tracking-wider">Reviewed</span>
                                                <button onClick={() => handleUpdateStatus(item.feedback_id, 'resolved')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">Mark Resolved</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-xs font-bold uppercase tracking-wider">Pending</span>
                                                <button onClick={() => handleUpdateStatus(item.feedback_id, 'reviewed')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Mark Reviewed</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-slate-800/60">
                                    {item.description}
                                </div>
                                {item.attachments && item.attachments.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
                                        <div className="text-xs font-semibold text-slate-500 w-full flex items-center gap-1"><Paperclip size={12}/> Attachments ({item.attachments.length})</div>
                                        {item.attachments.map(att => (
                                            <a 
                                                key={att.attachment_id} 
                                                href={att.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                            >
                                                {att.file_name} <ExternalLink size={12} />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default UserFeedback;

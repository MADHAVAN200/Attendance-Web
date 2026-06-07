import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
    MessageSquare, Search, Loader2, Paperclip, ExternalLink, CheckCircle, 
    Clock, AlertTriangle, Eye, ArrowUpDown, ChevronRight, Copy, Mail, 
    RefreshCw, Filter, X, ChevronLeft, Check, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import MinimalSelect from '../../components/MinimalSelect';
import LoadingScreen from '../../components/LoadingScreen';

const UserFeedback = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryTab, setActiveCategoryTab] = useState('bug'); // 'bug' | 'feedback'
    const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'reviewed' | 'resolved'
    const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'
    const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);
    const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

    useEffect(() => {
        fetchFeedback();
    }, []);

    const fetchFeedback = async () => {
        setLoading(true);
        try {
            const res = await api.get('/super-admin/monitor/feedback');
            const data = res.data.data || [];
            setFeedback(data);
            
            // Set initial selected feedback
            if (data.length > 0) {
                // Find first bug or feedback depending on default tab
                const firstItem = data.find(f => f.type?.toLowerCase() === 'bug') || data[0];
                if (firstItem) {
                    setSelectedFeedbackId(firstItem.feedback_id);
                    if (firstItem.type?.toLowerCase() !== 'bug') {
                        setActiveCategoryTab('feedback');
                    }
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch user feedback');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            await api.put(`/super-admin/monitor/feedback/${id}`, { status: newStatus });
            
            // Customize toast notification based on the feedback type
            const item = feedback.find(f => f.feedback_id === id);
            const label = item?.type?.toLowerCase() === 'bug' ? 'Bug report' : 'Feedback';
            toast.success(`${label} marked as ${newStatus} successfully!`);
            
            setFeedback(prev => prev.map(f => f.feedback_id === id ? { ...f, status: newStatus, updated_at: new Date().toISOString() } : f));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    // Calculate global counts for the tab badges
    const totalBugCount = feedback.filter(f => f.type?.toLowerCase() === 'bug').length;
    const totalFeedbackCount = feedback.filter(f => f.type?.toLowerCase() !== 'bug').length;

    // Filter feedback by the active category tab (Bugs vs Feedbacks)
    const categoryFeedback = feedback.filter(f => {
        const isBug = f.type?.toLowerCase() === 'bug';
        return activeCategoryTab === 'bug' ? isBug : !isBug;
    });

    // Calculate dynamic stats relative to the active category tab
    const totalCount = categoryFeedback.length;
    const pendingCount = categoryFeedback.filter(f => f.status === 'pending').length;
    const reviewedCount = categoryFeedback.filter(f => f.status === 'reviewed').length;
    const resolvedCount = categoryFeedback.filter(f => f.status === 'resolved').length;

    // Apply secondary filters (Search, Status, Type) on the categorized items
    const filteredFeedback = categoryFeedback.filter(f => {
        // Search filter
        const matchesSearch = searchQuery === '' || 
            (f.title && f.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (f.user_name && f.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (f.email && f.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (f.org_name && f.org_name.toLowerCase().includes(searchQuery.toLowerCase()));

        // Status filter
        const matchesStatus = filterStatus === 'all' || f.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Sort feedback
    const sortedFeedback = [...filteredFeedback].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // Determine the active item to view details
    const activeItem = sortedFeedback.find(f => f.feedback_id === selectedFeedbackId) || sortedFeedback[0] || null;

    const handleSelectFeedback = (id) => {
        setSelectedFeedbackId(id);
        setIsMobileDetailOpen(true);
    };

    // When toggling category tab, reset sub-filters and active selection
    const handleCategoryTabChange = (category) => {
        setActiveCategoryTab(category);
        setFilterStatus('all');
        setSearchQuery('');
        
        // Select the first ticket in the new category
        const newCategoryItems = feedback.filter(f => {
            const isBug = f.type?.toLowerCase() === 'bug';
            return category === 'bug' ? isBug : !isBug;
        });
        if (newCategoryItems.length > 0) {
            setSelectedFeedbackId(newCategoryItems[0].feedback_id);
        } else {
            setSelectedFeedbackId(null);
        }
    };

    const handleCopyDetails = (item) => {
        if (!item) return;
        const formattedText = `Ticket ID: #${item.feedback_id}
Type: ${item.type?.toUpperCase()}
Status: ${item.status?.toUpperCase()}
Title: ${item.title}
Submitter: ${item.user_name || 'Anonymous'} (${item.email || 'No email'})
Organization: ${item.org_name || 'N/A'}
Date Submitted: ${new Date(item.created_at).toLocaleString()}
--------------------------------------------------
Description:
${item.description}
`;
        navigator.clipboard.writeText(formattedText);
        toast.info('Ticket details copied to clipboard!');
    };

    const handleCopyEmail = (email) => {
        if (!email) return;
        navigator.clipboard.writeText(email);
        toast.info('Email address copied!');
    };

    const formatRelativeTime = (dateString) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (e) {
            return '';
        }
    };

    const getTypeBadge = (type) => {
        switch (type?.toLowerCase()) {
            case 'bug': 
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 uppercase tracking-wider">BUG REPORT</span>;
            case 'feature': 
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-wider">FEATURE REQ</span>;
            case 'general': 
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 dark:bg-github-dark-border dark:text-github-dark-muted uppercase tracking-wider">GENERAL</span>;
            default: 
                return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 dark:bg-github-dark-border dark:text-github-dark-muted uppercase tracking-wider">{type}</span>;
        }
    };

    const getStatusIndicator = (status) => {
        switch (status) {
            case 'resolved':
                return <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle size={12} /> Resolved</span>;
            case 'reviewed':
                return <span className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold"><Eye size={12} /> Reviewed</span>;
            default:
                return <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold"><Clock size={12} /> Pending</span>;
        }
    };

    return (
        <DashboardLayout title="User Feedback" noPadding={true}>
            {/* Height stretched to take up the full screen down to the footer */}
            <div className="flex flex-col h-auto lg:h-[calc(100vh-64px)] p-3 space-y-4 overflow-y-auto lg:overflow-hidden">
                
                {/* Dynamic Metric Cards (Top) - Updates dynamically based on category */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                    <button 
                        onClick={() => setFilterStatus('all')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                            filterStatus === 'all' 
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-sm ring-1 ring-indigo-500/30' 
                                : 'bg-white dark:bg-dark-card border-slate-200 dark:border-github-dark-border hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted">
                                Total {activeCategoryTab === 'bug' ? 'Bugs' : 'Feedbacks'}
                            </span>
                            <MessageSquare className="text-slate-400" size={16} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-github-dark-text">{totalCount}</div>
                        <div className="text-[10px] text-slate-400 dark:text-github-dark-muted mt-0.5">
                            {activeCategoryTab === 'bug' ? 'Submitted bug tickets' : 'Feature requests & other'}
                        </div>
                    </button>

                    <button 
                        onClick={() => setFilterStatus('pending')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                            filterStatus === 'pending' 
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 shadow-sm ring-1 ring-amber-500/30' 
                                : 'bg-white dark:bg-dark-card border-slate-200 dark:border-github-dark-border hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted">Pending</span>
                            <Clock className="text-amber-500" size={16} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-github-dark-text">{pendingCount}</div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium font-poppins">Needs attention</div>
                    </button>

                    <button 
                        onClick={() => setFilterStatus('reviewed')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                            filterStatus === 'reviewed' 
                                ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-500 shadow-sm ring-1 ring-purple-500/30' 
                                : 'bg-white dark:bg-dark-card border-slate-200 dark:border-github-dark-border hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted">Reviewed</span>
                            <Eye className="text-purple-500" size={16} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-github-dark-text">{reviewedCount}</div>
                        <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium">Under review</div>
                    </button>

                    <button 
                        onClick={() => setFilterStatus('resolved')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                            filterStatus === 'resolved' 
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30' 
                                : 'bg-white dark:bg-dark-card border-slate-200 dark:border-github-dark-border hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-semibold text-slate-500 dark:text-github-dark-muted">Resolved</span>
                            <CheckCircle className="text-emerald-500" size={16} />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-github-dark-text">{resolvedCount}</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Completed / Closed</div>
                    </button>
                </div>

                {/* Master-Detail Panel */}
                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden relative">
                    
                    {/* Left Pane: Ticket List */}
                    <div className={`w-full md:w-[38%] flex flex-col bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden ${
                        isMobileDetailOpen ? 'hidden md:flex' : 'flex'
                    }`}>
                        
                        {/* Two Category Tabs (Organizations Segmented Style) */}
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-github-dark-border bg-slate-50/30 dark:bg-github-dark-subtle/10">
                            <div className="flex space-x-1 bg-slate-100 dark:bg-github-dark-subtle p-1 rounded-xl w-full">
                                <button
                                    type="button"
                                    onClick={() => handleCategoryTabChange('bug')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                        activeCategoryTab === 'bug'
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                                            : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <AlertTriangle size={13} className={activeCategoryTab === 'bug' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                                    <span>Bug Reports</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        activeCategoryTab === 'bug'
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>{totalBugCount}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCategoryTabChange('feedback')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                                        activeCategoryTab === 'feedback'
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                                            : 'text-slate-500 dark:text-github-dark-muted hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <MessageSquare size={13} className={activeCategoryTab === 'feedback' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                                    <span>Feedbacks</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        activeCategoryTab === 'feedback'
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>{totalFeedbackCount}</span>
                                </button>
                            </div>
                        </div>

                        {/* Search & Filter Sub-Header */}
                        <div className="p-3 border-b border-slate-200 dark:border-github-dark-border shrink-0 flex items-center gap-2 bg-slate-50/30 dark:bg-github-dark-subtle/5">
                            {/* Search bar */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                <input 
                                    type="text" 
                                    placeholder={`Search...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-8 h-10 bg-white dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-github-dark-text"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Filters */}
                            <div className="w-28 shrink-0">
                                <MinimalSelect
                                    options={["Newest", "Oldest"]}
                                    value={sortBy === 'newest' ? 'Newest' : 'Oldest'}
                                    onChange={(val) => setSortBy(val === 'Newest' ? 'newest' : 'oldest')}
                                    size="sm"
                                    triggerClassName="w-full justify-between h-10 px-3 !bg-white dark:!bg-github-dark-bg !border-slate-200 dark:!border-github-dark-border rounded-xl text-xs font-semibold shadow-sm text-slate-800 dark:text-slate-300"
                                />
                            </div>
                        </div>

                        {/* List Area (Scrollbar hidden using no-scrollbar class) */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-github-dark-border no-scrollbar">
                            {loading ? (
                                <LoadingScreen message="Fetching feedback items..." isSuperAdmin={true} fullScreen={false} />
                            ) : sortedFeedback.length === 0 ? (
                                <div className="text-center py-16 text-slate-500 text-xs">
                                    No {activeCategoryTab === 'bug' ? 'bug reports' : 'feedback logs'} found.
                                </div>
                            ) : (
                                sortedFeedback.map(item => (
                                    <button 
                                        key={item.feedback_id} 
                                        onClick={() => handleSelectFeedback(item.feedback_id)}
                                        className={`w-full text-left p-3.5 flex flex-col gap-2 transition-all relative border-l-3 ${
                                            activeItem?.feedback_id === item.feedback_id
                                                ? 'bg-indigo-50/40 dark:bg-indigo-950/15 border-indigo-500'
                                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-github-dark-subtle/30'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start w-full gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {getTypeBadge(item.type)}
                                                <span className={`w-1.5 h-1.5 rounded-full ${
                                                    item.status === 'resolved' 
                                                        ? 'bg-emerald-500' 
                                                        : item.status === 'reviewed' 
                                                            ? 'bg-indigo-500' 
                                                            : 'bg-amber-500'
                                                }`}></span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-github-dark-muted whitespace-nowrap">
                                                {formatRelativeTime(item.created_at)}
                                            </span>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-github-dark-text line-clamp-1 leading-snug">
                                                {item.title}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 dark:text-github-dark-muted line-clamp-2 mt-1 leading-relaxed">
                                                {item.description}
                                            </p>
                                        </div>

                                        <div className="flex justify-between items-center mt-0.5 text-[10px] text-slate-400 dark:text-github-dark-muted w-full">
                                            <span className="truncate max-w-[70%] font-medium">
                                                {item.user_name || 'Anonymous User'} 
                                                {item.org_name ? ` (${item.org_name})` : ''}
                                            </span>
                                            {item.attachments && item.attachments.length > 0 && (
                                                <span className="flex items-center gap-0.5 text-indigo-500 font-semibold">
                                                    <Paperclip size={10} /> {item.attachments.length}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Pane: Ticket Detail */}
                    <div className={`w-full md:w-[62%] flex flex-col bg-white dark:bg-dark-card border border-slate-200 dark:border-github-dark-border rounded-xl overflow-hidden ${
                        !isMobileDetailOpen ? 'hidden md:flex' : 'flex'
                    }`}>
                        {activeItem ? (
                            <div className="flex-1 flex flex-col min-h-0">
                                {/* Details Scrollable Box (Scrollbar hidden using no-scrollbar class) */}
                                <div className="flex-1 overflow-y-auto p-6 no-scrollbar space-y-6">
                                    {/* Mobile Back Button */}
                                    <button 
                                        onClick={() => setIsMobileDetailOpen(false)}
                                        className="md:hidden flex items-center gap-1.5 text-slate-500 dark:text-github-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 font-semibold text-xs transition-colors"
                                    >
                                        <ChevronLeft size={16} /> Back to List
                                    </button>

                                    {/* Top Metadata Header */}
                                    <div className="border-b border-slate-100 dark:border-github-dark-border pb-5">
                                        <div className="flex flex-wrap gap-2 items-center mb-3">
                                            {getTypeBadge(activeItem.type)}
                                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-github-dark-subtle text-slate-600 dark:text-slate-300">
                                                Ticket #{activeItem.feedback_id}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-github-dark-muted">
                                                Submitted on {new Date(activeItem.created_at).toLocaleString()}
                                            </span>
                                        </div>

                                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-github-dark-text leading-snug">
                                            {activeItem.title}
                                        </h2>

                                        {/* Status and Action Buttons */}
                                        <div className="mt-4 flex flex-wrap gap-2 items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-400 dark:text-github-dark-muted">Status:</span>
                                                {getStatusIndicator(activeItem.status)}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {activeItem.status !== 'pending' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(activeItem.feedback_id, 'pending')}
                                                        className="px-2.5 py-1 text-[11px] font-semibold border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                                                    >
                                                        Mark Pending
                                                    </button>
                                                )}
                                                {activeItem.status !== 'reviewed' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(activeItem.feedback_id, 'reviewed')}
                                                        className="px-2.5 py-1 text-[11px] font-semibold border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-950/30 transition-colors"
                                                    >
                                                        Mark Reviewed
                                                    </button>
                                                )}
                                                {activeItem.status !== 'resolved' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(activeItem.feedback_id, 'resolved')}
                                                        className="px-2.5 py-1 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-950/30 transition-colors"
                                                    >
                                                        Mark Resolved
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* User Details Grid */}
                                    <div className="bg-slate-50 dark:bg-github-dark-subtle/30 border border-slate-100 dark:border-github-dark-border p-4 rounded-xl">
                                        <h3 className="text-[11px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider mb-2">Submitter Profile</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-slate-400 dark:text-github-dark-muted">User Name</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{activeItem.user_name || 'Anonymous User'}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-slate-400 dark:text-github-dark-muted">Organization</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{activeItem.org_name || 'N/A'}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5 sm:col-span-2">
                                                <span className="text-slate-400 dark:text-github-dark-muted">Email Address</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300 break-all">{activeItem.email || 'N/A'}</span>
                                                    {activeItem.email && (
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => handleCopyEmail(activeItem.email)}
                                                                title="Copy Email"
                                                                className="p-1 rounded bg-white dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500 transition-colors"
                                                            >
                                                                <Copy size={11} />
                                                            </button>
                                                            <a 
                                                                href={`mailto:${activeItem.email}`}
                                                                title="Send Direct Email"
                                                                className="p-1 rounded bg-white dark:bg-github-dark-bg border border-slate-200 dark:border-github-dark-border text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500 transition-colors"
                                                            >
                                                                <Mail size={11} />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ticket Description */}
                                    <div className="space-y-2">
                                        <h3 className="text-[11px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Report Description</h3>
                                        <div className="bg-white dark:bg-github-dark-bg border border-slate-100 dark:border-github-dark-border p-4 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-text font-mono">
                                            {activeItem.description}
                                        </div>
                                    </div>

                                    {/* Attachments Section */}
                                    {activeItem.attachments && activeItem.attachments.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-[11px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider flex items-center gap-1">
                                                <Paperclip size={12} /> Attachments ({activeItem.attachments.length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {activeItem.attachments.map(att => {
                                                    const isImage = att.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                                    return (
                                                        <div 
                                                            key={att.attachment_id} 
                                                            className="flex items-center gap-3 p-2 bg-slate-50/50 dark:bg-github-dark-subtle/10 border border-slate-200 dark:border-github-dark-border rounded-lg"
                                                        >
                                                            {isImage && att.url ? (
                                                                <img 
                                                                    src={att.url} 
                                                                    alt={att.file_name} 
                                                                    className="w-10 h-10 object-cover rounded-md border border-slate-200 dark:border-github-dark-border"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-md font-semibold text-xs shrink-0 border border-indigo-100 dark:border-indigo-900/40">
                                                                    FILE
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate" title={att.file_name}>
                                                                    {att.file_name}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 dark:text-github-dark-muted capitalize">
                                                                    {att.file_type || 'Unknown'}
                                                                </p>
                                                            </div>
                                                            <a 
                                                                href={att.url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 border border-slate-200 dark:border-github-dark-border rounded-lg hover:border-indigo-500 bg-white dark:bg-github-dark-bg transition-all"
                                                                title="View Attachment"
                                                            >
                                                                <ExternalLink size={12} />
                                                            </a>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Utilities Box */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-github-dark-border space-y-2">
                                        <h3 className="text-[11px] font-bold text-slate-400 dark:text-github-dark-muted uppercase tracking-wider">Quick Resolutions</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {activeItem.email && (
                                                <a 
                                                    href={`mailto:${activeItem.email}?subject=Re: [MANO Support - Ticket %23${activeItem.feedback_id}] ${encodeURIComponent(activeItem.title)}&body=Hi ${encodeURIComponent(activeItem.user_name || '')},%0A%0AWe have received your report regarding "${encodeURIComponent(activeItem.title)}".%0A%0A[Write reply details here]%0A%0ABest regards,%0ASupport Team`}
                                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                                                >
                                                    <Mail size={13} />
                                                    Draft Email Reply
                                                </a>
                                            )}
                                            <button 
                                                onClick={() => handleCopyDetails(activeItem)}
                                                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-github-dark-border hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all shadow-sm"
                                            >
                                                <Copy size={13} />
                                                Copy Ticket Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/30 dark:bg-github-dark-subtle/10">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-github-dark-subtle flex items-center justify-center mb-3 text-slate-400 dark:text-github-dark-muted">
                                    <MessageSquare size={20} />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-github-dark-text mb-1">No Ticket Selected</h3>
                                <p className="text-xs text-slate-500 dark:text-github-dark-muted max-w-xs">
                                    Choose an issue or feedback from the list to manage and review details.
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
};

export default UserFeedback;



import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { holidayService } from '../../services/holidayService';
import api from '../../services/api';
import DatePicker from '../../components/DatePicker';
import { toast } from 'react-toastify';
import {
    Calendar,
    Plus,
    Trash2,
    Search,
    X,
    FileText,
    Shield,
    Upload,
    MoreVertical,
    Clock,
    CheckCircle,
    XCircle,
    ChevronDown,
    Paperclip,
    ExternalLink,
    Filter,
    ArrowLeft,
    Umbrella,
    Edit3,
    CalendarDays,
    Info,
    History,
    Check
} from 'lucide-react';
import MobileDatePicker from '../../components/MobileDatePicker';
import MobileSelect from '../../components/MobileSelect';
import MobileConfirmModal from '../../components/MobileConfirmModal';

const AttachmentModal = ({ file, onClose }) => {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_key || file.name);
    const isPdf = file.file_type === 'application/pdf' || /\.pdf$/i.test(file.file_key || file.name);

    return createPortal(
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <div className="absolute -inset-10 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative z-10 bg-white dark:bg-black rounded-2xl overflow-hidden w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-github-dark-border bg-slate-50 dark:bg-black">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                            {isImage ? <FileText size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-medium text-slate-800 dark:text-github-dark-text text-sm truncate max-w-[200px]">
                                {(file.file_key || file.name)?.split('/').pop() || 'Attachment'}
                            </h3>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 p-4 flex items-center justify-center overflow-hidden relative">
                    {isImage ? (
                        <img src={file.file_url} alt="Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                    ) : isPdf ? (
                        <iframe src={file.file_url} className="w-full h-full rounded-lg border border-slate-200 dark:border-github-dark-border bg-white" title="PDF Viewer"></iframe>
                    ) : (
                        <div className="text-center">
                            <p className="text-slate-500 dark:text-github-dark-muted mb-4">This file type cannot be previewed.</p>
                            <a href={file.file_url} download className="text-indigo-600 hover:underline font-medium">Download to view</a>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const HolidayManagement = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // --- TABS STATE ---
    const [activeTab, setActiveTab] = useState('holidays'); // 'holidays', 'my_leaves', 'requests'

    // --- DATA STATE ---
    const [holidays, setHolidays] = useState([]);
    const [leaves, setLeaves] = useState([]); // My Leaves
    const [requests, setRequests] = useState([]); // Admin Requests
    const [isLoading, setIsLoading] = useState(true);

    // --- MODAL STATE ---
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [selectedLeaf, setSelectedLeaf] = useState(null); // For details view
    const [selectedHoliday, setSelectedHoliday] = useState(null); // For holiday details view
    const [viewingAttachment, setViewingAttachment] = useState(null); // For attachment modal

    // --- FILTERS ---
    const [requestSubTab, setRequestSubTab] = useState('pending'); // 'pending', 'history'
    const [requestStatusFilter, setRequestStatusFilter] = useState('All');

    // --- FORMS ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newHoliday, setNewHoliday] = useState({
        name: '',
        date: '',
        type: 'Public',
    });

    const [applyForm, setApplyForm] = useState({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: '',
        attachments: []
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [holidayActionSheet, setHolidayActionSheet] = useState(null); // For edit/delete menu
    const [remarks, setRemarks] = useState('');

    // --- CONFIRM MODAL STATE ---
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => {},
        confirmText: 'Confirm'
    });

    // --- NAVIGATION SYNC FOR BACK BUTTON ---
    useEffect(() => {
        const handlePopState = () => {
            // Close all modals when back button is pressed
            if (showApplyModal) setShowApplyModal(false);
            if (selectedLeaf) setSelectedLeaf(null);
            if (isAddModalOpen) setIsAddModalOpen(false);
            if (viewingAttachment) setViewingAttachment(null);
            if (holidayActionSheet) setHolidayActionSheet(null);
            if (confirmModal.isOpen) setConfirmModal(prev => ({ ...prev, isOpen: false }));
        };

        const isAnyModalOpen = showApplyModal || !!selectedLeaf || isAddModalOpen || !!viewingAttachment || !!holidayActionSheet || confirmModal.isOpen;

        if (isAnyModalOpen) {
            window.history.pushState({ modalOpen: true }, '');
            window.addEventListener('popstate', handlePopState);
        }

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [showApplyModal, !!selectedLeaf, isAddModalOpen, !!viewingAttachment, !!holidayActionSheet]);

    // --- FETCH DATA ---
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Parallel fetch could be better, but sequential for safety on mobile
            // 1. Holidays
            const holidayRes = await holidayService.getHolidays();
            if (holidayRes.ok) setHolidays(holidayRes.holidays || []);

            // 2. My Leaves
            const myLeavesRes = await api.get('/leaves/my-history');
            if (myLeavesRes.data.ok) setLeaves(myLeavesRes.data.leaves || []);

            // 3. Admin Requests (if applicable)
            // Even if not admin, we might just fetch empty or skip
            if (user?.user_type === 'admin' || user?.user_type === 'hr') {
                const requestsRes = await api.get('/leaves/admin/history');
                if (requestsRes.data.ok) {
                    setRequests(requestsRes.data.history || requestsRes.data.requests || []);
                }
            }

        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user]); // Reload if user context changes

    // --- ACTIONS ---

    const handleApplyLeave = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('leave_type', applyForm.leave_type);
            data.append('start_date', applyForm.start_date);
            data.append('end_date', applyForm.end_date);
            data.append('reason', applyForm.reason);
            if (applyForm.attachments) {
                applyForm.attachments.forEach(file => data.append('attachments', file));
            }

            const res = await api.post('/leaves/request', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.ok) {
                toast.success("Leave applied successfully");
                setShowApplyModal(false);
                setApplyForm({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '', attachments: [] });
                loadData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to apply");
        }
    };

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                holiday_name: newHoliday.name,
                holiday_date: newHoliday.date,
                holiday_type: newHoliday.type,
                applicable_json: ['All Locations']
            };

            if (isEditMode) {
                await holidayService.updateHoliday(holidayActionSheet.holiday_id, payload);
                toast.success("Holiday updated successfully");
            } else {
                await holidayService.addHoliday(payload);
                toast.success("Holiday added successfully");
            }
            setIsAddModalOpen(false);
            setNewHoliday({ name: '', date: '', type: 'Public' });
            loadData();
        } catch (error) {
            console.error("Holiday operation error", error);
            toast.error(error.message || "Operation failed");
        }
    };

    // --- HELPERS ---
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400';
            case 'rejected': return 'bg-red-100 text-red-500 dark:bg-red-900/20 dark:text-red-400';
            default: return 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
        }
    };

    const handleAdminAction = async (status) => {
        try {
            const res = await api.put(`/leaves/admin/approve-reject/${selectedLeaf.lr_id}`, {
                status,
                remarks: remarks || ''
            });

            if (res.data.ok) {
                toast.success(`Leave ${status} successfully`);
                setSelectedLeaf(null);
                setRemarks('');
                loadData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to ${status}`);
        }
    };

    const filteredHolidays = holidays.filter(h =>
        h.holiday_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- RENDER CONTENT ---

    return (
        <MobileDashboardLayout title="Holidays & Leave">

            {/* STICKY SEARCH & TABS CONTAINER */}
            <div className="sticky top-0 z-30 bg-slate-50 dark:bg-black pb-2 transition-colors">
                {/* Search Bar */}
                <div className="px-4 py-3">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search size={16} className={`${searchTerm ? 'text-indigo-500' : 'text-slate-400'} transition-colors`} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search holidays, leaves..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-github-dark-border rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-github-dark-text shadow-sm"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* TABS - Standardized Full Width */}
                <div className="px-4">
                    <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1.5 flex rounded-2xl backdrop-blur-md">
                        {[
                            { id: 'holidays', label: 'Holidays', icon: Umbrella },
                            { id: 'my_leaves', label: 'My Leaves', icon: CalendarDays },
                            { id: 'requests', label: 'Requests', icon: Shield, adminOnly: true }
                        ].filter(tab => !tab.adminOnly || (user?.user_type === 'admin' || user?.user_type === 'hr')).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2
                                    ${activeTab === tab.id
                                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                                        : 'text-slate-500 dark:text-github-dark-muted hover:bg-white/50 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                <tab.icon size={14} className={activeTab === tab.id ? 'animate-pulse' : ''} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-4 pb-20 min-h-screen bg-slate-50 dark:bg-black transition-colors">

                {/* --- HOLIDAYS TAB --- */}
                {activeTab === 'holidays' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 mt-2">
                        <div className="flex flex-col gap-3 px-1 mb-2">
                            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <History size={12} /> Yearly Schedule
                            </h3>
                            {(user?.user_type === 'admin' || user?.user_type === 'hr') && (
                                <button
                                    onClick={() => navigate('/holidays/bulk')}
                                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-indigo-600 text-white rounded-2xl font-semibold shadow-xl shadow-indigo-200 dark:shadow-none active:scale-95 transition-all"
                                >
                                    <Upload size={18} /> 
                                    <span className="text-sm">Bulk Import Holidays</span>
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="space-y-2.5">
                            {filteredHolidays.length > 0 ? (
                                filteredHolidays.map((holiday, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedHoliday(holiday)}
                                        className="bg-white dark:bg-black p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3.5 active:scale-[0.98] transition-all cursor-pointer group hover:border-indigo-200 dark:hover:border-indigo-900/50"
                                    >
                                        {/* Date Badge - Ultra Compact */}
                                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0 shadow-sm shadow-indigo-200 dark:shadow-none">
                                            <span className="text-[9px] font-medium uppercase leading-none opacity-80">{new Date(holiday.holiday_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                            <span className="text-lg font-medium leading-none mt-0.5">{new Date(holiday.holiday_date).getDate()}</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-slate-900 dark:text-github-dark-text text-[13px] truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {holiday.holiday_name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-medium text-slate-400">{new Date(holiday.holiday_date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider ${holiday.holiday_type === 'Public' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                                                    {holiday.holiday_type || 'Public'}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setHolidayActionSheet(holiday);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-all"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-github-dark-border rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mb-3">
                                        <Search size={24} />
                                    </div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-github-dark-muted">No holidays match your search</p>
                                    <button onClick={() => setSearchTerm('')} className="mt-2 text-[11px] font-medium text-indigo-600">Clear Search</button>
                                </div>
                            )}
                        </div>

                        {/* FAB */}
                        {(user?.user_type === 'admin' || user?.user_type === 'hr') && (
                            <button
                                onClick={() => {
                                    setIsEditMode(false);
                                    setNewHoliday({ name: '', date: '', type: 'Public' });
                                    setIsAddModalOpen(true);
                                }}
                                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)', right: 20 }}
                                className="fixed w-14 h-14 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center active:scale-90 active:rotate-12 transition-all z-40"
                            >
                                <Plus size={28} strokeWidth={3} />
                            </button>
                        )}
                    </div>
                )}


                {/* --- MY LEAVES TAB --- */}
                {activeTab === 'my_leaves' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 mt-2">
                        {/* Leave Summary Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white dark:bg-black p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-center">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Total</p>
                                <p className="text-lg font-medium text-slate-900 dark:text-github-dark-text mt-0.5">{leaves.length}</p>
                            </div>
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20 shadow-sm text-center">
                                <p className="text-[10px] font-semibold text-emerald-500/80 uppercase tracking-tight">Approved</p>
                                <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    {leaves.filter(l => l.status?.toLowerCase() === 'approved').length}
                                </p>
                            </div>
                            <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-2xl border border-amber-100/50 dark:border-amber-900/20 shadow-sm text-center">
                                <p className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-tight">Pending</p>
                                <p className="text-lg font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                                    {leaves.filter(l => l.status?.toLowerCase() === 'pending').length}
                                </p>
                            </div>
                        </div>

                        {/* List */}
                        <div className="space-y-2.5">
                            {leaves.length > 0 ? (
                                leaves.map(leave => (
                                    <div
                                        key={leave.lr_id}
                                        onClick={() => setSelectedLeaf(leave)}
                                        className="bg-white dark:bg-black p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex gap-4 items-center group"
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getStatusColor(leave.status).replace('text-', 'bg-').replace('-600', '-500/10').replace('-500', '-500/10')}`}>
                                            {leave.status?.toLowerCase() === 'approved' ? <CheckCircle size={20} className="text-emerald-500" /> :
                                             leave.status?.toLowerCase() === 'rejected' ? <XCircle size={20} className="text-red-500" /> :
                                             <Clock size={20} className="text-amber-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h3 className="text-[13px] font-semibold text-slate-900 dark:text-github-dark-text truncate leading-tight group-hover:text-indigo-600 transition-colors">{leave.leave_type}</h3>
                                                <span className={`text-[9px] font-medium uppercase px-2 py-0.5 rounded-full ${getStatusColor(leave.status)}`}>
                                                    {leave.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <CalendarDays size={12} className="text-slate-400" />
                                                <span className="text-[11px] font-medium text-slate-500">
                                                    {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-[#161b22] rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mx-auto mb-3">
                                        <CalendarDays size={24} />
                                    </div>
                                    <p className="text-xs font-semibold text-slate-500">No leave records yet</p>
                                </div>
                            )}
                        </div>

                        {/* Apply FAB */}
                        <button
                            onClick={() => setShowApplyModal(true)}
                            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)', right: 20 }}
                            className="fixed w-14 h-14 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center active:scale-90 active:rotate-12 transition-all z-40"
                        >
                            <Plus size={28} strokeWidth={3} />
                        </button>
                    </div>
                )}


                {/* --- REQUESTS TAB (Admin) --- */}
                {activeTab === 'requests' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 mt-2">
                        {/* Sub Tabs - Redesigned */}
                        <div className="bg-slate-200/50 dark:bg-github-dark-border/50 p-1 rounded-xl flex border border-slate-200 dark:border-github-dark-border">
                            <button
                                onClick={() => setRequestSubTab('pending')}
                                className={`flex-1 py-2 text-[11px] font-medium rounded-lg transition-all
                                ${requestSubTab === 'pending'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-slate-500 dark:text-github-dark-muted'}`}
                            >
                                <Clock size={14} className="inline mr-1" /> Pending
                            </button>
                            <button
                                onClick={() => setRequestSubTab('history')}
                                className={`flex-1 py-2 text-[11px] font-medium rounded-lg transition-all
                                ${requestSubTab === 'history'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-slate-500 dark:text-github-dark-muted'}`}
                            >
                                <History size={14} className="inline mr-1" /> History
                            </button>
                        </div>

                        {/* Filter - Redesigned */}
                        <div className="bg-white dark:bg-black rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                            <MobileSelect
                                value={requestStatusFilter}
                                options={['All', 'Approved', 'Rejected']}
                                onChange={(val) => setRequestStatusFilter(val)}
                                placeholder="All Status"
                            />
                        </div>

                        {/* Request List - Redesigned */}
                        <div className="space-y-2.5 pb-24">
                            {requests
                                .filter(req => {
                                    if (requestSubTab === 'pending') return req.status === 'pending';
                                    return req.status !== 'pending';
                                })
                                .filter(req => {
                                    if (requestStatusFilter === 'All') return true;
                                    return req.status.toLowerCase() === requestStatusFilter.toLowerCase();
                                })
                                .map(req => (
                                    <div
                                        key={req.lr_id}
                                        onClick={() => setSelectedLeaf(req)}
                                        className="bg-white dark:bg-black p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex gap-4 items-center group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-black border-slate-100 dark:border-slate-800">
                                            {(req.user_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h3 className="text-[13px] font-semibold text-slate-900 dark:text-github-dark-text truncate group-hover:text-indigo-600 transition-colors">{req.user_name}</h3>
                                                <span className={`text-[9px] font-medium uppercase px-2 py-0.5 rounded-full ${getStatusColor(req.status)}`}>
                                                    {req.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <p className="text-[11px] font-semibold text-slate-500">{req.leave_type}</p>
                                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                                                    <CalendarDays size={12} />
                                                    {new Date(req.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                            {requests.length === 0 && (
                                <div className="text-center py-12">
                                    <Shield size={32} className="mx-auto text-slate-200 mb-3" />
                                    <p className="text-xs font-medium text-slate-400">No requests found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* --- BOTTOM SHEETS --- */}

            {/* Holiday Action Sheet (Edit/Delete Menu) */}
            {holidayActionSheet && createPortal(
                <div className="fixed inset-0 z-[600] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setHolidayActionSheet(null)}></div>
                    <div className="relative z-10 w-full bg-white dark:bg-black rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom duration-300 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex justify-center mb-6">
                            <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                        </div>
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-github-dark-text">{holidayActionSheet.holiday_name}</h3>
                            <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
                                {new Date(holidayActionSheet.holiday_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setIsEditMode(true);
                                    setNewHoliday({
                                        name: holidayActionSheet.holiday_name,
                                        date: holidayActionSheet.holiday_date,
                                        type: holidayActionSheet.holiday_type || 'Public'
                                    });
                                    setIsAddModalOpen(true);
                                    setHolidayActionSheet(null);
                                }}
                                className="w-full py-4 bg-slate-50 dark:bg-github-dark-border rounded-2xl flex items-center justify-center gap-3 text-slate-700 dark:text-github-dark-text font-medium active:scale-[0.98] transition-all"
                            >
                                <Edit3 size={18} className="text-indigo-500" /> Edit Holiday
                            </button>
                             <button
                                onClick={() => {
                                    setConfirmModal({
                                        isOpen: true,
                                        title: 'Delete Holiday?',
                                        message: `Are you sure you want to remove "${holidayActionSheet.holiday_name}" from the schedule? This action cannot be undone.`,
                                        type: 'delete',
                                        confirmText: 'Delete',
                                        onConfirm: async () => {
                                            try {
                                                await holidayService.deleteHolidays([holidayActionSheet.holiday_id]);
                                                toast.success("Holiday deleted");
                                                setHolidayActionSheet(null);
                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                loadData();
                                            } catch (err) {
                                                toast.error("Failed to delete");
                                            }
                                        }
                                    });
                                }}
                                className="w-full py-4 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center justify-center gap-3 text-red-600 dark:text-red-400 font-medium active:scale-[0.98] transition-all"
                            >
                                <Trash2 size={18} /> Delete Holiday
                            </button>
                            <button
                                onClick={() => setHolidayActionSheet(null)}
                                className="w-full py-4 text-slate-400 font-medium text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Add/Edit Holiday Bottom Sheet */}
            {isAddModalOpen && createPortal(
                <div className="fixed inset-0 z-[600] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative z-10 w-full bg-white dark:bg-black rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom duration-300 min-h-[80vh] max-h-[95vh] overflow-y-auto pb-[15vh] border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-center mb-6">
                            <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                        </div>
                        <h3 className="text-xl font-semibold text-center mb-8 text-slate-900 dark:text-github-dark-text">
                            {isEditMode ? 'Edit Holiday' : 'Create New Holiday'}
                        </h3>

                        <form
                            onSubmit={handleAddHoliday}
                            className="space-y-6"
                        >
                            <div className="bg-slate-50 dark:bg-black rounded-2xl p-4 border border-slate-100 dark:border-slate-800 focus-within:border-indigo-500 transition-all">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Holiday Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newHoliday.name}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                    className="w-full text-base font-semibold bg-transparent outline-none dark:text-white"
                                    placeholder="e.g. Independence Day"
                                />
                            </div>

                            <MobileDatePicker
                                label="Holiday Date"
                                value={newHoliday.date}
                                onChange={(date) => setNewHoliday({ ...newHoliday, date: date })}
                            />

                            <MobileSelect
                                label="Category"
                                value={newHoliday.type}
                                options={['Public', 'Optional', 'Observance']}
                                onChange={(val) => setNewHoliday({ ...newHoliday, type: val })}
                            />

                            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 dark:shadow-none mt-6 active:scale-95 transition-all">
                                {isEditMode ? 'Update Holiday' : 'Save Holiday'}
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Apply Leave Bottom Sheet */}
            {showApplyModal && createPortal(
                <div className="fixed inset-0 z-[600] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowApplyModal(false)}></div>
                    <div className="relative z-10 w-full bg-white dark:bg-black rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom duration-300 min-h-[85vh] max-h-[95vh] overflow-y-auto pb-[15vh] border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-center mb-6">
                            <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                        </div>
                        <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-8 tracking-tight">Request Leave</h3>

                        <form onSubmit={handleApplyLeave} className="space-y-6">
                            <MobileSelect
                                label="Leave Type"
                                value={applyForm.leave_type}
                                options={['Casual Leave', 'Sick Leave', 'Privilege Leave']}
                                onChange={(val) => setApplyForm({ ...applyForm, leave_type: val })}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <MobileDatePicker
                                    label="Start Date"
                                    value={applyForm.start_date}
                                    onChange={(date) => setApplyForm({ ...applyForm, start_date: date })}
                                />
                                <MobileDatePicker
                                    label="End Date"
                                    value={applyForm.end_date}
                                    onChange={(date) => setApplyForm({ ...applyForm, end_date: date })}
                                />
                            </div>

                            <div className="bg-slate-50 dark:bg-black rounded-2xl p-4 border border-slate-100 dark:border-slate-800 focus-within:border-indigo-500 transition-all">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Reason for Leave</label>
                                <textarea
                                    className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-white outline-none resize-none h-24"
                                    placeholder="Tell us why you need this leave..."
                                    value={applyForm.reason}
                                    onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                                    required
                                ></textarea>
                            </div>

                            <div className="bg-slate-50 dark:bg-black rounded-2xl p-4 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between cursor-pointer active:bg-slate-100 dark:active:bg-slate-900 transition-all relative">
                                <div className="flex items-center gap-3 text-slate-500">
                                    <Paperclip size={18} />
                                    <span className="text-sm font-medium">
                                        Attach Documents
                                    </span>
                                </div>
                                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                                    <Plus size={16} strokeWidth={2.5} />
                                </div>
                                <input
                                    type="file"
                                    multiple
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => setApplyForm({ 
                                        ...applyForm, 
                                        attachments: [...applyForm.attachments, ...Array.from(e.target.files)] 
                                    })}
                                />
                            </div>

                            {applyForm.attachments.length > 0 && (
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {applyForm.attachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500">
                                                    <FileText size={14} />
                                                </div>
                                                <span className="text-xs font-semibold text-slate-700 dark:text-white truncate max-w-[200px]">{file.name}</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const newFiles = [...applyForm.attachments];
                                                    newFiles.splice(idx, 1);
                                                    setApplyForm({ ...applyForm, attachments: newFiles });
                                                }}
                                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold shadow-xl shadow-indigo-200 dark:shadow-none mt-4 active:scale-95 transition-all">
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Detailed Leave View Bottom Sheet */}
            {selectedLeaf && createPortal(
                <div className="fixed inset-0 z-[600] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLeaf(null)}></div>
                    <div className="relative z-10 w-full bg-white dark:bg-black rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-center mb-6">
                            <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                        </div>
                        
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">{selectedLeaf.leave_type}</h3>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    ID: #{selectedLeaf.lr_id}
                                </p>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest ${getStatusColor(selectedLeaf.status)} shadow-sm border border-black/5`}>
                                {selectedLeaf.status}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-black rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">From</label>
                                    <p className="text-base font-semibold text-slate-800 dark:text-white">{new Date(selectedLeaf.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-black rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">To</label>
                                    <p className="text-base font-semibold text-slate-800 dark:text-white">{new Date(selectedLeaf.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                            </div>

                            <div className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-between overflow-hidden relative">
                                <div className="absolute right-[-10%] top-[-20%] opacity-10">
                                    <CalendarDays size={120} />
                                </div>
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                        <CalendarDays size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80 leading-none">Total Duration</p>
                                        <p className="text-2xl font-semibold mt-1">
                                            {Math.ceil((new Date(selectedLeaf.end_date) - new Date(selectedLeaf.start_date)) / (1000 * 60 * 60 * 24)) + 1} Days
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-black rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-3">Reason for Leave</label>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic bg-white/50 dark:bg-white/5 p-4 rounded-2xl">
                                    "{selectedLeaf.reason || 'No reason provided.'}"
                                </p>
                            </div>

                            {selectedLeaf.attachments?.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-3 ml-1">Supporting Documents</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedLeaf.attachments.map((file, i) => (
                                            <div
                                                key={i}
                                                onClick={() => setViewingAttachment(file)}
                                                className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-white dark:bg-black border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-[0.98]"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                                                    <Paperclip size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-700 dark:text-white truncate">{file.file_key?.split('/').pop() || 'Attachment'}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Tap to view document</p>
                                                </div>
                                                <ExternalLink size={16} className="text-slate-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admin Action Area */}
                            {activeTab === 'requests' && selectedLeaf.status === 'pending' && (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-8 mt-4 space-y-6">
                                    <div className="bg-slate-50 dark:bg-black rounded-3xl p-5 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-2">Admin Remarks</label>
                                        <textarea
                                            placeholder="Enter approval/rejection remarks..."
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-white outline-none resize-none h-24"
                                        ></textarea>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => handleAdminAction('Rejected')}
                                            className="py-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold rounded-2xl active:scale-95 transition-all shadow-sm"
                                        >
                                            Reject
                                        </button>
                                        <button 
                                            onClick={() => handleAdminAction('Approved')}
                                            className="py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none active:scale-95 transition-all"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setSelectedLeaf(null)}
                                className="w-full py-4 text-slate-400 font-semibold text-sm mt-4 hover:text-slate-600 transition-colors"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Holiday Details Bottom Sheet */}
            {selectedHoliday && createPortal(
                <div className="fixed inset-0 z-[600] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedHoliday(null)}></div>
                    <div className="relative z-10 w-full bg-white dark:bg-black rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom duration-300 pb-[env(safe-area-inset-bottom)] border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-center mb-6">
                            <span className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                        </div>
                        
                        <div className="text-center mb-10">
                            <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2rem] flex flex-col items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 dark:shadow-none">
                                <span className="text-[12px] font-bold uppercase tracking-widest leading-none opacity-80">{new Date(selectedHoliday.holiday_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                <span className="text-4xl font-semibold leading-none mt-2">{new Date(selectedHoliday.holiday_date).getDate()}</span>
                            </div>
                            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight px-4">{selectedHoliday.holiday_name}</h3>
                            <p className="text-sm font-semibold text-slate-400 mt-2">
                                {new Date(selectedHoliday.holiday_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' })}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 dark:bg-black rounded-3xl p-5 border border-slate-100 dark:border-slate-800 text-center">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedHoliday.holiday_type || 'Public Holiday'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black rounded-3xl p-5 border border-slate-100 dark:border-slate-800 text-center">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">Applicable</label>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">All Locations</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedHoliday(null)}
                            className="w-full py-4 bg-slate-900 dark:bg-white dark:text-black text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all mb-4"
                        >
                            Got it
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* Attachment Viewing Modal - Keep as centered for better focus */}
            {viewingAttachment && (
                <AttachmentModal
                    file={viewingAttachment}
                    onClose={() => setViewingAttachment(null)}
                />
            )}

            <MobileConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
            />

        </MobileDashboardLayout>
    );
};


export default HolidayManagement;

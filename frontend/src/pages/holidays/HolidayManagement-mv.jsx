import React, { useState, useEffect, useRef } from 'react';
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
    Umbrella
} from 'lucide-react';

const AttachmentModal = ({ file, onClose }) => {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_key || file.name);
    const isPdf = file.file_type === 'application/pdf' || /\.pdf$/i.test(file.file_key || file.name);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                            {isImage ? <FileText size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm truncate max-w-[200px]">
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
                        <iframe src={file.file_url} className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white" title="PDF Viewer"></iframe>
                    ) : (
                        <div className="text-center">
                            <p className="text-slate-500 dark:text-slate-400 mb-4">This file type cannot be previewed.</p>
                            <a href={file.file_url} download className="text-indigo-600 hover:underline font-bold">Download to view</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const HolidayManagement = () => {
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
    const [applyForm, setApplyForm] = useState({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: '',
        attachments: []
    });

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

    // --- HELPERS ---
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved': return 'bg-emerald-100 text-emerald-600';
            case 'rejected': return 'bg-red-100 text-red-500';
            default: return 'bg-amber-100 text-amber-600';
        }
    };

    // --- RENDER CONTENT ---

    return (
        <MobileDashboardLayout title="Holidays & Leave">

            {/* TABS - Standardized Full Width */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1 flex shadow-sm mb-4">
                <button
                    onClick={() => setActiveTab('holidays')}
                    className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                        ${activeTab === 'holidays'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                >
                    <Umbrella size={16} /> Holidays
                </button>
                <button
                    onClick={() => setActiveTab('my_leaves')}
                    className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                        ${activeTab === 'my_leaves'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                >
                    <Calendar size={16} /> My Leaves
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                        ${activeTab === 'requests'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                >
                    <Shield size={16} /> Requests
                </button>
            </div>

            <div className="px-4 pb-20 min-h-screen bg-slate-50 dark:bg-slate-900">

                {/* --- HOLIDAYS TAB --- */}
                {activeTab === 'holidays' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                        {/* Bulk Import Link (Top Right) */}
                        <div className="flex justify-end">
                            <button className="flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                <Upload size={14} /> Bulk Import
                            </button>
                        </div>

                        {/* List */}
                        <div className="space-y-3">
                            {holidays.length > 0 ? (
                                holidays.map((holiday, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedHoliday(holiday)}
                                        className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        {/* Date Badge */}
                                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                            <span className="text-xl font-bold leading-none">{new Date(holiday.holiday_date).getDate()}</span>
                                            <span className="text-[10px] font-bold uppercase mt-1">{new Date(holiday.holiday_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{holiday.holiday_name}</h4>
                                            <p className="text-xs text-slate-400 mt-0.5">{new Date(holiday.holiday_date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                                        </div>
                                        <button className="text-slate-400">
                                            <MoreVertical size={18} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400 text-xs">No holidays found</div>
                            )}
                        </div>

                        {/* FAB */}
                        {user?.user_type === 'admin' && (
                            <button className="fixed bottom-24 right-4 w-14 h-14 bg-indigo-600 rounded-full text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10">
                                <Plus size={24} />
                            </button>
                        )}
                    </div>
                )}


                {/* --- MY LEAVES TAB --- */}
                {activeTab === 'my_leaves' && (
                    <div className="space-y-4 animate-in fade-in">
                        {leaves.length > 0 ? (
                            leaves.map(leave => (
                                <div
                                    key={leave.lr_id}
                                    onClick={() => setSelectedLeaf(leave)}
                                    className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${getStatusColor(leave.status)}`}>
                                            {leave.status}
                                        </div>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{leave.leave_type}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">{leave.reason}</p>

                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                                        <Calendar size={14} />
                                        <span>
                                            {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            {' - '}
                                            {new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-slate-400 text-xs">No leave history</div>
                        )}

                        {/* Apply FAB */}
                        <button
                            onClick={() => setShowApplyModal(true)}
                            className="fixed bottom-24 right-4 w-14 h-14 bg-indigo-600 rounded-full text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                )}


                {/* --- REQUESTS TAB (Admin) --- */}
                {activeTab === 'requests' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        {/* Sub Tabs */}
                        <div className="bg-white dark:bg-slate-800 p-1 rounded-lg flex mb-2 border border-slate-100 dark:border-slate-700">
                            <button
                                onClick={() => setRequestSubTab('pending')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all
                                ${requestSubTab === 'pending'
                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                                        : 'text-slate-400'}`}
                            >
                                Pending
                            </button>
                            <button
                                onClick={() => setRequestSubTab('history')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all
                                ${requestSubTab === 'history'
                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                                        : 'text-slate-400'}`}
                            >
                                History
                            </button>
                        </div>

                        {/* Filter */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-slate-500 font-medium">Filter Status:</span>
                            <select
                                value={requestStatusFilter}
                                onChange={(e) => setRequestStatusFilter(e.target.value)}
                                className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
                            >
                                <option value="All">All</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                            <ChevronDown size={14} className="text-slate-400" />
                        </div>

                        {/* Request List */}
                        <div className="space-y-3 pb-20">
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
                                        className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getStatusColor(req.status)}`}>
                                                {req.status}
                                            </div>
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{req.leave_type}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5 mb-2">{req.user_name}</p>

                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <Calendar size={12} />
                                            <span>
                                                {new Date(req.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                {' - '}
                                                {new Date(req.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

            </div>

            {/* --- MODALS --- */}

            {/* Apply Modal - Bottom Sheet */}
            {showApplyModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-center mb-6">
                            <span className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                        </div>
                        <h3 className="text-lg font-bold text-center mb-6 text-slate-900 dark:text-white">Apply for Leave</h3>

                        <form onSubmit={handleApplyLeave} className="space-y-4">
                            {/* Type */}
                            <div className="relative border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Leave Type</label>
                                <select
                                    className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-white outline-none py-1 appearance-none"
                                    value={applyForm.leave_type}
                                    onChange={(e) => setApplyForm({ ...applyForm, leave_type: e.target.value })}
                                >
                                    <option>Casual Leave</option>
                                    <option>Sick Leave</option>
                                    <option>Privilege Leave</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full text-xs font-bold bg-transparent outline-none dark:text-white"
                                        value={applyForm.start_date}
                                        onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full text-xs font-bold bg-transparent outline-none dark:text-white"
                                        value={applyForm.end_date}
                                        onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reason</label>
                                <textarea
                                    className="w-full bg-transparent text-sm text-slate-800 dark:text-white outline-none resize-none h-20"
                                    placeholder="Enter reason..."
                                    value={applyForm.reason}
                                    onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                                ></textarea>
                            </div>

                            {/* Attachments */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 flex items-center justify-between cursor-pointer active:bg-slate-50 relative">
                                <span className="text-sm text-slate-500">Attach Documents (Optional)</span>
                                <div className="w-6 h-6 rounded-full border border-indigo-600 flex items-center justify-center text-indigo-600">
                                    <Plus size={14} />
                                </div>
                                <input
                                    type="file"
                                    multiple
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => setApplyForm({ ...applyForm, attachments: Array.from(e.target.files) })}
                                />
                            </div>
                            {applyForm.attachments.length > 0 && (
                                <div className="text-xs text-slate-500">
                                    {applyForm.attachments.length} files selected
                                </div>
                            )}

                            {/* Submit */}
                            <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none mt-4">
                                Submit Request
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowApplyModal(false)}
                                className="w-full py-3 text-slate-400 font-bold text-sm"
                            >
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {selectedLeaf && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-0 overflow-hidden shadow-2xl relative">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Leave Request #{selectedLeaf.lr_id}</h3>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(selectedLeaf.status)}`}>
                                    {selectedLeaf.status}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">By {selectedLeaf.user_name || 'User'}</p>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5">
                            {/* Type */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
                                <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">{selectedLeaf.leave_type}</p>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">{new Date(selectedLeaf.start_date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">{new Date(selectedLeaf.end_date).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {/* Duration */}
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-xl">
                                <label className="text-[10px] font-bold text-indigo-400 uppercase">Duration</label>
                                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                                    {Math.ceil((new Date(selectedLeaf.end_date) - new Date(selectedLeaf.start_date)) / (1000 * 60 * 60 * 24)) + 1} Days
                                </p>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Justification & Remarks</label>
                                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 italic p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                    "{selectedLeaf.reason}"
                                </div>
                            </div>

                            {/* Attachments */}
                            {selectedLeaf.attachments?.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Attachments</label>
                                    <div className="space-y-2">
                                        {selectedLeaf.attachments.map((file, i) => (
                                            <div
                                                key={i}
                                                onClick={() => setViewingAttachment(file)}
                                                className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <Paperclip size={14} className="text-indigo-500" />
                                                <span className="truncate flex-1 font-medium">{file.file_key?.split('/').pop() || 'Attachment'}</span>
                                                <ExternalLink size={14} className="text-slate-400" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Close */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setSelectedLeaf(null)}
                                className="w-full py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Holiday Details Modal */}
            {selectedHoliday && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in fade-in">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedHoliday.holiday_name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {new Date(selectedHoliday.holiday_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedHoliday(null)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body Details */}
                        <div className="space-y-6">
                            {/* Date */}
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Date</p>
                                    <p className="text-base font-bold text-slate-900 dark:text-white">
                                        {new Date(selectedHoliday.holiday_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>

                            {/* Type */}
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300">
                                    <Umbrella size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Type</p>
                                    <p className="text-base font-bold text-slate-900 dark:text-white">
                                        {selectedHoliday.holiday_type || 'Public Holiday'}
                                    </p>
                                </div>
                            </div>

                            {/* Day */}
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Day</p>
                                    <p className="text-base font-bold text-slate-900 dark:text-white">
                                        {new Date(selectedHoliday.holiday_date).toLocaleDateString('en-US', { weekday: 'long' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedHoliday(null)}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none mt-8 transition-all active:scale-[0.98]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Attachment Viewing Modal */}
            {viewingAttachment && (
                <AttachmentModal
                    file={viewingAttachment}
                    onClose={() => setViewingAttachment(null)}
                />
            )}

        </MobileDashboardLayout>
    );
};

export default HolidayManagement;

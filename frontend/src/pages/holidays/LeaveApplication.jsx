
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    FileText,
    ChevronDown,
    Loader2,
    Search,
    Filter,
    MessageSquare,
    Activity,
    MapPin,
    Plus,
    X,
    Trash2
} from 'lucide-react';

const LeaveApplication = () => {
    const { user } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeave, setSelectedLeave] = useState(null); // For Detail View
    const [adminAction, setAdminAction] = useState({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 });

    // Admin Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Form State (User)
    const [formData, setFormData] = useState({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: ''
    });

    const [showForm, setShowForm] = useState(false);

    const isAdmin = user?.user_type === 'admin' || user?.user_type === 'hr';

    useEffect(() => {
        if (user) {
            fetchLeaves();
        }
    }, [user]);

    const fetchLeaves = async () => {
        setLoading(true);
        try {
            // Admin: Fetch ALL history to allow filtering
            const endpoint = isAdmin ? '/leaves/admin/history' : '/leaves/my-history';
            const res = await api.get(endpoint);
            if (res.data.ok) {
                // Admin endpoint returns 'history', User endpoint returns 'leaves'
                // Pending endpoint (old) returned 'requests'
                const fetched = isAdmin
                    ? (res.data.history || res.data.requests || [])
                    : (res.data.leaves || []);

                setLeaves(fetched);
                // Select first item by default for admin
                if (isAdmin && fetched.length > 0) setSelectedLeave(fetched[0]);
            }
        } catch (error) {
            console.error("Fetch leaves error", error);
            toast.error("Failed to load leave records");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/leaves/request', formData);
            if (res.data.ok) {
                toast.success("Leave request submitted successfully");
                setFormData({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '' });
                setShowForm(false);
                fetchLeaves();
            }
        } catch (error) {
            console.error("Apply error", error);
            toast.error(error.response?.data?.message || "Failed to submit request");
        }
    };

    const handleWithdraw = async (leaveId) => {
        if (!window.confirm("Are you sure you want to withdraw this request?")) return;
        try {
            const res = await api.delete(`/leaves/request/${leaveId}`);
            if (res.data.ok) {
                toast.success("Request withdrawn successfully");
                fetchLeaves();
            }
        } catch (error) {
            console.error("Withdraw error", error);
            toast.error(error.response?.data?.message || "Failed to withdraw request");
        }
    };

    const handleAdminAction = async () => {
        if (!selectedLeave) return;
        try {
            const payload = {
                status: adminAction.status.charAt(0).toUpperCase() + adminAction.status.slice(1), // Capitalize for backend
                admin_comment: adminAction.remarks,
                pay_type: adminAction.payType,
                pay_percentage: adminAction.payPercentage
            };

            const res = await api.put(`/leaves/admin/status/${selectedLeave.lr_id}`, payload);
            if (res.data.ok) {
                toast.success(`Leave request ${adminAction.status.toLowerCase()}`);
                // Update local state
                const updatedLeaves = leaves.map(l =>
                    l.lr_id === selectedLeave.lr_id
                        ? { ...l, status: adminAction.status.toLowerCase(), admin_comment: adminAction.remarks }
                        : l
                );
                setLeaves(updatedLeaves);
                setSelectedLeave({ ...selectedLeave, status: adminAction.status.toLowerCase(), admin_comment: adminAction.remarks });
                setAdminAction({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 });
            }
        } catch (error) {
            console.error("Action error", error);
            toast.error(error.response?.data?.message || "Failed to update status");
        }
    };

    // Helper to calculate days
    const calculateDays = (start, end) => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e - s);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
            case 'rejected': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
            default: return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
        }
    };

    if (loading && !leaves.length) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    // --- ADMIN VIEW (New Split Layout) ---
    if (isAdmin && !showForm) {
        const filteredLeaves = leaves.filter(leaf => {
            const matchesSearch = leaf.user_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || leaf.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        return (
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-14rem)] min-h-[600px]">

                {/* LEFT PANEL: LIST */}
                <div className="w-full lg:w-1/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    {/* Header & Search */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Leave Requests</h3>
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-xs font-bold"
                            >
                                <Plus size={14} />
                                Apply
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-2 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            >
                                <option value="all">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredLeaves.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">No requests found.</div>
                        ) : (
                            filteredLeaves.map((request) => (
                                <div
                                    key={request.lr_id}
                                    onClick={() => setSelectedLeave(request)}
                                    className={`p-4 cursor-pointer transition-colors ${selectedLeave?.lr_id === request.lr_id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">
                                                {(request.user_name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-semibold ${selectedLeave?.lr_id === request.lr_id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>{request.user_name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{request.email}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800`}>
                                            {request.leave_type}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-3">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(request.start_date).toLocaleDateString()}
                                        </div>
                                        <div className={`flex items-center gap-1 font-medium capitalize ${request.status === 'approved' ? 'text-emerald-600' :
                                            request.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                                            }`}>
                                            {request.status}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: DETAILS */}
                <div className="w-full lg:w-2/3 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                    {selectedLeave ? (
                        <>
                            {/* Detail Header */}
                            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/10">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Leave Request #{selectedLeave.lr_id}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        By {selectedLeave.user_name}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${selectedLeave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                        selectedLeave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        <span className={`w-2 h-2 rounded-full ${selectedLeave.status === 'approved' ? 'bg-emerald-500' :
                                            selectedLeave.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
                                            }`}></span>
                                        {selectedLeave.status}
                                    </div>
                                    <div className='text-xs text-slate-400 mt-2'>Applied: {new Date(selectedLeave.applied_at || Date.now()).toLocaleDateString()}</div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {/* Grid Layout for details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    <div>
                                        <h4 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-3">Leave Details</h4>
                                        <div className="space-y-4">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <span className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Type</span>
                                                <span className="font-semibold text-slate-800 dark:text-white">{selectedLeave.leave_type}</span>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 block mb-1">From</span>
                                                    <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                                                        {new Date(selectedLeave.start_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 block mb-1">To</span>
                                                    <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                                                        {new Date(selectedLeave.end_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                                <span className="text-sm text-indigo-600 dark:text-indigo-400 block mb-1">Duration</span>
                                                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                                    {calculateDays(selectedLeave.start_date, selectedLeave.end_date)} Days
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-3">Justification & Remarks</h4>
                                        <div className="space-y-4 h-full">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <div className="flex items-start gap-3">
                                                    <MessageSquare size={18} className="text-slate-400 mt-1" />
                                                    <div>
                                                        <span className="text-xs text-slate-400 mb-1 block">Reason</span>
                                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{selectedLeave.reason}"</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action / Remarks Section */}
                                            {selectedLeave.status === 'pending' ? (
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Admin Action</h5>

                                                    {/* Approval Options */}
                                                    {adminAction.status === 'approved' && (
                                                        <div className="grid grid-cols-2 gap-3 mb-3 animate-in fade-in slide-in-from-top-1">
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Pay Type</label>
                                                                <select
                                                                    value={adminAction.payType}
                                                                    onChange={(e) => setAdminAction({ ...adminAction, payType: e.target.value })}
                                                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm"
                                                                >
                                                                    <option value="Paid">Paid</option>
                                                                    <option value="Unpaid">Unpaid</option>
                                                                    <option value="Partial">Partial</option>
                                                                </select>
                                                            </div>
                                                            {adminAction.payType === 'Partial' && (
                                                                <div>
                                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Pay %</label>
                                                                    <input
                                                                        type="number"
                                                                        value={adminAction.payPercentage}
                                                                        onChange={(e) => setAdminAction({ ...adminAction, payPercentage: e.target.value })}
                                                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <textarea
                                                        value={adminAction.remarks}
                                                        onChange={(e) => setAdminAction({ ...adminAction, remarks: e.target.value })}
                                                        placeholder="Add remarks (required for rejection)..."
                                                        className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[80px] mb-3"
                                                    ></textarea>

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                if (adminAction.status === 'approved') {
                                                                    handleAdminAction();
                                                                } else {
                                                                    setAdminAction({ ...adminAction, status: 'approved' });
                                                                }
                                                            }}
                                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${adminAction.status === 'approved'
                                                                ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
                                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <CheckCircle size={16} /> {adminAction.status === 'approved' ? 'Confirm Approve' : 'Approve'}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (adminAction.status === 'rejected') {
                                                                    handleAdminAction();
                                                                } else {
                                                                    setAdminAction({ ...adminAction, status: 'rejected' });
                                                                }
                                                            }}
                                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${adminAction.status === 'rejected'
                                                                ? 'bg-red-600 text-white shadow-md hover:bg-red-700'
                                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <XCircle size={16} /> {adminAction.status === 'rejected' ? 'Confirm Reject' : 'Reject'}
                                                        </button>
                                                        {adminAction.status && (
                                                            <button
                                                                onClick={() => setAdminAction({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 })}
                                                                className="px-3 py-2 text-slate-400 hover:text-slate-600"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 block mb-1">
                                                        Admin Remarks
                                                    </span>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                                        {selectedLeave.admin_comment || "No remarks provided."}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <FileText size={48} className="mb-4 opacity-50" />
                            <p>Select a request to view details</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- USER VIEW ---
    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My Leave Applications</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Manage and track your leave requests</p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus size={18} />
                        Apply Leave
                    </button>
                )}
            </div>

            {showForm ? (
                <div className="max-w-xl mx-auto bg-white dark:bg-dark-card rounded-xl shadow-md border border-slate-200 dark:border-slate-700 p-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowForm(false)}
                                className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">New Leave Request</h3>
                        </div>
                    </div>

                    <form onSubmit={handleApply} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Leave Type</label>
                            <div className="relative">
                                <select
                                    value={formData.leave_type}
                                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                >
                                    <option>Casual Leave</option>
                                    <option>Sick Leave</option>
                                    <option>Privilege Leave</option>
                                    <option>Unpaid Leave</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Start Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">End Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                />
                            </div>
                        </div>

                        {formData.start_date && formData.end_date && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-lg text-sm text-indigo-700 dark:text-indigo-300 font-medium flex items-center justify-center gap-2">
                                <Clock size={16} />
                                Total Duration: {calculateDays(formData.start_date, formData.end_date)} Days
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reason</label>
                            <textarea
                                required
                                rows="4"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 resize-none"
                                placeholder="Please provide a detailed reason for your leave request..."
                            ></textarea>
                        </div>

                        <div className="pt-2 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
                            >
                                Submit Application
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {leaves.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Leave History</h3>
                            <p className="max-w-sm mx-auto mb-6">You haven't applied for any leaves yet. Click the "Apply Leave" button to submit a request.</p>
                            <button
                                onClick={() => setShowForm(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                            >
                                <Plus size={18} />
                                Apply First Leave
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Duration</th>
                                        <th className="px-6 py-4">Reason</th>
                                        <th className="px-6 py-4">Applied On</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {leaves.map((leave) => (
                                        <tr key={leave.lr_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-800 dark:text-white">{leave.leave_type}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                <div className="flex flex-col">
                                                    <span>{calculateDays(leave.start_date, leave.end_date)} Days</span>
                                                    <span className="text-xs opacity-70">
                                                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                <div className="max-w-xs truncate" title={leave.reason}>{leave.reason}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(leave.applied_at || Date.now()).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                                                    leave.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${leave.status === 'approved' ? 'bg-emerald-500' :
                                                        leave.status === 'rejected' ? 'bg-red-500' :
                                                            'bg-amber-500'
                                                        }`}></span>
                                                    {leave.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {leave.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleWithdraw(leave.lr_id)}
                                                        className="text-slate-400 hover:text-red-600 transition-colors"
                                                        title="Withdraw Request"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LeaveApplication;

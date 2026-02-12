
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import DatePicker from '../../components/DatePicker';
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
    Trash2,
    Paperclip,
    ExternalLink,
    Download,
    Image as ImageIcon
} from 'lucide-react';

const AttachmentModal = ({ file, onClose }) => {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_key || file.name);
    const isPdf = file.file_type === 'application/pdf' || /\.pdf$/i.test(file.file_key || file.name);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                            {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                                {(file.file_key || file.name)?.split('/').pop() || 'Attachment'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {file.file_type || 'Unknown Type'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={file.file_url} download target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Download">
                            <Download size={20} />
                        </a>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 p-4 flex items-center justify-center overflow-hidden relative">
                    {isImage ? (
                        <img src={file.file_url} alt="Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                    ) : isPdf ? (
                        <iframe src={file.file_url} className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white" title="PDF Viewer"></iframe>
                    ) : (
                        <div className="text-center">
                            <p className="text-slate-500 dark:text-slate-400 mb-4">This file type cannot be previewed.</p>
                            <a href={file.file_url} download className="text-indigo-600 hover:underline">Download to view</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LeaveApplication = () => {
    const { user } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeave, setSelectedLeave] = useState(null); // For Detail View
    const [viewingAttachment, setViewingAttachment] = useState(null);
    const [adminAction, setAdminAction] = useState({ status: '', remarks: '', payType: 'Paid', payPercentage: 100 });

    // Admin Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Form State (User)
    const [formData, setFormData] = useState({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: '',
        attachments: []
    });

    const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);

    // Reset extended view when changing selected leave
    useEffect(() => {
        setAttachmentsExpanded(false);
    }, [selectedLeave]);

    const [showForm, setShowForm] = useState(false);
    const [isCustomType, setIsCustomType] = useState(false);

    // --- FILTER & SUMMARY LOGIC (Moved to top level) ---
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Filter leaves based on selected month
    const filteredLeaves = React.useMemo(() => {
        const monthStr = String(selectedMonth + 1).padStart(2, '0');
        const filterDateStr = `${selectedYear}-${monthStr}`;

        return leaves.filter(leave => {
            if (!leave.start_date) return false;
            return leave.start_date.startsWith(filterDateStr);
        });
    }, [leaves, selectedMonth, selectedYear]);

    // Calculate total approved days
    const totalApprovedDays = React.useMemo(() => {
        return filteredLeaves
            .filter(l => l.status === 'approved')
            .reduce((acc, curr) => {
                // Inline calculateDays since helper is defined below, or move helper up.
                // Better yet, just use the helper if it's defined in scope or move helper up.
                // Helper is defined inside component? Yes at line 138.
                // Since this is inside component, we can use it if defined before use?
                // Javascript function declarations are hoisted, but const arrow functions are NOT.
                // calculateDays is const arrow function at line 138.
                // So we need to move calculateDays UP as well or define it as function.
                if (!curr.start_date || !curr.end_date) return acc; // safety check

                // Re-implementing logic inline to be safe or I'll move calculateDays up.
                // Let's move calculateDays to module scope or top of component.
                const s = new Date(curr.start_date);
                const e = new Date(curr.end_date);
                const diffTime = Math.abs(e - s);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                return acc + (diffDays > 0 ? diffDays : 0);
            }, 0);
    }, [filteredLeaves]);

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
            // Create FormData to handle file upload
            const data = new FormData();
            data.append('leave_type', formData.leave_type);
            data.append('start_date', formData.start_date);
            data.append('end_date', formData.end_date);
            data.append('reason', formData.reason);
            if (formData.attachments && formData.attachments.length > 0) {
                formData.attachments.forEach(file => {
                    data.append('attachments', file);
                });
            }

            const res = await api.post('/leaves/request', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.ok) {
                toast.success("Leave request submitted successfully");
                setFormData({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '', attachments: [] });
                setShowForm(false);
                setIsCustomType(false);
                fetchLeaves();
            }
        } catch (error) {
            console.error("Apply error", error);
            toast.error(error.response?.data?.message || "Failed to submit request");
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFormData(prev => ({
                ...prev,
                attachments: [...(prev.attachments || []), ...newFiles]
            }));
            // Reset input value to allow selecting same file again if needed
            e.target.value = '';
        }
    };

    const removeFile = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleTextareaInput = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
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

    const handleAdminAction = async (status) => {
        if (!selectedLeave) return;
        const actionStatus = status || adminAction.status;
        try {
            const payload = {
                status: actionStatus.charAt(0).toUpperCase() + actionStatus.slice(1), // Capitalize for backend
                admin_comment: adminAction.remarks
            };

            const res = await api.put(`/leaves/admin/status/${selectedLeave.lr_id}`, payload);
            if (res.data.ok) {
                toast.success(`Leave request ${actionStatus.toLowerCase()}`);
                // Update local state
                const updatedLeaves = leaves.map(l =>
                    l.lr_id === selectedLeave.lr_id
                        ? { ...l, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks }
                        : l
                );
                setLeaves(updatedLeaves);
                setSelectedLeave({ ...selectedLeave, status: actionStatus.toLowerCase(), admin_comment: adminAction.remarks });
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

                                            {/* Attachments Section - Condensed with Inline Expansion */}
                                            {selectedLeave.attachments && selectedLeave.attachments.length > 0 && (
                                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                                                    <div
                                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                                                        onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Paperclip size={18} className="text-slate-400" />
                                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                {selectedLeave.attachments.length} Attachments
                                                            </span>
                                                        </div>
                                                        <div
                                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                                                        >
                                                            {attachmentsExpanded ? 'Hide' : 'View All'}
                                                            <ChevronDown size={14} className={`transform transition-transform ${attachmentsExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </div>

                                                    {/* Expanded Content */}
                                                    {attachmentsExpanded && (
                                                        <div className="px-4 pb-4 pt-0 space-y-2 border-t border-slate-100 dark:border-slate-700/50 mt-2">
                                                            {selectedLeave.attachments.map((file, index) => (
                                                                <div
                                                                    key={index}
                                                                    onClick={() => setViewingAttachment(file)}
                                                                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-sm transition-all group cursor-pointer"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                                        <FileText size={16} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                                            {file.file_key.split('/').pop()}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                                            {file.file_type ? file.file_type.split('/')[1]?.toUpperCase() : 'FILE'}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
                                                                        <ExternalLink size={14} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Action / Remarks Section */}
                                            {selectedLeave.status === 'pending' ? (
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Admin Action</h5>



                                                    <textarea
                                                        value={adminAction.remarks}
                                                        onChange={(e) => setAdminAction({ ...adminAction, remarks: e.target.value })}
                                                        placeholder="Add remarks (required for rejection)..."
                                                        className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[80px] mb-3"
                                                    ></textarea>

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleAdminAction('approved')}
                                                            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
                                                        >
                                                            <CheckCircle size={16} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleAdminAction('rejected')}
                                                            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-red-600 text-white shadow-md hover:bg-red-700"
                                                        >
                                                            <XCircle size={16} /> Reject
                                                        </button>
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
                {viewingAttachment && (
                    <AttachmentModal
                        file={viewingAttachment}
                        onClose={() => setViewingAttachment(null)}
                    />
                )}
            </div>
        );
    }



    // --- USER VIEW ---
    return (
        <div className="w-full space-y-8">
            <div className="flex flex-col gap-8 items-start">

                {/* --- TOP: APPLY FORM --- */}
                <div className="w-full">
                    <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <Plus className="text-indigo-600 dark:text-indigo-400" size={20} />
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Apply for Leave</h3>
                        </div>

                        <form onSubmit={handleApply} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">Leave Type</label>
                                <div className="relative">
                                    <select
                                        value={['Casual Leave', 'Sick Leave'].includes(formData.leave_type) ? formData.leave_type : 'Other'}
                                        onChange={(e) => {
                                            if (e.target.value === 'Other') {
                                                setIsCustomType(true);
                                                setFormData({ ...formData, leave_type: '' });
                                            } else {
                                                setIsCustomType(false);
                                                setFormData({ ...formData, leave_type: e.target.value });
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-slate-200 font-medium cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-900"
                                    >
                                        <option>Casual Leave</option>
                                        <option>Sick Leave</option>
                                        <option>Other</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                                {isCustomType && (
                                    <input
                                        type="text"
                                        placeholder="Enter custom leave type"
                                        value={formData.leave_type}
                                        onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                                        className="w-full px-3 py-2.5 mt-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-slate-200"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <DatePicker
                                        label="Start Date"
                                        value={formData.start_date}
                                        onChange={(date) => setFormData({ ...formData, start_date: date })}
                                        placeholder="Select date"
                                    />
                                </div>
                                <div>
                                    <DatePicker
                                        label="End Date"
                                        value={formData.end_date}
                                        onChange={(date) => setFormData({ ...formData, end_date: date })}
                                        placeholder="Select date"
                                    />
                                </div>
                            </div>

                            {formData.start_date && formData.end_date && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center gap-2">
                                    <Clock size={14} />
                                    Total Duration: {calculateDays(formData.start_date, formData.end_date)} Days
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">Reason</label>
                                <textarea
                                    required
                                    rows="1"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    onInput={handleTextareaInput}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-slate-200 resize-none placeholder-slate-400 overflow-hidden min-h-[42px]"
                                    placeholder="Why do you need leave?"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">Attachments (Optional)</label>
                                <div className="space-y-3">
                                    {/* Upload Area */}
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            id="leave-attachment"
                                            className="hidden"
                                            multiple
                                            accept=".jpg,.jpeg,.png,.pdf"
                                            onChange={handleFileChange}
                                        />
                                        <label
                                            htmlFor="leave-attachment"
                                            className="w-full flex flex-col items-center gap-2 px-4 py-6 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all group-hover:scale-[1.01]"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                <Paperclip size={18} />
                                            </div>
                                            <div className="text-center">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                    Click to upload documents
                                                </span>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    JPG, PNG, PDF (Max 5MB)
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Selected Files List */}
                                    {formData.attachments && formData.attachments.length > 0 && (
                                        <div className="grid grid-cols-1 gap-2">
                                            {formData.attachments.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                                            <FileText size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                                                {file.name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                                {(file.size / 1024).toFixed(1)} KB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            removeFile(index);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                        title="Remove file"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={18} />
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>

                {/* --- BOTTOM: HISTORY LIST --- */}
                <div className="w-full">
                    <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full min-h-[500px]">

                        {/* --- LIST HEADER WITH FILTERS --- */}
                        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/10">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Leave History</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                        {filteredLeaves.length} Records
                                    </div>
                                    <div className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-200 px-3 py-1.5 rounded-md border border-indigo-100 dark:border-indigo-500/30">
                                        Total Approved: {totalApprovedDays} Days
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Month Picker */}
                                <div className="relative">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                        className="pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm appearance-none cursor-pointer"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i} value={i}>
                                                {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>

                                {/* Year Picker */}
                                <div className="relative">
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        className="pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm appearance-none cursor-pointer"
                                    >
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        {filteredLeaves.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Leave Records</h3>
                                <p className="max-w-sm mx-auto text-sm">No leave requests found for {new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Current Status</th>
                                            <th className="px-6 py-4">Duration</th>
                                            <th className="px-6 py-4">Reason</th>
                                            <th className="px-6 py-4">Date Applied</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {filteredLeaves.map((leave) => (
                                            <tr key={leave.lr_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-sm text-slate-800 dark:text-white">{leave.leave_type}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                                        leave.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                                            'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${leave.status === 'approved' ? 'bg-emerald-500' :
                                                            leave.status === 'rejected' ? 'bg-red-500' :
                                                                'bg-amber-500'
                                                            }`}></span>
                                                        {leave.status}
                                                    </span>
                                                    {leave.admin_comment && (
                                                        <p className="text-[10px] text-slate-500 mt-1 max-w-[120px] truncate" title={leave.admin_comment}>
                                                            Note: {leave.admin_comment}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{calculateDays(leave.start_date, leave.end_date)} Days</span>
                                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                                            {new Date(leave.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(leave.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 max-w-[200px]">
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate" title={leave.reason}>
                                                        {leave.reason}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                                    {new Date(leave.applied_at || Date.now()).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {leave.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleWithdraw(leave.lr_id)}
                                                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100"
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
                </div>
            </div>
        </div>
    );
};

export default LeaveApplication;

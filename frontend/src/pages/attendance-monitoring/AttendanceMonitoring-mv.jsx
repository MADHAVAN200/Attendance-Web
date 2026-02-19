import React, { useState, useEffect } from 'react';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    Search,
    Filter,
    Clock,
    UserCheck,
    UserX,
    Activity,
    MapPin,
    Calendar,
    ChevronDown,
    FileText,
    CheckCircle,
    XCircle,
    AlertCircle,
    X,
    LogIn,
    LogOut
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { attendanceService } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const AttendanceMonitoring = () => {
    const { avatarTimestamp } = useAuth();

    // UI State
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'requests'

    // Data State
    const [attendanceData, setAttendanceData] = useState([]);
    const [stats, setStats] = useState({ present: 0, late: 0, absent: 0, active: 0 });
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('All Departments');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Popup State
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Hardcoded Departments as per requirement
    const DEPARTMENTS = ['All Departments', 'Engineering', 'Design', 'Sales'];

    // --- FETCH DASHBOARD DATA ---
    const fetchDashboardData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [usersRes, attendanceRes] = await Promise.all([
                adminService.getAllUsers(),
                attendanceService.getRealTimeAttendance(selectedDate)
            ]);

            const users = usersRes.users || [];
            const records = attendanceRes.data || [];

            const mergedData = users.map(user => {
                const userRecords = records.filter(r => r.user_id === user.user_id);
                // Sort records by time to get chronological sessions
                userRecords.sort((a, b) => new Date(a.time_in) - new Date(b.time_in));

                let status = 'Absent';
                let sessions = [];
                let shift = user.shift_name || 'General Shift';

                if (userRecords.length > 0) {
                    const latest = userRecords[userRecords.length - 1]; // Last record is latest

                    if (latest.shift_name) shift = latest.shift_name;

                    sessions = userRecords.map((r, index) => ({
                        id: index + 1,
                        in: new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), // 24h format as per image option? Or 12h? Image shows 11:36 / 03:36. Let's assume 12h for now or HH:mm. Image shows 11:36 (could be AM) and 03:36. Let's stick to 12h with spacing.
                        out: r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
                        location: r.time_in_address || 'Manual Reset', // Fallback as per image
                        reason: r.late_reason || r.manual_entry_reason || '',
                        isLate: r.late_minutes > 0
                    }));

                    if (userRecords.some(r => !r.time_out)) {
                        status = latest.late_minutes > 0 ? 'Late' : 'Active';
                        // If active but late, priority to Late? Or Active? Image shows "Late" badge prominently.
                        // Let's prioritize Active for status, but show Late badge if late.
                        if (userRecords.some(r => r.late_minutes > 0)) {
                            // complex status logic? 
                            // If currently active: 'Active'
                            // If entered late: 'Late'
                            status = latest.late_minutes > 0 ? 'Late' : 'Active';
                        } else {
                            status = 'Active';
                        }
                    } else {
                        status = userRecords.some(r => r.late_minutes > 0) ? 'Late' : 'Present';
                    }
                }

                return {
                    id: user.user_id,
                    name: user.user_name || 'Unknown',
                    role: user.desg_name || 'Employee',
                    avatar: user.profile_image_url,
                    department: user.dept_name || 'General',
                    status,
                    sessions,
                    shift
                };
            });

            // Filter by requested departments if user belongs to them, otherwise exclude?
            // "Under All Departments, only show: Engineering, Design, Sales." 
            // This implies we filter the LIST of employees to only those in these depts? 
            // Or just the filter dropdown? Usually filter dropdown. 
            // But if I strictly follow "Only show: Engineering...", I might hide others. 
            // Let's assume filter dropdown options are restricted, but data shows all unless filtered.
            // Actually, "only show: Engineering..." usually means the dropdown options.

            // Sort: status priority
            const statusPriority = { 'Active': 1, 'Late': 2, 'Present': 3, 'Absent': 4 };
            mergedData.sort((a, b) => (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99));

            setAttendanceData(mergedData);
            setStats({
                present: mergedData.filter(d => d.status === 'Present').length,
                late: mergedData.filter(d => d.status === 'Late').length,
                absent: mergedData.filter(d => d.status === 'Absent').length,
                active: mergedData.filter(d => d.status === 'Active').length
            });

        } catch (error) {
            console.error("Dashboard sync failed", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchDashboardData();
        }
    }, [activeTab, selectedDate]);


    // --- FILTER ---
    const filteredEmployees = attendanceData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === 'All Departments' || item.department === selectedDept;
        // Also ensure department is one of the allowed ones if strict? 
        // "Under All Departments, only show: Engineering, Design, Sales"
        // If the user is in "HR", should they be hidden? 
        // I will trust the 'selectedDept' filter logic.
        return matchesSearch && matchesDept;
    });

    return (
        <MobileDashboardLayout title="Live Attendance">
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors relative pb-20">

                {/* --- TABS --- */}
                <div className="w-full">
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 flex">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                            ${activeTab === 'dashboard'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <Activity size={16} /> Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                            ${activeTab === 'requests'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            <FileText size={16} /> Requests
                        </button>
                    </div>
                </div>

                {/* --- DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="px-4 space-y-4 animate-in fade-in slide-in-from-left-4">

                        {/* Date & Filter */}
                        <div className="flex justify-between items-center gap-3">
                            <div className="relative flex-1">
                                <select
                                    value={selectedDept}
                                    onChange={(e) => setSelectedDept(e.target.value)}
                                    className="w-full appearance-none pl-3 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none shadow-sm"
                                >
                                    {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            </div>

                            <div className="relative w-36">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full min-w-0 pl-9 pr-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none shadow-sm"
                                />
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Total Present" value={stats.present} icon={UserCheck} color="indigo" />
                            <StatCard label="Late" value={stats.late} icon={Clock} color="amber" />
                            <StatCard label="Absent" value={stats.absent} icon={UserX} color="red" />
                            <StatCard label="Active Now" value={stats.active} icon={Activity} color="emerald" />
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none shadow-sm dark:text-white"
                            />
                        </div>

                        {/* Employee List */}
                        <div className="space-y-3 pb-8">
                            {loading ? (
                                <div className="py-8 text-center text-slate-400 text-xs">Loading...</div>
                            ) : filteredEmployees.length > 0 ? (
                                filteredEmployees.map(emp => (
                                    <div
                                        key={emp.id}
                                        onClick={() => emp.status !== 'Absent' && setSelectedEmployee(emp)}
                                        className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative group active:scale-[0.99] transition-transform ${emp.status === 'Absent' ? 'opacity-60' : 'cursor-pointer'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                                                    {emp.avatar ? (
                                                        <img src={`${emp.avatar}?t=${avatarTimestamp}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-slate-500 font-bold text-sm">{emp.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{emp.name}</h4>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{emp.role}</p>
                                                </div>
                                            </div>
                                            {/* Status Badge */}
                                            <StatusBadge status={emp.status} />
                                        </div>

                                        {emp.status !== 'Absent' && (
                                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Time In</p>
                                                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                                                        {emp.sessions[emp.sessions.length - 1]?.in || '--:--'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Time Out</p>
                                                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                                                        {emp.sessions[emp.sessions.length - 1]?.out || <span className="text-emerald-500">Active</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="py-10 text-center text-slate-400 text-sm">No employees found</div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- REQUESTS --- */}
                {activeTab === 'requests' && <RequestsView />}

                {/* --- POPUP MODAL --- */}
                {selectedEmployee && (
                    <SessionDetailsModal
                        employee={selectedEmployee}
                        date={selectedDate}
                        onClose={() => setSelectedEmployee(null)}
                    />
                )}

            </div>
        </MobileDashboardLayout>
    );
};

// --- SUB-COMPONENTS ---

const StatCard = ({ label, value, icon: Icon, color }) => {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-500',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 h-24 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">{label}</span>
                <div className={`p-1.5 rounded-lg ${colors[color]} dark:bg-opacity-20`}>
                    <Icon size={14} />
                </div>
            </div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</span>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const styles = {
        'Active': 'bg-emerald-100 text-emerald-700',
        'Late': 'bg-amber-100 text-amber-700',
        'Present': 'bg-blue-100 text-blue-700',
        'Absent': 'bg-slate-100 text-slate-500'
    };
    return (
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${styles[status] || styles['Absent']}`}>
            {status}
        </span>
    );
};

const RequestsView = () => {
    const [subTab, setSubTab] = useState('pending'); // 'pending' | 'history'
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch all and filter client side for now to match strict requirements
                const res = await attendanceService.getCorrectionRequests();
                const all = res.data || [];

                // Pending: Correction/Late requests pending
                // History: Approved/Rejected
                const filtered = subTab === 'pending'
                    ? all.filter(r => r.status === 'Pending')
                    : all.filter(r => ['Approved', 'Rejected'].includes(r.status));

                setRequests(filtered);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [subTab]);

    return (
        <div className="px-4 space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="flex gap-2">
                <button
                    onClick={() => setSubTab('pending')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all
                    ${subTab === 'pending'
                            ? 'bg-indigo-500 text-white shadow-md'
                            : 'bg-transparent border border-slate-200 dark:border-slate-700 text-slate-400'}`}
                >
                    Pending
                </button>
                <button
                    onClick={() => setSubTab('history')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all
                    ${subTab === 'history'
                            ? 'bg-indigo-500 text-white shadow-md'
                            : 'bg-transparent border border-slate-200 dark:border-slate-700 text-slate-400'}`}
                >
                    History
                </button>
            </div>

            <div className="space-y-3 pb-8">
                {loading ? (
                    <div className="py-10 text-center text-slate-400 text-xs">Loading requests...</div>
                ) : requests.length > 0 ? (
                    requests.map(req => (
                        <div key={req.acr_id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                    {req.user_name ? req.user_name.charAt(0) : 'U'}
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{req.user_name}</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{req.correction_type || 'Correction'}</span>
                                        <span className="text-[10px] text-slate-300">•</span>
                                        <span className="text-xs text-slate-400">
                                            {new Date(req.request_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                    ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                                        req.status === 'Rejected' ? 'bg-red-100 text-red-500' :
                                            'bg-amber-100 text-amber-600'}`}>
                                    {req.status}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-1">12:00 AM</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center">
                        <p className="text-slate-400 text-sm">No requests found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const SessionDetailsModal = ({ employee, date, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 pb-10 shadow-2xl transform transition-transform animate-in slide-in-from-bottom-10 duration-300 relative">

                {/* Drag Handle */}
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6"></div>

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm">
                        {employee.avatar ? (
                            <img src={employee.avatar} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xl font-bold text-indigo-600">{employee.name.charAt(0)}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{employee.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{employee.role}</p>
                    </div>
                </div>

                {/* Date */}
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                    Daily Sessions ({new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})
                </h4>

                {/* Timeline */}
                <div className="space-y-0 relative pl-4">
                    {/* Vertical Line */}
                    <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-slate-100 dark:bg-slate-800"></div>

                    {employee.sessions.map((session, idx) => (
                        <div key={idx} className="relative flex items-start gap-6 pb-8 last:pb-0">
                            {/* Number Badge */}
                            <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shadow-sm">
                                {idx + 1}
                            </div>

                            {/* Session Data */}
                            <div className="flex-1 pt-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Time In</p>
                                        <p className="text-base font-bold text-slate-900 dark:text-white">{session.in}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Time Out</p>
                                        <p className="text-base font-bold text-slate-900 dark:text-white">
                                            {session.out || <span className="text-emerald-500">Active</span>}
                                        </p>
                                    </div>
                                </div>

                                {session.location && (
                                    <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 mt-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                                        <MapPin size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
                                        <span className="leading-relaxed">{session.location}</span>
                                    </div>
                                )}

                                {(session.isLate || session.reason) && (
                                    <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-2.5 rounded-xl mt-2">
                                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                        <span className="font-medium">
                                            {session.isLate ? `Late Entry` : 'Correction'}{session.reason ? `: ${session.reason}` : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

export default AttendanceMonitoring;
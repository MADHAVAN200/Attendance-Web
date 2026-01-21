import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { leaveService } from '../../services/leaveService';
import { holidayService } from '../../services/holidayService';
import { toast } from 'react-toastify';
import {
    Calendar as CalendarIcon,
    Clock,
    FileText,
    AlertCircle,
    CheckCircle,
    XCircle,
    Loader,
    Trash2,
    PieChart,
    ArrowRight,
    Upload,
    ChevronLeft,
    ChevronRight,
    Paperclip
} from 'lucide-react';

const ApplyLeave = () => {
    const [leaves, setLeaves] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateMsg, setSelectedDateMsg] = useState('');

    const [formData, setFormData] = useState({
        subject: '',
        start_date: '',
        end_date: '',
        reason: '',
        document: null
    });

    const [stats, setStats] = useState({
        totalApplied: 0,
        approved: 0,
        pending: 0,
        rejected: 0
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setIsLoading(true);
            const [leavesData, holidaysData] = await Promise.all([
                leaveService.getMyLeaves(),
                holidayService.getHolidays()
            ]);

            if (leavesData.ok) {
                setLeaves(leavesData.leaves);
                calculateStats(leavesData.leaves);
            }
            if (holidaysData.ok) {
                setHolidays(holidaysData.holidays);
            }
        } catch (error) {
            console.error("Failed to load data", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setIsLoading(false);
        }
    };

    const calculateStats = (leavesData) => {
        const newStats = leavesData.reduce((acc, leave) => {
            acc.totalApplied++;
            if (leave.status === 'Approved') acc.approved++;
            else if (leave.status === 'Pending') acc.pending++;
            else if (leave.status === 'Rejected') acc.rejected++;
            return acc;
        }, { totalApplied: 0, approved: 0, pending: 0, rejected: 0 });
        setStats(newStats);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData({ ...formData, document: e.target.files[0] });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (new Date(formData.end_date) < new Date(formData.start_date)) {
            toast.error("End date cannot be before start date");
            return;
        }

        try {
            setIsSubmitting(true);

            // Map 'subject' to 'leave_type' for backend compatibility
            const payload = {
                ...formData,
                leave_type: formData.subject // Using Subject as the type/title
            };

            // Note: If backend expects file upload, we need FormData. 
            // Currently assuming JSON based on previous service, handling document as meta-data or mocked.
            // If backend supports mulitpart, we would switch here.

            const res = await leaveService.applyForLeave(payload);
            if (res.ok) {
                toast.success("Leave request submitted successfully");
                setFormData({
                    subject: '',
                    start_date: '',
                    end_date: '',
                    reason: '',
                    document: null
                });
                loadInitialData();
            }
        } catch (error) {
            console.error("Submit error", error);
            toast.error(error.message || "Failed to submit request");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWithdraw = async (id) => {
        if (window.confirm("Are you sure you want to withdraw this request?")) {
            try {
                await leaveService.withdrawLeave(id);
                toast.success("Request withdrawn");
                loadInitialData(); // Refresh all data
            } catch (error) {
                toast.error(error.message || "Failed to withdraw request");
            }
        }
    };

    // --- CALENDAR LOGIC ---
    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const handleDateClick = (day) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        // Correct timezone offset issue for input[type="date"]
        const dateString = clickedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format

        if (!formData.start_date || (formData.start_date && formData.end_date)) {
            // Start selection
            setFormData({ ...formData, start_date: dateString, end_date: '' });
            setSelectedDateMsg('Select End Date');
        } else {
            // End selection
            if (clickedDate < new Date(formData.start_date)) {
                // If clicked before start, reset start
                setFormData({ ...formData, start_date: dateString, end_date: '' });
            } else {
                setFormData({ ...formData, end_date: dateString });
                setSelectedDateMsg('');
            }
        }
    };

    const isDateSelected = (day) => {
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toLocaleDateString('en-CA');
        return checkDate === formData.start_date || checkDate === formData.end_date;
    };

    const isDateInRange = (day) => {
        if (!formData.start_date || !formData.end_date) return false;
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        return checkDate > start && checkDate < end;
    };

    const getHolidayForDay = (day) => {
        const checkDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toLocaleDateString('en-CA');
        return holidays.find(h => h.holiday_date === checkDateStr);
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];

        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-10"></div>);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sun=0, Sat=6
            const holiday = getHolidayForDay(i);
            const isSelected = isDateSelected(i);
            const inRange = isDateInRange(i);

            days.push(
                <div
                    key={i}
                    onClick={() => handleDateClick(i)}
                    className={`
                        h-10 md:h-12 w-full flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all border
                        ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105 z-10' : ''}
                        ${inRange ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-transparent' : ''}
                        ${!isSelected && !inRange && holiday ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : ''}
                        ${!isSelected && !inRange && !holiday && isWeekend ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-transparent' : ''}
                        ${!isSelected && !inRange && !holiday && !isWeekend ? 'bg-white dark:bg-dark-card hover:border-indigo-300 dark:hover:border-indigo-600 border-transparent' : ''}
                    `}
                    title={holiday ? holiday.holiday_name : ''}
                >
                    <span className={`text-sm font-semibold ${isWeekend && !isSelected && !inRange ? 'opacity-75' : ''}`}>{i}</span>
                    {holiday && !isSelected && !inRange && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-0.5"></div>
                    )}
                </div>
            );
        }
        return days;
    };


    const getStatusInfo = (status) => {
        switch (status) {
            case 'Approved': return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle };
            case 'Rejected': return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle };
            default: return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Clock };
        }
    };

    return (
        <DashboardLayout title="Leave Management">

            <div className="space-y-8 animate-fade-in-up">

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Same stats cards as before, reusing logic */}
                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total</span>
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-500"><FileText size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalApplied}</h3>
                    </div>
                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Approved</span>
                            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-500"><CheckCircle size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.approved}</h3>
                    </div>
                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Pending</span>
                            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-500"><Clock size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.pending}</h3>
                    </div>
                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Rejected</span>
                            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-500"><XCircle size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.rejected}</h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

                    {/* Left Column: Form */}
                    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 md:p-8">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <FileText size={20} />
                            </div>
                            Apply for Leave
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Subject Field */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 ml-1">Subject</label>
                                <input
                                    type="text"
                                    name="subject"
                                    required
                                    value={formData.subject}
                                    onChange={handleChange}
                                    placeholder="e.g. Sick Leave, Vacation, Family Emergency"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                />
                            </div>

                            {/* Date Fields (Read-only/Input, synced with calendar) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 ml-1">Start Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="start_date"
                                            required
                                            value={formData.start_date}
                                            onChange={handleChange}
                                            className="w-full pl-4 pr-3 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium calendar-picker-indicator-dark"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 ml-1">End Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="end_date"
                                            required
                                            value={formData.end_date}
                                            onChange={handleChange}
                                            className="w-full pl-4 pr-3 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium calendar-picker-indicator-dark"
                                        />
                                    </div>
                                </div>
                            </div>

                            {selectedDateMsg && (
                                <p className="text-sm text-indigo-500 font-medium animate-pulse">{selectedDateMsg}</p>
                            )}

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 ml-1">Reason</label>
                                <textarea
                                    name="reason"
                                    required
                                    rows="4"
                                    value={formData.reason}
                                    onChange={handleChange}
                                    placeholder="Detailed explanation..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                                ></textarea>
                            </div>

                            {/* Document Upload (Optional) */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 ml-1">Attach Document (Optional)</label>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl group-hover:border-indigo-400 transition-all">
                                        <div className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-300">
                                            {formData.document ? <CheckCircle size={18} className="text-green-500" /> : <Paperclip size={18} />}
                                        </div>
                                        <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                            {formData.document ? formData.document.name : "Click to attach file or drag here"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm uppercase tracking-wide"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader className="animate-spin" size={18} />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Submit Request
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Right Column: Calendar & History */}
                    <div className="space-y-6 flex flex-col h-full">

                        {/* Interactive Calendar - Fixed Height Container */}
                        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex-shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <CalendarIcon className="text-indigo-500" size={20} />
                                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest py-1">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {renderCalendar()}
                            </div>

                            <div className="mt-4 flex gap-4 text-xs text-slate-500 dark:text-slate-400 justify-center">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-50 border border-amber-200"></div> Holiday</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-600"></div> Selected</div>
                            </div>

                            {/* Current Month Holidays List */}
                            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Holidays in {currentDate.toLocaleString('default', { month: 'long' })}</h4>
                                {holidays.filter(h => {
                                    const hDate = new Date(h.holiday_date);
                                    return hDate.getMonth() === currentDate.getMonth() && hDate.getFullYear() === currentDate.getFullYear();
                                }).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No holidays this month</p>
                                ) : (
                                    <div className="space-y-2">
                                        {holidays.filter(h => {
                                            const hDate = new Date(h.holiday_date);
                                            return hDate.getMonth() === currentDate.getMonth() && hDate.getFullYear() === currentDate.getFullYear();
                                        }).map(h => (
                                            <div key={h.holiday_id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                <span className="font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                                    {new Date(h.holiday_date).getDate()}
                                                </span>
                                                <span>{h.holiday_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Brief History List - Scrollable */}
                        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex-grow flex flex-col min-h-0">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex-shrink-0">Recent History</h3>

                            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow" style={{ maxHeight: '300px' }}>
                                {leaves.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <p className="text-slate-400 text-sm text-center">No recent leaves found.</p>
                                    </div>
                                ) : (
                                    <>
                                        {leaves.map(leave => {
                                            const statusStyle = getStatusInfo(leave.status);
                                            const StatusIcon = statusStyle.icon;
                                            return (
                                                <div key={leave.leave_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-800 dark:text-white text-sm">{leave.leave_type}</h4>
                                                        <p className="text-xs text-slate-500">{new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</p>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${statusStyle.bg} ${statusStyle.color}`}>
                                                        <StatusIcon size={10} />
                                                        {leave.status}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ApplyLeave;

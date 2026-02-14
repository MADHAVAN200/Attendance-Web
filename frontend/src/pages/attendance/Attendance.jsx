import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../../components/DashboardLayout';
import Webcam from 'react-webcam';
import {
    ArrowRight,
    LogOut,
    MapPin,
    Calendar as CalendarIcon,
    Camera,
    X,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    FileText,
    Download,
    Clock,
    BarChart3,
    History,
    MoreVertical,
    AlertCircle,
    Check,
    FileClock,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { toast } from 'react-toastify';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';

import CustomCalendar from '../../components/CustomCalendar';

// Register ChartJS
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler
);

const Attendance = () => {
    // Current date for Mark Attendance
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(formattedToday);

    // Month for Reports/History/Analytics
    const [reportYear, setReportYear] = useState(today.getFullYear());
    const [reportMonthIdx, setReportMonthIdx] = useState(today.getMonth()); // 0-11

    // Derived YYYY-MM string for API
    const reportMonth = `${reportYear}-${String(reportMonthIdx + 1).padStart(2, '0')}`;

    // Data State
    const [dailySessions, setDailySessions] = useState([]); // For Mark Attendance tab
    const [monthlySessions, setMonthlySessions] = useState([]); // For My Attendance tab
    const [loading, setLoading] = useState(false);
    const [holidays, setHolidays] = useState([]);

    // Fetch Holidays
    useEffect(() => {
        attendanceService.getHolidays()
            .then(data => setHolidays(data.holidays || []))
            .catch(console.error);
    }, []);

    // Navigation State
    const [activeTab, setActiveTab] = useState('mark_attendance'); // 'mark_attendance' | 'my_attendance'
    const [subTab, setSubTab] = useState('history'); // 'history' | 'analytics'

    // Calendar State
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarRef = useRef(null);

    // Handle outside click to close calendar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                setShowCalendar(false);
            }
        };
        if (showCalendar) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCalendar]);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // Correction Request State
    const [correctionHistory, setCorrectionHistory] = useState([]);
    const [corrDate, setCorrDate] = useState('');
    const [corrType, setCorrType] = useState('Correction'); // 'Correction' | 'Missed Punch' | 'Overtime' | 'Other'
    const [corrOtherType, setCorrOtherType] = useState(''); // Custom type input
    const [corrMethod, setCorrMethod] = useState('add_session'); // 'add_session' | 'reset'

    // Inputs for 'fix' and 'reset'
    const [corrIn, setCorrIn] = useState('');
    const [corrOut, setCorrOut] = useState('');

    // Inputs for 'add_session'
    const [corrSessions, setCorrSessions] = useState([{ time_in: '', time_out: '' }]);

    const [corrReason, setCorrReason] = useState('');
    const [existingRecord, setExistingRecord] = useState(null); // Data for selected date
    const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null); // For details modal

    // --- DATA FETCHING ---

    // 1. Fetch Daily Records (for "Mark Attendance" tab)
    const fetchDailyRecords = useCallback(async () => {
        if (activeTab !== 'mark_attendance') return;
        setLoading(true);
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate);
            if (res.ok) setDailySessions(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch daily records");
        } finally {
            setLoading(false);
        }
    }, [selectedDate, activeTab]);

    // 2. Fetch Monthly Records (for "My Attendance" tab - History & Analytics)
    const fetchMonthlyRecords = useCallback(async () => {
        if (activeTab !== 'my_attendance') return;
        setLoading(true);
        try {
            const year = reportMonth.split('-')[0];
            const month = reportMonth.split('-')[1];
            const startDate = `${year}-${month}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            const res = await attendanceService.getMyRecords(startDate, endDate);
            if (res.ok) setMonthlySessions(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch monthly records");
        } finally {
            setLoading(false);
        }
    }, [reportMonth, activeTab]);

    // 3. Fetch Correction History
    const fetchCorrectionHistory = useCallback(async () => {
        if (activeTab === 'my_attendance' && subTab === 'correction') {
            setLoading(true);
            try {
                const res = await attendanceService.getCorrectionRequests({ limit: 50 });
                setCorrectionHistory(res.data || []);
            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch correction history");
            } finally {
                setLoading(false);
            }
        }
    }, [activeTab, subTab]);

    // 4. Fetch Existing Record for Correction Date
    useEffect(() => {
        if (!corrDate) {
            setExistingRecord(null);
            return;
        }

        const fetchRecord = async () => {
            try {
                // Reuse getMyRecords to find data for this specific day
                const res = await attendanceService.getMyRecords(corrDate, corrDate);
                // API returns { data: [...] }. Access data property.
                if (res?.data && res.data.length > 0) {
                    setExistingRecord(res.data[0]);
                } else {
                    setExistingRecord(null);
                }
            } catch (error) {
                console.error("Failed to fetch existing record", error);
                setExistingRecord(null);
            }
        };

        fetchRecord();
    }, [corrDate]);

    useEffect(() => {
        fetchDailyRecords();
    }, [fetchDailyRecords]);

    useEffect(() => {
        fetchMonthlyRecords();
    }, [fetchMonthlyRecords]);

    useEffect(() => {
        fetchCorrectionHistory();
    }, [fetchCorrectionHistory]);


    // --- ACTION HANDLERS ---

    const openCamera = (mode) => {
        setCameraMode(mode);
        setImgSrc(null);
        setShowCamera(true);
    };

    const closeCamera = () => {
        setShowCamera(false);
        setImgSrc(null);
        setCameraMode(null);
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
    }, [webcamRef]);

    const retake = () => {
        setImgSrc(null);
    };

    const dataURLtoBlob = (dataurl) => {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    const confirmAttendance = async () => {
        if (!imgSrc) return;
        setIsSubmitting(true);

        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported");
            setIsSubmitting(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude, accuracy } = position.coords;
                // const MAX_ALLOWED_ACCURACY = 200; 
                // if (accuracy > MAX_ALLOWED_ACCURACY) ... (Strict check disabled for dev flexibility if needed, but keeping generally)

                const imageBlob = dataURLtoBlob(imgSrc);
                const payload = { latitude, longitude, accuracy, imageFile: imageBlob };

                let res;
                if (cameraMode === 'IN') {
                    res = await attendanceService.timeIn(payload);
                    toast.success("Checked In Successfully!");
                } else {
                    res = await attendanceService.timeOut(payload);
                    toast.success("Checked Out Successfully!");
                }

                closeCamera();
                fetchDailyRecords();
            } catch (error) {
                console.error(error);
                toast.error(error.message || "Attendance failed");
            } finally {
                setIsSubmitting(false);
            }
        }, (error) => {
            console.error(error);
            toast.error("Location error: " + error.message);
            setIsSubmitting(false);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    };

    const handleDownloadReport = async () => {
        const toastId = toast.loading("Generating report...");
        try {
            const data = await attendanceService.downloadMyReport(reportMonth);
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `My_Attendance_${reportMonth}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.update(toastId, { render: "Report downloaded", type: "success", isLoading: false, autoClose: 3000 });
        } catch (error) {
            toast.update(toastId, { render: error.message, type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const handleSubmitCorrection = async (e) => {
        e.preventDefault();
        if (!corrDate || !corrReason) {
            toast.error("Date and Reason are required");
            return;
        }

        setIsSubmittingCorrection(true);
        try {
            const payload = {
                correction_type: corrType === 'Other' ? corrOtherType : corrType,
                request_date: corrDate,
                reason: corrReason,
                correction_method: corrMethod
            };

            // 2. ADD SESSION MODE (Manual Correction)
            if (corrMethod === 'add_session') {
                // Filter out empty sessions
                const validSessions = corrSessions.filter(s => s.time_in && s.time_out);
                if (validSessions.length === 0) {
                    throw new Error("Please add at least one valid session (Time In & Time Out)");
                }
                payload.sessions = validSessions;
            }
            // 3. RESET MODE
            else if (corrMethod === 'reset') {
                if (!corrIn || !corrOut) {
                    throw new Error("New Time In and Time Out are required for Reset.");
                }
                payload.requested_time_in = corrIn;
                payload.requested_time_out = corrOut;
            }

            await attendanceService.submitCorrectionRequest(payload);

            toast.success("Correction request submitted!");
            // Reset Form
            setCorrDate('');
            setCorrIn('');
            setCorrOut('');
            setCorrReason('');
            setCorrType('Correction');
            setCorrOtherType('');
            setCorrMethod('add_session');
            setCorrSessions([{ time_in: '', time_out: '' }]);
            setExistingRecord(null);

            fetchCorrectionHistory();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to submit request");
        } finally {
            setIsSubmittingCorrection(false);
        }
    };

    // --- HELPERS ---
    const formatDateDisplay = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTime = (isoString) => {
        if (!isoString) return null;
        return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const calculateDuration = (timeIn, timeOut) => {
        if (!timeIn || !timeOut) return null;
        const start = new Date(timeIn);
        const end = new Date(timeOut);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

        let diffMs = end - start;
        // Handle overnight shifts where end time is on the next day (or incorrectly stored as same day)
        if (diffMs < 0) {
            diffMs += 24 * 60 * 60 * 1000;
        }

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours === 0) return `${minutes}m`;
        return `${hours}h ${minutes}m`;
    };

    const handlePrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    // --- ANALYTICS DATA PREP ---
    const chartData = {
        labels: monthlySessions.map(s => new Date(s.check_in || s.time_in).getDate()).reverse(),
        datasets: [
            {
                label: 'Hours Worked',
                data: monthlySessions.map(s => parseFloat(s.total_hours || 0)).reverse(),
                backgroundColor: 'rgba(79, 70, 229, 0.6)',
                borderRadius: 4,
            }
        ]
    };

    const statusCounts = monthlySessions.reduce((acc, s) => {
        const status = s.late_minutes > 0 ? "Late" : "On Time"; // Simple derived status
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const pieData = {
        labels: Object.keys(statusCounts),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
        }]
    };

    // --- COMPUTE CALENDAR EVENTS ---
    const calendarEvents = {};

    // 1. Add Holidays (Yellow)
    holidays.forEach(h => {
        calendarEvents[h.holiday_date] = { type: 'holiday' };
    });

    // 2. Add Absents (Red) - Simple Approximation
    // Mark past weekdays (not Sat/Sun) as absent if no record exists
    const daysInReportMonth = new Date(reportYear, reportMonthIdx + 1, 0).getDate();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const hasRecord = (dateStr) => {
        return monthlySessions.some(s =>
            (s.time_in && s.time_in.startsWith(dateStr)) ||
            (s.check_in && s.check_in.startsWith(dateStr))
        );
    };

    for (let d = 1; d <= daysInReportMonth; d++) {
        const date = new Date(reportYear, reportMonthIdx, d);
        const dateStr = date.toISOString().split('T')[0];

        if (dateStr > todayStr) break; // Don't mark future

        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (!isWeekend && !calendarEvents[dateStr] && !hasRecord(dateStr)) {
            if (dateStr !== todayStr) {
                calendarEvents[dateStr] = { type: 'absent' };
            }
        }
    }


    return (
        <DashboardLayout title="Attendance">
            <div className="space-y-6 w-full">

                {/* --- TOP LEVEL TABS --- */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-fit">
                    <button
                        onClick={() => { setActiveTab('mark_attendance'); setSubTab('list'); }}
                        className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'mark_attendance'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                    >
                        Mark Attendance
                    </button>
                    <button
                        onClick={() => { setActiveTab('my_attendance'); setSubTab('history'); }}
                        className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'my_attendance'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                    >
                        My Attendance
                    </button>
                    {/* Hidden Correction Request Tab Button */}
                </div>

                {/* --- CONTENT AREA --- */}

                {/* 1. MARK ATTENDANCE TAB */}
                {activeTab === 'mark_attendance' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Action Buttons & Correction Toggle */}
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <button
                                    onClick={() => openCamera('IN')}
                                    className="flex items-center justify-center gap-3 bg-indigo-600 text-white h-24 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 hover:bg-indigo-700 hover:shadow-xl transition-all active:scale-95 group">
                                    <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                                        <ArrowRight size={24} />
                                    </div>
                                    <span className="text-2xl font-bold">Time In</span>
                                </button>

                                <button
                                    onClick={() => openCamera('OUT')}
                                    className="flex items-center justify-center gap-3 bg-slate-800 dark:bg-slate-700 text-white h-24 rounded-2xl shadow-lg shadow-slate-200 dark:shadow-slate-900/30 hover:bg-slate-900 dark:hover:bg-slate-600 hover:shadow-xl transition-all active:scale-95 group">
                                    <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                                        <LogOut size={24} />
                                    </div>
                                    <span className="text-2xl font-bold">Time Out</span>
                                </button>
                            </div>

                        </div>

                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-end items-center gap-4 relative" ref={calendarRef}>
                                <button
                                    onClick={handlePrevDay}
                                    className="p-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-dark-card py-2.5 px-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 min-w-[200px] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors select-none"
                                >
                                    <CalendarIcon size={18} />
                                    <span>{formatDateDisplay(selectedDate)}</span>
                                </div>

                                {showCalendar && (
                                    <CustomCalendar
                                        selectedDate={selectedDate}
                                        onChange={(date) => {
                                            setSelectedDate(date);
                                            setShowCalendar(false);
                                        }}
                                        onClose={() => setShowCalendar(false)}
                                        events={calendarEvents}
                                    />
                                )}

                                <button
                                    onClick={handleNextDay}
                                    className="p-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            {/* Daily Records List */}
                            <div className="space-y-4">
                                {loading ? (
                                    <p className="text-center text-slate-500 py-10">Loading...</p>
                                ) : dailySessions.length === 0 ? (
                                    <p className="text-center text-slate-400 py-10">No attendance records for this date.</p>
                                ) : (
                                    dailySessions.map((session) => (
                                        <div key={session.attendance_id} className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between gap-4">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                                    {new Date(session.time_in).getDate()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-white">
                                                        {formatTime(session.time_in)} - {session.time_out ? formatTime(session.time_out) : 'Active'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                        <MapPin size={12} /> {session.time_in_address || 'Unknown'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {session.total_hours || calculateDuration(session.time_in, session.time_out) || '--'}
                                                </p>
                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${session.late_minutes > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {session.late_minutes > 0 ? 'Late' : 'On Time'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* 2. MY ATTENDANCE TAB */}
                {activeTab === 'my_attendance' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Report Header */}
                        <div className="bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Monthly Report</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Download and view your logs</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={reportMonthIdx}
                                    onChange={(e) => setReportMonthIdx(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i}>
                                            {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={reportYear}
                                    onChange={(e) => setReportYear(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleDownloadReport}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                                >
                                    <Download size={16} />
                                    Download
                                </button>
                            </div>
                        </div>

                        {/* Sub Tabs */}
                        <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6">
                            <button
                                onClick={() => setSubTab('history')}
                                className={`pb-3 text-sm font-medium transition-all relative ${subTab === 'history'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <History size={16} />
                                    History
                                </div>
                                {subTab === 'history' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                )}
                            </button>
                            <button
                                onClick={() => setSubTab('analytics')}
                                className={`pb-3 text-sm font-medium transition-all relative ${subTab === 'analytics'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={16} />
                                    Analytics
                                </div>
                                {subTab === 'analytics' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                )}
                            </button>
                            <button
                                onClick={() => setSubTab('correction')}
                                className={`pb-3 text-sm font-medium transition-all relative ${subTab === 'correction'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileClock size={16} />
                                    Correction Requests
                                </div>
                                {subTab === 'correction' && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>
                                )}
                            </button>
                        </div>

                        {/* SUB-TAB: HISTORY (Weekly Grouped) */}
                        {subTab === 'history' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {monthlySessions.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">No records found for this month</p>
                                    </div>
                                ) : (
                                    // Group by Week
                                    Object.entries(monthlySessions.reduce((groups, session) => {
                                        const date = new Date(session.time_in || session.check_in); // Handle both key names if backend varies
                                        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
                                        const weekNumber = Math.ceil((((date - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
                                        const weekKey = `Week ${weekNumber}`;

                                        if (!groups[weekKey]) groups[weekKey] = [];
                                        groups[weekKey].push(session);
                                        return groups;
                                    }, {})).sort().map(([week, weekSessions]) => (
                                        <div key={week} className="space-y-4">
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 sticky top-0 bg-slate-50/95 dark:bg-black/20 backdrop-blur-sm py-2 z-10">
                                                {week}
                                            </h3>
                                            <div className="grid gap-4">
                                                {weekSessions.map((session, index) => (
                                                    <div key={session.attendance_id || index} className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${session.late_minutes > 0
                                                                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                                                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                    }`}>
                                                                    {new Date(session.time_in).getDate()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-800 dark:text-white">
                                                                        {new Date(session.time_in).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${session.late_minutes > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                                            }`}>
                                                                            {session.late_minutes > 0 ? 'Late' : 'On Time'}
                                                                        </span>
                                                                        <span>•</span>
                                                                        <span>{session.time_in_address || 'Remote'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-6 text-sm">
                                                                <div>
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">In</p>
                                                                    <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{formatTime(session.time_in)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Out</p>
                                                                    <p className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                                                        {session.time_out ? formatTime(session.time_out) : '--:--'}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right min-w-[60px]">
                                                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Hrs</p>
                                                                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                                                                        {session.total_hours || calculateDuration(session.time_in, session.time_out) || '-'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* SUB-TAB: ANALYTICS */}
                        {subTab === 'analytics' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* 1. KPI Cards Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Card 1: Total Days */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Total Days</p>
                                            <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{monthlySessions.length}</h3>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <CalendarIcon size={24} />
                                        </div>
                                    </div>

                                    {/* Card 2: Present % */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                                        <div className="flex justify-between items-start z-10 relative">
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">Present</p>
                                                <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.status !== 'ABSENT').length / monthlySessions.length) * 100) : 0}%
                                                </h3>
                                            </div>
                                            <div className="h-12 w-12 rounded-full border-4 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-500 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-emerald-600">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.status !== 'ABSENT').length / monthlySessions.length) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3: Late % */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                                        <div className="flex justify-between items-start z-10 relative">
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">Late</p>
                                                <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.late_minutes > 0).length / monthlySessions.length) * 100) : 0}%
                                                </h3>
                                            </div>
                                            <div className="h-12 w-12 rounded-full border-4 border-amber-100 dark:border-amber-900/30 border-t-amber-500 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-amber-600">
                                                    {monthlySessions.length > 0 ? Math.round((monthlySessions.filter(s => s.late_minutes > 0).length / monthlySessions.length) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 4: Avg Hours */}
                                    <div className="bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Avg Hours</p>
                                            <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                                                {monthlySessions.length > 0
                                                    ? (monthlySessions.reduce((acc, s) => acc + parseFloat(s.total_hours || 0), 0) / monthlySessions.length).toFixed(1)
                                                    : '0'}
                                            </h3>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <Clock size={24} />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Attendance Trends (Full Width) */}
                                <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Total Attendance Report</h3>
                                        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                                            <MoreVertical size={18} />
                                        </button>
                                    </div>
                                    <div className="h-72">
                                        <Bar
                                            data={chartData}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { display: false }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        grid: { color: 'rgba(200, 200, 200, 0.1)', borderDash: [5, 5] },
                                                        ticks: { color: '#94a3b8' }
                                                    },
                                                    x: {
                                                        grid: { display: false },
                                                        ticks: { color: '#94a3b8' }
                                                    }
                                                },
                                                borderRadius: 6,
                                                barThickness: 24
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* 3. Bottom Row: Status & Weekly Pattern */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Status Breakdown */}
                                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Attendance Status</h3>
                                        <div className="h-64 flex justify-center relative">
                                            <Doughnut
                                                data={pieData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    cutout: '75%',
                                                    plugins: {
                                                        legend: {
                                                            position: 'right',
                                                            labels: { usePointStyle: true, boxWidth: 8, padding: 20 }
                                                        }
                                                    }
                                                }}
                                            />
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-3xl font-bold text-slate-800 dark:text-white">{monthlySessions.length}</span>
                                                <span className="text-xs text-slate-500 uppercase font-bold">Total</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Weekly Radar Chart */}
                                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Weekly Activity</h3>
                                        <div className="h-64 flex justify-center">
                                            <Radar
                                                data={{
                                                    labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                                                    datasets: [{
                                                        label: 'Avg Hours',
                                                        data: [0, 1, 2, 3, 4, 5, 6].map(d => {
                                                            // Calculate Avg Hours per Day of Week
                                                            const sessionsOnDay = monthlySessions.filter(s => new Date(s.time_in).getDay() === d);
                                                            if (sessionsOnDay.length === 0) return 0;
                                                            const total = sessionsOnDay.reduce((acc, s) => acc + parseFloat(s.total_hours || 0), 0);
                                                            return (total / sessionsOnDay.length).toFixed(1);
                                                        }),
                                                        backgroundColor: 'rgba(79, 70, 229, 0.2)',
                                                        borderColor: '#4f46e5',
                                                        borderWidth: 2,
                                                        pointBackgroundColor: '#fff',
                                                        pointBorderColor: '#4f46e5',
                                                    }]
                                                }}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    scales: {
                                                        r: {
                                                            angleLines: { color: 'rgba(200, 200, 200, 0.2)' },
                                                            grid: { color: 'rgba(200, 200, 200, 0.2)' },
                                                            pointLabels: { color: '#64748b', font: { size: 11 } },
                                                            ticks: { display: false, backdropColor: 'transparent' }
                                                        }
                                                    },
                                                    plugins: {
                                                        legend: { display: false }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: CORRECTION REQUESTS */}
                        {subTab === 'correction' && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Application Form */}
                                    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-fit">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                <AlertCircle size={24} />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Apply Correction</h3>
                                        </div>

                                        <form onSubmit={handleSubmitCorrection} className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                                <input
                                                    type="date"
                                                    value={corrDate}
                                                    max={new Date().toISOString().split('T')[0]}
                                                    onChange={(e) => setCorrDate(e.target.value)}
                                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white"
                                                    required
                                                />
                                            </div>

                                            {existingRecord && (
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm">
                                                    <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Existing Record Found:</p>
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>In: {existingRecord.time_in ? formatTime(existingRecord.time_in) : '--'}</span>
                                                        <span>Out: {existingRecord.time_out ? formatTime(existingRecord.time_out) : '--'}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                                <select
                                                    value={corrType}
                                                    onChange={(e) => setCorrType(e.target.value)}
                                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white appearance-none"
                                                >
                                                    <option value="Correction">Correction</option>
                                                    <option value="Missed Punch">Missed Punch</option>
                                                    <option value="Overtime">Overtime</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                                {corrType === 'Other' && (
                                                    <input
                                                        type="text"
                                                        placeholder="Specify Type"
                                                        value={corrOtherType}
                                                        onChange={(e) => setCorrOtherType(e.target.value)}
                                                        className="w-full mt-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white"
                                                        required
                                                    />
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrMethod('add_session')}
                                                        className={`py-1.5 text-xs font-bold rounded-md transition-all ${corrMethod === 'add_session' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                                    >
                                                        Manual Correction
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrMethod('reset')}
                                                        className={`py-1.5 text-xs font-bold rounded-md transition-all ${corrMethod === 'reset' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                                    >
                                                        Reset Day
                                                    </button>
                                                </div>
                                            </div>

                                            {corrMethod === 'reset' ? (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New In</label>
                                                        <input
                                                            type="time"
                                                            value={corrIn}
                                                            onChange={(e) => setCorrIn(e.target.value)}
                                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Out</label>
                                                        <input
                                                            type="time"
                                                            value={corrOut}
                                                            onChange={(e) => setCorrOut(e.target.value)}
                                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase">Sessions</label>
                                                    {corrSessions.map((session, index) => (
                                                        <div key={index} className="flex gap-2">
                                                            <input
                                                                type="time"
                                                                value={session.time_in}
                                                                onChange={(e) => {
                                                                    const newSessions = [...corrSessions];
                                                                    newSessions[index].time_in = e.target.value;
                                                                    setCorrSessions(newSessions);
                                                                }}
                                                                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white text-sm"
                                                                placeholder="In"
                                                            />
                                                            <input
                                                                type="time"
                                                                value={session.time_out}
                                                                onChange={(e) => {
                                                                    const newSessions = [...corrSessions];
                                                                    newSessions[index].time_out = e.target.value;
                                                                    setCorrSessions(newSessions);
                                                                }}
                                                                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white text-sm"
                                                                placeholder="Out"
                                                            />
                                                            {index > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newSessions = corrSessions.filter((_, i) => i !== index);
                                                                        setCorrSessions(newSessions);
                                                                    }}
                                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrSessions([...corrSessions, { time_in: '', time_out: '' }])}
                                                        className="w-full py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors"
                                                    >
                                                        + Add Another Session
                                                    </button>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason</label>
                                                <textarea
                                                    value={corrReason}
                                                    onChange={(e) => setCorrReason(e.target.value)}
                                                    placeholder="Why is this correction needed?"
                                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-white h-24 resize-none"
                                                    required
                                                ></textarea>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSubmittingCorrection}
                                                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {isSubmittingCorrection ? 'Submitting...' : 'Submit Request'}
                                            </button>
                                        </form>
                                    </div>

                                    {/* History View (Simplified) */}
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-slate-800 dark:text-white px-2">Request History</h3>
                                        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                                            {correctionHistory.length === 0 ? (
                                                <p className="text-sm text-slate-500 dark:text-slate-400 italic px-2">No history found.</p>
                                            ) : (
                                                correctionHistory.map((req) => (
                                                    <div
                                                        key={req.acr_id}
                                                        onClick={() => setSelectedRequest(req)}
                                                        className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                                    req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                        'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                    {req.status}
                                                                </span>
                                                                <span className="text-xs text-slate-400 font-mono group-hover:text-indigo-500 transition-colors">
                                                                    {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : ''}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-bold text-slate-700 dark:text-white text-sm">
                                                                {req.correction_type} for {req.request_date ? new Date(req.request_date).toLocaleDateString() : 'Unknown Date'}
                                                            </h4>
                                                            <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">"{req.reason}"</p>
                                                        </div>

                                                        <div className="text-right text-xs">
                                                            {req.requested_time_in && (
                                                                <div className="flex items-center gap-1 justify-end text-slate-600 dark:text-slate-300">
                                                                    <span className="font-bold text-slate-400">In:</span> {req.requested_time_in}
                                                                </div>
                                                            )}
                                                            {req.requested_time_out && (
                                                                <div className="flex items-center gap-1 justify-end text-slate-600 dark:text-slate-300">
                                                                    <span className="font-bold text-slate-400">Out:</span> {req.requested_time_out}
                                                                </div>
                                                            )}
                                                            {!req.requested_time_in && !req.requested_time_out && (
                                                                <span className="text-slate-400 italic group-hover:text-indigo-400 transition-colors">Added Sessions</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}




                {/* --- CORRECTION DETAILS MODAL --- */}
                {selectedRequest && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Request Details</h3>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">ID: #{selectedRequest.acr_id}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                {/* Status Banner */}
                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedRequest.status === 'approved'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                                    : selectedRequest.status === 'rejected'
                                        ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                                        : 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                                    }`}>
                                    {selectedRequest.status === 'approved' && <CheckCircle size={20} />}
                                    {selectedRequest.status === 'rejected' && <XCircle size={20} />}
                                    {selectedRequest.status === 'pending' && <Clock size={20} />}
                                    <span className="font-bold uppercase tracking-wide text-sm">{selectedRequest.status}</span>
                                </div>

                                {/* Key Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Date</label>
                                        <p className="font-medium text-slate-700 dark:text-slate-200">
                                            {selectedRequest.request_date ? formatDateDisplay(selectedRequest.request_date) : 'Invalid Date'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Type</label>
                                        <p className="font-medium text-slate-700 dark:text-slate-200">{selectedRequest.correction_type}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Method</label>
                                        <p className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                                            {selectedRequest.correction_method === 'add_session' ? 'Manual Correction' : selectedRequest.correction_method || 'Fix'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Submitted</label>
                                        <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                                            {selectedRequest.submitted_at ? new Date(selectedRequest.submitted_at).toLocaleString() : '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* Reason */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Reason</label>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-300 italic border border-slate-100 dark:border-slate-700">
                                        "{selectedRequest.reason}"
                                    </div>
                                </div>

                                {/* Sessions (if Manual Correction) */}
                                {selectedRequest.correction_data && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Requested Sessions</label>
                                        <div className="space-y-2">
                                            {(typeof selectedRequest.correction_data === 'string'
                                                ? JSON.parse(selectedRequest.correction_data).sessions
                                                : selectedRequest.correction_data.sessions || []
                                            ).map((s, i) => (
                                                <div key={i} className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm border border-slate-100 dark:border-slate-700">
                                                    <span className="font-mono text-slate-600 dark:text-slate-400">In: <span className="text-slate-800 dark:text-white font-bold">{s.time_in}</span></span>
                                                    <span className="font-mono text-slate-600 dark:text-slate-400">Out: <span className="text-slate-800 dark:text-white font-bold">{s.time_out}</span></span>
                                                </div>
                                            ))}
                                            {/* Handle Reset Mode Data display if needed */}
                                            {(typeof selectedRequest.correction_data === 'string'
                                                ? JSON.parse(selectedRequest.correction_data)
                                                : selectedRequest.correction_data
                                            ).time_in && (
                                                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm border border-slate-100 dark:border-slate-700">
                                                        <span className="font-mono text-slate-600 dark:text-slate-400">In: <span className="text-slate-800 dark:text-white font-bold">
                                                            {(typeof selectedRequest.correction_data === 'string' ? JSON.parse(selectedRequest.correction_data) : selectedRequest.correction_data).time_in}
                                                        </span></span>
                                                        <span className="font-mono text-slate-600 dark:text-slate-400">Out: <span className="text-slate-800 dark:text-white font-bold">
                                                            {(typeof selectedRequest.correction_data === 'string' ? JSON.parse(selectedRequest.correction_data) : selectedRequest.correction_data).time_out}
                                                        </span></span>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                )}

                                {/* Admin Review */}
                                {selectedRequest.status !== 'pending' && (
                                    <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-2">Reviewer Comments</h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {selectedRequest.review_comments || "No comments provided."}
                                        </p>
                                        <div className="mt-2 text-xs text-slate-400">
                                            Reviewed by Admin on {selectedRequest.reviewed_at ? new Date(selectedRequest.reviewed_at).toLocaleDateString() : '-'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* --- CAMERA PORTAL --- */}
                {showCamera && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 transition-all duration-200">
                        <div className="w-full max-w-4xl space-y-8 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-2xl font-bold text-white tracking-tight">
                                    {cameraMode === 'IN' ? 'Check In' : 'Check Out'}
                                </h3>
                                <button
                                    onClick={closeCamera}
                                    className="p-2.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md"
                                >
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="relative bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center aspect-video">
                                {imgSrc ? (
                                    <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
                                ) : (
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        className="w-full h-full object-cover"
                                        videoConstraints={{ facingMode: "user" }}
                                    />
                                )}
                            </div>

                            <div className="flex justify-center gap-6 pt-2">
                                {!imgSrc ? (
                                    <button
                                        onClick={capture}
                                        className="w-24 h-24 rounded-full bg-white text-indigo-600 hover:scale-110 active:scale-95 flex items-center justify-center shadow-xl shadow-indigo-900/20 transition-all duration-300 ring-8 ring-white/20">
                                        <Camera size={40} />
                                    </button>
                                ) : (
                                    <div className="flex w-full gap-4 px-4 max-w-lg mx-auto">
                                        <button
                                            onClick={retake}
                                            className="flex-1 px-8 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white border border-white/10 font-bold text-lg transition-all flex items-center justify-center gap-3 backdrop-blur-md hover:scale-[1.02] active:scale-95">
                                            <RefreshCw size={22} /> Retake
                                        </button>
                                        <button
                                            onClick={confirmAttendance}
                                            disabled={isSubmitting}
                                            className="flex-1 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:pointer-events-none">
                                            {isSubmitting ? '...' : 'Confirm'} <ArrowRight size={22} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            </div>
        </DashboardLayout >
    );
};

export default Attendance;

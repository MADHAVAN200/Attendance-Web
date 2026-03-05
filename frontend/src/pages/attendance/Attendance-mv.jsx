import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import MobileDashboardLayout from '../../components/MobileDashboardLayout';
import {
    MapPin,
    Clock,
    Camera,
    History,
    Calendar,
    AlertCircle,
    X,
    CheckCircle,
    RefreshCw,
    Download,
    Bell,
    Moon,
    Menu,
    ChevronRight,
    FileText,
    User,
    ArrowRight,
    LogOut,
    Plus,
    Minus,
    Paperclip
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { toast } from 'react-toastify';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../context/AuthContext';

const Attendance = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // --- STATE ---
    const [mainTab, setMainTab] = useState('attendance'); // 'attendance', 'my_attendance'
    const [subTab, setSubTab] = useState('history'); // 'history', 'analytics', 'corrections'
    const [correctionFilter, setCorrectionFilter] = useState('pending'); // 'pending', 'history'

    // Correction Form State
    const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null); // Detailed view
    const [isFetchingDetails, setIsFetchingDetails] = useState(false); // Loading detailed view
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Admin actions

    const [correctionForm, setCorrectionForm] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'Missed Punch',
        method: 'manual', // 'manual' or 'reset'
        sessions: [{ in: '', out: '' }],
        reason: '',
        files: []
    });

    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState({ lat: null, lng: null, address: 'Fetching location...', error: null });
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);

    // Camera
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState(null); // 'IN' or 'OUT'
    const [imgSrc, setImgSrc] = useState(null);
    const webcamRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Data
    const [dailySessions, setDailySessions] = useState([]);
    const [monthlySessions, setMonthlySessions] = useState([]);
    const [correctionHistory, setCorrectionHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Dates
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [reportYear, setReportYear] = useState(new Date().getFullYear());

    const handleRequestClick = async (item) => {
        if (isFetchingDetails) return;

        try {
            setIsFetchingDetails(true);
            const requestId = item.acr_id || item.request_id || item.id;
            const res = await attendanceService.getCorrectionDetails(requestId);
            const details = res.data || res;

            // Merge to ensure we keep any list-specific data just in case, preferring fetched details
            setSelectedRequest({ ...item, ...details });
        } catch (error) {
            console.error("Failed to fetch correction details:", error);
            toast.error(error.message || "Failed to fetch request details");
            // Fallback to the summary version if network fails so the user can still see it
            setSelectedRequest(item);
        } finally {
            setIsFetchingDetails(false);
        }
    };

    // --- EFFECTS ---

    // 1. Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 2. Initial Data Load
    useEffect(() => {
        fetchLocation();
        fetchDailyRecords();
        fetchMonthlyRecords();
        fetchCorrectionHistory();
    }, []);

    useEffect(() => {
        fetchDailyRecords();
    }, [selectedDate]);

    useEffect(() => {
        fetchMonthlyRecords();
    }, [reportMonth]);

    // --- FETCHING ---

    const fetchLocation = () => {
        setIsLoadingLoc(true);
        if (!navigator.geolocation) {
            setLocation(prev => ({ ...prev, error: 'Geolocation not supported', address: 'Unknown' }));
            setIsLoadingLoc(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await res.json();
                    setLocation({
                        lat: latitude,
                        lng: longitude,
                        address: data.display_name?.split(',')[0] || 'Unknown Location',
                        error: null
                    });
                } catch (err) {
                    setLocation({ lat: latitude, lng: longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, error: null });
                } finally {
                    setIsLoadingLoc(false);
                }
            },
            (err) => {
                setLocation(prev => ({ ...prev, error: err.message, address: 'Location Access Denied' }));
                setIsLoadingLoc(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const fetchDailyRecords = async () => {
        try {
            const res = await attendanceService.getMyRecords(selectedDate, selectedDate);
            if (res.ok || res.data) {
                const records = res.data || res || [];
                setDailySessions(Array.isArray(records) ? records : []);
            }
        } catch (error) {
            console.error("Failed to fetch daily records", error);
        }
    };

    const fetchMonthlyRecords = async () => {
        if (!reportMonth) return;
        setLoading(true);
        const [year, month] = reportMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        try {
            const res = await attendanceService.getMyRecords(startDate, endDate);
            if (res.ok || res.data) {
                const records = res.data || res || [];
                setMonthlySessions(Array.isArray(records) ? records : []);
            }
        } catch (error) {
            console.error("Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    const fetchCorrectionHistory = async () => {
        try {
            const res = await attendanceService.getCorrectionRequests();
            setCorrectionHistory(res.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    // --- ACTIONS ---

    const openCamera = (mode) => {
        setCameraMode(mode);
        setShowCamera(true);
        setImgSrc(null);
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
        let arr = dataurl.split(';base64,'), mime = arr[0].match(/:(.*?);/) ? arr[0].match(/:(.*?);/)[1] : 'image/png';
        let bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };

    const confirmAttendance = async () => {
        if (!imgSrc || !location.lat) return;

        setIsSubmitting(true);
        try {
            const imageBlob = dataURLtoBlob(imgSrc);
            const payload = {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: 10,
                imageFile: imageBlob
            };

            if (cameraMode === 'IN') {
                await attendanceService.timeIn(payload);
                toast.success("Checked In Successfully!");
            } else {
                await attendanceService.timeOut(payload);
                toast.success("Checked Out Successfully!");
            }

            closeCamera();
            fetchDailyRecords();
            fetchMonthlyRecords();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Attendance failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const downloadReport = async () => {
        if (!reportMonth) return;
        setIsDownloading(true);
        try {
            const blob = await attendanceService.downloadMyReport(reportMonth, 'xlsx');
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Report_${reportMonth}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Report downloaded successfully");
        } catch (error) {
            console.error("Download failed", error);
            toast.error("Failed to download report");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCorrectionSubmit = async () => {
        if (!correctionForm.reason) {
            toast.error("Reason is required");
            return;
        }

        if (correctionForm.method === 'manual') {
            for (let i = 0; i < correctionForm.sessions.length; i++) {
                const s = correctionForm.sessions[i];
                if (!s.in || !s.out) {
                    toast.error(`Please fill in all times for Session ${i + 1}`);
                    return;
                }
                if (s.in >= s.out) {
                    toast.error(`Out time must be after In time for Session ${i + 1}`);
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                request_date: correctionForm.date,
                correction_type: correctionForm.type,
                reason: correctionForm.reason,
                details: {
                    method: correctionForm.method,
                    sessions: correctionForm.sessions
                }
            };

            await attendanceService.submitCorrectionRequest(payload);
            toast.success("Correction Request Submitted");
            setIsCorrectionOpen(false);
            setCorrectionForm({ ...correctionForm, sessions: [{ in: '', out: '' }], reason: '' });
            fetchCorrectionHistory();
        } catch (error) {
            console.error("Correction submit failed", error);
            toast.error(error.message || "Failed to submit correction");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateStatus = async (requestId, newStatus) => {
        setIsUpdatingStatus(true);
        try {
            // Note: replace 'updateCorrectionStatus' with your actual service call
            await attendanceService.updateCorrectionStatus(requestId, { status: newStatus });
            toast.success(`Request ${newStatus.toLowerCase()} successfully`);
            setSelectedRequest(null);
            fetchCorrectionHistory();
        } catch (error) {
            console.error('Update status failed', error);
            toast.error(error.message || `Failed to ${newStatus.toLowerCase()} request`);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const addSession = () => {
        setCorrectionForm({
            ...correctionForm,
            sessions: [...correctionForm.sessions, { in: '', out: '' }]
        });
    };

    const removeSession = (index) => {
        if (correctionForm.sessions.length > 1) {
            const newSessions = [...correctionForm.sessions];
            newSessions.splice(index, 1);
            setCorrectionForm({ ...correctionForm, sessions: newSessions });
        }
    };

    const updateSession = (index, field, value) => {
        const newSessions = [...correctionForm.sessions];
        newSessions[index][field] = value;
        setCorrectionForm({ ...correctionForm, sessions: newSessions });
    };

    // --- HELPERS ---

    const calculateHours = (inTime, outTime) => {
        if (!inTime || !outTime) return '0h 0m';
        const start = new Date(inTime);
        const end = new Date(outTime);
        const diffMs = end - start;
        if (diffMs < 0) return '0h 0m';
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.round((diffMs % 3600000) / 60000);
        return `${diffHrs}h ${diffMins}m`;
    };

    const todayRecord = dailySessions.length > 0 ? dailySessions[dailySessions.length - 1] : null;

    // Analytics Calcs
    const totalRecords = monthlySessions.length;
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let totalHours = 0;

    // Charts Data Prep
    const attendanceTrendData = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekStats = { Sun: { hrs: 0, count: 0 }, Mon: { hrs: 0, count: 0 }, Tue: { hrs: 0, count: 0 }, Wed: { hrs: 0, count: 0 }, Thu: { hrs: 0, count: 0 }, Fri: { hrs: 0, count: 0 }, Sat: { hrs: 0, count: 0 } };

    monthlySessions.forEach(session => {
        const h = parseFloat(session.total_hours || session.hours || 0); // fallback to session.hours
        totalHours += h;
        if (session.status === 'ABSENT') {
            absentCount++;
        } else {
            presentCount++;
            if (session.late_minutes > 0) lateCount++;
        }

        // Safely parse the date. Depending on backend, it might be time_in, date, or request_date
        const dateString = session.time_in || session.date || session.shift_date || session.created_at;
        const d = dateString ? new Date(dateString) : null;

        // Area Chart Data
        if (d && !isNaN(d)) {
            attendanceTrendData.push({
                date: d.getDate(),
                hours: h
            });

            // Radar Chart Data
            const dayName = daysOfWeek[d.getDay()];
            if (weekStats[dayName]) {
                weekStats[dayName].hrs += h;
                weekStats[dayName].count += 1;
            }
        }
    });

    // Ensure array is sorted by date for the area chart
    attendanceTrendData.sort((a, b) => a.date - b.date);

    const weeklyActivityData = daysOfWeek.map(day => ({
        day,
        hours: weekStats[day].count > 0 ? (weekStats[day].hrs / weekStats[day].count).toFixed(1) : 0
    }));

    const statusPieData = [
        { name: 'On Time', value: presentCount - lateCount, color: '#10b981' }, // emerald-500
        { name: 'Late', value: lateCount, color: '#f59e0b' } // amber-500
    ].filter(d => d.value > 0);

    const avgHours = totalRecords > 0 ? (totalHours / totalRecords).toFixed(1) : '0.0';
    const presentPercentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
    const latePercentage = totalRecords > 0 ? Math.round((lateCount / totalRecords) * 100) : 0;

    const filteredCorrections = correctionHistory.filter(item => {
        const status = (item.status || 'PENDING').toUpperCase();
        if (correctionFilter === 'pending') return status === 'PENDING';
        return status !== 'PENDING';
    });


    return (
        <>
            <MobileDashboardLayout title="Attendance">

                {/* Main Tab Switcher - Full Width */}
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-none flex shadow-sm mb-4">
                    <button
                        onClick={() => setMainTab('attendance')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                        ${mainTab === 'attendance'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                    >
                        <User size={18} className={mainTab === 'attendance' ? 'text-slate-900 dark:text-white' : 'text-slate-400'} />
                        Attendance
                    </button>
                    <button
                        onClick={() => setMainTab('my_attendance')}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                        ${mainTab === 'my_attendance'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-[1.02]'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                    >
                        <History size={18} className={mainTab === 'my_attendance' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                        My Attendance
                    </button>
                </div>

                <div className="px-4 pb-24 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">

                    {/* --- ATTENDANCE TAB CONTENT --- */}
                    {mainTab === 'attendance' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">

                            {/* Time In Card */}
                            <div
                                onClick={() => openCamera('IN')}
                                className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-6 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-transform border border-emerald-100 dark:border-emerald-900"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                        <LogOut size={24} className="rotate-180" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Time In</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Start your shift</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-slate-400" />
                            </div>

                            {/* Time Out Card */}
                            <div
                                onClick={() => openCamera('OUT')}
                                className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-transform border border-red-100 dark:border-red-900"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-red-900/40 flex items-center justify-center text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800">
                                        <LogOut size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Time Out</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Not checked in</p>
                                    </div>
                                </div>
                            </div>

                            {/* Activity Header */}
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white pt-2">Activity</h3>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsCorrectionOpen(true)}
                                    className="flex-1 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm active:scale-[0.98] transition-transform"
                                >
                                    <FileText size={16} className="text-indigo-600" />
                                    Correction
                                </button>
                                <button className="flex-1 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
                                    <Calendar size={16} className="text-indigo-600" />
                                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </button>
                            </div>

                            {/* Empty State */}
                            <div className="py-12 text-center">
                                <p className="text-slate-400 text-sm">No records for this date</p>
                            </div>

                        </div>
                    )}


                    {/* --- MY ATTENDANCE TAB CONTENT --- */}
                    {mainTab === 'my_attendance' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Sub Tabs */}
                            <div className="flex justify-between items-center mb-6 px-2">
                                {['history', 'analytics', 'corrections'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setSubTab(tab)}
                                        className={`text-sm font-semibold pb-2 border-b-2 capitalize transition-colors
                                        ${subTab === tab
                                                ? 'text-indigo-600 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                                                : 'text-slate-400 border-transparent hover:text-slate-600'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* HISTORY CONTENT - UPDATED UI */}
                            {subTab === 'history' && (
                                <div className="space-y-6">
                                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">My Shifts</h3>

                                    <div className="space-y-4">
                                        {monthlySessions.length > 0 ? (
                                            monthlySessions.map((session, idx) => (
                                                <div key={idx} className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                                                    {/* Date Block */}
                                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold shrink-0">
                                                        <span className="text-lg leading-none">{new Date(session.time_in).getDate()}</span>
                                                    </div>

                                                    {/* Details */}
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">
                                                            {new Date(session.time_in).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                                        </h4>
                                                        <p className="text-[10px] text-slate-400 truncate">
                                                            {session.location || "Office"}
                                                        </p>
                                                    </div>

                                                    {/* Times - 3 Columns Layout */}
                                                    <div className="grid grid-cols-3 gap-3 text-right shrink-0 min-w-[140px]">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">IN</span>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                {new Date(session.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">OUT</span>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                {session.time_out ? new Date(session.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">HRS</span>
                                                            <span className="text-xs font-bold text-slate-800 dark:text-white">
                                                                {session.time_out ? calculateHours(session.time_in, session.time_out) : '0h 0m'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-slate-400 py-8">No history found for this month</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ANALYTICS CONTENT */}
                            {subTab === 'analytics' && (
                                <div className="space-y-6">
                                    {/* Report Download Card */}
                                    <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 dark:text-white text-base">Monthly Report</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Download and view your logs</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <select
                                                    value={reportMonth}
                                                    onChange={(e) => setReportMonth(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl py-2.5 px-3 appearance-none"
                                                >
                                                    {Array.from({ length: 12 }, (_, i) => {
                                                        const d = new Date(new Date().getFullYear(), i, 1);
                                                        return <option key={i} value={`${d.getFullYear()}-${String(i + 1).padStart(2, '0')}`}>{d.toLocaleString('default', { month: 'long' })}</option>
                                                    })}
                                                </select>
                                                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
                                            </div>

                                            <div className="relative w-28">
                                                <select
                                                    value={reportYear}
                                                    onChange={(e) => setReportYear(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl py-2.5 px-3 appearance-none"
                                                >
                                                    <option value="2026">2026</option>
                                                    <option value="2025">2025</option>
                                                </select>
                                                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
                                            </div>
                                        </div>

                                        <button
                                            onClick={downloadReport}
                                            disabled={isDownloading}
                                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white text-sm font-bold rounded-xl py-3 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                                        >
                                            {isDownloading ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> : <Download size={16} />}
                                            Download
                                        </button>
                                    </div>

                                    {/* Summary Stats Vertical List */}
                                    <div className="space-y-4">
                                        <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Records</p>
                                                <Calendar className="text-slate-400 dark:text-slate-500" size={20} />
                                            </div>
                                            <h4 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{totalRecords}</h4>
                                        </div>

                                        <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Present</p>
                                                <div className="px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs font-bold">
                                                    {presentPercentage}%
                                                </div>
                                            </div>
                                            <h4 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{presentCount}</h4>
                                        </div>

                                        <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Late</p>
                                                <div className="px-2 py-0.5 rounded-full border border-rose-500/30 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 text-xs font-bold">
                                                    {latePercentage}%
                                                </div>
                                            </div>
                                            <h4 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{lateCount}</h4>
                                        </div>

                                        <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg Hours</p>
                                                <Clock className="text-sky-500 dark:text-sky-400" size={20} />
                                            </div>
                                            <h4 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{avgHours}</h4>
                                        </div>
                                    </div>

                                    {/* Charts */}

                                    {/* 1. Area Chart (Total Attendance Report) */}
                                    <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/60">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Total Attendance Report</h3>
                                            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                            </button>
                                        </div>
                                        <div className="h-64 -ml-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:opacity-10" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'dataMax + 2']} />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                    <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* 2. Attendance Status (Donut Chart) */}
                                    <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/60">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">Attendance Status</h3>

                                        <div className="flex items-center justify-between">
                                            <div className="relative w-40 h-40">
                                                {statusPieData.length > 0 ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={statusPieData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={50}
                                                                outerRadius={70}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                                stroke="none"
                                                            >
                                                                {statusPieData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 12 }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">No Data</div>
                                                )}
                                                {/* Center Text */}
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                    <span className="text-3xl font-bold text-slate-800 dark:text-white leading-none">{presentCount}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">On Time</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Late</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Weekly Activity (Radar Chart) */}
                                    <div className="bg-white dark:bg-[#1a2332] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/60">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Weekly Activity</h3>
                                        <div className="h-64 flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={weeklyActivityData}>
                                                    <PolarGrid stroke="#e2e8f0" className="dark:opacity-20" />
                                                    <PolarAngleAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                    <PolarRadiusAxis angle={30} domain={[0, 12]} tick={false} axisLine={false} />
                                                    <Radar name="Hours" dataKey="hours" stroke="#6366f1" strokeWidth={2} fill="#6366f1" fillOpacity={0.2} />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                                                    />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CORRECTIONS CONTENT - UPDATED FILTERING */}
                            {subTab === 'corrections' && (
                                <div className="space-y-6">
                                    {/* Toggle */}
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            onClick={() => setCorrectionFilter('pending')}
                                            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${correctionFilter === 'pending' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-transparent border-transparent text-slate-400'}`}
                                        >
                                            Pending
                                        </button>
                                        <button
                                            onClick={() => setCorrectionFilter('history')}
                                            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${correctionFilter === 'history' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-transparent border-transparent text-slate-400'}`}
                                        >
                                            History
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {filteredCorrections.length > 0 ? filteredCorrections.map((item, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => handleRequestClick(item)}
                                                className={`bg-white dark:bg-[#1a2332] p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${isFetchingDetails ? 'opacity-50 pointer-events-none' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                                        {item.employee_name ? item.employee_name.charAt(0) : (user?.name ? user.name.charAt(0) : 'U')}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[150px]">{item.employee_name || user?.name || 'You'}</h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{item.correction_type} • {new Date(item.request_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                                                    ${(item.status || 'PENDING').toUpperCase() === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                            : (item.status || 'PENDING').toUpperCase() === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400'
                                                                : 'bg-amber-50 text-amber-600 border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                        {(item.status || 'PENDING').toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        )) : (
                                            <p className="text-center text-slate-400 py-8">No {correctionFilter} corrections found</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* --- CORRECTION POPUP MODAL --- */}
                {isCorrectionOpen && createPortal(
                    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
                                    <AlertCircle size={20} />
                                    <h3>Apply Correction</h3>
                                </div>
                                <button onClick={() => setIsCorrectionOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Form */}
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
                                {/* Date */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        value={correctionForm.date}
                                        onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold outline-none focus:border-indigo-500 transition-colors dark:text-white"
                                    />
                                </div>

                                {/* Type */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Type</label>
                                    <div className="relative">
                                        <select
                                            value={correctionForm.type}
                                            onChange={(e) => setCorrectionForm({ ...correctionForm, type: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold outline-none focus:border-indigo-500 transition-colors appearance-none dark:text-white"
                                        >
                                            <option value="Missed Punch">Missed Punch</option>
                                            <option value="Late Arrival">Late Arrival</option>
                                            <option value="Early Departure">Early Departure</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" size={16} />
                                    </div>
                                </div>

                                {/* Method */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Method</label>
                                    <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl">
                                        <button
                                            onClick={() => setCorrectionForm({ ...correctionForm, method: 'manual' })}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${correctionForm.method === 'manual' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
                                        >
                                            Manual Correction
                                        </button>
                                        <button
                                            onClick={() => setCorrectionForm({ ...correctionForm, method: 'reset' })}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${correctionForm.method === 'reset' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
                                        >
                                            Reset Day
                                        </button>
                                    </div>
                                </div>

                                {/* Sessions (If manual) */}
                                {correctionForm.method === 'manual' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Sessions</label>
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-3 relative">
                                            {correctionForm.sessions.map((session, idx) => (
                                                <div key={idx} className="col-span-2 flex items-center gap-2">
                                                    <div className="flex-1 flex gap-2">
                                                        <input
                                                            placeholder="IN"
                                                            type="time"
                                                            value={session.in}
                                                            onChange={(e) => updateSession(idx, 'in', e.target.value)}
                                                            className="flex-1 w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                                        />
                                                        <input
                                                            placeholder="OUT"
                                                            type="time"
                                                            value={session.out}
                                                            onChange={(e) => updateSession(idx, 'out', e.target.value)}
                                                            className="flex-1 w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                                        />
                                                    </div>
                                                    {correctionForm.sessions.length > 1 && (
                                                        <button
                                                            onClick={() => removeSession(idx)}
                                                            className="w-10 h-10 flex shrink-0 items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/10 text-rose-500 active:scale-95 transition-transform"
                                                        >
                                                            <Minus size={18} strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}

                                            <div className="col-span-2 mt-1">
                                                <button
                                                    onClick={addSession}
                                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-500 dark:text-slate-400 text-[13px] font-bold flex items-center justify-center gap-2 hover:border-indigo-400 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all active:scale-[0.98]"
                                                >
                                                    <Plus size={16} strokeWidth={2.5} /> Add Another Session
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Reason */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Reason</label>
                                    <textarea
                                        placeholder="Why is this correction needed?"
                                        value={correctionForm.reason}
                                        onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-medium outline-none focus:border-indigo-500 transition-colors min-h-[80px] dark:text-white"
                                    ></textarea>
                                </div>

                                {/* Attachments */}
                                <div className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <Paperclip size={18} />
                                    <span className="text-xs font-medium flex-1">Attach Documents (PDF, Images)</span>
                                    <Plus size={18} className="text-indigo-600 bg-indigo-50 rounded-full p-0.5" />
                                </div>

                                {/* Submit */}
                                <button
                                    onClick={handleCorrectionSubmit}
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> : <CheckCircle size={18} />}
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* --- CAMERA PORTAL --- */}
                {showCamera && createPortal(
                    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex flex-col items-center justify-center p-4">
                        <div className="w-full max-w-sm relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
                            <div className="absolute top-4 right-4 z-10">
                                <button onClick={closeCamera} className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md"><X size={20} /></button>
                            </div>

                            <div className="relative aspect-[3/4] bg-slate-900 w-full">
                                {imgSrc ? (
                                    <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
                                ) : (
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        className="w-full h-full object-cover flip-horizontal"
                                        videoConstraints={{ facingMode: "user" }}
                                    />
                                )}
                            </div>

                            <div className="p-6 pb-8 bg-black">
                                <h3 className="text-center text-white font-bold text-lg mb-6">{cameraMode === 'IN' ? 'Punching In...' : 'Punching Out...'}</h3>
                                <div className="flex justify-center gap-6">
                                    {!imgSrc ? (
                                        <button onClick={capture} className="w-16 h-16 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                                            <div className="w-14 h-14 rounded-full bg-indigo-600"></div>
                                        </button>
                                    ) : (
                                        <div className="flex w-full gap-3">
                                            <button onClick={retake} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition-transform">Retake</button>
                                            <button onClick={confirmAttendance} disabled={isSubmitting} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                                                {isSubmitting ? <span className="animate-spin">...</span> : 'Confirm'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* --- CORRECTION DETAILS VIEW MODAL --- */}
                {selectedRequest && createPortal(
                    <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4">
                        <div className="bg-white dark:bg-[#111827] w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] sm:rounded-[2rem] rounded-t-[2rem] flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                            {/* Header Pull Bar (Mobile) */}
                            <div className="sm:hidden w-full flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                            </div>

                            {/* Modal Header */}
                            <div className="px-6 py-4 flex justify-between items-start border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                                <div>
                                    <h3 className="font-bold text-2xl text-slate-900 dark:text-white">Request #{selectedRequest.request_id || selectedRequest.id || Math.floor(Math.random() * 100) + 1}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                                            {(selectedRequest.employee_name || user?.name || 'U').charAt(0)}
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">By {selectedRequest.employee_name || user?.name || 'Employee'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} className="p-2 sm:p-1 text-slate-400 hover:text-slate-600 bg-slate-50 sm:bg-transparent dark:bg-slate-800 sm:dark:bg-transparent rounded-full transition-colors active:scale-90">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Content Scrollable Area */}
                            <div className="px-6 py-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">

                                {/* Correction Details */}
                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Correction Details</h4>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="bg-white dark:bg-[#1a2332] border border-slate-100 dark:border-slate-800 overflow-hidden rounded-2xl p-4 shadow-sm flex flex-col justify-center">
                                            <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">Request Type</span>
                                            <span className="font-bold text-slate-800 dark:text-white text-sm uppercase">{selectedRequest.correction_type || selectedRequest.type}</span>
                                        </div>
                                        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/30 overflow-hidden rounded-2xl p-4 shadow-sm flex flex-col justify-center">
                                            <span className="text-xs text-indigo-500/70 dark:text-indigo-400/70 mb-1">Method</span>
                                            <span className="font-bold text-indigo-700 dark:text-indigo-400 text-sm uppercase">{selectedRequest.details?.method || 'MANUAL'}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-[#1a2332] border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 mb-3 block">Requested Sessions</span>
                                        <div className="space-y-2">
                                            {selectedRequest.details?.sessions?.map((s, i) => (
                                                <div key={i} className="flex flex-col mb-1 text-sm font-bold text-slate-800 dark:text-white">
                                                    <span>In: {s.in || s.time_in || '--:--'}</span>
                                                    <span>Out: {s.out || s.time_out || '--:--'}</span>
                                                </div>
                                            )) || (
                                                    <div className="flex flex-col text-sm font-bold text-slate-800 dark:text-white">
                                                        <span>In: {selectedRequest.time_in || '--:--'}</span>
                                                        <span>Out: {selectedRequest.time_out || '--:--'}</span>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </section>

                                {/* Justification */}
                                <section>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Justification & Comments</h4>
                                    <div className="bg-white dark:bg-[#1a2332] border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start gap-3">
                                        <FileText size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                        <p className="text-sm font-medium italic text-slate-600 dark:text-slate-300">
                                            "{selectedRequest.reason || selectedRequest.comments || 'No comment provided'}"
                                        </p>
                                    </div>
                                </section>

                                {/* Audit Trail */}
                                <section>
                                    <div className="border-t border-slate-100 dark:border-slate-800/60 mb-6"></div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <History size={14} className="text-slate-400" />
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audit Trail</h4>
                                    </div>

                                    <div className="relative pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                                        {/* Submited */}
                                        <div className="relative">
                                            <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-white dark:bg-[#111827] border-2 border-indigo-500"></div>
                                            <h5 className="font-bold text-sm text-slate-800 dark:text-white">Submitted</h5>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {new Date(selectedRequest.created_at || selectedRequest.request_date).toLocaleString()} • by {selectedRequest.employee_name || user?.name || 'User'}
                                            </p>
                                        </div>

                                        {/* Final Status (if processed) */}
                                        {(selectedRequest.status || 'PENDING').toUpperCase() !== 'PENDING' && (
                                            <div className="relative">
                                                <div className={`absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-white dark:bg-[#111827] border-2 
                                                ${(selectedRequest.status).toUpperCase() === 'APPROVED' ? 'border-emerald-500' : 'border-rose-500'}`}>
                                                </div>
                                                <h5 className="font-bold text-sm text-slate-800 dark:text-white drop-shadow-sm capitalize">
                                                    {(selectedRequest.status).toLowerCase()}
                                                </h5>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {new Date(selectedRequest.updated_at || Date.now()).toLocaleString()} • by {selectedRequest.approved_by || 'Admin/HR'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            {/* Admin/HR Action Buttons (Bottom Fixed) */}
                            {/* Only show if user is Admin/HR and request is PENDING */}
                            {['admin', 'hr', 'manager'].includes((user?.role || '').toLowerCase()) && (selectedRequest.status || 'PENDING').toUpperCase() === 'PENDING' && (
                                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#111827] shrink-0 sm:rounded-b-[2rem] flex gap-3">
                                    <button
                                        onClick={() => handleUpdateStatus(selectedRequest.request_id || selectedRequest._id || selectedRequest.id, 'REJECTED')}
                                        disabled={isUpdatingStatus}
                                        className="flex-1 py-3.5 bg-white dark:bg-[#1a2332] border border-rose-200 dark:border-rose-900 shadow-sm text-rose-600 dark:text-rose-500 font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedRequest.request_id || selectedRequest._id || selectedRequest.id, 'APPROVED')}
                                        disabled={isUpdatingStatus}
                                        className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
                                    >
                                        {isUpdatingStatus ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> : 'Accept'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
            </MobileDashboardLayout>
        </>
    );
};

export default Attendance;
